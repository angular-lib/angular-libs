import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';
import { ɵonModalStackChange, ɵtopModal } from './al-dialog';
import { ɵanimationsDone } from './dialog-ref';
import { DIALOG_CONFIG, injectDialogStrings } from './types';

export type ToastTone = 'info' | 'success' | 'warning' | 'error' | 'loading';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastOptions {
  title?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss; `0` keeps it. `loading` toasts never time out. */
  duration?: number;
  position?: ToastPosition;
  /** One action button, e.g. "Undo". The toast is dismissed after it runs. */
  action?: { label: string; onClick: () => void };
  /** Show the × button. Default `true`. */
  dismissible?: boolean;
}

/** `provideDialog({ toaster: { … } })` */
export interface ToasterConfig {
  /** Default `bottom-right`. */
  position?: ToastPosition;
  /** Default `5000`. */
  duration?: number;
  /** Shown per corner; the rest wait. Default `3`. */
  maxVisible?: number;
}

export interface ToastRef {
  /** Resolves when the toast is dismissed. */
  readonly dismissed: Promise<void>;
  dismiss(): void;
  /** Replaces message and options; restarts the timer. */
  update(message: string, options?: ToastOptions): void;
}

interface Toast {
  message: string;
  options: ToastOptions;
  position: ToastPosition;
  el?: HTMLLIElement;
  timer?: ReturnType<typeof setTimeout>;
  remaining: number;
  startedAt: number;
  done: () => void;
}

/**
 * Notifications in one top-layer region per corner. Paused while hovered or focused,
 * Escape dismisses the focused toast, and screen readers are told through a persistent
 * live region (errors assertively). While a modal is open, toasts live inside it so
 * they stay clickable.
 *
 * @example
 * ```ts
 * toaster.success('Saved');
 * toaster.show('Archived', { action: { label: 'Undo', onClick: undo } });
 * await toaster.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(DIALOG_CONFIG).toaster ?? {};
  private readonly strings = injectDialogStrings();
  private readonly toasts: Toast[] = [];
  private readonly regions = new Map<ToastPosition, HTMLElement>();
  private readonly announcer = {
    polite: null as HTMLElement | null,
    assertive: null as HTMLElement | null,
  };

  constructor() {
    const stopFollowingModals = ɵonModalStackChange(() => this.regions.forEach((r) => this.mount(r)));
    inject(DestroyRef).onDestroy(() => {
      stopFollowingModals();
      this.toasts.forEach((t) => clearTimeout(t.timer));
      this.regions.forEach((r) => r.remove());
      this.announcer.polite?.remove();
      this.announcer.assertive?.remove();
    });
  }

  show(message: string, options: ToastOptions = {}): ToastRef {
    let done!: () => void;
    const dismissed = new Promise<void>((resolve) => (done = resolve));
    const toast: Toast = {
      message,
      options,
      position: options.position ?? this.config.position ?? 'bottom-right',
      remaining: 0,
      startedAt: 0,
      done,
    };
    this.toasts.push(toast);
    this.flush(toast.position);
    return {
      dismissed,
      dismiss: () => this.dismiss(toast),
      update: (next, nextOptions = {}) => {
        toast.message = next;
        toast.options = { ...toast.options, ...nextOptions };
        if (toast.el) this.render(toast);
      },
    };
  }

  success(message: string, options?: ToastOptions): ToastRef {
    return this.show(message, { ...options, tone: 'success' });
  }

  error(message: string, options?: ToastOptions): ToastRef {
    return this.show(message, { ...options, tone: 'error' });
  }

  /** Loading toast that turns into success or error. Returns `work` unchanged. */
  promise<T>(
    work: Promise<T>,
    messages: { loading: string; success: string | ((value: T) => string); error: string | ((error: unknown) => string) },
    options?: ToastOptions,
  ): Promise<T> {
    const toast = this.show(messages.loading, { ...options, tone: 'loading' });
    const text = <A>(m: string | ((a: A) => string), a: A) => (typeof m === 'function' ? m(a) : m);
    work.then(
      (value) => toast.update(text(messages.success, value), { tone: 'success' }),
      (error) => toast.update(text(messages.error, error), { tone: 'error' }),
    );
    return work;
  }

  dismissAll(): void {
    [...this.toasts].forEach((t) => this.dismiss(t));
  }

  /** Renders waiting toasts while the corner has room. */
  private flush(position: ToastPosition): void {
    if (!this.document.defaultView) return;
    const inCorner = this.toasts.filter((t) => t.position === position);
    let free = (this.config.maxVisible ?? 3) - inCorner.filter((t) => t.el).length;
    for (const toast of inCorner) {
      if (free <= 0) break;
      if (toast.el) continue;
      toast.el = this.document.createElement('li');
      const list = this.region(position).firstElementChild!;
      // Newest toast sits closest to the screen edge.
      if (position.startsWith('top')) list.prepend(toast.el);
      else list.append(toast.el);
      this.render(toast);
      free--;
    }
  }

  private render(toast: Toast): void {
    const { title, tone = 'info', action, dismissible = true } = toast.options;
    const el = toast.el!;
    el.className = `al-toast al-toast-${tone}`;
    el.tabIndex = -1;
    el.replaceChildren(
      this.node('span', 'al-toast-icon'),
      this.node('div', 'al-toast-text', title && this.node('strong', 'al-toast-title', title), this.node('p', 'al-toast-message', toast.message)),
    );
    if (action) el.append(this.button('al-toast-action', action.label, () => (action.onClick(), this.dismiss(toast))));
    if (dismissible) {
      const close = this.button('al-toast-close', '×', () => this.dismiss(toast));
      close.setAttribute('aria-label', this.strings().close);
      el.append(close);
    }
    this.announce(toast);
    clearTimeout(toast.timer);
    toast.timer = undefined;
    toast.remaining = tone === 'loading' ? 0 : (toast.options.duration ?? this.config.duration ?? 5000);
    this.resume(toast);
  }

  private dismiss(toast: Toast): void {
    const index = this.toasts.indexOf(toast);
    if (index === -1) return;
    this.toasts.splice(index, 1);
    clearTimeout(toast.timer);
    toast.done();
    const el = toast.el;
    if (el) {
      el.classList.add('al-toast-leaving');
      void ɵanimationsDone(el).then(() => el.remove());
    }
    this.flush(toast.position);
  }

  private resume(toast: Toast): void {
    const paused = this.regions.get(toast.position)?.matches(':hover, :focus-within');
    if (toast.remaining <= 0 || paused || toast.timer) return;
    toast.startedAt = Date.now();
    toast.timer = setTimeout(() => this.dismiss(toast), toast.remaining);
  }

  private pause(position: ToastPosition): void {
    for (const toast of this.toasts) {
      if (toast.position !== position || !toast.timer) continue;
      clearTimeout(toast.timer);
      toast.timer = undefined;
      toast.remaining -= Date.now() - toast.startedAt;
    }
  }

  private region(position: ToastPosition): HTMLElement {
    let region = this.regions.get(position);
    if (region) return region;
    region = this.document.createElement('section');
    region.className = `al-toaster al-toaster-${position}`;
    region.popover = 'manual';
    region.setAttribute('aria-label', this.strings().notifications);
    region.append(this.document.createElement('ol'));
    const resumeAll = () => {
      if (!region!.matches(':hover, :focus-within')) {
        this.toasts.filter((t) => t.position === position && t.el).forEach((t) => this.resume(t));
      }
    };
    region.addEventListener('pointerenter', () => this.pause(position));
    region.addEventListener('focusin', () => this.pause(position));
    region.addEventListener('pointerleave', () => setTimeout(resumeAll));
    region.addEventListener('focusout', () => setTimeout(resumeAll));
    region.addEventListener('keydown', (e) => {
      const el = (e.target as Element).closest('.al-toast');
      const toast = this.toasts.find((t) => t.el === el);
      if (e.key === 'Escape' && toast) {
        e.preventDefault(); // keeps a surrounding modal open
        this.dismiss(toast);
      }
    });
    this.regions.set(position, region);
    this.mount(region);
    return region;
  }

  /** Into the topmost modal (else the rest of the page is inert) or `<body>`, shown on top. */
  private mount(region: HTMLElement): void {
    const host = ɵtopModal() ?? this.document.body;
    if (region.parentElement === host) return;
    host.append(region);
    region.showPopover?.();
  }

  private announce(toast: Toast): void {
    const kind = toast.options.tone === 'error' ? 'assertive' : 'polite';
    let live = this.announcer[kind];
    if (!live) {
      live = this.announcer[kind] = this.document.body.appendChild(this.node('div', 'al-toaster-announcer'));
      live.setAttribute('aria-live', kind);
      live.setAttribute('aria-atomic', 'true');
    }
    live.textContent = '';
    // A moment later so screen readers treat it as a change.
    setTimeout(() => (live.textContent = [toast.options.title, toast.message].filter(Boolean).join('. ')), 100);
  }

  private node(tag: string, className: string, ...children: Array<Node | string | undefined | ''>): HTMLElement {
    const el = this.document.createElement(tag);
    el.className = className;
    el.append(...children.filter((c): c is Node | string => !!c));
    return el;
  }

  private button(className: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = this.node('button', className, label) as HTMLButtonElement;
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }
}
