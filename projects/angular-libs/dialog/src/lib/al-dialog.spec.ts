import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlDialog, type AlDialogClosed } from './al-dialog';

@Component({
  standalone: true,
  imports: [AlDialog],
  template: `
    <dialog
      alDialog
      [open]="open()"
      [labelledBy]="labelledBy"
      [describedBy]="describedBy"
      [closeOnEscape]="closeOnEscape"
      [closeOnBackdrop]="closeOnBackdrop"
      [restoreFocus]="restoreFocus"
      [scrollLock]="scrollLock"
      (closed)="onClosed($event)"
    >
      <h2 id="edit-title">Edit user</h2>
      <p id="edit-desc">Change the name.</p>
      <button type="button" id="first">First</button>
      <button type="button" id="last">Last</button>
    </dialog>
  `,
})
class HostComponent {
  readonly dialog = viewChild.required(AlDialog);
  open = signal(false);
  labelledBy = 'edit-title';
  describedBy = 'edit-desc';
  closeOnEscape = true;
  closeOnBackdrop = true;
  restoreFocus = true;
  scrollLock = true;
  lastClosed: AlDialogClosed | null = null;
  onClosed(event: AlDialogClosed): void {
    this.lastClosed = event;
    this.open.set(false);
  }
}

describe('AlDialog', () => {
  let showModal: ReturnType<typeof vi.spyOn>;
  let show: ReturnType<typeof vi.spyOn>;
  let nativeClose: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    show = vi.spyOn(HTMLDialogElement.prototype, 'show').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    nativeClose = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  afterAll(() => {
    showModal.mockRestore();
    show.mockRestore();
    nativeClose.mockRestore();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  function createHost(): { fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>; host: HostComponent; el: HTMLDialogElement } {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const el = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    return { fixture, host, el };
  }

  function open(fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>, host: HostComponent): void {
    host.open.set(true);
    fixture.detectChanges();
  }

  it('opens with showModal and wires ARIA without library classes', () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);

    expect(showModal).toHaveBeenCalled();
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-labelledby')).toBe('edit-title');
    expect(el.getAttribute('aria-describedby')).toBe('edit-desc');
    expect(el.className).toBe('');
    expect(el.classList.contains('al-dialog')).toBe(false);
  });

  it('emits closed on Escape and restores the open signal', () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);

    el.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(host.lastClosed).toEqual({ reason: 'escape' });
    expect(host.open()).toBe(false);
    expect(el.open).toBe(false);
  });

  it('does not close on Escape when closeOnEscape is false', () => {
    const { fixture, host, el } = createHost();
    host.closeOnEscape = false;
    fixture.detectChanges();
    open(fixture, host);

    const cancel = new Event('cancel', { cancelable: true });
    el.dispatchEvent(cancel);
    fixture.detectChanges();

    expect(cancel.defaultPrevented).toBe(true);
    expect(host.lastClosed).toBeNull();
    expect(el.open).toBe(true);
  });

  function dispatchBackdropClick(el: HTMLDialogElement): void {
    const opts: MouseEventInit = { clientX: 200, clientY: 200, bubbles: true };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  it('closes on backdrop click (outside the dialog box)', () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);

    dispatchBackdropClick(el);
    fixture.detectChanges();

    expect(host.lastClosed).toEqual({ reason: 'backdrop' });
    expect(host.open()).toBe(false);
  });

  it('does not treat content clicks as backdrop', () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);

    const first = el.querySelector('#first') as HTMLButtonElement;
    const opts: MouseEventInit = { clientX: 0, clientY: 0, bubbles: true };
    first.dispatchEvent(new MouseEvent('mousedown', opts));
    first.dispatchEvent(new MouseEvent('click', opts));
    fixture.detectChanges();

    expect(host.lastClosed).toBeNull();
    expect(el.open).toBe(true);
  });

  it('does not close on backdrop when closeOnBackdrop is false', () => {
    const { fixture, host, el } = createHost();
    host.closeOnBackdrop = false;
    fixture.detectChanges();
    open(fixture, host);

    dispatchBackdropClick(el);
    fixture.detectChanges();

    expect(host.lastClosed).toBeNull();
    expect(el.open).toBe(true);
  });

  it('close() emits reason close', () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);

    host.dialog().close();
    fixture.detectChanges();

    expect(host.lastClosed).toEqual({ reason: 'close' });
    expect(el.open).toBe(false);
  });

  it('locks and restores body scroll', () => {
    const { fixture, host } = createHost();
    document.body.style.overflow = 'auto';

    open(fixture, host);
    expect(document.body.style.overflow).toBe('hidden');

    host.dialog().close();
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('skips scroll lock when scrollLock is false', () => {
    const { fixture, host } = createHost();
    host.scrollLock = false;
    document.body.style.overflow = 'scroll';
    fixture.detectChanges();

    open(fixture, host);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('restores focus to the opener', async () => {
    const { fixture, host } = createHost();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    open(fixture, host);
    await Promise.resolve();

    host.dialog().close();
    fixture.detectChanges();
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('traps Tab from the last focusable back to the first', async () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);
    await Promise.resolve();

    const first = el.querySelector('#first') as HTMLButtonElement;
    const last = el.querySelector('#last') as HTMLButtonElement;
    last.focus();

    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );

    expect(document.activeElement).toBe(first);
  });

  it('traps Shift+Tab from the first focusable back to the last', async () => {
    const { fixture, host, el } = createHost();
    open(fixture, host);
    await Promise.resolve();

    const first = el.querySelector('#first') as HTMLButtonElement;
    const last = el.querySelector('#last') as HTMLButtonElement;
    first.focus();

    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(document.activeElement).toBe(last);
  });

  it('routes Escape through dismissHandler when the service attaches one', () => {
    const { fixture, host, el } = createHost();
    const dismiss = vi.fn();
    open(fixture, host);
    host.dialog().dismissHandler = dismiss;

    el.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(dismiss).toHaveBeenCalledWith('escape');
    expect(host.lastClosed).toBeNull();
    expect(el.open).toBe(true);
  });
});

@Component({
  standalone: true,
  imports: [AlDialog],
  template: `<dialog alDialog [open]="open()" [modal]="false"><span>Hi</span></dialog>`,
})
class ModelessHost {
  open = signal(false);
}

describe('AlDialog modeless', () => {
  beforeAll(() => {
    vi.spyOn(HTMLDialogElement.prototype, 'show').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
  });

  it('calls show() and sets aria-modal=false', () => {
    const fixture = TestBed.createComponent(ModelessHost);
    fixture.detectChanges();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(el.getAttribute('aria-modal')).toBe('false');
    expect(HTMLDialogElement.prototype.show).toHaveBeenCalled();
  });
});
