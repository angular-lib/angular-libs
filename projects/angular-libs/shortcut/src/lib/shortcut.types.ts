import { ALShortcutService } from './shortcut.service';

/**
 * Action registration config configuration object.
 */
export interface ALShortcutConfig {
  /**
   * The shortcut representation string (e.g., "ctrl+s", "shift+meta+k").
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
   * Whether to automatically prevent default browser action when executed. Defaults to true.
   */
  preventDefault?: boolean;
  /**
   * Whether to allow keypress auto-repeat events when holding keys. Defaults to false.
   */
  allowRepeat?: boolean;
  /**
   * The trigger timing phase event for the callback executor. Defaults to 'keydown'.
   */
  type?: 'keydown' | 'keyup';
}

/**
 * Interface that all shortcut plugins must implement.
 */
export interface ALShortcutPlugin {
  /**
   * Optional identifier for the plugin.
   */
  id?: string;

  /**
   * Called when registering the plugin.
   */
  onInit?(service: ALShortcutService): void;

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
