import { reflectComponentType, type InputSignalWithTransform, type Type } from '@angular/core';
import type { DialogOptions, InferDialogResult } from './dialog.types';

type SignalInputKeys<C> = {
  [K in keyof C]-?: C[K] extends InputSignalWithTransform<any, any> ? K : never;
}[keyof C];

/** The type a signal input accepts (`input()`, `input.required()`, `model()`, transforms). */
type InputWriteType<S> = S extends InputSignalWithTransform<any, infer W> ? W : never;

/**
 * Inputs whose write type excludes `undefined` — `input.required<T>()` and
 * `input<T>(default)`. Angular does not distinguish the two in types, so an input
 * with a default is treated as required unless the definition presets it.
 */
type RequiredInputKeys<C> = {
  [K in SignalInputKeys<C>]: undefined extends InputWriteType<C[K]> ? never : K;
}[SignalInputKeys<C>];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Every signal input of `C`, all optional. Used for presets on a definition. */
export type DialogInputPresets<C> = {
  [K in SignalInputKeys<C>]?: InputWriteType<C[K]>;
};

/**
 * Inputs to pass when opening a definition: required inputs of `C` that the
 * definition did not preset (`TPreset`) are required here.
 */
export type DialogInputs<C, TPreset extends PropertyKey = never> = Simplify<
  {
    [K in Exclude<RequiredInputKeys<C>, TPreset>]: InputWriteType<C[K]>;
  } & {
    [K in Exclude<SignalInputKeys<C>, Exclude<RequiredInputKeys<C>, TPreset>>]?: InputWriteType<
      C[K]
    >;
  }
>;

declare const DIALOG_RESULT: unique symbol;

/** Phantom result marker created by {@link dialogResult}. */
export interface DialogResultType<T> {
  readonly [DIALOG_RESULT]?: T;
}

/**
 * Declares the result type of a {@link defineDialog} definition when it cannot be
 * inferred from the component.
 *
 * @example
 * ```ts
 * export const PickColor = defineDialog(PickColorComponent, { result: dialogResult<string>() });
 * ```
 */
export function dialogResult<T>(): DialogResultType<T> {
  return {};
}

/** Options a definition may preset. Per-call options override them. */
export type DialogDefinitionOptions<C> = Omit<DialogOptions<C>, 'inputs' | 'injector' | 'parent'>;

/** Per-call options when opening a definition (`inputs` are a separate argument). */
export type DialogCallOptions<C> = Omit<DialogOptions<C>, 'inputs'>;

const DEFINITION = 'al-dialog-definition' as const;

interface DialogDefinitionBase<C, R, P extends PropertyKey> {
  readonly ɵkind: typeof DEFINITION;
  readonly options: DialogDefinitionOptions<C>;
  readonly presets: DialogInputPresets<C>;
  /** Phantom types for inference — never set at runtime. Must stay in the `.d.ts` (no `@internal`). */
  readonly ɵtypes?: { result: R; preset: P };
}

/** Eager definition created by {@link defineDialog}. Open with `dialog.open` or `dialog.run`. */
export interface DialogDefinition<C, R = InferDialogResult<C>, P extends PropertyKey = never>
  extends DialogDefinitionBase<C, R, P> {
  readonly component: Type<C>;
}

/** Lazy definition (component loader). Open with `dialog.run`. */
export interface LazyDialogDefinition<C, R = InferDialogResult<C>, P extends PropertyKey = never>
  extends DialogDefinitionBase<C, R, P> {
  readonly load: () => Promise<Type<C>>;
}

export type AnyDialogDefinition<C, R = InferDialogResult<C>, P extends PropertyKey = never> =
  | DialogDefinition<C, R, P>
  | LazyDialogDefinition<C, R, P>;

type DefinitionConfig<C, R, TPresets> = DialogDefinitionOptions<C> & {
  /** Input presets. Preset inputs become optional when opening. */
  inputs?: TPresets;
  /** Result type marker — see {@link dialogResult}. Inferred from the component when omitted. */
  result?: DialogResultType<R>;
};

type MissingRequired<C, P extends PropertyKey> = Exclude<RequiredInputKeys<C>, P>;

/** Argument tuple for `dialog.open(definition, …)` / `dialog.run(definition, …)`. */
export type DialogDefinitionArgs<C, P extends PropertyKey> = [MissingRequired<C, P>] extends [never]
  ? [inputs?: DialogInputs<C, P>, options?: DialogCallOptions<C>]
  : [inputs: DialogInputs<C, P>, options?: DialogCallOptions<C>];

/**
 * Declares a reusable, typed dialog: component + default options + result type.
 *
 * - Required inputs (`input.required()`) must be passed when opening.
 * - The result type comes from `result: dialogResult<T>()`, else from the component
 *   (`dialogRef` / `injectDialog<T>()` property).
 * - Pass a loader (`() => import(…)`) for a lazily loaded component; open it with `dialog.run`.
 *
 * @example
 * ```ts
 * export const EditUserDialog = defineDialog(EditUserComponent, { size: 'md' });
 *
 * const outcome = await dialog.run(EditUserDialog, { user });
 * if (outcome.ok) save(outcome.value);
 * ```
 */
export function defineDialog<
  C,
  const TPresets extends DialogInputPresets<C> = {},
  R = InferDialogResult<C>,
>(
  component: Type<C>,
  config?: DefinitionConfig<C, R, TPresets>,
): DialogDefinition<C, R, keyof TPresets>;
export function defineDialog<
  C,
  const TPresets extends DialogInputPresets<C> = {},
  R = InferDialogResult<C>,
>(
  load: () => Promise<Type<C>>,
  config?: DefinitionConfig<C, R, TPresets>,
): LazyDialogDefinition<C, R, keyof TPresets>;
export function defineDialog(
  componentOrLoader: Type<unknown> | (() => Promise<Type<unknown>>),
  config: DefinitionConfig<unknown, unknown, Record<string, unknown>> = {},
): AnyDialogDefinition<unknown, unknown, PropertyKey> {
  const { inputs, result: _result, ...options } = config;
  const base = { ɵkind: DEFINITION, options, presets: inputs ?? {} };
  return reflectComponentType(componentOrLoader as Type<unknown>)
    ? { ...base, component: componentOrLoader as Type<unknown> }
    : { ...base, load: componentOrLoader as () => Promise<Type<unknown>> };
}

export function isDialogDefinition(value: unknown): value is AnyDialogDefinition<any, any, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ɵkind?: unknown }).ɵkind === DEFINITION
  );
}

/** Merges definition presets with per-call inputs/options into `DialogOptions`. */
export function resolveDefinitionOptions<C>(
  definition: AnyDialogDefinition<C, any, any>,
  inputs: object | undefined,
  options: DialogCallOptions<C> | undefined,
): DialogOptions<C> {
  return {
    ...definition.options,
    ...options,
    inputs: { ...definition.presets, ...inputs } as unknown as DialogOptions<C>['inputs'],
  };
}
