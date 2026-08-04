# @angular-libs/shortcut

Zoneless, SSR-safe keyboard shortcut manager for Angular. Capture-phase document listeners, physical layout mapping, and a functional plugin system.

## Install

```bash
npm install @angular-libs/shortcut
```

Peer dependencies: `@angular/core` and `@angular/common` ^22.

## Bootstrap

```typescript
import { provideShortcut, inputSuppressorPlugin } from '@angular-libs/shortcut';

bootstrapApplication(AppComponent, {
  providers: [
    provideShortcut({
      plugins: [inputSuppressorPlugin(['escape', 'mod+s'])],
    }),
  ],
});
```

Plugins in `provideShortcut({ plugins })` are registered in array order (that order is also hook order).

## Quick start

### Programmatic

```typescript
import { Component, inject } from '@angular/core';
import { ALShortcutService, onShortcut } from '@angular-libs/shortcut';

@Component({ standalone: true, template: `...` })
export class MyComponent {
  private shortcuts = inject(ALShortcutService);

  constructor() {
    this.shortcuts.register({
      shortcut: 'mod+s',
      description: 'Save',
      group: 'file',
      action: () => this.save(),
    });

    onShortcut('escape', () => this.close(), { description: 'Close' });
  }

  save() {}
  close() {}
}
```

`mod` resolves to **Meta** on Apple platforms and **Ctrl** elsewhere. Synonyms: `cmd`/`command` → `meta`, `esc` → `escape`, `option` → `alt`, `control`/`ctl` → `ctrl`.

Display: `formatShortcut('mod+s')` → `⌘S` or `Ctrl+S`.

### Directive

```typescript
import { ALShortcutDirective } from '@angular-libs/shortcut';

@Component({
  standalone: true,
  imports: [ALShortcutDirective],
  template: `
    <div [alShortcut]="'ctrl+f'" (alShortcutTriggered)="focusSearch()">Search…</div>
    <button [alShortcut]="'escape'" [alShortcutGlobal]="true" (alShortcutTriggered)="closeAll()">Close</button>
  `,
})
export class MyComponent {
  focusSearch() {}
  closeAll() {}
}
```

### Config highlights

- `when?: () => boolean` — skip when false
- `stopPropagation` / `stopImmediatePropagation`
- `id` / `group` — returned from `getShortcuts()`, usable with `trigger()`
- `getConflicts()` — normalised keys with more than one handler

## Headless plugins (stable core)

```typescript
const service = inject(ALShortcutService);
service.registerPlugin(inputSuppressorPlugin(['escape']));
const chords = service.registerPlugin(chordPlugin());
service.getPlugin('chord');
service.unregisterPlugin('chord');
```

| Plugin | Role |
|--------|------|
| `inputSuppressorPlugin` | Ignore shortcuts in inputs (exceptions normalised) |
| `chordPlugin` | Sequences like `"g d"` / `"ctrl+k ctrl+c"` (uses shared layout map) |
| `twicePlugin` | Double-tap (e.g. Shift) |
| `contextGuardPlugin` | Allow/block by named context |
| `rebindPlugin` | Runtime remaps + localStorage |

Custom plugins implement `ALShortcutPlugin` and receive `ALShortcutHost` in `onInit`.

## Plugin lifecycle

- Hooks (`onKeyEvent`, `onResolveShortcut`, `onBeforeExecute`, …) run in **registration order**.
- Prefer a stable `id` for `getPlugin` / `unregisterPlugin`.
- `unregisterPlugin` calls `onDestroy`; the plugin must unsubscribe shortcuts it registered in `onInit`.
- `registerPlugin` with an existing `id` returns the existing instance (idempotent).

## Experimental UI plugins

Import from **`@angular-libs/shortcut/plugins`** (not the main barrel):

```typescript
import { commandPalettePlugin, visualHintsPlugin } from '@angular-libs/shortcut/plugins';

const palette = service.registerPlugin(commandPalettePlugin());
const hints = service.registerPlugin(visualHintsPlugin());
```

These overlays are **`@experimental`**:

| Relatively stable in 0.0.x | May change without major bump |
|----------------------------|-------------------------------|
| Factory names | DOM structure / markup |
| `open` / `close` / `toggle` | CSS class names |
| `startHinting` / `stopHinting` | Visual defaults |
| Plugin `id`s (`command-palette`, `visual-hints`) | Future Angular component rewrite |

- **SSR:** browser-only (require `document` / `window`).
- Prefer the returned plugin handle or `getPlugin(id)` — do not depend on internal DOM.
- Theming: CSS variables `--al-pal-*` and `--al-hint-*` (see source for names); class names are not a contract.

## SSR

Core listeners attach only when `window` + `DOCUMENT` exist. UI plugins inject DOM — use them in the browser only.

## Testing

```bash
ng test @angular-libs/shortcut
```
