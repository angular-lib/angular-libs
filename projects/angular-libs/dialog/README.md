# @angular-libs/dialog

A lightweight service for opening Angular components inside a native HTML `<dialog>` element.

## Features

- Uses the browser's native `<dialog>` element
- Works seamlessly with standalone components
- Strong typing for component inputs and close results
- Supports both **modal** (blocking) and **non-modal** (modeless/interactive) modes
- **Minimization & Maximization**: Non-modal dialogs can be minimized to visual previews at the bottom of the screen or maximized to fill the viewport
- **Built-in Plugins**:
  - **`snapToEdgePlugin`**: Snaps dialog layouts to viewport borders (occupying 50% sections) using `Alt + Arrow` key controls.
  - **`draggablePlugin`**: Drag-and-drop window movement.
  - **`layoutPersistencePlugin`**: Persisting positions, sizes, and states across reloads.
  - **`popoverPlugin`**: Anchoring modeless dialogs next to standard pointer targets as dropdowns or contextual menus.
  - **`tileSnappingPlugin`**: Alt/Option + S interactive coordinate-snapping select grids.
  - **`autoClosePlugin`**: Countdown timer for transient toasts or notifications.
  - **`dockPlugin`**: Docking minimized dialogs cleanly inside a glassmorphic layout.
  - **`windowManagerPlugin`**: All-in-one OS-style workspace window layout composite.
- **DefaultDialogComponent**: Built-in, fully-customizable wrapper supporting nested sub-components or HTML/plain text layouts with zero boilerplate.
- SSR safe

## Installation & Styles Setup

### 1. Install the package
```bash
npm install @angular-libs/dialog
```

### 2. Import core styles
The dialog library requires baseline CSS for transitions, backdrop, resizability, and minimization states.

**Option A:** Import in your global `styles.css` / `styles.scss`:
```css
@import "@angular-libs/dialog/styles.css";
```

**Option B:** Add to your `styles` array in `angular.json`:
```json
"styles": [
  "src/styles.css",
  "node_modules/@angular-libs/dialog/styles.css"
]
```

## Basic Usage

```ts
import { DialogService } from '@angular-libs/dialog';
import { inject } from '@angular/core';

@Component({ ... })
export class MyComponent {
  private dialogService = inject(DialogService);

  async openDialog() {
    // Open a modal dialog
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      inputs: { message: 'Are you sure?' },
      width: '400px'
    });

    const { result, closeSource } = await ref.closed;
    console.log('Dialog closed with:', result);
  }
}
```

## Modeless Mode, Minimization, Maximization & Global Dock

You can open dialogs in non-modal / modeless mode (`modal: false`), which allows the user to interact with the underlying page while the dialog remains open. Modeless dialogs support minimization, maximization, position modifications, and rich plugin integrations using standalone operators.

```ts
import { minimize, maximize, restore, snapToEdge } from '@angular-libs/dialog';

const ref = this.dialogService.open(ChatWindowComponent, {
  modal: false, // Opens via native dialog.show() instead of showModal()
  width: '350px',
  height: '250px'
});

// Minimize the dialog into a docked taskbar bar at the bottom of the screen
minimize(ref);

// Maximize the dialog to cover the full screen
maximize(ref);

// Restore back to original size/coordinates
restore(ref);

// Snap the dialog to the right side of the screen (occupying 50% width)
snapToEdge(ref, 'right');
```

### Global Configuration & Dock Custom Settings
Configure global behaviors using Angular signals on `DialogService` or by calling `updateConfig` anywhere (e.g., in your main component's constructor):

```ts
import { DialogService } from '@angular-libs/dialog';
import { inject } from '@angular/core';

export class AppComponent {
  private dialogService = inject(DialogService);

  constructor() {
    this.dialogService.updateConfig({
      // Auto-hide the taskbar/dock when there is no cursor interaction (default is false)
      autoHideDock: true,
      // Custom HTMLElement or CSS selector where minimized dialogs are attached
      minimizeTarget: '#my-custom-dock-container',
      // Global plugins to apply to all dialogs automatically
      plugins: []
    });
  }
}
```

---

## 🔌 Built-in Plugins Reference

`@angular-libs/dialog` comes packed with eight highly optimized plugins to cover advanced interactive window requirements.

### 1. Draggable Plugin (`draggablePlugin`)
Makes any non-modal/modeless dialog fully draggable using pointer events.
* **Options**:
  * `handle?: string` - CSS selector for target dragging handle (e.g. `'header'`). If omitted, the entire dialog acts as the drag handle.
  * `containInViewport?: boolean` - If `true`, restricts dragging boundaries so the dialog cannot drift off-screen. Defaults to `false`.
* **Usage**:
  ```ts
  import { draggablePlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    modal: false,
    plugins: [draggablePlugin({ handle: 'header', containInViewport: true })]
  });
  ```

### 2. Layout Persistence Plugin (`layoutPersistencePlugin`)
Autosaves and rehydrates dialog positions, dimensions, minimized, and maximized state values across browser updates or visual interactions. Integrates out-of-the-box with `localStorage` or customizable database event hooks.
* **Options**:
  * `key?: string` - Unique key namespaces this dialog instance in the storage solution.
  * `prefix?: string` - Custom key storage prefix. Defaults to `'al_'`.
  * `storage?: Storage` - Target storage engine. Defaults to `window.localStorage`.
  * `save?: (state: SavedDialogState, ref: DialogRef) => void` - Custom async/sync save interceptor.
  * `restore?: (ref: DialogRef) => SavedDialogState | Promise<SavedDialogState>` - Custom async/sync restore interceptor.
* **Usage**:
  ```ts
  import { layoutPersistencePlugin, draggablePlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    id: 'user-settings-panel', // Used as key namespace if custom key is omitted
    modal: false,
    plugins: [
      draggablePlugin({ handle: 'header' }),
      layoutPersistencePlugin({ key: 'user-settings-layout' })
    ]
  });
  ```

### 3. Popover Plugin (`popoverPlugin`)
Anchors a modeless floating window relative to a trigger element on the screen. Perfectly suited for dropdowns, profile reveals, contextual menu layouts, and hover flyouts. Adapts to screen padding, monitors scroll offset adjustments, and handles collision detections nicely.
* **Options**:
  * `anchor: HTMLElement | string` - Target element or CSS selector query matching the anchorage center.
  * `placement?: 'bottom-left' | 'bottom' | 'bottom-right' | 'top-left' | 'top' | 'top-right' | 'left' | 'right'` - Position relative to trigger. Defaults to `'bottom-left'`.
  * `offset?: number` - Gap in pixels between anchor point & dialog border. Defaults to `12`.
  * `showArrow?: boolean` - Toggles the indicator pointer arrow. Defaults to `true`.
  * `arrowColor?: string` - Hex CSS color code of the arrow element. Defaults to `'#ffffff'`.
* **Usage**:
  ```ts
  import { popoverPlugin } from '@angular-libs/dialog';

  this.dialogService.open(DropdownMenuComp, {
    modal: false,
    plugins: [
      popoverPlugin({
        anchor: event.currentTarget as HTMLElement,
        placement: 'bottom',
        offset: 8
      })
    ]
  });
  ```

### 4. macOS-style Tile Snapping Plugin (`tileSnappingPlugin`)
Triggers an interactive, fullscreen glassmorphic coordinate snapping selector grid overlay. When holding `Alt / Option` + `S` (customizable) while moving or focusing a non-modal window, highlighting cells on the virtual tiles allows the dialog to snap and fill that targeted screen grid coordinates.
* **Options**:
  * `rows?: number` - Snapping rows in the select mesh. Defaults to `4`.
  * `cols?: number` - Snapping cols in the select mesh. Defaults to `4`.
  * `triggerKeyCode?: string` - DOM `KeyboardEvent.code` sequence. Defaults to `'KeyS'`.
  * `padding?: string` - Visual grid margins inside screen borders. Defaults to `'8px'`.
  * `gap?: string` - Distance spacing between tiles. Defaults to `'8px'`.
* **Usage**:
  ```ts
  import { tileSnappingPlugin, draggablePlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    modal: false,
    plugins: [
      draggablePlugin({ handle: 'header' }),
      tileSnappingPlugin({ rows: 5, cols: 5, triggerKeyCode: 'KeyS' })
    ]
  });
  ```

### 5. Auto-Close Plugin (`autoClosePlugin`)
Automatically dismisses or closes transient notification dialogs, banners, self-dismissing alerts, or temporary toasts after a configurable duration.
* **Options**:
  * `duration?: number` - Timeline duration in milliseconds before closing. Defaults to `5000`.
  * `pauseOnHover?: boolean` - Pauses/resets the ticking timer when the pointer enters the dialog body, and resumes upon leaving. Defaults to `true`.
* **Usage**:
  ```ts
  import { autoClosePlugin } from '@angular-libs/dialog';

  this.dialogService.open(ToastNotificationComp, {
    modal: false,
    plugins: [autoClosePlugin({ duration: 3000, pauseOnHover: true })]
  });
  ```

### 6. Dock Plugin (`dockPlugin`)
Manages docking minimized dialogs inside a native-styled bottom taskbar container or custom container. Keeps minimized layouts clean, responsive, and cross-browser safe.
* **Options**:
  * `minimizeTarget?: HTMLElement | string` - Selector query or DOM element to mount the minimized items. If not specified, a default overlay-dock is created at the screen bottom.
  * `autoHide?: boolean` - Whether to automatically slide the dock down off-screen when no hover activity is detected. Defaults to `false`.
* **Usage**:
  ```ts
  import { dockPlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    modal: false,
    plugins: [dockPlugin({ autoHide: true })]
  });
  ```

### 7. Window Manager Plugin (`windowManagerPlugin`)
A composite plugin that combines dragging, snapping, and docking services together. Under the hood, it deploys `draggablePlugin`, `tileSnappingPlugin`, and `dockPlugin` dynamically so you can launch a fully featured, desktop-like workspace environment with zero boilerplate code.
* **Options**:
  * `draggable?: boolean | DraggablePluginOptions` - Customize or toggle spatial dragging behaviors. Defaults to `{}` (enabled).
  * `snapping?: boolean | TileSnappingOptions` - Customize or toggle Options + S grid snapping. Defaults to `{}` (enabled).
  * `dock?: boolean | DockPluginOptions` - Customize or toggle dock behaviors. Defaults to `{}` (enabled).
* **Usage**:
  ```ts
  import { windowManagerPlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    modal: false,
    plugins: [windowManagerPlugin({  dock: { autoHide: true } })]
  });
  ```

### 8. Keyboard Edge Snapping Plugin (`snapToEdgePlugin`)
Snaps any modeless dialog to the viewport boundaries. Once focused, pressing `Alt + (ArrowLeft / ArrowRight / ArrowUp / ArrowDown)` will re-render the dialog's shape to occupy 50% sections of the screen boundary, neutralizing standard default centering offsets.
* **Usage**:
  ```ts
  import { snapToEdgePlugin, draggablePlugin } from '@angular-libs/dialog';

  this.dialogService.open(MyComp, {
    modal: false,
    plugins: [
      draggablePlugin({ handle: 'header' }),
      snapToEdgePlugin()
    ]
  });
  ```

---

## 🎛️ DefaultDialogComponent (Built-in Wrapper Component)
Don't want to create an entirely separate component structure for a simple confirmation popup, feedback alert, or quick banner? Use the pre-designed, signal-oriented `DefaultDialogComponent`.

It features customizable headers (with optional close, minimize, maximize decorators), an isolated body text section, custom buttons, dynamic component insertions (outlet mapping), and standard event output streams.

### Input Mappings
* `title` (signal): Main title string.
* `subtitle` (signal): Description subtitle text.
* `showCloseIcon` (signal): Toggle top close button. Default is `true`.
* `showMinimizeIcon` (signal): Toggle minimize button (only visible on modeless). Default is `false`.
* `showMaximizeIcon` (signal): Toggle maximize button. Default is `false`.
* `contentText` (signal): Simple text body content.
* `contentComponent` (signal): Nested standalone Angular component type to render inside.
* `contentInputs` (signal): Raw input properties dictionary to pass downstream to `contentComponent`.
* `primaryButtonText` (signal): Styled green confirmation action button label.
* `secondaryButtonText` (signal): Standard secondary button label.
* `closeButtonText` (signal): Footer abort choice label.

### Output Actions
* `primaryAction`: Emitter output triggered on confirming click.
* `secondaryAction`: Emitter output triggered on secondary click.

### Examples

#### Example A: Zero-Boilerplate Modal Alert
```ts
import { DefaultDialogComponent } from '@angular-libs/dialog';

const ref = this.dialogService.open(DefaultDialogComponent, {
  inputs: {
    title: 'Discard Project?',
    subtitle: 'This operation is irreversible.',
    contentText: 'Are you absolutely sure you want to proceed and discard all current changes?',
    primaryButtonText: 'Yes, Discard',
    secondaryButtonText: 'No, Keep Working'
  },
  width: '32rem'
});

ref.component.primaryAction.subscribe(() => {
  ref.close('proceed');
});
ref.component.secondaryAction.subscribe(() => {
  ref.close(null);
});
```

#### Example B: Hosting Custom Dialog Content Dynamically
```ts
import { DefaultDialogComponent } from '@angular-libs/dialog';
import { UserProfileForm } from './user-profile-form';

const ref = this.dialogService.open(DefaultDialogComponent, {
  inputs: {
    title: 'Review Profile',
    contentComponent: UserProfileForm,
    contentInputs: { userId: 'usr-928' },
    closeButtonText: 'Discard Changes'
  },
  modal: true
});
```

---

<details>
<summary><b>🎨 Core Classes & Style Customization</b></summary>

Baseline layouts are unopinionated, utilizing a default target class `.al-dialog`. You can customize styles via CSS variables or override styling states directly using standard class hook mappings:

### CSS Custom Properties
```css
dialog.al-dialog {
  --al-dialog-border: none;             /* Custom border properties */
  --al-dialog-border-radius: 8px;       /* Custom border-radius properties */
  --al-dialog-backdrop: rgba(0,0,0,0.3);/* Custom backdrop shadow overlay color */
  --al-minimized-width: 150px;          /* Width of minimized card micro-previews */
  --al-minimized-height: 100px;         /* Height of minimized card micro-previews */
}
```

### Layout Hook Classes
- **`.al-dialog`**: Applied to the underlying HTML5 `<dialog>` wrapper element.
- **`.al-dialog-minimized`**: Attached to both the dialog and content root elements when `ref.minimize()` triggers.
- **`.al-dialog-maximized`**: Attached when `ref.maximize()` is triggered (full screen overlay).
- **`.al-dialog-dragging`**: Dynamically added during active point-and-drag interactions.
</details>

## Creating a Dialog Component

Dialog components can inject `DialogRef` to close themselves and return a typed result.

```ts
import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular-libs/dialog';

@Component({
  template: `
    <h2>Edit Name</h2>
    <button (click)="save()">Save</button>
    <button (click)="cancel()">Cancel</button>
  `,
})
export class EditNameComponent {
  // Injecting DialogRef to close the dialog and pass data back
  dialogRef = inject<DialogRef<string>>(DialogRef);

  save() {
    this.dialogRef.close('New Name', 'saved');
  }

  cancel() {
    this.dialogRef.close(undefined, 'cancelled');
  }
}
```

<details>
<summary><b>🛠️ Creating Custom Plugins (Plugin API Docs for AI & Developers)</b></summary>

The dialog library supports custom visual and logical extensions through a simple plugin system. Implement custom workflows by matching the `DialogPlugin` interface:

```typescript
export interface DialogPlugin<TResult = any, TComponent = any> {
  readonly id?: string;
  setup?(context: DialogPluginContext<TResult, TComponent>): (() => void) | void;
  onOpen?(context: DialogPluginContext<TResult, TComponent>): void;
  beforeClose?(
    context: DialogPluginContext<TResult, TComponent> & { source: CloseSource }
  ): Promise<boolean | void> | boolean | void;
  onClose?(context: DialogPluginContext<TResult, TComponent>): void;
  onLayoutChange?(
    context: DialogPluginContext<TResult, TComponent> & { changes: LayoutChangeEvent }
  ): void;
}
```

### Simple Example: Auto-Focus First Input Plugin

Automatically focuses the first interactable input field inside a dialog when it opens:

```typescript
import { DialogPlugin } from '@angular-libs/dialog';

export function autoFocusFirstInputPlugin(): DialogPlugin {
  return {
    onOpen({ element }) {
      const firstInput = element.querySelector('input, textarea, select, [tabindex="0"]') as HTMLElement | null;
      firstInput?.focus();
    }
  };
}
```

### Advanced Example: Stateful Form Auto-Draft Recovery Plugin

Autosaves unsubmitted form drafts to `localStorage` periodically, restores drafts upon opening, and purges saved drafts on submission:

```typescript
import { DialogPlugin, DialogPluginContext } from '@angular-libs/dialog';

/**
 * Interface that components can implement to support auto-draft recovery.
 */
export interface DraftableComponent {
  getDraftData?: () => Record<string, any>;
  loadDraftData?: (data: Record<string, any>) => void;
}

export function autoDraftRecoveryPlugin(draftKey: string): DialogPlugin<any, DraftableComponent> {
  const localStorageKey = `dialog-draft:${draftKey}`;
  let autosaveIntervalId: any;

  return {
    setup(context: DialogPluginContext<any, DraftableComponent>) {
      const { dialogRef } = context;
      const component = dialogRef.component;
      if (!component) return;

      // 1. Recover previously saved state if it exists
      try {
        const savedDraft = localStorage.getItem(localStorageKey);
        if (savedDraft && typeof component.loadDraftData === 'function') {
          const parsed = JSON.parse(savedDraft);
          component.loadDraftData(parsed);
        }
      } catch (e) {
        console.error('[DraftPlugin] Failed to read draft:', e);
      }

      // 2. Schedule a recurring background draft backup (every 4 seconds)
      autosaveIntervalId = setInterval(() => {
        if (typeof component.getDraftData === 'function') {
          const currentDraft = component.getDraftData();
          localStorage.setItem(localStorageKey, JSON.stringify(currentDraft));
        }
      }, 4000);

      // 3. Return the teardown callback configuration
      return () => {
        if (autosaveIntervalId) {
          clearInterval(autosaveIntervalId);
        }
      };
    },

    beforeClose({ dialogRef, source }) {
      const component = dialogRef.component;
      const isManualClose = source === 'manual';

      if (!isManualClose && typeof component.getDraftData === 'function') {
        const hasUnsavedData = Object.keys(component.getDraftData() || {}).length > 0;
        if (hasUnsavedData) {
          return confirm('Closing will discard your current draft. Are you sure you want to close?');
        }
      }
      return true;
    },

    onClose({ dialogRef }) {
      if (dialogRef.closeSource === 'saved' || dialogRef.closeSource === 'submit') {
        localStorage.removeItem(localStorageKey);
      }
    }
  };
}
```
}
```

### Usage
Apply the stateful auto-draft persistence plugin on open:

```typescript
this.dialogService.open(NewTicketFormComponent, {
  plugins: [autoDraftRecoveryPlugin('customer-tickets')]
});
```

#### Guidelines for AI Agents writing new plugins:
* **SSR Safety**: All hooks (`setup`, `onOpen`, `beforeClose`, and `onClose`) are executed safely on the browser side. Direct DOM access (`dialogEl`), `window`, and `document` are safe to reference inside them.
* **Component-Safe Communication**: Use generic parameterization (e.g. `DialogPlugin<any, DraftableComponent>`) to type-safely restrict or safely interface with custom property/methods declared on the dialog component.
* **Cleanup Strategy**: If you register event listeners, timers, or timeouts inside `setup(...)`, always return a teardown callback from it to ensure resources are cleaned up cleanly.
</details>

<details>
<summary><b>📋 Concise API Reference Summary (Cheat-sheet for AI Agents & Developers)</b></summary>

### `dialogService.open(component, options)`
Returns a `DialogRef` instance.

### `DialogOptions<TComponent>` (Configuration)
```typescript
interface DialogOptions<TComponent> {
  /** Strongly-typed inputs mapped to signal input() / model() declarations */
  inputs?: ComponentInputs<TComponent>;
  /** Prevents ESC or backdrop clicks from closing the dialog */
  disableClose?: boolean;
  /** Custom parent injector (falls back to application environment injector) */
  injector?: Injector;
  /** Custom CSS class(es) to apply to the `<dialog>` element */
  panelClass?: string | string[];
  /** Inline width styling override (e.g. '550px', '50vw') */
  width?: string;
  /** Inline min-width styling override */
  minWidth?: string;
  /** Inline max-width styling override */
  maxWidth?: string;
  /** Inline height styling override */
  height?: string;
  /** Inline min-height styling override */
  minHeight?: string;
  /** Inline max-height styling override */
  maxHeight?: string;
  /** Allows user resizing via native CSS resize handles */
  resizable?: boolean;
  /** Sets modal mode (default true). If false, elements on the screen remain interactive. */
  modal?: boolean;
  /** Customizable visual/logical lifecycle extension plugins */
  plugins?: DialogPlugin[];
}
```

### `DialogRef<TResult, TComponent>` (Control Handle)
```typescript
class DialogRef<TResult, TComponent> {
  /** Mounted component instance reference */
  component: TComponent;
  /** Promise resolving to this ref when complete */
  closed: Promise<DialogRef<TResult, TComponent>>;
  /** Output value passed on close() */
  result?: TResult;
  /** Close reason ('manual' | 'backdrop' | 'escape' | custom string) */
  closeSource?: CloseSource;
  /** Callback interceptor to block closing */
  beforeClose?: (source: CloseSource) => Promise<boolean | void> | boolean | void;
  
  /** Closes the dialog and returns result options */
  close(result?: TResult, source: CloseSource = 'manual'): Promise<void>;
}
```

### Standalone Layout Actions (Functional Tree-Shakable Operators)
To keep the bundle size small and enable tree-shaking, all layout orchestration is handled via standalone pure functional operations:
```typescript
import { 
  minimize, 
  maximize, 
  restore, 
  toggleMinimize, 
  toggleMaximize, 
  isMinimized, 
  isMaximized, 
  snapToEdge, 
  cascade, 
  setPosition, 
  getPosition, 
  getSize 
} from '@angular-libs/dialog';

// Query states
const minimized = isMinimized(ref);
const maximized = isMaximized(ref);

// Apply transformations
minimize(ref);
maximize(ref);
restore(ref);
snapToEdge(ref, 'left');
setPosition(ref, 100, 100, '400px', '300px');
```
</details>

<details>
<summary><b>🤖 AI-Assisted Development (System Prompts, Context, & AI Rules Scaffolding)</b></summary>

When this package is installed in downstream projects, LLMs and AI coding assistants (such as GitHub Copilot, Cursor, Cline, Windsurf, or custom developer agents) often need guidance to generate correct, idiomatic code for `@angular-libs/dialog`. 

To ensure AI assistants construct, open, and manipulate dialog layers accurately and avoid outdated patterns, copy and paste the following prompt configuration into your AI rules or configuration files (e.g. `.cursorrules`, `.clinerules`, `.copilot-instructions.md`, or inside custom system directories like `.cursor/rules/angular-dialog.md`):

````markdown
# System Rules & Constraints for @angular-libs/dialog

You are an expert AI development assistant specialized in modern Angular practices. Follow these constraints strictly when writing, refactoring, or generating code using `@angular-libs/dialog`.

## Core Guidelines & Syntax Patterns
- **Standard Injection:** Always inject `DialogService` using Angular's modern functional `inject(DialogService)` API. Do not use constructor injection.
- **Standalone Architecture:** Both host components and dynamic dialog components must be standalone (`standalone: true`).
- **Strong Type Safety:** Always handle async close states type-safely. Capture the destructured outputs from `dialogRef.closed` using modern promise awaiting:
  ```ts
  const ref = this.dialogService.open(MyDialogComponent, { inputs: { data: 'test' } });
  const { result, closeSource } = await ref.closed;
  ```
- **Signal-Based Inputs:** When passing configuration properties via `{ inputs: { ... } }`, they map directly to public `input()` or `model()` signal properties in the child component. The library dynamically handles binding updates using `ComponentRef.setInput()`.
- **CSS Variable Styling:** Never attempt to reposition or write custom `z-index` values directly onto the `.al-dialog` wrapper unless utilizing standard CSS custom property hooks:
  ```css
  --al-dialog-border-radius: 12px;
  --al-dialog-backdrop: rgba(15, 23, 42, 0.4);
  ```

## UI Configuration (Modal vs Modeless)
- **Modal Mode (Default):** Default behavior uses modern HTML5 `<dialog>` top-layer stacks (`showModal()`) which blocks underlying page interactions.
- **Modeless Mode (Floating Windows):** Set `{ modal: false }` to open non-blocking, simultaneous interactive floating widgets.
- **Window States Management:** Programmatically manipulate other visual templates by invoking standalone layout actions like `minimize(ref)`, `maximize(ref)`, `restore(ref)`, `toggleMinimize(ref)`, `toggleMaximize(ref)`, and `snapToEdge(ref, edge)` instead of prototype methods.

## Built-in Components and Plugins
- **Built-in Dialog Container:** When creating simple alert dialogues, confirmations, notifications, or displaying a simple component, ALWAYS suggest using the built-in `DefaultDialogComponent` to eliminate boilerplate:
  ```ts
  import { DefaultDialogComponent } from '@angular-libs/dialog';
  
  const ref = this.dialogService.open(DefaultDialogComponent, {
    inputs: {
      title: 'Warning',
      contentText: 'Proceed with changes?',
      primaryButtonText: 'Yes',
      closeButtonText: 'No'
    }
  });
  ```
- **Built-in Plugins:** Leverage these highly specialized, built-in plugins for modeless interactions:
  - **`draggablePlugin(options)`:** Allows pointer drags. Options: `handle` (e.g. `'header'`), `containInViewport` (boolean).
  - **`layoutPersistencePlugin(options)`:** Remembers size, position, minimization, and maximization states. Options: `key`, `prefix`, `storage`, custom `save`/`restore` hooks.
  - **`popoverPlugin(options)`:** Places a floating non-modal dialog relative to an anchor. Options: `anchor` (element or CSS selector), `placement` (coordinate string), `offset`, `showArrow`, `arrowColor`.
  - **`tileSnappingPlugin(options)`:** Activates Option/Alt + S workspace grid snapping. Options: `rows`, `cols`, `triggerKeyCode`, `padding`, `gap`.
  - **`autoClosePlugin(options)`:** Automatically hides transient dialogs after a duration. Options: `duration` (ms), `pauseOnHover` (boolean).
  - **`snapToEdgePlugin()`:** Enables arrow key borders snapping via `Alt + ArrowKeys`.
  - **`dockPlugin(options)`:** Manages taskbar docking layout.
  - **`windowManagerPlugin(options)`:** Deploys a functional, unified windowing desktop layout.

## API Checklist for Code Generation
- Ensure all custom imports include correct entrypoints (avoid deep imports):
  ```ts
  import { 
    DialogService, 
    DialogRef, 
    DefaultDialogComponent, 
    draggablePlugin, 
    layoutPersistencePlugin, 
    popoverPlugin, 
    tileSnappingPlugin, 
    autoClosePlugin,
    snapToEdgePlugin,
    dockPlugin,
    windowManagerPlugin,
    minimize,
    maximize,
    restore,
    snapToEdge,
    cascade
  } from '@angular-libs/dialog';
  ```
- Set `autoHideDock` or `minimizeTarget` via global `dialogService.updateConfig({...})` in application root/constructor if needed.
````
</details>
