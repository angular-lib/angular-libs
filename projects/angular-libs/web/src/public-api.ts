/*
 * Public API Surface of web
 */

export * from './lib/signals';
export { AlClickOutsideDirective, type ClickOutsideIgnoreTarget } from './lib/directives/click-outside.directive';
export { AlFileDropDirective, type FileRejection } from './lib/directives/file-drop.directive';
export { resolveSignalContext, type SignalInjectionOptions } from './lib/utils/injection';

