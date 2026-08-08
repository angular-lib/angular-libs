import { AlTextField } from '../components/fields/text-field';
import { AlNumberField } from '../components/fields/number-field';
import { AlTextareaField } from '../components/fields/textarea-field';
import { AlCheckboxField } from '../components/fields/checkbox-field';
import { AlSelectField } from '../components/fields/select-field';
import { AlPasswordField } from '../components/fields/password-field';
import { AlSearchField } from '../components/fields/search-field';
import { AlDateField } from '../components/fields/date-field';
import { AlTimeField } from '../components/fields/time-field';
import { AlDateTimeField } from '../components/fields/datetime-field';
import { AlCustomField } from '../components/fields/custom-field';
import { AlGroupField } from '../components/fields/group-field';
import { AlLineBreakField } from '../components/fields/line-break-field';
import { AlSpaceField } from '../components/fields/space-field';
import { defaultFormFieldRegistry } from './form-field-registry';

let builtInsRegistered = false;

/**
 * Register built-in plain HTML field components on the default registry.
 * Idempotent — safe to call from `AlSignalForm` or app bootstrap.
 * Prefer this (or just rendering `<al-signal-form>`) over relying on module side effects.
 */
export function registerBuiltInFormFields(): void {
  if (builtInsRegistered) {
    return;
  }
  builtInsRegistered = true;
  defaultFormFieldRegistry.register('text', AlTextField);
  defaultFormFieldRegistry.register('number', AlNumberField);
  defaultFormFieldRegistry.register('textarea', AlTextareaField);
  defaultFormFieldRegistry.register('checkbox', AlCheckboxField);
  defaultFormFieldRegistry.register('select', AlSelectField);
  defaultFormFieldRegistry.register('password', AlPasswordField);
  defaultFormFieldRegistry.register('search', AlSearchField);
  defaultFormFieldRegistry.register('date', AlDateField);
  defaultFormFieldRegistry.register('time', AlTimeField);
  defaultFormFieldRegistry.register('datetime', AlDateTimeField);
  defaultFormFieldRegistry.register('custom', AlCustomField);
  defaultFormFieldRegistry.register('group', AlGroupField);
  defaultFormFieldRegistry.register('line-break', AlLineBreakField);
  defaultFormFieldRegistry.register('space', AlSpaceField);
}

/** @internal Test helper to re-register after registry resets. */
export function resetBuiltInFormFieldsForTests(): void {
  builtInsRegistered = false;
}
