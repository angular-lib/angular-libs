import { type Injector, type InputSignal, type ModelSignal } from '@angular/core';
import type { DialogRef, CloseSource } from './dialog-ref';

/**
 * Marker interface that components rendered in a dialog can implement to type their result.
 */
export interface DialogComponent<TResult = any> {
  dialogRef: DialogRef<TResult, any>;
}

/**
 * Maps component signal inputs (`input()`, `model()`) to raw primitive/object types.
 *
 * @typeParam T Component type whose inputs should be mapped.
 */
export type ComponentInputs<T> = {
  [K in keyof T as T[K] extends InputSignal<any> | ModelSignal<any> ? K : never]?:
    T[K] extends InputSignal<infer U>
      ? U
      : T[K] extends ModelSignal<infer U>
        ? U
        : never;
};

/**
 * Infers the dialog result type from a component extending DialogComponent.
 *
 * @typeParam TComponent Component type rendered by the dialog.
 */
export type InferDialogResult<TComponent> = TComponent extends DialogComponent<infer R>
  ? R
  : unknown;

/**
 * Context provided to dialog plugin lifecycle events.
 */
export interface DialogPluginContext<TResult = any, TComponent = any> {
  element: HTMLDialogElement;
  dialogRef: DialogRef<TResult, TComponent>;
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

/**
 * Contract for a dialog plugin.
 *
 * A plugin's `setup` function is called once after the component is mounted inside the dialog.
 * It may return a cleanup function that the service calls automatically when the dialog closes.
 */
export interface DialogPlugin<TResult = any, TComponent = any> {
  /**
   * Unique identifier to prevent duplicate activation of the same plugin.
   * If a plugin with an matching ID is provided in parent global configuration and specific config,
   * only the specific config instance will be retained.
   */
  readonly id?: string;

  /**
   * Called once immediately after the component is rendered inside the dialog but before opening.
   * Receives both the native dialog element, the DialogRef wrapper, and the dynamic Injector.
   */
  setup?(context: DialogPluginContext<TResult, TComponent>): (() => void) | void;

  /**
   * Called immediately after the dialog is opened (either modal or non-modal).
   */
  onOpen?(context: DialogPluginContext<TResult, TComponent>): void;

  /**
   * Intercepts and potentially prevents the dialog from closing.
   * Return `false` to prevent closing. Return `true` or `void` to allow it.
   */
  beforeClose?(
    context: DialogPluginContext<TResult, TComponent> & { source: CloseSource }
  ): Promise<boolean | void> | boolean | void;

  /**
   * Called after the dialog has finished closing and is removed from the DOM.
   */
  onClose?(context: DialogPluginContext<TResult, TComponent>): void;

  /**
   * Called after any layout modifications have occurred (dimensions, positions, coordinates, or minimization/maximization state).
   */
  onLayoutChange?(
    context: DialogPluginContext<TResult, TComponent> & { changes: LayoutChangeEvent }
  ): void;
}

/**
 * Base configuration options shared between global defaults and dynamic per-dialog options.
 */
export interface DialogConfigBase {
  /** Optional unique identifier for this dialog instance. Used to track state (e.g. coordinates/sizes). */
  id?: string;
  /** Whether the user is allowed to close the dialog via ESC or backdrop click. */
  disableClose?: boolean;
  /** Custom CSS class(es) to apply to the <dialog> element. */
  panelClass?: string | string[];
  /** Width of the dialog (e.g., '400px', '50vw') */
  width?: string;
  /** Minimum width of the dialog */
  minWidth?: string;
  /** Maximum width of the dialog */
  maxWidth?: string;
  /** Height of the dialog */
  height?: string;
  /** Minimum height of the dialog */
  minHeight?: string;
  /** Maximum height of the dialog */
  maxHeight?: string;
  /** Whether the dialog can be resized by the user. */
  resizable?: boolean;
  /**
   * Whether the dialog is modal.
   * If `true` (default), it opens as a modal using `showModal()`, creating a backdrop and blocking the rest of the page.
   * If `false`, it opens using `show()`, allowing the user to interact with the rest of the page simultaneously.
   */
  modal?: boolean;
}

/**
 * Global configuration options for the DialogService.
 */
export interface GlobalDialogConfig extends DialogConfigBase {
  /**
   * Default plugins to extend dialog behavior globally.
   */
  plugins?: DialogPlugin<any, any>[];
}

/**
 * Configuration used when opening a dialog.
 *
 * @typeParam TComponent Component type being rendered.
 */
export interface DialogOptions<TComponent = unknown> extends DialogConfigBase {
  /**
   * Values assigned to the dialog component through Angular's `setInput()` API.
   *
   * This supports signal-based `input()` and `model()` declarations.
   */
  inputs?: ComponentInputs<TComponent>;
  /**
   * Optional parent injector used when creating the dialog component.
   *
   * If omitted, the service falls back to the application's environment injector.
   */
  injector?: Injector;
  /**
   * Optional plugins to extend dialog behavior (e.g. dragging, snapping).
   * Each plugin's `setup` is called after the component is mounted and may return a cleanup function.
   *
   * @example
   * ```ts
   * import { draggablePlugin } from '@angular-libs/dialog';
   * open(MyDialog, { plugins: [draggablePlugin()] });
   * open(MyDialog, { plugins: [draggablePlugin({ handle: '.my-header' })] });
   * ```
   */
  plugins?: DialogPlugin<InferDialogResult<TComponent>, TComponent>[];
}
