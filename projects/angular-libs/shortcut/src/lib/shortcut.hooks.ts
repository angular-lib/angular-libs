import { inject, DestroyRef } from '@angular/core';
import { ALShortcutService } from './shortcut.service';
import { ALShortcutConfig } from './shortcut.types';

/**
 * Highly declarative, functional hook helper to register shortcuts with absolute zero boilerplate.
 * Automatically handles target binding contexts, execution priorities, and reliable native cleanups.
 * 
 * **DX Benefits:**
 * - Implements a clean functional hook composition format (Approach 3).
 * - Avoids class extending and manual Injection Tokens inside components.
 * - Automatically injects `ALShortcutService` and registers component `DestroyRef` to prevent memory leaks.
 * 
 * @param shortcut Key binding pattern sequence (e.g. 'ctrl+s', 'shift+space').
 * @param action Trigger callback function when keys match.
 * @param config Optional parameters for customizing listeners (element scopes, priority orders, overrides).
 * @returns Manual cleanup function in case you need early unregistration before destroy phases.
 * 
 * @example
 * ```typescript
 * @Component({ ... })
 * export class FileWorkspaceComponent {
 *   constructor() {
 *     // Beautiful 1-line hook setup - automatically unbinds when Component is destroyed!
 *     onShortcut('ctrl+s', () => this.saveDocument(), { description: 'Save current workspace document.' });
 *   }
 * }
 * ```
 */
export function onShortcut(
  shortcut: string,
  action: (event: KeyboardEvent) => void,
  config?: Omit<ALShortcutConfig, 'shortcut' | 'action'>
): () => void {
  const unsubscribe = inject(ALShortcutService).register({
    ...config,
    shortcut,
    action,
  });

  inject(DestroyRef).onDestroy(unsubscribe);

  return unsubscribe;
}
