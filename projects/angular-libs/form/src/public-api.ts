/*
 * Public API Surface of @angular-libs/form
 *
 * Supported surface (documented in README):
 * - createForm / FormController / seedSelection / clearSelection
 * - factories + formFactories / formRow / FORM_WIDTHS
 * - AlSignalForm + provideFormFields / registerBuiltInFormFields
 * - AlField / AlFieldShell / AlControlChrome (form chrome)
 * - Standalone controls (`AlTextInput`, `AlDatePicker`, …) + `AlForm*` adapters
 * - toColumnDefs / warnInvalidFormSetup
 *
 * Advanced (layout plumbing — prefer not to depend on these in apps):
 * - AlFormElements / AlFormElementList / AlFormItem / layout helpers
 */

export type {
  FormPath,
  FormElementType,
  MaybeSignal,
  FormResponsiveWidth,
  FormWidth,
  FormElementBaseConfig,
  FormAdornment,
  FormControlChromeProps,
  FormTextProps,
  FormNumberProps,
  FormPasswordProps,
  FormSearchProps,
  FormTextareaProps,
  FormCheckboxProps,
  FormRadioOption,
  FormRadioProps,
  FormSwitchProps,
  FormSliderProps,
  FormFileProps,
  FormColorProps,
  FormTagsProps,
  FormDurationProps,
  FormSelectProps,
  FormDatePickerBaseProps,
  FormDateProps,
  FormTimeProps,
  FormDateTimeProps,
  FormDropdownColumn,
  FormDropdownLoaderParams,
  FormDropdownDatasource,
  FormSelectCreatableOptions,
  FormSelectTreeOptions,
  FormCustomProps,
  FormFlexAlign,
  FormFlexJustify,
  FormElementGroupProps,
  FormSpaceProps,
  FormElement,
  FormElementConfig,
  SelectionDisplayMap,
  FormColumnDef,
} from './lib/types';

export type { FormFieldActionContext } from './lib/field-action';
export type { FormUiFieldTree } from './lib/types/form-ui-field-tree';
export type { FormRowOptions } from './lib/factories/index';

export { FORM_WIDTHS } from './lib/constants/form-widths';

export {
  formText,
  formNumber,
  formTextarea,
  formCheckbox,
  formSelect,
  formPassword,
  formSearch,
  formDate,
  formTime,
  formDateTime,
  formRadio,
  formSwitch,
  formSlider,
  formFile,
  formColor,
  formTags,
  formDuration,
  formCustom,
  formElementGroup,
  formRow,
  formLineBreak,
  formSpace,
  formFactories,
} from './lib/factories/index';

export {
  createForm,
  FormController,
  seedSelection,
  clearSelection,
} from './lib/create-form';
export type { CreateFormOptions } from './lib/create-form';

export { FormFieldRegistry, defaultFormFieldRegistry } from './lib/registry/form-field-registry';
export { FORM_FIELD_REGISTRY, provideFormFields } from './lib/registry/provide-form-fields';
export { registerBuiltInFormFields } from './lib/registry/register-built-ins';

export { AlSignalForm } from './lib/components/signal-form/signal-form';
export { AlField } from './lib/components/field/field';
export { AlControlChrome } from './lib/components/control-chrome/control-chrome';
export { AlFieldShell } from './lib/components/field-shell/field-shell';

/** Standalone controls (`FormValueControl` / `FormCheckboxControl` — use `[(value)]` or `[formField]`). */
export { AlTextInput } from './lib/components/controls/text-input';
export { AlNumberInput } from './lib/components/controls/number-input';
export { AlTextarea } from './lib/components/controls/textarea';
export { AlCheckbox } from './lib/components/controls/checkbox';
export { AlPasswordInput } from './lib/components/controls/password-input';
export { AlSearchInput } from './lib/components/controls/search-input';
export { AlDatePicker } from './lib/components/controls/date-picker';
export { AlTimePicker } from './lib/components/controls/time-picker';
export { AlDateTimePicker } from './lib/components/controls/datetime-picker';
export { AlRadioGroup } from './lib/components/controls/radio-group';
export { AlSwitch } from './lib/components/controls/switch';
export { AlSlider } from './lib/components/controls/slider';
export { AlFileInput } from './lib/components/controls/file-input';
export { AlColorInput } from './lib/components/controls/color-input';
export { AlTagInput } from './lib/components/controls/tag-input';
export { AlDuration } from './lib/components/controls/duration';
export { AlDropdown } from './lib/components/dropdown/al-dropdown';
export type { AlDropdownValueChange } from './lib/components/dropdown/al-dropdown';
export type { AlDropdownApi } from './lib/components/dropdown/dropdown-api';
export type { DropdownItem } from './lib/components/dropdown/dropdown-utils';

/** Form adapters — export for `provideFormFields` overrides / custom composition. */
export { AlFormText } from './lib/components/form/form-text';
export { AlFormNumber } from './lib/components/form/form-number';
export { AlFormTextarea } from './lib/components/form/form-textarea';
export { AlFormCheckbox } from './lib/components/form/form-checkbox';
export { AlFormSelect } from './lib/components/form/form-select';
export { AlFormPassword } from './lib/components/form/form-password';
export { AlFormSearch } from './lib/components/form/form-search';
export { AlFormDate } from './lib/components/form/form-date';
export { AlFormTime } from './lib/components/form/form-time';
export { AlFormDateTime } from './lib/components/form/form-datetime';
export { AlFormRadio } from './lib/components/form/form-radio';
export { AlFormSwitch } from './lib/components/form/form-switch';
export { AlFormSlider } from './lib/components/form/form-slider';
export { AlFormFile } from './lib/components/form/form-file';
export { AlFormColor } from './lib/components/form/form-color';
export { AlFormTags } from './lib/components/form/form-tags';
export { AlFormDuration } from './lib/components/form/form-duration';
export { AlFormCustom } from './lib/components/form/form-custom';
export { AlFormGroup } from './lib/components/form/form-group';
export { AlFormLineBreak } from './lib/components/form/form-line-break';
export { AlFormSpace } from './lib/components/form/form-space';

/** Popover / calendar building blocks (advanced). */
export { AlPopoverPanel } from './lib/components/popover/al-popover-panel';
export { AlCalendarGrid } from './lib/components/pickers/calendar-grid';
export { AlItemList } from './lib/components/pickers/item-list';
export type { AlListItem, AlListItemValue } from './lib/components/pickers/item-list';
export {
  DEFAULT_MONTHS,
  DEFAULT_WEEKDAYS,
  todayLocal,
  toDateString,
  toTimeString,
  toDateTimeString,
  parseDate,
  parseTime,
  parseDateTime,
  normalizeTime,
  normalizeDateTime,
} from './lib/utils/date-time';
export type { CalendarCell, CalendarWeek } from './lib/utils/date-time';
export {
  secondsToParts,
  partsToSeconds,
  parseDurationString,
  clampSeconds,
} from './lib/utils/duration';
export type { DurationParts } from './lib/utils/duration';

/** @advanced Layout plumbing */
export { AlFormItem } from './lib/components/layout/form-item';
export { AlFormElements } from './lib/components/layout/form-elements';
export { AlFormElementList } from './lib/components/layout/form-element-list';

export { toColumnDefs } from './lib/utils/to-column-defs';
export { warnInvalidFormSetup } from './lib/utils/validate-elements';
export { resolveFormField, unwrapMaybeSignal, unwrapFormElement } from './lib/utils/resolve-field';

/** @advanced Width helpers */
export {
  normalizeResponsiveWidth,
  parseFormWidth,
  resolveWidthForContainer,
  widthToCssVars,
  FORM_LAYOUT_BREAKPOINTS,
} from './lib/utils/layout';
