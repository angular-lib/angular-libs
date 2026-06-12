# @angular-libs/translate

A modern, highly performant, Signals-based translation library specifically built for Angular 19+ and Standalone Components. Fast, strongly typed, and natively supports nested JSON with zero runtime overhead.

[![npm version](https://img.shields.io/npm/v/@angular-libs/translate.svg)](https://www.npmjs.com/package/@angular-libs/translate)

[Stackblitz playground](https://stackblitz.com/edit/angular-libs-translate?file=src%2Fmain.ts)

## Features

- ⚡️ **Signals First:** Built around Angular Signals for minimal change detection loops. Returns `computed()` signals directly to your template.
- 🛡️ **End-to-End Type Safety:** Extract types directly from your JSON files or define strict interfaces for keys and their parameters.
- 🪶 **Lightweight:** Tiny core footprint, no transitive dependencies, designed strictly for modern Angular architecture.

## 1. Setup (\`app.config.ts\`)

By default, this halts app initialization until translations are loaded to prevent template flickering.

```typescript
import { provideALTranslate } from '@angular-libs/translate';

export const appConfig = {
  providers: [
    provideALTranslate({
      defaultLang: 'en',
      // The loader runs inside an Injection Context, so you can safely use inject() here if needed.
      loader: (lang) => fetch(`/assets/i18n/${lang}.json`).then((res) => res.json()),

      // Optional: Set to false if you want the app to boot immediately and load languages in the background
      // blockBootstrap: false
    }),
  ],
};
```

## 2. Strong Typing (Optional but Recommended)

You can choose between simple key validation or strict parameter validation.

### Option A: Read types from your JSON (Simple)

Ensure `"resolveJsonModule": true` is active in `tsconfig.json`.

```typescript
// Use 'import type' to prevent your JSON from being bundled in your JS!
import type enTranslations from '../assets/i18n/en.json';
import { TranslationKeysOf, ALTranslate } from '@angular-libs/translate';
import { inject } from '@angular/core';

// Generates a string union of all nested dot-notation keys
export type AppTranslations = TranslationKeysOf<typeof enTranslations>;
```

### Option B: Strict Interface Mapping (Enterprise)

Map your keys and strictly enforce exactly what parameters each key needs.

```typescript
export interface AppTranslations {
  'home.title': undefined; // ❌ No parameters allowed
  greeting: { name: string; age?: number }; // ✅ Strict parameters
}
```

### DRY Strategy: The Alias Subclass (Optional)

If you don't want to manually type `translate: ALTranslate<AppTranslations>` in every single component, you can create an empty subclass and use the `useExisting` provider directly in its decorator.

```typescript
import { Injectable } from '@angular/core';
import { ALTranslate } from '@angular-libs/translate';

@Injectable({ providedIn: 'root', useExisting: ALTranslate })
export class AppTranslateService extends ALTranslate<AppTranslations> {}
```

Now you can just inject `AppTranslateService` anywhere in your app, no extra `app.config.ts` providers needed!

## 3. Usage inside Components

There are three ways to use translations, depending on your needs.

### Option A: The Signals Way (Maximum Performance)

This is the most performant approach in Angular 19. It creates a `computed` Signal that **only** updates the DOM when the language is explicitly changed. It will skip all default change detection cycles.

```typescript
import { Component, inject } from '@angular/core';
import { ALTranslate } from '@angular-libs/translate';
import { AppTranslateService } from './translations'; // If using DRY Subclass Strategy

@Component({
  template: `<p>{{ greetingMsg() }}</p>`,
})
export class MyComponent {
  // Option 1: Explicit Typing
  // private translate: ALTranslate<AppTranslations> = inject(ALTranslate);

  // Option 2: Clean Subclass Injection (DRY Strategy)
  private translate = inject(AppTranslateService);

  // Returns a Signal<string>
  greetingMsg = this.translate.select('greeting', { name: 'Alice' });
}
```

### Option B: The Pipe Way (Classic Angular)

For quick template-driven development, you can use the standalone `TranslatePipe`.

```html
<h2>{{ 'home.title' | translate }}</h2>
<p>{{ 'greeting' | translate: { name: 'Alice' } }}</p>
```

### Option C: The Synchronous Way (For TS Logic)

You can call `.get()` to retrieve the raw string value immediately in TypeScript.
_(Note: Avoid binding `.get()` directly in your HTML templates `{{ translate.get('...') }}` as it executes on every change detection cycle)._

```typescript
import { Component, inject } from '@angular/core';
import { AppTranslateService } from './translations';

export class MyComponent {
  private translate = inject(AppTranslateService);

  checkError() {
    alert(this.translate.get('error.code', { status: 404 }));
  }
}
```

## Recipes

### Changing Language at Runtime

If you provided a `loader` function in your config, simply call `loadLanguage()`:

```typescript
import { Component, inject } from '@angular/core';
import { AppTranslateService } from './translations';

export class MyComponent {
  private translate = inject(AppTranslateService);

  switchLanguage(lang: string) {
    this.translate.loadLanguage(lang).then(() => {
      console.log(`Language switched to ${lang}`);
    });
  }
}
```

### Programmatic API (\`ALTranslate\`)

- `currentLang`: A WritableSignal holding the active language code.
- `loadLanguage(lang: string): Promise<void>`: Fetches and loads translations for a specific language using the provided loader, then sets it as active.
- `setDictionary(translations: TranslationInput)`: Replaces the translation dictionary (does not update active lang).
- `get(key, params)`: Synchronously format a key.
- `select(key, params)`: Returns a Computed Signal of the translation that updates instantly when the language changes.

## Limitations

- **Single dictionary active at a time.** Switching language replaces the current dictionary (unless manually merging).
- **No Pluralization rules** (e.g. "1 item" vs "2 items"). Use manual logic in your templates or services.
- **No ICU message format.** Simple mustache interpolation `{{ variable }}` only.
