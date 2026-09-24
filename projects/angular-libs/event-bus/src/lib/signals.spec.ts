import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TestEventBus } from './testing/test-bus';

describe('ALEventBus signals', () => {
  let bus: TestEventBus;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(TestEventBus);
  });

  it('onToSignal is undefined until the first event, then follows every payload', () => {
    const theme = bus.onToSignal('theme:changed');
    expect(theme()).toBeUndefined();
    bus.emit('theme:changed', 'dark');
    expect(theme()).toBe('dark');
  });

  it('onToSignal transforms, falls back to defaultValue, and starts from the latest payload', () => {
    bus.emit('user:login', { userId: '7' });
    const id = bus.onToSignal('user:login', { transform: (u) => u.userId, defaultValue: 'guest' });
    expect(id()).toBe('7');
    bus.resetEvent('user:login');
    expect(id()).toBe('guest');
  });

  it('combineLatestToSignal is a typed tuple once every event has been delivered', () => {
    const pair = bus.combineLatestToSignal(['user:login', 'theme:changed']);
    bus.emit('user:login', { userId: '1' });
    expect(pair()).toBeUndefined();
    bus.emit('theme:changed', 'dark');
    const [user, theme] = pair()!;
    expect([user.userId, theme]).toEqual(['1', 'dark']);
  });

  it('combineLatest runs the handler on each event once all have been delivered', () => {
    const got: unknown[] = [];
    bus.combineLatest(['user:login', 'theme:changed'], ([user, theme]) => got.push(`${user.userId}/${theme}`), { unsubscribeOn: 'manual' });
    bus.emit('user:login', { userId: '1' });
    bus.emit('theme:changed', 'dark');
    bus.emit('theme:changed', 'light');
    expect(got).toEqual(['1/dark', '1/light']);
  });
});

describe('ALEventBus.onToResource', () => {
  let bus: TestEventBus;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(TestEventBus);
  });

  it('stays idle with the default value until the event, then loads with transformed params', async () => {
    const loader = vi.fn(async ({ params }: { params: string }) => `profile:${params}`);
    const profile = TestBed.runInInjectionContext(() =>
      bus.onToResource('user:login', { transform: (u) => u.userId, loader, defaultValue: 'guest' }),
    );
    await settle();
    expect(profile.status()).toBe('idle');
    expect(profile.value()).toBe('guest');

    bus.emit('user:login', { userId: '42' });
    await settle();
    expect(profile.value()).toBe('profile:42');
    expect(loader).toHaveBeenCalledOnce();
  });

  it('reloads on every event, even with an identical payload, and passes the event', async () => {
    const seen: string[] = [];
    const theme = bus.onToResource('theme:changed', {
      injector: TestBed.inject(Injector),
      loader: async ({ params, event }) => {
        seen.push(`${params}@${event.key}`);
        return params.toUpperCase();
      },
    });
    bus.emit('theme:changed', 'dark');
    await settle();
    bus.emit('theme:changed', 'dark');
    await settle();
    expect(seen).toEqual(['dark@theme:changed', 'dark@theme:changed']);
    expect(theme.value()).toBe('DARK');
  });

  it('aborts the previous load when a newer event arrives', async () => {
    const aborted: string[] = [];
    const profile = TestBed.runInInjectionContext(() =>
      bus.onToResource('user:login', {
        loader: ({ params, abortSignal }) =>
          new Promise<string>((resolve) => {
            abortSignal.addEventListener('abort', () => aborted.push(params.userId));
            setTimeout(() => resolve(params.userId), 10);
          }),
      }),
    );
    bus.emit('user:login', { userId: 'a' });
    TestBed.tick();
    bus.emit('user:login', { userId: 'b' });
    await settle();
    expect(aborted).toEqual(['a']);
    expect(profile.value()).toBe('b');
  });

  it('returns to idle after resetEvent, and surfaces loader errors', async () => {
    const profile = TestBed.runInInjectionContext(() =>
      bus.onToResource('user:login', {
        loader: async ({ params }) => {
          if (params.userId === 'bad') throw new Error('not found');
          return params.userId;
        },
      }),
    );
    bus.emit('user:login', { userId: 'bad' });
    await settle();
    expect(profile.status()).toBe('error');
    expect((profile.error() as Error).message).toBe('not found');

    bus.resetEvent('user:login');
    await settle();
    expect(profile.status()).toBe('idle');
    expect(profile.value()).toBeUndefined();
  });
});
