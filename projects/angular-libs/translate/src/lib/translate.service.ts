import {
  Injectable,
  signal,
  computed,
  Signal,
  isDevMode,
  inject,
  provideAppInitializer,
  EnvironmentProviders,
  makeEnvironmentProviders,
  InjectionToken,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import {
  TranslationDictionary,
  TranslationInput,
  TranslationSchema,
  ExtractKeys,
  ExtractParams,
  ALTranslateConfig,
  ALTranslatePlugin,
} from './translate.types';

function flattenDictionary(
  obj: TranslationInput,
  prefix = '',
  acc: TranslationDictionary = {},
): TranslationDictionary {
  for (const [key, value] of Object.entries(obj)) {
    const pre = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenDictionary(value as TranslationInput, pre, acc);
    } else {
      acc[pre] = String(value);
    }
  }

  return acc;
}

/**
 * Interface for parsing and replacing variables in translation strings.
 * Users can provide their own implementation to support custom logic like plurals.
 */
export abstract class ALTranslateFormatter {
  abstract format(text: string, params?: Record<string, unknown>): string;
}

/**
 * The default formatter, responsible for replacing `{{ key }}` or `{{key}}` with values.
 */
@Injectable({ providedIn: 'root' })
export class DefaultTranslateFormatter implements ALTranslateFormatter {
  format(text: string, params?: Record<string, unknown>): string {
    if (!params) return text;
    let result = text;
    for (const [k, v] of Object.entries(params)) {
      result = result.replaceAll(`{{${k}}}`, String(v)).replaceAll(`{{ ${k} }}`, String(v));
    }
    return result;
  }
}

export const AL_TRANSLATE_CONFIG = new InjectionToken<ALTranslateConfig<any>>('AL_TRANSLATE_CONFIG');

/**
 * Provides the translation service. By default, it halts application boot until
 * translations load. Place this in your app's `providers` array (e.g. `app.config.ts`).
 */
export function provideALTranslate<TSchema extends TranslationSchema = any>(config: ALTranslateConfig<TSchema>): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AL_TRANSLATE_CONFIG, useValue: config },
    provideAppInitializer(() => {
      const translate = inject(ALTranslate);
      const injector = inject(EnvironmentInjector);

      if (config.fallbackData) {
        translate.setFallbackDictionary(config.fallbackData);
      }

      translate.currentLang.set(config.defaultLang);
      (translate as any).triggerLangChange(config.defaultLang);

      if (config.staticData) {
        translate.setDictionary(config.staticData);
      }

      if (config.loader) {
        translate.setLoader((lang: string) =>
          runInInjectionContext(injector, () => config.loader!(lang)),
        );

        if (!config.staticData) {
          const loadPromise = translate.loadLanguage(config.defaultLang).catch(() => {
            // Failure handled internally, we just ensure boot isnt fatally blocked if desired
          });

          // Optionally block bootstrap until the primary language is loaded
          if (config.blockBootstrap !== false) {
            return loadPromise;
          }
        }
      }

      return;
    }),
  ]);
}

/**
 * The main translation service for managing and resolving localized text.
 * Uses Angular Signals to provide highly performant, reactive translations.
 *
 * @example
 * // Option 1: Remote JSON file
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideALTranslate({ defaultLang: 'en', loader: (lang) => fetch(`/assets/i18n/${lang}.json`).then(res => res.json()) })]
 * };
 *
 * @example
 * // Option 2: Static data
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideALTranslate({ defaultLang: 'en', staticData: { 'title': 'Hello' } })]
 * };
 *
 * @example
 * // Option 3: Manual initialization
 * export class AppComponent {
 *   translate = inject(ALTranslate);
 *   constructor() {
 *     this.translate.setDictionary({ 'hello': 'Hello {{name}}!' });
 *   }
 * }
 */
@Injectable({ providedIn: 'root' })
export class ALTranslate<TSchema extends TranslationSchema = any> {
  /** A reactive signal holding the currently active language code (e.g., 'en'). */
  public readonly currentLang = signal<string>('en');

  /** Injectable formatter for string interpolation. Falls back to default. */
  private readonly formatter =
    inject(ALTranslateFormatter, { optional: true }) ?? new DefaultTranslateFormatter();

  private readonly config = inject(AL_TRANSLATE_CONFIG, { optional: true }) as ALTranslateConfig<TSchema> | null;
  private readonly injector = inject(EnvironmentInjector);

  /** Active registered lifecycle plugins */
  private readonly plugins: ALTranslatePlugin<TSchema>[] = this.config?.plugins ?? [];

  constructor() {
    for (const plugin of this.plugins) {
      if (plugin.onInit) {
        try {
          runInInjectionContext(this.injector, () => plugin.onInit!({ service: this }));
        } catch (err) {
          console.error(`[ALTranslate] Plugin "${plugin.name}" failed during onInit phase:`, err);
        }
      }
    }
  }

  /** Internal helper to trigger onLangChange hooks */
  private triggerLangChange(lang: string) {
    for (const plugin of this.plugins) {
      if (plugin.onLangChange) {
        try {
          runInInjectionContext(this.injector, () =>
            plugin.onLangChange!({ lang, service: this }),
          );
        } catch (err) {
          console.error(`[ALTranslate] Plugin "${plugin.name}" failed during onLangChange phase:`, err);
        }
      }
    }
  }

  /** Internal signal storing the current key-value pair translation dictionary. */
  private readonly dictionary = signal<TranslationDictionary>({});

  /** Internal signal storing the fallback translation dictionary. */
  private readonly fallbackDictionary = signal<TranslationDictionary>({});

  /** Set of keys that have already triggered a missing translation warning. */
  private readonly warnedKeys = new Set<string>();

  /**
   * Stores the loader function if provided in config.
   * Used by the `loadLanguage(lang)` method to fetch translation files dynamically.
   */
  private loader?: (lang: string) => Promise<TranslationInput>;

  /**
   * Sets the loader function for fetching translation files.
   */
  setLoader(loader: (lang: string) => Promise<TranslationInput>) {
    this.loader = loader;
  }

  /**
   * Fetches and loads translations for a specific language, then sets it as the active language.
   * Requires `loader` to be set (typically via `provideALTranslate` config.loader).
   *
   * @param lang The language code to switch to (e.g., 'fr').
   * @returns A promise that resolves when the translations are loaded and applied.
   *
   * @example
   * translate.loadLanguage('fr').then(() => console.log('Language switched!'));
   */
  async loadLanguage(lang: string): Promise<void> {
    if (!this.loader) {
      throw new Error(
        '[ALTranslate] loader function is not defined. Set `loader` in provideALTranslate config.',
      );
    }

    try {
      const data = await this.loader(lang);
      this.setDictionary(data);
      this.currentLang.set(lang);
      this.triggerLangChange(lang);
    } catch (err) {
      console.error(`[ALTranslate] Failed to load translations for ${lang}`, err);
      throw err;
    }
  }

  /**
   * Replaces the entire translation dictionary.
   * Note: This does not automatically update the `currentLang` signal.
   *
   * @param translations The full dictionary of translations (nested objects are supported and will be flattened).
   */
  setDictionary(translations: TranslationInput) {
    this.dictionary.set(flattenDictionary(translations));
  }

  /**
   * Adds the provided translations to the existing translation dictionary.
   * Useful for lazy-loading translations or adding feature-specific strings later.
   *
   * @param translations The dictionary to merge (nested objects are supported and will be flattened).
   *
   * @example
   * translate.addToDictionary({ 'extra': 'Added dynamically' });
   */
  addToDictionary(translations: TranslationInput) {
    const flatTranslations = flattenDictionary(translations);
    this.dictionary.update((dictionary) => ({ ...dictionary, ...flatTranslations }));
  }

  /**
   * Sets a fallback dictionary to be used when a translation is missing in the current language.
   *
   * @param translations The fallback dictionary (nested objects are supported and will be flattened).
   *
   * @example
   * translate.setFallbackDictionary({ 'missing_key': 'Fallback text' });
   */
  setFallbackDictionary(translations: TranslationInput) {
    this.fallbackDictionary.set(flattenDictionary(translations));
  }

  /**
   * Retrieves the translated string for a given key synchronously.
   * Intercepts `{{ key }}` placeholders and replaces them if `params` are passed.
   * Falls back to the fallback dictionary if the key is missing in the current language.
   * Logs a console warning in development mode if the specified key isn't found anywhere.
   *
   * @param key The translation key.
   * @param params Optional dynamic values to interpolate into the translation string (e.g., `{{ name }}`).
   * @returns The localized string, or the fallback raw key if no translation is found.
   *
   * @example
   * ```ts
   * // Basic usage
   * const greeting = translate.get('TITLE_KEY');
   *
   * // With parameters
   * const text = translate.get('hello', { name: 'Alice' });
   * ```
   */
  get<K extends ExtractKeys<TSchema>>(key: K, ...args: ExtractParams<TSchema, K>): string {
    const params = args[0] as Record<string, unknown> | undefined;
    const text = this.dictionary()[key as string] ?? this.fallbackDictionary()[key as string];

    if (text === undefined) {
      for (const plugin of this.plugins) {
        if (plugin.onMissingKey) {
          try {
            const resolved = runInInjectionContext(this.injector, () =>
              plugin.onMissingKey!({ key: key as string, service: this }),
            );
            if (resolved !== undefined) {
              return resolved;
            }
          } catch (err) {
            console.error(`[ALTranslate] Plugin "${plugin.name}" failed during onMissingKey phase:`, err);
          }
        }
      }

      if (isDevMode() && !this.warnedKeys.has(key as string)) {
        console.warn(`[ALTranslate] Missing translation for key: "${key as string}"`);
        this.warnedKeys.add(key as string);
      }
      return key as string; // Fast exit if no text found, skips params parsing
    }

    const sourceText = text;
    let result = this.formatter.format(text, params);

    for (const plugin of this.plugins) {
      if (plugin.transform) {
        try {
          result = runInInjectionContext(this.injector, () =>
            plugin.transform!({
              text: result,
              key: key as ExtractKeys<TSchema>,
              params,
              service: this,
              sourceText,
            }),
          );
        } catch (err) {
          console.error(`[ALTranslate] Plugin "${plugin.name}" failed during transform phase:`, err);
        }
      }
    }

    return result;
  }

  /**
   * Returns a computed signal for the translated string.
   * Automatically updates when the dictionary or language changes.
   *
   * @param key The translation key.
   * @param params Optional dynamic values to interpolate.
   */
  select<K extends ExtractKeys<TSchema>>(
    key: K,
    ...args: ExtractParams<TSchema, K>
  ): Signal<string> {
    return computed(() => {
      this.currentLang(); // Track language changes explicitly
      return this.get(key, ...(args as any));
    });
  }
}
