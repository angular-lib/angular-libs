import { InjectionToken } from '@angular/core';

/**
 * Action registration config configuration object.
 */
export interface ALShortcutConfig {
  /**
   * The shortcut representation string (e.g., "ctrl+s", "shift+meta+k", "mod+s").
   */
  shortcut: string;
  /**
   * Code block executed when key combination triggers.
   */
  action: (event: KeyboardEvent) => void;
  /**
   * Bind focus/trigger evaluation to a specific DOM bounds.
   */
  element?: HTMLElement | Document | Window;
  /**
   * Precedence level of custom registrations (highest executed first).
   */
  priority?: number;
  /**
   * Optional custom narrative description.
   */
  description?: string;
  /**
   * Optional stable identifier for programmatic lookup / trigger.
   */
  id?: string;
  /**
   * Optional group/category label (e.g. for palette filtering).
   */
  group?: string;
  /**
   * Whether to automatically prevent default browser action when executed. Defaults to true.
   */
  preventDefault?: boolean;
  /**
   * Whether to call `event.stopPropagation()` when executed. Defaults to false.
   */
  stopPropagation?: boolean;
  /**
   * Whether to call `event.stopImmediatePropagation()` when executed. Defaults to false.
   */
  stopImmediatePropagation?: boolean;
  /**
   * Whether to allow keypress auto-repeat events when holding keys. Defaults to false.
   */
  allowRepeat?: boolean;
  /**
   * The trigger timing phase event for the callback executor. Defaults to 'keydown'.
   */
  type?: 'keydown' | 'keyup';
  /**
   * If provided and returns false, the shortcut is skipped for this event.
   */
  when?: () => boolean;
}

/**
 * Descriptor returned by {@link ALShortcutHost.getShortcuts}.
 */
export interface ALShortcutDescriptor {
  shortcut: string;
  defaultShortcut: string;
  priority: number;
  hasElementScope: boolean;
  description?: string;
  id?: string;
  group?: string;
  type: 'keydown' | 'keyup';
}

/**
 * Conflict entry from {@link ALShortcutHost.getConflicts}.
 */
export interface ALShortcutConflict {
  shortcut: string;
  count: number;
  descriptions: (string | undefined)[];
}

/**
 * Narrow host surface passed to plugins (avoids coupling to the concrete service class).
 */
export interface ALShortcutHost {
  readonly document: Document | null;
  register(config: ALShortcutConfig | ALShortcutConfig[]): () => void;
  getShortcuts(): ALShortcutDescriptor[];
  getConflicts(): ALShortcutConflict[];
  trigger(
    target: string | Partial<ALShortcutDescriptor>,
    customEvent?: KeyboardEvent
  ): boolean;
  getLayoutMap(): ReadonlyMap<string, string> | null;
  normaliseShortcut(shortcut: string): string;
  formatShortcut(shortcut: string): string;
}

/**
 * Interface that all shortcut plugins must implement.
 *
 * Plugin hooks (`onBeforeExecute`, `onResolveShortcut`, `onKeyEvent`, …) run in
 * **registration order**. Prefer a stable {@link ALShortcutPlugin.id} so
 * `getPlugin` / `unregisterPlugin` work. `unregisterPlugin` calls `onDestroy`;
 * plugins must unsubscribe any shortcuts they registered themselves.
 */
export interface ALShortcutPlugin {
  /**
   * Optional identifier for the plugin.
   */
  id?: string;

  /**
   * Called when registering the plugin.
   */
  onInit?(host: ALShortcutHost): void;

  /**
   * Hook called before a shortcut is executed.
   * If it returns `false`, execution is cancelled.
   */
  onBeforeExecute?(shortcut: string, event: KeyboardEvent, target: Element | null): boolean | void;

  /**
   * Hook called after a shortcut is successfully executed.
   */
  onAfterExecute?(shortcut: string, event: KeyboardEvent, target: Element | null): void;

  /**
   * Hook called when the plugin is removed/destroyed.
   */
  onDestroy?(): void;

  /**
   * Hook called to resolve the pressed shortcut key combination.
   */
  onResolveShortcut?(shortcut: string, event: KeyboardEvent): string | void;

  /**
   * Hook called to customize the display string representation of a shortcut combination.
   */
  onGetDisplayShortcut?(shortcut: string): string | void;

  /**
   * Hook called for every native key event on the document (keydown and keyup).
   * Return `true` to mark the event as consumed and skip core shortcut dispatch.
   */
  onKeyEvent?(event: KeyboardEvent): boolean | void;
}

/**
 * Bootstrap config for {@link provideShortcut}.
 */
export interface ProvideShortcutConfig {
  /**
   * Plugins registered once when the root service is constructed (array order = hook order).
   */
  plugins?: ALShortcutPlugin[];
}

export const SHORTCUT_CONFIG = new InjectionToken<ProvideShortcutConfig>('SHORTCUT_CONFIG');
