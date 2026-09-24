# @angular-libs/dialog

Intent-based dialogs on the native HTML `<dialog>` element — modal, floating window, confirm, popover, and toast — with plugins as an escape hatch.

Pick **one** path — same split as Angular **Material vs Aria**. Do not mix them.

| Path | Use when | What you use |
| --- | --- | --- |
| **1. Default design (batteries)** | You want a look out of the box | `DialogService` + `core.css` + DefaultDialog chrome |
| **2. Aria-style (headless)** | You already own chrome / a design system | `alDialog` on *your* `<dialog>` — **zero CSS import** |

- Batteries: import the CSS, call `open` / `confirm` / `alert` / `window` / `popover` / `toast`.
- Aria: your markup + your CSS. The directive only does keyboard, focus, dismiss, and ARIA.
- Chrome parts (`<al-dialog-header>`, `[alDialogClose]`, …) work on both paths; they are styled by `core.css` and plain semantics without it.

**Browser-only:** `showModal()` / `open()` / `window()` use `document` and are not SSR-safe.

## 1. Default design (batteries)

### Install & styles

```bash
npm install @angular-libs/dialog
```

Required for this path. Skip these imports if you use `alDialog` instead.

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

### Bootstrap

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

### Quick start

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

### Typed dialogs — `defineDialog` (recommended)

Declare a dialog once; opening it type-checks required inputs and the result.

```ts
import { DialogParts, defineDialog, injectDialog } from '@angular-libs/dialog';

@Component({
  imports: [DialogParts],
  template: `
    <al-dialog-header>
      Edit {{ user().name }}
      <p alDialogSubtitle alDialogDescription>Changes apply immediately</p>
    </al-dialog-header>
    <al-dialog-body>…form…</al-dialog-body>
    <al-dialog-footer>
      <button class="al-btn al-btn-secondary" alDialogClose>Cancel</button>
      <button class="al-btn al-btn-primary" [disabled]="save.pending()" (click)="save()">Save</button>
    </al-dialog-footer>
  `,
})
export class EditUserComponent {
  readonly user = input.required<User>();
  readonly dialog = injectDialog<User>(); // public → result type is inferred

  constructor() {
    // Runs on dismissals only (Escape, backdrop, ×, navigation) — never after a successful save.
    this.dialog.guard(() => !this.form.dirty || this.dialog.confirm({ title: 'Discard changes?' }));
  }

  // pending() / error() signals; dismiss is blocked and aria-busy set while it runs;
  // closes with the returned value on success.
  readonly save = this.dialog.action(() => this.api.save(this.form.value));
}

export const EditUserDialog = defineDialog(EditUserComponent, { size: 'md', sheetBelow: 'sm' });
export const ReportDialog = defineDialog(() => import('./report').then((m) => m.Report)); // lazy
```

```ts
const outcome = await dialog.run(EditUserDialog, { user }); // `user` is required by the type
if (outcome.ok) save(outcome.value);                       // value: User
else console.log(outcome.reason);                           // 'escape' | 'backdrop' | 'manual' | …

const ref = dialog.open(EditUserDialog, { user }, { size: 'lg' }); // eager definitions only
```

- `outcome.ok` is `true` exactly when the dialog closed **with a value**.
- Required inputs are `input.required()` — and inputs with a default value (Angular types cannot tell them apart). Preset them on the definition (`inputs: { … }`) to make them optional.
- `result: dialogResult<T>()` sets the result type when the component cannot express it.

### Chrome parts

| Part | Does |
| --- | --- |
| `<al-dialog-header>` | Title (wires `aria-labelledby`), `[alDialogSubtitle]`, `[alDialogHeaderActions]`, close button (`closable`, `closeLabel`, or `strings.close`) |
| `<al-dialog-body>` / `<al-dialog-footer>` | Scrolling body / end-aligned actions |
| `[alDialogTitle]` / `[alDialogDescription]` | Wire `aria-labelledby` / `aria-describedby` without ids |
| `[alDialogClose]="value"` | Closes with `value` (empty = dismiss); `type="button"` by default; ignored while busy |

Explicit `ariaLabel` / `ariaLabelledBy` options win over the parts. Button classes: `al-btn` + `al-btn-primary` / `al-btn-secondary` / `al-btn-danger`.

### Async confirm

```ts
const deleted = await dialog.confirm({
  title: 'Delete project?',
  confirmText: 'Delete',
  tone: 'danger',
  onConfirm: () => api.deleteProject(id), // spinner, dismiss blocked, inline error + retry on throw
  errorText: (e) => `Could not delete: ${(e as Error).message}`, // default: strings.error
});
```

### Toaster

```ts
const toaster = inject(Toaster);
toaster.success('Saved');
toaster.show('Conversation archived', { action: { label: 'Undo', onClick: undo } });
await toaster.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' });
```

One region per corner in the top layer, `maxVisible` queue, pause on hover / focus / hidden tab, swipe and Escape to dismiss, and announcements through persistent live regions (errors assertive). Defaults: `provideDialog({ toaster: { position, duration, maxVisible } })`. Prefer it over `dialog.toast()`.

While a modal is open the rest of the page is inert, so toasts stay visible and announced but their buttons can't be clicked until the modal closes.

## 2. Design systems (Aria-style)

Same idea as `@angular/aria`: attribute directives on the consumer’s markup. You own HTML and CSS. **Do not** import `core.css` or `--al-dialog-*` tokens on this path.

```ts
import { AlDialog } from '@angular-libs/dialog';

@Component({
  imports: [AlDialog],
  template: `
    <dialog
      alDialog
      class="sheet"
      [open]="open()"
      labelledBy="edit-title"
      (closed)="open.set(false)"
    >
      <h2 id="edit-title">Edit user</h2>
      <form>…</form>
    </dialog>
  `,
  styles: `
    .sheet { border: 0; padding: 1.5rem; width: min(480px, 100%); }
    .sheet::backdrop { background: rgb(0 0 0 / 32%); }
  `,
})
export class EditUserDialog {
  open = signal(false);
}
```

A kit host (`<ui-dialog>`) is your wrapper — project content, pass `open` / `labelledBy`, style the native `<dialog>` yourself:

```html
<ui-dialog [open]="open()" titleId="edit-title" closeLabel="Lukk" (closed)="open.set(false)">
  <h2 uiDialogTitle id="edit-title">…</h2>
  <form>…</form>
</ui-dialog>
```

```html
<!-- inside ui-dialog -->
<dialog alDialog [open]="open()" [labelledBy]="titleId()" (closed)="closed.emit()">
  <ng-content />
</dialog>
```

`alDialog` lives on native `<dialog>` so `showModal()` can use the top layer.

Inputs: `open`, `modal`, `labelledBy`, `describedBy`, `closeOnEscape`, `closeOnBackdrop`, `restoreFocus`, `autoFocus`. Output: `closed`. `#d="alDialog"` exposes `close()`. Set `aria-label` / `role` on the host if you need them — the directive does not invent a second ARIA API.

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

### Mobile fullscreen / bottom sheet

`fullscreenBelow: 'sm' | 'md' | 'lg' | 'xl'` on `open()` (or confirm / alert) stretches the modal to the viewport under 640 / 768 / 1024 / 1280px.

`sheetBelow` (same breakpoints) presents the modal as a bottom sheet instead: full width, docked to the bottom, rounded top, safe-area padding, slides up. It wins over `fullscreenBelow` on small screens.

### Motion and scroll

Modals, sheets, popovers and toasts fade/slide in with CSS `@starting-style` (no JS timers); `prefers-reduced-motion` turns it off. Tune with `--al-dialog-enter-duration`. `animation: 'fade'` still adds a leave animation. Scroll lock pads `<body>` by the hidden scrollbar width, so the page does not shift.

Escape is handled on `document` and routed to the topmost modal, so `closeOnEscape: false`, guards and busy dialogs cannot be force-closed by the browser after repeated Escape presses.

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
ref.busy();  // Signal: true while an action / onConfirm runs (dismiss blocked)
ref.addCloseGuard(({ source, result }) => …); // returns a remover
await ref.close(result);
const { result, source } = await ref.closed;
const outcome = await ref.outcome; // { ok: true, value } | { ok: false, reason }
```

Standalone action functions (`minimize(ref)`, …) still exist as advanced/tree-shakeable imports; prefer ref methods.

## Testing

```ts
import { provideDialogTesting, DialogTestingController } from '@angular-libs/dialog/testing';

TestBed.configureTestingModule({ providers: provideDialogTesting() });
const dialog = TestBed.inject(DialogService);
const controller = TestBed.inject(DialogTestingController); // already tracks every open / run

// Answer run() without rendering the dialog:
controller.stub(EditUserDialog, { ok: true, value: user, source: 'manual' });
controller.stub(ConfirmDelete, (inputs) => ({ ok: false, reason: 'escape' }));

expect(controller.runCalls[0]).toMatchObject({ definition: EditUserDialog, stubbed: true });
await controller.flushClose(result); // closes the last opened dialog
```

`wrapDialogServiceForTesting` is still exported; calling it after `provideDialogTesting()` is a no-op.

## Size presets

`sm` 320px · `md` 480px · `lg` 640px · `xl` 800px · `full` 90vw

## Toast position

`position` on `toast()`: `top-left` | `top-right` | `bottom-left` | `bottom-right` (default `bottom-right`). Multiple toasts in the same corner stack with a gap.
