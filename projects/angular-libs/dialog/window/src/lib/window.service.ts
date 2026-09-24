import { Injectable, inject, type Injector, type Type } from '@angular/core';
import { DialogService, type DialogInputs, type InferDialogResult } from '@angular-libs/dialog';
import { WindowRef, type WindowOptions } from './window-ref';

/**
 * Floating, modeless windows: drag, resize, minimize to a dock, maximize, snap
 * (Alt+Arrow), tile grid (Alt+S), fullscreen and remembered layout. Desktop-oriented.
 *
 * Requires `@angular-libs/dialog/styles/window.css`.
 *
 * @example
 * ```ts
 * const win = windows.open(ChatComponent, { room }, { id: 'chat', persist: true });
 * win.snap('right');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly dialogs = inject(DialogService);
  private readonly byId = new Map<string, WindowRef<any, any>>();

  open<C>(
    component: Type<C>,
    inputs?: DialogInputs<C>,
    options: WindowOptions & { injector?: Injector } = {},
  ): WindowRef<InferDialogResult<C>, C> {
    const existing = options.id ? this.byId.get(options.id) : undefined;
    if (existing) {
      existing.restore();
      existing.focus();
      return existing;
    }

    let win!: WindowRef<InferDialogResult<C>, C>;
    this.dialogs.ɵmount(component, inputs, {
      modal: false,
      className: ['al-dialog-window', options.panelClass].filter(Boolean).join(' '),
      closeOnEscape: false,
      closeOnBackdrop: false,
      closeOnNavigation: false,
      ariaLabel: options.ariaLabel,
      injector: options.injector,
      createRef: (host) => (win = new WindowRef(host, options)),
      providers: (ref) => [{ provide: WindowRef, useValue: ref }],
      setup: () => {
        const detach = win.ɵattach();
        // Forget the id as soon as closing starts, so a new open() gets a new window.
        return () => {
          detach();
          if (options.id) this.byId.delete(options.id);
        };
      },
    });
    if (options.id) this.byId.set(options.id, win);
    return win;
  }
}
