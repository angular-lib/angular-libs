import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import { draggablePlugin, type DraggablePluginOptions } from './draggable.plugin';
import { tileSnappingPlugin, type TileSnappingOptions } from './tile-snapping.plugin';
import { dockPlugin, type DockPluginOptions } from './dock.plugin';

export interface WindowManagerPluginOptions {
  /**
   * Configuration options for dragging.
   * If `false`, dragging is disabled. Defaults to `{}` (enabled).
   */
  draggable?: boolean | DraggablePluginOptions;
  /**
   * Configuration options for the virtual macro snapping grid.
   * If `false`, snapping is disabled. Defaults to `{}` (enabled).
   */
  snapping?: boolean | TileSnappingOptions;
  /**
   * Configuration options for docking minimized dialogs in a taskbar.
   * If `false`, docking is disabled. Defaults to `{}` (enabled).
   */
  dock?: boolean | DockPluginOptions;
}

/**
 * A composite plugin that unifies all modeless/non-modal workspace window actions:
 * 1. Pointer dragging boundaries and boundary layouts via {@link draggablePlugin}.
 * 2. Visual macOS-inspired Alt/Option + S virtual snapping grids via {@link tileSnappingPlugin}.
 * 3. Bottom docking taskbars and autohide mechanisms via {@link dockPlugin}.
 *
 * Implements the Composite Design Pattern, letting developers easily deploy a full OS-like floating window
 * layout using a single import (maximizing DX/convenience) while still allowing maximum modularity and
 * tree-shakable performance on lighter environments.
 *
 * @example
 * ```ts
 * import { windowManagerPlugin } from '@angular-libs/dialog';
 * 
 * dialogService.open(ChatComponent, {
 *   modal: false,
 *   plugins: [windowManagerPlugin({ dock: { autoHide: true } })]
 * });
 * ```
 */
export function windowManagerPlugin(options: WindowManagerPluginOptions = {}): DialogPlugin {
  const plugins: DialogPlugin[] = [];

  if (options.draggable !== false) {
    const dragOpts = typeof options.draggable === 'object' ? options.draggable : {};
    plugins.push(draggablePlugin(dragOpts));
  }

  if (options.snapping !== false) {
    const snapOpts = typeof options.snapping === 'object' ? options.snapping : {};
    plugins.push(tileSnappingPlugin(snapOpts));
  }

  if (options.dock !== false) {
    const dockOpts = typeof options.dock === 'object' ? options.dock : {};
    plugins.push(dockPlugin(dockOpts));
  }

  return {
    id: 'window-manager',
    setup(context: DialogPluginContext<any, any>) {
      const teardowns = plugins.map((p) => p.setup?.(context));
      return () => {
        teardowns.forEach((cleanup) => cleanup?.());
      };
    },
    onOpen(event) {
      plugins.forEach((p) => p.onOpen?.(event));
    },
    async beforeClose(event) {
      for (const p of plugins) {
        if (p.beforeClose) {
          const result = await p.beforeClose(event);
          if (result === false) return false;
        }
      }
      return true;
    },
    onClose(event) {
      plugins.forEach((p) => p.onClose?.(event));
    },
    onLayoutChange(event) {
      plugins.forEach((p) => p.onLayoutChange?.(event));
    },
  };
}
