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
provideFormFields({ select: MyFormSelect })
```

## Public API (supported)

| Area | Exports |
|------|---------|
| Controller | `createForm`, `FormController`, `seedSelection`, `clearSelection` |
| Factories | `formText`…, `formElementGroup`, `formRow`, `formFactories`, `FORM_WIDTHS` |
| Root UI | `AlSignalForm` |
| Standalone controls | `AlTextInput`, `AlNumberInput`, `AlTextarea`, `AlCheckbox`, `AlPasswordInput`, `AlSearchInput`, `AlDatePicker`, `AlTimePicker`, `AlDateTimePicker`, `AlRadioGroup`, `AlSwitch`, `AlSlider`, `AlFileInput`, `AlColorInput`, `AlTagInput`, `AlDuration`, `AlDropdown` |
| Form adapters | `AlFormText` … `AlFormDuration`, `AlFormSelect`, … — registry + `provideFormFields` |
| Form chrome | `AlField`, `AlFieldShell`, `AlControlChrome`, `formCustom` |
| Grid bridge | `toColumnDefs` |
| Dev | `warnInvalidFormSetup` (also runs from `AlSignalForm` in dev) |

Layout internals (`AlFormElements`, width helpers, …) remain exported as **advanced** — prefer `formRow` / `FORM_WIDTHS` in apps.

### Standalone vs form binding

Controls implement Angular Signal Forms `FormValueControl` / `FormCheckboxControl` (`value` / `checked` models + `touch` output):

- **Standalone:** `[(value)]="…"` (checkbox/switch: `[(checked)]`; dropdown: selected `DropdownItem[]`)
- **In `al-signal-form`:** `AlForm*` adapters bind with `[formField]` and wrap `AlFieldShell` / props — no manual value mirroring

`AlFormSelect` keeps custom S2 `selectionDisplay` wiring (field often holds ids while `AlDropdown.value` is display rows).

### Additional editors

| Factory | Control | Model |
|---------|---------|--------|
| `formRadio` | `AlRadioGroup` | option value / `null` |
| `formSwitch` | `AlSwitch` | `checked: boolean` |
| `formSlider` | `AlSlider` | `number` |
| `formFile` | `AlFileInput` | `File \| File[] \| null` |
| `formColor` | `AlColorInput` | `#rrggbb` |
| `formTags` | `AlTagInput` | `string[]` |
| `formDuration` | `AlDuration` | total seconds (`number \| null`) |

```ts
f.radio({
  path: 'plan',
  label: 'Plan',
  props: {
    direction: 'row',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
    ],
  },
});
f.switch({ path: 'newsletter', label: 'Email', props: { switchLabel: 'Subscribe' } });
f.duration({ path: 'ttl', label: 'TTL', props: { showSeconds: false, stepMm: 5 } });
f.tags({ path: 'labels', label: 'Labels', props: { placeholder: 'Add tag' } });
```

Duration UX: `hh:mm:ss` segments; paste `"1:30:00"` / `"01:30"`; optional `minSeconds` / `maxSeconds` / `maxHours` / `wheel`.

## S2 selection display

Selects store **IDs** (or ID arrays) in the Signal Forms model. Labels for the closed UI live on the controller:

1. `valueMode: 'id'` (default) — write `roleId` / `tagIds` into the model  
2. `seedSelection(controller, { roleId: [{ id, name }] })` after load  
3. `clearSelection` / `resetUi()` when resetting  
4. Optional `emptyValue` on clear (default `0` / `''` / `null` from current type)  
5. `loadItems` / `datasource` errors surface in the open panel  

Use `valueMode: 'object'` only when the field should hold full row object(s) (S1).

### Powerful select (`AlDropdown`)

Built-in `select` uses a **Popover API** panel (no CDK): search, multi chips, async `loadItems` / paged `datasource`, grouping, checkboxes, columns, footer, **creatable tags**, and **tree** options.

```ts
f.select({
  path: 'tagIds',
  label: 'Tags',
  props: {
    valueKey: 'id',
    labelKeys: ['name'],
    multiple: true,
    searchable: true,
    creatable: {
      onCreate: async (term) => api.createTag(term), // required for S2 id mode
    },
    items: tags,
  },
});

f.select({
  path: 'folderId',
  label: 'Folder',
  props: {
    valueKey: 'id',
    labelKeys: ['name'],
    tree: { childrenKey: 'children', defaultExpanded: 'selected-ancestors' },
    items: folderTree,
  },
});
```

Standalone (outside the form): import `AlDropdown` and bind `[(value)]` to selected display rows (`DropdownItem[]`). Optional `(selectionChange)` gives `{ rows, ids }`.

```ts
// <al-dropdown
//   [(value)]="selected"
//   valueKey="id"
//   [labelKeys]="['name']"
//   [items]="roles"
//   [multiple]="false" />
```

`AlFormSelect` still bridges Signal Forms field values (often ids) ↔ display rows via S2 `selectionDisplay` — not a plain `[formField]` on the dropdown when `valueMode: 'id'`.

Browser baseline: native `popover` + CSS anchor positioning (fallback absolute panel when anchors are unsupported).

## Layout

- `al-form-elements` owns flex; `formRow([...])` = full-width row `formElementGroup`  
- Prefer `FORM_WIDTHS.half` for always side-by-side; `halfResponsive` stacks on narrow containers  
- Container queries: `@container al-form`

## Theming (CSS variables)

Set on a parent (or `:root`):

| Token | Default | Role |
|-------|---------|------|
| `--al-form-row-gap` | `0.25rem` | Flex row gap |
| `--al-form-column-gap` | `0.75rem` | Flex column gap (also used in `FORM_WIDTHS` calcs) |
| `--al-form-control-min-height` | `2rem` | Control chrome height |
| `--al-form-control-padding-block` | `0.25rem` | Input vertical padding |
| `--al-form-control-padding-inline` | `0.2rem` | Input horizontal padding (in chrome) |
| `--al-form-border` | `#c4c4c4` | Control border |
| `--al-form-focus` | `#ea580c` | Focus border (chrome + textarea) |
| `--al-form-invalid` | `#b00020` | Invalid border |
| `--al-picker-surface` | `#fff` | Date/time popover background |
| `--al-picker-radius` | `0.25rem` | Picker panel / cell radius |
| `--al-picker-selected-bg` | `--al-form-focus` | Selected day / time |
| `--al-picker-selected-fg` | `#fff` | Selected foreground |
| `--al-picker-hover-bg` | `rgba(0,0,0,.06)` | Hover |
| `--al-picker-muted` | `#9ca3af` | Overflow / disabled |
| `--al-picker-cell-size` | `2.25rem` | Calendar cell size |
| `--al-picker-panel-shadow` | soft shadow | Popover elevation |

Control chrome uses scoped classes (`al-control`, `al-control__action`, …). Override in global CSS:

```css
al-control-chrome.al-control {
  border-radius: 0.5rem;
}
:root {
  --al-form-focus: #0ea5e9;
  --al-picker-selected-bg: #0ea5e9;
}
```

## Date / time / datetime

String values match native HTML inputs (empty = `''`):

| Factory | Value format |
|---------|----------------|
| `formDate` | `yyyy-MM-dd` |
| `formTime` | `HH:mm` |
| `formDateTime` | `yyyy-MM-ddTHH:mm` |

```ts
f.date({
  path: 'birthDate',
  label: 'Birth date',
  props: { min: '1900-01-01', max: '2100-12-31', firstDayOfWeek: 1 },
});
f.time({ path: 'startTime', label: 'Start', props: { step: 15, min: '08:00', max: '18:00' } });
f.datetime({ path: 'appointment', label: 'Appointment', props: { step: 5 } });
```

Hybrid UX: native `date` / `time` / `datetime-local` input plus custom popover (calendar and/or HH:MM lists). Browser baseline: native `popover` + CSS anchor positioning.

Outside the form, use the standalone pickers with `[(value)]`:

```ts
import { AlDatePicker } from '@angular-libs/form';

// <al-date-picker [(value)]="birthDate" [rangeMin]="'1900-01-01'" />
```

Inside `al-signal-form`, `AlFormDate` binds the same control with `[formField]` (`props.min` / `props.max` map to `rangeMin` / `rangeMax`).
## Extending fields

```ts
provideFormFields({
  select: MyFormSelect,
  date: MyFormDate,
});
```

One-off without a new type: `formCustom({ path: 'start', props: { component: MyFormDate } })`.

## Submit / errors

Errors show when touched/dirty **or** after `markSubmitAttempted` / `markAllTouched`.

Plain HTML + minimal local CSS — no design-system coupling.
