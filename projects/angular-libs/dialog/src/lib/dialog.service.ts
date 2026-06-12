import {
  Injectable,
  ApplicationRef,
  EnvironmentInjector,
  Type,
  createComponent,
  Injector,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { DialogRef } from './dialog-ref';
import { setPosition, bringToFront } from './actions';
import { type GlobalDialogConfig, type DialogOptions, type InferDialogResult } from './dialog.types';

/**
 * Service for opening Angular components inside a native HTML `<dialog>` modal.
 *
 * The service dynamically creates a `<dialog>` element, mounts the requested component inside it,
 * wires `DialogRef` into the component injector, and cleans everything up when the dialog closes.
 *
 * Key characteristics:
 * - uses the browser's native HTML5 `<dialog>` element
 * - works with standalone components
 * - supports typed component inputs and close results (via {@link InferDialogResult})
 * - guards DOM access for SSR safety
 * - supports both modal (blocking) and non-modal (interactive) modes
 * - extensible via plugins (e.g. `draggablePlugin`)
 * - allows minimizing non-modal dialogs into a taskbar-like state
 *
 * @example
 * ```ts
 * // Basic modal dialog
 * const ref = dialogService.open(EditUserDialogComponent, {
 *   inputs: { userName: 'Ava' },
 *   width: '32rem',
 * });
 * const { result } = await ref.closed;
 *
 * // Non-modal, draggable dialog that can be minimized
 * const floatingRef = dialogService.open(ChatWindowComponent, {
 *   modal: false,
 *   plugins: [draggablePlugin({ handle: '.chat-header' })]
 * });
 * minimize(floatingRef); // Send to bottom of screen
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);

  /**
   * Reactive signal representing the entire global dialog configuration.
   * Can be read, updated, or bound dynamically using standard Angular Signals.
   */
  public config: WritableSignal<GlobalDialogConfig> = signal<GlobalDialogConfig>({});

  public openDialogs: DialogRef<any, any>[] = [];

  constructor() {
    // Keep nested dialogs visible across native fullscreen transitions.
    // When the document leaves fullscreen, any dialog that was mounted inside the
    // (now former) fullscreen element is relocated back to <body>.
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.handleGlobalFullscreenChange);
    }
  }

  /**
   * Resolves the DOM container a dialog should be mounted into.
   *
   * The native Fullscreen API promotes the fullscreen element into the browser's "top layer",
   * which renders above all normal-flow content. A dialog appended to `<body>` while another
   * element is fullscreen would therefore be hidden behind it (non-modal dialogs especially,
   * since they never join the top layer). Mounting the new dialog inside the active fullscreen
   * element makes it render on top of the fullscreen content instead.
   */
  private getMountTarget(): HTMLElement {
    return (document.fullscreenElement as HTMLElement | null) ?? document.body;
  }

  /**
   * When the document exits fullscreen, move any dialog that was mounted inside the former
   * fullscreen element back to `<body>` so its fixed positioning and lifecycle stay correct.
   */
  private handleGlobalFullscreenChange = (): void => {
    if (document.fullscreenElement) return;

    for (const ref of this.openDialogs) {
      const el = ref.dialogEl;
      if (el && el.parentElement && el.parentElement !== document.body) {
        const activeElement = document.activeElement as HTMLElement | null;
        document.body.appendChild(el);
        if (activeElement && el.contains(activeElement)) {
          activeElement.focus();
        }
      }
    }
  };

  /**
   * Dynamically updates the global dialog configuration.
   * Useful when configurations are loaded asynchronously (e.g. from a backend) after app initialization.
   *
   * @param config Partial global configuration options to apply.
   */
  updateConfig(config: Partial<GlobalDialogConfig>): void {
    this.config.update((current) => ({
      ...current,
      ...config,
    }));
  }

  /**
   * Closes all currently open dialogs.
   *
   * Each dialog is closed through its own {@link DialogRef.close} method, which means any
   * registered {@link DialogRef.beforeClose} hook still participates in the close flow.
   */
  closeAll(): void {
    // Clone array to avoid mutation issues while closing
    [...this.openDialogs].forEach((dialogRef) => dialogRef.close());
  }

  /**
   * Opens a component in a native HTML5 `dialog` modal.
   *
   * The returned {@link DialogRef} exposes both the created component instance and the eventual
   * close result.
   *
   * Result typing is inferred from a public component property typed as `DialogRef<TResult>`.
   * If the component does not expose one, the result type becomes `unknown`.
   *
   * In server-side rendering environments, DOM work is skipped and a detached `DialogRef` is
   * returned instead.
   *
   * @typeParam TComponent Component type to render inside the dialog.
   * @param component Standalone or declarable Angular component class to render.
   * @param options Optional configuration for inputs, close behavior, injector ancestry, classes,
   * plugins, modal mode, and inline size styles.
   * @returns A dialog handle that exposes the created component instance immediately and resolves
   * its {@link DialogRef.closed} promise after the dialog closes.
   *
   * @example
   * ```ts
   * const ref = dialogService.open(ConfirmDialogComponent, {
   *   inputs: { message: 'Delete this file?' },
   *   disableClose: true,
   *   width: '28rem',
   * });
   *
   * const { result, closeSource } = await ref.closed;
   * ```
   */
  open<TComponent>(
    component: Type<TComponent>,
    options: DialogOptions<TComponent> = {},
  ): DialogRef<InferDialogResult<TComponent>, TComponent> {
    const rawPlugins = [
      ...(this.config().plugins || []),
      ...(options.plugins || []),
    ];

    // Deduplicate from right to left, keeping more specific/last instance of any seen plugin.id
    const seen = new Set<string>();
    const uniquePlugins = [...rawPlugins].reverse().filter((p) => {
      if (!p.id) return true;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).reverse();

    const mergedOptions: DialogOptions<TComponent> = {
      ...this.config(),
      ...options,
      plugins: uniquePlugins,
    };
    const { inputs } = mergedOptions;

    // 1. Create a raw HTML dialog element dynamically in the DOM body
    const dialogEl = document.createElement('dialog');

    // Add a default class which applies our zero-config base styles (padding: 0, border: none, etc.)
    dialogEl.classList.add('al-dialog');

    if (mergedOptions.panelClass) {
      const classes = [mergedOptions.panelClass]
        .flat()
        .flatMap((c) => c.split(' '))
        .filter(Boolean);
      dialogEl.classList.add(...classes);
    }

    const sizeKeys = ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight'] as const;
    sizeKeys.forEach((key) => {
      const value = mergedOptions[key];
      if (value) dialogEl.style[key] = value;
    });

    if (mergedOptions.resizable) {
      dialogEl.style.resize = 'both';
      dialogEl.style.overflow = 'hidden';
      // Prevent the native dialog from being resized smaller than its contents' minimum size
      if (!mergedOptions.minWidth) dialogEl.style.minWidth = 'min-content';
      if (!mergedOptions.minHeight) dialogEl.style.minHeight = 'min-content';
    }

    // Mount inside the active fullscreen element (if any) so the dialog renders on top of
    // fullscreen content instead of being hidden behind the browser's top layer.
    this.getMountTarget().appendChild(dialogEl);

    // Make the dialog focusable and focus it on programmatic show
    dialogEl.tabIndex = -1;

    // 2. Instantiate our updated DialogRef, which stores the result in memory (not in the DOM)
    const dialogRef = new DialogRef<InferDialogResult<TComponent>, TComponent>(dialogEl, mergedOptions);

    // Bring clicked/focused non-modal dialogs to the front dynamically by tracking focus/cliques
    if (mergedOptions.modal === false) {
      dialogEl.addEventListener('focusin', () => {
        bringToFront(dialogRef);
      });
      dialogEl.addEventListener('mousedown', () => {
        bringToFront(dialogRef);
      });
    }

    // Track the dialog
    this.openDialogs.push(dialogRef);

    // 3. Create a custom injector so the component can safely inject `DialogRef`
    const customInjector = Injector.create({
      providers: [{ provide: DialogRef, useValue: dialogRef }],
      parent: mergedOptions.injector ?? this.envInjector,
    });
    dialogRef.injector = customInjector;

    // 4. Instantiate the user's component
    const compRef = createComponent(component, {
      environmentInjector: this.envInjector,
      elementInjector: customInjector,
    });

    // Bind inputs if provided
    if (inputs) {
      Object.entries(inputs).forEach(([key, value]) => {
        compRef.setInput(key, value);
      });
    }

    // 5. Attach the view to Angular's lifecycle for change detection
    this.appRef.attachView(compRef.hostView);

    // 6. Append the rendered component to the native dialog
    const compRootNode = (compRef.hostView as any).rootNodes[0] as HTMLElement;
    if (compRootNode) {
      compRootNode.dataset['alDialogContent'] = 'true';
    }
    dialogEl.appendChild(compRootNode);

    const pluginTeardowns = mergedOptions.plugins?.map((p) => p.setup?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector })) ?? [];

    // Assign the actual instance so the parent can modify it before/during render
    dialogRef.component = compRef.instance;

    // 7. Show the dialog using the native modal API
    mergedOptions.modal === false ? dialogEl.show() : dialogEl.showModal();

    // Trigger onOpen on plugins
    mergedOptions.plugins?.forEach((p) => p.onOpen?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }));

    // 8. Handle backdrop clicks to close the dialog
    // We track mousedown to prevent closing when dragging from inside to outside (like resizing)
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
      if (dialogEl.open && !mergedOptions.disableClose && !mousedownInside && !isClickInside(dialogEl, event)) {
        dialogRef.close(undefined, 'backdrop');
      }
    });

    // 9. Intercept native 'ESC' and 'cancel' activities to route them safely through custom close logic
    const handleDismiss = (e: Event) => {
      e.preventDefault();
      if (!mergedOptions.disableClose) {
        dialogRef.close(undefined, 'escape');
      }
    };
    dialogEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') handleDismiss(e);
    });
    dialogEl.addEventListener('cancel', handleDismiss);

    // 10. Handle cleanup and promise resolution when the dialog is naturally closed
    dialogEl.addEventListener(
      'close',
      () => {
        // Untrack the dialog
        const index = this.openDialogs.indexOf(dialogRef);
        if (index > -1) {
          this.openDialogs.splice(index, 1);
        }

        // Disconnect from Angular
        this.appRef.detachView(compRef.hostView);
        compRef.destroy();

        // Remove from DOM
        dialogEl.remove();

        // Run plugin teardowns
        pluginTeardowns.forEach((teardown) => teardown?.());

        // Run plugin onClose hooks
        mergedOptions.plugins?.forEach((p) => p.onClose?.({ element: dialogEl, dialogRef: dialogRef, injector: customInjector }));

        // Focus the next available dialog in the stack if the dismissed one currently held focus
        if (this.openDialogs.length > 0 && document.activeElement === document.body) {
          const nextRef = this.openDialogs[this.openDialogs.length - 1];
          nextRef?.dialogEl?.focus();
        }

        // Resolve the ref's promise
        dialogRef._finishClose();
      },
      { once: true },
    );

    // Initial focus on opening a non-modal dialog to wire shortcut keys correctly
    if (mergedOptions.modal === false) {
      setTimeout(() => {
        // Measure baseline centered positions and anchor them strictly to absolute coordinates
        // This stops coordinates from jumping on the very first drag/focus interaction
        if (!dialogEl.style.transform && dialogEl.style.left !== '0px') {
          // Instead of removing margin/centering and locking strictly at absolute pixel bounds
          // on start, we can leverage translate3d relative transforms directly on top of native layout.
          // This keeps the dialog perfectly centered on open, while supporting relative pointer drags offsets!
          setPosition(dialogRef, 0, 0);
        }
        dialogEl.focus();
      }, 0);
    }

    return dialogRef;
  }
}
