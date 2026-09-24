import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchDom } from '@angular-libs/dialog/testing';
import { DialogService } from './dialog.service';
import { Toaster } from './toaster';
import { provideDialog } from './types';

@Component({ template: '<p>modal</p>' })
class Modal {}

const visible = (position = 'bottom-right') =>
  [...document.querySelectorAll(`.al-toaster-${position} .al-toast:not(.al-toast-leaving)`)] as HTMLElement[];
const text = (toast: Element) => toast.querySelector('.al-toast-message')!.textContent;

describe('Toaster', () => {
  let toaster: Toaster;

  beforeAll(patchDom);
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideDialog({ toaster: { maxVisible: 2 }, strings: { close: 'Lukk' } })],
    });
    toaster = TestBed.inject(Toaster);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('renders text (never HTML) in a region per corner', () => {
    toaster.show('<b>Saved</b>', { title: 'Done' });
    toaster.show('Top', { position: 'top-left' });
    const [toast] = visible();
    expect(text(toast)).toBe('<b>Saved</b>');
    expect(toast.querySelector('b')).toBeNull();
    expect(toast.querySelector('.al-toast-close')!.getAttribute('aria-label')).toBe('Lukk');
    expect(document.querySelectorAll('.al-toaster')).toHaveLength(2);
  });

  it('auto-dismisses, and resolves `dismissed`', async () => {
    const toast = toaster.show('Bye', { duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(visible()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await toast.dismissed;
    expect(visible()).toHaveLength(0);
  });

  it('queues beyond maxVisible', () => {
    const first = toaster.show('1', { duration: 0 });
    toaster.show('2', { duration: 0 });
    toaster.show('3', { duration: 0 });
    expect(visible().map(text)).toEqual(['1', '2']);
    first.dismiss();
    expect(visible().map(text)).toEqual(['2', '3']);
  });

  it('pauses while hovered', () => {
    toaster.show('Hover', { duration: 1000 });
    const region = document.querySelector('.al-toaster')!;
    vi.advanceTimersByTime(600);
    region.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(5000);
    expect(visible()).toHaveLength(1);
    region.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(400);
    expect(visible()).toHaveLength(0);
  });

  it('runs an action, and Escape dismisses the focused toast', async () => {
    const undo = vi.fn();
    const archived = toaster.show('Archived', { action: { label: 'Undo', onClick: undo } });
    visible()[0].querySelector<HTMLButtonElement>('.al-toast-action')!.click();
    expect(undo).toHaveBeenCalledOnce();
    await archived.dismissed;

    const other = toaster.show('Esc');
    visible()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await other.dismissed;
  });

  it('promise() goes from loading to success and returns the work', async () => {
    let resolve!: (n: number) => void;
    const result = toaster.promise(new Promise<number>((r) => (resolve = r)), {
      loading: 'Saving…',
      success: (n) => `Saved ${n}`,
      error: 'Failed',
    });
    expect(visible()[0].classList).toContain('al-toast-loading');
    vi.advanceTimersByTime(60_000); // loading never times out
    resolve(3);
    await expect(result).resolves.toBe(3);
    expect(visible()[0].classList).toContain('al-toast-success');
    expect(text(visible()[0])).toBe('Saved 3');
  });

  it('announces through persistent live regions; errors assertively', () => {
    toaster.show('Saved', { title: 'Done' });
    vi.advanceTimersByTime(100);
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Done. Saved');
    toaster.error('Offline');
    vi.advanceTimersByTime(100);
    expect(document.querySelector('[aria-live="assertive"]')!.textContent).toBe('Offline');
  });

  it('moves into the topmost modal so toasts stay clickable, and back out', async () => {
    toaster.show('x', { duration: 0 });
    const region = document.querySelector('.al-toaster')!;
    const ref = TestBed.inject(DialogService).open(Modal);
    expect(region.parentElement).toBe(ref.element);
    await ref.close();
    expect(region.parentElement).toBe(document.body);
  });

  it('cleans up when the injector is destroyed', () => {
    toaster.show('x');
    TestBed.resetTestingModule();
    expect(document.querySelector('.al-toaster')).toBeNull();
  });
});
