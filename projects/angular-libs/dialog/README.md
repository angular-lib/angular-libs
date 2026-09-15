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

Light defaults ship out of the box; `prefers-color-scheme: dark` adjusts the same tokens **only when** `scheme` is `'auto'` (the default for `appearance: 'default'`). Additional vars exist for header/footer/buttons; treat those as advanced.

Pass a [token bridge](#using-with-your-design-system) via `provideDialog({ tokens })` or `applyDialogTokens()` instead of fighting `al-*` class names.

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
      // appearance: 'headless', // structural shell only
      // scheme: false,          // do not rewrite colors from prefers-color-scheme
      // contentClass: 'kit-dialog',
      // tokens: { bg: 'var(--kit-color-surface)', accent: 'var(--kit-color-primary)' },
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
  fullscreenBelow: 'md', // fullscreen under 768px
  // closeOnEscape: true, closeOnBackdrop: false, // independent dismiss
  // disableClose: true, // shorthand: both off
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

// Popover / toast — popover flips / shifts at viewport edges
dialog.popover(MenuComponent, { anchor: event.currentTarget, placement: 'bottom' });
dialog.toast('Saved', { duration: 3000, position: 'bottom-right' });
```

## Desktop window features

`dialog.window()` drag, dock/taskbar, tile snap (Alt+S), edge snap, and CSS `resize` are intended for **desktop / pointer** UIs. On touch or small viewports prefer `open`, `confirm`, `alert`, or `toast`.

## Accessibility (per intent)

| Intent | Modal | Return focus | Notes |
|--------|-------|--------------|-------|
| `open` | yes | yes | `aria-modal=true`, labelledby from title when present |
| `confirm` / `alert` | yes | yes | `role="alertdialog"`; footer actions close with results |
| `window` | no | no (default) | `aria-modal=false` |
| `popover` | no | yes | Restore to trigger; flips / shifts at viewport edges |
| `toast` | no | no | `role="status"`, `aria-live="polite"`; stacked in a corner |

Options: `autoFocus`, `restoreFocus`, `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`, `role` (`dialog` \| `alertdialog`), `closeOnNavigation` (default on for modals).

### Dismiss

- `closeOnEscape` / `closeOnBackdrop` — independent. Both default to `true`.
- `disableClose: true` — shorthand that turns both off. Explicit flags override it.
- `hasBackdrop: false` — transparent native `::backdrop` (still modal).
- `backdropClass` — extra class on `<dialog>` for `::backdrop` styling.

### Mobile fullscreen

`fullscreenBelow: 'sm' | 'md' | 'lg' | 'xl'` on `open()` (or confirm / alert) stretches the modal to the viewport under 640 / 768 / 1024 / 1280px.

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
- Global `provideDialog({ contentClass, panelClass })` **merges** with per-call classes (both apply).

## Using with your design system

`@angular-libs/dialog` can own behavior (open / confirm / popover / toast, focus, dismiss) while a product UI kit owns tokens and chrome.

### 1. Headless / chrome-less

`dialog.open(YourSheet)` already hosts **only** the consumer component — no `DefaultDialogComponent` wrapper (`data-al-dialog-chrome="none"`).

Add `appearance: 'headless'` to drop library shadow, radius, surface colors, and DefaultDialog decoration. The native `<dialog>` stays for positioning, `::backdrop`, and a11y.

```ts
import { provideDialog, DialogService, DialogRef } from '@angular-libs/dialog';

bootstrapApplication(App, {
  providers: [
    provideDialog({
      appearance: 'headless',
      scheme: false, // you own light/dark
      contentClass: 'kit-dialog',
      strings: { ok: 'Continue', cancel: 'Back' },
    }),
  ],
});

@Component({
  selector: 'kit-edit-user',
  standalone: true,
  template: `
    <header data-al-dialog-part="header">
      <h2 data-al-dialog-part="title">Edit user</h2>
    </header>
    <section data-al-dialog-part="content"><!-- kit fields --></section>
    <footer data-al-dialog-part="footer">
      <button type="button" (click)="dialogRef.close()">Cancel</button>
      <button type="button" class="kit-btn-primary" (click)="save()">Save</button>
    </footer>
  `,
})
class KitEditUserComponent {
  dialogRef = inject(DialogRef);
}

const dialog = inject(DialogService);
dialog.open(KitEditUserComponent, { size: 'md' });
```

`confirm()` / `alert()` / `toast()` still use `DefaultDialogComponent` for structure (title, actions, a11y). In headless mode that chrome is layout-only — style it through parts or `contentClass`.

### 2. Token bridge

Map host DS tokens onto `--al-dialog-*` (or pass the same map to `provideDialog` / `open`):

```ts
import { applyDialogTokens, dialogTokensAsCss } from '@angular-libs/dialog';

provideDialog({
  tokens: {
    bg: 'var(--kit-color-surface)',
    color: 'var(--kit-color-ink)',
    border: 'var(--kit-border)',
    borderRadius: 'var(--kit-radius)',
    shadow: 'var(--kit-shadow-lg)',
    backdrop: 'var(--kit-scrim)',
    accent: 'var(--kit-color-primary)',
    fontFamily: 'var(--kit-font-sans)',
  },
});

// Equivalent CSS (also documented in @angular-libs/dialog/styles/bridge.css):
// dialog.al-dialog {
//   --al-dialog-bg: var(--kit-color-surface);
//   --al-dialog-accent: var(--kit-color-primary);
// }
```

`applyDialogTokens(element, tokens)` and `dialogTokensAsCss(tokens)` are the same mapping as a function.

| `provideDialog` option | Role |
|------------------------|------|
| `appearance: 'headless'` | Structural shell, no library chrome |
| `scheme: false` | Do not apply built-in light/dark palettes |
| `tokens` | CSS variables on each `<dialog>` |
| `contentClass` / `panelClass` | Host class hooks (merged globally + per call) |
| `strings` | Confirm / alert / icon labels |

### 3. Stable hooks

Every surface sets data attributes on the native `<dialog>`:

| Attribute | Values |
|-----------|--------|
| `data-al-dialog-intent` | `open` `confirm` `alert` `popover` `toast` `window` |
| `data-al-dialog-chrome` | `default` (DefaultDialog) or `none` (your component) |
| `data-al-dialog-appearance` | `default` `headless` |
| `data-al-dialog-scheme` | `auto` `light` `dark` `none` |

DefaultDialog parts (also keep the `al-*` class names):

`container` `header` `titles` `title` `subtitle` `window-actions` `action` `content` `message` `footer` `button`

```css
dialog.al-dialog[data-al-dialog-intent="confirm"] [data-al-dialog-action="primary"] {
  /* kit primary button */
}
```

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
