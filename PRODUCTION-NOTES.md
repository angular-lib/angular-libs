# Øvrige merknader

Ting som ikke er bugs og ikke konkrete feature-forslag, men som er nyttige å vite før produksjon. Basert på gjennomgang av hele monorepoet 2026-08-17.

---

## Hvor dere faktisk står

Dette er ikke et halvt CLI-template. Kjernen i de fleste pakkene er gjennomtenkt: signal-first, zoneless-vennlig, plugins som factories, `DestroyRef`-cleanup, feilisolering i hooks. dialog, shortcut, event-bus og store har tydelig «vi har tenkt på AI som konsument»-dokumentasjon. data-grid og form er de største og mest «produktaktige».

Det som *ikke* er på plass er **release-maskineriet**: rot-README, LICENSE, CI, ensartet metadata, peer-range, og at lokal `main` ligger **6 commits bak** `origin/main`. Ikke publiser fra denne checkouten uten å rebasere.

Versjonene (`0.0.1`–`0.3.3`) er ærlige. data-grid sier rett ut at breaking er OK til første publish. Ikke kall noe 1.0 før peer deps og public API er låst.

---

## Hva som er sterkt

- **Samme plugin-idé overalt.** `registerPlugin` / `definePlugin` / `fooPlugin()`. Når man kan én pakke, gjetter man de andre.
- **Sekundære entries er riktig brukt.** `data-grid/plugins` + `data-grid/plugin` + `data-grid/internals`, `shortcut/plugins`, `store/rxjs-interop`, `dialog/testing`. Det er mer voksen pakkedesign enn de fleste 0.x-libs.
- **dialog CSS-exports virker.** `styles.css` / `styles/core.css` / `styles/window.css` lander der `package.json` `exports` sier. `sideEffects: ["**/*.css"]` er satt (fikset i 0.1.0).
- **SSR-claims matcher koden** der de er gitt: shortcut og socket er defensive; dialog sier rett ut at `open()` ikke er SSR-safe.
- **Tester finnes** i dialog, event-bus, store, shortcut, socket, translate, form, data-grid, web. Ikke jevnt fordelt, men det er ikke et udekket repo.
- **Demo dekker alle ni pakker.** Det er den beste «er dette ekte?»-sjekken dere har. GitHub Pages-workflowen er den eneste CI-en — den burde utvides, ikke kastes.

---

## Ujevn «ferdighet»

Grovt, fra mest produksjonsklar til minst:

1. **dialog** — README, LICENSE, CHANGELOG, testing-entry, CSS-tokens, i18n-strings. Closest to «kan ligge på npm i morgen» etter B9/B18/B19.
2. **shortcut** — samme nivå, men `0.0.1`, `^22`-peer, korrupt LICENSE, og UI-plugins merket experimental (bra).
3. **event-bus / store / translate** — API-ene er modne, metadata og gamle repo-URL-er henger etter. event-bus `ng add` er en felle.
4. **web** — bred signal-overflate, pen README, feil repo-URL og noen oversolgte beskrivelser.
5. **socket** — selve klienten ser gjennomtenkt ut (generation, outbox epoch, plugins). README er halvparten boilerplate. Peer 18 er feil.
6. **form** — mye ferdig UI, god README, men S2/object-mode (B11) og manglende LICENSE. Avhenger av Signal Forms (riktig peer ≥21).
7. **data-grid** — arkitekturen er den mest gjennomarbeidede i repoet (`createGrid`, hosts, kernel, plugins). Manifestet er nesten tomt. Konsument-README henger etter koden. Dette er et produkt, ikke et snippet — det trenger produkt-metadata.

---

## Dokumentasjonsstil

Dere har tre stiler samtidig:

- **Konsument-README** (dialog, shortcut, form) — install, bootstrap, tabell, ferdig.
- **AI-regler i `<details>`** (event-bus, store) — verdifulle, men de råtner fortere enn resten (feil `combineLatestToSignal`, manglende import).
- **Interne spec-docs** (data-grid OVERVIEW/ARCHITECTURE/ROADMAP) — gull for contributors, støy på npm hvis de kopieres uten merking.

Anbefaling: konsument-README er kontrakten. AI-blokker og ARCHITECTURE kan ligge i repoet; ikke la dem love API som ikke typechecker.

`standalone: true` i README-eksempler er unødvendig støy på Angular 19+ (default). Ikke en bug, bare utdatert sjargong.

---

## Peer deps vs hva koden faktisk bruker

Raskt kart (nyttig når dere rydder B7–B10):

| API | Finnes fra | Brukt av |
| --- | --- | --- |
| `input()` / `output()` / `inject()` | 16–17 | nesten alle |
| `provideAppInitializer` | 19 | translate |
| `resource()` | 19 (eksperimentell) | event-bus, store, socket |
| `resource({ params })` (ikke `request`) | 20 | event-bus, store, socket |
| Signal Forms (`@angular/forms/signals`) | 21 | form, data-grid |
| `linkedSignal` | 19 | data-grid |

Workspace er Angular 22. Det er greit å si «testet på 22, minimum N». Det som *ikke* er greit er å love 18 og importere 20-API i samme fil.

---

## ting jeg nesten kalte bug, men ikke gjorde

Disse er verdt en bevisst beslutning, ikke en stealth-fix.

- **`ALStore.set(key, undefined)` kaller `reset`.** Hvis `T[K]` inkluderer `undefined`, kan du ikke lagre det. Sannsynligvis bevisst.
- **`resourcePlugin` kaller ikke `resource.destroy()`.** Greit for `providedIn: 'root'`. Komponentscoped store kan lekke.
- **`debouncePlugin` behandler `delay: 0` som «ingen regel»** (`if (!delay)`).
- **`applyRowTransaction` bruker `rowId(row, -1)`.** Greit når `rowId` er identitet (`r => r.id`). Feil hvis noen bruker default `(row, index) => index`.
- **`AlFormSelect.hasValue` behandler `0` som tomt.** Matcher `emptyValue`-default for tall, men en ekte option-id `0` skjuler clear.
- **`commandPalettePlugin` default er `ctrl+shift+p`, ikke `mod+shift+p`.** Experimental; Mac-brukere får Control.
- **`DefaultDialogComponent.isMaximized` er en getter, ikke et signal.** Mulig zoneless CD-glitch på maximize-ikonet.
- **`websocketResource` default `bufferWhileOffline: true`** er lett å lese som om det gjelder `createWebSocket()` også (det gjør det ikke).
- **Web-signaler som `try/catch` på `inject()`** og fortsetter uten `DestroyRef` kan lekke hvis de kalles utenfor injection context. De fleste README-eksempler er field initializers, så det går bra.

---

## Demo og GitHub Pages

- Base-href `/angular-libs/` matcher homepage-URL-ene `angular-lib.github.io/angular-libs/<route>`. Det er gjennomtenkt.
- Socket-demo mot `ws://localhost:8080` vil **alltid** være død på Pages. Enten en public echo-server, eller en tydelig «kjør `bun run socket` lokalt»-state i UI.
- `prerendered-routes.json` i dist tyder på at demoen prerendres. dialog `open()` er browser-only — prerender av dialog-ruten er OK så lenge ingen `open()` kjører i constructor.

---

## Verktøy og repo-hygiene

- **Bun 1.1.20** er pinnet i `packageManager` og CI. Konsument-README-er sier `npm install` — det er riktig for *dem*. Contributors trenger én setning om Bun.
- `prettier` ligger i devDependencies uten config eller script.
- Ingen lint-script, ingen commitlint (CONTRIBUTING lover conventional commits likevel).
- `tsconfig` har en leftover path-alias `"socket"` (uscope-t) ved siden av `@angular-libs/socket`.
- Mangler workspace-path for `@angular-libs/dialog/testing` (fungerer etter publish via `exports`).
- event-bus schematic-tsconfig refererer Jasmine-types i et Vitest-repo.

---

## Juridisk / npm-skannere

MIT uten LICENSE-fil i tarballen feiler hos en del firmaskannere. I dag har bare `dialog`, `web` og `shortcut` LICENSE i dist. `web`/`shortcut`-teksten er i tillegg korrupt (`WARRANTY OF WARRANTY`). Roten har ingen LICENSE, så GitHub viser ikke lisensbadge.

`author` er inkonsistent: `benrei`, `angular-lib`, `Angular-Libs`, eller tomt. Velg ett org-navn.

---

## Hvordan jeg ville faset en produksjonsslipp

Ikke «fiks alt, så 1.0». Tre tog:

**Tog A — kan ligge på npm som 0.x etter metadata + B-fix**  
dialog, shortcut, translate, web.

**Tog B — samme, men etter peer-dep + README**  
event-bus (drep eller fiks `ng add`), store, socket (split `websocketResource` eller hev peer til ≥20).

**Tog C — produkt**  
form (fiks B11 først), data-grid (fyll `package.json`, synk README med plugins, så 0.1.0 med «breaking until 1.0» i README).

Tog A kan gå uten å vente på data-grid. Ikke hold dialog igjen fordi grid ikke er ferdig.

---

## Relaterte filer i denne gjennomgangen

- [PRODUCTION-BUGS.md](./PRODUCTION-BUGS.md) — bare bekreftede feil
- [PRODUCTION-IMPROVEMENTS.md](./PRODUCTION-IMPROVEMENTS.md) — forenklinger, features, release-maskineri
