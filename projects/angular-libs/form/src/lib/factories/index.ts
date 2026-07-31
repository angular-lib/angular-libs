import { FORM_WIDTHS } from '../constants/form-widths';
import type {
  FormElement,
  FormElementBaseConfig,
  FormElementConfig,
  FormCheckboxProps,
  FormCustomProps,
  FormElementGroupProps,
  FormNumberProps,
  FormPasswordProps,
  FormSearchProps,
  FormSelectProps,
  FormSpaceProps,
  FormTextareaProps,
  FormTextProps,
  FormWidth,
} from '../types';

type Base<TData> = FormElementBaseConfig<NoInfer<TData>>;

export function formText<TData = any>(
  config: Base<TData> & { props?: FormTextProps },
): FormElement<TData> & { type: 'text' } {
  return { ...config, type: 'text' };
}

export function formNumber<TData = any>(
  config: Base<TData> & { props?: FormNumberProps },
): FormElement<TData> & { type: 'number' } {
  return { ...config, type: 'number' };
}

export function formTextarea<TData = any>(
  config: Base<TData> & { props?: FormTextareaProps },
): FormElement<TData> & { type: 'textarea' } {
  return { ...config, type: 'textarea' };
}

export function formCheckbox<TData = any>(
  config: Base<TData> & { props?: FormCheckboxProps },
): FormElement<TData> & { type: 'checkbox' } {
  return { ...config, type: 'checkbox' };
}

export function formSelect<TData = any>(
  config: Base<TData> & { props: FormSelectProps },
): FormElement<TData> & { type: 'select' } {
  return { ...config, type: 'select' };
}

export function formPassword<TData = any>(
  config: Base<TData> & { props?: FormPasswordProps },
): FormElement<TData> & { type: 'password' } {
  return { ...config, type: 'password' };
}

export function formSearch<TData = any>(
  config: Base<TData> & { props?: FormSearchProps },
): FormElement<TData> & { type: 'search' } {
  return { ...config, type: 'search' };
}

export function formCustom<TData = any, TComponent = any>(
  config: Base<TData> & { props: FormCustomProps<TComponent> },
): FormElement<TData> & { type: 'custom' } {
  return { ...config, type: 'custom' };
}

export function formElementGroup<TData = any>(
  config: Base<TData> & { props: FormElementGroupProps<TData> },
): FormElement<TData> & { type: 'group' } {
  return { ...config, type: 'group' };
}

export function formLineBreak<TData = any>(
  config: Base<TData> = {},
): FormElement<TData> & { type: 'line-break' } {
  return { ...config, type: 'line-break' };
}

export function formSpace<TData = any>(
  config: Base<TData> & { props?: FormSpaceProps } = {},
): FormElement<TData> & { type: 'space' } {
  return { ...config, type: 'space' };
}

export interface FormRowOptions<TData = unknown> extends Omit<Base<TData>, 'width'> {
  /** Row width (default `FORM_WIDTHS.full`). */
  width?: FormWidth;
  gap?: string;
  alignItems?: FormElementGroupProps<TData>['alignItems'];
  justifyContent?: FormElementGroupProps<TData>['justifyContent'];
}

/**
 * Convenience wrapper: a full-width row group of elements (side-by-side with widths).
 *
 * @example
 * ```ts
 * formRow([
 *   formText({ path: 'first', label: 'First', width: FORM_WIDTHS.half }),
 *   formText({ path: 'last', label: 'Last', width: FORM_WIDTHS.half }),
 * ])
 * ```
 */
export function formRow<TData = any>(
  elements: FormElementConfig<TData>[],
  options: FormRowOptions<TData> = {},
): FormElement<TData> & { type: 'group' } {
  const { gap, alignItems, justifyContent, width, ...base } = options;
  return formElementGroup({
    ...base,
    width: width ?? FORM_WIDTHS.full,
    props: {
      direction: 'row',
      gap: gap ?? '1rem',
      alignItems,
      justifyContent,
      elements,
    },
  });
}

/**
 * Bound factories for a model type — paths are checked against `TData`.
 *
 * @example
 * ```ts
 * const f = formFactories<User>();
 * createForm<User>({
 *   elements: [
 *     f.row([
 *       f.text({ path: 'firstName', label: 'First', width: FORM_WIDTHS.half }),
 *       f.text({ path: 'lastName', label: 'Last', width: FORM_WIDTHS.half }),
 *     ]),
 *     f.select({ path: 'roleId', props: { valueKey: 'id', labelKeys: ['name'], items } }),
 *   ],
 * });
 * ```
 */
export function formFactories<TData>() {
  return {
    text: (config: Base<TData> & { props?: FormTextProps }) => formText<TData>(config),
    number: (config: Base<TData> & { props?: FormNumberProps }) => formNumber<TData>(config),
    textarea: (config: Base<TData> & { props?: FormTextareaProps }) => formTextarea<TData>(config),
    checkbox: (config: Base<TData> & { props?: FormCheckboxProps }) => formCheckbox<TData>(config),
    select: (config: Base<TData> & { props: FormSelectProps }) => formSelect<TData>(config),
    password: (config: Base<TData> & { props?: FormPasswordProps }) => formPassword<TData>(config),
    search: (config: Base<TData> & { props?: FormSearchProps }) => formSearch<TData>(config),
    custom: <TComponent>(config: Base<TData> & { props: FormCustomProps<TComponent> }) =>
      formCustom<TData, TComponent>(config),
    elementGroup: (config: Base<TData> & { props: FormElementGroupProps<TData> }) =>
      formElementGroup<TData>(config),
    row: (elements: FormElementConfig<TData>[], options?: FormRowOptions<TData>) =>
      formRow<TData>(elements, options),
    lineBreak: (config?: Base<TData>) => formLineBreak<TData>(config),
    space: (config?: Base<TData> & { props?: FormSpaceProps }) => formSpace<TData>(config),
  };
}
