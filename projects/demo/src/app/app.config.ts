import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideALTranslate } from '@angular-libs/translate';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideALTranslate({
      defaultLang: 'en',
      loader: async (lang: string) => {
        const dicts: Record<string, any> = {
          en: {
            'GREETING': 'Hello, {{name}}! Welcome to the translate playground.',
            'SUBTITLE': 'Reactivity with Angular Signals.',
            'LANG_LABEL': 'Current Language',
            'SWITCH_LANG': 'Switch Language',
            'PIPE_DEMO': 'Pipe Translation Demo',
            'SERVICE_DEMO': 'Service Signal Demo',
            'SAMPLE_TEXT': 'Localizing with 100% Signal-based change reactions.',
            'ITEMS_COUNT': 'You have {{count}} unread messages.'
          },
          es: {
            'GREETING': '¡Hola, {{name}}! Bienvenido al patio de traducción.',
            'SUBTITLE': 'Reactividad con Señales de Angular.',
            'LANG_LABEL': 'Idioma actual',
            'SWITCH_LANG': 'Cambiar idioma',
            'PIPE_DEMO': 'Demostración de la tubería de traducción',
            'SERVICE_DEMO': 'Demostración de la señal del servicio',
            'SAMPLE_TEXT': 'Localización con 100% reacciones de cambio basadas en señales.',
            'ITEMS_COUNT': 'Tienes {{count}} mensajes no leídos.'
          },
          fr: {
            'GREETING': 'Bonjour, {{name}} ! Bienvenue sur la plateforme de traduction.',
            'SUBTITLE': 'Réactivité avec les signaux Angular.',
            'LANG_LABEL': 'Langue actuelle',
            'SWITCH_LANG': 'Changer de langue',
            'PIPE_DEMO': 'Démo du canal de traduction',
            'SERVICE_DEMO': 'Démo du signal de service',
            'SAMPLE_TEXT': 'Localisation avec des réactions de changement 100% basées sur les signaux.',
            'ITEMS_COUNT': 'Vous avez {{count}} messages non lus.'
          }
        };
        return dicts[lang] || dicts['en'];
      }
    })
  ],
};
