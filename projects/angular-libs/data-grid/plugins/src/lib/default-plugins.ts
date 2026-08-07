/**
 * Held-objects DX helpers — compose plugins as values, not a `withX()` DSL.
 */

import { findPlugin, type FindPluginOptions } from './find.plugin';
import { clipboardPlugin, type ClipboardPluginOptions } from './clipboard.plugin';
import { statusBarPlugin, type StatusBarPluginOptions } from './status-bar.plugin';
import { sideBarPlugin, type SideBarPluginOptions } from './side-bar.plugin';
import type { DataGridPlugin } from '@angular-libs/data-grid/plugin';

export interface DefaultGridPluginsOptions {
  /** Default true. Pass `false` to omit, or options object. */
  find?: boolean | FindPluginOptions;
  /** Default true. */
  clipboard?: boolean | ClipboardPluginOptions;
  /** Default true. */
  statusBar?: boolean | StatusBarPluginOptions;
  /** Default true. Pass `false` to omit, or sidebar config. */
  sideBar?: boolean | SideBarPluginOptions;
}

/**
 * Standard chrome plugins most apps want (find, clipboard, status, sidebar).
 *
 * Prefer holding return values when you need adapters later:
 * ```ts
 * const groups = rowGroupPlugin({ columns: ['dept'] });
 * plugins = [...defaultGridPlugins(), groups, rowDragPlugin()];
 * groups.setColumns(['role']);
 * ```
 */
export function defaultGridPlugins<T = unknown>(
  options: DefaultGridPluginsOptions = {},
): DataGridPlugin<T>[] {
  const list: DataGridPlugin<T>[] = [];

  if (options.find !== false) {
    list.push(
      findPlugin(typeof options.find === 'object' ? options.find : {}),
    );
  }
  if (options.clipboard !== false) {
    list.push(
      clipboardPlugin(typeof options.clipboard === 'object' ? options.clipboard : {}),
    );
  }
  if (options.statusBar !== false) {
    list.push(
      statusBarPlugin(typeof options.statusBar === 'object' ? options.statusBar : {}),
    );
  }
  if (options.sideBar !== false) {
    list.push(
      sideBarPlugin(
        options.sideBar === true || options.sideBar == null ? true : options.sideBar,
      ),
    );
  }

  return list;
}
