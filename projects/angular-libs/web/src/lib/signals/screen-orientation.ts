import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface ScreenOrientationSignalState {
  /** Indicates whether the modern Screen Orientation API is supported. */
  supported: boolean;
  /** Current screen orientation option (e.g., 'portrait-primary', 'landscape-secondary'). */
  type: OrientationType | null;
  /** Angle of screen rotation in degrees (e.g., 0, 90, 180, 270). */
  angle: number;
}

/**
 * Monitors and emits changes in device display screen orientation.
 *
 * @returns A Readonly Signal wrapping display orientation state characteristics.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (orientation().supported) {
 *       <p>Orientation type: {{ orientation().type }}</p>
 *       <p>Angle: {{ orientation().angle }}°</p>
 *     } @else {
 *       <p>Display orientation not supported by browser.</p>
 *     }
 *   `
 * })
 * export class OrientationComponent {
 *   orientation = screenOrientationSignal();
 * }
 * ```
 */
export function screenOrientationSignal(): Signal<ScreenOrientationSignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const screen = win?.screen;
  const orientation = screen?.orientation;

  const getInitialState = (): ScreenOrientationSignalState => {
    if (!orientation) {
      return {
        supported: false,
        type: null,
        angle: 0,
      };
    }
    return {
      supported: true,
      type: orientation.type,
      angle: orientation.angle,
    };
  };

  const state = signal<ScreenOrientationSignalState>(getInitialState());

  if (win && orientation) {
    const handleChange = () => {
      state.set({
        supported: true,
        type: orientation.type,
        angle: orientation.angle,
      });
    };

    orientation.addEventListener('change', handleChange);

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        orientation.removeEventListener('change', handleChange);
      });
    }
  }

  return state.asReadonly();
}
