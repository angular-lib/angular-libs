import { signal } from '@angular/core';
import { DialogRef, type ɵDialogHost } from '@angular-libs/dialog';
import { showTileGrid, type TileGridOptions } from './tile-grid';

export type WindowMode = 'normal' | 'minimized' | 'maximized';
export type SnapArea = 'left' | 'right' | 'top' | 'bottom';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowOptions {
  /** One window per id: opening it again focuses the open one. Required for `persist`. */
  id?: string;
  /** px. Default 480. */
  width?: number;
  /** px. Default: fits the content. */
  height?: number;
  /** px from the viewport's left / top. Default: centered, cascading. */
  x?: number;
  y?: number;
  /** Drag by `<al-window-header>` / `[alWindowHandle]`, else by the whole window. Default `true`. */
  drag?: boolean;
  /** Native resize grip. Default `true`. */
  resize?: boolean;
  /** Alt+Arrow snaps to half the screen. Default `true`. */
  snap?: boolean;
  /** Alt+S opens a grid; drag across cells to place the window. Default `true`. */
  tiles?: boolean | TileGridOptions;
  /** Minimized windows go to a taskbar (or `target`). Default `true`. */
  dock?: boolean | { target?: HTMLElement; autoHide?: boolean };
  /** Remember bounds and mode in `localStorage` under `id`. Default `false`. */
  persist?: boolean;
  panelClass?: string;
  ariaLabel?: string;
}

const GRIP_PX = 18;
const SNAP_KEYS: Record<string, SnapArea | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};
const INTERACTIVE = 'button, input, textarea, select, a, label, [contenteditable], [data-no-drag]';
let topZ = 1000;
let cascade = 0;

/**
 * A floating, modeless window. Everything is driven by two signals — `mode` and
 * `bounds` — written straight to the element; CSS does the rest.
 */
export class WindowRef<TResult = unknown, TComponent = unknown> extends DialogRef<TResult, TComponent> {
  private readonly mode$ = signal<WindowMode>('normal');
  private readonly bounds$ = signal<WindowBounds>({ x: 0, y: 0, width: 0, height: 0 });
  private readonly fullscreen$ = signal(false);
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly mode = this.mode$.asReadonly();
  readonly bounds = this.bounds$.asReadonly();
  readonly isFullscreen = this.fullscreen$.asReadonly();

  constructor(
    host: ɵDialogHost,
    private readonly options: WindowOptions,
  ) {
    super(host);
  }

  minimize(): void {
    this.setMode('minimized');
  }

  maximize(): void {
    this.setMode('maximized');
  }

  restore(): void {
    this.setMode('normal');
  }

  toggleMaximize(): void {
    this.setMode(this.mode() === 'maximized' ? 'normal' : 'maximized');
  }

  moveTo(x: number, y: number): void {
    this.setBounds({ ...this.bounds(), x, y });
  }

  resizeTo(width: number, height: number): void {
    this.setBounds({ ...this.bounds(), width, height });
  }

  /** Half of the screen. */
  snap(area: SnapArea): void {
    const w = innerWidth;
    const h = innerHeight;
    const half = { left: [0, 0, w / 2, h], right: [w / 2, 0, w / 2, h], top: [0, 0, w, h / 2], bottom: [0, h / 2, w, h / 2] }[area];
    this.setBounds({ x: half[0], y: half[1], width: half[2], height: half[3] });
  }

  async toggleFullscreen(): Promise<void> {
    // Safari refuses fullscreen on <dialog>; use the content root.
    const target = this.element.firstElementChild ?? this.element;
    if (document.fullscreenElement === target) await document.exitFullscreen();
    else await target.requestFullscreen?.();
  }

  /** Raises the window above the others and focuses it. */
  focus(): void {
    this.bringToFront();
    this.element.focus({ preventScroll: true });
  }

  private setMode(mode: WindowMode): void {
    if (this.mode() === mode) return;
    this.mode$.set(mode);
    this.render();
    if (mode !== 'minimized') this.focus();
  }

  private setBounds(bounds: WindowBounds): void {
    this.mode$.set('normal');
    this.bounds$.set(bounds);
    this.render();
  }

  private bringToFront(): void {
    if (Number(this.element.style.zIndex) !== topZ) this.element.style.zIndex = String(++topZ);
  }

  private render(): void {
    const el = this.element;
    const { x, y, width, height } = this.bounds();
    const mode = this.mode();
    el.dataset['mode'] = mode;
    Object.assign(el.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: height ? `${height}px` : '',
    });
    this.dock(mode === 'minimized');
    if (this.options.persist && this.options.id) {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => localStorage.setItem(storageKey(this.options.id!), JSON.stringify({ bounds: this.bounds(), mode: this.mode() })), 150);
    }
  }

  private dock(minimized: boolean): void {
    const dock = this.options.dock ?? true;
    if (!dock) return;
    const { target, autoHide } = dock === true ? {} : dock;
    if (minimized) {
      const bar = target ?? taskbar(autoHide);
      bar.append(this.element);
    } else if (this.element.parentElement !== document.body) {
      const bar = this.element.parentElement;
      document.body.append(this.element);
      if (bar?.classList.contains('al-window-dock') && !bar.children.length) bar.remove();
    }
  }

  /** @internal Called once the window is open; returns the teardown. */
  ɵattach(): () => void {
    const el = this.element;
    const o = this.options;
    const saved = o.persist && o.id ? readSaved(o.id) : null;
    const rect = el.getBoundingClientRect();
    const width = o.width ?? 480;
    const height = o.height ?? 0;
    const offset = (cascade++ % 8) * 24;
    this.bounds$.set(
      saved?.bounds ?? {
        width,
        height,
        x: o.x ?? Math.max(0, (innerWidth - width) / 2 + offset),
        y: o.y ?? Math.max(16, (innerHeight - (height || rect.height)) / 3 + offset),
      },
    );
    if (saved?.mode) this.mode$.set(saved.mode);
    el.style.resize = o.resize === false ? 'none' : 'both';
    this.render();
    this.bringToFront();

    const cleanups: Array<() => void> = [];
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Document,
      type: K,
      listener: (e: HTMLElementEventMap[K]) => void,
      capture = false,
    ) => {
      target.addEventListener(type, listener as EventListener, capture);
      cleanups.push(() => target.removeEventListener(type, listener as EventListener, capture));
    };

    on(el, 'pointerdown', () => this.bringToFront(), true);
    on(el, 'focusin', () => this.bringToFront());
    // A minimized window restores on click instead of passing the click on.
    on(el, 'click', (e) => {
      if (this.mode() !== 'minimized') return;
      e.preventDefault();
      e.stopPropagation();
      this.restore();
    }, true);

    if (o.drag !== false) on(el, 'pointerdown', (e) => this.startDrag(e));

    on(el, 'keydown', (e) => {
      if (!e.altKey) return;
      const area = SNAP_KEYS[e.key];
      if (area && o.snap !== false) {
        e.preventDefault();
        this.snap(area);
      } else if (e.code === 'KeyS' && o.tiles !== false && this.mode() !== 'minimized') {
        e.preventDefault();
        showTileGrid(o.tiles === true ? {} : (o.tiles ?? {}), (r) => {
          this.setBounds({ x: r.left, y: r.top, width: r.width, height: r.height });
          el.focus();
        });
      }
    });

    on(document, 'fullscreenchange', () => {
      this.fullscreen$.set(!!document.fullscreenElement && el.contains(document.fullscreenElement));
    });

    // The native grip writes inline width/height; mirror it into `bounds`.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (this.mode() !== 'normal') return;
      const b = this.bounds();
      const { width, height } = el.getBoundingClientRect();
      if (Math.round(width) !== Math.round(b.width) || (b.height && Math.round(height) !== Math.round(b.height))) {
        this.bounds$.set({ ...b, width, height: b.height ? height : 0 });
      }
    });
    observer?.observe(el);

    return () => {
      cleanups.forEach((c) => c());
      observer?.disconnect();
      if (this.isFullscreen()) void document.exitFullscreen();
      this.dock(false);
    };
  }

  private startDrag(e: PointerEvent): void {
    const el = this.element;
    const target = e.target as HTMLElement;
    if (e.button !== 0 || this.mode() !== 'normal' || target.closest(INTERACTIVE)) return;
    const hasHandle = !!el.querySelector('.al-window-header, [alWindowHandle]');
    if (hasHandle && !target.closest('.al-window-header, [alWindowHandle]')) return;
    const rect = el.getBoundingClientRect();
    if (el.style.resize !== 'none' && e.clientX > rect.right - GRIP_PX && e.clientY > rect.bottom - GRIP_PX) return;

    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, ...this.bounds() };
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('al-window-dragging');
    const move = (m: PointerEvent) => {
      // Keep enough of the window on screen to grab it again.
      const x = Math.min(Math.max(start.x + m.clientX - start.px, 80 - start.width), innerWidth - 80);
      const y = Math.min(Math.max(start.y + m.clientY - start.py, 0), innerHeight - 40);
      this.moveTo(x, y);
    };
    const end = () => {
      el.classList.remove('al-window-dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

function taskbar(autoHide = false): HTMLElement {
  let bar = document.querySelector<HTMLElement>('body > .al-window-dock');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'al-window-dock';
    document.body.append(bar);
  }
  bar.classList.toggle('al-window-dock-autohide', autoHide);
  return bar;
}

function storageKey(id: string): string {
  return `al-window:${id}`;
}

function readSaved(id: string): { bounds: WindowBounds; mode: WindowMode } | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null');
  } catch {
    return null;
  }
}
