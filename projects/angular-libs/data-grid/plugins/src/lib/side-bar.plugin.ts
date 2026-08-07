import { signal, type Signal } from '@angular/core';
import type {
  SideBarConfig,
  SideBarPanelId,
} from '@angular-libs/data-grid';
import type {
  DataGridPlugin,
  DataGridPluginContext,
} from '@angular-libs/data-grid/plugin';
import { DataGridColumnsPanel } from './sidebar/columns-panel';
import { DataGridFiltersPanel } from './sidebar/filters-panel';

export type SideBarPluginOptions = boolean | SideBarConfig;

/** Held adapter — toggle chrome without tearing down other plugins. */
export interface SideBarAdapter {
  readonly enabled: Signal<boolean>;
  setEnabled(enabled: boolean): void;
}

export type SideBarPlugin<T = unknown> = DataGridPlugin<T> & SideBarAdapter;

const PANEL_META: Record<
  'columns' | 'filters',
  {
    order: number;
    component: typeof DataGridColumnsPanel | typeof DataGridFiltersPanel;
    labelKey: 'columnsPanelShortLabel' | 'filtersPanelShortLabel';
  }
> = {
  columns: { order: 10, component: DataGridColumnsPanel, labelKey: 'columnsPanelShortLabel' },
  filters: { order: 20, component: DataGridFiltersPanel, labelKey: 'filtersPanelShortLabel' },
};

/**
 * Tool-panel sidebar + built-in columns/filters panels.
 *
 * Panels register once during setup. {@link SideBarAdapter.setEnabled} only
 * toggles `sideBarConfig` — no remount / slot churn, no plugin list rebuild.
 */
export function sideBarPlugin<T = unknown>(
  options: SideBarPluginOptions = true,
): SideBarPlugin<T> {
  const initiallyOn = options !== false;
  const enabled = signal(initiallyOn);
  const config: boolean | SideBarConfig = options === false ? true : options;

  let context: DataGridPluginContext<T> | null = null;
  let clearConfig: (() => void) | null = null;
  const panelCleanups: Array<() => void> = [];

  const applyVisibility = (): void => {
    clearConfig?.();
    clearConfig = null;
    const ctx = context;
    if (!ctx || !enabled()) {
      return;
    }
    clearConfig = ctx.slots.enableSideBar(config);
  };

  return {
    id: 'sideBar',
    enabled: enabled.asReadonly(),
    setEnabled(next: boolean): void {
      if (enabled() === next) {
        return;
      }
      enabled.set(next);
      applyVisibility();
    },
    setup(ctx: DataGridPluginContext<T>): () => void {
      context = ctx;
      const locale = () => ctx.api.getLocale();

      const cfg = typeof config === 'object' ? config : null;
      const panelIds: SideBarPanelId[] =
        cfg?.panels !== undefined ? [...cfg.panels] : ['columns', 'filters'];

      for (const id of panelIds) {
        if (id === 'rowGroup') {
          // Registered by rowGroupPlugin — skip here.
          continue;
        }
        const meta = PANEL_META[id];
        if (!meta) {
          continue;
        }
        panelCleanups.push(
          ctx.slots.registerSidebar({
            id,
            label: locale()[meta.labelKey],
            order: meta.order,
            component: meta.component,
          }),
        );
      }

      applyVisibility();

      return () => {
        clearConfig?.();
        clearConfig = null;
        for (const cleanup of panelCleanups.splice(0).reverse()) {
          cleanup();
        }
        context = null;
      };
    },
  };
}
