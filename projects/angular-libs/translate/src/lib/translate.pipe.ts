import { Pipe, PipeTransform, inject } from '@angular/core';
import { ALTranslate } from './translate.service';

/**
 * A standalone pipe for translating keys directly within Angular templates.
 * Operates as an impure pipe to seamlessly react to internal signal changes
 * (like language switching) without requiring manual observable subscriptions or signal unwrapping in the template.
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private translate = inject(ALTranslate);

  /**
   * Transforms a translation key into its localized string safely inside the template.
   *
   * @param key The translation dictionary key.
   * @param params Optional object of parameters to inject into the value placeholder.
   * @returns The localized string. Updates automatically when the translation language changes.
   *
   * @example
   * {{ 'TITLE_KEY' | translate }}
   * {{ 'GREETING' | translate: { name: 'Alice' } }}
   */
  transform(key: string, params?: Record<string, unknown>) {
    if (key == null) return key;
    return this.translate.get(key, params);
  }
}
