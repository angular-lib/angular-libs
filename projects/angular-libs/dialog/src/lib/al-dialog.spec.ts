import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchDom } from '@angular-libs/dialog/testing';
import { AlDialog } from './al-dialog';

@Component({
  imports: [AlDialog],
  template: `
    <button id="opener" (click)="open.set(true)">Open</button>
    <dialog alDialog [open]="open()" [closeOnEscape]="escape()" (closed)="onClosed($event.reason)">
      <button id="inside">Inside</button>
    </dialog>
    <dialog alDialog id="second" [open]="second()" (closed)="second.set(false)"></dialog>
  `,
})
class Host {
  open = signal(false);
  second = signal(false);
  escape = signal(true);
  reasons: string[] = [];
  onClosed(reason: string) {
    this.reasons.push(reason);
    this.open.set(false);
  }
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const host = fixture.componentInstance;
  const [first, second] = fixture.nativeElement.querySelectorAll('dialog') as NodeListOf<HTMLDialogElement>;
  const open = (which: 'open' | 'second' = 'open') => {
    host[which].set(true);
    fixture.detectChanges();
  };
  return { fixture, host, first, second, open };
}

function escape(target: EventTarget = document.body): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

describe('AlDialog', () => {
  beforeAll(patchDom);
  afterEach(() => (document.body.style.overflow = ''));

  it('opens and closes from the signal', () => {
    const { fixture, host, first, open } = setup();
    open();
    expect(first.open).toBe(true);
    host.open.set(false);
    fixture.detectChanges();
    expect(first.open).toBe(false);
    expect(host.reasons).toEqual(['close']);
  });

  it('handles Escape on document, even with focus outside the dialog', () => {
    const { host, first, open } = setup();
    open();
    const event = escape(document.body);
    expect(event.defaultPrevented).toBe(true); // keeps the browser from force-closing
    expect(first.open).toBe(false);
    expect(host.reasons).toEqual(['escape']);
  });

  it('keeps the dialog open on repeated Escape when closeOnEscape is false', () => {
    const { fixture, host, first, open } = setup();
    host.escape.set(false);
    fixture.detectChanges();
    open();
    for (let i = 0; i < 3; i++) expect(escape(first).defaultPrevented).toBe(true);
    expect(first.open).toBe(true);
  });

  it('only the topmost modal reacts to Escape', () => {
    const { host, first, second, open } = setup();
    open('open');
    open('second');
    escape();
    expect(second.open).toBe(false);
    expect(first.open).toBe(true);
    escape();
    expect(first.open).toBe(false);
    expect(host.reasons).toEqual(['escape']);
  });

  it('ignores Escape a widget inside already handled', () => {
    const { first, open } = setup();
    open();
    const inside = first.querySelector('#inside')!;
    inside.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    escape(inside);
    expect(first.open).toBe(true);
  });

  it('closes on a backdrop click but not on a click inside', () => {
    const { host, first, open } = setup();
    open();
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 200));
    const click = (x: number, target: Element = first) => {
      target.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: 150, bubbles: true }));
      target.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: 150, bubbles: true }));
    };
    click(150, first.querySelector('#inside')!);
    expect(first.open).toBe(true);
    click(20);
    expect(host.reasons).toEqual(['backdrop']);
  });

  it('never prevents mousedown inside the dialog (focus, selection, resize grip)', () => {
    const { first, open } = setup();
    open();
    for (const target of [first, first.querySelector('#inside')!]) {
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      target.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(false);
    }
  });

  it('locks page scroll while a modal is open', () => {
    const { host, fixture, open } = setup();
    open();
    expect(document.body.style.overflow).toBe('hidden');
    host.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });

  it('returns focus to the opener', () => {
    const { fixture, first } = setup();
    const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    (first.querySelector('#inside') as HTMLButtonElement).focus();
    escape();
    expect(document.activeElement).toBe(opener);
  });

  it('routes other close requests (cancel) through closeOnEscape', () => {
    const { host, first, open } = setup();
    open();
    const cancel = new Event('cancel', { cancelable: true });
    first.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(host.reasons).toEqual(['escape']);
  });
});
