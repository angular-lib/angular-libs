# Competitive research: `@angular-libs/shortcut`

Research only. No library source was changed. Claims about **our** package are traced to `projects/angular-libs/shortcut` as of this document. Competitor claims are traced to published README/source/docs; URLs are cited per row.

- **Package:** `@angular-libs/shortcut` `0.0.1` (`projects/angular-libs/shortcut/package.json`)
- **Peers:** `@angular/core` and `@angular/common` `>=22.0.0`
- **Secondary UI entry:** `@angular-libs/shortcut/plugins` (`projects/angular-libs/shortcut/plugins/src/public-api.ts`)
- **Date:** 2026-09-11

## Our product (source-traced)

`@angular-libs/shortcut` is a zoneless, SSR-gated keyboard shortcut manager with capture-phase `document` listeners, a functional plugin host, and two experimental imperative DOM overlays (command palette, Vimium-style hints).

### Public surface

| Surface | Location | What it actually does |
|---|---|---|
| `ALShortcutService` | `src/lib/shortcut.service.ts` | Root injectable. Registers shortcuts, plugins, layout map, `trigger()`, `getShortcuts()`, `getConflicts()`. |
| `provideShortcut()` | `src/lib/provide-shortcut.ts` | Supplies `SHORTCUT_CONFIG` only. Does **not** provide the service (service is `providedIn: 'root'`). |
| `onShortcut()` | `src/lib/shortcut.hooks.ts` | Injection-context helper; auto-unregisters via `DestroyRef`. |
| `[alShortcut]` | `src/lib/shortcut.directive.ts` | Signal-input directive; element-scoped unless `alShortcutGlobal`. |
| Headless plugins | `src/public-api.ts` | `inputSuppressorPlugin`, `chordPlugin`, `twicePlugin`, `contextGuardPlugin`, `rebindPlugin`. |
| UI plugins | `plugins/src/public-api.ts` | `commandPalettePlugin`, `visualHintsPlugin` (`@experimental`). |

### Real capabilities (not README marketing)

| Capability | Evidence |
|---|---|
| Capture-phase `keydown` + `keyup` on `document` | `shortcut.service.ts` constructor: `addEventListener(..., true)` only when `window` and `DOCUMENT` exist. |
| Physical layout mapping | Constructor calls `navigator.keyboard.getLayoutMap()`; `resolveShortcutFromEvent()` uses `layoutMap` / `event.code` when modifiers are held (`shortcut.utils.ts`). |
| `mod` + synonyms | `normaliseShortcut()`: `mod` → Meta on Apple else Ctrl; `cmd`/`command`/`⌘` → `meta`; `esc` → `escape`; `option`/`⌥` → `alt`; `control`/`ctl` → `ctrl`. |
| `when()` skip | Both `handleKeyEvent()` and `trigger()` skip when `when()` is false. |
| Priority sort | `register()` sorts by descending `priority`. **All matching global handlers still run**; only element-scoped matches `break` after the first hit. |
| Plugin hooks | `onKeyEvent`, `onResolveShortcut`, `onBeforeExecute`, `onAfterExecute`, `onGetDisplayShortcut`, `onInit`, `onDestroy`. Registration order = hook order. Idempotent `registerPlugin` by `id`. |
| Input suppression | **Plugin, not core.** `inputSuppressorPlugin` returns `false` from `onBeforeExecute` for `INPUT` / `TEXTAREA` / `SELECT` / `contentEditable`, with normalised exceptions. |
| Sequences | **Plugin-only.** `chordPlugin` keeps a private list; `onKeyEvent` consumes exact matches. Not in `getShortcuts()`. |
| Double-tap | **Plugin-only.** `twicePlugin` on `keyup`. Not in `getShortcuts()`. |
| Contexts | `contextGuardPlugin` named contexts + allow/block rules (whitelist semantics for `allow`). Uses `onBeforeExecute`. |
| Rebind | `rebindPlugin` remaps **default shortcut strings** (not ids), persists `localStorage`, `onResolveShortcut` / `onGetDisplayShortcut`. `rebuild()` is a documented no-op. |
| Programmatic `trigger()` | Looks up by normalised key or display remap; filters optional descriptor fields; synthesizes a `KeyboardEvent`; runs `when()` + `action` + `onAfterExecute`. |
| Command palette | Imperative DOM overlay. Substring match on shortcut / description / `group`. Executes via `host.trigger(item)`. |
| Visual hints | Vimium-style labels for `a, button, input, select, textarea, [role="button"], [tabindex], .clickable`. |
| Conflicts | `getConflicts()` reports normalised keys with `list.length > 1`. Ignores `when()`, element scope, and plugin-owned chords. |

### Known issue still present: `trigger()` bypasses `onBeforeExecute`

`handleKeyEvent()` runs every plugin `onBeforeExecute` and aborts if any returns `false` (`shortcut.service.ts`):

```ts
for (const plugin of this.plugins) {
  if (plugin.onBeforeExecute) {
    if (plugin.onBeforeExecute(activeShortcut, event, target) === false) {
      return;
    }
  }
}
```

`trigger()` does **not** call `onBeforeExecute`. It only checks `when()`, sets `latestTriggerDetail` with `target: null`, runs `action`, then `onAfterExecute` (`shortcut.service.ts`):

```ts
for (const item of matchedItems) {
  if (item.when && !item.when()) {
    continue;
  }
  this.latestTriggerDetail.set({ shortcut: normalised, event, target: null });
  item.action(event);
  for (const plugin of this.plugins) {
    plugin.onAfterExecute?.(normalised, event, null);
  }
}
```

The experimental palette uses that path (`command-palette.plugin.ts`):

```ts
function handleCommandTrigger(item: ALShortcutDescriptor): void {
  if (!hostRef) return;
  try {
    hostRef.trigger(item);
  } catch (e) {
    console.error('Failed to trigger action:', e);
  }
  closePalette();
}
```

Consequences still present:

1. `inputSuppressorPlugin` and `contextGuardPlugin` do not apply to `trigger()` / palette execution.
2. `trigger()` also skips `type`, `allowRepeat`, element-scope, `preventDefault` / `stopPropagation` / `stopImmediatePropagation`, `onKeyEvent`, and `onResolveShortcut`.
3. Specs cover `trigger()` success (`shortcut.spec.ts`) but do **not** assert `onBeforeExecute` on that path.

`PRODUCTION-BUGS.md` B24 (context-guard normalisation) and B25 (`trigger('mod+s')` synthetic modifiers) are marked fixed and match current source. The `onBeforeExecute` bypass was **not** in that list and is still open.

---

## A) Competitor inventory

Eleven libraries. Included because they are either named in the brief, widely installed Angular hotkey packages, the modern signals/TanStack peers, the JS engines Angular wrappers sit on, or IDE-style palettes that overlap our experimental UI entry.

| # | Library | Kind | Angular / engine | Weekly npm (approx.) | Last notable publish | Why it is in scope | URLs |
|---|---|---|---|---|---|---|---|
| 1 | `@ngneat/hotkeys` | Angular hotkeys | Angular ≥17.2 (3.x); 4.1.0 built against 17.2 | ~8.2k | 4.1.0, 2025-02-04 | Named. Declarative directive + RxJS service + help component + sequences + pause. | [npm](https://www.npmjs.com/package/@ngneat/hotkeys) · [GitHub](https://github.com/ngneat/hotkeys) · [4.1.0 bundle](https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/fesm2022/ngneat-hotkeys.mjs) |
| 2 | `angular2-hotkeys` | Angular + **Mousetrap** | Officially Angular 16; 16.0.1 | ~42–45k | 16.0.1, 2023-08 | Named. Highest-download Angular hotkey lib. Cheat sheet, `allowIn`, pause, `mod`. | [npm](https://www.npmjs.com/package/angular2-hotkeys) · [GitHub](https://github.com/brtnshrdr/angular2-hotkeys) · [README](https://raw.githubusercontent.com/brtnshrdr/angular2-hotkeys/master/README.md) |
| 3 | `@balticcode/ngx-hotkeys` | Angular + Mousetrap (port of #2) | Angular 6-era `NgModule.forRoot` | Low / legacy | Angular-6 port; `ng add` | Named `ngx-hotkeys`. Same cheat-sheet / pause / register model as #2. | [GitHub](https://github.com/BalticCode/ngx-hotkeys) · [demo](https://balticcode.github.io/ngx-hotkeys/) |
| 4 | `ngx-keys` | Angular hotkeys (signals) | Peer `@angular/*` `^21.0.6` | ~110 | 1.21.1, 2026-01-05 | Closest modern peer: signals UI, groups, sequences, filters, conflict-on-activate. | [GitHub](https://github.com/mrivasperez/ngx-keys) · [lib README](https://github.com/mrivasperez/ngx-keys/blob/develop/projects/ngx-keys/README.md) · [npm](https://www.npmjs.com/package/ngx-keys) |
| 5 | `@tanstack/angular-hotkeys` | Angular adapter of TanStack Hotkeys | Peer `@angular/*` `>=19` | ~3.4k | 0.10.0, 2026-06-30 | Modern `injectHotkey` / sequences / recorder / `Mod` / `ignoreInputs` / registrations signal. | [docs](https://tanstack.com/hotkeys/latest/docs/framework/angular/quick-start) · [hotkeys guide](https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkeys) · [recorder](https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkey-recording) · [npm](https://www.npmjs.com/package/@tanstack/angular-hotkeys) |
| 6 | `ng-keyboard-shortcuts` | Angular hotkeys + help modal | Documented Angular 5–13; 13.0.8 | ~8–12k | 13.0.8, 2022-08-16 | Sequences (Gmail / Konami), `allowIn`, help screen, target element, select Observable. | [npm](https://www.npmjs.com/package/ng-keyboard-shortcuts) · [README](https://cdn.jsdelivr.net/npm/ng-keyboard-shortcuts@13.0.8/README.md) · [demo](https://omridevk.github.io/ng-keyboard-shortcuts) |
| 7 | `@phalgunv/ngx-keyboard-shortcuts` | Angular directive bindings | Versions for Angular 16–21 | ~0.9k | v19/v21 line | Maintained fork of archived `ngx-keyboard-shortcuts`. Directive-first, not a plugin host. | [GitHub](https://github.com/phalgunv/ngx-keyboard-shortcuts) · [npm](https://www.npmjs.com/package/@phalgunv/ngx-keyboard-shortcuts) |
| 8 | `hotkeys-js` | JS engine (no official Angular wrapper) | Framework-agnostic | ~695k | 4.0.8, 2026-09-09 | The other dominant JS engine besides Mousetrap. Scopes, `filter`, `trigger`, capture option. Angular apps wrap it themselves; no widely adopted first-party Angular package. | [npm](https://www.npmjs.com/package/hotkeys-js) · [docs](https://jaywcjlove.github.io/hotkeys-js) · [GitHub](https://github.com/jaywcjlove/hotkeys-js) |
| 9 | `@theryansmee/ngx-command-palette` | IDE command palette (not a hotkey manager) | Angular 19–22 tags; latest peers `^22` + CDK | Very low | 2026 (Angular 22 line) | Named class of competitor: fuzzy palette, route auto-register, recents, nested pages, ARIA combobox + focus trap. | [GitHub](https://github.com/theryansmee/ngx-command-palette) · [docs](https://theryansmee.github.io/ngx-command-palette/) · [DEV post](https://dev.to/theryansmee/i-built-a-cmdk-command-palette-for-angular-2956) |
| 10 | PrimeNG `CommandMenu` | UI kit command menu | Current PrimeNG (Angular 19–22 line) | PrimeNG ~800k (whole kit) | Current PrimeNG docs | IDE-style palette **component** only. Custom `filter` score, templates, dialog+Ctrl/Cmd+K demo. No shortcut registry. | [docs](https://primeng.dev/commandmenu) |
| 11 | `ngx-command-palette` (pawel-wasiak) | Older Angular palette | NgModule-era | Low | 2022 | Early Cmd/Ctrl+K palette with grouped items + href/callback. Shows the older pattern our plugin is closer to (imperative service + overlay). | [GitHub](https://github.com/pawel-wasiak/ngx-command-palette) |

### Explicitly not treated as first-class Angular wrappers

- **Mousetrap** itself ([craig.is/killing/mice](https://craig.is/killing/mice), [GitHub](https://github.com/ccampbell/mousetrap)): sequences, `mod`, element bind. Angular access is via `angular2-hotkeys` / `@balticcode/ngx-hotkeys`, not a separate maintained wrapper.
- **`@egoistdeveloper/ng-keyboard-shortcuts`**: archived fork of #6 for Angular 13; superseded by stale upstream + #7 for newer Angular.
- **`milestechnologies/ngx-keyboard-shortcuts`**: archived; use #7.

---

## B) Gap table

Missing on **our** package relative to at least one relevant competitor. Essentiality is “how much this hurts a production Angular app that already chose `@angular-libs/shortcut`”.

| Missing feature | Who has it | Essentiality (1–100) | Why |
|---|---|---|---|
| **Single dispatch path:** programmatic `trigger()` / palette must run `onBeforeExecute` (and the rest of keyboard guards) | Our keyboard path already has the hook; **no competitor ships this exact bug**. Closest analogue: `hotkeys-js.trigger()` and Mousetrap programmatic calls also skip input filters unless the wrapper re-applies them (`angular2-hotkeys` comments that a direct `callback()` has no event so it **executes**). | **96** | Context guard and input suppressor are documented as the safety model. Palette + `trigger()` silently bypass them. This is a correctness bug, not a missing nice-to-have. Source: `shortcut.service.ts` `trigger()` vs `handleKeyEvent()`; `command-palette.plugin.ts` `hostRef.trigger(item)`. |
| **Per-shortcut `allowIn` / `ignoreInputs`** | `@ngneat/hotkeys` `allowIn` (default exclude INPUT/SELECT/TEXTAREA/contentEditable) — [4.1.0 `targetIsExcluded`](https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/fesm2022/ngneat-hotkeys.mjs). `angular2-hotkeys` `allowIn` + `preventIn` — [service](https://raw.githubusercontent.com/brtnshrdr/angular2-hotkeys/master/src/lib/hotkeys.service.ts). `ng-keyboard-shortcuts` `AllowIn` — [README](https://cdn.jsdelivr.net/npm/ng-keyboard-shortcuts@13.0.8/README.md). TanStack `ignoreInputs` per hotkey — [guide](https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkeys). | **88** | We only have a **global** exception list on `inputSuppressorPlugin`. Apps need Escape/Enter in dialogs **and** Ctrl+S in editors without turning the suppressor off. |
| **Pause / resume (global or per-binding)** | `@ngneat/hotkeys` `pause()` / `resume()` + `isActive` signal ([4.1.0 bundle](https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/fesm2022/ngneat-hotkeys.mjs)). `angular2-hotkeys` / `@balticcode/ngx-hotkeys` `pause` / `unpause` / `reset`. `ngx-keys` `activate` / `deactivate` (+ groups). | **86** | Modal/drawer/editor focus is the #1 production conflict. We have `contextGuardPlugin`, but it is rule-based, opt-in, and **bypassed by `trigger()`**. A one-liner pause is what incumbents document. |
| **Activate / deactivate by id and by group** | `ngx-keys` `activate` / `deactivate` / `activateGroup` / `deactivateGroup` / `registerGroup` — [README API](https://github.com/mrivasperez/ngx-keys/blob/develop/projects/ngx-keys/README.md). | **84** | Our `group` is a **label** on descriptors (`shortcut.types.ts`), not a control plane. Palette filtering can use it; runtime scoping cannot. |
| **First-class sequences on the core registry** | TanStack `injectHotkeySequence` — [quick start](https://tanstack.com/hotkeys/latest/docs/framework/angular/quick-start). `@ngneat/hotkeys` `addSequenceShortcut` (`g>i`). `ng-keyboard-shortcuts` space-separated sequences + Konami. `ngx-keys` `steps` / `macSteps`. Mousetrap combos via `angular2-hotkeys`. | **83** | Our `chordPlugin` works (`"g d"`, `"ctrl+k ctrl+c"`) but is a **private list**. Chords never appear in `getShortcuts()`, conflicts, rebind display, or the palette. Sequence-vs-single-key delay (ng-keyboard-shortcuts 500ms) is also absent. |
| **Help cheatsheet as an Angular component (grouped, `?`)** | `angular2-hotkeys` `<hotkeys-cheatsheet>` + `?`. `@ngneat/hotkeys` `HotkeysHelpComponent` + `registerHelpModal`. `@balticcode/ngx-hotkeys` `NgxCheatsheetComponent`. `ng-keyboard-shortcuts` `<ng-keyboard-shortcuts-help>`. | **80** | Palette ≠ cheatsheet. Ours is search-to-execute, experimental, raw DOM. Incumbents ship a **stable, grouped, printable help table** that only lists described shortcuts. That is what enterprise “keyboard help” tickets ask for. |
| **Key recorder API for user rebinding** | TanStack `injectHotkeyRecorder` — [recording guide](https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkey-recording). `ngx-keys` has a **demo** recorder only ([customize.component.ts](https://raw.githubusercontent.com/mrivasperez/ngx-keys/develop/projects/demo/src/app/customize/customize.component.ts)), not a library export. | **78** | We persist remaps (`rebindPlugin`) but users cannot capture a combo. Without a recorder, rebind is an API for us, not a product for them. |
| **Angular-component palette (CDK overlay, focus trap, templates)** | `@theryansmee/ngx-command-palette` (standalone `cmd-palette`, CDK, focus trap, `ng-template`) — [README](https://github.com/theryansmee/ngx-command-palette). PrimeNG `CommandMenu` — [docs](https://primeng.dev/commandmenu). | **77** | Our overlay is `document.createElement` + innerHTML + inline `<style>`. README already marks DOM/CSS as unstable. No focus trap, no item templates, no CDK. That blocks theming, SSR hydration, OnPush apps, and a11y reviews. |
| **Palette search quality: fuzzy, recents, keywords, nested pages, route ingest** | `@theryansmee/ngx-command-palette` (fuzzy scoring, `trackRecent`, keywords, children/breadcrumbs, `autoRegisterRoutes`). PrimeNG custom `filter` score. | **72** | Our match is `String.includes` on shortcut / description / group (`command-palette.plugin.ts` `getMatchingShortcuts()`). `group` is not rendered as a heading. Default trigger is `ctrl+shift+p`, not `mod+k`. |
| **`allowIn`-style exceptions + named event filters** | `ngx-keys` named `addFilter` / group filters / shortcut filters (evaluated once per keydown) — [README “Event Filtering”](https://github.com/mrivasperez/ngx-keys/blob/develop/projects/ngx-keys/README.md). `hotkeys-js` `hotkeys.filter` + `setScope`. | **74** | One plugin hook is weaker than a named, toggleable filter pipeline. Modal-scope and “code editor is contentEditable but allow shortcuts” are documented ngx-keys recipes. |
| **Reactive shortcut catalog for UI** | `ngx-keys` `shortcuts$` / `shortcutsUI$`. TanStack `injectHotkeyRegistrations()`. `@ngneat/hotkeys` `getShortcuts()` grouped. `ng-keyboard-shortcuts` `shortcuts$` Observable. | **73** | We expose `getShortcuts()` as a snapshot plus `latestTriggerDetail` signal. There is **no** signal of the registry itself. Help UIs must poll or wrap `register()`. |
| **Directive / hook parity with service config** | TanStack reactive `enabled` / `target`. `@ngneat/hotkeys` directive `hotkeysOptions` (`allowIn`, trigger). `ngx-keys` directive `steps` / `macSteps` / auto-click host. | **71** | `[alShortcut]` omits `when`, `stopImmediatePropagation` (`shortcut.directive.ts`). No `allowIn`. No sequence inputs. |
| **Stable display order (Ctrl+Shift+S, not Ctrl+S+Shift)** | `@ngneat/hotkeys` `HotkeysShortcutPipe` (modifier glyphs, `then` for sequences). `angular2-hotkeys` `Hotkey.symbolize`. TanStack `formatForDisplay`. `ngx-keys` `formatShortcutForUI` with separate PC/Mac strings. | **70** | `normaliseShortcut()` **sorts tokens** (`shortcut.utils.ts`). On non-Apple, `formatShortcut()` joins those sorted tokens → `Ctrl+S+Shift`. Apple path re-buckets modifiers so it looks fine. Competitors keep conventional modifier order. |
| **Conflict policy that blocks simultaneous active duplicates** | `ngx-keys` throws on register/activate if another **active** shortcut shares keys. TanStack `conflictBehavior: 'warn' \| 'replace'`. `@ngneat/hotkeys` logs `'Duplicated shortcut'` and returns `of(null)`. | **68** | We **allow** duplicates, sort by priority, and fire **all** global matches. `getConflicts()` is observational only. Fine for layered handlers; surprising for “one binding wins”. |
| **`id`-based rebind (not string-key remap)** | TanStack / `ngx-keys` identify bindings by id; recorder + unregister/re-register in the ngx-keys demo. | **67** | `rebindPlugin` maps `normaliseShortcut(default)` → custom. Two actions that share `ctrl+s` cannot be rebound independently. `id` exists on config but is unused by rebind. |
| **Unify chords / twice / core in `getShortcuts()`** | TanStack registrations signal includes `sequences`. `@ngneat/hotkeys` `getHotkeys()` concatenates sequence maps. | **66** | Palette and conflicts are incomplete. Users cannot discover `g d` or double-Shift from the UI we ship. |
| **Broader Angular peer range** | TanStack `>=19`. `ngx-keys` `^21`. `@ngneat/hotkeys` 17.2+. `@theryansmee/ngx-command-palette` tags 19–22. | **64** | `>=22` is honest for this monorepo, but it excludes the install base that still runs 19–21 — the same people evaluating ngx-keys / TanStack / ngneat. |
| **Held-key / key-state signals** | TanStack `injectHeldKeys`, `injectKeyHold`. `hotkeys-js` `isPressed` / `getPressedKeyString`. | **42** | Useful for tools UIs; not required for a shortcut manager. `twicePlugin` covers one gesture only. |
| **Route auto-registration into the palette** | `@theryansmee/ngx-command-palette` `autoRegisterRoutes`. | **38** | Valuable for a **palette product**. Out of scope for a shortcut kernel unless we split UI into a real package. Do not block 1.0 of core. |

---

## C) Parity table

Scores are capability-vs-intent (100 = complete, production-safe, documented). Competitor score is the **best** relevant implementation in that row.

| Feature | Our approach | Competitor approach | Our (1–100) | Competitor (1–100) | Notes |
|---|---|---|---|---|---|
| **Registration DX** | `service.register`, bulk array + unified unsubscribe, `onShortcut()`, `[alShortcut]`, `provideShortcut({ plugins })` | TanStack `injectHotkey` / `injectHotkeys` with reactive options + auto cleanup. `ngx-keys` `register` + `activeUntil: 'destruct'`. ngneat RxJS `addShortcut().subscribe()`. | **86** | **92** (TanStack) | We are close. TanStack wins on reactive options (`enabled` as a getter) and auto cleanup without remembering the unsubscribe. We win on plugin bootstrap. |
| **Cross-platform `mod`** | `getModKey()` + `mod` token; `cmd`/`command` synonyms | TanStack `Mod+S`. `angular2-hotkeys` / Mousetrap `mod`. `ngx-keys` **explicit** `keys` + `macKeys` (no implicit mod). ngneat maps `meta` → `control` on PC in `normalizeKeys`. | **88** | **90** (TanStack) | Ours is real and tested (`shortcut.spec.ts` “normalise mod”). ngx-keys is more explicit (and more verbose). |
| **Physical / layout-aware matching** | `navigator.keyboard.getLayoutMap()` + `event.code` fallback for Key/Digit when modifiers held | Most competitors match `event.key` / Mousetrap key names. ngneat help text even documents layout pain for `.` ([issue #43](https://github.com/ngneat/hotkeys/issues/43)). | **90** | **40** | This is a genuine differentiator. Specs cover Shift+Digit1 and Alt+Z → Ω. |
| **Input suppression** | Optional plugin; tagName + `isContentEditable`; global exceptions | Built-in default exclude + per-binding `allowIn` (ngneat, angular2-hotkeys, ng-keyboard-shortcuts) or `ignoreInputs` (TanStack) or named filters (ngx-keys / hotkeys-js) | **62** | **90** (ngneat / TanStack) | Plugin design is good; default-off + no per-binding allow + `trigger()` bypass is not. |
| **Sequences / chords** | `chordPlugin` private registry, timeout 1000ms, `onKeyEvent` consume | First-class: TanStack sequences, ngneat `addSequenceShortcut`, ngx-keys `steps`, ng-keyboard-shortcuts sequences, Mousetrap combos | **70** | **88** (TanStack / ng-keyboard-shortcuts) | Implementation quality is fine (layout map reused). Integration with host registry / palette / rebind is the gap. ngx-keys also documents **simultaneous** non-modifier chords (`['c','a']`) — different from our sequential chords. |
| **Double-tap** | `twicePlugin` (keyup, default 300ms) | Rare. Not a standard incumbent feature. | **82** | **20** | Real differentiator if documented as such. Still isolated from `getShortcuts()`. |
| **Context / scopes** | `contextGuardPlugin` allow/block + `when()` | `hotkeys-js` `setScope`. ngx-keys activate/deactivate + filters. ngneat `pause`. angular2-hotkeys pause. TanStack `enabled`. | **75** | **85** (ngx-keys + hotkeys-js) | Guard rules are more expressive than pause. They are easier to get wrong (whitelist `allow`) and are skipped by `trigger()`. |
| **User rebind + persistence** | `rebindPlugin` + `localStorage`; display remap via `onGetDisplayShortcut`; empty string disables | TanStack recorder (no built-in persistence). ngx-keys demo re-registers by id (no persistence API). Most others: none. | **72** | **80** (TanStack recorder + app persistence) | We uniquely persist. We lack recorder + id-level remap. `rebuild()` is an empty function (`rebind.plugin.ts`). |
| **Programmatic trigger** | `trigger(string \| Partial<descriptor>)` + synthetic event with modifiers (B25 fixed) | `hotkeys-js.trigger()`. angular2-hotkeys can call `callback` directly (skips `allowIn` if no event). | **58** | **70** (hotkeys-js) | Lookup + descriptor filters are good. Guard bypass and `target: null` keep the score down. Palette depends on this API. |
| **Conflict detection** | `getConflicts()` count + descriptions | ngx-keys **prevents** active conflicts. TanStack `conflictBehavior`. ngneat console.error on duplicate. | **64** | **86** (ngx-keys) | Observability ≠ policy. We also fire every global match. |
| **Help cheatsheet** | None (palette is search/execute) | ngneat `HotkeysHelpComponent` (Angular, grouped). angular2-hotkeys / BalticCode cheat sheet. ng-keyboard-shortcuts help modal. | **15** | **88** (ngneat / angular2-hotkeys) | Do not count the palette as a cheatsheet. Different job. |
| **Command palette** | Experimental raw-DOM plugin; substring; `trigger()` execute; ARIA dialog/combobox-ish | `@theryansmee/ngx-command-palette` (fuzzy, routes, recents, CDK, focus trap). PrimeNG `CommandMenu` (templates, custom filter, Home/End). | **48** | **90** (theryansmee) | We have the **idea** and a working overlay. We do not have a productized palette. Home/End are missing (arrows/Enter/Esc only). |
| **Visual / Vimium hints** | `visualHintsPlugin` | Effectively none of the listed hotkey libs. | **78** | **10** | Unique. Selector set is narrow; labels are `aria-hidden`; scroll/resize cancels. Good experiment, not a11y-complete. |
| **Plugin architecture** | `ALShortcutPlugin` + `ALShortcutHost`; secondary UI entry | No Angular hotkey lib has an equivalent hook host. TanStack is a manager + adapters. ngx-keys is a closed service + filters. | **91** | **35** | This is the strategic bet. Host is narrow (good). UI plugins living on a secondary entry is the right packaging. Hook bypass in `trigger()` undercuts the bet. |
| **SSR / zoneless** | Listeners gated on `window`+`DOCUMENT`. Native listeners, no `NgZone`. Signals for latest trigger + UI plugin visibility. | TanStack docs: SSR-friendly manager. ngx-keys signals / zoneless tags. ngneat uses `EventManager` + RxJS (zone-coupled unless zoneless EventManager). Mousetrap wrappers assume browser. | **88** | **86** (TanStack) | README claim matches code for core. UI plugins correctly documented as browser-only. |
| **Display formatting** | `formatShortcut()` Apple glyphs vs `Ctrl+` | ngneat pipe + aliases. angular2-hotkeys `symbolize` + `mod`. TanStack `formatForDisplay`. ngx-keys dual PC/Mac UI strings. | **60** | **88** (ngneat / TanStack) | Sort-then-join breaks PC order. No sequence formatting (`then`). |
| **Angular version / install base** | `>=22` only; `0.0.1` | angular2-hotkeys still ~45k/wk on v16. ngneat 8k. TanStack ≥19. ngx-keys ^21. | **40** | **85** (ngneat + angular2-hotkeys install base) | Quality ≠ adoption. Incumbents win on “already in package.json”. |
| **Maintenance / docs** | Solid consumer README + changelog; tests in `shortcut.spec.ts` | TanStack has dedicated Angular guides. ngx-keys README is an API book. angular2-hotkeys README is short but 45k apps know it. ngneat published README on npm is still CLI boilerplate; real API is in the bundle / third-party copies. | **74** | **90** (TanStack / ngx-keys) | Our README is more honest than ngneat’s npm README. We should document the `trigger()` contract explicitly. |

---

## D) Improvement backlog

No implementation in this PR. Priority is “do this before calling the package production-ready”, not calendar time.

| Improvement | Priority (1–100) | Rationale |
|---|---|---|
| **Route `trigger()` through the same execute pipeline as `handleKeyEvent()`** — call `onBeforeExecute` (and honor `when`, `type`, element, `preventDefault`). Add a spec that `inputSuppressorPlugin` / `contextGuardPlugin` block `trigger()` and palette execute. | **98** | Highest-severity correctness gap still in tree. Palette is an exploit path for the bypass. Do this before any palette promotion. |
| **Document the current `trigger()` contract until it is fixed** (guards skipped, `target: null`, all matching handlers run). | **93** | README currently says `id` / `group` are “usable with `trigger()`” without the bypass. Docs lying is worse than a missing feature. |
| **Per-shortcut `allowIn` / `ignoreInputs` (and directive inputs)** — keep `inputSuppressorPlugin` as the default plugin, but let a binding opt in. | **89** | Table-stakes vs ngneat / angular2-hotkeys / TanStack. Exceptions-only at plugin level does not scale. |
| **`pause()` / `resume()` on the host** (signal `isPaused`), plus optional per-id pause. | **87** | Faster than teaching every app `contextGuardPlugin` rules. Matches what 45k angular2-hotkeys apps already call. |
| **Group as a control plane:** `activateGroup` / `deactivateGroup` or document that `group` is display-only and add real APIs. | **85** | ngx-keys’ main DX win. Our `group` field currently implies more than it does. |
| **Register sequences on the core map** (or have `getShortcuts()` / conflicts / rebind / palette ask plugins for extra descriptors). | **84** | Until chords/twice are visible, the palette is a partial catalog. Prefer a `onGetShortcuts()` plugin hook over special-casing two plugins. |
| **Rewrite UI plugins as Angular components** (CDK overlay, focus trap, OnPush, CSS vars already exist). Keep factory names / `open`/`close`/`toggle` as the README contract. | **82** | README already forecasts this. Raw DOM will fail design-system and a11y reviews. `@theryansmee` is the bar. |
| **Ship `injectShortcutRecorder()` (or a rebind method) that captures a normalised combo** and calls `setOverride`. Persist stays in `rebindPlugin`. | **80** | Completes the rebind story we already started. TanStack has this; ngx-keys only demos it. |
| **Fix `formatShortcut()` token order** (canonical modifier order: ctrl/meta, alt, shift, key — do not `join` the sorted lookup key). Add sequence `then` formatting. | **79** | Cheap, user-visible, and we already advertise `⌘S` / `Ctrl+S`. PC output is currently `Ctrl+S+Shift`. |
| **Grouped help cheatsheet component** (`?` / `shift+?`), listing `description` + `group`, excluding `showInHelp: false`. Palette stays search-to-run. | **78** | This is why ngneat/angular2-hotkeys win RFPs. Do not overload the experimental palette. |
| **Directive / `onShortcut` parity:** `when`, `stopImmediatePropagation`, `allowIn`. | **76** | Service-only flags become “secret API”. |
| **Registry signal** (`shortcuts` as `signal`/`computed`) so help/palette do not snapshot-stale. | **75** | ngx-keys / TanStack already treat the catalog as UI state. Our palette re-reads on each keystroke (OK) but app help pages cannot bind. |
| **Conflict policy option:** `overlap: 'all' \| 'first' \| 'reject'` (today is implicit `'all'` for globals). | **68** | Keep current default (priority-ordered multicast). Offer first-wins and reject for ngx-keys refugees. |
| **Rebind by `id`** (and refuse to remap two ids with one default key unless asked). | **67** | String-key remap is wrong as soon as two features share a default. |
| **Palette UX:** `mod+k` default, render `group` headings, Home/End, fuzzy or at least word-boundary rank, optional recents. Still experimental. | **66** | Only after `trigger()` guards are fixed. Otherwise better search just bypasses more safely-intended shortcuts. |
| **Widen visual-hints selector** (`[href]`, `role="link"`, `contenteditable`, `summary`) and stop `aria-hidden` on the only affordance. | **55** | Unique feature; keep it experimental until the selector and a11y are real. |
| **Peer range** `>=20` or `>=21` if CI proves it (signals, `input()`, `effect` already used). | **54** | Adoption, not architecture. Do not drop 22-only APIs to chase 17. |
| **Remove or implement `rebindPlugin.rebuild()`** | **35** | Dead API. Either delete from the public interface or make it force a catalog signal tick. |

---

## Source index (ours)

| File | Role |
|---|---|
| `projects/angular-libs/shortcut/package.json` | Name, `0.0.1`, peers `>=22`, keywords include `command-palette` / `vimium`. |
| `projects/angular-libs/shortcut/README.md` | Consumer docs; plugin tables; experimental UI contract. |
| `projects/angular-libs/shortcut/CHANGELOG.md` | 0.0.1 surface list. |
| `projects/angular-libs/shortcut/src/public-api.ts` | Core + headless plugins. |
| `projects/angular-libs/shortcut/plugins/src/public-api.ts` | Secondary experimental UI entry. |
| `projects/angular-libs/shortcut/src/lib/shortcut.service.ts` | Listeners, register, trigger, hooks. |
| `projects/angular-libs/shortcut/src/lib/shortcut.types.ts` | Config, host, plugin hooks. |
| `projects/angular-libs/shortcut/src/lib/shortcut.utils.ts` | `mod`, synonyms, format, layout resolve. |
| `projects/angular-libs/shortcut/src/lib/shortcut.hooks.ts` | `onShortcut()`. |
| `projects/angular-libs/shortcut/src/lib/shortcut.directive.ts` | `[alShortcut]`. |
| `projects/angular-libs/shortcut/src/lib/provide-shortcut.ts` | `SHORTCUT_CONFIG` only. |
| `projects/angular-libs/shortcut/src/lib/plugins/*.ts` | Headless plugins. |
| `projects/angular-libs/shortcut/plugins/src/lib/*.ts` | Palette + hints. |
| `projects/angular-libs/shortcut/src/lib/shortcut.spec.ts` | Behavior tests; no `trigger()` × `onBeforeExecute` case. |

## Competitor URL index

- https://github.com/ngneat/hotkeys
- https://www.npmjs.com/package/@ngneat/hotkeys
- https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/fesm2022/ngneat-hotkeys.mjs
- https://github.com/brtnshrdr/angular2-hotkeys
- https://raw.githubusercontent.com/brtnshrdr/angular2-hotkeys/master/README.md
- https://raw.githubusercontent.com/brtnshrdr/angular2-hotkeys/master/src/lib/hotkeys.service.ts
- https://github.com/BalticCode/ngx-hotkeys
- https://github.com/mrivasperez/ngx-keys
- https://github.com/mrivasperez/ngx-keys/blob/develop/projects/ngx-keys/README.md
- https://tanstack.com/hotkeys/latest/docs/framework/angular/quick-start
- https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkeys
- https://tanstack.com/hotkeys/latest/docs/framework/angular/guides/hotkey-recording
- https://www.npmjs.com/package/@tanstack/angular-hotkeys
- https://cdn.jsdelivr.net/npm/ng-keyboard-shortcuts@13.0.8/README.md
- https://github.com/phalgunv/ngx-keyboard-shortcuts
- https://www.npmjs.com/package/hotkeys-js
- https://github.com/theryansmee/ngx-command-palette
- https://primeng.dev/commandmenu
- https://github.com/pawel-wasiak/ngx-command-palette
- https://github.com/omridevk/ng-keyboard-shortcuts

## Method

1. Read our service, types, utils, hooks, directive, `provideShortcut`, five headless plugins, two UI plugins, public barrels, README, changelog, peers, and specs.
2. Confirmed `trigger()` still skips `onBeforeExecute` by reading both methods and the palette caller.
3. Pulled competitor APIs from published bundles/READMEs/docs (not memory): ngneat 4.1.0 FESM, angular2-hotkeys 16.0.1 FESM + GitHub service, ngx-keys develop README + customize demo, TanStack Angular guides, ng-keyboard-shortcuts 13.0.8 README, hotkeys-js npm README, theryansmee README, PrimeNG CommandMenu docs.
4. Did not change files under `projects/angular-libs/shortcut`.
