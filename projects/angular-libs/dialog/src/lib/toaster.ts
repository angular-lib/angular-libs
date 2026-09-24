import { DestroyRef, Injectable, inject } from '@angular/core';
import { DialogService } from './dialog.service';
import { resolveDialogStrings, type ToastPosition } from './dialog.types';

export type ToastTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

export type ToasterPosition = ToastPosition | 'top-center' | 'bottom-center';

export interface ToastAction {
  label: string;
  /** Runs on click; the toast is dismissed afterwards. */
  onClick: () => void;
}

export interface ToasterOptions {
  title?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed. `loading` never auto-dismisses. */
  duration?: number;
  position?: ToasterPosition;
  /** One action button, e.g. "Undo". */
  action?: ToastAction;
  /** Show the close button. Default `true`. */
  dismissible?: boolean;
}

/** Global defaults via `provideDialog({ toaster: { … } })`. */
export interface ToasterConfig {
  position?: ToasterPosition;
  /** Default auto-dismiss in ms. Default `5000`. */
  duration?: number;
  /** Toasts shown per corner at once; the rest wait in a queue. Default `3`. */
  maxVisible?: number;
}

export type ToastDismissReason = 'timeout' | 'close' | 'action' | 'swipe' | 'escape' | 'manual';

export interface ToastHandle {
  readonly id: number;
  /** Resolves when the toast is dismissed. */
  readonly dismissed: Promise<ToastDismissReason>;
  dismiss(): void;
  /** Replace message and/or options; restarts the timer. */
  update(message: string, options?: ToasterOptions): void;
}

export interface ToastPromiseMessages<T> {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((error: unknown) => string);
}

const DEFAULT_DURATION = 5000;
const DEFAULT_MAX_VISIBLE = 3;
const SWIPE_DISMISS_PX = 80;
const LEAVE_MS = 200;

interface ToastRecord {
  id: number;
  message: string;
  options: ToasterOptions;
  position: ToasterPosition;
  el: HTMLLIElement | null;
  timer: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
  resolve: (reason: ToastDismissReason) => void;
  done: boolean;
}

/**
 * Notifications: one region per corner in the top layer, a queue, pause on
 * hover / focus / hidden tab, actions ("Undo"), swipe and Escape to dismiss,
 * and screen-reader announcements through a persistent live region.
 *
 * @example
 * ```ts
 * const toaster = inject(Toaster);
 * toaster.success('Saved');
 * toaster.show('Message archived', { action: { label: 'Undo', onClick: undo } });
 * await toaster.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private readonly service = inject(DialogService);
  private readonly toasts: ToastRecord[] = [];
  private readonly regions = new Map<ToasterPosition, HTMLElement>();
  private announcers: { polite: HTMLElement; assertive: HTMLElement } | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;

  constructor() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      for (const toast of this.toasts) this.clearTimer(toast);
      this.regions.forEach((region) => region.remove());
      this.announcers?.polite.remove();
      this.announcers?.assertive.remove();
      if (this.announceTimer) clearTimeout(this.announceTimer);
    });
  }

  show(message: string, options: ToasterOptions = {}): ToastHandle {
    let resolve!: (reason: ToastDismissReason) => void;
    const dismissed = new Promise<ToastDismissReason>((res) => (resolve = res));
    const toast: ToastRecord = {
      id: ++this.nextId,
      message,
      options,
      position: options.position ?? this.config().position ?? 'bottom-right',
      el: null,
      timer: null,
      remaining: 0,
      startedAt: 0,
      resolve,
      done: false,
    };
    this.toasts.push(toast);
    this.flush(toast.position);

    return {
      id: toast.id,
      dismissed,
      dismiss: () => this.dismiss(toast, 'manual'),
      update: (nextMessage, nextOptions) => this.update(toast, nextMessage, nextOptions),
    };
  }

  success(message: string, options: Omit<ToasterOptions, 'tone'> = {}): ToastHandle {
    return this.show(message, { ...options, tone: 'success' });
  }

  error(message: string, options: Omit<ToasterOptions, 'tone'> = {}): ToastHandle {
    return this.show(message, { ...options, tone: 'error' });
  }

  /**
   * Shows a loading toast, then turns it into success or error. Returns the
   * original promise, so errors still reach the caller.
   */
  promise<T>(
    work: Promise<T> | (() => Promise<T>),
    messages: ToastPromiseMessages<T>,
    options: Omit<ToasterOptions, 'tone'> = {},
  ): Promise<T> {
    const handle = this.show(messages.loading, { ...options, tone: 'loading' });
    const pending = typeof work === 'function' ? work() : work;
    pending.then(
      (value) =>
        handle.update(pick(messages.success, value), { ...options, tone: 'success' }),
      (error) => handle.update(pick(messages.error, error), { ...options, tone: 'error' }),
    );
    return pending;
  }

  dismissAll(): void {
    [...this.toasts].forEach((toast) => this.dismiss(toast, 'manual'));
  }

  private config(): ToasterConfig {
    return this.service.config().toaster ?? {};
  }

  private strings() {
    return resolveDialogStrings(this.service.config().strings) ?? {};
  }

  /** Renders queued toasts while the corner has room. */
  private flush(position: ToasterPosition): void {
    if (typeof document === 'undefined') return;
    const max = this.config().maxVisible ?? DEFAULT_MAX_VISIBLE;
    const inCorner = this.toasts.filter((t) => t.position === position);
    let visible = inCorner.filter((t) => t.el).length;
    for (const toast of inCorner) {
      if (visible >= max) break;
      if (toast.el) continue;
      this.render(toast);
      visible++;
    }
  }

  private render(toast: ToastRecord): void {
    const region = this.region(toast.position);
    const list = region.firstElementChild as HTMLOListElement;
    const el = document.createElement('li');
    el.className = 'al-toast';
    el.dataset['alToastId'] = String(toast.id);
    el.tabIndex = -1;
    toast.el = el;
    this.fill(toast);

    // Newest toast sits closest to the screen edge.
    if (toast.position.startsWith('top')) list.prepend(el);
    else list.append(el);

    this.bindSwipe(toast);
    raiseInTopLayer(region);
    this.announce(toast);
    this.startTimer(toast, this.durationOf(toast));
  }

  private fill(toast: ToastRecord): void {
    const el = toast.el!;
    const { title, tone = 'info', action, dismissible = true } = toast.options;
    el.className = `al-toast al-toast-${tone}`;
    el.replaceChildren();

    const icon = document.createElement('span');
    icon.className = 'al-toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    el.append(icon);

    const text = document.createElement('div');
    text.className = 'al-toast-text';
    if (title) {
      const titleEl = document.createElement('strong');
      titleEl.className = 'al-toast-title';
      titleEl.textContent = title;
      text.append(titleEl);
    }
    const messageEl = document.createElement('p');
    messageEl.className = 'al-toast-message';
    messageEl.textContent = toast.message;
    text.append(messageEl);
    el.append(text);

    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'al-toast-action';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        action.onClick();
        this.dismiss(toast, 'action');
      });
      el.append(button);
    }

    if (dismissible) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'al-toast-close';
      close.setAttribute('aria-label', this.strings().close ?? 'Close');
      close.textContent = '×';
      close.addEventListener('click', () => this.dismiss(toast, 'close'));
      el.append(close);
    }
  }

  private update(toast: ToastRecord, message: string, options: ToasterOptions = {}): void {
    if (toast.done) return;
    toast.message = message;
    toast.options = { ...toast.options, ...options };
    if (!toast.el) return; // still queued — renders with the new content later
    this.fill(toast);
    this.announce(toast);
    this.startTimer(toast, this.durationOf(toast));
  }

  private dismiss(toast: ToastRecord, reason: ToastDismissReason): void {
    if (toast.done) return;
    toast.done = true;
    this.clearTimer(toast);
    this.toasts.splice(this.toasts.indexOf(toast), 1);
    toast.resolve(reason);

    const el = toast.el;
    if (el) {
      const hadFocus = el.contains(document.activeElement);
      el.classList.add('al-toast-leaving');
      setTimeout(() => {
        el.remove();
        if (hadFocus) this.focusNeighbour(toast.position);
      }, prefersReducedMotion() ? 0 : LEAVE_MS);
    }
    this.flush(toast.position);
  }

  private durationOf(toast: ToastRecord): number {
    if (toast.options.tone === 'loading') return 0;
    return toast.options.duration ?? this.config().duration ?? DEFAULT_DURATION;
  }

  private startTimer(toast: ToastRecord, ms: number): void {
    this.clearTimer(toast);
    toast.remaining = ms;
    if (ms > 0 && !this.isPaused(toast.position)) this.resumeTimer(toast);
  }

  private resumeTimer(toast: ToastRecord): void {
    if (toast.timer || toast.remaining <= 0 || toast.done) return;
    toast.startedAt = Date.now();
    toast.timer = setTimeout(() => {
      toast.timer = null;
      this.dismiss(toast, 'timeout');
    }, toast.remaining);
  }

  private pauseTimer(toast: ToastRecord): void {
    if (!toast.timer) return;
    clearTimeout(toast.timer);
    toast.timer = null;
    toast.remaining = Math.max(0, toast.remaining - (Date.now() - toast.startedAt));
  }

  private clearTimer(toast: ToastRecord): void {
    if (toast.timer) clearTimeout(toast.timer);
    toast.timer = null;
  }

  private isPaused(position: ToasterPosition): boolean {
    if (typeof document !== 'undefined' && document.hidden) return true;
    return this.regions.get(position)?.dataset['alPaused'] === 'true';
  }

  private setPaused(position: ToasterPosition, paused: boolean): void {
    const region = this.regions.get(position);
    if (!region) return;
    region.dataset['alPaused'] = String(paused);
    for (const toast of this.toasts) {
      if (toast.position !== position || !toast.el) continue;
      if (paused || document.hidden) this.pauseTimer(toast);
      else this.resumeTimer(toast);
    }
  }

  private readonly onVisibilityChange = (): void => {
    this.regions.forEach((region, position) =>
      this.setPaused(position, region.dataset['alPaused'] === 'true'),
    );
  };

  private region(position: ToasterPosition): HTMLElement {
    let region = this.regions.get(position);
    if (region) return region;

    region = document.createElement('section');
    region.className = `al-toaster al-toaster-${position}`;
    region.setAttribute('popover', 'manual');
    region.setAttribute('aria-label', this.strings().notifications ?? 'Notifications');
    region.append(document.createElement('ol'));

    let hovered = false;
    let focused = false;
    const sync = () => this.setPaused(position, hovered || focused);
    region.addEventListener('pointerenter', () => ((hovered = true), sync()));
    region.addEventListener('pointerleave', () => ((hovered = false), sync()));
    region.addEventListener('focusin', () => ((focused = true), sync()));
    region.addEventListener('focusout', (e) => {
      focused = region!.contains(e.relatedTarget as Node | null);
      sync();
    });
    region.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('.al-toast');
      const toast = this.toasts.find((t) => t.el === el);
      if (toast) {
        e.stopPropagation();
        this.dismiss(toast, 'escape');
      }
    });

    document.body.append(region);
    this.regions.set(position, region);
    return region;
  }

  private bindSwipe(toast: ToastRecord): void {
    const el = toast.el!;
    let start: { id: number; x: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      start = { id: e.pointerId, x: e.clientX };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (start?.id !== e.pointerId) return;
      el.style.setProperty('--al-toast-swipe', `${e.clientX - start.x}px`);
    });
    const end = (e: PointerEvent) => {
      if (start?.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      start = null;
      el.style.removeProperty('--al-toast-swipe');
      if (Math.abs(dx) >= SWIPE_DISMISS_PX) this.dismiss(toast, 'swipe');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  private focusNeighbour(position: ToasterPosition): void {
    const next = this.toasts.find((t) => t.position === position && t.el);
    next?.el?.focus();
  }

  /** Announces via a persistent live region; errors are assertive. */
  private announce(toast: ToastRecord): void {
    if (toast.options.tone === 'loading' && toast.el?.dataset['alAnnounced']) return;
    toast.el?.setAttribute('data-al-announced', 'true');
    const announcers = (this.announcers ??= {
      polite: createAnnouncer('polite'),
      assertive: createAnnouncer('assertive'),
    });
    const target = toast.options.tone === 'error' ? announcers.assertive : announcers.polite;
    const text = [toast.options.title, toast.message].filter(Boolean).join('. ');
    target.textContent = '';
    if (this.announceTimer) clearTimeout(this.announceTimer);
    // A short delay makes screen readers treat the text as a change.
    this.announceTimer = setTimeout(() => (target.textContent = text), 100);
  }
}

function pick<T>(value: string | ((arg: T) => string), arg: T): string {
  return typeof value === 'function' ? value(arg) : value;
}

function createAnnouncer(politeness: 'polite' | 'assertive'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'al-toaster-announcer';
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  document.body.append(el);
  return el;
}

/**
 * Re-show so the region sits above dialogs opened after it. Skipped while focus is
 * inside — hiding would blur e.g. a focused "Undo" button.
 */
function raiseInTopLayer(region: HTMLElement): void {
  if (typeof region.showPopover !== 'function') return;
  if (region.matches(':popover-open')) {
    if (region.contains(document.activeElement)) return;
    region.hidePopover();
  }
  region.showPopover();
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
