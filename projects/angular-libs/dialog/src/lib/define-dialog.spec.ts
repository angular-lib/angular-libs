import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { defineDialog, dialogResult, isDialogDefinition } from './define-dialog';
import { injectDialog } from './inject-dialog';
import type { DialogOutcome } from './dialog-ref';

interface User {
  id: number;
  name: string;
}

@Component({
  selector: 'dd-edit-user',
  template: '<p>{{ user().name }}</p>',
})
class EditUserComponent {
  readonly user = input.required<User>();
  readonly note = input<string>();
  readonly dialog = injectDialog<User>();
}

@Component({ selector: 'dd-plain', template: '<p>plain</p>' })
class PlainComponent {}

const EditUserDialog = defineDialog(EditUserComponent, { size: 'md', ariaLabel: 'Edit user' });

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(): T | void {}

describe('defineDialog', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
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

  it('creates eager and lazy definitions', () => {
    expect(isDialogDefinition(EditUserDialog)).toBe(true);
    expect('component' in EditUserDialog).toBe(true);
    const lazy = defineDialog(() => Promise.resolve(PlainComponent));
    expect('load' in lazy).toBe(true);
    expect(isDialogDefinition(PlainComponent)).toBe(false);
  });

  it('infers result and enforces required inputs (types)', () => {
    const user: User = { id: 1, name: 'Ada' };
    const ref = service.open(EditUserDialog, { user });
    assertType<Equal<Awaited<typeof ref.outcome>, DialogOutcome<User>>>();

    // Type-only checks: never executed.
    const typeChecks = () => {
      // @ts-expect-error — `user` is required
      service.open(EditUserDialog);
      // @ts-expect-error — wrong input type
      service.open(EditUserDialog, { user: 'nope' });
      // @ts-expect-error — `user` is required for run() too
      void service.run(EditUserDialog);
      // A preset makes `user` optional.
      service.open(defineDialog(EditUserComponent, { inputs: { user } }));
    };
    void typeChecks;

    const Colors = defineDialog(PlainComponent, { result: dialogResult<string>() });
    const colorRef = service.open(Colors);
    assertType<Equal<Awaited<typeof colorRef.outcome>, DialogOutcome<string>>>();
    void ref.close();
    void colorRef.close();
  });

  it('merges definition options, presets, and per-call overrides', () => {
    const user: User = { id: 1, name: 'Ada' };
    const Preset = defineDialog(EditUserComponent, {
      size: 'sm',
      panelClass: 'preset',
      inputs: { note: 'preset note' },
    });
    const ref = service.open(Preset, { user }, { size: 'lg' });
    expect(ref.dialogEl.style.width).toBe('640px');
    expect(ref.dialogEl.classList.contains('preset')).toBe(true);
    expect(ref.component.note()).toBe('preset note');
    expect(ref.component.user()).toEqual(user);
    void ref.close();
  });

  it('run() resolves ok with the value', async () => {
    const user: User = { id: 1, name: 'Ada' };
    const pending = service.run(EditUserDialog, { user });
    await Promise.resolve();
    const ref = service.openDialogs[0];
    await ref.close({ ...user, name: 'Grace' });
    const outcome = await pending;
    expect(outcome).toEqual({ ok: true, value: { id: 1, name: 'Grace' }, source: 'manual' });
  });

  it('run() resolves ok:false on dismissal', async () => {
    const pending = service.run(EditUserDialog, { user: { id: 1, name: 'Ada' } });
    await Promise.resolve();
    await service.openDialogs[0].close(undefined, 'escape');
    expect(await pending).toEqual({ ok: false, reason: 'escape' });
  });

  it('run() loads lazy definitions once', async () => {
    const load = vi.fn(() => Promise.resolve(PlainComponent));
    const Lazy = defineDialog(load);

    for (let i = 0; i < 2; i++) {
      const pending = service.run(Lazy);
      await vi.waitFor(() => expect(service.openDialogs.length).toBe(1));
      await service.openDialogs[0].close();
      await pending;
    }
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('open() rejects lazy definitions at runtime', () => {
    const Lazy = defineDialog(() => Promise.resolve(PlainComponent));
    // @ts-expect-error — lazy definitions need run()
    expect(() => service.open(Lazy)).toThrow(/run\(\)/);
  });
});
