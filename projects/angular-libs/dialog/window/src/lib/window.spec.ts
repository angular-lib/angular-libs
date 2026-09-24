import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectDialog } from '@angular-libs/dialog';
import { patchDom } from '@angular-libs/dialog/testing';
import { AlWindowHeader } from './window-header';
import { WindowRef } from './window-ref';
import { WindowService } from './window.service';

@Component({
  imports: [AlWindowHeader],
  template: `<al-window-header>{{ title() }}</al-window-header><p>body</p>`,
})
class Chat {
  readonly title = input('Chat');
  readonly dialog = injectDialog<string>();
}

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true });

describe('WindowService', () => {
  let windows: WindowService;

  beforeAll(() => {
    patchDom();
    // jsdom has no PointerEvent.
    globalThis.PointerEvent ??= class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    } as typeof PointerEvent;
  });
  beforeEach(() => {
    localStorage.clear();
    windows = TestBed.inject(WindowService);
  });
  afterEach(() => document.querySelectorAll('dialog, .al-window-dock').forEach((el) => el.remove()));

  it('opens a modeless window with bounds, header and the WindowRef injectable', () => {
    const win = windows.open(Chat, { title: 'Room' }, { width: 400, height: 300, x: 10, y: 20 });
    const el = win.element as HTMLDialogElement;
    expect(el.open).toBe(true);
    expect(el.getAttribute('aria-modal')).toBeNull();
    expect(el.classList).toContain('al-dialog-window');
    expect(win.bounds()).toEqual({ x: 10, y: 20, width: 400, height: 300 });
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(['10px', '20px', '400px', '300px']);
    expect(el.getAttribute('aria-labelledby')).toBe(el.querySelector('.al-dialog-title')!.id);
    expect(win.componentInstance.dialog.ref).toBe(win);
  });

  it('minimizes into the dock and restores on click', () => {
    const win = windows.open(Chat, {}, { width: 300 });
    win.minimize();
    expect(win.mode()).toBe('minimized');
    const dock = document.querySelector('.al-window-dock')!;
    expect(win.element.parentElement).toBe(dock);

    win.element.querySelector('p')!.click();
    expect(win.mode()).toBe('normal');
    expect(win.element.parentElement).toBe(document.body);
    expect(document.querySelector('.al-window-dock')).toBeNull();
  });

  it('maximizes, snaps with Alt+Arrow, and moves', () => {
    const win = windows.open(Chat, {}, { width: 300 });
    win.toggleMaximize();
    expect(win.element.dataset['mode']).toBe('maximized');
    win.toggleMaximize();
    expect(win.mode()).toBe('normal');

    win.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    expect(win.bounds()).toEqual({ x: innerWidth / 2, y: 0, width: innerWidth / 2, height: innerHeight });

    win.moveTo(5, 6);
    expect(win.bounds()).toMatchObject({ x: 5, y: 6 });
  });

  it('drags by the header, keeping it on screen', () => {
    const win = windows.open(Chat, {}, { width: 300, x: 100, y: 100 });
    vi.spyOn(win.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 200));
    const header = win.element.querySelector('al-window-header')!;
    header.dispatchEvent(pointer('pointerdown', 0, 0));
    win.element.dispatchEvent(pointer('pointermove', 50, -500));
    win.element.dispatchEvent(pointer('pointerup', 50, -500));
    expect(win.bounds()).toMatchObject({ x: 150, y: 0 });

    // Not from the body when a header exists.
    win.element.querySelector('p')!.dispatchEvent(pointer('pointerdown', 0, 0));
    win.element.dispatchEvent(pointer('pointermove', 50, 50));
    expect(win.bounds()).toMatchObject({ x: 150, y: 0 });
  });

  it('opening an open id focuses it instead of opening another', () => {
    const a = windows.open(Chat, {}, { id: 'chat' });
    a.minimize();
    const b = windows.open(Chat, {}, { id: 'chat' });
    expect(b).toBe(a);
    expect(a.mode()).toBe('normal');
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
  });

  it('persists bounds and mode by id', async () => {
    vi.useFakeTimers();
    const win = windows.open(Chat, {}, { id: 'notes', persist: true, width: 300 });
    win.moveTo(40, 50);
    win.maximize();
    vi.advanceTimersByTime(200);
    vi.useRealTimers();
    await win.close();
    await win.closed;

    const again = windows.open(Chat, {}, { id: 'notes', persist: true });
    expect(again.bounds()).toMatchObject({ x: 40, y: 50, width: 300 });
    expect(again.mode()).toBe('maximized');
  });

  it('header buttons drive the window and close it', async () => {
    const win = windows.open(Chat);
    TestBed.tick();
    const buttons = win.element.querySelectorAll<HTMLButtonElement>('al-window-header button');
    buttons[1].click(); // maximize
    expect(win.mode()).toBe('maximized');
    buttons[3].click(); // close
    expect(await win.closed).toEqual({ ok: false, source: 'manual' });
    expect(win).toBeInstanceOf(WindowRef);
  });
});
