import {
  InjectionToken,
  isSignal,
  type Injector,
  type InputSignal,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import type { DialogRef, CloseSource } from './dialog-ref';

/**
 * Maps component signal inputs (`input()`, `model()`) to raw primitive/object types.
 */
export type ComponentInputs<T> = {
  [K in keyof T as T[K] extends InputSignal<any> | ModelSignal<any> ? K : never]?:
    T[K] extends InputSignal<infer U>
      ? U
      : T[K] extends ModelSignal<infer U>
        ? U
        : never;
};

/** Implement on the component class to brand `open()` / `window()` result without a public `dialogRef`. */
export interface DialogResultBrand<TResult> {
  ɵdialogResult?: TResult;
}

/**
 * Infers the dialog result type from a component.
 *
 * Looks for a public `dialogRef: DialogRef<R>` property first, then
 * {@link DialogResultBrand} (`ɵdialogResult` on the instance type).
 */
export type InferDialogResult<TComponent> = TComponent extends {
  dialogRef: DialogRef<infer R, any>;
}
  ? R
  : TComponent extends DialogResultBrand<infer R>
    ? R
    : unknown;

export interface DialogPluginContext<TComponent = any> {
  element: HTMLDialogElement;
  dialogRef: DialogRef<any, TComponent>;
  injector: Injector;
}

export type LayoutState = 'normal' | 'minimized' | 'maximized' | 'resized' | 'dragged';

export interface LayoutChangeEvent {
  state: LayoutState;
  x: number;
  y: number;
  width: string;
  height: string;
}

export interface DialogPlugin<TComponent = any> {
  readonly id?: string;
  setup?(context: DialogPluginContext<TComponent>): (() => void) | void;
  onOpen?(context: DialogPluginContext<TComponent>): void;
  beforeClose?(
    context: DialogPluginContext<TComponent> & { source: CloseSource },
  ): Promise<boolean | void> | boolean | void;
  onClose?(context: DialogPluginContext<TComponent>): void;
  onLayoutChange?(
    context: DialogPluginContext<TComponent> & { changes: LayoutChangeEvent },
  ): void;
}

export type DialogSizePreset = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const DIALOG_SIZE_PRESETS: Record<DialogSizePreset, string> = {
  sm: '320px',
  md: '480px',
  lg: '640px',
  xl: '800px',
  full: '90vw',
};

export type AutoFocusTarget = 'first-tabbable' | 'dialog' | false | HTMLElement | string;

export type DialogAnimation =
  | false
  | 'fade'
  | {
      enter?: string;
      leave?: string;
    };

export interface DialogStrings {
  close?: string;
  minimize?: string;
  maximize?: string;
  restore?: string;
  fullscreen?: string;
  exitFullscreen?: string;
  /** Default title for {@link DialogService.confirm}. */
  confirmTitle?: string;
  /** Default title for {@link DialogService.alert}. */
  alertTitle?: string;
  /** Default primary button label for confirm / alert. */
  ok?: string;
  /** Default secondary button label for confirm. */
  cancel?: string;
}

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Global chrome strings: a static object, a Signal (reactive i18n), or a sync factory
 * invoked when a dialog opens.
 *
 * @example
 * ```ts
 * provideDialog({ strings: { close: 'Close' } });
 * provideDialog({ strings: () => translate.dialogStrings() });
 * provideDialog({ strings: dialogStringsSignal });
 * ```
 */
export type DialogStringsSource =
  | DialogStrings
  | Signal<DialogStrings>
  | (() => DialogStrings);

/** Resolves {@link DialogStringsSource} to a plain object at dialog open time. */
export function resolveDialogStrings(
  source: DialogStringsSource | null | undefined,
): DialogStrings | undefined {
  if (source == null) return undefined;
  // Signals are callable functions — check isSignal first.
  if (isSignal(source)) return source();
  if (typeof source === 'function') return (source as () => DialogStrings)();
  return source;
}

/** True when `source` is a plain {@link DialogStrings} object (not Signal / factory). */
export function isPlainDialogStrings(
  source: DialogStringsSource | null | undefined,
): source is DialogStrings {
  return source != null && !isSignal(source) && typeof source !== 'function';
}

/**
 * Declarative window behaviors. Object forms accept the matching plugin option bags
 * (`DraggablePluginOptions`, `TileSnappingOptions`, etc.).
 */
export interface WindowBehaviorOptions {
  drag?: boolean | Record<string, any>;
  snap?: boolean | Record<string, any>;
  dock?: boolean | Record<string, any>;
  persist?: boolean | Record<string, any>;
  /** Maps to the native CSS `resize` handle (not a plugin). */
  resize?: boolean;
}

export interface DialogConfigBase {
  id?: string;
  disableClose?: boolean;
  panelClass?: string | string[];
  contentClass?: string | string[];
  size?: DialogSizePreset | (string & {});
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  /** Whether the user can resize the dialog via the native CSS resize handle. */
  resize?: boolean;
  modal?: boolean;
  autoFocus?: AutoFocusTarget;
  restoreFocus?: boolean;
  closeOnNavigation?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  animation?: DialogAnimation;
  drag?: boolean | Record<string, any>;
  snap?: boolean | Record<string, any>;
  dock?: boolean | Record<string, any>;
  persist?: boolean | Record<string, any>;
}

export interface GlobalDialogConfig extends DialogConfigBase {
  plugins?: DialogPlugin[];
  window?: WindowBehaviorOptions;
  persistDefaults?: Record<string, any>;
  /**
   * Default chrome strings for {@link DefaultDialogComponent}.
   * Accepts a static object, a {@link Signal}, or a sync factory — resolved when a dialog opens.
   */
  strings?: DialogStringsSource;
}

export interface ProvideDialogConfig extends GlobalDialogConfig {}

export const DIALOG_CONFIG = new InjectionToken<ProvideDialogConfig>('DIALOG_CONFIG');

export interface DialogOptions<TComponent = unknown> extends DialogConfigBase {
  inputs?: ComponentInputs<TComponent>;
  injector?: Injector;
  parent?: DialogRef<any, any>;
  plugins?: DialogPlugin[];
}

export interface WindowOptions<TComponent = unknown>
  extends Omit<DialogOptions<TComponent>, 'modal'> {}

export interface ConfirmOptions {
  title?: string;
  message?: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  width?: string;
  size?: DialogSizePreset | (string & {});
  disableClose?: boolean;
  panelClass?: string | string[];
  contentClass?: string | string[];
  ariaLabel?: string;
  ariaDescribedBy?: string;
  animation?: DialogAnimation;
  /** Per-call string overrides (merged over global `provideDialog({ strings })`). */
  strings?: DialogStringsSource;
}

export interface PopoverDialogOptions<TComponent = unknown>
  extends Omit<WindowOptions<TComponent>, 'drag' | 'snap' | 'dock' | 'persist'> {
  anchor: HTMLElement | string;
  placement?:
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right'
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'right';
  offset?: number;
  showArrow?: boolean;
  arrowColor?: string;
}

export interface ToastOptions {
  title?: string;
  width?: string;
  size?: DialogSizePreset | (string & {});
  panelClass?: string | string[];
  contentClass?: string | string[];
  duration?: number;
  pauseOnHover?: boolean;
  /** Corner placement. Defaults to `bottom-right`. */
  position?: ToastPosition;
}

export type DialogSurfaceState = 'open' | 'minimized' | 'maximized' | 'closed';
