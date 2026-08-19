# Produksjonsbugs

Gjennomgang av README, public API, peer deps, packaging og kjerneimplementasjon i alle `@angular-libs/*`-pakkene. **Kun bekreftede bugs** — ting som faktisk bryter kontrakt, kompilerer feil hos konsumenter, eller gjør feil i runtime.

Alvorlighet:

- **Blokkerende** — publisering eller install på dokumentert peer-range feiler
- **Høy** — feil oppførsel eller API som ikke matcher det som er dokumentert
- **Middels** — konkret feil, men med smalere treffflate

---

## Repo / packaging

### B1. `@angular-libs/data-grid` kan ikke publiseres som offentlig scoped pakke

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** blokkerende  
**Fil:** `projects/angular-libs/data-grid/package.json`

Har `publishConfig.access: "public"`, `description`, `license`, `repository`, `bugs`, `author` og `keywords`.

### ~~B2. Feil `repository` / `bugs`-URL-er på npm~~

**Status:** fikset  
**Alvorlighet:** høy  
**Filer:** `web`, `event-bus`, `store`, `translate` `package.json`

~~Disse peker fortsatt på gamle standalone-repoer.~~ Peker nå på `github.com/angular-lib/angular-libs` med `directory` og felles issues-URL. Store fikk også manglende `bugs`.

### ~~B3. `event-bus` `ng add` kjører utdatert kompilert JS~~

**Status:** fikset  
**Alvorlighet:** høy  
**Filer:** `projects/angular-libs/event-bus/schematics/ng-add/index.js` vs `index.ts`

~~Publisert JS gjør alltid `tree.create(...)`. Andre `ng add` kaster «File already exists».~~ `index.js` hopper over eksisterende filer. `build:libs` kjører `build:event-bus:schematics` før `ng build @angular-libs/event-bus`.

### ~~B4. `event-bus` `ng add` lover `--project` men ignorerer det~~

**Status:** fikset  
**Alvorlighet:** høy (multi-project workspaces)  
**Filer:** `schematics/ng-add/index.ts`, `schema.json`, `collection.json`

~~`schema.json` har `properties: {}`; `getProject()` leser aldri options.~~ `project` er i schema (`$source: projectName`), `collection.json` peker på schema, og `ngAdd(options)` bruker `options.project`. Uten flagg: `defaultProject` eller den ene `application`-en — ikke første nøkkel i `angular.json`.

### B5. `watch`-scriptet har ikke prosjektnavn

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** rot-`package.json`

`"watch": "ng build demo --watch --configuration development"`

### ~~B6. Socket-server-kommentar dokumenterer en script som ikke finnes~~

**Status:** fikset  
**Alvorlighet:** middels  
**Fil:** `server/server.ts`

~~Kommentaren sier `npm run server`.~~ Peker nå på `bun run socket` / `bun run server/server.ts`.

---

## Peer dependencies

### ~~B7. `@angular-libs/socket` lover Angular 18, men importerer `resource`~~

**Status:** fikset  
**Alvorlighet:** blokkerende for Angular 18-konsumenter  
**Filer:** `projects/angular-libs/socket/package.json`, `src/lib/socket.ts`

~~Peers: `@angular/core` / `@angular/common` `>=18.0.0`.~~ Peer er nå `@angular/core` `>=20.0.0` (matcher `resource({ params })`). Ubrukt `@angular/common` er fjernet.

### ~~B8. `@angular-libs/event-bus` lover Angular 19, men `onToResource` bruker `resource({ params })`~~

**Status:** fikset  
**Alvorlighet:** blokkerende for Angular 19-konsumenter  
**Filer:** `event-bus/package.json`, `src/lib/event-bus.ts`

~~Peers: `@angular/core` `>=19.0.0`. README sier «Angular 19+».~~ Peer og README er `>=20.0.0` / Angular 20+.

### ~~B9. `@angular-libs/dialog` markerer `@angular/router` som optional, men har statisk import~~

**Status:** fikset  
**Alvorlighet:** høy  
**Filer:** `dialog/package.json`, `src/lib/dialog.service.ts`

~~Hard `import { Router, NavigationStart } from '@angular/router'`.~~ `closeOnNavigation` bruker `Location.onUrlChange` fra `@angular/common`. Router er ikke lenger peer.

### ~~B10. `^22.0.0` på shortcut og data-grid avviser Angular 23~~

**Status:** fikset  
**Alvorlighet:** middels (fremtidig)  
**Filer:** `shortcut/package.json`, `data-grid/package.json`

~~`^22` avviser Angular 23.~~ Peers er `>=22.0.0`. README-er oppdatert.

---

## Runtime / API-kontrakt

### ~~B11. `@angular-libs/form` — `valueMode: 'object'` leser aldri feltet~~

**Status:** fikset  
**Alvorlighet:** høy  
**Fil:** `projects/angular-libs/form/src/lib/components/form/form-select.ts`

~~`displayRows` leser kun `selectionDisplay`.~~ Object-mode leser feltet via `resolveDisplayRows`. Id-mode bruker fortsatt seeded `selectionDisplay`.

### ~~B12. `@angular-libs/event-bus` — `crossTabSyncPlugin({ keys })` filtrerer bare utgående events~~

**Status:** fikset  
**Alvorlighet:** høy  
**Fil:** `projects/angular-libs/event-bus/src/lib/plugins/cross-tab-sync.plugin.ts`

~~Innkommende `onmessage` emitter/resetter alt.~~ Inbound emit og reset respekterer `keys`. Full remote reset (`key === undefined`) nullstiller bare filtrerte nøkler.

### ~~B13. `@angular-libs/store` — IndexedDB cross-tab dropper `Map` / `Set`~~

**Status:** fikset  
**Alvorlighet:** høy  
**Fil:** `projects/angular-libs/store/src/lib/plugins/indexeddb.plugin.ts`

~~`JSON.stringify` gjør alle Maps like.~~ Remote apply kaller `store.set` direkte (structured clone), uten JSON-sammenligning.

### ~~B14. `@angular-libs/store` — IndexedDB-hydrering hopper over `null`~~

**Status:** fikset  
**Alvorlighet:** middels  
**Fil:** samme plugin, hydreringsløkken

~~`savedValue !== null` hoppet over persistert null.~~ Mangler nøkkel er `undefined`; persistert `null` hydreres.

### B15. `@angular-libs/store` — `persistPlugin`-hydrering havner i history

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Filer:** `persist.plugin.ts`, `history.plugin.ts`, `store-hydration.ts`

Hydrering merkes med `beginStoreHydration` / `endStoreHydration`. `historyPlugin` hopper over undo-steg mens storen hydrerer.

### B16. `@angular-libs/store` — `select` med `Object.keys` / `in` er ikke reaktivt

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** høy (dokumentert som støttet)  
**Fil:** `src/lib/al-store.ts` (`select`)

`select()` subscriberer på alle kjente nøkler før projector kjører, så `Object.keys` / `in` / spread oppdateres.

### B17. `@angular-libs/translate` — `onLangChange` fyrer to ganger ved bootstrap, første gang med tom ordbok

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `translate.service.ts` (`provideALTranslate`)

Med `loader` uten `staticData` fyrer bare `loadLanguage()` (etter ordbok). `staticData` fyrer `onLangChange` én gang etter `setDictionary`.

### B18. `@angular-libs/dialog` — fullscreen-exit river dockede vinduer ut av taskbaren

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `dialog.service.ts` `handleGlobalFullscreenChange`

Bare dialoger som lå i det forrige `fullscreenElement` flyttes tilbake til `body`. Taskbar-barn urøres.

### B19. `@angular-libs/dialog` — Alt+S tile snap tror siste `.al-dialog` i DOM er «øverst»

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `plugins/tile-snapping.plugin.ts`

Ignorerer `.al-dialog-toast` og `.al-dialog-popover`. Windows får klassen `al-dialog-window`.

### B20. `@angular-libs/dialog` — `InferDialogResult` statisk brand virker ikke

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels (public types)  
**Fil:** `dialog.types.ts`

`InferDialogResult` leser `DialogResultBrand` på instanstypen (`ɵdialogResult`).

### B21. `@angular-libs/socket` — async outbox `getItem()` kan duplisere allerede køede meldinger

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `socket.ts` (outbox-hydrering)

Sen `getItem()` prepender bare items som ikke allerede ligger i live-køen (JSON-identitet).

### B22. `@angular-libs/socket` — `CreateWebSocketOptions.outbox` mister `TSend`

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels (public types)  
**Fil:** `socket.types.ts`

`outbox?: WebSocketOutboxOptions<TSend>`.

### B23. `@angular-libs/socket` — `createWebSocket` uten injection context advarer, så kaster

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `socket.ts`

`effect()` fanges. Uten injector: én connect til gjeldende URL + advarsel. Ingen `NG0203`.

### B24. `@angular-libs/shortcut` — `contextGuardPlugin` normaliserer ikke snarveier

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `plugins/context-guard.plugin.ts`

Bruker `normaliseShortcut()` på dispatch og regler (`mod+s`, `cmd`, `esc`).

### B25. `@angular-libs/shortcut` — `trigger('mod+s')` lager KeyboardEvent uten modifiers

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `shortcut.service.ts` `trigger()`

Syntetisk event bruker normalisert nøkkel (`ctrl`/`meta`/`alt`/`shift`).

### B26. `@angular-libs/web` — `nfcSignal().scan()` stabler listeners

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `src/lib/signals/nfc.ts`

Listeners bindes én gang (`listenersBound`).

---

## Dokumentasjon som motstrider koden

### B27. Root README er Angular CLI-boilerplate

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** høy for et bibliotek-monorepo  
**Fil:** `README.md`

Monorepo-inngang: ni pakker, Bun, `bun start` / `build:libs` / `test`. Ingen `ng e2e`.

### B28. Socket README: Karma + feil CLI-prosjektnavn

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `projects/angular-libs/socket/README.md`

CLI-boilerplate fjernet. Build/test bruker `@angular-libs/socket` og Vitest.

### B29. data-grid README lover toolbar-knapper som ikke finnes

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `data-grid/README.md`

Dokumenterer adapter/API (`expandAll` / `collapseAll` / `clear`), ikke toolbar-knapper.

### B30. data-grid `ARCHITECTURE.md` importerer `form` fra feil pakke

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `data-grid/ARCHITECTURE.md`

`form` importeres fra `@angular/forms/signals`.

### B31. event-bus README: `combineLatestToSignal(['event1', 'event2'])`

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `event-bus/README.md`

Eksempel og API-linje bruker `{ key }[]`.

### B32. event-bus README: Resource har `.loading()`

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
Dokumentert som `.isLoading()`.

### B33. store JSDoc: `usersAdapter.add(user)`

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `al-store.ts` klasse-JSDoc

Bruker `addOne`.

### B34. store README AI-eksempel bruker `indexedDBPlugin` uten import

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
`indexedDBPlugin` er i importlisten.

### B35. store README har ødelagt markdown-fence etter AI-blokken

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
Ekstra fences fjernet; License er vanlig markdown.

### B36. translate README viser pipen uten å importere den

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
Eksempelet importerer `TranslatePipe` i `imports`.

### B37. form README navngir `DropdownItem`, men typen er ikke public

**Status:** ~~åpen~~ fikset  
**Alvorlighet:** middels  
**Fil:** `form/src/public-api.ts`

`DropdownItem` er eksportert.

### ~~B38. dialog README: overstyr `--al-dock-bg` på `dialog.al-dialog`~~

**Status:** fikset  
**Alvorlighet:** middels  
Dock-tokens ligger på `:root`. README sier `:root` / `.al-dialog-taskbar`, ikke `dialog.al-dialog`.

### ~~B39. web README overselger `idleSignal` og `keyboardStateSignal`~~

**Status:** fikset  
**Alvorlighet:** middels  
Tabellen beskriver inaktivitetstimer og pressede taster/modifiers, ikke Idle Detection / layout API.

### ~~B40. event-bus `loggerPlugin` JSDoc: «purely in development», default `true`~~

**Status:** fikset  
**Alvorlighet:** middels  
Default er `isDevMode()`. `enabled: true` / `false` tvinger. README og JSDoc matcher.

### ~~B41. `PersistPluginOptions` er ikke public export~~

**Status:** fikset  
**Alvorlighet:** middels  
Eksportert fra `@angular-libs/store` sammen med `persistPlugin`.

### ~~B42. LICENSE-tekst på `web` og `shortcut` er korrupt~~

**Status:** fikset  
**Alvorlighet:** middels  
Standard MIT: `WITHOUT WARRANTY OF ANY KIND`.

---

## Oppsummert per pakke

| Pakke | Blokkerende / høy | Middels |
| --- | ---: | ---: |
| repo | ~~B1~~, ~~B2~~, ~~B3~~, ~~B4~~, ~~B27~~ | ~~B5~~, ~~B6~~ |
| data-grid | ~~B1~~, ~~B10~~ | ~~B29~~, ~~B30~~ |
| dialog | ~~B9~~ | ~~B18~~, ~~B19~~, ~~B20~~, ~~B38~~ |
| event-bus | ~~B3~~, ~~B4~~, ~~B8~~, ~~B12~~ | ~~B31~~, ~~B32~~, ~~B40~~ |
| form | ~~B11~~ | ~~B37~~ |
| shortcut | ~~B10~~ | ~~B24~~, ~~B25~~, ~~B42~~ |
| socket | ~~B7~~ | ~~B21~~, ~~B22~~, ~~B23~~, ~~B28~~ |
| store | ~~B13~~, ~~B16~~ | ~~B14~~, ~~B15~~, ~~B33~~, ~~B34~~, ~~B35~~, ~~B41~~ |
| translate | — | ~~B17~~, ~~B36~~ |
| web | ~~B2~~ | ~~B26~~, ~~B39~~, ~~B42~~ |

Ingen av disse er «kanskje». Hver er sjekket mot kilde.
