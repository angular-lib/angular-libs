import { InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALTranslate, TranslatePipe, provideALTranslate } from './translate';

describe('ALTranslate & TranslatePipe', () => {
  let service: ALTranslate;
  let pipe: TranslatePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ALTranslate, TranslatePipe],
    });
    service = TestBed.inject(ALTranslate);
    pipe = TestBed.inject(TranslatePipe);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(pipe).toBeTruthy();
  });

  it('should translate basic keys', () => {
    service.setDictionary({ HELLO: 'Hola' });
    expect(pipe.transform('HELLO')).toBe('Hola');
  });

  it('should interpolate params', () => {
    service.setDictionary({ GREETING: 'Hello {{ name }}!' });
    expect(pipe.transform('GREETING', { name: 'World' })).toBe('Hello World!');
  });

  it('should interpolate non-string params', () => {
    service.setDictionary({ COUNT: 'You have {{ count }} items' });
    expect(pipe.transform('COUNT', { count: 5 })).toBe('You have 5 items');
  });

  it('should merge dictionaries without overwriting', () => {
    service.setDictionary({ A: '1' });
    service.addToDictionary({ B: '2' });
    expect(pipe.transform('A')).toBe('1');
    expect(pipe.transform('B')).toBe('2');
  });

  it('should fallback to key if missing and warn in dev mode', () => {
    let warnCalled = false;
    let warnMessage = '';
    const originalWarn = console.warn;
    console.warn = (msg) => {
      warnCalled = true;
      warnMessage = msg;
    };

    expect(pipe.transform('MISSING_KEY')).toBe('MISSING_KEY');
    expect(warnCalled).toBe(true);
    expect(warnMessage).toBe('[ALTranslate] Missing translation for key: "MISSING_KEY"');

    console.warn = originalWarn;
  });

  describe('plugins', () => {
    const TEST_TOKEN = new InjectionToken<string>('TEST_TOKEN');

    it('should run plugins and support dependencies via injection context', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: TEST_TOKEN, useValue: 'DI_VALUE' },
          provideALTranslate({
            defaultLang: 'en',
            staticData: { GREETING: 'Hello {{ name }}' },
            plugins: [
              { name: 'uppercase', transform: ({ text }) => text.toUpperCase() },
              {
                name: 'di-injector',
                transform: ({ text }) => {
                  const tokenValue = inject(TEST_TOKEN);
                  return `${text} - ${tokenValue}`;
                }
              }
            ]
          })
        ]
      });

      const svc = TestBed.inject(ALTranslate);
      expect(svc.get('GREETING', { name: 'World' })).toBe('HELLO WORLD - DI_VALUE');
    });

    it('should support full lifecycle plugins (onInit, onLangChange, onMissingKey, transform)', async () => {
      let initService: any = null;
      let lastLangArg: string = '';
      let missingKeyHandled = '';

      const testLifecyclePlugin = {
        name: 'test-lifecycle',
        onInit: ({ service }: any) => {
          initService = service;
        },
        onLangChange: ({ lang }: any) => {
          lastLangArg = lang;
        },
        onMissingKey: ({ key }: any) => {
          missingKeyHandled = key;
          return `resolved-missing-${key}`;
        },
        transform: ({ text, sourceText }: any) => {
          return `${text} (original: ${sourceText})`;
        }
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideALTranslate({
            defaultLang: 'en',
            staticData: { GREETING: 'Hello {{ name }}' },
            plugins: [testLifecyclePlugin]
          })
        ]
      });

      const svc = TestBed.inject(ALTranslate);
      
      // 1. Verify onInit Hook was triggered with service ref
      expect(initService).toBe(svc);

      // 2. Verify onLangChange Hook was triggered on init (defaultLang: 'en')
      expect(lastLangArg).toBe('en');

      // 3. Verify onLangChange Hook triggers on change
      svc.setLoader(async (lang) => ({ GREETING: `Hola {{ name }}` }));
      await svc.loadLanguage('es');
      expect(lastLangArg).toBe('es');

      // 4. Verify transform Hook receives both text and sourceText
      expect(svc.get('GREETING', { name: 'Pepe' })).toBe('Hola Pepe (original: Hola {{ name }})');

      // 5. Verify onMissingKey Hook can intercept missing strings
      expect(svc.get('NON_EXISTING' as any)).toBe('resolved-missing-NON_EXISTING');
    });

    it('should catch plugin errors gracefully and continue translating', () => {
      let errorLogged = false;
      const originalError = console.error;
      console.error = () => {
        errorLogged = true;
      };

      const buggyPlugin = {
        name: 'buggy-plugin',
        onInit: () => {
          throw new Error('Explosion onInit');
        },
        onLangChange: () => {
          throw new Error('Explosion onLangChange');
        },
        onMissingKey: () => {
          throw new Error('Explosion onMissingKey');
        },
        transform: () => {
          throw new Error('Explosion transform');
        }
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideALTranslate({
            defaultLang: 'en',
            staticData: { GREETING: 'Hello' },
            plugins: [buggyPlugin]
          })
        ]
      });

      const svc = TestBed.inject(ALTranslate);

      // Verify get still returns base string despite transform error
      expect(svc.get('GREETING')).toBe('Hello');
      
      // Verify get fallback still works on missing keys despite onMissingKey error
      expect(svc.get('MISSING_KEY' as any)).toBe('MISSING_KEY');

      expect(errorLogged).toBe(true);

      console.error = originalError;
    });
  });
});
