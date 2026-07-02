import { ALShortcutPlugin } from '../shortcut.types';

export interface ALShortcutContextGuardPlugin extends ALShortcutPlugin {
  /**
   * Set the active state of a specific context.
   */
  setContext(context: string, active: boolean): void;
  /**
   * Check if a specific context is active.
   */
  isContextActive(context: string): boolean;
  /**
   * Returns a list of all currently active context names.
   */
  getActiveContexts(): string[];
  /**
   * Add a dynamic rule that blocks or permits shortcuts based on context state.
   */
  addRule(
    context: string,
    rule: {
      type: 'allow' | 'block';
      shortcuts?: string[];
      pattern?: RegExp;
    }
  ): () => void;
}

/**
 * Functional plugin to dynamically block or allow specific shortcuts or shortcut groups
 * based on active application states (contexts) like "dialog-open", "drawing", or "editing-mode".
 */
export function contextGuardPlugin(): ALShortcutContextGuardPlugin {
  const activeContexts = new Set<string>();

  interface ContextRule {
    context: string;
    type: 'allow' | 'block';
    shortcuts?: string[];
    pattern?: RegExp;
  }

  const rules: ContextRule[] = [];

  return {
    id: 'context-guard',
    onBeforeExecute(shortcut, event, target): boolean | void {
      if (activeContexts.size === 0) {
        return; // No active contexts, proceed normally
      }

      // We normalize the incoming shortcut to match any registered rules reliably
      const normalizedShortcut = shortcut.toLowerCase().trim();

      // Check all rules for active contexts
      for (const rule of rules) {
        if (!activeContexts.has(rule.context)) {
          continue; // Rule belongs to an inactive context
        }

        const isMatch =
          rule.shortcuts?.some(s => s.toLowerCase().trim() === normalizedShortcut) ||
          rule.pattern?.test(normalizedShortcut);

        if (isMatch) {
          if (rule.type === 'block') {
            return false; // Suppress execution
          }
        } else {
          // If there's an 'allow' rule for an active context, and this shortcut doesn't match it,
          // then we should block it (strict whitelist mode!)
          if (rule.type === 'allow') {
            // Note: only block if no other rules matching this shortcut explicitly allow it.
            // Let's check if any active context 'allow' rules match this shortcut.
            const isMatchInAnyAllowRule = rules.some(r => {
              if (!activeContexts.has(r.context) || r.type !== 'allow') {
                return false;
              }
              return (
                r.shortcuts?.some(s => s.toLowerCase().trim() === normalizedShortcut) ||
                r.pattern?.test(normalizedShortcut)
              );
            });

            if (!isMatchInAnyAllowRule) {
              return false; // Suppress execution since it is not in the whitelist of active allow rules
            }
          }
        }
      }
    },
    setContext(context, active) {
      if (active) {
        activeContexts.add(context);
      } else {
        activeContexts.delete(context);
      }
    },
    isContextActive(context) {
      return activeContexts.has(context);
    },
    getActiveContexts() {
      return Array.from(activeContexts);
    },
    addRule(context, rule) {
      const entry: ContextRule = {
        context,
        type: rule.type,
        shortcuts: rule.shortcuts,
        pattern: rule.pattern,
      };

      rules.push(entry);

      return () => {
        const index = rules.indexOf(entry);
        if (index !== -1) {
          rules.splice(index, 1);
        }
      };
    },
  };
}
