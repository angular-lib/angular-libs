import { AlFormText } from '../components/form/form-text';
import { AlFormNumber } from '../components/form/form-number';
import { AlFormTextarea } from '../components/form/form-textarea';
import { AlFormCheckbox } from '../components/form/form-checkbox';
import { AlFormSelect } from '../components/form/form-select';
import { AlFormPassword } from '../components/form/form-password';
import { AlFormSearch } from '../components/form/form-search';
import { AlFormDate } from '../components/form/form-date';
import { AlFormTime } from '../components/form/form-time';
import { AlFormDateTime } from '../components/form/form-datetime';
import { AlFormRadio } from '../components/form/form-radio';
import { AlFormSwitch } from '../components/form/form-switch';
import { AlFormSlider } from '../components/form/form-slider';
import { AlFormFile } from '../components/form/form-file';
import { AlFormColor } from '../components/form/form-color';
import { AlFormTags } from '../components/form/form-tags';
import { AlFormDuration } from '../components/form/form-duration';
import { AlFormCustom } from '../components/form/form-custom';
import { AlFormGroup } from '../components/form/form-group';
import { AlFormLineBreak } from '../components/form/form-line-break';
import { AlFormSpace } from '../components/form/form-space';
import { defaultFormFieldRegistry } from './form-field-registry';

let builtInsRegistered = false;

/**
 * Register built-in form adapters on the default registry.
 * Idempotent — safe to call from `AlSignalForm` or app bootstrap.
 * Prefer this (or just rendering `<al-signal-form>`) over relying on module side effects.
 */
export function registerBuiltInFormFields(): void {
  if (builtInsRegistered) {
    return;
  }
  builtInsRegistered = true;
  defaultFormFieldRegistry.register('text', AlFormText);
  defaultFormFieldRegistry.register('number', AlFormNumber);
  defaultFormFieldRegistry.register('textarea', AlFormTextarea);
  defaultFormFieldRegistry.register('checkbox', AlFormCheckbox);
  defaultFormFieldRegistry.register('select', AlFormSelect);
  defaultFormFieldRegistry.register('password', AlFormPassword);
  defaultFormFieldRegistry.register('search', AlFormSearch);
  defaultFormFieldRegistry.register('date', AlFormDate);
  defaultFormFieldRegistry.register('time', AlFormTime);
  defaultFormFieldRegistry.register('datetime', AlFormDateTime);
  defaultFormFieldRegistry.register('radio', AlFormRadio);
  defaultFormFieldRegistry.register('switch', AlFormSwitch);
  defaultFormFieldRegistry.register('slider', AlFormSlider);
  defaultFormFieldRegistry.register('file', AlFormFile);
  defaultFormFieldRegistry.register('color', AlFormColor);
  defaultFormFieldRegistry.register('tags', AlFormTags);
  defaultFormFieldRegistry.register('duration', AlFormDuration);
  defaultFormFieldRegistry.register('custom', AlFormCustom);
  defaultFormFieldRegistry.register('group', AlFormGroup);
  defaultFormFieldRegistry.register('line-break', AlFormLineBreak);
  defaultFormFieldRegistry.register('space', AlFormSpace);
}

/** @internal Test helper to re-register after registry resets. */
export function resetBuiltInFormFieldsForTests(): void {
  builtInsRegistered = false;
}
