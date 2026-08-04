import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { SHORTCUT_CONFIG, type ProvideShortcutConfig } from './shortcut.types';

/**
 * Provides optional shortcut bootstrap config (e.g. plugins) at application start.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideShortcut({
 *       plugins: [inputSuppressorPlugin(['escape'])],
 *     }),
 *   ],
 * });
 * ```
 */
export function provideShortcut(config: ProvideShortcutConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SHORTCUT_CONFIG, useValue: config }]);
}
