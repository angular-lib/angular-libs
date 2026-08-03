import { Injectable, type EnvironmentProviders, type Provider, type Type } from '@angular/core';
import {
  DialogService,
  provideDialog,
  type DialogOptions,
  type DialogRef,
} from '@angular-libs/dialog';

export interface DialogOpenCall {
  component: Type<unknown>;
  options?: DialogOptions;
}

@Injectable()
export class DialogTestingController {
  readonly openCalls: DialogOpenCall[] = [];
  private refs: DialogRef<any, any>[] = [];

  /** @internal */
  _track(ref: DialogRef<any, any>, component: Type<unknown>, options?: DialogOptions): void {
    this.openCalls.push({ component, options });
    this.refs.push(ref);
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
    this.refs = [];
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

export function provideDialogTesting(
  config: Parameters<typeof provideDialog>[0] = {},
): Array<Provider | EnvironmentProviders> {
  patchDialogElement();
  return [provideDialog(config), DialogTestingController, DialogService];
}

export function wrapDialogServiceForTesting(
  service: DialogService,
  controller: DialogTestingController,
): DialogService {
  const originalOpen = service.open.bind(service);
  const originalWindow = service.window.bind(service);
  const originalPopover = service.popover.bind(service);
  const originalToast = service.toast.bind(service);

  service.open = ((component: Type<any>, options?: DialogOptions) => {
    const ref = originalOpen(component, options);
    controller._track(ref, component, options);
    return ref;
  }) as typeof service.open;

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
