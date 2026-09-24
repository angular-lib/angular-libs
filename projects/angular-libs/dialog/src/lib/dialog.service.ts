import {
  ApplicationRef,
  Component,
  DOCUMENT,
  EnvironmentInjector,
  ErrorHandler,
  InjectionToken,
  Injectable,
  Injector,
  createComponent,
  inject,
  signal,
  type ComponentRef,
  type Provider,
  type Type,
} from '@angular/core';
import { Location } from '@angular/common';
import { AlDialog } from './al-dialog';
import { DialogRef, ɵanimationsDone, type DialogOutcome, type ɵDialogHost } from './dialog-ref';
import { ConfirmDialog, type ConfirmOptions } from './confirm-dialog';
import {
  DIALOG_CONFIG,
  type DialogInputs,
  type DialogOptions,
  type InferDialogResult,
} from './types';

/** Native `<dialog>` host with {@link AlDialog} behavior. */
@Component({
  selector: 'dialog[al-dialog-surface]',
  template: '',
  host: { class: 'al-dialog' },
  hostDirectives: [
    { directive: AlDialog, inputs: ['open', 'modal', 'closeOnEscape', 'closeOnBackdrop'] },
  ],
})
class DialogSurface {
  readonly dialog = inject(AlDialog);
}

/** @internal How {@link DialogService.ɵmount} builds a dialog. Also used by `/window`. */
export interface ɵMountSpec<R, C> {
  modal: boolean;
  className: string;
  width?: string;
  closeOnEscape: boolean;
  closeOnBackdrop: boolean;
  closeOnNavigation: boolean;
  ariaLabel?: string;
  role?: string;
  injector?: Injector;
  /** Creates the ref (e.g. a `WindowRef` subclass). */
  createRef?: (host: ɵDialogHost) => DialogRef<R, C>;
  /** Extra providers for the content, e.g. the `WindowRef` token. */
  providers?: (ref: DialogRef<R, C>) => Provider[];
  /** Runs once the dialog is open; the returned function runs on close. */
  setup?: (ref: DialogRef<R, C>) => (() => void) | void;
}

/**
 * @internal Test hook: return an outcome to answer `open()` without rendering.
 * See `@angular-libs/dialog/testing`.
 */
export const ɵDIALOG_INTERCEPTOR = new InjectionToken<
  (component: Type<unknown>, inputs: object | undefined) => DialogOutcome<unknown> | undefined
>('ɵDIALOG_INTERCEPTOR');

const SIZES = new Set(['sm', 'md', 'lg', 'xl', 'full']);

/**
 * Opens components in native modal `<dialog>`s.
 *
 * @example
 * ```ts
 * const { ok, value } = await dialog.open(EditUser, { user }).closed;
 * if (await dialog.confirm({ title: 'Delete?', tone: 'danger' })) …
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly location = inject(Location, { optional: true });
  private readonly defaults = inject(DIALOG_CONFIG).defaults;
  private readonly interceptor = inject(ɵDIALOG_INTERCEPTOR, { optional: true });
  private readonly open$ = signal<readonly DialogRef<any, any>[]>([]);

  /** Every dialog opened through this service (and `/window`) that is still open. */
  readonly openDialogs = this.open$.asReadonly();

  /**
   * Opens `component` in a modal dialog. `inputs` are checked against the component's
   * signal inputs; the result type comes from its `injectDialog<R>()`.
   */
  open<C>(
    component: Type<C>,
    inputs?: DialogInputs<C>,
    options?: DialogOptions,
  ): DialogRef<InferDialogResult<C>, C> {
    const stub = this.interceptor?.(component, inputs);
    if (stub) return resolvedRef(this.document, stub) as DialogRef<InferDialogResult<C>, C>;

    const o = { ...this.defaults, ...options };
    const size = o.size ?? 'md';
    return this.ɵmount(component, inputs, {
      modal: true,
      className: ɵclassNames(
        'al-dialog-modal',
        SIZES.has(size) && `al-dialog-${size}`,
        o.mobile && `al-dialog-mobile-${o.mobile}`,
        o.panelClass,
      ),
      width: SIZES.has(size) ? undefined : size,
      closeOnEscape: o.closeOnEscape ?? true,
      closeOnBackdrop: o.closeOnBackdrop ?? true,
      closeOnNavigation: o.closeOnNavigation ?? true,
      ariaLabel: o.ariaLabel,
      role: o.role,
      injector: o.injector,
    });
  }

  /**
   * Resolves `true` when confirmed. With `onConfirm`, the confirm button runs it first:
   * spinner, dismiss blocked, and an inline error with retry if it throws.
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const outcome = await this.open(ConfirmDialog, { options }, dialogOptions(options)).closed;
    return outcome.ok && outcome.value;
  }

  /** Resolves when the alert is dismissed. */
  async alert(options: Omit<ConfirmOptions, 'cancelText' | 'onConfirm'>): Promise<void> {
    await this.open(ConfirmDialog, { options, alert: true }, dialogOptions(options)).closed;
  }

  closeAll(): void {
    for (const ref of this.open$()) void ref.close();
  }

  /** @internal Mounts `component` in a new `<dialog>` and opens it. */
  ɵmount<C, R>(
    component: Type<C>,
    inputs: DialogInputs<C> | undefined,
    spec: ɵMountSpec<R, C>,
  ): DialogRef<R, C> {
    if (!this.document.defaultView) {
      throw new Error('[@angular-libs/dialog] Dialogs can only be opened in the browser.');
    }

    const surface = createComponent(DialogSurface, { environmentInjector: this.environment });
    const element = surface.location.nativeElement as HTMLDialogElement;
    element.classList.add(...spec.className.split(' ').filter(Boolean));
    if (spec.width) element.style.width = spec.width;
    // Set before content exists: title parts only link themselves when there is no label.
    if (spec.ariaLabel) element.setAttribute('aria-label', spec.ariaLabel);
    if (spec.role) element.setAttribute('role', spec.role);

    const host: ɵDialogHost = {
      element,
      hide: () => surface.instance.dialog.close(),
      reportError: (error) => this.errorHandler.handleError(error),
    };
    const ref = spec.createRef?.(host) ?? new DialogRef<R, C>(host);
    surface.instance.dialog.ɵonDismiss((reason) => void ref.close(undefined, reason));

    const content = ɵcreateContent(this.environment, component, inputs, ref, spec.injector, spec.providers?.(ref));
    element.append(content.location.nativeElement);
    this.document.body.append(element);
    this.appRef.attachView(surface.hostView);
    this.appRef.attachView(content.hostView);
    // Render before opening so `autofocus` and title parts exist when `showModal()` runs.
    content.changeDetectorRef.detectChanges();

    surface.setInput('modal', spec.modal);
    surface.setInput('closeOnEscape', spec.closeOnEscape);
    surface.setInput('closeOnBackdrop', spec.closeOnBackdrop);
    surface.setInput('open', true);
    surface.changeDetectorRef.detectChanges();

    this.open$.update((refs) => [...refs, ref]);
    const stopNavigation = spec.closeOnNavigation
      ? this.location?.onUrlChange(() => void ref.close(undefined, 'navigation'))
      : undefined;
    const teardown = spec.setup?.(ref);

    element.addEventListener(
      'close',
      async () => {
        this.open$.update((refs) => refs.filter((r) => r !== ref));
        stopNavigation?.();
        teardown?.();
        await ɵanimationsDone(element);
        content.destroy();
        surface.destroy();
        element.remove();
        ref.ɵfinish();
      },
      { once: true },
    );
    return ref;
  }
}

/** @internal Creates `component` with `DialogRef` (and `providers`) injectable. Shared with popovers. */
export function ɵcreateContent<C>(
  environment: EnvironmentInjector,
  component: Type<C>,
  inputs: object | undefined,
  ref: DialogRef<any, C>,
  parent?: Injector,
  providers: Provider[] = [],
): ComponentRef<C> {
  const injector = Injector.create({
    providers: [{ provide: DialogRef, useValue: ref }, ...providers],
    parent: parent ?? environment,
  });
  const content = createComponent(component, { environmentInjector: environment, elementInjector: injector });
  for (const [key, value] of Object.entries(inputs ?? {})) content.setInput(key, value);
  content.location.nativeElement.classList.add('al-dialog-content');
  ref.ɵsetComponent(content.instance);
  return content;
}

/** @internal Joins truthy class names. */
export function ɵclassNames(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ');
}

function dialogOptions(options: ConfirmOptions): DialogOptions {
  return { size: options.size ?? 'sm', mobile: options.mobile, role: 'alertdialog' };
}

/** A ref that is already closed with `outcome` (testing stubs). */
function resolvedRef(document: Document, outcome: DialogOutcome<unknown>): DialogRef<unknown, unknown> {
  const ref = new DialogRef<unknown, unknown>({
    element: document.createElement('dialog'),
    hide: () => {},
    reportError: () => {},
  });
  if (outcome.ok) void ref.close(outcome.value, outcome.source).then(() => ref.ɵfinish());
  else ref.ɵfinish(outcome.source);
  return ref;
}
