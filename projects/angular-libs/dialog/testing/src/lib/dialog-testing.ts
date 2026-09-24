import { Injectable, type Provider, type Type } from '@angular/core';
import { ɵDIALOG_INTERCEPTOR, type DialogOutcome } from '@angular-libs/dialog';

type Stub = DialogOutcome<any> | ((inputs: any) => DialogOutcome<any>);

/** Answers `dialog.open(component)` for stubbed components without rendering them. */
@Injectable()
export class DialogTestingController {
  /** Every `open()` call, stubbed or not. */
  readonly calls: Array<{ component: Type<unknown>; inputs: object | undefined }> = [];
  private readonly stubs = new Map<Type<unknown>, Stub>();

  /**
   * @example
   * ```ts
   * controller.stub(EditUserComponent, { ok: true, value: user, source: 'manual' });
   * controller.stub(ConfirmDelete, (inputs) => ({ ok: false, source: 'escape' }));
   * ```
   */
  stub<C>(component: Type<C>, answer: Stub): void {
    this.stubs.set(component, answer);
  }

  /** @internal */
  intercept(component: Type<unknown>, inputs: object | undefined): DialogOutcome<unknown> | undefined {
    this.calls.push({ component, inputs });
    const stub = this.stubs.get(component);
    return typeof stub === 'function' ? stub(inputs ?? {}) : stub;
  }
}

/**
 * Makes `<dialog>` and popovers work in jsdom and records / stubs `open()` calls.
 *
 * ```ts
 * TestBed.configureTestingModule({ providers: provideDialogTesting() });
 * ```
 */
export function provideDialogTesting(): Provider[] {
  patchDom();
  return [
    DialogTestingController,
    {
      provide: ɵDIALOG_INTERCEPTOR,
      deps: [DialogTestingController],
      useFactory: (c: DialogTestingController) => c.intercept.bind(c),
    },
  ];
}

/** jsdom lacks `showModal()`, `show()`, `close()` and the Popover API; this adds minimal versions. */
export function patchDom(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  const dialog = HTMLDialogElement.prototype;
  dialog.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  dialog.showModal = dialog.show;
  dialog.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };

  const el = HTMLElement.prototype as HTMLElement & { ɵpopoverOpen?: boolean };
  if (typeof el.showPopover === 'function') return;
  const toggle = (target: HTMLElement & { ɵpopoverOpen?: boolean }, open: boolean) => {
    if (!!target.ɵpopoverOpen === open) return;
    const init = { oldState: open ? 'closed' : 'open', newState: open ? 'open' : 'closed' };
    target.dispatchEvent(Object.assign(new Event('beforetoggle'), init));
    target.ɵpopoverOpen = open;
    target.dispatchEvent(Object.assign(new Event('toggle'), init));
  };
  el.showPopover = function (this: HTMLElement) {
    toggle(this, true);
  };
  el.hidePopover = function (this: HTMLElement) {
    toggle(this, false);
  };
}
