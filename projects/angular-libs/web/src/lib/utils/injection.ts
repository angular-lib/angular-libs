import { Injector, DestroyRef, inject, isDevMode } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface SignalInjectionOptions {
  /** Optional custom Angular Injector to resolve tokens and DestroyRef when initialized outside a construction context. */
  injector?: Injector;
}

export function resolveSignalContext(
  options?: SignalInjectionOptions,
  callerName = 'Signal'
): { doc: Document | null; destroyRef: DestroyRef | null } {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  if (options?.injector) {
    doc = options.injector.get(DOCUMENT, null);
    destroyRef = options.injector.get(DestroyRef, null);
  } else {
    try {
      doc = inject(DOCUMENT, { optional: true });
      destroyRef = inject(DestroyRef, { optional: true });
    } catch {
      // Function executed outside an injection context without an explicit injector option
    }
  }

  if (isDevMode() && !destroyRef) {
    console.warn(
      `[${callerName}] Could not resolve DestroyRef. Automatic event/listener teardown will not occur.\n` +
      `To enable automatic teardown, call ${callerName}() within an active injection context ` +
      `(such as a component/service constructor or field initializer) or pass an explicit 'injector' option.`
    );
  }

  return { doc, destroyRef };
}
