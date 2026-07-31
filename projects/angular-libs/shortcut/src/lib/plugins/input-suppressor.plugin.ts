import { ALShortcutPlugin } from '../shortcut.types';

/**
 * Functional plugin to ignore shortcuts when user is focused inside an editable field.
 */
export function inputSuppressorPlugin(exceptions: string[] = []): ALShortcutPlugin {
  return {
    id: 'input-suppressor',
    onBeforeExecute(shortcut: string, event: KeyboardEvent, target: Element | null): boolean | void {
      if (exceptions.includes(shortcut)) {
        return; // Allow executing this exception shortcut regardless
      }
      if (!target) return;

      const tagName = target.tagName.toUpperCase();
      const isContentEditable = (target as HTMLElement).isContentEditable === true;

      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        isContentEditable
      ) {
        return false; // Suppress execution
      }
    },
  };
}
