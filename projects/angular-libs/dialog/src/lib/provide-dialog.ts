import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { DIALOG_CONFIG, type ProvideDialogConfig } from './dialog.types';

/**
 * Provides global dialog defaults at application bootstrap.
 *
 * Prefer this over imperative {@link DialogService.updateConfig} for static app config.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDialog({
 *       window: { drag: true, snap: true, dock: true },
 *       // static | Signal | () => DialogStrings
 *       strings: () => translate.dialogStrings(),
 *       // Design-system embed (optional)
 *       appearance: 'headless',
 *       scheme: false,
 *       contentClass: 'kit-dialog',
 *       tokens: {
 *         bg: 'var(--kit-color-surface)',
 *         color: 'var(--kit-color-ink)',
 *         accent: 'var(--kit-color-primary)',
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function provideDialog(config: ProvideDialogConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DIALOG_CONFIG, useValue: config }]);
}
