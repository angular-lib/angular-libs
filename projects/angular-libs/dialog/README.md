# @angular-libs/dialog

Dialogs, popovers, toasts and floating windows for Angular, built on the platform: native `<dialog>`, the Popover API and CSS anchor positioning. The library adds typing, dismiss handling, a few chrome parts, and gets out of the way.

```bash
npm install @angular-libs/dialog
```

```css
@import '@angular-libs/dialog/styles/core.css';   /* dialogs, popovers, toasts */
@import '@angular-libs/dialog/styles/window.css'; /* only for @angular-libs/dialog/window */
```

Browser-only: opening needs `document` (throws on the server).

## Dialogs

```ts
@Component({
  imports: [DialogParts],
  template: `
    <al-dialog-header>Edit {{ user().name }}</al-dialog-header>
    <al-dialog-body><input autofocus [(ngModel)]="name" /></al-dialog-body>
    <al-dialog-footer>
      <button class="al-btn al-btn-secondary" alDialogClose>Cancel</button>
      <button class="al-btn al-btn-primary" [disabled]="save.pending()" [attr.aria-busy]="save.pending() || null" (click)="save()">
        Save
      </button>
    </al-dialog-footer>
  `,
})
export class EditUser {
  readonly user = input.required<User>();
  readonly dialog = injectDialog<User>(); // public → dialog.open() infers the result type

  constructor() {
    // Runs on dismissals only (Escape, backdrop, ×, navigation) — never after a save.
    this.dialog.guard(() => !this.dirty() || this.dialog.confirm({ title: 'Discard changes?' }));
  }

  // pending() / error(); the dialog is busy (close requests ignored, aria-busy) while it runs,
  // and closes with the returned value on success.
  readonly save = this.dialog.action(() => this.api.save(this.name()));
}
```

```ts
const dialog = inject(DialogService);

const outcome = await dialog.open(EditUser, { user }, { size: 'lg', mobile: 'sheet' }).closed;
if (outcome.ok) use(outcome.value); // User
else log(outcome.source);           // 'escape' | 'backdrop' | 'manual' | 'navigation' | …

if (await dialog.confirm({ title: 'Delete project?', tone: 'danger', onConfirm: () => api.delete(id) })) …
await dialog.alert({ title: 'Saved' });
```

- `inputs` are checked by name and type. They are all optional in the types — Angular cannot tell `input.required()` from `input(default)` — and a missing required input fails at runtime (NG0950).
- `closed` never rejects: `{ ok: true, value, source }` when closed with a value, else `{ ok: false, source }`.
- `confirm({ onConfirm })` runs the handler with a spinner; if it throws, the error shows in the dialog and the user can retry or cancel. `confirm()` resolves `true` only after it succeeds.
- Options: `size` (`sm` `md` `lg` `xl` `full` or a CSS width), `mobile` (`sheet` / `fullscreen` below 640px), `panelClass`, `closeOnEscape`, `closeOnBackdrop`, `closeOnNavigation`, `ariaLabel`, `role`, `injector`.

### Parts

| Part | |
| --- | --- |
| `<al-dialog-header>` | Title (labels the dialog), `[alDialogSubtitle]`, `[alDialogHeaderActions]`, × button (`[closable]="false"` hides it) |
| `<al-dialog-body>` / `<al-dialog-footer>` | Scrolling body / end-aligned actions |
| `[alDialogTitle]` / `[alDialogDescription]` | Point `aria-labelledby` / `aria-describedby` at an element |
| `[alDialogClose]="value"` | Closes with `value`; empty dismisses. `type="button"` by default, inert while busy |

Buttons: `al-btn` + `al-btn-primary` / `al-btn-secondary` / `al-btn-danger`; `aria-busy="true"` shows a spinner.

### Behavior

- **Focus:** native. `showModal()` contains focus and focuses `[autofocus]` (else the dialog); focus returns to the opener.
- **Escape** goes to the topmost modal and is handled on `document`, so `closeOnEscape: false`, guards and busy dialogs cannot be force-closed by the browser after repeated presses.
- **Motion:** CSS only — `@starting-style` in, `transition-behavior: allow-discrete` out; the element is removed once its transitions finish. Off with `prefers-reduced-motion`.
- **Scroll lock** pads `<body>` by the scrollbar width, so the page does not shift.

## Popover

```ts
const picked = await inject(PopoverService).open(event.currentTarget, Menu, { items }, { placement: 'bottom-start' }).closed;
```

A `popover="auto"` element positioned with CSS anchor positioning (`position-area`, flips when there is no room). Outside click and Escape close it natively — so guards do not apply there — and focus returns to the anchor. Placements: `top` `bottom` (`-start` / `-end`), `left`, `right`. Without anchor-positioning support it falls back to below the anchor.

## Toaster

```ts
const toaster = inject(Toaster);
toaster.success('Saved');
toaster.show('Conversation archived', { action: { label: 'Undo', onClick: undo } });
await toaster.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' });
```

One top-layer region per corner, `maxVisible` queue, pause while hovered or focused, Escape dismisses the focused toast, announcements through a persistent live region (errors assertive). While a modal is open the toasts live inside it, so they stay clickable.

## Windows — `@angular-libs/dialog/window`

```ts
@Component({
  imports: [AlWindowHeader],
  template: `<al-window-header>Chat</al-window-header> …`,
})
export class Chat {}

const win = inject(WindowService).open(Chat, {}, { id: 'chat', persist: true, width: 420 });
win.snap('right');
win.minimize();
win.mode();   // Signal: 'normal' | 'minimized' | 'maximized'
win.bounds(); // Signal: { x, y, width, height }
```

Modeless windows: drag by the header, native resize grip, minimize to a dock, maximize (double-click the header), Alt+Arrow snaps to half the screen, Alt+S opens a tile grid (drag across cells), fullscreen, and `persist` remembers bounds and mode per `id`. Opening an `id` that is already open focuses it. `WindowRef` is a `DialogRef`, so `injectDialog()` and the parts work inside. Desktop-oriented.

## Headless — `alDialog`

Your markup and CSS; no stylesheet needed.

```html
<dialog alDialog [open]="open()" (closed)="open.set(false)">
  <h2 alDialogTitle>Edit user</h2>
  …
  <button alDialogClose>Close</button>
</dialog>
```

Inputs: `open`, `modal`, `closeOnEscape`, `closeOnBackdrop`, `restoreFocus`. Output: `closed` (`{ reason: 'escape' | 'backdrop' | 'close' }`). Same Escape, backdrop, scroll-lock and focus behavior as above.

## Configuration

```ts
provideDialog({
  strings: () => translate.dialogStrings(), // object, Signal or factory: close, ok, cancel, error, notifications, minimize, …
  defaults: { mobile: 'sheet' },            // for every dialog.open()
  toaster: { position: 'bottom-right', duration: 5000, maxVisible: 3 },
});
```

Theme with the `--al-dialog-*` tokens on `:root` (or any ancestor): `bg`, `color`, `muted`, `border`, `radius`, `shadow`, `backdrop`, `accent`, `danger`, `font`, `gap`, `duration`, … Dark values follow `prefers-color-scheme`.

## Testing

```ts
import { DialogTestingController, provideDialogTesting } from '@angular-libs/dialog/testing';

TestBed.configureTestingModule({ providers: provideDialogTesting() }); // jsdom <dialog> + popover support
const controller = TestBed.inject(DialogTestingController);

controller.stub(EditUser, { ok: true, value: user, source: 'manual' }); // answered without rendering
controller.stub(ConfirmDialog, { ok: true, value: true, source: 'manual' }); // dialog.confirm() → true
expect(controller.calls[0]).toEqual({ component: EditUser, inputs: { user } });
```
