import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchDom } from '@angular-libs/dialog/testing';
import { AlDialog } from './al-dialog';
import { DialogService } from './dialog.service';
import { DialogParts } from './parts';
import { provideDialog } from './types';

@Component({
  imports: [DialogParts],
  template: `
    <al-dialog-header>
      Edit
      <p alDialogSubtitle alDialogDescription>Short description</p>
    </al-dialog-header>
    <al-dialog-footer>
      <button class="cancel" alDialogClose>Cancel</button>
      <button class="save" type="submit" [alDialogClose]="42">Save</button>
    </al-dialog-footer>
  `,
})
class Parts {}

@Component({
  imports: [AlDialog, DialogParts],
  template: `
    <dialog alDialog [open]="open()" (closed)="open.set(false)">
      <h2 alDialogTitle id="kit-title">Kit</h2>
      <button alDialogClose>Close</button>
    </dialog>
  `,
})
class Headless {
  open = signal(true);
}

describe('DialogParts', () => {
  beforeAll(patchDom);

  it('wire aria-labelledby / aria-describedby', () => {
    const ref = TestBed.inject(DialogService).open(Parts);
    const el = ref.element;
    expect(el.getAttribute('aria-labelledby')).toBe(el.querySelector('.al-dialog-title')!.id);
    expect(el.getAttribute('aria-describedby')).toBe(el.querySelector('[alDialogSubtitle]')!.id);
    void ref.close();
  });

  it('alDialogClose closes with or without a value and defaults to type=button', async () => {
    const dialog = TestBed.inject(DialogService);
    const saved = dialog.open(Parts);
    const save = saved.element.querySelector<HTMLButtonElement>('.save')!;
    expect(save.type).toBe('submit'); // an explicit type is kept
    save.click();
    expect(await saved.closed).toEqual({ ok: true, value: 42, source: 'manual' });

    const cancelled = dialog.open(Parts);
    const cancel = cancelled.element.querySelector<HTMLButtonElement>('.cancel')!;
    expect(cancel.getAttribute('type')).toBe('button');
    cancel.click();
    expect(await cancelled.closed).toEqual({ ok: false, source: 'manual' });
  });

  it('alDialogClose is inert while the dialog is busy', async () => {
    const ref = TestBed.inject(DialogService).open(Parts);
    let release!: () => void;
    const busy = ref.ɵtrack(() => new Promise<void>((r) => (release = r)));
    TestBed.tick();
    const save = ref.element.querySelector<HTMLButtonElement>('.save')!;
    expect(save.getAttribute('aria-disabled')).toBe('true');
    save.click();
    release();
    await busy;
    expect((ref.element as HTMLDialogElement).open).toBe(true);
    void ref.close();
  });

  it('the header close button uses the configured strings', () => {
    TestBed.configureTestingModule({ providers: [provideDialog({ strings: { close: 'Lukk' } })] });
    const ref = TestBed.inject(DialogService).open(Parts);
    expect(ref.element.querySelector('.al-icon-btn')!.getAttribute('aria-label')).toBe('Lukk');
    void ref.close();
  });

  it('work on a headless <dialog alDialog>', () => {
    const fixture = TestBed.createComponent(Headless);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe('kit-title');
    dialog.querySelector('button')!.click();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
