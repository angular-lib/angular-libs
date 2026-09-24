import {
  Injectable,
  inject,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
  type Provider,
  type Type,
} from '@angular/core';
import {
  DialogService,
  isDialogDefinition,
  provideDialog,
  type AnyDialogDefinition,
  type DialogOptions,
  type DialogOutcome,
  type DialogRef,
} from '@angular-libs/dialog';

export interface DialogOpenCall {
  component: Type<unknown>;
  options?: DialogOptions;
}

export interface DialogRunCall {
  definition: AnyDialogDefinition<any, any, any>;
  inputs?: object;
  /** `true` when a {@link DialogTestingController.stub} answered without rendering. */
  stubbed: boolean;
}

type StubAnswer<R> = DialogOutcome<R> | ((inputs: any) => DialogOutcome<R> | Promise<DialogOutcome<R>>);

@Injectable()
export class DialogTestingController {
  readonly openCalls: DialogOpenCall[] = [];
  readonly runCalls: DialogRunCall[] = [];
  private refs: DialogRef<any, any>[] = [];
  private readonly stubs = new Map<object, StubAnswer<any>>();

  /** @internal */
  _track(ref: DialogRef<any, any>, component: Type<unknown>, options?: DialogOptions): void {
    this.openCalls.push({ component, options });
    this.refs.push(ref);
  }

  /** @internal */
  _stubFor(definition: object): StubAnswer<any> | undefined {
    return this.stubs.get(definition);
  }

  /**
   * Answer `dialog.run(definition, …)` without rendering the component.
   *
   * @example
   * ```ts
   * controller.stub(EditUserDialog, { ok: true, value: user, source: 'manual' });
   * controller.stub(ConfirmDelete, (inputs) => ({ ok: inputs.id !== 1, … }));
   * ```
   */
  stub<R>(definition: AnyDialogDefinition<any, R, any>, answer: StubAnswer<R>): void {
    this.stubs.set(definition, answer);
  }

  get last(): DialogRef<any, any> | undefined {
    return this.refs[this.refs.length - 1];
  }

  async flushClose(result?: unknown, source: string = 'manual'): Promise<void> {
    const ref = this.last;
    if (!ref) return;
    await ref.close(result, source);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.refs].map((r) => r.close(undefined, 'manual')));
  }

  reset(): void {
    this.openCalls.length = 0;
    this.runCalls.length = 0;
    this.refs = [];
    this.stubs.clear();
  }
}

export function patchDialogElement(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  const proto = HTMLDialogElement.prototype;

  proto.show = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * Test providers: patched `<dialog>`, a fresh {@link DialogService}, and a
 * {@link DialogTestingController} that already tracks every open / run call.
 */
export function provideDialogTesting(
  config: Parameters<typeof provideDialog>[0] = {},
): Array<Provider | EnvironmentProviders> {
  patchDialogElement();
  return [
    provideDialog(config),
    DialogTestingController,
    DialogService,
    provideEnvironmentInitializer(() =>
      wrapDialogServiceForTesting(inject(DialogService), inject(DialogTestingController)),
    ),
  ];
}

const wrapped = new WeakSet<DialogService>();

/**
 * Routes a service's open calls through `controller`. {@link provideDialogTesting}
 * already does this; calling it again is a no-op.
 */
export function wrapDialogServiceForTesting(
  service: DialogService,
  controller: DialogTestingController,
): DialogService {
  if (wrapped.has(service)) return service;
  wrapped.add(service);

  const originalOpen = service.open.bind(service) as (...args: any[]) => DialogRef<any, any>;
  const originalRun = service.run.bind(service) as (...args: any[]) => Promise<DialogOutcome<any>>;
  const originalWindow = service.window.bind(service);
  const originalPopover = service.popover.bind(service);
  const originalToast = service.toast.bind(service);

  service.open = ((target: any, ...rest: any[]) => {
    const ref = originalOpen(target, ...rest);
    if (isDialogDefinition(target)) {
      const [inputs, options] = rest;
      controller._track(ref, (target as { component: Type<unknown> }).component, {
        ...options,
        inputs,
      });
    } else {
      controller._track(ref, target, rest[0]);
    }
    return ref;
  }) as typeof service.open;

  service.run = (async (definition: AnyDialogDefinition<any, any, any>, ...rest: any[]) => {
    const [inputs] = rest;
    const stub = controller._stubFor(definition);
    controller.runCalls.push({ definition, inputs, stubbed: !!stub });
    if (stub) return typeof stub === 'function' ? stub(inputs ?? {}) : stub;
    // run() opens through service.open, which is tracked above.
    return originalRun(definition, ...rest);
  }) as typeof service.run;

  service.window = ((component: Type<any>, options?: any) => {
    const ref = originalWindow(component, options);
    controller._track(ref, component, options);
    return ref;
  }) as typeof service.window;

  service.popover = ((component: Type<any>, options: any) => {
    const ref = originalPopover(component, options);
    controller._track(ref, component, options);
    return ref;
  }) as typeof service.popover;

  service.toast = ((message: string, options?: any) => {
    const ref = originalToast(message, options);
    controller._track(ref, (ref.component as object)?.constructor as Type<unknown>, options);
    return ref;
  }) as typeof service.toast;

  return service;
}
