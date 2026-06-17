import { signal, Signal, inject, DestroyRef, effect, ElementRef, untracked } from '@angular/core';

export interface ResizeObserverSignalState {
  supported: boolean;
  width: number;
  height: number;
}

export type ResizeObserverTarget =
  | HTMLElement
  | SVGElement
  | ElementRef<HTMLElement | SVGElement>
  | string
  | null
  | undefined
  | (() => HTMLElement | SVGElement | ElementRef<HTMLElement | SVGElement> | string | null | undefined)
  | Signal<HTMLElement | SVGElement | ElementRef<HTMLElement | SVGElement> | string | null | undefined>;

/**
 * Reactively tracks the layout width and height of a target DOM element using the native ResizeObserver API.
 * Automatically throttles high-frequency layout emissions using `requestAnimationFrame`, cleans up on destruction,
 * and lazy-resolves DOM selectors safely after template paint is ready.
 *
 * @param target The target layout element to track. Can be a raw Element, a CSS Selector string, an ElementRef, or a reactive signal/function returning one.
 * @returns A Readonly Signal containing the dynamic supported flag, element width, and element height.
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'app-container',
 *   template: `
 *     <div id="card" class="card">
 *       Card Size: {{ size().width }}px x {{ size().height }}px
 *     </div>
 *   `
 * })
 * export class ContainerComponent {
 *   // Simple string CSS selector resolved cleanly after render!
 *   size = resizeObserverSignal('#card');
 * }
 * ```
 */
export function resizeObserverSignal(
  target: ResizeObserverTarget
): Signal<ResizeObserverSignalState> {
  const supported = typeof window !== 'undefined' && 'ResizeObserver' in window;
  const initialEmptyState: ResizeObserverSignalState = { supported, width: 0, height: 0 };
  const state = signal<ResizeObserverSignalState>(initialEmptyState);

  if (!supported) return state.asReadonly();

  let observer: ResizeObserver | null = null;
  let frameId: number | null = null;

  const cleanup = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const observe = (element: HTMLElement | SVGElement) => {
    cleanup();
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
        frameId = requestAnimationFrame(() => {
          state.set({
            supported: true,
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        });
      }
    });
    observer.observe(element, {});
  };

  const resolve = (t: ResizeObserverTarget): HTMLElement | SVGElement | null => {
    if (!t) return null;
    if (typeof t === 'string' && typeof document !== 'undefined') {
      return document.querySelector(t) as HTMLElement | SVGElement | null;
    }
    if (t instanceof ElementRef) return t.nativeElement;
    if (t instanceof HTMLElement || t instanceof SVGElement) return t;
    if (typeof t === 'function') {
      try {
        const resolved = t();
        return resolved instanceof ElementRef ? resolved.nativeElement : resolve(resolved);
      } catch {
        return null;
      }
    }
    return null;
  };

  let currentEl: HTMLElement | SVGElement | null = null;
  const initialEl = resolve(target);
  if (initialEl) {
    observe(initialEl);
    currentEl = initialEl;
  }

  // Bind effect if provided a function or selector, otherwise resolve static element
  if (typeof target === 'function' || typeof target === 'string') {
    try {
      effect(() => {
        const el = resolve(target);
        untracked(() => {
          if (el) {
            if (el !== currentEl) {
              observe(el);
              currentEl = el;
            }
          } else {
            cleanup();
            currentEl = null;
            state.set(initialEmptyState);
          }
        });
      });
    } catch {
      // Handled synchronously by first resolve
    }
  }

  try {
    inject(DestroyRef).onDestroy(cleanup);
  } catch {}

  return state.asReadonly();
}
