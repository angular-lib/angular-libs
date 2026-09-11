# Competitive research: `@angular-libs/translate`

Research only. No library source was changed.

| Field | Value |
| --- | --- |
| Package | `@angular-libs/translate` `0.2.0` |
| Scope | This package only. Other monorepo libraries were skipped. |
| Date | 2026-09-11 |
| npm weekly downloads (ours) | 11 (`2026-09-04`–`2026-09-10`) |
| Angular peers | `@angular/core` / `@angular/common` `>=19.0.0` |
| Runtime deps | `tslib` only |

## Method

1. Trace **our** public API and runtime from source under `projects/angular-libs/translate`, plus the demo wiring. README claims are treated as marketing unless the same behavior exists in code.
2. Compare against **current official docs / npm metadata**, not blog summaries, for each competitor.
3. A feature is marked **missing** only when our source has no first-class implementation. An extension hook (plugin / formatter) is not the feature.
4. Scores are **capability completeness (1–100)** for that row, not popularity. `100` = production-ready, first-class, documented. `1` = absent and impractical to DIY on top of the public API.
5. Essentiality (1–100) is “how badly a typical Angular 19+ **runtime** i18n user needs this to leave ngx-translate / Transloco,” not “how nice for compile-time / TMS products.”

npm download counts below are the official last-week endpoint for `2026-09-04`–`2026-09-10`.

## What we actually ship (source-traced)

Public API is a single barrel. `src/public-api.ts` re-exports `src/lib/translate.ts`, which re-exports types, service, and pipe only.

| Surface | Source | Reality |
| --- | --- | --- |
| Provider | `provideALTranslate()` in `translate.service.ts` | `defaultLang`, optional `loader` / `staticData` / `fallbackData` / `plugins` / `blockBootstrap`. Loader runs in an injection context. |
| Service | `ALTranslate` | Signals: `currentLang`, `select()` → `computed`. Sync `get()`. `loadLanguage`, `setLoader`, `setDictionary`, `addToDictionary`, `setFallbackDictionary`. |
| Pipe | `TranslatePipe` | Standalone, **`pure: false`**, untyped `key: string`. Calls `get()` every change-detection cycle. |
| Interpolation | `DefaultTranslateFormatter` | Mustache `{{ key }}` / `{{key}}` only. Combined regex, no recursive interpolation. Injectable via `ALTranslateFormatter`. |
| Nested JSON | `flattenDictionary()` | Objects flattened to dot keys. Arrays become `String(value)` (comma-joined). Only **leaf** strings are stored. |
| Types | `translate.types.ts` | `TranslationKeysOf<T>` (includes intermediate object keys). `TranslationSchema` can require per-key params. Pipe is not generic. |
| Plugins | `ALTranslatePlugin` | `onInit`, `onLangChange`, `onMissingKey`, `transform`. Errors are caught and logged. **No official plugins ship.** |
| Bootstrap | `provideAppInitializer` | Default `blockBootstrap !== false` waits for the default-language loader. Rejected loads are logged and **do not fail bootstrap**. |
| Missing keys | `get()` | Primary dict → fallback dict → `onMissingKey` plugins → return the raw key. Dev-mode warn once per key per language. |
| Language switch | `loadLanguage()` | Always calls the loader, then **replaces** the active dictionary. No cache, no `isLoading`, no fallback-language fetch. `setDictionary()` does not update `currentLang`. |

Documented limitations in `projects/angular-libs/translate/README.md` match the source: single active dictionary, no pluralization, no ICU, `TranslationKeysOf` includes intermediate keys, bootstrap does not fail on loader reject.

README claims that **overreach** the source:

| Claim | Source check |
| --- | --- |
| “zero runtime overhead” | Flatten + `RegExp` interpolation + an **impure pipe** + plugin loops are not zero overhead. |
| “Signals First” as a unique differentiator | True for `select()`, but the advertised template path is an impure pipe. ngx-translate v18 and Transloco now have first-class signal APIs (see parity table). |
| Demo card “Numeric Pluralization” | `projects/demo/src/app/demos/translate-demo.component.ts` interpolates `{{count}}` only. README correctly says there are no plural rules. |

---

## A) Competitor inventory (11 libraries)

| # | Library | Role | Version / peers (npm 2026-09-11) | Weekly dl | Verdict vs us |
| --- | --- | --- | --- | --- | --- |
| 1 | [`@ngx-translate/core`](https://www.npmjs.com/package/@ngx-translate/core) | Default Angular **runtime** i18n. v18 is standalone + Signals. | `18.0.0`; Angular `>=18`, `rxjs` `>=7` | 1,000,054 | Same product category. Larger API: directive, `*translateBlock`, hierarchical services, `fallbackLang`, `isLoading`, reactive `translate()`, compiler/parser/loader slots. Docs: [ngx-translate.org](https://ngx-translate.org/), [service API](https://ngx-translate.org/reference/translate-service-api/), [concepts](https://ngx-translate.org/reference/concepts/). |
| 2 | [`@jsverse/transloco`](https://www.npmjs.com/package/@jsverse/transloco) | Feature-complete Angular runtime i18n + official plugin family. | `8.4.0`; Angular `>=16`, `rxjs` `>=6` | 218,628 | Same category, much wider surface: scopes, multi-lang, fallbacks, retries, `translateSignal` (tracks Signal params), testing, SSR, schematics. Docs: [gitbook](https://jsverse.gitbook.io/transloco), [signals](https://jsverse.gitbook.io/transloco/core-concepts/signals), [config](https://jsverse.gitbook.io/transloco/getting-started/config-options). |
| 3 | [`@angular/localize`](https://www.npmjs.com/package/@angular/localize) + Angular built-in i18n | Official **compile-time / per-locale** i18n (`i18n` attrs, `$localize`, `ng extract-i18n`, ICU). | `22.1.6` (tracks Angular) | 968,279 | Different product. Wins on ICU, XLIFF/ARB, locale data, CLI. Loses on in-app language switch unless you adopt runtime `$localize` + reload. Docs: [i18n overview](https://angular.dev/guide/i18n), [translation files](https://angular.dev/guide/i18n/translation-files), [deploy locales](https://angular.dev/guide/i18n/deploy), [add package](https://angular.dev/guide/i18n/add-package). |
| 4 | [`ngx-i18next`](https://www.npmjs.com/package/ngx-i18next) | Legacy Angular **4** i18next wrapper (user-requested name). | `1.1.8` (2017-04-27); Angular `^4` | 7 | **Not a current competitor.** Do not target it. Successor is `angular-i18next`. |
| 5 | [`angular-i18next`](https://www.npmjs.com/package/angular-i18next) | Current Angular binding for [i18next](https://www.i18next.com). Listed on i18next’s [framework page](https://www.i18next.com/overview/supported-frameworks). | `21.0.0`; Angular `^21.1.1`, `i18next` `^25.4.0` | 18,762 | Different architecture: thin Angular layer over i18next (plurals, namespaces, context, detector, HTTP backend). Submodules: `ssr`, `forms`, `testing`. Repo: [Romanchuk/angular-i18next](https://github.com/Romanchuk/angular-i18next). |
| 6 | [`i18next`](https://www.npmjs.com/package/i18next) | Framework-agnostic engine used by #5. | `26.4.2` | 15,911,130 | Not Angular-specific, but it is the feature bar for plurals / namespaces / fallbacks. Docs: [plurals](https://www.i18next.com/translation-function/plurals). |
| 7 | [`angular-l10n`](https://www.npmjs.com/package/angular-l10n) | Translation **plus** `Intl` date/number/currency, locale schema, localized routing, SSR sample. | `17.0.1`; Angular `>=17` (+ forms, router, common) | 5,693 | Overlaps us on runtime JSON, beats us on l10n + routing. README: [robisim74/angular-l10n](https://github.com/robisim74/angular-l10n). |
| 8 | [`@tolgee/ngx`](https://www.npmjs.com/package/@tolgee/ngx) | Angular SDK for Tolgee (in-context editing, namespaces, ICU via plugin). | `7.2.1` (2026-09-09) | 2,727 | TMS-first, not a drop-in core. Docs: [Angular overview](https://docs.tolgee.io/js-sdk/integrations/angular/overview), [install](https://docs.tolgee.io/js-sdk/integrations/angular/installation). |
| 9 | [`@ngx-translate/http-loader`](https://www.npmjs.com/package/@ngx-translate/http-loader) | Official ngx-translate HTTP loader; v18 multi-resource + 404 policy. | `18.0.0`; peers Angular `>=18`, core `>=18` | 734,733 | Companion, not a full i18n lib. Shows the loader product users expect. Mentioned on [ngx-translate.org](https://ngx-translate.org/) and [concepts](https://ngx-translate.org/reference/concepts/). |
| 10 | [`ngx-translate-messageformat-compiler`](https://www.npmjs.com/package/ngx-translate-messageformat-compiler) | ICU MessageFormat compiler for ngx-translate. | `7.3.0`; ngx-translate `^14`–`^18` | 43,681 | Proves ICU is a required ecosystem slot we do not have. Repo: [lephyrus/ngx-translate-messageformat-compiler](https://github.com/lephyrus/ngx-translate-messageformat-compiler). |
| 11 | [`@gilsdav/ngx-translate-router`](https://www.npmjs.com/package/@gilsdav/ngx-translate-router) | Locale-prefixed / translated Angular routes on top of ngx-translate. **Repo marked deprecated.** | `8.0.0`; Angular `>=16.2.12`, ngx-translate `>=17` | 3,390 | Adjacent. We have no routing story. angular-l10n still documents [localized routing](https://github.com/robisim74/angular-l10n#localized-routing). |

**Official Transloco add-ons (not separate inventory rows):** [`@jsverse/transloco-messageformat`](https://jsverse.gitbook.io/transloco/plugins-and-extensions/message-format) (44,753 dl), [`@jsverse/transloco-locale`](https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n) (36,540), [`@jsverse/transloco-persist-lang`](https://jsverse.gitbook.io/transloco/plugins-and-extensions/persist-lang) (14,601), [`@jsverse/transloco-keys-manager`](https://jsverse.gitbook.io/transloco/developer-tools/keys-manager-tkm) (36,537). These are the plugin products our `ALTranslatePlugin` hook does not yet replace.

**Excluded as not clearly relevant:** Phrase/Lokalise/Crowdin (TMS SaaS), `@ngneat/transloco` (old publish scope of #2), BabelEdit (editor), `ngx-translate-extract` (tooling only).

---

## B) Gap table

Missing = not implemented in our source. “Who has it” lists first-class support with citations.

| Missing feature | Who has it | Essentiality | Why |
| --- | --- | --- | --- |
| ICU / CLDR pluralization and gender | Angular ICU in translation files ([docs](https://angular.dev/guide/i18n/translation-files)); Transloco `@jsverse/transloco-messageformat` ([docs](https://jsverse.gitbook.io/transloco/plugins-and-extensions/message-format)); i18next CLDR suffixes ([plurals](https://www.i18next.com/translation-function/plurals)); ngx-translate via compiler + `ngx-translate-messageformat-compiler` ([npm](https://www.npmjs.com/package/ngx-translate-messageformat-compiler)); Tolgee `FormatIcu` ([install](https://docs.tolgee.io/js-sdk/integrations/angular/installation)); angular-l10n `l10nPlural` pipe ([README](https://github.com/robisim74/angular-l10n)) | 96 | Our README and `DefaultTranslateFormatter` only do `{{ var }}`. Slavic / Arabic apps cannot ship. The demo “pluralization” card is interpolation. `ALTranslateFormatter` is a hook, not rules. |
| Fallback **language** load (chain), not only a static fallback dict | ngx-translate `fallbackLang` signal ([service API](https://ngx-translate.org/reference/translate-service-api/)); Transloco `fallbackLang` + `missingHandler.useFallbackTranslation` ([config](https://jsverse.gitbook.io/transloco/getting-started/config-options)); i18next `fallbackLng` | 93 | We have `fallbackData` / `setFallbackDictionary()` — one flattened map, never loaded by language code. Partial translations (the common case) fall back to the raw key. |
| In-memory cache of already-loaded languages | Transloco (switch back without refetch; multi-lang mode on [README](https://github.com/jsverse/transloco)); ngx-translate store keeps compiled translations per lang ([concepts](https://ngx-translate.org/reference/concepts/)); i18next resources; angular-l10n `cache: true` | 91 | `loadLanguage()` always `await this.loader(lang)` then `setDictionary()` (replace). Re-opening a language refetchs and drops any `addToDictionary()` merges. |
| Feature scopes / namespaces / hierarchical child stores | Transloco `provideTranslocoScope` ([scope docs](https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/scope-configuration)); ngx-translate `provideChildTranslateService()` ([concepts](https://ngx-translate.org/reference/concepts/)); i18next / angular-i18next namespaces; Tolgee `namespaceResolver` ([overview](https://docs.tolgee.io/js-sdk/integrations/angular/overview)) | 90 | `addToDictionary()` merges into **one** global flat map. Lazy routes cannot isolate or unload keys. README: “Single dictionary active at a time.” |
| `isLoading` / initialized signal | ngx-translate `isLoading: Signal<boolean>` ([service API](https://ngx-translate.org/reference/translate-service-api/)); Transloco structural directive waits for load ([FAQ](https://jsverse.gitbook.io/transloco/resources/faqs)) | 88 | No public loading flag. Templates can render the raw key during the first fetch even with `blockBootstrap: false`. |
| Reactive params / keys in the signal API | ngx-translate `translate(key, params, lang)` accepts values, functions, or Signals ([components guide](https://ngx-translate.org/getting-started/translating-your-components/)); Transloco `translateSignal(dynamicKey, dynamicParam)` ([signals](https://jsverse.gitbook.io/transloco/core-concepts/signals)) | 87 | README: `select()` **snapshots params at call time**. Callers must wrap `computed(() => get(key, paramsSignal()))`. Easy to get stale interpolations. |
| Signal-driven (or memoized) template API | ngx-translate pipe / directive / `*translateBlock` are signal-driven ([concepts](https://ngx-translate.org/reference/concepts/)); Transloco `*transloco` is one subscription + memoized `t()` ([gitbook](https://jsverse.gitbook.io/transloco)) | 86 | Our pipe is `pure: false` and calls `get()` every CD. That contradicts the “minimal change detection” README. |
| Attribute / structural directive | ngx-translate `[translate]` + `*translateBlock` ([components](https://ngx-translate.org/getting-started/translating-your-components/)); Transloco `*transloco`; Tolgee `TDirective` ([translating](https://docs.tolgee.io/js-sdk/integrations/angular/translating)); Angular `i18n` / `i18n-*` | 78 | Public API has no directive. Attribute translation and innerHTML-friendly bindings are DIY. |
| Typed template helper | ngx-translate `t()` inside `*translateBlock` ([concepts](https://ngx-translate.org/reference/concepts/)); Transloco keys-manager + typed keys; i18next TS selectors | 80 | `ALTranslate<Schema>` types `get`/`select` only. `TranslatePipe.transform(key: string)` is untyped. Templates are the main API. |
| Official HTTP / multi-file loader | `@ngx-translate/http-loader` v18 multi-resource ([npm](https://www.npmjs.com/package/@ngx-translate/http-loader), [home](https://ngx-translate.org/)); Transloco HTTP loader + inline scope loaders ([inline loaders](https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/inline-loaders)) | 74 | We only accept `(lang) => Promise<TranslationInput>`. Fine for tiny apps; users rewrite multi-ns / prefix / 404 policy every time. |
| Persist last language | `@jsverse/transloco-persist-lang` ([docs](https://jsverse.gitbook.io/transloco/plugins-and-extensions/persist-lang)); Tolgee `LanguageStorage` ([install](https://docs.tolgee.io/js-sdk/integrations/angular/installation)); i18next language detector + cache | 84 | No storage plugin. Every reload snaps back to `defaultLang`. Highest-ROI plugin we could ship on the existing `onLangChange` hook. |
| Browser / Accept-Language detector | Tolgee `LanguageDetector`; i18next-browser-languagedetector (used in angular-i18next README); angular-l10n `L10nLocaleResolver`; Angular deploy uses `Accept-Language` ([deploy](https://angular.dev/guide/i18n/deploy)) | 72 | No resolver. First visit always `defaultLang`. |
| Fallback / retry / available-lang policy | Transloco `failedRetries`, `availableLangs`, `missingHandler.*` ([config](https://jsverse.gitbook.io/transloco/getting-started/config-options)); ngx-translate fallback + missing handler plugin ([concepts](https://ngx-translate.org/reference/concepts/)) | 81 | Failed `loadLanguage` logs, rethrows, leaves the previous (or empty) dict. No retry, no `availableLangs`, empty-string policy is “return the key.” |
| Per-call language override + keep multiple langs | ngx-translate `translate/get/instant(..., lang)` ([service API](https://ngx-translate.org/reference/translate-service-api/)); Transloco `translateSignal(..., 'es')` and “handle multiple languages simultaneously” ([README](https://github.com/jsverse/transloco)) | 70 | One flattened dict. Cannot render “EN title + FR body” or prefetch. |
| Locale formatting (date / number / currency) | Angular `DatePipe` / `DecimalPipe` + locale data ([import locales](https://angular.dev/guide/i18n/import-global-variants)); `@jsverse/transloco-locale` ([docs](https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n)); angular-l10n `provideL10nIntl()` ([README](https://github.com/robisim74/angular-l10n)) | 68 | Out of scope today. Apps still need it; they will add a second library. |
| Key extraction CLI / marker | `ng extract-i18n` ([translation files](https://angular.dev/guide/i18n/translation-files)); Transloco keys-manager ([TKM](https://jsverse.gitbook.io/transloco/developer-tools/keys-manager-tkm)); ngx-translate `_()` marker ([components](https://ngx-translate.org/getting-started/translating-your-components/)); i18next-cli ([frameworks](https://www.i18next.com/overview/supported-frameworks)) | 64 | Keys drift. We have types-from-JSON, which helps only if JSON is the source of truth. |
| Compile-time / XLIFF / per-locale builds | Angular built-in i18n ([deploy](https://angular.dev/guide/i18n/deploy)) | 40 | Different product. Essential for some enterprises, not for a runtime JSON lib. Do not pretend to replace `@angular/localize`. |
| Testing helpers | Transloco `TranslocoTestingModule` + `preloadLangs` ([FAQ](https://jsverse.gitbook.io/transloco/resources/faqs)); `angular-i18next/testing` ([README](https://github.com/Romanchuk/angular-i18next)) | 55 | Consumers write `TestBed` + `provideALTranslate({ staticData })` themselves. Workable, not packaged. |
| SSR-specific integration | Transloco lists SSR ([README](https://github.com/jsverse/transloco)); `angular-i18next/ssr`; angular-l10n SSR sample; Angular i18n + `outputMode: server` ([deploy](https://angular.dev/guide/i18n/deploy)) | 58 | `fetch` loaders work on the server only if the user writes them that way. No TransferState, no cookie lang, no docs. |
| Localized routes | angular-l10n localized routing; `@gilsdav/ngx-translate-router` (deprecated, [npm](https://www.npmjs.com/package/@gilsdav/ngx-translate-router)); Angular per-locale directories ([deploy](https://angular.dev/guide/i18n/deploy)) | 42 | Nice for SEO. Not required for an in-app dictionary. |
| In-context TMS editing | `@tolgee/ngx` DevTools ([overview](https://docs.tolgee.io/js-sdk/integrations/angular/overview)) | 28 | SaaS feature. Not a core gap unless we want a Tolgee plugin later. |
| Leaf-accurate `TranslationKeysOf` | — (our type is wider than runtime) | 73 | `TranslationKeysOf` unions intermediate keys (`'home' \| 'home.title'`), but flatten stores only leaves (`translate.types.ts` + `flattenDictionary`). Typed `get('home')` compiles and returns `"home"` at runtime. |

---

## C) Parity table

Competitor column uses the strongest **current** implementation in this category (usually ngx-translate v18 or Transloco). Angular built-in is called out when it is the real winner.

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
| --- | --- | --- | --- | --- | --- |
| Runtime language switch without reload | `loadLanguage(lang)` fetches, `setDictionary`, `currentLang.set`, `onLangChange` | ngx-translate `use()`; Transloco `setActiveLang`; i18next `changeLanguage` | 78 | 94 | Works. We refetch every time, have no loading signal, and `currentLang.set()` alone desyncs UI from the dictionary (README warns). |
| Signals API | `currentLang` WritableSignal; `select()` → `computed` that tracks `currentLang` + `dictionary` via `get()` | ngx-translate `currentLang` / `fallbackLang` / `isLoading` + `translate()` Signal; Transloco `activeLang` + `translateSignal` / `translateObjectSignal` | 70 | 93 | We pioneered a small signal core, but competitors now track **input** Signals and expose loading/fallback. Our `select()` freezes params. |
| Standalone `provide*` setup | `provideALTranslate({...})` | `provideTranslateService` / `provideTransloco` / `provideI18Next` / `provideL10nTranslation` / `provideTolgee` | 88 | 92 | Clean and modern. We have no child/scope provider. |
| Template pipe | Impure `translate` pipe → `get()` | ngx-translate signal-driven pipe; Transloco pipe + `*transloco`; Angular `i18n` (no pipe) | 62 | 90 | Same `{{ 'KEY' \| translate }}` habit. Ours re-runs every CD. Untyped. |
| Interpolation | `{{ name }}` via `DefaultTranslateFormatter`; custom formatter token | ngx-translate `TranslateParser`; Transloco configurable delimiters `interpolation: ['{{','}}']`; i18next format / nesting | 80 | 90 | Solid mustache, escapes regex, no `$&` corruption (covered in `translate.spec.ts`). No delimiter config, no nested-key interpolation, no format functions. |
| Nested JSON | Flatten to dots; arrays → `String(array)` | ngx-translate / Transloco nested objects + flatten options; i18next nested keys | 74 | 88 | Flatten works. Array coercion is a footgun. Intermediate keys exist in types only. |
| Type-safe keys and **params** | `ALTranslate<Schema>` + `ExtractParams`; optional `TranslationKeysOf<json>` | ngx-translate `_()` extract marker, typed `t()` in block (weaker compile-time params); Transloco generated keys; i18next official TS | 86 | 78 | **Our clearest remaining advantage** if users adopt Option B interfaces. Undercut by untyped pipe and intermediate keys in `TranslationKeysOf`. |
| Plugin / compiler slots | 4 lifecycle hooks + injectable formatter | ngx-translate loader / compiler / parser / missing handler; Transloco transpilers + official plugins; i18next `.use()` | 64 | 92 | Hooks are real (`translate.spec.ts` covers DI + error isolation). Ecosystem is empty: no persist, ICU, locale, HTTP, detector packages. |
| Missing-key handling | Fallback dict + `onMissingKey` + dev warn + return key | ngx-translate `MissingTranslationHandler` + fallback lang; Transloco `missingHandler` + fallback translation; i18next | 72 | 90 | Static fallback dict is fine for a few strings. Not a language chain. |
| Bootstrap flicker control | `blockBootstrap` (default on); loader reject does not fail app | angular-i18next `provideAppInitializer` + i18next `init`; Tolgee `provideTolgee` starts via initializer; ngx-translate loads on `use()` | 84 | 86 | Good default. Documented non-fatal reject is honest. No TransferState for SSR. |
| Sync read | `get()` | ngx-translate `instant()`; Transloco `translate()`; i18next `t()`; Tolgee `instant()` (warns if unloaded) | 82 | 88 | Fine. No “wait until loaded” variant besides awaiting `loadLanguage`. |
| Lazy extra strings | `addToDictionary()` merge into the active map | Transloco scopes / inline loaders; ngx-translate child service + `setTranslation`; i18next `loadNamespaces` | 55 | 91 | Merge is global and dies on the next `loadLanguage`. |
| Bundle / peers | Angular `>=19`, no RxJS peer | ngx-translate needs RxJS; Transloco needs RxJS; i18next stack is heavier; Angular localize is first-party | 90 | 70 | Real size/peer win. Meaningful only if the feature gap stays tolerable. |
| Docs / ecosystem / TMS | README + StackBlitz + this repo’s demo | ngx-translate.org + BabelEdit; Transloco gitbook + schematics + TKM; Angular CLI; i18next.com; Tolgee platform | 40 | 95 | 11 weekly downloads vs ~1M / ~219k. Switching cost is ecosystem, not `get()`. |
| Compile-time / XLIFF | None | Angular `ng extract-i18n`, XLIFF/ARB/JSON/XMB, per-locale deploy | 5 | 96 | We are not in this market. Say so in the README. |
| Plural / ICU | None (formatter hook only) | Angular ICU; Transloco messageformat; i18next CLDR; ngx-translate compiler | 12 | 94 | See gap table. |
| Fallback language | Static `fallbackData` only | ngx-translate / Transloco / i18next language fallback | 35 | 92 | Dictionary ≠ language. |
| Directive / block API | None | ngx-translate / Transloco / Tolgee / Angular `i18n` | 8 | 90 | |
| Language persist + detect | None | Transloco persist-lang; Tolgee detector/storage; i18next | 5 | 88 | Lowest-effort official plugins. |
| Hierarchical / scoped dicts | None | Transloco scopes; ngx-translate child services; i18next ns | 10 | 93 | |
| Locale-aware formatting | None | Angular pipes; transloco-locale; angular-l10n | 5 | 92 | |
| Localized routing | None | angular-l10n; ngx-translate-router (deprecated); Angular locale dirs | 3 | 80 | Router package is deprecated; still a gap. |
| In-context editing | None | Tolgee DevTools | 2 | 90 | Different product. |

---

## D) Improvement backlog

Priority is implementation value for this package (runtime JSON + Signals), not “become Angular i18n.”

| Improvement | Priority | Rationale |
| --- | --- | --- |
| Ship ICU / CLDR plurals (official formatter or `@messageformat/core` plugin), including a real demo | 96 | Hard blocker vs every serious competitor. The formatter token already exists (`ALTranslateFormatter`). Do not ship another `{{count}}` demo labeled “pluralization.” |
| Fallback **language** (load + consult `fallbackLang` when a key is missing) | 94 | `fallbackData` does not cover partial locale files. ngx-translate/Transloco users expect this on day one. |
| Cache loaded dictionaries; `loadLanguage` is a no-fetch hit when warm; keep merges per lang | 93 | Today every switch is a network + full replace. Breaks `addToDictionary`. Small, local change to `loadLanguage` / `setDictionary`. |
| `isLoading` (and maybe `ready`) as `Signal<boolean>` | 90 | Needed for spinners and to stop flashing keys when `blockBootstrap: false`. ngx-translate v18 already has this. |
| Make `select(key, params)` track `Signal` / getter params (and optional Signal key) | 89 | README already documents the footgun. Transloco and ngx-translate solved it. This is the actual “Signals first” work. |
| Rewrite `TranslatePipe` to be signal-driven (or `pure: true` + signal reads), not `pure: false` | 88 | The pipe is the popular API and the performance claim is currently false. |
| Feature scopes: `addToDictionary(ns, data)` or `provideALTranslateChild({ loader })` that does not vanish on lang change | 87 | Without this, lazy-loaded apps cannot adopt us. Model after Transloco scope **or** ngx-translate child service — pick one and document it. |
| Official `persistLang` plugin (`localStorage` / cookie) using `onInit` + `onLangChange` | 86 | Hook already designed for this (`ALTranslatePlugin`). Highest-ROI official plugin. |
| Leaf-only `TranslationKeysOf` (or a separate `TranslationLeafKeysOf`) | 82 | Typed API that accepts keys which do not exist at runtime is a defect, called out in `translate.types.ts`. |
| Generic / typed `TranslatePipe` (or `*translateBlock` with typed `t()`) | 81 | Types that stop at the service will not be used. |
| `availableLangs`, loader retries, empty-string policy | 79 | Transloco’s `failedRetries` / `missingHandler` are the expected production knobs. Our reject-and-log path is thin. |
| Official `httpLoader({ prefix, suffix, resources, failOnError })` helper | 74 | Do not take an HttpClient peer if a factory around `fetch` / `inject(HttpClient)` is enough. Multi-resource is what ngx-translate v18 just added. |
| Attribute directive + optional `*alTranslate` block | 73 | Parity with the APIs people copy from ngx-translate/Transloco snippets. |
| Browser language detector plugin | 71 | Pair with persist. Keep it a plugin so SSR stays explicit. |
| Per-call `get(key, params, lang)` / `select(..., lang)` once a cache exists | 68 | Unlocks bilingual UI and tests. Pointless before cache. |
| Locale plugin (`Intl` date/number pipes) **or** a documented Angular-pipe recipe | 60 | angular-l10n/transloco-locale exist. A thin plugin is enough; a second full l10n kit is not. |
| `extract` / `_()` marker + optional keys-manager docs | 56 | Types-from-JSON covers small apps. Extraction matters when keys live in templates. |
| `provideALTranslateTesting({ langs })` | 52 | Reduce TestBed boilerplate. Transloco’s testing module is a migration checkbox. |
| SSR cookbook: TransferState loader, cookie persist, no `document` in plugins | 50 | Code may already work; the gap is documented, tested guidance. |
| Interpolation delimiter config | 38 | Transloco has it. Rare. Do after ICU. |
| Localized router | 25 | `@gilsdav/ngx-translate-router` is deprecated. Do not build this in core. |
| In-context TMS / Tolgee bridge | 18 | Integration, not core. |
| Compile-time XLIFF / per-locale builds | 10 | Point users at `@angular/localize`. Competing here splits the product. |

### Suggested sequence (still research, not a commitment)

1. Honesty pass: README “zero overhead,” demo plural card, “signals-only pipe,” ngx-translate v18 now being signal-based.
2. Correctness: language cache, fallback language, `isLoading`, Signal params, leaf keys.
3. Template DX: signal pipe, typed pipe or block directive.
4. Official plugins: persist, detector, ICU formatter, HTTP helper.
5. Scale: scopes / child provider.

### What not to chase

- Becoming a TMS (Tolgee).
- Replacing `@angular/localize` for compile-time / XLIFF.
- A first-party router localizer while the ngx-translate one is deprecated and angular-l10n already covers it.
- Matching i18next’s entire plugin universe inside the core package.

---

## Appendix

### Scoring

- **Our score** is traced to `projects/angular-libs/translate/src` and the package README.
- **Competitor score** is traced to the official URL in the same row. If a competitor needs an official plugin (messageformat, persist-lang, http-loader), they still score as having the feature.
- Popularity is listed in section A only. It does not change section C scores.

### Our source map

| Path | Used for |
| --- | --- |
| `projects/angular-libs/translate/package.json` | name, version, peers, keywords (“ngx-translate alternative”), homepage |
| `projects/angular-libs/translate/src/public-api.ts` | exported surface |
| `projects/angular-libs/translate/src/lib/translate.ts` | barrel |
| `projects/angular-libs/translate/src/lib/translate.types.ts` | config, plugins, `TranslationKeysOf`, schema param types |
| `projects/angular-libs/translate/src/lib/translate.service.ts` | flatten, formatter, provider, load/get/select |
| `projects/angular-libs/translate/src/lib/translate.pipe.ts` | impure untyped pipe |
| `projects/angular-libs/translate/src/lib/translate.spec.ts` | interpolation, plugins, missing-key warn reset |
| `projects/angular-libs/translate/README.md` | documented limitations vs marketing claims |
| `projects/demo/src/app/app.config.ts` | in-memory loader, no HTTP, no persist |
| `projects/demo/src/app/demos/translate-demo.component.ts` | pipe + `get()`; fake “pluralization” |

### Primary competitor URLs

- https://ngx-translate.org/
- https://ngx-translate.org/reference/concepts/
- https://ngx-translate.org/reference/translate-service-api/
- https://ngx-translate.org/getting-started/translating-your-components/
- https://ngx-translate.org/getting-started/migration-guide/
- https://github.com/ngx-translate/core/releases
- https://www.npmjs.com/package/@ngx-translate/core
- https://www.npmjs.com/package/@ngx-translate/http-loader
- https://www.npmjs.com/package/ngx-translate-messageformat-compiler
- https://jsverse.gitbook.io/transloco
- https://jsverse.gitbook.io/transloco/core-concepts/signals
- https://jsverse.gitbook.io/transloco/getting-started/config-options
- https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/scope-configuration
- https://jsverse.gitbook.io/transloco/plugins-and-extensions/message-format
- https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n
- https://jsverse.gitbook.io/transloco/plugins-and-extensions/persist-lang
- https://jsverse.gitbook.io/transloco/developer-tools/keys-manager-tkm
- https://github.com/jsverse/transloco
- https://angular.dev/guide/i18n
- https://angular.dev/guide/i18n/translation-files
- https://angular.dev/guide/i18n/deploy
- https://angular.dev/guide/i18n/add-package
- https://www.npmjs.com/package/ngx-i18next
- https://github.com/Romanchuk/angular-i18next
- https://www.npmjs.com/package/angular-i18next
- https://www.i18next.com/overview/supported-frameworks
- https://www.i18next.com/translation-function/plurals
- https://github.com/robisim74/angular-l10n
- https://docs.tolgee.io/js-sdk/integrations/angular/overview
- https://www.npmjs.com/package/@gilsdav/ngx-translate-router
