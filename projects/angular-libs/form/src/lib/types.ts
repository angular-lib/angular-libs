import type { Signal, Type, WritableSignal } from '@angular/core';
import type { FormFieldActionContext } from './field-action';

export type { FormFieldActionContext } from './field-action';

type Prev = [never, 0, 1, 2];

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/** `true` when `T` is `any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;

type NestedKeyOf<T, Depth extends number = 2> = [Depth] extends [never]
  ? never
  : IsAny<T> extends true
    ? string
    : T extends Primitive | Date | RegExp | Map<any, any> | Set<any> | Blob | File | ((...args: any[]) => any)
      ? never
      : T extends object
        ? {
            [K in keyof T & string]: IsAny<T[K]> extends true
              ? K
              : Exclude<T[K], undefined> extends Array<any>
                ? K
                : Exclude<T[K], undefined> extends Primitive | Date | RegExp
                  ? K
                  : Exclude<T[K], undefined> extends object
                    ? K | `${K}.${NestedKeyOf<Exclude<T[K], undefined>, Prev[Depth]>}`
                    : K;
          }[keyof T & string]
        : never;

/** Dot-path into a form model `TData` (depth-limited). */
export type FormPath<TData> = IsAny<TData> extends true
  ? string
  : [unknown] extends [TData]
    ? string
    : TData extends object
      ? NestedKeyOf<TData>
      : string;

export type FormElementType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'password'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime'
  | 'custom'
  | 'group'
  | 'line-break'
  | 'space';

export type MaybeSignal<T> = T | Signal<T> | WritableSignal<T>;

/** Breakpoint widths resolved via container queries on the form. */
export interface FormResponsiveWidth {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
}

export type FormWidth = string | FormResponsiveWidth;

/** Lead/trail adornment: plain text (or a built-in keyword like `search`). */
export type FormAdornment = string;

export interface FormElementBaseConfig<TData = unknown> {
  id?: string;
  path?: FormPath<TData>;
  label?: MaybeSignal<string>;
  hide?: MaybeSignal<boolean>;
  hint?: MaybeSignal<string>;
  /** Optional help text shown near the label (title / accessible description). */
  labelHelp?: MaybeSignal<string>;
  /** Stable id for label `for` / control `id`. Auto-generated when omitted. */
  controlId?: string;
  /** UI-only readonly (also respects `field().readonly()` from schema). */
  readonly?: MaybeSignal<boolean>;
  hideHeader?: boolean;
  hideFooter?: boolean;
  /**
   * Element width. String applies from the smallest breakpoint;
   * a map enables responsive widths via container queries.
   * When unset, the item flex-grows to fill the row.
   */
  width?: FormWidth;
  /**
   * Flex shorthand. Default: grow when no width, fixed when width is set.
   */
  flex?: string | number;
}

export interface FormControlChromeProps {
  placeholder?: string;
  clearable?: boolean;
  /** Clear the field when Escape is pressed while focused (opt-in). */
  clearOnEscape?: boolean;
  prefix?: string;
  suffix?: string;
  lead?: FormAdornment;
  trail?: FormAdornment;
  /** When true, trail is a button that emits `onTrail`. */
  trailAction?: boolean;
  onClear?: (ctx: FormFieldActionContext) => void;
  onTrail?: (ctx: FormFieldActionContext) => void;
}

export interface FormTextProps extends FormControlChromeProps {}

export interface FormNumberProps extends FormControlChromeProps {
  step?: number | string;
  min?: number | string;
  max?: number | string;
}

export interface FormPasswordProps extends Omit<FormControlChromeProps, 'trail' | 'trailAction'> {}

export interface FormSearchProps extends Omit<FormControlChromeProps, 'lead'> {
  /** Debounce for `onSearch` in ms (default 300). Empty/clear emits immediately. */
  debounceMs?: number;
  onSearch?: (ctx: FormFieldActionContext & { term: string }) => void;
}

export interface FormTextareaProps {
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  /** Grow height with content (default false). */
  autoGrow?: boolean;
}

export interface FormCheckboxProps {
  checkboxLabel?: string;
}

/** Column definition for multi-column dropdown panels (flat list only; not with tree). */
export interface FormDropdownColumn {
  field?: string;
  header?: string;
  width?: string | number;
  hide?: boolean;
  ignoreInSearch?: boolean;
  valueGetter?: (item: Record<string, unknown>) => unknown;
}

export interface FormDropdownLoaderParams {
  abortSignal: AbortSignal;
  searchTerm?: string;
  startRow: number;
  endRow: number;
}

export interface FormDropdownDatasource {
  loader: (params: FormDropdownLoaderParams) => Promise<readonly Record<string, unknown>[]>;
  chunkSize?: number;
  debounceMs?: number;
  /** When true, filter client-side and do not re-query loader on search. */
  searchLocally?: boolean;
}

export interface FormSelectCreatableOptions {
  createOnBlur?: boolean;
  /** Multi: treat comma as create delimiter. */
  createOnComma?: boolean;
  /** Return `false` or an error string to block create. */
  validate?: (term: string) => boolean | string;
  /**
   * Prefer this for S2 (`valueMode: 'id'`): return a real row with `valueKey`.
   * Without `onCreate`, creatable requires `valueMode: 'object'`.
   */
  onCreate?: (
    term: string,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface FormSelectTreeOptions {
  /** Default `'children'`. */
  childrenKey?: string;
  getChildren?: (
    item: Record<string, unknown>,
  ) => readonly Record<string, unknown>[] | undefined;
  defaultExpanded?: 'none' | 'all' | 'selected-ancestors';
  /** Multi + checkbox: selecting a parent also selects descendants. */
  selectDescendants?: boolean;
}

/** Shared calendar props for date / datetime pickers. */
export interface FormDatePickerBaseProps extends FormControlChromeProps {
  /** `yyyy-MM-dd` (date) or `yyyy-MM-ddTHH:mm` (datetime). */
  min?: string;
  /** `yyyy-MM-dd` (date) or `yyyy-MM-ddTHH:mm` (datetime). */
  max?: string;
  /** Dates that cannot be selected (`yyyy-MM-dd`). */
  disabledDates?: string[];
  /** 0 = Sunday … 6 = Saturday. Default `1` (Monday). */
  firstDayOfWeek?: number;
  /** Localized month names (length 12). */
  months?: string[];
  /** Localized weekday initials matching `firstDayOfWeek` order (length 7). */
  weekdays?: string[];
  showWeekNumbers?: boolean;
  clearText?: string;
  todayText?: string;
}

/** Value: `yyyy-MM-dd` string; empty `''`. */
export interface FormDateProps extends FormDatePickerBaseProps {}

/** Value: `HH:mm` string; empty `''`. */
export interface FormTimeProps extends FormControlChromeProps {
  min?: string;
  max?: string;
  /** Minute step (e.g. `5`, `15`). Default `1`. */
  step?: number | string;
}

/** Value: `yyyy-MM-ddTHH:mm` string; empty `''`. */
export interface FormDateTimeProps extends FormDatePickerBaseProps {
  /** Minute step (e.g. `5`, `15`). Default `1`. */
  step?: number | string;
}

export interface FormSelectProps {
  valueKey: string;
  labelKeys: string[];
  multiple?: boolean;
  items?: readonly Record<string, unknown>[];
  loadItems?: () => Promise<readonly Record<string, unknown>[]>;
  placeholder?: string;
  /** Default `'id'` (S2). Use `'object'` to write full row(s) into the field (S1). */
  valueMode?: 'id' | 'object';
  /**
   * Value written on clear for single S2 (`valueMode: 'id'`).
   * Default: `0` for number-ish current values, `''` for strings, otherwise `null`.
   */
  emptyValue?: unknown;
  /** Client search in the open panel (default true). */
  searchable?: boolean;
  /** Highlight matching search terms without filtering when true. */
  disableSearchFiltering?: boolean;
  datasource?: FormDropdownDatasource;
  groupBy?: string | ((item: Record<string, unknown>) => string);
  isRowDisabled?: (item: Record<string, unknown>) => boolean;
  /** Multi-column panel (ignored when `tree` is enabled). */
  columns?: FormDropdownColumn[];
  panelMaxHeight?: number;
  enableCheckboxes?: boolean;
  footerText?: string;
  onFooterClick?: () => void;
  noItemsText?: string;
  loadingText?: string;
  createText?: string;
  creatable?: boolean | FormSelectCreatableOptions;
  tree?: boolean | FormSelectTreeOptions;
}

export interface FormCustomProps<TComponent = unknown> {
  component: Type<TComponent>;
  inputs?: Record<string, unknown>;
}

export type FormFlexAlign =
  | ''
  | 'stretch'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'start'
  | 'end';

export type FormFlexJustify =
  | ''
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'start'
  | 'end';

export interface FormElementGroupProps<TData = unknown> {
  direction?: 'row' | 'column';
  gap?: string;
  alignItems?: FormFlexAlign;
  justifyContent?: FormFlexJustify;
  elements: FormElementConfig<TData>[];
}

export interface FormSpaceProps {
  /** Explicit height when used as vertical spacer (optional). */
  height?: string;
}

export type FormElement<TData = unknown> =
  | (FormElementBaseConfig<TData> & { type: 'text'; props?: FormTextProps })
  | (FormElementBaseConfig<TData> & { type: 'number'; props?: FormNumberProps })
  | (FormElementBaseConfig<TData> & { type: 'textarea'; props?: FormTextareaProps })
  | (FormElementBaseConfig<TData> & { type: 'checkbox'; props?: FormCheckboxProps })
  | (FormElementBaseConfig<TData> & { type: 'select'; props: FormSelectProps })
  | (FormElementBaseConfig<TData> & { type: 'password'; props?: FormPasswordProps })
  | (FormElementBaseConfig<TData> & { type: 'search'; props?: FormSearchProps })
  | (FormElementBaseConfig<TData> & { type: 'date'; props?: FormDateProps })
  | (FormElementBaseConfig<TData> & { type: 'time'; props?: FormTimeProps })
  | (FormElementBaseConfig<TData> & { type: 'datetime'; props?: FormDateTimeProps })
  | (FormElementBaseConfig<TData> & { type: 'custom'; props: FormCustomProps })
  | (FormElementBaseConfig<TData> & { type: 'group'; props: FormElementGroupProps<TData> })
  | (FormElementBaseConfig<TData> & { type: 'line-break'; props?: never })
  | (FormElementBaseConfig<TData> & { type: 'space'; props?: FormSpaceProps });

/** Static element config or a signal wrapping one (reactive hide/label). */
export type FormElementConfig<TData = unknown> = FormElement<TData> | Signal<FormElement<TData>>;

/** Path → writable list of display row snapshots (S2). */
export type SelectionDisplayMap = Record<string, WritableSignal<unknown[]>>;

export interface FormColumnDef {
  field?: string;
  header?: string;
  type?: 'text' | 'number' | 'boolean' | 'date';
  editable?: boolean;
}
