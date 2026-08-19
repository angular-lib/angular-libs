# AngularLibs

Signal-first Angular libraries (Angular 22 workspace). Nine packages plus a demo app.

| Package | Role | Peers |
| --- | --- | --- |
| [`@angular-libs/dialog`](projects/angular-libs/dialog) | Native `<dialog>`: modal, window, confirm, popover, toast | ≥19 |
| [`@angular-libs/event-bus`](projects/angular-libs/event-bus) | Typed, signal-based event bus + plugins | ≥20 |
| [`@angular-libs/store`](projects/angular-libs/store) | Signal store with entity / persist / history / IndexedDB | ≥20 |
| [`@angular-libs/translate`](projects/angular-libs/translate) | Signal i18n + `TranslatePipe` | ≥19 |
| [`@angular-libs/web`](projects/angular-libs/web) | Browser/hardware API signals + directives | ≥18 |
| [`@angular-libs/shortcut`](projects/angular-libs/shortcut) | Keyboard shortcuts + plugins | ≥22 |
| [`@angular-libs/socket`](projects/angular-libs/socket) | Signal WebSocket client | ≥20 |
| [`@angular-libs/data-grid`](projects/angular-libs/data-grid) | Signal data grid + plugins | ≥22 |
| [`@angular-libs/form`](projects/angular-libs/form) | Config-driven Signal Forms UI | ≥21 |

Demo: [https://angular-lib.github.io/angular-libs/](https://angular-lib.github.io/angular-libs/)

This is a **0.x** monorepo. Breaking changes are OK until a 1.0 publish.

## Develop

Package manager is **Bun** (`packageManager` in `package.json`).

```bash
bun install
bun start                 # ng serve demo → http://localhost:4200/
bun run socket            # local WebSocket server for the socket demo
bun run build:libs        # all libraries → dist/angular-libs/
bun test                  # Vitest via Angular unit-test builder
```

Build one library:

```bash
ng build @angular-libs/dialog
ng test @angular-libs/dialog --watch=false
```

There is no e2e suite.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commit scopes: `dialog`, `event-bus`, `store`, `translate`, `web`, `shortcut`, `socket`, `data-grid`, `form`, `demo`, `repo`.
