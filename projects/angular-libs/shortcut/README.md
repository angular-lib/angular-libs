# @angular-libs/shortcut

A highly simplified, zoneless, signal/action-based keyboard shortcut manager for Angular. It is fully SSR-safe, utilizes native DOM event listeners, offers premium physical-layout physical translation mapping (W3C Map & fallback macOS Option keys protection), and includes an powerful extensible functional plugin system.

## Key Features

*   **Zoneless-ready native bindings:** Direct capture-phase document listeners keep Angular change detection overhead-free.
*   **W3C Keyboard Map & physical-keys translation:** Automatically resolves keyboard layouts dynamically (via `navigator.keyboard.getLayoutMap()`) with fallback matching on un-supported environments. Prevents Option/Alt layout character displacement issues (e.g. on macOS).
*   **Extensible Functional Plugins:** Built-in support for input suppression, modal contexts, visual link-hinting ("Vimium"-style), multi-key chords, double-keypress modifier triggers, command palette UI overlays, and run-time key rebinding.
*   **Modern Declarative API:** Features robust Angular signal input-matching logic and reactive teardowns.

---

## Installation & Setup

Simply inject `ALShortcutService` or use the declarative `ALShortcutDirective` inside your standalone components.

```typescript
import { Component, inject } from '@angular/core';
import { ALShortcutService } from '@angular-libs/shortcut';

@Component({
  standalone: true,
  template: `<!-- Template HTML -->`
})
export class MyComponent {
  private shortcutService = inject(ALShortcutService);

  constructor() {
    // Programmatic Registration
    const unsubscribe = this.shortcutService.register({
      shortcut: 'ctrl+s',
      action: (event) => {
        console.log('Saved!', event);
      },
      description: 'Trigger a document save',
      priority: 10
    });
  }
}
```

---

## Declarative Directives Usage (`[alShortcut]`)

Import `ALShortcutDirective` to declare shortcut bindings directly in component templates.

```typescript
import { Component } from '@angular/core';
import { ALShortcutDirective } from '@angular-libs/shortcut';

@Component({
  standalone: true,
  imports: [ALShortcutDirective],
  template: `
    <!-- Local Scoped: triggers only when active focus is inside or on the div element -->
    <div [alShortcut]="'ctrl+f'" (alShortcutTriggered)="focusSearch()">
      Search Component...
    </div>

    <!-- Global Scoped: triggers anywhere on the document -->
    <button [alShortcut]="'escape'" [alShortcutGlobal]="true" (alShortcutTriggered)="closeAll()">
      Close All Views
    </button>
  `
})
export class MyComponent {
  focusSearch() { /* ... */ }
  closeAll() { /* ... */ }
}
```

### Directive API Reference
*   `[alShortcut]` (`string`): The shortcut combination (e.g. `'ctrl+s'`, `'cmd+s'`, `'esc'`). Synonyms are normalised: `cmd`/`command` → `meta`, `esc` → `escape`, `option` → `alt`, `control`/`ctl` → `ctrl`. **Required**.
*   `[alShortcutPriority]` (`number`, default `0`): The execution precedence level of custom registrations.
*   `[alShortcutDescription]` (`string`): Narrative metadata details for programmatic inspection or palette registry.
*   `[alShortcutPreventDefault]` (`boolean`, default `true`): Automatically invoke `event.preventDefault()` on activation.
*   `[alShortcutAllowRepeat]` (`boolean`, default `false`): Permit repeating keyboard triggers when action/key is held down.
*   `[alShortcutGlobal]` (`boolean`, default `false`): When enabled, binds directly as a global keybind instead of scoping triggers to local element focus containment.
*   `(alShortcutTriggered)` (`KeyboardEvent`): Emits whenever the key combo matches.

---

## Powerful Built-in Plugins

Register professional UX plugins directly onto the shortcut service:

### 1. Form Input Suppressor Plugin
Ignores shortcut triggers when focused inside inputs, textareas, selects, or elements that are **actually** content-editable (`HTMLElement.isContentEditable === true`). `contenteditable="false"` does **not** suppress.
```typescript
import { inputSuppressorPlugin } from '@angular-libs/shortcut';

// Skip exceptions (e.g. allow 'esc' or 'ctrl+s' inside inputs)
shortcutService.registerPlugin(inputSuppressorPlugin(['escape', 'ctrl+s']));
```

### 2. Multi-Key Chord Plugin
Supports Vim-style or VS-Code style sequential multi-key chords (e.g. `"g d"` or `"ctrl+k ctrl+c"`).

A **completed** chord consumes the key event so the matching single-key shortcut (if any) does not also fire. **Partial** chord prefixes (e.g. pressing `g` while waiting for `d`) do **not** block other registered shortcuts on that key — avoid registering the same key as both a chord step and a standalone shortcut if you need exclusive behavior.
```typescript
import { chordPlugin } from '@angular-libs/shortcut';

const chords = shortcutService.registerPlugin(chordPlugin({ timeoutMs: 1000 }));
chords.register('g d', (ev) => {
  console.log('Navigated to definition!');
}, { description: 'Go to Definition' });
```

### 3. Double-Press Trigger Plugin
Supports rapid-tap actions, such as double-pressing Shift or Control.
```typescript
import { twicePlugin } from '@angular-libs/shortcut';

const dub = shortcutService.registerPlugin(twicePlugin({ delayMs: 400 }));
dub.register('shift', () => {
  console.log('Double Shift tapped!');
}, { description: 'Activate overlay console' });
```

### 4. Interactive Command Palette Plugin
Injects an interactive UI backdrop in the DOM that allows searching and triggering active registrations with mouse, keyboard arrows, and a customizable keyword search bar.
```typescript
import { commandPalettePlugin } from '@angular-libs/shortcut';

const palette = shortcutService.registerPlugin(commandPalettePlugin({
  triggerShortcut: 'ctrl+shift+p',
  placeholder: 'Type a command to search shortcuts...'
}));

// Manually operate
palette.open();
palette.close();
```

### 5. Context Guard / Whitelisting Plugin
Controls permission matrices or limits active key execution during transient modal scopes or full screen editing modes.
```typescript
import { contextGuardPlugin } from '@angular-libs/shortcut';

const guard = shortcutService.registerPlugin(contextGuardPlugin());
guard.addRule('dialog-open', { type: 'block', shortcuts: ['ctrl+s', 'ctrl+p'] });

// Toggle context
guard.setContext('dialog-open', true); // Blocks ctrl+s and ctrl+p
```

### 6. Dynamic Rebinding Plugin
Monkey-patches shortcut registries, permitting runtime customizable rebinding that persists custom configurations across local stores.
```typescript
import { rebindPlugin } from '@angular-libs/shortcut';

const rebind = shortcutService.registerPlugin(rebindPlugin({ storageKey: 'app-kbd-overrides' }));

// Change 'ctrl+s' action to listen on 'ctrl+shift+s'
rebind.setOverride('ctrl+s', 'ctrl+shift+s');
```

### 7. Vimium-style Link Hint Overlay
Overlays keyboard hinting tags above all visible target links/clickable elements dynamically. Typing the text sequence triggers a native element focus and click automatically.
```typescript
import { visualHintsPlugin } from '@angular-libs/shortcut';

const hinting = shortcutService.registerPlugin(visualHintsPlugin({ triggerShortcut: 'ctrl+g' }));
hinting.startHinting();
```

### Custom plugins

`onKeyEvent(event)` may return `true` to consume the event and skip core shortcut dispatch. Built-in `chordPlugin` / `twicePlugin` use this for completed matches. Returning nothing/`false` leaves core handling intact.

---

## Unit Testing

Run unit tests cleanly using:
```bash
ng test @angular-libs/shortcut
```

