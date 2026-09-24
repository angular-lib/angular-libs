import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { provideDialog } from '../provide-dialog';
import { AlDialog } from '../al-dialog';
import { DialogParts } from './dialog-parts';

@Component({
  selector: 'dp-edit',
  imports: [DialogParts],
  template: `
    <al-dialog-header>
      Edit user
      <p alDialogSubtitle alDialogDescription>Changes apply immediately</p>
    </al-dialog-header>
    <al-dialog-body><input /></al-dialog-body>
    <al-dialog-footer>
      <button class="cancel" alDialogClose>Cancel</button>
      <button class="save" [alDialogClose]="value">Save</button>
    </al-dialog-footer>
  `,
})
class EditDialogComponent {
  value = { name: 'Ada' };
}

@Component({
  selector: 'dp-host',
  imports: [AlDialog, DialogParts],
  template: `
    <dialog alDialog [open]="open()" (closed)="open.set(false)">
      <h2 alDialogTitle id="kit-title">Kit</h2>
      <button class="close" alDialogClose>Close</button>
    </dialog>
  `,
})
class HeadlessHostComponent {
  open = signal(true);
}

describe('DialogParts', () => {
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

  afterEach(() => {
    document.querySelectorAll('dialog').forEach((el) => el.remove());
  });

  it('wires aria-labelledby / aria-describedby from the parts', () => {
    TestBed.configureTestingModule({});
    const ref = TestBed.inject(DialogService).open(EditDialogComponent);
    TestBed.tick();

    const title = ref.dialogEl.querySelector('.al-dialog-title')!;
    const desc = ref.dialogEl.querySelector('[alDialogSubtitle]')!;
    expect(title.id).toMatch(/^al-dialog-title-/);
    expect(ref.dialogEl.getAttribute('aria-labelledby')).toBe(title.id);
    expect(ref.dialogEl.getAttribute('aria-describedby')).toBe(desc.id);
    void ref.close();
  });

  it('explicit ariaLabel wins over the title part', () => {
    TestBed.configureTestingModule({});
    const ref = TestBed.inject(DialogService).open(EditDialogComponent, { ariaLabel: 'Custom' });
    TestBed.tick();
    expect(ref.dialogEl.hasAttribute('aria-labelledby')).toBe(false);
    void ref.close();
  });

  it('alDialogClose closes with and without a value', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(DialogService);

    const saveRef = service.open(EditDialogComponent);
    TestBed.tick();
    saveRef.dialogEl.querySelector<HTMLButtonElement>('.save')!.click();
    expect(await saveRef.outcome).toEqual({ ok: true, value: { name: 'Ada' }, source: 'manual' });

    const cancelRef = service.open(EditDialogComponent);
    TestBed.tick();
    const cancel = cancelRef.dialogEl.querySelector<HTMLButtonElement>('.cancel')!;
    expect(cancel.getAttribute('type')).toBe('button');
    cancel.click();
    expect(await cancelRef.outcome).toEqual({ ok: false, reason: 'manual' });
  });

  it('header close button uses provideDialog strings', () => {
    TestBed.configureTestingModule({ providers: [provideDialog({ strings: { close: 'Lukk' } })] });
    const ref = TestBed.inject(DialogService).open(EditDialogComponent);
    TestBed.tick();
    const icon = ref.dialogEl.querySelector('al-dialog-header .al-action-icon')!;
    expect(icon.getAttribute('aria-label')).toBe('Lukk');
    void ref.close();
  });

  it('alDialogClose ignores clicks while the dialog is busy', async () => {
    TestBed.configureTestingModule({});
    const ref = TestBed.inject(DialogService).open(EditDialogComponent);
    TestBed.tick();
    let release!: () => void;
    const busy = ref._trackBusy(() => new Promise<void>((r) => (release = r)));
    TestBed.tick();
    const save = ref.dialogEl.querySelector<HTMLButtonElement>('.save')!;
    expect(save.getAttribute('aria-disabled')).toBe('true');
    save.click();
    await Promise.resolve();
    expect(ref.dialogEl.open).toBe(true);
    release();
    await busy;
    void ref.close();
  });

  it('works on a headless <dialog alDialog>', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe('kit-title');

    dialog.querySelector<HTMLButtonElement>('.close')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
