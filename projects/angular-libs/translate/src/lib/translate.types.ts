import type { ALTranslate } from './translate.service';

/**
 * Represents a key-value map for translations.
 * Variables can be used in values by wrapping them in double curly braces.
 * @example
 * { "greeting": "Hello, {{ name }}!" }
 */
export type TranslationDictionary = Record<string, string>;

/**
 * Input structure for translations, supporting nested objects.
 * Nested objects are automatically flattened into dot-separated string keys (e.g. `{ home: { title: "Welcome" } }` becomes `"home.title": "Welcome"`).
 * Arrays are converted to comma-separated strings.
 */
export type TranslationInput = Record<string, unknown>;

/**
 * Utility type to extract dot-notation translation keys from a nested object type.
 * Useful for strongly typing translation keys from a JSON file or const object.
 */
export type JoinTranslationKeys<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

/**
 * Utility type to extract all dot-notation translation keys from a deeply nested object type.
 *
 * **Important Performance Note:** If you are importing a large `.json` file for these types,
 * ensure you use `import type` so the bundler does not include the JSON file in your main JavaScript bundle.
 * For massive dictionaries, relying on `resolveJsonModule` may impact IDE compilation performance.
 *
 * @example
 * // 1. From a JSON file (requires "resolveJsonModule": true in tsconfig)
 * // Use 'import type' to prevent the JSON from being bundled!
 * import type enTranslations from '../../assets/i18n/en.json';
 * export type MyKeys = TranslationKeysOf<typeof enTranslations>;
 *
 * @example
 * // 2. From a const object
 * const translations = { home: { title: 'Welcome' } } as const;
 * export type MyConstKeys = TranslationKeysOf<typeof translations>; // 'home' | 'home.title'
 */
export type TranslationKeysOf<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | JoinTranslationKeys<K, TranslationKeysOf<T[K]>>
        : never;
    }[keyof T]
  : '';

/**
 * A schema mapping translation keys to their required parameter types.
 * Provide an interface to `ALTranslate` to enforce strict parameter typing,
 * or provide a string union if you only want to strictly type keys without parameter validation.
 *
 * @example
 * // Option 1: Strict Interface (Validates keys AND params)
 * export interface AppTranslations {
 *   'home.title': undefined;
 *   'greeting': { name: string };
 * }
 *
 * @example
 * // Option 2: String Union (Validates keys, loose params)
 * export type AppKeys = 'home.title' | 'greeting';
 */
export type TranslationSchema = Record<string, any> | string;

// Type helper to extract keys from either schema style
export type ExtractKeys<TSchema> = TSchema extends string ? TSchema : keyof TSchema & string;

// Type helper to extract params dynamically based on schema style
export type ExtractParams<TSchema, K extends string> = TSchema extends string
  ? [params?: Record<string, unknown>] // String union fallback: loose params
  : undefined extends TSchema[keyof TSchema & K]
    ? [params?: TSchema[keyof TSchema & K]]
    : [params: TSchema[keyof TSchema & K]];

/**
 * Configuration options for providing the ALTranslate service.
 */
export interface ALTranslateTransformContext<TSchema extends TranslationSchema = any> {
  /** The currently translated/formatted text. Allows mutations between plugins. */
  text: string;
  /** The targeted translation key. */
  key: ExtractKeys<TSchema>;
  /** Dynamic interpolation parameter values. */
  params: Record<string, unknown> | undefined;
  /** Reference to the ALTranslate service. */
  service: ALTranslate<TSchema>;
  /** The original, raw, untransformed translation template value. */
  sourceText: string;
}

export interface ALTranslatePlugin<TSchema extends TranslationSchema = any> {
  /** Uniquely identifies the plugin. */
  name: string;
  /** Executed once when the service is initialized. */
  onInit?(event: { service: ALTranslate<TSchema> }): void;
  /** Executed whenever the active language is updated. */
  onLangChange?(event: { lang: string; service: ALTranslate<TSchema> }): void;
  /** Executed when a requested key is missing. Can return a fallback string. */
  onMissingKey?(event: { key: string; service: ALTranslate<TSchema> }): string | undefined;
  /** Executed after a key is fetched and default-formatted to apply post-processing. */
  transform?(event: ALTranslateTransformContext<TSchema>): string;
}

export interface ALTranslateConfig<TSchema extends TranslationSchema = any> {
  /** The default language to set upon initialization (e.g., 'en'). */
  defaultLang: string;
  /**
   * A function that returns a Promise resolving to the translations for a given language.
   * As it runs in an injection context, you can safely use `inject()` here (e.g., `inject(HttpClient)`).
   * @example (lang) => inject(HttpClient).get<TranslationInput>(`/assets/i18n/${lang}.json`).toPromise()
   */
  loader?: (lang: string) => Promise<TranslationInput>;
  /** A static dictionary to load instead of using the network fetch. */
  staticData?: TranslationInput;
  /** Fallback translations to use if a key is missing in the primary language. */
  fallbackData?: TranslationInput;
  /**
   * If true (or omitted), halts application initialization until the default language is loaded.
   * If false, allows the app to bootstrap immediately and loads translations lazily.
   */
  blockBootstrap?: boolean;
  /** Optional array of lifecycle-aware plugins to run. */
  plugins?: ALTranslatePlugin<TSchema>[];
}
