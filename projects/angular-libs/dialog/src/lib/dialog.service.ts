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
import { DialogRef } from './dialog-ref';
import { setPosition, bringToFront } from './actions';
import {
  DIALOG_CONFIG,
  DIALOG_SIZE_PRESETS,
  isPlainDialogStrings,
  resolveDialogStrings,
  type GlobalDialogConfig,
  type DialogOptions,
  type InferDialogResult,
  type WindowOptions,
  type ConfirmOptions,
  type PopoverDialogOptions,
  type ToastOptions,
  type ToastPosition,
  type DialogSizePreset,
  type AutoFocusTarget,
  type DialogAnimation,
  type ProvideDialogConfig,
  type DialogStrings,
} from './dialog.types';
import { mergePlugins, resolveBehaviorPlugins } from './behavior-resolver';
import { popoverPlugin } from './plugins/popover.plugin';
import { autoClosePlugin } from './plugins/auto-close.plugin';
import { DefaultDialogComponent } from './components/default-dialog.component';

const TOAST_STACK_GAP_PX = 12;

/**
 * Service for opening Angular components inside a native HTML `<dialog>` element.
 *
 * Prefer intent helpers when possible:
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
   * Opens a modal component dialog (default).
   */
  open<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options: DialogOptions<TComponent> = {},
  ): DialogRef<TResult, TComponent> {
    return this.openInternal(component, options, { intent: 'open' });
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
   */
  async confirm(options: ConfirmOptions = {}): Promise<boolean> {
    const strings = this.resolveMergedStrings(options.strings);
    const title = options.title ?? strings.confirmTitle ?? 'Confirm';
    const ref = this.open<DefaultDialogComponent, boolean>(DefaultDialogComponent, {
      inputs: {
        title,
        subtitle: options.subtitle,
        contentText: options.message,
        primaryButtonText: options.confirmText ?? strings.ok ?? 'OK',
        secondaryButtonText: options.cancelText ?? strings.cancel ?? 'Cancel',
        showCloseIcon: true,
        primaryResult: true,
        secondaryResult: false,
      },
      width: options.width,
      size: options.size ?? 'sm',
      disableClose: options.disableClose,
      panelClass: options.panelClass,
      contentClass: options.contentClass,
      ariaLabel: options.ariaLabel ?? title,
      ariaDescribedBy: options.ariaDescribedBy,
      animation: options.animation,
      closeOnNavigation: true,
      restoreFocus: true,
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
    const ref = this.open<DefaultDialogComponent, true>(DefaultDialogComponent, {
      inputs: {
        title,
        subtitle: options.subtitle,
        contentText: options.message,
        primaryButtonText: options.confirmText ?? strings.ok ?? 'OK',
        showCloseIcon: true,
        primaryResult: true,
      },
      width: options.width,
      size: options.size ?? 'sm',
      disableClose: options.disableClose,
      panelClass: options.panelClass,
      contentClass: options.contentClass,
      ariaLabel: options.ariaLabel ?? title,
      ariaDescribedBy: options.ariaDescribedBy,
      animation: options.animation,
      closeOnNavigation: true,
      restoreFocus: true,
    });
    await ref.closed;
  }

  /**
   * Anchored modeless popover.
   */
  popover<TComponent, TResult = InferDialogResult<TComponent>>(
    component: Type<TComponent>,
    options: PopoverDialogOptions<TComponent>,
  ): DialogRef<TResult, TComponent> {
    const { anchor, placement, offset, showArrow, arrowColor, plugins, ...rest } = options;
    return this.openInternal(
      component,
      {
        ...rest,
        modal: false,
        restoreFocus: rest.restoreFocus ?? true,
        closeOnNavigation: rest.closeOnNavigation ?? false,
        autoFocus: rest.autoFocus ?? 'first-tabbable',
        plugins: [
          popoverPlugin({ anchor, placement, offset, showArrow, arrowColor }),
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

    const opener =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialogEl = document.createElement('dialog');
    dialogEl.classList.add('al-dialog');
    if (meta.intent === 'window') {
      dialogEl.classList.add('al-dialog-window');
    } else if (meta.intent === 'popover') {
      dialogEl.classList.add('al-dialog-popover');
    }

    applyClasses(dialogEl, mergedOptions.panelClass);

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

    applyAria(dialogEl, mergedOptions, isModal);

    this.getMountTarget().appendChild(dialogEl);
    dialogEl.tabIndex = -1;

    const dialogRef = new DialogRef<TResult, TComponent>(dialogEl, mergedOptions);
    dialogRef._opener = opener;
    dialogRef._restoreFocus = mergedOptions.restoreFocus !== false;

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

    const pluginTeardowns =
      mergedOptions.plugins?.map((p) =>
        p.setup?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
      ) ?? [];

    dialogRef.component = compRef.instance;

    isModal ? dialogEl.showModal() : dialogEl.show();

    mergedOptions.plugins?.forEach((p) =>
      p.onOpen?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
    );

    const isClickInside = (el: HTMLElement, event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top <= event.clientY &&
        event.clientY <= rect.bottom &&
        rect.left <= event.clientX &&
        event.clientX <= rect.right
      );
    };

    let mousedownInside = false;
    dialogEl.addEventListener('mousedown', (event) => {
      mousedownInside = isClickInside(dialogEl, event);
    });

    dialogEl.addEventListener('click', (event) => {
      if (
        dialogEl.open &&
        !mergedOptions.disableClose &&
        !mousedownInside &&
        !isClickInside(dialogEl, event)
      ) {
        dialogRef.close(undefined, 'backdrop');
      }
    });

    const handleDismiss = (e: Event) => {
      e.preventDefault();
      if (!mergedOptions.disableClose) {
        dialogRef.close(undefined, 'escape');
      }
    };
    dialogEl.addEventListener('cancel', handleDismiss);

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
        dialogEl.remove();

        pluginTeardowns.forEach((teardown) => teardown?.());
        mergedOptions.plugins?.forEach((p) =>
          p.onClose?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }),
        );

        restoreFocusAfterClose(dialogRef, this.openDialogs);

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
      applyAutoFocus(dialogEl, mergedOptions.autoFocus);
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

function applyAria(
  dialogEl: HTMLDialogElement,
  options: DialogOptions,
  isModal: boolean,
): void {
  dialogEl.setAttribute('aria-modal', isModal ? 'true' : 'false');
  if (options.ariaLabel) {
    dialogEl.setAttribute('aria-label', options.ariaLabel);
  }
  if (options.ariaLabelledBy) {
    dialogEl.setAttribute('aria-labelledby', options.ariaLabelledBy);
  }
  if (options.ariaDescribedBy) {
    dialogEl.setAttribute('aria-describedby', options.ariaDescribedBy);
  }
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

function applyAutoFocus(dialogEl: HTMLDialogElement, target: AutoFocusTarget | undefined): void {
  if (target === false) return;

  if (target === 'dialog' || target === undefined) {
    dialogEl.focus();
    return;
  }

  if (typeof target === 'string' && target !== 'first-tabbable') {
    const el = dialogEl.querySelector(target) as HTMLElement | null;
    el?.focus();
    return;
  }

  if (target instanceof HTMLElement) {
    target.focus();
    return;
  }

  // first-tabbable
  const focusable = dialogEl.querySelector(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) as HTMLElement | null;
  (focusable ?? dialogEl).focus();
}

function restoreFocusAfterClose(
  dialogRef: DialogRef<any, any>,
  openDialogs: DialogRef<any, any>[],
): void {
  if (!dialogRef._restoreFocus) {
    if (openDialogs.length > 0 && document.activeElement === document.body) {
      openDialogs[openDialogs.length - 1]?.dialogEl?.focus();
    }
    return;
  }

  const opener = dialogRef._opener;
  if (opener && document.contains(opener)) {
    opener.focus();
    return;
  }

  if (openDialogs.length > 0) {
    openDialogs[openDialogs.length - 1]?.dialogEl?.focus();
  }
}
