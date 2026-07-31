# @angular-libs/form

Config-driven UI for **Angular Signal Forms** (`@angular/forms/signals`): typed `elements[]`, field registry, S2 `selectionDisplay`, flex layout, and control chrome.

Host owns `form(model, schema)`. This library only renders UI.

## Requirements

| Peer | Minimum |
|------|---------|
| `@angular/core` / `common` / `forms` | **≥ 21** (Signal Forms). Tested on **22**. |

```bash
npm i @angular-libs/form
```

## Quick start

```ts
import { signal } from '@angular/core';
import { form, required } from '@angular/forms/signals';
import {
  AlSignalForm,
  FORM_WIDTHS,
  createForm,
  formFactories,
  seedSelection,
} from '@angular-libs/form';

interface User {
  firstName: string;
  lastName: string;
  roleId: number;
}

const f = formFactories<User>();

@Component({
  imports: [AlSignalForm],
  template: `
    <al-signal-form [form]="userForm" [controller]="formUi" />
    <button type="button" (click)="onSubmit()">Save</button>
  `,
})
export class UserForm {
  readonly model = signal<User>({ firstName: '', lastName: '', roleId: 0 });
  readonly userForm = form(this.model, (p) => {
    required(p.firstName, { message: 'Required' });
  });

  readonly formUi = createForm<User>({
    elements: [
      f.row([
        f.text({ path: 'firstName', label: 'First', width: FORM_WIDTHS.half, props: { clearable: true } }),
        f.text({ path: 'lastName', label: 'Last', width: FORM_WIDTHS.half }),
      ]),
      f.select({
        path: 'roleId',
        label: 'Role',
        width: FORM_WIDTHS.half,
        props: {
          valueKey: 'id',
          labelKeys: ['name'],
          items: [{ id: 1, name: 'Admin' }],
          emptyValue: 0,
        },
      }),
    ],
  });

  constructor() {
    // S2: model keeps roleId; seed labels for closed UI on edit hydrate
    seedSelection(this.formUi, {
      roleId: [{ id: 1, name: 'Admin' }],
    });
  }

  onSubmit(): void {
    this.formUi.markAllTouched(this.userForm);
    if (this.userForm().invalid()) {
      this.formUi.focusFirstInvalid(this.userForm);
      return;
    }
    // persist this.model()
  }

  onReset(initial: User): void {
    this.model.set(initial);
    this.userForm().reset(initial);
    this.formUi.resetUi();
    seedSelection(this.formUi, { roleId: [/* … */] });
  }
}
```

Built-ins register when `<al-signal-form>` is constructed (idempotent). Optional app bootstrap:

```ts
provideFormFields() // builtins only
// or
provideFormFields({ select: MySelectField, datepicker: MyDateField })
```

## Public API (supported)

| Area | Exports |
|------|---------|
| Controller | `createForm`, `FormController`, `seedSelection`, `clearSelection` |
| Factories | `formText`…, `formElementGroup`, `formRow`, `formFactories`, `FORM_WIDTHS` |
| Root UI | `AlSignalForm` |
| Custom fields | `AlField`, `AlFieldShell`, `AlControlChrome`, `formCustom`, `provideFormFields` |
| Grid bridge | `toColumnDefs` |
| Dev | `warnInvalidFormSetup` (also runs from `AlSignalForm` in dev) |

Layout internals (`AlFormElements`, width helpers, …) remain exported as **advanced** — prefer `formRow` / `FORM_WIDTHS` in apps.

## S2 selection display

Selects store **IDs** (or ID arrays) in the Signal Forms model. Labels for the closed UI live on the controller:

1. `valueMode: 'id'` (default) — write `roleId` / `tagIds` into the model  
2. `seedSelection(controller, { roleId: [{ id, name }] })` after load  
3. `clearSelection` / `resetUi()` when resetting  
4. Optional `emptyValue` on clear (default `0` / `''` / `null` from current type)  
5. `loadItems` errors surface in the open panel  

Use `valueMode: 'object'` only when the field should hold full row object(s) (S1).

## Layout

- `al-form-elements` owns flex; `formRow([...])` = full-width row `formElementGroup`  
- Prefer `FORM_WIDTHS.half` for always side-by-side; `halfResponsive` stacks on narrow containers  
- Container queries: `@container al-form`

## Theming (CSS variables)

Set on a parent (or `:root`):

| Token | Default | Role |
|-------|---------|------|
| `--al-form-row-gap` | `0.5rem` | Flex row gap |
| `--al-form-column-gap` | `1rem` | Flex column gap (also used in `FORM_WIDTHS` calcs) |

Control chrome uses scoped classes (`al-control`, `al-control__action`, …). Override in global CSS:

```css
al-control-chrome.al-control {
  border-radius: 0.5rem;
  border-color: #94a3b8;
}
al-control-chrome.al-control.al-control--focused {
  outline-color: #0ea5e9;
}
```

## Extending fields

```ts
provideFormFields({
  select: MySelectField,
  datepicker: MyDatepickerField,
});
```

One-off without a new type: `formCustom({ path: 'start', props: { component: MyDatepickerField } })`.

## Submit / errors

Errors show when touched/dirty **or** after `markSubmitAttempted` / `markAllTouched`.

Plain HTML + minimal local CSS — no design-system coupling.
