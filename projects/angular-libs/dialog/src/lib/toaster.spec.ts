import { TestBed } from '@angular/core/testing';
import { provideDialog } from './provide-dialog';
import { Toaster } from './toaster';

function toasts(position = 'bottom-right'): HTMLElement[] {
  return Array.from(document.querySelectorAll(`.al-toaster-${position} .al-toast:not(.al-toast-leaving)`));
}

describe('Toaster', () => {
  let toaster: Toaster;

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
    document.querySelectorAll('.al-toaster, .al-toaster-announcer').forEach((el) => el.remove());
  });

  it('renders one region per corner with text content (no HTML)', () => {
    toaster.show('<b>Saved</b>', { title: 'Done' });
    toaster.show('Top', { position: 'top-left' });

    const [toast] = toasts();
    expect(toast.querySelector('.al-toast-message')!.textContent).toBe('<b>Saved</b>');
    expect(toast.querySelector('b')).toBeNull();
    expect(toast.querySelector('.al-toast-title')!.textContent).toBe('Done');
    expect(toast.querySelector('.al-toast-close')!.getAttribute('aria-label')).toBe('Lukk');
    expect(document.querySelectorAll('.al-toaster')).toHaveLength(2);
    expect(document.querySelector('.al-toaster')!.getAttribute('aria-label')).toBe('Notifications');
  });

  it('auto-dismisses after the duration and resolves the reason', async () => {
    const handle = toaster.show('Bye', { duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await expect(handle.dismissed).resolves.toBe('timeout');
    expect(toasts()).toHaveLength(0);
  });

  it('queues beyond maxVisible and shows the next one when a slot frees up', () => {
    const first = toaster.show('1', { duration: 0 });
    toaster.show('2', { duration: 0 });
    toaster.show('3', { duration: 0 });
    expect(toasts().map((t) => t.textContent)).toEqual([
      expect.stringContaining('1'),
      expect.stringContaining('2'),
    ]);
    first.dismiss();
    expect(toasts().map((t) => t.querySelector('.al-toast-message')!.textContent)).toEqual(['2', '3']);
  });

  it('pauses the timer while hovered', () => {
    toaster.show('Hover me', { duration: 1000 });
    const region = document.querySelector('.al-toaster')!;
    vi.advanceTimersByTime(600);
    region.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(5000);
    expect(toasts()).toHaveLength(1);
    region.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(399);
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts()).toHaveLength(0);
  });

  it('runs the action and dismisses', async () => {
    const undo = vi.fn();
    const handle = toaster.show('Archived', { action: { label: 'Angre', onClick: undo } });
    toasts()[0].querySelector<HTMLButtonElement>('.al-toast-action')!.click();
    expect(undo).toHaveBeenCalledOnce();
    await expect(handle.dismissed).resolves.toBe('action');
  });

  it('Escape dismisses the focused toast', async () => {
    const handle = toaster.show('Esc');
    const close = toasts()[0].querySelector<HTMLButtonElement>('.al-toast-close')!;
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(handle.dismissed).resolves.toBe('escape');
  });

  it('promise() moves from loading to success', async () => {
    let resolve!: (v: number) => void;
    const work = new Promise<number>((r) => (resolve = r));
    const result = toaster.promise(work, {
      loading: 'Saving…',
      success: (n) => `Saved ${n}`,
      error: 'Failed',
    });

    expect(toasts()[0].classList.contains('al-toast-loading')).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(toasts()).toHaveLength(1); // loading never times out

    resolve(3);
    await expect(result).resolves.toBe(3);
    const [toast] = toasts();
    expect(toast.classList.contains('al-toast-success')).toBe(true);
    expect(toast.textContent).toContain('Saved 3');
  });

  it('promise() shows the error and still rejects for the caller', async () => {
    const result = toaster.promise(Promise.reject(new Error('x')), {
      loading: 'Saving…',
      success: 'Saved',
      error: (e) => `Failed: ${(e as Error).message}`,
    });
    await expect(result).rejects.toThrow('x');
    await Promise.resolve();
    expect(toasts()[0].classList.contains('al-toast-error')).toBe(true);
    expect(toasts()[0].textContent).toContain('Failed: x');
  });

  it('announces through persistent live regions; errors are assertive', () => {
    toaster.show('Saved', { title: 'Done' });
    vi.advanceTimersByTime(100);
    const polite = document.querySelector('.al-toaster-announcer[aria-live="polite"]')!;
    expect(polite.textContent).toBe('Done. Saved');

    toaster.error('Offline');
    vi.advanceTimersByTime(100);
    const assertive = document.querySelector('.al-toaster-announcer[aria-live="assertive"]')!;
    expect(assertive.textContent).toBe('Offline');
  });

  it('removes regions when the injector is destroyed', () => {
    toaster.show('x');
    TestBed.resetTestingModule();
    expect(document.querySelector('.al-toaster')).toBeNull();
  });
});
