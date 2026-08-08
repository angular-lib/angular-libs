import { FORM_WIDTHS } from '../constants/form-widths';
import type {
  FormElement,
  FormElementBaseConfig,
  FormElementConfig,
  FormCheckboxProps,
  FormColorProps,
  FormCustomProps,
  FormDateProps,
  FormDateTimeProps,
  FormDurationProps,
  FormElementGroupProps,
  FormFileProps,
  FormNumberProps,
  FormPasswordProps,
  FormRadioProps,
  FormSearchProps,
  FormSelectProps,
  FormSliderProps,
  FormSpaceProps,
  FormSwitchProps,
  FormTagsProps,
  FormTextareaProps,
  FormTextProps,
  FormTimeProps,
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

export function formDate<TData = any>(
  config: Base<TData> & { props?: FormDateProps },
): FormElement<TData> & { type: 'date' } {
  return { ...config, type: 'date' };
}

export function formTime<TData = any>(
  config: Base<TData> & { props?: FormTimeProps },
): FormElement<TData> & { type: 'time' } {
  return { ...config, type: 'time' };
}

export function formDateTime<TData = any>(
  config: Base<TData> & { props?: FormDateTimeProps },
): FormElement<TData> & { type: 'datetime' } {
  return { ...config, type: 'datetime' };
}

export function formRadio<TData = any>(
  config: Base<TData> & { props: FormRadioProps },
): FormElement<TData> & { type: 'radio' } {
  return { ...config, type: 'radio' };
}

export function formSwitch<TData = any>(
  config: Base<TData> & { props?: FormSwitchProps },
): FormElement<TData> & { type: 'switch' } {
  return { ...config, type: 'switch' };
}

export function formSlider<TData = any>(
  config: Base<TData> & { props?: FormSliderProps },
): FormElement<TData> & { type: 'slider' } {
  return { ...config, type: 'slider' };
}

export function formFile<TData = any>(
  config: Base<TData> & { props?: FormFileProps },
): FormElement<TData> & { type: 'file' } {
  return { ...config, type: 'file' };
}

export function formColor<TData = any>(
  config: Base<TData> & { props?: FormColorProps },
): FormElement<TData> & { type: 'color' } {
  return { ...config, type: 'color' };
}

export function formTags<TData = any>(
  config: Base<TData> & { props?: FormTagsProps },
): FormElement<TData> & { type: 'tags' } {
  return { ...config, type: 'tags' };
}

export function formDuration<TData = any>(
  config: Base<TData> & { props?: FormDurationProps },
): FormElement<TData> & { type: 'duration' } {
  return { ...config, type: 'duration' };
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
      gap: gap ?? '0.75rem',
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
    date: (config: Base<TData> & { props?: FormDateProps }) => formDate<TData>(config),
    time: (config: Base<TData> & { props?: FormTimeProps }) => formTime<TData>(config),
    datetime: (config: Base<TData> & { props?: FormDateTimeProps }) => formDateTime<TData>(config),
    radio: (config: Base<TData> & { props: FormRadioProps }) => formRadio<TData>(config),
    switch: (config: Base<TData> & { props?: FormSwitchProps }) => formSwitch<TData>(config),
    slider: (config: Base<TData> & { props?: FormSliderProps }) => formSlider<TData>(config),
    file: (config: Base<TData> & { props?: FormFileProps }) => formFile<TData>(config),
    color: (config: Base<TData> & { props?: FormColorProps }) => formColor<TData>(config),
    tags: (config: Base<TData> & { props?: FormTagsProps }) => formTags<TData>(config),
    duration: (config: Base<TData> & { props?: FormDurationProps }) => formDuration<TData>(config),
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
