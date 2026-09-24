import { Component, ErrorHandler, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchDom } from '@angular-libs/dialog/testing';
import { DialogService } from './dialog.service';
import { injectDialog } from './inject-dialog';
import { DialogParts } from './parts';
import { provideDialog } from './types';
import type { DialogOutcome } from './dialog-ref';

interface User {
  name: string;
}

@Component({
  selector: 'test-edit-user',
  imports: [DialogParts],
  template: `<al-dialog-header>Edit {{ user().name }}</al-dialog-header><input autofocus />`,
})
class EditUser {
  readonly user = input.required<User>();
  readonly note = input<string>();
  readonly dialog = injectDialog<User>();
  dirty = false;
  allowDiscard = false;
  work: () => Promise<User> = async () => this.user();

  constructor() {
    this.dialog.guard(() => !this.dirty || this.allowDiscard);
  }

  readonly save = this.dialog.action(() => this.work());
}

@Component({ selector: 'test-plain', template: '<p>plain</p>' })
class Plain {}

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <T extends true>() => {};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('DialogService', () => {
  let dialog: DialogService;
  const ada: User = { name: 'Ada' };

  beforeAll(patchDom);
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideDialog({ defaults: { mobile: 'sheet' } })] });
    dialog = TestBed.inject(DialogService);
  });
  afterEach(() => dialog.closeAll());

  it('renders the component with typed inputs and infers the result', async () => {
    const ref = dialog.open(EditUser, { user: ada, note: 'hi' }, { size: 'lg', panelClass: 'mine extra' });
    assertType<Equal<Awaited<typeof ref.closed>, DialogOutcome<User>>>();

    const el = ref.element as HTMLDialogElement;
    expect(el.open).toBe(true);
    expect(el.classList).toContain('al-dialog-lg');
    expect(el.classList).toContain('al-dialog-mobile-sheet'); // from provideDialog defaults
    expect(el.classList).toContain('extra');
    expect(ref.componentInstance.note()).toBe('hi');
    expect(el.textContent).toContain('Edit Ada');
    expect(dialog.openDialogs()).toEqual([ref]);

    // Type-only checks, never run.
    const typeChecks = () => {
      // @ts-expect-error — unknown input
      dialog.open(EditUser, { usr: ada });
      // @ts-expect-error — wrong input type
      dialog.open(EditUser, { user: 'Ada' });
      dialog.open(Plain); // no inputs needed
    };
    void typeChecks;
  });

  it('uses a custom size as CSS width', () => {
    const ref = dialog.open(Plain, {}, { size: '720px' });
    expect(ref.element.style.width).toBe('720px');
  });

  it('closes with a value (ok) or without one (dismissed)', async () => {
    const saved = dialog.open(EditUser, { user: ada });
    await saved.close({ name: 'Grace' });
    expect(await saved.closed).toEqual({ ok: true, value: { name: 'Grace' }, source: 'manual' });
    expect(saved.element.isConnected).toBe(false);
    expect(dialog.openDialogs()).toEqual([]);

    const dismissed = dialog.open(EditUser, { user: ada });
    dismissed.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await dismissed.closed).toEqual({ ok: false, source: 'escape' });
  });

  it('guards run for dismissals only', async () => {
    const ref = dialog.open(EditUser, { user: ada });
    ref.componentInstance.dirty = true;
    expect(await ref.close(undefined, 'backdrop')).toBe(false);
    expect((ref.element as HTMLDialogElement).open).toBe(true);
    expect(await ref.close(ada)).toBe(true);
  });

  it('a throwing guard keeps the dialog open and is reported', async () => {
    const errors = TestBed.inject(ErrorHandler);
    const spy = vi.spyOn(errors, 'handleError').mockImplementation(() => {});
    const ref = dialog.open(Plain);
    ref.addCloseGuard(() => {
      throw new Error('boom');
    });
    expect(await ref.close()).toBe(false);
    expect(spy).toHaveBeenCalledWith(new Error('boom'));
  });

  it('action: busy blocks closing, failure keeps it open, success closes with the value', async () => {
    const ref = dialog.open(EditUser, { user: ada });
    const edit = ref.componentInstance;
    const work = deferred<User>();
    edit.work = () => work.promise;

    const running = edit.save();
    await Promise.resolve();
    expect(ref.busy()).toBe(true);
    expect(ref.element.getAttribute('aria-busy')).toBe('true');
    expect(await ref.close(undefined, 'escape')).toBe(false);

    work.resolve({ name: 'Saved' });
    await running;
    expect(await ref.closed).toEqual({ ok: true, value: { name: 'Saved' }, source: 'action' });

    const failing = dialog.open(EditUser, { user: ada });
    failing.componentInstance.work = () => Promise.reject(new Error('offline'));
    failing.componentInstance.dirty = true; // a failed save must not trigger the guard either
    await failing.componentInstance.save();
    expect((failing.componentInstance.save.error() as Error).message).toBe('offline');
    expect((failing.element as HTMLDialogElement).open).toBe(true);
    expect(failing.busy()).toBe(false);
  });

  it('labels the dialog from the header part, unless ariaLabel is given', () => {
    const titled = dialog.open(EditUser, { user: ada });
    const title = titled.element.querySelector('.al-dialog-title')!;
    expect(titled.element.getAttribute('aria-labelledby')).toBe(title.id);

    const labelled = dialog.open(EditUser, { user: ada }, { ariaLabel: 'Custom' });
    expect(labelled.element.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('confirm resolves true / false, runs onConfirm with retry, and uses alertdialog', async () => {
    let attempts = 0;
    const pending = dialog.confirm({
      title: 'Delete?',
      tone: 'danger',
      errorText: (e) => `Failed: ${(e as Error).message}`,
      onConfirm: async () => {
        if (++attempts === 1) throw new Error('offline');
      },
    });
    const [ref] = dialog.openDialogs();
    TestBed.tick();
    expect(ref.element.getAttribute('role')).toBe('alertdialog');
    const confirmButton = ref.element.querySelector<HTMLButtonElement>('.al-btn-danger')!;
    confirmButton.click();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(ref.element.querySelector('.al-dialog-error')?.textContent).toContain('Failed: offline');
    });
    confirmButton.click();
    await expect(pending).resolves.toBe(true);
    expect(attempts).toBe(2);

    const cancelled = dialog.confirm({ title: 'Sure?' });
    TestBed.tick();
    dialog.openDialogs()[0].element.querySelector<HTMLButtonElement>('.al-btn-secondary')!.click();
    await expect(cancelled).resolves.toBe(false);
  });

  it('alert has a single button', async () => {
    const pending = dialog.alert({ title: 'Saved', message: 'All good' });
    const [ref] = dialog.openDialogs();
    TestBed.tick();
    expect(ref.element.querySelectorAll('al-dialog-footer button')).toHaveLength(1);
    ref.element.querySelector<HTMLButtonElement>('al-dialog-footer button')!.click();
    await expect(pending).resolves.toBeUndefined();
  });
});
