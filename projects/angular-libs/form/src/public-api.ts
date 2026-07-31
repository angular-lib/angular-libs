/*
 * Public API Surface of @angular-libs/form
 *
 * Supported surface (documented in README):
 * - createForm / FormController / seedSelection / clearSelection
 * - factories + formFactories / formRow / FORM_WIDTHS
 * - AlSignalForm + provideFormFields / registerBuiltInFormFields
 * - AlField / AlFieldShell / AlControlChrome (custom field authors)
 * - Built-in field components (for provideFormFields overrides)
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
  FormSelectProps,
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

/** Built-in fields — export for `provideFormFields` overrides / custom composition. */
export { AlTextField } from './lib/components/fields/text-field';
export { AlNumberField } from './lib/components/fields/number-field';
export { AlTextareaField } from './lib/components/fields/textarea-field';
export { AlCheckboxField } from './lib/components/fields/checkbox-field';
export { AlSelectField } from './lib/components/fields/select-field';
export { AlPasswordField } from './lib/components/fields/password-field';
export { AlSearchField } from './lib/components/fields/search-field';
export { AlCustomField } from './lib/components/fields/custom-field';
export { AlGroupField } from './lib/components/fields/group-field';
export { AlLineBreakField } from './lib/components/fields/line-break-field';
export { AlSpaceField } from './lib/components/fields/space-field';

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
