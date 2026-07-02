import { signal } from '@angular/core';
import { ALShortcutPlugin } from '../shortcut.types';
import { ALShortcutService } from '../shortcut.service';

export interface ALShortcutVisualHintsPlugin extends ALShortcutPlugin {
  readonly isActive: () => boolean;
  startHinting(): void;
  stopHinting(): void;
}

/**
 * Functional plugin supporting Vimium-style visual link hinting.
 * When activated, overlays unique key hints (e.g. "A", "S", "JK") over all visible clickable elements.
 * Typing the matched hint triggers a native click/focus on that element.
 */
export function visualHintsPlugin(
  config: {
    triggerShortcut?: string;
    preventDefault?: boolean;
    hintCharacters?: string;
  } = {}
): ALShortcutVisualHintsPlugin {
  const isActive = signal(false);
  let serviceRef: ALShortcutService | null = null;
  let unsubTrigger: (() => void) | null = null;
  let containerEl: HTMLElement | null = null;
  let keyboardListener: ((e: KeyboardEvent) => void) | null = null;
  let currentTyped = '';

  const triggerKey = config.triggerShortcut || 'ctrl+g';
  const hintChars = config.hintCharacters || 'asdfjklgh';

  interface TargetElement {
    element: HTMLElement;
    hint: string;
    markerEl: HTMLElement;
  }

  let mappedTargets: TargetElement[] = [];
  let scrollListener: (() => void) | null = null;

  function generateHintStrings(count: number): string[] {
    const chars = hintChars.toLowerCase();
    const len = chars.length;
    const result: string[] = [];

    // Single-character hints
    if (count <= len) {
      for (let i = 0; i < count; i++) {
        result.push(chars[i]);
      }
      return result;
    }

    // Two-character hints
    let charIndex = 0;
    let prefixIndex = 0;
    while (result.length < count && prefixIndex < len) {
      const prefix = chars[prefixIndex];
      const suffix = chars[charIndex];
      result.push(prefix + suffix);

      charIndex++;
      if (charIndex === len) {
        charIndex = 0;
        prefixIndex++;
      }
    }

    return result;
  }

  function isVisibleInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
      return false;
    }

    // Check if within viewport boundaries
    return (
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  }

  function startHinting(): void {
    const doc = serviceRef?.document || (typeof document !== 'undefined' ? document : null);
    if (typeof window === 'undefined' || !doc || isActive()) {
      return;
    }

    isActive.set(true);
    currentTyped = '';

    // Find clickable nodes
    const query = 'a, button, input, select, textarea, [role="button"], [tabindex], .clickable';
    const rawElements = Array.from(doc.querySelectorAll(query)) as HTMLElement[];
    const visibleElements = rawElements.filter(el => isVisibleInViewport(el));

    if (visibleElements.length === 0) {
      stopHinting();
      return;
    }

    // Create container
    containerEl = doc.createElement('div');
    containerEl.id = 'al-link-hint-container';
    doc.body.appendChild(containerEl);

    const styleMarkup = `
      <style>
        .al-hint-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.12); z-index: 999999; pointer-events: none; }
        .al-hint-label { position: fixed; background: #facc15; color: #0f172a; border: 1px solid #eab308; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 800; padding: 2px 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-transform: uppercase; line-height: 1; z-index: 1000000; animation: alHintBounceIn 0.1s ease-out; pointer-events: auto; transform: translate(-50%, -50%); cursor: pointer; }
        .al-hint-match { color: #dc2626; }
        @keyframes alHintBounceIn {
          from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      </style>
    `;

    const hintStrings = generateHintStrings(visibleElements.length);
    mappedTargets = visibleElements.map((el, i) => {
      const hint = hintStrings[i] || `X${i}`;
      const rect = el.getBoundingClientRect();

      const marker = doc.createElement('span');
      marker.className = 'al-hint-label';
      marker.style.top = `${rect.top + rect.height / 2}px`;
      marker.style.left = `${rect.left + rect.width / 2}px`;
      marker.innerHTML = hint;

      containerEl?.appendChild(marker);

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        el.click();
        el.focus();
        stopHinting();
      });

      return {
        element: el,
        hint,
        markerEl: marker
      };
    });

    const backdrop = document.createElement('div');
    backdrop.className = 'al-hint-backdrop';
    containerEl.appendChild(backdrop);
    containerEl.appendChild(document.createRange().createContextualFragment(styleMarkup));

    keyboardListener = (e: KeyboardEvent) => handleHintKey(e);
    doc.addEventListener('keydown', keyboardListener, true);

    // Setup auto-close hooks on viewport changes (industry standard, like Vimium)
    scrollListener = () => {
      stopHinting();
    };
    window.addEventListener('scroll', scrollListener, { capture: true, passive: true });
    window.addEventListener('resize', scrollListener, { capture: true, passive: true });
  }

  function handleHintKey(e: KeyboardEvent): void {
    if (!isActive()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopHinting();
      return;
    }

    const key = e.key.toLowerCase();
    
    // Ignore trigger modifications / actions
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (hintChars.toLowerCase().includes(key)) {
      e.preventDefault();
      e.stopPropagation();

      currentTyped += key;
      let matches = 0;
      let perfectMatch: TargetElement | null = null;

      mappedTargets.forEach(target => {
        if (target.hint.startsWith(currentTyped)) {
          matches++;
          if (target.hint === currentTyped) {
            perfectMatch = target;
          }
          // Highlight typed part
          const matchingPart = target.hint.substring(0, currentTyped.length);
          const remainingPart = target.hint.substring(currentTyped.length);
          target.markerEl.innerHTML = `<span class="al-hint-match">${matchingPart.toUpperCase()}</span>${remainingPart.toUpperCase()}`;
        } else {
          // Hide non-matching hints
          target.markerEl.style.opacity = '0.15';
        }
      });

      if (perfectMatch as any) {
        const targetEl = (perfectMatch as any).element as HTMLElement;
        targetEl.click();
        targetEl.focus();
        stopHinting();
      } else if (matches === 0) {
        // Clear typo/backtrack typing buffer
        currentTyped = '';
        mappedTargets.forEach(target => {
          target.markerEl.style.opacity = '1';
          target.markerEl.innerHTML = target.hint.toUpperCase();
        });
      }
    }
  }

  function stopHinting(): void {
    const doc = serviceRef?.document || (typeof document !== 'undefined' ? document : null);
    if (typeof window === 'undefined' || !isActive()) {
      return;
    }

    isActive.set(false);
    currentTyped = '';
    mappedTargets = [];

    if (containerEl) {
      containerEl.remove();
      containerEl = null;
    }

    if (keyboardListener && doc) {
      doc.removeEventListener('keydown', keyboardListener, true);
      keyboardListener = null;
    }

    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener, true);
      window.removeEventListener('resize', scrollListener, true);
      scrollListener = null;
    }
  }

  return {
    id: 'visual-hints',
    isActive: isActive.asReadonly(),
    startHinting,
    stopHinting,
    onInit(service) {
      serviceRef = service;
      unsubTrigger = service.register({
        shortcut: triggerKey,
        action: () => {
          if (isActive()) {
            stopHinting();
          } else {
            startHinting();
          }
        },
        preventDefault: config.preventDefault ?? true,
        description: 'Toggle Link Navigation Hinting Mode'
      });
    },
    onDestroy() {
      unsubTrigger?.();
      stopHinting();
    }
  };
}
