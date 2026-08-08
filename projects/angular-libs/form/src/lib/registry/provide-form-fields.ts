import { InjectionToken, type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import type { Type } from '@angular/core';
import type { FormElementType } from '../types';
import { FormFieldRegistry, defaultFormFieldRegistry } from './form-field-registry';
import { registerBuiltInFormFields } from './register-built-ins';

export const FORM_FIELD_REGISTRY = new InjectionToken<FormFieldRegistry>('FORM_FIELD_REGISTRY', {
  factory: () => {
    registerBuiltInFormFields();
    return defaultFormFieldRegistry;
  },
});

/**
 * Register / replace field components for element types (app-wide).
 * Ensures built-ins are registered first, then applies your overrides/additions.
 *
 * @example Swap select
 * ```ts
 * provideFormFields({ select: MyFormSelect })
 * ```
 *
 * @example Override date field
 * ```ts
 * provideFormFields({ date: MyFormDate })
 * ```
 */
export function provideFormFields(
  map: Partial<Record<FormElementType | (string & {}), Type<unknown>>> = {},
): EnvironmentProviders {
  const providers: Provider[] = [
    {
      provide: FORM_FIELD_REGISTRY,
      useFactory: () => {
        registerBuiltInFormFields();
        const registry = new FormFieldRegistry(defaultFormFieldRegistry);
        for (const [type, component] of Object.entries(map)) {
          if (component) {
            registry.register(type, component);
          }
        }
        return registry;
      },
    },
  ];
  return makeEnvironmentProviders(providers);
}
