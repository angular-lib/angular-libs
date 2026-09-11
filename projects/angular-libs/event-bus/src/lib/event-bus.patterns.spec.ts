import {
  isWildcardPattern,
  matchesEventPattern,
  type IsEventPattern,
  type MatchingEventKeys,
  type PatternPayload,
} from './event-bus.patterns';

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

interface PatternMap {
  'user:login': { userId: string };
  'user:logout': void;
  'user:profile:updated': { name: string };
  'theme:changed': 'light' | 'dark';
  ready: boolean;
}

describe('event-bus pattern matching', () => {
  describe('isWildcardPattern', () => {
    it('treats *, **, and colon-segment wildcards as patterns', () => {
      expect(isWildcardPattern('*')).toBe(true);
      expect(isWildcardPattern('**')).toBe(true);
      expect(isWildcardPattern('user:*')).toBe(true);
      expect(isWildcardPattern('user:**')).toBe(true);
      expect(isWildcardPattern('*:login')).toBe(true);
    });

    it('does not treat exact keys (including literal asterisk substrings) as patterns', () => {
      expect(isWildcardPattern('user:login')).toBe(false);
      expect(isWildcardPattern('user*login')).toBe(false);
      expect(isWildcardPattern('ready')).toBe(false);
    });
  });

  describe('matchesEventPattern (ng-event-bus documented table)', () => {
    it('matches exact keys', () => {
      expect(matchesEventPattern('user:login', 'user:login')).toBe(true);
      expect(matchesEventPattern('user:login', 'user:logout')).toBe(false);
    });

    it('lets * match exactly one segment', () => {
      expect(matchesEventPattern('*', 'ready')).toBe(true);
      expect(matchesEventPattern('*', 'user:login')).toBe(false);
      expect(matchesEventPattern('user:*', 'user:login')).toBe(true);
      expect(matchesEventPattern('user:*', 'user:logout')).toBe(true);
      expect(matchesEventPattern('user:*', 'user')).toBe(false);
      expect(matchesEventPattern('user:*', 'user:profile:updated')).toBe(false);
      expect(matchesEventPattern('user:*', 'theme:changed')).toBe(false);
      expect(matchesEventPattern('*:login', 'user:login')).toBe(true);
      expect(matchesEventPattern('*:login', 'user:logout')).toBe(false);
    });

    it('lets ** match one or more remaining segments', () => {
      expect(matchesEventPattern('**', 'ready')).toBe(true);
      expect(matchesEventPattern('**', 'user:login')).toBe(true);
      expect(matchesEventPattern('**', 'user:profile:updated')).toBe(true);
      expect(matchesEventPattern('user:**', 'user:login')).toBe(true);
      expect(matchesEventPattern('user:**', 'user:profile:updated')).toBe(true);
      expect(matchesEventPattern('user:**', 'user')).toBe(false);
      expect(matchesEventPattern('user:**', 'theme:changed')).toBe(false);
      expect(matchesEventPattern('a:*:*', 'a:b:c')).toBe(true);
      expect(matchesEventPattern('a:*:*', 'a:b')).toBe(false);
      expect(matchesEventPattern('*:b:*', 'a:b:c')).toBe(true);
      expect(matchesEventPattern('*:b:*', 'a:x:c')).toBe(false);
    });
  });

  describe('pattern types', () => {
    type _starIsPattern = Expect<Equal<IsEventPattern<'*'>, true>>;
    type _prefixIsPattern = Expect<Equal<IsEventPattern<'user:*'>, true>>;
    type _exactIsNotPattern = Expect<Equal<IsEventPattern<'user:login'>, false>>;

    type UserStarKeys = MatchingEventKeys<PatternMap, 'user:*'>;
    type _userStarKeys = Expect<Equal<UserStarKeys, 'user:login' | 'user:logout'>>;

    type UserStarPayload = PatternPayload<PatternMap, 'user:*'>;
    type _userStarPayload = Expect<Equal<UserStarPayload, { userId: string } | void>>;

    type AllPayload = PatternPayload<PatternMap, '**'>;
    type _allPayload = Expect<
      Equal<AllPayload, { userId: string } | void | { name: string } | 'light' | 'dark' | boolean>
    >;

    it('keeps compile-time pattern key/payload mapping', () => {
      const keys: UserStarKeys = 'user:login';
      expect(keys).toBe('user:login');
    });
  });
});
