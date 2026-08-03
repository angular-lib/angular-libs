import type { DialogPlugin } from './dialog.types';

/**
 * Typed helper for authoring custom dialog plugins.
 *
 * Prefer this over a bare object literal for clearer typing and docs.
 *
 * @example
 * ```ts
 * definePlugin({
 *   id: 'auto-focus',
 *   onOpen({ element }) {
 *     element.querySelector('input')?.focus();
 *   },
 * });
 * ```
 */
export function definePlugin<TComponent = any>(
  plugin: DialogPlugin<TComponent>,
): DialogPlugin<TComponent> {
  return plugin;
}
