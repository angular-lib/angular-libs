import {
  Injectable,
  ApplicationRef,
  EnvironmentInjector,
  Type,
  createComponent,
  Injector,
  inject,
  signal,
  DestroyRef,
  type WritableSignal,
} from '@angular/core';
import { Location } from '@angular/common';
import { DialogRef, type DialogOutcome } from './dialog-ref';
import {
  isDialogDefinition,
  resolveDefinitionOptions,
  type AnyDialogDefinition,
  type DialogDefinition,
  type DialogDefinitionArgs,
} from './define-dialog';
import { setPosition, bringToFront } from './actions';
import {
  DIALOG_CONFIG,
  DIALOG_SIZE_PRESETS,
  isPlainDialogStrings,
  resolveDialogStrings,
  resolveDismissFlags,
  type GlobalDialogConfig,
  type DialogOptions,
  type InferDialogResult,
  type WindowOptions,
  type ConfirmOptions,
  type PopoverDialogOptions,
  type ToastOptions,
  type ToastPosition,
  type DialogSizePreset,
  type DialogAnimation,
  type ProvideDialogConfig,
  type DialogStrings,
  type ComponentInputs,
} from './dialog.types';
import { mergePlugins, resolveBehaviorPlugins } from './behavior-resolver';
import { popoverPlugin } from './plugins/popover.plugin';
import { autoClosePlugin } from './plugins/auto-close.plugin';
import { DefaultDialogComponent } from './components/default-dialog.component';
import { AlDialogSurface, presentDialogSurface } from './al-dialog-surface';

const TOAST_STACK_GAP_PX = 12;

/**
 * Batteries path: open Angular components inside a native HTML `<dialog>`
 * with default chrome (`core.css` + {@link DefaultDialogComponent}).
 *
 * Internally this layers on {@link AlDialog} (same primitive as the Aria-style
 * design-system path). Prefer intent helpers:
 * - {@link open} — modal dialogs
 * - {@link window} — modeless floating windows
 * - {@link confirm} / {@link alert} — built-in chrome
 * - {@link popover} / {@link toast} — anchored / transient surfaces
 *
 * Browser-only: `open()` uses `document` and is not SSR-safe.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private destroyRef = inject(DestroyRef);
  private bootstrapConfig = inject(DIALOG_CONFIG, { optional: true }) as ProvideDialogConfig | null;
  private location = inject(Location, { optional: true });

  public config: WritableSignal<GlobalDialogConfig> = signal<GlobalDialogConfig>({
    ...(this.bootstrapConfig ?? {}),
  });

  public openDialogs: DialogRef<any, any>[] = [];
  private lastFullscreenHost: HTMLElement | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.handleGlobalFullscreenChange);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('fullscreenchange', this.handleGlobalFullscreenChange);
      });
    }
  }

  private getMountTarget(): HTMLElement {
    return (document.fullscreenElement as HTMLElement | null) ?? document.body;
  }

  private handleGlobalFullscreenChange = (): void => {
    if (document.fullscreenElement) {
      this.lastFullscreenHost = document.fullscreenElement as HTMLElement;
      return;
    }

    const host = this.lastFullscreenHost;
    this.lastFullscreenHost = null;
    if (!host) return;

    for (const ref of this.openDialogs) {
      const el = ref.dialogEl;
      if (el && el.parentElement === host) {
        const activeElement = document.activeElement as HTMLElement | null;
        document.body.appendChild(el);
        if (activeElement && el.contains(activeElement)) {
          activeElement.focus();
        }
      }
    }
  };

  updateConfig(config: Partial<GlobalDialogConfig>): void {
    this.config.update((current) => {
      const next: GlobalDialogConfig = {
        ...current,
        ...config,
        window: { ...current.window, ...config.window },
        persistDefaults: { ...current.persistDefaults, ...config.persistDefaults },
      };

      if (config.strings !== undefined) {
        // Merge only when both sides are plain objects; Signal/factory replace entirely.
        next.strings =
          isPlainDialogStrings(current.strings) && isPlainDialogStrings(config.strings)
            ? { ...current.strings, ...config.strings }
            : config.strings;
      } else {
        next.strings = current.strings;
      }

      return next;
    });
  }

  closeAll(): void {
    [...this.openDialogs].forEach((dialogRef) => dialogRef.close());
  }

  /**
   * Opens a modal dialog from a {@link defineDialog} definition. Required inputs are
   * enforced; per-call options override the definition's.
   *
   * @example
   * ```ts
   * const ref = dialog.open(EditUserDialog, { user }, { size: 'lg' });
   * const outcome = await ref.outcome;
   * ```
   */
  open<TComponent, TResult, TPreset extends PropertyKey>(
    definition: DialogDefinition<TComponent, TResult, TPreset>,
    ...args: DialogDefinitionArgs<TComponent, TPreset>
  ): DialogRef<TResult, TComponent>;
  /**
   * Opens a modal component dialog (default).
   */
  open<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options?: DialogOptions<TComponent>,
  ): DialogRef<TResult, TComponent>;
  open(
    target: Type<unknown> | DialogDefinition<unknown, unknown, PropertyKey>,
    inputsOrOptions?: object,
    callOptions?: object,
  ): DialogRef<unknown, unknown> {
    if (isDialogDefinition(target)) {
      if (!('component' in target)) {
        throw new Error('[DialogService] Lazy dialog definitions must be opened with run().');
      }
      return this.openInternal(
        target.component,
        resolveDefinitionOptions(target, inputsOrOptions, callOptions),
        { intent: 'open' },
      );
    }
    return this.openInternal(target, (inputsOrOptions ?? {}) as DialogOptions<unknown>, {
      intent: 'open',
    });
  }

  /**
   * Opens a definition (eager or lazy) and resolves with its {@link DialogOutcome}.
   *
   * @example
   * ```ts
   * const outcome = await dialog.run(EditUserDialog, { user });
   * if (outcome.ok) save(outcome.value);
   * ```
   */
  async run<TComponent, TResult, TPreset extends PropertyKey>(
    definition: AnyDialogDefinition<TComponent, TResult, TPreset>,
    ...args: DialogDefinitionArgs<TComponent, TPreset>
  ): Promise<DialogOutcome<TResult>> {
    const component = 'component' in definition ? definition.component : await loadLazy(definition);
    const [inputs, options] = args;
    // Through open() so testing wrappers see the call.
    const ref = this.open<TComponent, TResult>(
      component,
      resolveDefinitionOptions(definition, inputs, options),
    );
    return ref.outcome;
  }

  /**
   * Opens a modeless floating window with declarative drag/snap/dock/persist defaults.
   */
  window<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options: WindowOptions<TComponent> = {},
  ): DialogRef<TResult, TComponent> {
    const global = this.config();
    const windowDefaults = {
      drag: true as const,
      snap: true as const,
      dock: true as const,
      ...global.window,
    };

    return this.openInternal(
      component,
      {
        ...options,
        modal: false,
        resize: options.resize ?? global.window?.resize,
        restoreFocus: options.restoreFocus ?? false,
        closeOnNavigation: options.closeOnNavigation ?? false,
        autoFocus: options.autoFocus ?? 'dialog',
      },
      { intent: 'window', windowDefaults },
    );
  }

  /**
   * Modal confirm dialog. Resolves `true` on primary, `false` on secondary/dismiss.
   *
   * With `onConfirm`, the primary button runs the handler first (spinner, dismiss
   * blocked, inline error + retry on failure) and resolves `true` only on success.
   */
  async confirm(options: ConfirmOptions = {}): Promise<boolean> {
    const strings = this.resolveMergedStrings(options.strings);
    const title = options.title ?? strings.confirmTitle ?? 'Confirm';
    const ref = this.openChrome<boolean>(options, title, {
      primaryButtonText: options.confirmText ?? strings.ok ?? 'OK',
      secondaryButtonText: options.cancelText ?? strings.cancel ?? 'Cancel',
      primaryResult: true,
      secondaryResult: false,
      tone: options.tone ?? 'default',
      confirmHandler: options.onConfirm,
      errorText: options.errorText ?? strings.error,
    });

    const { result, source } = await ref.closed;
    if (result === true) return true;
    if (result === false) return false;
    // Escape / backdrop / close icon → cancel
    return source === 'primary';
  }

  /**
   * Modal alert dialog. Resolves when dismissed.
   */
  async alert(options: ConfirmOptions = {}): Promise<void> {
    const strings = this.resolveMergedStrings(options.strings);
    const title = options.title ?? strings.alertTitle ?? 'Alert';
    const ref = this.openChrome<true>(options, title, {
      primaryButtonText: options.confirmText ?? strings.ok ?? 'OK',
      primaryResult: true,
      tone: options.tone ?? 'default',
    });
    await ref.closed;
  }

  /** Shared DefaultDialog modal for {@link confirm} / {@link alert}. */
  private openChrome<TResult>(
    options: ConfirmOptions,
    title: string,
    inputs: ComponentInputs<DefaultDialogComponent>,
  ): DialogRef<TResult, DefaultDialogComponent> {
    const {
      title: _title,
      message,
      subtitle,
      confirmText: _confirmText,
      cancelText: _cancelText,
      tone: _tone,
      onConfirm: _onConfirm,
      errorText: _errorText,
      strings: _strings,
      ...modal
    } = options;
    return this.open<DefaultDialogComponent, TResult>(DefaultDialogComponent, {
      ...modal,
      inputs: { title, subtitle, contentText: message, showCloseIcon: true, ...inputs },
      size: modal.size ?? 'sm',
      role: modal.role ?? 'alertdialog',
      ariaLabel: modal.ariaLabel ?? title,
      closeOnNavigation: true,
      restoreFocus: true,
    });
  }

  /**
   * Anchored modeless popover.
   */
  popover<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options: PopoverDialogOptions<TComponent>,
  ): DialogRef<TResult, TComponent> {
    const { anchor, placement, offset, showArrow, arrowColor, flip, plugins, ...rest } = options;
    return this.openInternal(
      component,
      {
        ...rest,
        modal: false,
        restoreFocus: rest.restoreFocus ?? true,
        closeOnNavigation: rest.closeOnNavigation ?? false,
        autoFocus: rest.autoFocus ?? 'first-tabbable',
        plugins: [
          popoverPlugin({ anchor, placement, offset, showArrow, arrowColor, flip }),
          ...(plugins ?? []),
        ],
      },
      { intent: 'popover' },
    );
  }

  /**
   * Transient toast using DefaultDialog chrome + auto-close.
   */
  toast(message: string, options: ToastOptions = {}): DialogRef<undefined, DefaultDialogComponent> {
    const { duration, pauseOnHover, title, position = 'bottom-right', ...rest } = options;
    const ref = this.openInternal<DefaultDialogComponent, undefined>(
      DefaultDialogComponent,
      {
        ...rest,
        modal: false,
        restoreFocus: false,
        closeOnNavigation: false,
        autoFocus: false,
        ariaLabel: title ?? message,
        inputs: {
          title,
          contentText: message,
          showCloseIcon: true,
        },
        plugins: [autoClosePlugin({ duration, pauseOnHover })],
        panelClass: [
          'al-dialog-toast',
          `al-toast-${position}`,
          ...(rest.panelClass ? [rest.panelClass].flat() : []),
        ],
      },
      { intent: 'toast' },
    );

    ref.dialogEl.setAttribute('role', 'status');
    ref.dialogEl.setAttribute('aria-live', 'polite');
    ref.dialogEl.dataset['alToastPosition'] = position;

    // Restack after layout (microtask is too early — offsetHeight is often still 0).
    this.scheduleToastRestack(position);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.scheduleToastRestack(position))
        : null;
    resizeObserver?.observe(ref.dialogEl);

    void ref.closed.then(() => {
      resizeObserver?.disconnect();
      this.scheduleToastRestack(position);
    });

    return ref;
  }

  private resolveMergedStrings(perCall?: ConfirmOptions['strings']): DialogStrings {
    return {
      ...resolveDialogStrings(this.config().strings),
      ...resolveDialogStrings(perCall),
    };
  }

  /** Coalesce restacks to one double-rAF pass per corner so heights are measurable. */
  private toastRestackFrames = new Map<ToastPosition, number>();

  private scheduleToastRestack(position: ToastPosition): void {
    const pending = this.toastRestackFrames.get(position);
    if (pending != null) {
      cancelAnimationFrame(pending);
    }

    const frame = requestAnimationFrame(() => {
      const frame2 = requestAnimationFrame(() => {
        this.toastRestackFrames.delete(position);
        this.restackToasts(position);
      });
      this.toastRestackFrames.set(position, frame2);
    });
    this.toastRestackFrames.set(position, frame);
  }

  private restackToasts(position: ToastPosition): void {
    const toasts = this.openDialogs.filter(
      (r) =>
        r.dialogEl?.classList.contains('al-dialog-toast') &&
        r.dialogEl.dataset['alToastPosition'] === position,
    );

    let offset = 0;
    for (const toastRef of toasts) {
      const el = toastRef.dialogEl;
      el.style.setProperty('--al-toast-stack-offset', `${offset}px`);
      // Prefer laid-out height; fall back only while content is still measuring.
      const height = el.getBoundingClientRect().height || el.offsetHeight || 64;
      offset += height + TOAST_STACK_GAP_PX;
    }
  }

  private openInternal<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options: DialogOptions<TComponent>,
    meta: {
      intent: 'open' | 'window' | 'popover' | 'toast';
      windowDefaults?: {
        drag?: boolean | object;
        snap?: boolean | object;
        dock?: boolean | object;
        persist?: boolean | object;
        resize?: boolean;
      };
    },
  ): DialogRef<TResult, TComponent> {
    const global = this.config();
    const isModal = options.modal !== false;

    const behavior = resolveBehaviorPlugins(
      {
        drag: options.drag,
        snap: options.snap,
        dock: options.dock,
        persist: options.persist,
      },
      meta.intent === 'window' ? (meta.windowDefaults as any) : {},
      global.persistDefaults,
      options.id ?? global.id,
    );

    const uniquePlugins = mergePlugins(
      { plugins: global.plugins },
      behavior,
      { plugins: options.plugins },
    );

    const sizeWidth = resolveSize(options.size ?? global.size);
    const mergedOptions: DialogOptions<TComponent> = {
      ...global,
      ...options,
      width: options.width ?? sizeWidth ?? global.width,
      resize:
        options.resize ??
        (meta.intent === 'window' ? meta.windowDefaults?.resize : undefined) ??
        global.resize,
      plugins: uniquePlugins,
      restoreFocus: options.restoreFocus ?? (isModal ? true : false),
      closeOnNavigation: options.closeOnNavigation ?? (isModal ? true : false),
      autoFocus:
        options.autoFocus ??
        global.autoFocus ??
        (isModal ? 'first-tabbable' : 'dialog'),
      animation: options.animation ?? global.animation ?? false,
    };

    // Strip non-dialog option bags that shouldn't live on DialogRef.options forever is fine
    const { inputs } = mergedOptions;
    const { closeOnEscape, closeOnBackdrop } = resolveDismissFlags(mergedOptions);

    const opener =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const surfaceRef = createComponent(AlDialogSurface, {
      environmentInjector: this.envInjector,
    });
    const dialogEl = surfaceRef.location.nativeElement as HTMLDialogElement;

    if (meta.intent === 'window') {
      dialogEl.classList.add('al-dialog-window');
    } else if (meta.intent === 'popover') {
      dialogEl.classList.add('al-dialog-popover');
    }

    applyClasses(dialogEl, mergedOptions.panelClass);
    applyClasses(dialogEl, mergedOptions.backdropClass);

    // Before content creation: title parts check these when they are constructed.
    if (mergedOptions.ariaLabel) {
      dialogEl.setAttribute('aria-label', mergedOptions.ariaLabel);
    }
    if (mergedOptions.role) {
      dialogEl.setAttribute('role', mergedOptions.role);
    }

    if (mergedOptions.hasBackdrop === false) {
      dialogEl.classList.add('al-dialog-no-backdrop');
    }
    if (mergedOptions.fullscreenBelow) {
      dialogEl.classList.add(`al-dialog-fullscreen-below-${mergedOptions.fullscreenBelow}`);
    }
    if (mergedOptions.sheetBelow && isModal) {
      dialogEl.classList.add(`al-dialog-sheet-below-${mergedOptions.sheetBelow}`);
    }

    const sizeKeys = ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight'] as const;
    sizeKeys.forEach((key) => {
      const value = mergedOptions[key];
      if (value) dialogEl.style[key] = value;
    });

    if (mergedOptions.resize) {
      dialogEl.style.resize = 'both';
      dialogEl.style.overflow = 'hidden';
      if (!mergedOptions.minWidth) dialogEl.style.minWidth = 'min-content';
      if (!mergedOptions.minHeight) dialogEl.style.minHeight = 'min-content';
    }

    this.getMountTarget().appendChild(dialogEl);
    this.appRef.attachView(surfaceRef.hostView);

    const dialogRef = new DialogRef<TResult, TComponent>(dialogEl, mergedOptions);
    dialogRef._opener = opener;
    dialogRef._restoreFocus = mergedOptions.restoreFocus !== false;
    surfaceRef.instance.wireDismiss((reason) => {
      void dialogRef.close(undefined, reason);
    });

    const anim = resolveAnimationClasses(mergedOptions.animation);
    dialogRef._leaveAnimationClass = anim.leave;
    if (anim.enter) {
      dialogEl.classList.add(anim.enter);
    }

    if (mergedOptions.parent) {
      dialogRef.parent = mergedOptions.parent;
      mergedOptions.parent.children.push(dialogRef);
    }

    if (!isModal) {
      dialogEl.addEventListener('focusin', () => bringToFront(dialogRef));
      dialogEl.addEventListener('mousedown', () => bringToFront(dialogRef));
    }

    this.openDialogs.push(dialogRef);

    const customInjector = Injector.create({
      providers: [{ provide: DialogRef, useValue: dialogRef }],
      parent: mergedOptions.injector ?? this.envInjector,
    });
    dialogRef.injector = customInjector;

    const compRef = createComponent(component, {
      environmentInjector: this.envInjector,
      elementInjector: customInjector,
    });

    if (component === DefaultDialogComponent) {
      const s = resolveDialogStrings(global.strings);
      if (s) {
        if (s.close !== undefined) compRef.setInput('closeTooltip', s.close);
        if (s.minimize !== undefined) compRef.setInput('minimizeTooltip', s.minimize);
        if (s.maximize !== undefined) compRef.setInput('maximizeTooltip', s.maximize);
        if (s.restore !== undefined) compRef.setInput('restoreTooltip', s.restore);
        if (s.fullscreen !== undefined) compRef.setInput('fullscreenTooltip', s.fullscreen);
        if (s.exitFullscreen !== undefined) {
          compRef.setInput('exitFullscreenTooltip', s.exitFullscreen);
        }
      }
    }

    if (inputs) {
      Object.entries(inputs).forEach(([key, value]) => {
        compRef.setInput(key, value);
      });
    }

    this.appRef.attachView(compRef.hostView);

    const compRootNode = (compRef.hostView as any).rootNodes[0] as HTMLElement;
    if (compRootNode) {
      compRootNode.dataset['alDialogContent'] = 'true';
      applyClasses(compRootNode, mergedOptions.contentClass);
      ensureTitleId(compRootNode, dialogEl, mergedOptions);
    }
    dialogEl.appendChild(compRootNode);

    const labelledBy = dialogEl.getAttribute('aria-labelledby');
    const describedBy = dialogEl.getAttribute('aria-describedby');

    presentDialogSurface(surfaceRef, {
      modal: isModal,
      labelledBy: mergedOptions.ariaLabelledBy ?? labelledBy ?? undefined,
      describedBy: mergedOptions.ariaDescribedBy ?? describedBy ?? undefined,
      closeOnEscape,
      closeOnBackdrop,
      restoreFocus: mergedOptions.restoreFocus !== false,
      autoFocus: mergedOptions.autoFocus,
    });

    const pluginTeardowns =
      mergedOptions.plugins?.map((p) =>
        p.setup?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
      ) ?? [];

    dialogRef.component = compRef.instance;

    mergedOptions.plugins?.forEach((p) =>
      p.onOpen?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
    );

    let unlistenNav: VoidFunction | undefined;
    if (mergedOptions.closeOnNavigation && this.location) {
      unlistenNav = this.location.onUrlChange(() => {
        dialogRef.close(undefined, 'navigation');
      });
    }

    dialogEl.addEventListener(
      'close',
      () => {
        const index = this.openDialogs.indexOf(dialogRef);
        if (index > -1) {
          this.openDialogs.splice(index, 1);
        }

        unlistenNav?.();

        this.appRef.detachView(compRef.hostView);
        compRef.destroy();
        this.appRef.detachView(surfaceRef.hostView);
        surfaceRef.destroy();
        dialogEl.remove();

        pluginTeardowns.forEach((teardown) => teardown?.());
        mergedOptions.plugins?.forEach((p) =>
          p.onClose?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
        );

        focusRemainingDialog(this.openDialogs);

        dialogRef._finishClose();
      },
      { once: true },
    );

    queueMicrotask(() => {
      // Floating windows get an initial translate; toasts/popovers use CSS / plugins instead.
      if (!isModal && meta.intent === 'window') {
        if (!dialogEl.style.transform && dialogEl.style.left !== '0px') {
          setPosition(dialogRef, 0, 0);
        }
      }
    });

    return dialogRef;
  }
}

function resolveSize(size?: DialogSizePreset | (string & {})): string | undefined {
  if (!size) return undefined;
  if (size in DIALOG_SIZE_PRESETS) {
    return DIALOG_SIZE_PRESETS[size as DialogSizePreset];
  }
  return size;
}

function applyClasses(el: HTMLElement, value?: string | string[]): void {
  if (!value) return;
  const classes = [value]
    .flat()
    .flatMap((c) => c.split(' '))
    .filter(Boolean);
  if (classes.length) el.classList.add(...classes);
}

function ensureTitleId(
  contentRoot: HTMLElement,
  dialogEl: HTMLDialogElement,
  options: DialogOptions,
): void {
  if (options.ariaLabelledBy || options.ariaLabel) return;
  const title = contentRoot.querySelector('.al-dialog-title') as HTMLElement | null;
  if (!title) return;
  if (!title.id) {
    title.id = `al-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
  }
  dialogEl.setAttribute('aria-labelledby', title.id);

  const body = contentRoot.querySelector('.al-dialog-content') as HTMLElement | null;
  if (body && !options.ariaDescribedBy) {
    if (!body.id) {
      body.id = `al-dialog-desc-${Math.random().toString(36).slice(2, 9)}`;
    }
    dialogEl.setAttribute('aria-describedby', body.id);
  }
}

function resolveAnimationClasses(
  animation: DialogAnimation | undefined,
): { enter: string | null; leave: string | null } {
  if (!animation) return { enter: null, leave: null };
  if (animation === 'fade') {
    return { enter: 'al-dialog-anim-fade-enter', leave: 'al-dialog-anim-fade-leave' };
  }
  return {
    enter: animation.enter ?? null,
    leave: animation.leave ?? null,
  };
}

/** AlDialog already restored the opener; if focus landed on body, keep a stack. */
function focusRemainingDialog(openDialogs: DialogRef<any, any>[]): void {
  if (openDialogs.length > 0 && document.activeElement === document.body) {
    openDialogs[openDialogs.length - 1]?.dialogEl?.focus();
  }
}

const lazyComponents = new WeakMap<object, Promise<Type<any>>>();

/** Loads a lazy definition once; later runs reuse the same component. */
function loadLazy<TComponent>(
  definition: Exclude<AnyDialogDefinition<TComponent, any, any>, DialogDefinition<TComponent, any, any>>,
): Promise<Type<TComponent>> {
  let pending = lazyComponents.get(definition);
  if (!pending) {
    pending = definition.load();
    // Drop failed loads so a retry can succeed (e.g. flaky network chunk).
    pending.catch(() => lazyComponents.delete(definition));
    lazyComponents.set(definition, pending);
  }
  return pending as Promise<Type<TComponent>>;
}
