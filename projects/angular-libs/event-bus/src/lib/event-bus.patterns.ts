/**
 * Colon-separated wildcard matching for event keys (`user:login`).
 *
 * Semantics follow the documented ng-event-bus table (and ngx-signal-hub prefix style):
 * - `*` matches exactly one segment
 * - `**` matches one or more remaining segments from that position
 * - `user:*` matches `user:login` but not `user` or `user:profile:updated`
 * - `user:**` matches `user:login` and `user:profile:updated`
 * - `**` matches every key
 *
 * Wildcards are recognized only as complete segments (`*` / `**`), never as
 * substrings of a literal segment (`user*login` is an exact key).
 */

/** True when `P` contains a `*` or `**` segment and is therefore a pattern, not an exact key. */
export type IsEventPattern<P extends string> = P extends '*' | '**'
  ? true
  : P extends `${infer Head}:${infer Tail}`
    ? Head extends '*' | '**'
      ? true
      : IsEventPattern<Tail>
    : false;

/**
 * Identity of `P` when it is a wildcard pattern; otherwise `never`.
 * Used to keep the pattern overloads from swallowing typos in exact keys.
 */
export type WildcardPattern<P extends string> = IsEventPattern<P> extends true ? P : never;

type SplitColon<S extends string> = S extends `${infer Head}:${infer Tail}`
  ? [Head, ...SplitColon<Tail>]
  : [S];

type MatchParts<P extends readonly string[], K extends readonly string[]> = P extends readonly [
  infer PH extends string,
  ...infer PT extends string[],
]
  ? PH extends '**'
    ? K extends readonly [string, ...string[]]
      ? true
      : false
    : K extends readonly [infer KH extends string, ...infer KT extends string[]]
      ? PH extends '*'
        ? MatchParts<PT, KT>
        : PH extends KH
          ? MatchParts<PT, KT>
          : false
      : false
  : K extends readonly []
    ? true
    : false;

/** Event-map keys that statically match the given pattern. */
export type MatchingEventKeys<TEventMap extends {}, P extends string> = {
  [K in keyof TEventMap]: K extends string
    ? MatchParts<SplitColon<P>, SplitColon<K>> extends true
      ? K
      : never
    : never;
}[keyof TEventMap];

/**
 * Payload type for a pattern subscription.
 *
 * When the pattern statically matches one or more keys in `TEventMap`, this is
 * the union of those payloads. Otherwise it falls back to the full map union
 * (pattern keys are intentionally looser than exact keys).
 */
export type PatternPayload<TEventMap extends {}, P extends string> =
  MatchingEventKeys<TEventMap, P> extends infer MK
    ? [MK] extends [never]
      ? TEventMap[keyof TEventMap]
      : MK extends keyof TEventMap
        ? TEventMap[MK]
        : TEventMap[keyof TEventMap]
    : TEventMap[keyof TEventMap];

/** True when `key` uses `*` or `**` as a complete colon-separated segment. */
export function isWildcardPattern(key: string): boolean {
  if (!key.includes('*')) {
    return false;
  }
  return key.split(':').some((segment) => segment === '*' || segment === '**');
}

/**
 * Returns whether `key` matches a colon-separated wildcard `pattern`.
 * Exact equality always matches (including literal keys that contain `*`).
 */
export function matchesEventPattern(pattern: string, key: string): boolean {
  if (pattern === key) {
    return true;
  }

  const keyParts = key.split(':');
  const patternParts = pattern.split(':');
  const max = Math.max(keyParts.length, patternParts.length);

  for (let i = 0; i < max; i++) {
    const keyPart = keyParts[i];
    const patternPart = patternParts[i];

    if (patternPart === '**' && keyPart !== undefined) {
      return true;
    }

    if (patternPart === '*') {
      if (keyPart === undefined) {
        return false;
      }
      continue;
    }

    if (patternPart !== keyPart) {
      return false;
    }
  }

  return true;
}
