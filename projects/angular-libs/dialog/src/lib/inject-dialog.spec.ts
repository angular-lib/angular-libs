import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { injectDialog } from './inject-dialog';
import { DefaultDialogComponent } from './components/default-dialog.component';

@Component({ selector: 'id-form', template: '<p>form</p>' })
class FormDialogComponent {
  readonly dialog = injectDialog<string>();
  dirty = false;
  saveImpl: () => Promise<string> = () => Promise.resolve('saved');
  guardAnswer = true;

  constructor() {
    this.dialog.guard(() => !this.dirty || this.guardAnswer);
  }

  readonly save = this.dialog.action(() => this.saveImpl());
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('injectDialog', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  let service: DialogService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DialogService);
  });

  afterEach(() => {
    document.querySelectorAll('dialog.al-dialog').forEach((el) => el.remove());
  });

  it('infers the result type from an injectDialog property', async () => {
    const ref = service.open(FormDialogComponent);
    const outcome = await Promise.all([ref.outcome, ref.close('x')]).then(([o]) => o);
    // `outcome.value` is typed as string
    if (outcome.ok) expect(outcome.value.toUpperCase()).toBe('X');
  });

  it('guard blocks dismissal but not a close with a value', async () => {
    const ref = service.open(FormDialogComponent);
    ref.component.dirty = true;
    ref.component.guardAnswer = false;

    await ref.close(undefined, 'escape');
    expect(ref.dialogEl.open).toBe(true);

    await ref.close('value');
    expect(ref.dialogEl.open).toBe(false);
  });

  it('guard allows dismissal when it returns true', async () => {
    const ref = service.open(FormDialogComponent);
    ref.component.dirty = true;
    ref.component.guardAnswer = true;
    await ref.close(undefined, 'backdrop');
    expect(await ref.outcome).toEqual({ ok: false, reason: 'backdrop' });
  });

  it('action tracks pending, blocks dismiss, and closes with the value', async () => {
    const ref = service.open(FormDialogComponent);
    const work = deferred<string>();
    ref.component.saveImpl = () => work.promise;

    const running = ref.component.save();
    await Promise.resolve();
    expect(ref.component.save.pending()).toBe(true);
    expect(ref.busy()).toBe(true);
    expect(ref.dialogEl.getAttribute('aria-busy')).toBe('true');

    await ref.close(undefined, 'escape');
    expect(ref.dialogEl.open).toBe(true);

    work.resolve('done');
    await running;
    expect(await ref.outcome).toEqual({ ok: true, value: 'done', source: 'action' });
    expect(ref.dialogEl.hasAttribute('aria-busy')).toBe(false);
  });

  it('action keeps the dialog open and exposes the error on failure', async () => {
    const ref = service.open(FormDialogComponent);
    ref.component.saveImpl = () => Promise.reject(new Error('boom'));

    await ref.component.save();
    expect(ref.dialogEl.open).toBe(true);
    expect((ref.component.save.error() as Error).message).toBe('boom');
    expect(ref.busy()).toBe(false);

    ref.component.saveImpl = () => Promise.resolve('retry ok');
    await ref.component.save();
    expect(ref.component.save.error()).toBeNull();
    expect(ref.dialogEl.open).toBe(false);
  });
});

describe('confirm onConfirm / tone', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  afterEach(() => {
    document.querySelectorAll('dialog.al-dialog').forEach((el) => el.remove());
  });

  it('runs onConfirm, shows errors inline, and resolves true after success', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(DialogService);
    let attempts = 0;
    const pending = service.confirm({
      title: 'Delete?',
      tone: 'danger',
      errorText: (e) => `Failed: ${(e as Error).message}`,
      onConfirm: async () => {
        attempts++;
        if (attempts === 1) throw new Error('offline');
      },
    });
    await Promise.resolve();
    const ref = service.openDialogs[0];
    const comp = ref.component as DefaultDialogComponent;
    TestBed.tick();

    const primary = ref.dialogEl.querySelector<HTMLButtonElement>('.al-btn-danger');
    expect(primary).toBeTruthy();

    await comp.onPrimary();
    TestBed.tick();
    expect(ref.dialogEl.open).toBe(true);
    expect(ref.dialogEl.querySelector('.al-dialog-error')?.textContent).toContain('Failed: offline');

    await comp.onPrimary();
    await expect(pending).resolves.toBe(true);
    expect(attempts).toBe(2);
  });

  it('cancel after a failed onConfirm resolves false', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(DialogService);
    const pending = service.confirm({ onConfirm: () => Promise.reject(new Error('x')) });
    await Promise.resolve();
    const comp = service.openDialogs[0].component as DefaultDialogComponent;
    await comp.onPrimary();
    comp.onSecondary();
    await expect(pending).resolves.toBe(false);
  });
});
