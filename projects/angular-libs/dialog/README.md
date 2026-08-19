# @angular-libs/dialog

Intent-based dialogs on the native HTML `<dialog>` element — modal, floating window, confirm, popover, and toast — with plugins as an escape hatch.

**Browser-only:** `open()` / `window()` use `document` and are not SSR-safe.

## Install & styles

```bash
npm install @angular-libs/dialog
```

```css
/* Modal / confirm / toast / popover */
@import "@angular-libs/dialog/styles/core.css";

/* Also needed for dialog.window() (drag, dock, tile snap) */
@import "@angular-libs/dialog/styles/window.css";

/* Or both at once */
@import "@angular-libs/dialog/styles.css";
```

### Public theme tokens

Override dialog tokens on `dialog.al-dialog` (or a parent). Dock tokens live on `:root` / `.al-dialog-taskbar` — the taskbar is appended to `document.body`, so setting them on the `<dialog>` has no effect.

| Token | Role |
|-------|------|
| `--al-dialog-bg` | Surface |
| `--al-dialog-color` | Ink |
| `--al-dialog-border` | Border |
| `--al-dialog-border-radius` | Radius |
| `--al-dialog-shadow` | Shadow |
| `--al-dialog-backdrop` | Backdrop |
| `--al-dialog-accent` | Primary actions |
| `--al-dialog-font-family` | Font |
| `--al-dock-bg` | Dock surface (`:root` / `.al-dialog-taskbar`, window.css) |

Light defaults ship out of the box; `prefers-color-scheme: dark` adjusts the same tokens. Additional vars exist for header/footer/buttons; treat those as advanced.

## Bootstrap

```ts
import { provideDialog } from '@angular-libs/dialog';

bootstrapApplication(AppComponent, {
  providers: [
    provideDialog({
      window: { drag: true, snap: true, dock: true },
      // static object, Signal, or sync factory — resolved when a dialog opens
      strings: () => translate.dialogStrings(),
      // strings: {
      //   close: 'Close',
      //   confirmTitle: 'Confirm',
      //   alertTitle: 'Alert',
      //   ok: 'OK',
      //   cancel: 'Cancel',
      // },
    }),
  ],
});
```

## Quick start

```ts
const dialog = inject(DialogService);

// Modal
const ref = dialog.open(EditUserComponent, {
  inputs: { userId },
  size: 'md',
  contentClass: 'my-chrome',
});
const { result, source } = await ref.closed;

// Floating window (drag + snap + dock by default) — desktop / pointer oriented
const win = dialog.window(ChatComponent, {
  id: 'chat',
  resize: true,
  persist: true,
  // snap: false, // disable one default
});
win.minimize();
win.snap('right');

// Confirm / alert
const ok = await dialog.confirm({
  title: 'Discard?',
  message: 'This cannot be undone.',
  confirmText: 'Discard',
  cancelText: 'Keep editing',
});

await dialog.alert({ title: 'Done', message: 'Saved.' });

// Popover / toast
dialog.popover(MenuComponent, { anchor: event.currentTarget, placement: 'bottom' });
dialog.toast('Saved', { duration: 3000, position: 'bottom-right' });
```

## Desktop window features

`dialog.window()` drag, dock/taskbar, tile snap (Alt+S), edge snap, and CSS `resize` are intended for **desktop / pointer** UIs. On touch or small viewports prefer `open`, `confirm`, `alert`, or `toast`.

## Accessibility (per intent)

| Intent | Modal | Return focus | Notes |
|--------|-------|--------------|-------|
| `open` | yes | yes | `aria-modal=true`, labelledby from title when present |
| `confirm` / `alert` | yes | yes | Footer actions close with results |
| `window` | no | no (default) | `aria-modal=false` |
| `popover` | no | yes | Restore to trigger |
| `toast` | no | no | `role="status"`, `aria-live="polite"`; stacked in a corner |

Options: `autoFocus`, `restoreFocus`, `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`, `closeOnNavigation` (default on for modals).

## DefaultDialogComponent

Built-in chrome for alerts, confirms, and simple hosted content.

- Body is **plain text** (`contentText`) or a component — **not HTML**.
- Header is omitted when there is no title/subtitle and no action icons.
- Primary / secondary / close **close the dialog** with results (`true` / `false` / `undefined` by default via `primaryResult` / `secondaryResult` / `closeResult`).
- Emitters `primaryAction` / `secondaryAction` still fire for advanced listeners.

## Customize

### Plugins

```ts
import { definePlugin } from '@angular-libs/dialog';

dialog.window(Comp, {
  plugins: [
    definePlugin({
      id: 'my-plugin',
      setup({ element }) {
        /* … */
        return () => { /* teardown */ };
      },
    }),
  ],
});
```

Built-in factories (`draggablePlugin`, `dockPlugin`, …) remain exported for advanced composition. Prefer declarative `drag` / `snap` / `dock` / `persist` on `window()`.

### Classes

- `panelClass` → native `<dialog>`
- `contentClass` → content root (`[data-al-dialog-content]`)

## DialogRef

```ts
ref.minimize();
ref.maximize();
ref.restore();
ref.snap('left');
ref.moveTo(x, y);
ref.resizeTo(400, 300);
ref.state(); // Signal: 'open' | 'minimized' | 'maximized' | 'closed'
await ref.close(result);
const { result, source } = await ref.closed;
```

Standalone action functions (`minimize(ref)`, …) still exist as advanced/tree-shakeable imports; prefer ref methods.

## Testing

```ts
import {
  provideDialogTesting,
  DialogTestingController,
  wrapDialogServiceForTesting,
  patchDialogElement,
} from '@angular-libs/dialog/testing';

TestBed.configureTestingModule({ providers: provideDialogTesting() });
const dialog = TestBed.inject(DialogService);
const controller = TestBed.inject(DialogTestingController);
wrapDialogServiceForTesting(dialog, controller);
```

## Size presets

`sm` 320px · `md` 480px · `lg` 640px · `xl` 800px · `full` 90vw

## Toast position

`position` on `toast()`: `top-left` | `top-right` | `bottom-left` | `bottom-right` (default `bottom-right`). Multiple toasts in the same corner stack with a gap.
