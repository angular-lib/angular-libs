import {
  InjectionToken,
  inject,
  isSignal,
  makeEnvironmentProviders,
  type EnvironmentProviders,
  type Injector,
  type InputSignalWithTransform,
  type Signal,
} from '@angular/core';
import type { DialogRef } from './dialog-ref';
import type { DialogHandle } from './inject-dialog';
import type { ToasterConfig } from './toaster';

// ---------------------------------------------------------------------------
// Component typing
// ---------------------------------------------------------------------------

type InputKeys<C> = {
  [K in keyof C]-?: C[K] extends InputSignalWithTransform<any, any> ? K : never;
}[keyof C];

type InputValue<S> = S extends InputSignalWithTransform<any, infer W> ? W : never;

/**
 * Values for the signal inputs (`input()`, `model()`) of `C`, type-checked by name and type.
 *
 * All are optional: Angular's types cannot tell `input.required()` from `input(default)`.
 * A missing required input fails at runtime with NG0950 when the dialog renders.
 */
export type DialogInputs<C> = { [K in InputKeys<C>]?: InputValue<C[K]> };

type ResultOf<C> = {
  [K in keyof C]: C[K] extends DialogRef<infer R, any>
    ? [R]
    : C[K] extends DialogHandle<infer R>
      ? [R]
      : never;
}[keyof C];

/** Result type of a dialog component: taken from a public `injectDialog<R>()` / `DialogRef<R>` property. */
export type InferDialogResult<C> = [ResultOf<C>] extends [never]
  ? unknown
  : ResultOf<C> extends [infer R]
    ? R
    : unknown;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** `sm` 320px · `md` 480px · `lg` 640px · `xl` 800px · `full` 100% — or any CSS width. */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full' | (string & {});

export interface DialogOptions {
  /** Width preset or CSS width. Default `md`. */
  size?: DialogSize;
  /** Presentation below 640px: bottom `sheet` or `fullscreen`. Default: centered. */
  mobile?: 'sheet' | 'fullscreen';
  /** Extra class(es) on the `<dialog>`, space separated. */
  panelClass?: string;
  /** Default `true`. */
  closeOnEscape?: boolean;
  /** Default `true`. */
  closeOnBackdrop?: boolean;
  /** Close when the URL changes. Default `true`. */
  closeOnNavigation?: boolean;
  /** Accessible name when the content has no `alDialogTitle` / `<al-dialog-header>`. */
  ariaLabel?: string;
  /** Default `dialog`; `confirm()` / `alert()` use `alertdialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Parent injector for the content component. */
  injector?: Injector;
}

export interface DialogStrings {
  close: string;
  ok: string;
  cancel: string;
  /** Shown when a confirm `onConfirm` throws and no `errorText` is given. */
  error: string;
  /** Accessible name of the toaster regions. */
  notifications: string;
  minimize: string;
  maximize: string;
  restore: string;
  fullscreen: string;
  exitFullscreen: string;
}

const DEFAULT_STRINGS: DialogStrings = {
  close: 'Close',
  ok: 'OK',
  cancel: 'Cancel',
  error: 'Something went wrong. Please try again.',
  notifications: 'Notifications',
  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
};

export interface DialogConfig {
  /** Static, a Signal (reactive i18n), or a factory read on use. */
  strings?:
    | Partial<DialogStrings>
    | Signal<Partial<DialogStrings>>
    | (() => Partial<DialogStrings>);
  /** Defaults for every `dialog.open()`. */
  defaults?: DialogOptions;
  toaster?: ToasterConfig;
}

export const DIALOG_CONFIG = new InjectionToken<DialogConfig>('DIALOG_CONFIG', {
  providedIn: 'root',
  factory: () => ({}),
});

/**
 * @example
 * ```ts
 * provideDialog({ strings: () => translate.dialogStrings(), defaults: { mobile: 'sheet' } })
 * ```
 */
export function provideDialog(config: DialogConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DIALOG_CONFIG, useValue: config }]);
}

/** Returns a getter for the configured strings (reactive when configured with a Signal). */
export function injectDialogStrings(): () => DialogStrings {
  const source = inject(DIALOG_CONFIG).strings;
  return () => {
    const strings = isSignal(source) ? source() : typeof source === 'function' ? source() : source;
    return { ...DEFAULT_STRINGS, ...strings };
  };
}
