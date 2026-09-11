# Competitive research: `@angular-libs/form`

Research-only. No library source was changed. Claims about **our** surface are traced to `projects/angular-libs/form` (read 2026-09-11 on `main`). Competitor claims cite public docs, not hearsay.

**Scope:** this package only. Other monorepo packages are out of scope.

**How to read scores:** 1–100. A high competitor score does not mean we should copy that product. It means that product ships a real, documented capability we lack or only partially cover.

---

## Positioning (what we actually are)

`@angular-libs/form` is a **config-driven UI layer** for Angular Signal Forms. The host owns `form(model, schema)` and the writable model signal. This library renders `elements[]`, field chrome, layout, and a powerful select. It does **not** own validation, disabled/readonly/hidden schema logic, submit orchestration, or the `FieldTree`.

Traced:

- README: “Host owns `form(model, schema)`. This library only renders UI.” (`projects/angular-libs/form/README.md`)
- `createForm` builds a `FormController` (elements + S2 `selectionDisplay` + submit-attempted helpers). It does not call `form()`. (`projects/angular-libs/form/src/lib/create-form.ts`)
- `<al-signal-form>` takes `input.required<FieldTree<TData>>()` and wraps `[formRoot]`. (`projects/angular-libs/form/src/lib/components/signal-form/signal-form.ts`)
- Most `AlForm*` adapters bind with `[formField]`. `AlFormSelect` does **not** — it writes ids/objects and `selectionDisplay` by hand. (`projects/angular-libs/form/src/lib/components/form/form-select.ts`)

That split is the load-bearing difference versus ngx-formly, ng-forge, JSON Forms, Form.io, SurveyJS, and ngx-schema-form: those libraries own (or generate) form state **and** UI from one config. We own UI only.

---

## Peer floor vs Signal Forms APIs

| Item | Our package | Official Signal Forms |
|------|-------------|------------------------|
| Peer | `@angular/core` / `common` / `forms` **≥ 21.0.0** (`projects/angular-libs/form/package.json`) | Status **Stable (v22+)** ([Comparison](https://angular.dev/guide/forms/signals/comparison)) |
| README | “≥ 21 (Signal Forms). Tested on **22**.” | v21 shipped Signal Forms as experimental / developer preview; v22 graduated them ([Angular v22 blog](https://blog.angular.dev/announcing-angular-v22-c52bb83a4664)) |
| Workspace | Root app uses `@angular/*` **^22.0.0** (`package.json`) | Recommended for new signal-based apps on v22+ ([Comparison](https://angular.dev/guide/forms/signals/comparison)) |

**APIs we consume (real):**

| API | Where we use it |
|-----|-----------------|
| `form()`, `required`, `min`, `max` | Host / demo only — not inside the library (`projects/demo/src/app/demos/form-demo.component.ts`) |
| `FieldTree`, `form().markAsTouched()`, `errorSummary()`, `focusBoundControl()`, `form().reset()` | `FormController` (`create-form.ts`) |
| `FormRoot` / `[formRoot]` | `AlSignalForm` |
| `FormField` / `[formField]` | `AlFormText`, number, textarea, checkbox, password, search, date/time/datetime, radio, switch, slider, file, color, tags, duration |
| `FormValueControl` / `FormCheckboxControl` | Standalone controls (`AlTextInput`, `AlDropdown`, `AlCheckbox`, …) |
| `field().disabled()`, `readonly()`, `invalid()`, `required()`, `errors()`, `value`, `touched()`, `dirty()` | `field-state.ts`, `AlField`, `AlFieldShell`, `AlFormSelect` |

**Signal Forms APIs that exist and we do not wire:**

| API | Official role | Our source |
|-----|---------------|------------|
| `hidden(path, { when })` + `field().hidden()` | Schema hide; hidden fields drop out of parent validity ([`hidden`](https://angular.dev/api/forms/signals/hidden), [model design](https://angular.dev/guide/forms/signals/model-design)) | UI `hide?: MaybeSignal<boolean>` only. `AlFormElementList.isHidden` never reads `field().hidden()`. |
| `disabled(path, { when })` / `readonly(path, { when })` | Schema logic ([model design](https://angular.dev/guide/forms/signals/model-design)) | We **read** `disabled()` / `readonly()` from the field. We do not author schema. |
| `pending()` | Async validation in progress ([essentials](https://angular.dev/essentials/signal-forms)) | No pending spinner / aria-busy on chrome. |
| `submitting()` + `submit(form, action)` | Submit lock + server errors mapped onto fields ([`submit`](https://angular.dev/api/forms/signals/submit)) | Host `trySubmit()` + `markAllTouched` / `focusFirstInvalid`. No `submit()`. |
| `applyEach` / `applyWhen` | Array item schemas + conditional schemas ([`applyEach`](https://angular.dev/api/forms/signals/applyEach)) | No array/repeat element type. `FormPath` treats arrays as leaves (`types.ts` `NestedKeyOf`). |
| `validate` / `validateAsync` / `debounce` | Custom + async validators ([essentials](https://angular.dev/essentials/signal-forms)) | Host schema. No pending UI. |
| `FormValueControl` optional inputs: `hidden`, `pending`, `disabledReasons`, `required`, `min`/`max`/`minLength`/`maxLength`, `pattern`, `name`, `dirty`, `touched` | Auto-bound by `[formField]` ([`FormValueControl`](https://angular.dev/api/forms/signals/FormValueControl)) | Typical control: `value`, `touch`, `disabled`, `readonly`, `invalid`. `AlNumberInput` / `AlSlider` expose `min`/`max` (schema can flow via `[formField]`). Date adapters map **props** `min`/`max`, not `FieldState.min`. |
| `FormValueControl.focus()` | Required for `focusBoundControl()` on custom controls ([field state](https://angular.dev/guide/forms/signals/field-state-management)) | No public `focus()` on `AlTextInput`, `AlDropdown`, pickers, etc. `focusFirstInvalid` still calls `focusBoundControl()`. |
| Native `[formField]` on `<select multiple>` | **Not supported** ([essentials](https://angular.dev/essentials/signal-forms)) | We implement multi via `AlDropdown` + S2 — this is a real gap in the peer, not in us. |

**Floor risk:** advertising `>=21` while depending on v22-stable `FieldState` helpers (`errorSummary`, `focusBoundControl`, `FormRoot`) is a compatibility claim we do not prove with a v21 CI matrix in this package. Treat **22** as the practical floor until 21 is re-tested against the current Signal Forms surface.

---

## A) Competitor inventory

| # | Library | What it is | Substrate | Why it is in this set | URLs |
|---|---------|------------|-----------|------------------------|------|
| 1 | **Angular Signal Forms** (`@angular/forms/signals`) | Platform form state: `form()`, schema, `FieldTree`, `[formField]` | Itself | Our peer and the only source of validity / disabled / hidden / submit | [Essentials](https://angular.dev/essentials/signal-forms), [`form`](https://angular.dev/api/forms/signals/form), [Comparison](https://angular.dev/guide/forms/signals/comparison) |
| 2 | **ngx-formly** (`@ngx-formly/core`) | JSON/config dynamic forms; types, wrappers, expressions, JSON Schema | Angular **Reactive Forms** | Default Angular config-form incumbent; themes (Material, Bootstrap, PrimeNG, Kendo, NG-ZORRO, Ionic) | [formly.dev](https://formly.dev/), [GitHub](https://github.com/ngx-formly/ngx-formly), [JSON Schema](https://github.com/ngx-formly/ngx-formly/blob/main/docs/json-schema.md), [Signal Forms issue](https://github.com/ngx-formly/ngx-formly/issues/4148) |
| 3 | **ng-forge Dynamic Forms** (`@ng-forge/dynamic-forms`) | Type-safe config forms **on Signal Forms**; adapters for Material / PrimeNG / Bootstrap / Ionic | Signal Forms | Closest product-shaped competitor: same substrate, more engine (validation, arrays, wizard, Standard Schema) | [Feature overview](https://ng-forge.com/dynamic-forms/material/feature-overview), [Formly migration](https://ng-forge.com/dynamic-forms/material/migrating-from-ngx-formly), [GitHub](https://github.com/ng-forge/ng-forge) |
| 4 | **Angular Material form-field** (`@angular/material/form-field`) | Design-system chrome: floating label, hint, error, prefix/suffix, appearance | Reactive Forms CVA + Signal Forms interop in v22 | Benchmark for field chrome / a11y / theming — not a config form engine | [Overview](https://material.angular.dev/components/form-field/overview), [v22 Material + Signal Forms](https://blog.angular.dev/announcing-angular-v22-c52bb83a4664), [select](https://material.angular.dev/components/select/overview) |
| 5 | **TanStack Form** (`@tanstack/angular-form`) | Headless typed form state; field/form validators; arrays; Standard Schema | Own store + Angular directive | Headless alternative to Signal Forms; no field widgets | [Angular overview](https://tanstack.com/form/latest/docs/framework/angular/overview), [validation](https://tanstack.com/form/latest/docs/framework/angular/guides/validation), [arrays](https://tanstack.com/form/latest/docs/framework/angular/guides/arrays) |
| 6 | **JSON Forms** (`@jsonforms/angular`) | JSON Schema + separate UI schema + renderer registry | Own core + Angular renderers (often Material) | Standards-based schema/UI split | [Angular package](https://www.npmjs.com/package/@jsonforms/angular), [API](https://jsonforms.io/api/angular/) |
| 7 | **Form.io** (`@formio/angular`) | JSON component schema + visual builder + optional backend that re-runs the same rules | Form.io renderer | Full platform: wizard, conditionals, server validation | [angular-formio](https://github.com/formio/angular-formio), [conditionals](https://help.form.io/form-building/logic-and-conditions), [logic everywhere](https://form.io/features/form-conditional-logic-form-validation/) |
| 8 | **ngx-schema-form** | Generate HTML forms from one JSON Schema; z-schema; custom widgets | Angular forms + z-schema | Lightweight JSON Schema renderer (Angular 21 peers) | [GitHub](https://github.com/guillotinaweb/ngx-schema-form/), [npm](https://www.npmjs.com/package/ngx-schema-form) |
| 9 | **SurveyJS Form Library** (`survey-angular-ui`) | JSON survey/form model: pages, branching, i18n, save-and-resume | survey-core + Angular UI | Multi-page / quiz / calculated-field class of product | [Get started](https://surveyjs.io/form-library/documentation/get-started-angular), [library](https://surveyjs.io/form-library) |
| 10 | **Angular Material form controls** (select, autocomplete, datepicker, chips) | Individual Material editors used *with* form-field | Same as #4 | Fair select/datepicker comparison against `AlDropdown` / pickers | [select](https://material.angular.dev/components/select/overview) |

**Not listed as primary (and why):** PrimeNG / NG-ZORRO / Kendo form widgets — component kits, not form engines (Formly/ng-forge already cover them as themes). `@ng-dynamic-forms` — older Reactive Forms generator, overlapping Formly. React-only TanStack Form composition — not on the Angular adapter yet ([v2 alpha](https://tanstack.com/blog/announcing-tanstack-form-v2-alpha)).

---

## B) Gap table

Missing = not present in our **library source** (host can sometimes DIY with Signal Forms + custom elements). Essentiality is for a config-driven Signal Forms UI used in CRUD / admin apps like the demo.

| Missing feature | Who has it | Essentiality (1–100) | Why |
|-----------------|------------|----------------------|-----|
| Honor Signal Forms `hidden()` when rendering | Signal Forms ([`hidden`](https://angular.dev/api/forms/signals/hidden)); ng-forge `logic: hidden` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); Formly `expressions.hide` ([properties](https://formly.dev/docs/guide/properties-options/)) | **92** | Schema hide excludes the field from parent validity. Our `hide` is display-only (`form-element-list.ts`) and does not call `field().hidden()`. Hosts who follow the official `@if (!field().hidden())` pattern get a second, unsynced hide channel. |
| Repeatable / array fields (add/remove rows, `applyEach`) | Signal Forms [`applyEach`](https://angular.dev/api/forms/signals/applyEach); Formly `fieldArray` ([API](https://formly.dev/docs/api/core/)); ng-forge `type: 'array'` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); TanStack `mode="array"` ([arrays](https://tanstack.com/form/latest/docs/framework/angular/guides/arrays)); JSON Forms / Form.io / SurveyJS array widgets | **90** | `FormPath` / `NestedKeyOf` stop at array keys (`types.ts`). No `formArray` factory, no per-index `resolveFormField`. Demo model has no object arrays. Every real CRUD form hits line items. |
| `submit()` + `submitting()` + server field errors | Signal Forms [`submit`](https://angular.dev/api/forms/signals/submit); TanStack `onSubmit` / `isSubmitting` ([overview](https://tanstack.com/form/latest/docs/framework/angular/overview)); ng-forge `(submitted)` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **88** | We expose `markSubmitAttempted` / `markAllTouched` / `focusFirstInvalid` (`create-form.ts`). Demo `trySubmit()` does not call `submit()` and does not map HTTP errors onto `FieldTree`. Concurrent-submit lock and `submitting()` are unused. |
| `FormValueControl.focus()` so `focusBoundControl()` works on custom controls | Signal Forms custom-control contract ([field state](https://angular.dev/guide/forms/signals/field-state-management)) | **86** | `focusFirstInvalid` loops `errorSummary()` and calls `focusBoundControl()`. Official docs: without `focus()`, custom controls get **no** focus. None of `AlTextInput`, `AlDropdown`, pickers, etc. implement `focus()`. Select is worse: no `[formField]`, so the field may have **no** bound control. |
| Async validation pending UI | Signal Forms `pending()` ([essentials](https://angular.dev/essentials/signal-forms)); Formly async validators ([validation](https://formly.dev/docs/guide/validation/)); TanStack `onChangeAsync` ([validation](https://tanstack.com/form/latest/docs/framework/angular/guides/validation)); ng-forge HTTP validators ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **78** | Hosts can `validateAsync` today; chrome never reads `pending()`. Dropdown loading is the only spinner (`al-dropdown.ts`). |
| Config-level expressions (hide/disable/require/derive from other fields) | Formly `expressions` ([guide](https://formly.dev/docs/guide/properties-options/)); ng-forge `logic` + `derivation` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); Form.io Logic tab ([docs](https://help.form.io/form-building/logic-and-conditions)); SurveyJS expressions ([library](https://surveyjs.io/form-library)) | **76** | We allow `MaybeSignal` on `hide` / `label` / `hint` / `readonly` (`types.ts`). That is host-computed, not a declarative graph. Fine for typed apps; weak for JSON-driven / builder-driven forms. |
| Nested object groups bound to a `FieldTree` subtree | Signal Forms nested `loginForm.email` ([essentials](https://angular.dev/essentials/signal-forms)); Formly `fieldGroup` + `key` ([properties](https://formly.dev/docs/guide/properties-options/)); ng-forge `type: 'group'` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **74** | `AlFormGroup` is **layout** (`form-group.ts`): same root `form` is passed down. `FormPath` is depth-2 (`Prev = [never, 0, 1, 2]` in `types.ts`). Runtime `resolveFormField` can walk deeper dots, but factories do not type `a.b.c`. |
| JSON Schema / OpenAPI → elements | Formly `FormlyJsonschema` ([docs](https://github.com/ngx-formly/ngx-formly/blob/main/docs/json-schema.md)); JSON Forms; ngx-schema-form; ng-forge OpenAPI generator ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **62** | Our config is TypeScript factories + functions (`loadItems`, `onCreate`). It is not JSON-serializable and cannot be stored as a backend spec without a compiler. |
| Standard Schema (Zod / Valibot / ArkType) in the UI layer | TanStack ([validation](https://tanstack.com/form/latest/docs/framework/angular/guides/validation)); ng-forge `standardSchema(...)` ([migration](https://ng-forge.com/dynamic-forms/material/migrating-from-ngx-formly)) | **55** | Correctly **host-owned** if we stay “UI only”. Still a gap vs engines that generate both schema and fields from one Zod object. |
| Multi-step / wizard / pages | ng-forge pages ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); Form.io wizard; SurveyJS pages ([get started](https://surveyjs.io/form-library/documentation/get-started-angular)) | **48** | Out of current README scope. Needed for onboarding / long legal forms, not the demo CRUD form. |
| Design-system adapters (Material / PrimeNG / Bootstrap) | Formly themes ([formly.dev](https://formly.dev/)); ng-forge adapters ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); JSON Forms Material renderers | **47** | We deliberately ship plain HTML + CSS variables (`README.md`). Apps on Material still rebuild chrome or wrap `formCustom`. |
| Field wrappers (card / panel / label stack as composable layers) | Formly `wrappers` ([API](https://formly.dev/docs/api/core/)); ng-forge `wrappers` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **44** | We have a single `AlField` + `AlFieldShell` + `AlControlChrome` stack. Override is `provideFormFields` or `formCustom`, not wrap-composition. |
| Floating label + appearance variants + reserved hint slot | Material form-field ([overview](https://material.angular.dev/components/form-field/overview), [source md](https://github.com/angular/components/blob/main/src/material/form-field/form-field.md)) | **40** | `AlField` is static label + footer that **collapses** when empty (`field.ts` `:has(...)`). Material’s `subscriptSizing` avoids layout jump. |
| i18n catalog for labels / errors / picker strings | SurveyJS; ng-forge i18n Signals/Observables ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)); Formly `validationMessages` ([validation](https://formly.dev/docs/guide/validation/)) | **42** | Labels are `MaybeSignal<string>`. Date `months` / `weekdays` / `clearText` are per-field props. No message map keyed by `error.kind`. |
| File upload as a first-class engine feature (progress, remote) | Form.io / SurveyJS file questions; ng-forge documents **no** built-in file type ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)) | **38** | We **do** have `formFile` (`AlFileInput`). `maxFiles` is “soft UI hint” (`types.ts`). No drag-drop, no upload, no progress. |
| Date range / datetime as `Date` objects | Material datepicker range; Signal Forms model-design date example uses `Date \| null` ([model design](https://angular.dev/guide/forms/signals/model-design)) | **36** | We store HTML-native strings (`yyyy-MM-dd`, `HH:mm`, `yyyy-MM-ddTHH:mm`) — aligned with Signal Forms **native** date inputs ([essentials](https://angular.dev/essentials/signal-forms)), not range or `Date`. |
| Visual form builder | Form.io; SurveyJS Creator ([docs](https://surveyjs.io/survey-creator/documentation/get-started-angular)) | **28** | Not our audience if configs stay in TypeScript. |
| Dropdown virtualization for huge lists | Typical data-grid / CDK virtual scroll; our datasource only **pages** on scroll (`datasource.ts`, `onPanelScroll`) | **34** | Paging helps network; DOM still grows with loaded rows. |

---

## C) Parity table

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
|---------|--------------|---------------------|-----------|------------------|-------|
| Form state ownership | Host `form(model, schema)`; library is UI (`README.md`, `create-form.ts`) | Signal Forms: host. Formly/ng-forge/JSON Forms/Form.io: library builds state from config. TanStack: `injectForm()`. | **92** | Signal Forms **95**; Formly **88**; ng-forge **90**; TanStack **90** | Our split matches official “model is source of truth” ([`form`](https://angular.dev/api/forms/signals/form)). We lose “one object renders + validates”. |
| Validation | Host schema only. UI prints `errors().message \|\| kind` (`field.ts`) | Signal Forms schema validators. Formly field `validators`. ng-forge shorthand + Standard Schema. TanStack field/form + Zod. | **70** | Signal Forms **96**; Formly **90**; ng-forge **93**; TanStack **94** | Correct for “UI only”. Weak vs engines that colocate `required: true` on the field config. |
| Config-driven field list | `createForm({ elements })` + `formFactories<T>()` (`factories/index.ts`) | Formly `fields[]`. ng-forge `FormConfig`. JSON Forms UI schema. | **88** | Formly **94**; ng-forge **92** | Ours is typed to `TData` (depth 2). Theirs serialize to JSON more easily. |
| Path typing | `FormPath<TData>` depth 2; arrays are leaves (`types.ts`) | Signal Forms: full `FieldTree` typing. TanStack: `name` string unions. ng-forge: `InferFormValue`. | **72** | Signal Forms **96**; ng-forge **90**; TanStack **88** | Runtime `resolveFormField` walks any dots (`resolve-field.ts`). Types do not. |
| Field registry | `FormFieldRegistry` + `provideFormFields` + `formCustom` | Formly `types` / wrappers. ng-forge `provideDynamicForm` + mappers. JSON Forms renderers. | **86** | Formly **93**; ng-forge **90** | We have parent-chain registry (`form-field-registry.ts`). No wrapper stack, no lazy `import()` per type (ng-forge advertises that). |
| `[formField]` / `FormValueControl` | Standalone controls implement the contract; most adapters bind `[formField]` | Signal Forms native + custom ([custom controls](https://angular.dev/guide/forms/signals/custom-controls)). Material via CVA interop in v22 ([blog](https://blog.angular.dev/announcing-angular-v22-c52bb83a4664)). | **80** | Signal Forms **94**; Material **82** | **Select exception:** `AlFormSelect` manually `state.value.set` — not `[formField]` (`form-select.ts`). Optional FVC inputs mostly unimplemented. |
| Disabled / readonly | Read `field().disabled()` / `readonly()` + element `readonly` MaybeSignal (`field-state.ts`) | Signal Forms schema `disabled`/`readonly`. Formly expressions. Material `disabled` input. | **84** | Signal Forms **95**; Formly **88** | Schema-driven disable **works** if the host sets it. We do not hide on `hidden()`. |
| Error reveal | Touched **or** dirty **or** `submitAttempted` (`field.ts`, `field-shell.ts`) | Material: interact or parent submit ([form-field.md](https://github.com/angular/components/blob/main/src/material/form-field/form-field.md)). Signal Forms examples use touched only ([comparison](https://angular.dev/guide/forms/signals/comparison)). | **86** | Material **90**; Signal Forms examples **80** | Our submit-attempted flag is the right UX for untouched required fields. Not wired to `submit()`. |
| Focus first invalid | `errorSummary()` + `focusBoundControl()` (`create-form.ts`) | Signal Forms primitive ([`FieldState`](https://angular.dev/api/forms/signals/FieldState)). | **58** | Signal Forms **90** | Helper exists; custom controls lack `focus()`; select often unbound. |
| Layout | Flex + `@container al-form` + `FORM_WIDTHS` / `formRow` (`form-widths.ts`, `form-item.ts`) | Formly `fieldGroupClassName` / CSS. JSON Forms HorizontalLayout. ng-forge rows/containers. Material: none (page CSS). | **90** | Formly **78**; JSON Forms **80**; ng-forge **85**; Material **40** | Gap-aware half/third/quarter and 12-col presets are a real strength. |
| Field chrome (label, required *, hint, errors, help) | `AlField`: label, `*`, `?` title help, error list, hint, meta (`field.ts`) | Material: float label, `mat-hint` start/end, `mat-error`, `subscriptSizing`. | **78** | Material **92** | We win simplicity / no MDC. They win float label, dual hints, reserved subscript, a11y polish. `labelHelp` is `title` only — not a real tooltip/dialog. |
| Control chrome (prefix/suffix/clear) | `AlControlChrome` + `FormControlChromeProps` | Material `matPrefix` / `matSuffix`. ng-forge `addons` ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)). | **86** | Material **90**; ng-forge **88** | Clear-on-escape, trail actions, composing guard (`field-shell.ts`). No icon registry / copy-paste presets. |
| Theming | CSS variables, no CDK (`README.md`) | Material M3. Formly/ng-forge adapters. SurveyJS themes. | **80** | Material **94**; Formly **88** | Intentional. Token set is small but coherent. |
| Text / number / textarea / password / search | Built-in factories + adapters | All engines + Material `matInput` | **88** | Material **90**; Formly **88** | Password show/hide (`password-input.ts`). Search debounce `onSearch` (`types.ts`). Number empty → `null`. `FormNumberProps.min/max` are **not** passed in `form-number.ts` (schema min/max can still bind via FVC `min`/`max` inputs). |
| Checkbox / switch / radio / slider | Built-ins; slider min/max from **schema** via FVC (`form-slider.ts` does not set props min/max; `AlSlider` has the inputs) | Material + Formly types + ng-forge selection types | **85** | Material **88**; ng-forge **86** | Radio is a flat option list — no async options. |
| Date / time / datetime | Hybrid native input + popover calendar/lists; string model (`README.md`, `form-date.ts`) | Signal Forms native `type="date"`. Material datepicker (`Date`). | **84** | Material **88**; Signal Forms native **70** | Localization hooks (`months`, `weekdays`, `firstDayOfWeek`). No range, no timezone. |
| Duration | `formDuration` → total seconds (`types.ts`, README) | Rare as a built-in (usually custom) | **90** | Formly/Material **25** | Differentiator. Paste `"1:30:00"` / `"01:30"`. |
| Tags | `formTags` → `string[]` | Material chips; Formly custom | **82** | Material chips **85** | Separate from creatable **select** (ids vs free strings). |
| File | `File \| File[] \| null`; `accept`; soft `maxFiles` (`form-file.ts`, `file-input.ts`) | Form.io/SurveyJS richer; ng-forge none built-in | **70** | Form.io **85**; ng-forge **20** | Native `<input type="file">` + name list. No dropzone. |
| Color | `#rrggbb` + optional hex | Browser/Material color | **80** | — **70** | Small, complete. |
| Select / dropdown | `AlDropdown`: Popover API, search, multi chips, `loadItems`, paged `datasource`, groupBy, columns, checkboxes, footer, creatable, tree (`al-dropdown.ts`, `types.ts`) | Material `mat-select` / autocomplete. Formly `select`. ng-forge select + HTTP options. | **91** | Material select **72**; Formly default **68**; ng-forge select **78** | This is our sharpest product edge. Native Signal Forms `<select multiple>` is unsupported ([essentials](https://angular.dev/essentials/signal-forms)). |
| ID-in-model + label cache (S2) | `valueMode: 'id'` + `seedSelection` / `selectionDisplay` (`create-form.ts`, `selection.ts`) | Usually store objects or re-fetch labels. Formly model often holds the primitive only (closed UI blank until options load). | **93** | Formly **45**; Material **40**; ng-forge **50** | Documented edit-hydrate path. Unique among this set. |
| Async / paged options | `loadItems` + `datasource.loader` with `AbortSignal`, chunk, debounce (`datasource.ts`) | ng-forge HTTP derivation ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)). Formly custom type. | **88** | ng-forge **86**; Formly **70** | Errors show in the **open panel**, not field chrome (`README.md`). |
| Tree select | `tree.childrenKey` / `getChildren` / `selectDescendants` (`types.ts`, `tree.ts`) | Usually a separate tree widget | **87** | Material **30**; Formly **35** | Columns disabled when tree is on (`form-select.ts`). |
| Creatable select | `onCreate` required in id mode (`create.ts`) | Material chips-with-input; custom Formly | **86** | Material **75** | Correct S2 safety (no fake ids). |
| Custom field | `formCustom({ component, inputs })` + registry override | All engines | **84** | Formly **92**; ng-forge **90** | Outlet always injects `field/element/form/controller` (`form-custom.ts`). |
| Standalone controls outside the form | Exported `Al*Input` / `AlDropdown` with `[(value)]` (`public-api.ts`) | Material always standalone. TanStack is always DIY widgets. Formly types are form-bound. | **90** | Material **95**; TanStack **40**; Formly **55** | Honest dual use. |
| Dev diagnostics | `warnInvalidFormSetup` unknown type + unresolved path (`validate-elements.ts`) | Formly runtime errors. ng-forge `DynamicFormError`. | **80** | Formly **75**; ng-forge **82** | Dev-only, warn-once. |
| Grid bridge | `toColumnDefs` flattens groups; maps a few types (`to-column-defs.ts`) | None of the form engines target a data grid | **60** | — **20** | Thin: password/search → `text`; select → `text`; skips date/file/custom; `editable: true` always. |
| Accessibility | Label `for`, `aria-describedby`, combobox/listbox/tree attrs (`field.ts`, `al-dropdown.ts`) | Material + Angular Aria (v22). SurveyJS claims 20+ accessible types. | **68** | Material **90**; SurveyJS **86** | Help is `title`. Errors are a `<ul>` without `aria-live`. Dropdown search + trigger keyboard is real (`keyboard.ts`). Popover/anchor needs modern browsers (`README.md`). |
| Bundle / deps | `tslib` only; no CDK (`package.json`) | Material/CDK. Formly + theme. ng-forge “batteries-included” ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)). | **94** | Material **55**; Formly **60**; ng-forge **50** | Matches “plain HTML” claim. |
| Angular version | Peers **≥21**, tested 22 | Signal Forms stable **22**. ng-forge FAQ: Angular **22** peers. Formly 7: Angular **≥18** Reactive Forms. | **70** | ng-forge **85**; Formly **80**; Signal Forms **95** | Floor vs stable APIs — see peer section. |

---

## D) Improvement backlog

Priority is “should we do this next if we stay a Signal Forms **UI** library” — not “become Formly”.

| Improvement | Priority (1–100) | Rationale |
|-------------|------------------|-----------|
| Honor `field()?.()?.hidden()` in `AlFormElementList` / `AlFormItem` (in addition to `element.hide`) | **94** | Cheap, official, and currently wrong for hosts who use `hidden()` in schema. Cite: [`hidden`](https://angular.dev/api/forms/signals/hidden) vs `isHidden` in `form-element-list.ts`. |
| Implement `focus()` on every `FormValueControl` (and bind select with a focusable host) so `focusFirstInvalid` works | **93** | We already advertise the helper (`README.md`, `create-form.ts`). Official contract: custom controls need `focus()` ([field state](https://angular.dev/guide/forms/signals/field-state-management)). Select has no `[formField]`. |
| Repeatable section element: `formArray` / `formRepeat` over `FieldTree` arrays + `applyEach` | **91** | Largest product hole vs Formly `fieldArray`, ng-forge `array`, TanStack arrays, and Signal Forms itself. Path typing must grow past “array is a leaf”. |
| Optional `submit(form, action)` wrapper on `FormController` (or a tiny `submitForm` helper) that sets `submitAttempted`, maps returned field errors, and exposes `submitting` | **89** | Hosts reinvent this (`form-demo.component.ts` `trySubmit`). Platform already has [`submit`](https://angular.dev/api/forms/signals/submit) + `submitting()`. |
| Pending chrome: read `field().pending()` (spinner, `aria-busy`, disable submit slot) | **82** | Unblocks `validateAsync` / `debounce` without owning validators. |
| Raise documented floor to Angular **22** (or add a v21 compatibility test job) | **81** | Official stable is v22 ([comparison](https://angular.dev/guide/forms/signals/comparison)). Peers say 21 (`package.json`). |
| Bind remaining `FormValueControl` optionals that we already have state for: `required`, `invalid` (done on some), `min`/`max` on date/time, `minLength`/`maxLength` on text/textarea | **80** | `[formField]` will then sync schema constraints into native attributes ([`FormValueControl`](https://angular.dev/api/forms/signals/FormValueControl)). Date currently ignores `FieldState.min` (`form-date.ts` uses props). |
| Deep `FormPath` (depth 4+) and optional `a.b.c` factory typing | **78** | Runtime already walks dots. Types lie after two segments (`types.ts`). |
| Layout group vs **value** group: bind `path` on `group` to a nested `FieldTree` | **76** | Matches Signal Forms nesting and ng-forge’s group-vs-container warning ([overview](https://ng-forge.com/dynamic-forms/material/feature-overview)). |
| Declarative hide/disable/require helpers that **compile to** Signal Forms `hidden`/`disabled`/`readonly` (or document a recipe) | **74** | Do not invent a second expression language. Bridge to the peer. Formly/ng-forge win here today. |
| Surface datasource/load errors on the field (not only the open panel) | **72** | Closed select with a failed hydrate looks empty. `seedSelection` does not cover loader failure. |
| `aria-live` (or `role="alert"`) for error lists; replace `title` help with an accessible description | **71** | Material/SurveyJS set the a11y bar. `labelHelp` is hover-only (`field.ts`). |
| Pass `FormNumberProps.min/max` through `AlFormNumber` (or delete them from the type if schema-only) | **64** | Types promise props (`types.ts`); adapter does not bind them (`form-number.ts`). Schema still can via FVC inputs. |
| Virtualize long dropdown lists (keep paged `datasource`) | **58** | Paging ≠ virtualization (`onPanelScroll` appends DOM). |
| File: enforce `maxFiles`, drag-drop, clearer empty/replace UX | **56** | `maxFiles` is documented as soft (`types.ts`). |
| Optional Material (or Aria) chrome adapter via `provideFormFields` | **52** | Registry already allows swaps. A first-party Material shell would close the theme gap without owning validation. |
| JSON Schema / Zod → `elements[]` codegen (not runtime engine) | **50** | Keeps “host owns `form()`”. Competes with FormlyJsonschema / ng-forge OpenAPI without swallowing the substrate. |
| Wizard / pages | **35** | Leave to SurveyJS/Form.io/ng-forge unless we get a concrete app need. |
| Visual builder | **15** | Out of scope for a typed factory library. |

---

## Source map (ours)

| Claim | File |
|-------|------|
| UI-only controller | `projects/angular-libs/form/src/lib/create-form.ts` |
| Peers ≥21 | `projects/angular-libs/form/package.json` |
| Public surface | `projects/angular-libs/form/src/public-api.ts`, `README.md` |
| Element types + S2 select props | `projects/angular-libs/form/src/lib/types.ts` |
| Path depth 2 / arrays as leaves | `NestedKeyOf` in `types.ts` |
| Root `[formRoot]` | `projects/angular-libs/form/src/lib/components/signal-form/signal-form.ts` |
| Registry | `registry/provide-form-fields.ts`, `register-built-ins.ts` |
| Hide is UI-only | `components/layout/form-element-list.ts` |
| Select S2 bridge | `components/form/form-select.ts`, `components/dropdown/selection.ts` |
| Dropdown capabilities | `components/dropdown/al-dropdown.ts`, `datasource.ts`, `create.ts`, `tree.ts` |
| Error policy | `components/field/field.ts`, `field-shell/field-shell.ts` |
| Layout / widths | `constants/form-widths.ts`, `components/layout/form-item.ts` |
| Tests covering factories / S2 / registry | `src/lib/form.spec.ts`, `components/dropdown/dropdown.spec.ts` |
| Host usage | `projects/demo/src/app/demos/form-demo.component.ts` |

---

## Competitor URLs (index)

- https://angular.dev/essentials/signal-forms
- https://angular.dev/guide/forms/signals/comparison
- https://angular.dev/guide/forms/signals/model-design
- https://angular.dev/guide/forms/signals/custom-controls
- https://angular.dev/guide/forms/signals/field-state-management
- https://angular.dev/api/forms/signals/form
- https://angular.dev/api/forms/signals/FormValueControl
- https://angular.dev/api/forms/signals/hidden
- https://angular.dev/api/forms/signals/submit
- https://angular.dev/api/forms/signals/applyEach
- https://blog.angular.dev/announcing-angular-v22-c52bb83a4664
- https://formly.dev/
- https://formly.dev/docs/guide/properties-options/
- https://formly.dev/docs/guide/validation/
- https://github.com/ngx-formly/ngx-formly
- https://github.com/ngx-formly/ngx-formly/blob/main/docs/json-schema.md
- https://github.com/ngx-formly/ngx-formly/issues/4148
- https://ng-forge.com/dynamic-forms/material/feature-overview
- https://ng-forge.com/dynamic-forms/material/migrating-from-ngx-formly
- https://github.com/ng-forge/ng-forge
- https://material.angular.dev/components/form-field/overview
- https://material.angular.dev/components/select/overview
- https://github.com/angular/components/blob/main/src/material/form-field/form-field.md
- https://tanstack.com/form/latest/docs/framework/angular/overview
- https://tanstack.com/form/latest/docs/framework/angular/guides/validation
- https://tanstack.com/form/latest/docs/framework/angular/guides/arrays
- https://www.npmjs.com/package/@jsonforms/angular
- https://jsonforms.io/api/angular/
- https://github.com/formio/angular-formio
- https://help.form.io/form-building/logic-and-conditions
- https://github.com/guillotinaweb/ngx-schema-form/
- https://surveyjs.io/form-library/documentation/get-started-angular

---

## Bottom line

`@angular-libs/form` is already strong as a **thin, typed Signal Forms renderer** with an unusually capable select (S2 ids, tree, columns, paged datasource, creatable) and serious flex/container layout. It is **not** a Formly/ng-forge-class engine: it does not own validation, arrays, wizards, JSON Schema, or schema `hidden()`.

The closest competitor on substrate is **ng-forge**. The closest on config culture is **ngx-formly** (still Reactive Forms; Signal Forms support is not shipped — [issue 4148](https://github.com/ngx-formly/ngx-formly/issues/4148)). The platform features we must not ignore are `hidden()`, `submit()` / `submitting()`, `pending()`, `applyEach`, and `FormValueControl.focus()`.

Highest-leverage work stays on the Signal Forms seam (hidden, focus, arrays, submit/pending) rather than cloning a visual builder.
