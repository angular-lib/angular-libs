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
 * One instance may serve several grids (e.g. `detailGrid.plugins`): state is
 * per grid and `setEnabled` applies to every attached grid.
 * Panel ids other than `columns` / `filters` are registered by their own
 * plugins (e.g. `rowGroupPlugin` adds `rowGroup`).
 */
export function sideBarPlugin<T = unknown>(
  options: SideBarPluginOptions = true,
): SideBarPlugin<T> {
  const initiallyOn = options !== false;
  const enabled = signal(initiallyOn);
  const config: boolean | SideBarConfig = options === false ? true : options;

  /** Per attached grid: its context + the `enableSideBar` cleanup while shown. */
  const grids = new Map<DataGridPluginContext<T>, { clearConfig: (() => void) | null }>();

  const applyVisibility = (
    ctx: DataGridPluginContext<T>,
    state: { clearConfig: (() => void) | null },
  ): void => {
    state.clearConfig?.();
    state.clearConfig = enabled() ? ctx.slots.enableSideBar(config) : null;
  };

  return {
    id: 'sideBar',
    enabled: enabled.asReadonly(),
    setEnabled(next: boolean): void {
      if (enabled() === next) {
        return;
      }
      enabled.set(next);
      for (const [ctx, state] of grids) {
        applyVisibility(ctx, state);
      }
    },
    setup(ctx: DataGridPluginContext<T>): () => void {
      const locale = () => ctx.api.getLocale();
      const state = { clearConfig: null as (() => void) | null };
      grids.set(ctx, state);

      const cfg = typeof config === 'object' ? config : null;
      const panelIds: SideBarPanelId[] =
        cfg?.panels !== undefined ? [...cfg.panels] : ['columns', 'filters'];
      const panelCleanups: Array<() => void> = [];

      for (const id of panelIds) {
        const meta = PANEL_META[id as keyof typeof PANEL_META];
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

      applyVisibility(ctx, state);

      return () => {
        state.clearConfig?.();
        state.clearConfig = null;
        for (const cleanup of panelCleanups.splice(0).reverse()) {
          cleanup();
        }
        grids.delete(ctx);
      };
    },
  };
}
