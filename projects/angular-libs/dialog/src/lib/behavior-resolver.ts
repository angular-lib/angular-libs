import type { DialogPlugin } from './dialog.types';
import type { WindowBehaviorOptions } from './dialog.types';
import { draggablePlugin, type DraggablePluginOptions } from './plugins/draggable.plugin';
import { tileSnappingPlugin, type TileSnappingOptions } from './plugins/tile-snapping.plugin';
import { snapToEdgePlugin } from './plugins/snap-to-edge.plugin';
import { dockPlugin, type DockPluginOptions } from './plugins/dock.plugin';
import {
  layoutPersistencePlugin,
  type LayoutPersistenceOptions,
} from './plugins/layout-persistence.plugin';

export type BehaviorFlag<T> = boolean | T | undefined;

/**
 * Resolves declarative window behavior flags into built-in plugins.
 *
 * - `true` / object → enable with options
 * - `false` → omit (and strip matching ids from the plugin list later)
 * - `undefined` → use `defaults` when provided
 */
export function resolveBehaviorPlugins(
  behaviors: WindowBehaviorOptions = {},
  defaults: WindowBehaviorOptions = {},
  persistDefaults?: LayoutPersistenceOptions,
  dialogId?: string,
): { plugins: DialogPlugin[]; disabledIds: Set<string> } {
  const plugins: DialogPlugin[] = [];
  const disabledIds = new Set<string>();

  const drag = resolveFlag(behaviors.drag, defaults.drag);
  if (drag === false) {
    disabledIds.add('draggable');
  } else if (drag) {
    plugins.push(draggablePlugin((drag === true ? {} : drag) as DraggablePluginOptions));
  }

  const snap = resolveFlag(behaviors.snap, defaults.snap);
  if (snap === false) {
    disabledIds.add('tile-snapping');
    disabledIds.add('snap-to-edge');
  } else if (snap) {
    const snapOpts: TileSnappingOptions = (snap === true ? {} : snap) as TileSnappingOptions;
    plugins.push(tileSnappingPlugin(snapOpts));
    plugins.push(snapToEdgePlugin());
  }

  const dock = resolveFlag(behaviors.dock, defaults.dock);
  if (dock === false) {
    disabledIds.add('dock');
  } else if (dock) {
    plugins.push(dockPlugin((dock === true ? {} : dock) as DockPluginOptions));
  }

  const persist = resolveFlag(behaviors.persist, defaults.persist);
  if (persist === false) {
    disabledIds.add('layout-persistence');
  } else if (persist) {
    const opts: LayoutPersistenceOptions =
      persist === true
        ? { ...persistDefaults, key: persistDefaults?.key ?? dialogId }
        : ({ ...persistDefaults, ...(persist as LayoutPersistenceOptions) } as LayoutPersistenceOptions);
    if (opts.key || opts.save || opts.restore || dialogId) {
      if (!opts.key && dialogId) {
        opts.key = dialogId;
      }
      plugins.push(layoutPersistencePlugin(opts));
    }
  }

  return { plugins, disabledIds };
}

function resolveFlag<T>(
  value: BehaviorFlag<T>,
  fallback: BehaviorFlag<T>,
): false | true | T | undefined {
  if (value === false) return false;
  if (value === undefined) {
    if (fallback === false) return false;
    if (fallback === undefined) return undefined;
    return fallback === true ? true : fallback;
  }
  return value === true ? true : value;
}

/**
 * Merges plugin lists (global → behavior → per-open), dedupes by id (last wins),
 * and drops ids explicitly disabled by declarative `false` flags.
 */
export function mergePlugins(
  ...groups: Array<{ plugins?: DialogPlugin[]; disabledIds?: Set<string> } | DialogPlugin[] | undefined>
): DialogPlugin[] {
  const disabledIds = new Set<string>();
  const raw: DialogPlugin[] = [];

  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) {
      raw.push(...group);
      continue;
    }
    group.disabledIds?.forEach((id) => disabledIds.add(id));
    if (group.plugins) {
      raw.push(...group.plugins);
    }
  }

  const filtered = raw.filter((p) => !p.id || !disabledIds.has(p.id));

  const seen = new Set<string>();
  return [...filtered]
    .reverse()
    .filter((p) => {
      if (!p.id) return true;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .reverse();
}

/** @internal Exported for typing convenience in options. */
export type { DraggablePluginOptions, TileSnappingOptions, DockPluginOptions, LayoutPersistenceOptions };
