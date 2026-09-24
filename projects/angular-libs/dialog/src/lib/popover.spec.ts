import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchDom } from '@angular-libs/dialog/testing';
import { DialogService } from './dialog.service';
import { injectDialog } from './inject-dialog';
import { DialogParts } from './parts';
import { PopoverService } from './popover';

@Component({
  imports: [DialogParts],
  template: `@for (item of items(); track item) {<button [alDialogClose]="item">{{ item }}</button>}`,
})
class Menu {
  readonly items = input.required<string[]>();
  readonly dialog = injectDialog<string>();
}

@Component({ template: '<button id="inner">More</button>' })
class InDialog {}

describe('PopoverService', () => {
  let popover: PopoverService;
  let anchor: HTMLButtonElement;

  beforeAll(patchDom);
  beforeEach(() => {
    popover = TestBed.inject(PopoverService);
    anchor = document.body.appendChild(document.createElement('button'));
  });
  afterEach(() => anchor.remove());

  it('opens an anchored popover and closes with the picked value', async () => {
    const ref = popover.open(anchor, Menu, { items: ['a', 'b'] }, { placement: 'top-start', offset: 4 });
    const el = ref.element;
    expect(el.popover).toBe('auto');
    expect(el.dataset['placement']).toBe('top-start');
    expect(el.getAttribute('role')).toBe('dialog');
    const name = anchor.style.getPropertyValue('anchor-name');
    expect(name).toMatch(/^--al-anchor-/);
    expect(el.style.getPropertyValue('position-anchor')).toBe(name);

    el.querySelectorAll('button')[1].click();
    expect(await ref.closed).toEqual({ ok: true, value: 'b', source: 'manual' });
    expect(el.isConnected).toBe(false);
    expect(anchor.style.getPropertyValue('anchor-name')).toBe('');
  });

  it('reports light dismiss by Escape or outside pointer', async () => {
    const byEscape = popover.open(anchor, Menu, { items: [] });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    byEscape.element.hidePopover(); // what the browser does
    expect(await byEscape.closed).toEqual({ ok: false, source: 'escape' });

    const byPointer = popover.open(anchor, Menu, { items: [] });
    document.dispatchEvent(new Event('pointerdown'));
    byPointer.element.hidePopover();
    expect(await byPointer.closed).toEqual({ ok: false, source: 'outside' });
  });

  it('Escape inside a modal closes the popover, not the modal', async () => {
    const ref = TestBed.inject(DialogService).open(InDialog);
    const pop = popover.open(ref.element.querySelector('#inner')!, Menu, { items: [] });
    pop.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect((ref.element as HTMLDialogElement).open).toBe(true);
    pop.element.hidePopover(); // the browser's native light dismiss
    await pop.closed;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await ref.closed).toEqual({ ok: false, source: 'escape' });
  });

  it('mounts inside the anchor’s dialog so a modal does not make it inert', async () => {
    const ref = TestBed.inject(DialogService).open(InDialog);
    const inner = ref.element.querySelector<HTMLButtonElement>('#inner')!;
    const pop = popover.open(inner, Menu, { items: [] });
    expect(pop.element.parentElement).toBe(ref.element);
    await pop.close();
    await ref.close();
  });
});
