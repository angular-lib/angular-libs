# Forbedringer, forenklinger og nye features

Ideer som kom frem under produksjonsgjennomgangen. Dette er **ikke bugs** — koden gjør det den sier, men dette ville gjort pakkene lettere å slippe, vedlikeholde og selge.

Prioritet er grovt: **P1** før første publisering, **P2** like etter, **P3** backlog.

---

## P1 — før produksjon

### Én peer-dep-policy

I dag: `>=18`, `>=19`, `>=19` uten patch, `>=20`, `>=21`, `^22`.

Foreslått:

| Pakke | Minimum | Hvorfor |
| --- | --- | --- |
| form, data-grid | `>=21` (helst `>=22` hvis dere bare tester 22) | Signal Forms |
| store, event-bus, socket (`websocketResource`) | `>=20` | `resource({ params })` |
| dialog, translate, shortcut, web | `>=19` eller `>=20` | `provideAppInitializer` / `input()` er greit fra 19; mindre fragmentering hvis alt er `>=20` |

Bruk `>=N.0.0` overalt, aldri `^22` (stenger Angular 23). Fjern ubrukte peers (`@angular/common` på store/translate/socket).

### Én `repository` / `bugs` / `homepage`-mal

Alle pakker:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/angular-lib/angular-libs.git",
  "directory": "projects/angular-libs/<name>"
},
"bugs": { "url": "https://github.com/angular-lib/angular-libs/issues" },
"homepage": "https://angular-lib.github.io/angular-libs/<route>"
```

### Felles pakkemetadata-sjekkliste

Hver `package.json` bør ha: `name`, `version`, `description`, `license`, `author`, `homepage`, `repository`, `bugs`, `keywords`, `publishConfig.access`, `sideEffects`, `peerDependencies`.

Kopier `LICENSE` (riktig MIT-tekst) inn i alle pakker via `ng-package` assets. Legg en rot-`LICENSE` i repoet så GitHub klassifiserer det.

### Root README som monorepo-inngang

Erstatt CLI-boilerplate med:

- hva AngularLibs er (ni signal-first pakker)
- tabell: pakke, én setning, peer-min, npm-lenke
- `bun install` / `bun start` / `bun run build:libs` / `bun test`
- peker til hver pakkes README + demo-ruter
- hvordan man publiserer (eller «ikke publisert ennå»)

### CI som faktisk er en release-gate

I dag: bare GitHub Pages-deploy.

Minimum på PR mot `main`:

1. `bun install --frozen-lockfile`
2. `bun run build:libs`
3. `ng test --watch=false` (alle libs + demo)
4. `ng build demo --configuration=production`

Etter det: Changesets eller release-please, en `publish`-workflow, og schematic-kompilering som eget steg (`tsc -p event-bus/schematics`).

### Versjonering

Pakkene ligger på `0.0.1`–`0.3.3` uten policy. Før npm:

- bestem om første offentlige slipp er `0.1.0` (pre-stable, breaking OK) eller `1.0.0` (semver-kontrakt)
- data-grid `OVERVIEW.md` sier allerede «Breaking changes OK until first publish» — det må stå i rot-README også
- slutt å overskrive `CHANGELOG.md` med rå `git log` (store). Hold-a-Changelog per pakke, eller ett monorepo-changelog med scopes

---

## P2 — API- og DX-forenklinger

### Splitt `resource` ut av hoved-entry der det ikke hører hjemme

`createWebSocket()` trenger ikke `resource`. Flytt `websocketResource()` til `@angular-libs/socket/resource` (eller depreker den helt — README sier allerede at ny kode skal bruke `createWebSocket`). Da kan core-peeren senkes, og Angular 18/19-brukere får den moderne API-en.

Samme mønster: event-bus `onToResource` kan leve i en valgfri interop-entry hvis dere virkelig vil støtte 19.

### Dialog uten hard `@angular/router`-import

`inject(Router, { optional: true })` er riktig idé. Gjør importen type-only + dynamisk, eller les router-events via en optional injection token som `provideDialog({ closeOnNavigation })` setter opp når router finnes. Da blir `optional: true` sant.

### Form: slutt å kalle S2 i konsument-README

«S2 selection display» er intern sjargong. I README: «IDs i modellen, labels på controlleren (`seedSelection`)». Behold `valueMode: 'id' | 'object'` som API, men forklar det med ett avsnitt og ett eksempel.

Når B11 er fikset: vurder om `valueMode: 'object'` i det hele tatt trengs. Hvis 90 % av bruken er ID-mode, kan object-mode være et avansert note i stedet for et likestilt spor.

### Store: tynnere public surface

- Eksporter `PersistPluginOptions` (samme mønster som `IndexedDBPluginOptions`)
- Fjern `usersAdapter.add` fra JSDoc; bruk `addOne`
- Dokumenter `setOne` / `setMany` / `remove(predicate)` som allerede finnes
- Vurder å droppe `rxjs-free` som keyword når `@angular-libs/store/rxjs-interop` finnes
- `select()`: enten gjør `ownKeys`/`has` signal-avhengige, eller fjern påstanden fra README

### Event-bus schematic

- Kompiler JS i `build:libs`
- Koble `schema.json` med `project`
- Ikke sjekk inn både `.ts` og stale `.js` uten build-steg
- Fjern Jasmine-types fra schematic-tsconfig (workspace bruker Vitest)
- Ikke kopier `.ts` / `.map` / `tsconfig` inn i npm-tarballen

### Data-grid README = konsumentkontrakt

`OVERVIEW` / `ARCHITECTURE` / `ROADMAP` / `PLUGINS` / `KEYBOARD` er bra for contributors. Konsument-README bør:

- liste **alle** plugin-factories (`flashCellsPlugin`, `cellRangePlugin`, `defaultGridPlugins`)
- ikke love toolbar-knapper som ikke finnes
- holde `createGrid`-eksemplet som eneste «quick start»
- merke `internals` tydelig som ustabilt (allerede delvis gjort)

### Web: ærligere feature-tabell

Bytt «Idle Detection» → «Inactivity timer». Bytt «physical layout» → «pressed keys + modifiers». Eventuelt implementer ekte `IdleDetector` / `keyboard.getLayoutMap` senere (shortcut har allerede layout map).

`resolveSignalContext` er eksportert, men nesten ingen signaler bruker den. Enten bruk den overalt, eller ikke eksporter den som public API.

### Dialog CSS-tokens

Dokumenter `--al-dock-*` på `.al-dialog-taskbar` / `:root`, ikke på `dialog.al-dialog`. Vurder å definere dock-tokens på `:root` så overriding faktisk virker som README sier.

### Demo som dokumentasjon

- Importer `@angular-libs/web` (ikke relativ `public-api`)
- Importer `@angular-libs/dialog/styles.css` (ikke relativ `src/styles.css`)
- Kall `provideDialog` / `provideShortcut` i `app.config.ts` slik README viser
- Bytt «Local Dev»-badge når det er GitHub Pages
- Dokumenter `bun run socket` ved siden av socket-demoen

---

## P3 — features og arkitektur

### Felles plugin-kontrakt

dialog / store / event-bus / shortcut / socket / data-grid har alle «factory returnerer objekt med hooks». En kort `CONTRIBUTING` / `docs/plugins.md` med:

- `id`
- `onInit` / `onDestroy`
- feilisolering (de fleste gjør dette allerede)
- felt = aktiv API, constructor = passiv

...ville gjort det lettere for AI og bidragsytere å gjette riktig.

### `ng add` for flere pakker — eller ingen

Bare event-bus har `ng add`, og den er ødelagt (B3/B4). Enten:

- fiks den og gjør den til mal for `provideX` + typed subclass, eller
- fjern den og dokumenter 5 linjer bootstrap i README (dialog/shortcut/translate gjør dette bedre)

### Translate: plural / ICU som plugin, ikke core

README er ærlig om begrensningene. En offisiell `pluralPlugin` / `icuPlugin` på `transform` + `onMissingKey` passer arkitekturen og fyller det vanligste gapet mot ngx-translate.

### Store offline-first

`OFFLINE_SQLITE_PLAN.md` bør enten bli en ekte milestone eller flyttes ut av publisert pakke (`ng-package` kopierer den ikke i dag — bra). Ikke la et «plan»-dokument se ut som shipped feature.

### Data-grid: default chrome-pakke vs à la carte

`defaultGridPlugins()` er riktig spor. Vurder en enda tynnere `minimalGridPlugins()` (bare clipboard) og la find/sidebar/status være eksplisitte. Konsumenter som kopierer README får i dag sidebar uten å ha bedt om den (kan slås av med `{ sideBar: false }` — vis det tidligere).

### Form + data-grid bro

`toColumnDefs` er et tynt `{ field, header, type, editable }`. Enten:

- utvid den til ekte `ColumnDef` (filter/editor fra form type), eller
- kall den `toSimpleColumns` og slutt å si «grid bridge» som om det er en first-class integrasjon

### Shortcut UI-plugins

`commandPalettePlugin` / `visualHintsPlugin` er merket `@experimental` — bra. Default trigger `ctrl+shift+p` bør være `mod+shift+p`. Når de skrives om til Angular-komponenter, behold factory-navnene (allerede lovet i README).

### Testing-entries

dialog har `@angular-libs/dialog/testing`. event-bus har test-helpers som **ikke** er public (bevisst). Vurder:

- `tsconfig` path for `@angular-libs/dialog/testing` (mangler i workspace)
- samme mønster for store / socket (`createMockWebSocketFactory` ligger allerede på main barrel — OK)

### Felles CSS-variabel-prefiks er allerede bra

`--al-dialog-*`, `--al-form-*`, `--al-dg-*`, `--al-pal-*`. En kort theming-side i rot-README med «alle tokens starter med `--al-`» gjør det lettere å bygge et design-system oppå.

### Forenkle `build:libs`

Lang `&&`-kjede. `ng build` avhengigheter i `angular.json` (`dependsOn`) eller et lite script som bygger i topoloisk rekkefølge (data-grid/plugins avhenger av plugin-entry). Mindre sårbart enn rekkefølge i en linje.

### CONTRIBUTING scopes

Legg til `data-grid`, `form`, `shortcut`, `socket`. Eventuelt slå på commitlint hvis dere faktisk vil håndheve det.

---

## Nye features som faktisk passer

Disse følger eksisterende arkitektur, ikke «lag et nytt bibliotek».

| Feature | Hvor | Hvorfor |
| --- | --- | --- |
| Offisiell `pluralPlugin` | translate | Største ærlig gap i README |
| `provideDialogTesting` auto-wrap | dialog/testing | README krever to steg i dag |
| `mod` i `trigger()` og `contextGuard` | shortcut | Samme normalisering overalt |
| `flashCells` i konsument-README | data-grid | Allerede shipped |
| `cellRange` i quick-start (Excel-linjen) | data-grid | OVERVIEW lover spreadsheet-interaksjon |
| Typed headers-eksempel i demo | event-bus | API finnes, demo viser det knapt |
| `indexedDBPlugin` + `persistPlugin` side ved side i README | store | Når velger man hva? |
| `createWebSocket` uten `effect` når URL er statisk? | socket | Overkill for «koble til denne URL-en» — ev. `connect()` / `disconnect()` i tillegg til URL-signal |

---

## Ting jeg bevisst *ikke* foreslår

- Å klone AG Grid API i data-grid. OVERVIEW har rett: problem-sjekkliste, ikke API-klon.
- Å slå sammen pakkene til ett `@angular-libs/core`. Tree-shaking og uavhengig versjonering er en feature.
- RxJS i core på event-bus/store. `on$`-oppskriften i event-bus README er riktig escape hatch.
- Design-system / CDK i form. Native popover + CSS-anker er et bevisst, godt valg.
