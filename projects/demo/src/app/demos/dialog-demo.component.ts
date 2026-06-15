import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DialogService,
  DefaultDialogComponent,
  draggablePlugin,
  tileSnappingPlugin,
  layoutPersistencePlugin,
  autoClosePlugin,
  popoverPlugin,
  dockPlugin,
  windowManagerPlugin,
  snapToEdgePlugin,
} from '@angular-libs/dialog';

@Component({
  selector: 'app-dialog-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Dialog Playground ▢</h2>
        <p class="description">Native HTML5 <code>&lt;dialog&gt;</code> with plugin support.</p>
        <button class="btn btn-danger" (click)="closeAll()">Close All Dialogs</button>
      </div>

      <!-- MAIN FEATURES -->
      <section class="section">
        <h3 class="section-title">Core Library Features</h3>
        <div class="grid">
          <div class="card">
            <h4>📁 Standard Modal</h4>
            <p>Blocking dialog with background overlay. Intercepts ESC key to dismiss.</p>
            <button class="btn btn-primary" (click)="openStandardModal()">Open Modal</button>
          </div>

          <div class="card">
            <h4>📑 Modeless Dialog</h4>
            <p>Non-blocking floating panel. Clicking brings it to the front of the stack.</p>
            <button class="btn btn-success" (click)="openModeless()">Open Modeless</button>
          </div>

          <div class="card">
            <h4>↔️ Resizable & Native</h4>
            <p>Supports native dragging resize with size bounds constraints.</p>
            <button class="btn btn-primary" (click)="openResizable()">Open Resizable</button>
          </div>
        </div>
      </section>

      <!-- PLUGINS PIPELINE -->
      <section class="section">
        <h3 class="section-title">Plugins</h3>
        <div class="grid">
          <div class="card">
            <span class="badge badge-teal">draggable</span>
            <h4>Pointer Drag & Snap</h4>
            <p>Drag the panel around. Press <code>Alt + S</code> to open the grid snapping overlay, or press <code>Alt + Arrow Keys</code> to snap to borders.</p>
            <button class="btn btn-teal" (click)="openAltSnapping()">Drag & Snap</button>
          </div>

          <div class="card">
            <span class="badge badge-purple">persistence</span>
            <h4>State Memory Cache</h4>
            <p>Caches positions, sizes, and maximized states inside LocalStorage.</p>
            <button class="btn btn-purple" (click)="openPersistState()">Persistent State</button>
          </div>

          <div class="card">
            <span class="badge badge-blue">auto-close</span>
            <h4>Timed Auto-Close</h4>
            <p>Toasts notice closing in 4s. Hovering pauses the countdown timer.</p>
            <button class="btn btn-blue" (click)="openAutoClose()">Auto-Close Dialog</button>
          </div>

          <div class="card">
            <span class="badge badge-teal">popover</span>
            <h4>Anchored Popover</h4>
            <p>Overlay dialog that anchors correctly adjacent to the originating clicked element.</p>
            <button class="btn btn-teal" (click)="openPopover($event)">Popover Below Me</button>
          </div>

          <div class="card">
            <span class="badge badge-orange">dock</span>
            <h4>Desktop Tasks Dock</h4>
            <p>Minimizes panel into a glass taskbar dock at the bottom of the screen.</p>
            <button class="btn btn-orange" (click)="openDockable()">Dockable Window</button>
          </div>

          <div class="card">
            <span class="badge badge-blue">window-manager</span>
            <h4>All-In-One Composite</h4>
            <p>Unifies dragging boundaries, alt guiding grids, and bottom taskbars.</p>
            <button class="btn btn-blue" (click)="openWindowManager()">Complete Window</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .demo-container { padding: 24px; font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; }
    .header-section { background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 24px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .header-section h2 { margin: 0; font-size: 1.8rem; font-weight: 800; }
    .header-section .description { margin: 4px 0 0 0; color: rgba(255,255,255,0.9); font-size: 1rem; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 1.3rem; color: #1e293b; margin-bottom: 16px; font-weight: 700; border-left: 4px solid #3b82f6; padding-left: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .card { background: white; border-radius: 8px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; display: flex; flex-direction: column; position: relative; }
    .card h4 { margin: 8px 0; font-size: 1.05rem; color: #0f172a; }
    .card p { margin: 0 0 16px 0; color: #64748b; font-size: 0.85rem; line-height: 1.4; flex-grow: 1; }
    .badge { font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; align-self: flex-start; }
    .badge-teal { background: #e0f2fe; color: #0369a1; }
    .badge-orange { background: #ffedd5; color: #c2410c; }
    .badge-purple { background: #f3e8ff; color: #7e22ce; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .btn { padding: 8px 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: background 0.2s; text-align: center; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-teal { background: #06b6d4; color: white; }
    .btn-teal:hover { background: #0891b2; }
    .btn-orange { background: #f97316; color: white; }
    .btn-orange:hover { background: #ea580c; }
    .btn-purple { background: #8b5cf6; color: white; }
    .btn-purple:hover { background: #7c3aed; }
    .btn-blue { background: #2563eb; color: white; }
    .btn-blue:hover { background: #1d4ed8; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
  `]
})
export class DialogDemoComponent {
  private dialog = inject(DialogService);

  openStandardModal(): void {
    this.dialog.open(DefaultDialogComponent, {
      inputs: {
        title: '🔒 Secure Modal',
        contentText: 'Standard blocking browser modal. Backdrops disable clicks and ESC dismisses cleanly.',
        primaryButtonText: 'Confirm',
        secondaryButtonText: 'Cancel'
      },
      width: '400px'
    });
  }

  openModeless(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      inputs: {
        title: '⚡ Modeless Window',
        contentText: 'Interactive panel. Clicking any window layered behind brings it straight to the front.',
        closeButtonText: 'OK'
      },
      width: '380px',
      plugins: [draggablePlugin()]
    });
  }

  openResizable(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      resizable: true,
      inputs: {
        title: '↔️ Resizable Frame',
        contentText: 'Drag side boundaries or corners to resize this element dynamically.',
        showMaximizeIcon: true,
        showFullscreenIcon: true
      },
      width: '360px',
      height: '300px',
      plugins: [draggablePlugin()]
    });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  openAltSnapping(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      inputs: {
        title: '⌥ Keyboard Snapping',
        contentText: 'Hold the Alt/Option key + Arrow Keys to snap to any border half. Or press Alt/Option + S on the keyboard to trigger the grid tiles snapping overlay!',
      },
      width: '360px',
      plugins: [draggablePlugin(), tileSnappingPlugin({ triggerKeyCode: 'KeyS' }), snapToEdgePlugin()]
    });
  }

  openPersistState(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      resizable: true,
      inputs: {
        title: '💾 Persistent State',
        contentText: 'Rearrange and resize this panel, then close and reopen. Location bounds persist in local storage!',
        showMaximizeIcon: true
      },
      width: '380px',
      height: '240px',
      plugins: [draggablePlugin(), layoutPersistencePlugin({ key: 'persistent-demo-dialog' })]
    });
  }

  openAutoClose(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      inputs: {
        title: '⏱️ Toast Auto-Close',
        contentText: 'Closes in 4 seconds. Hover details pause the countdown timer instantly.'
      },
      width: '340px',
      plugins: [autoClosePlugin({ duration: 4000, pauseOnHover: true })]
    });
  }

  openPopover(event: MouseEvent): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      inputs: {
        title: '💭 Popover Card',
        contentText: 'Positions cleanly next to the triggering clicked element.',
      },
      width: '300px',
      plugins: [popoverPlugin({ anchor: event.currentTarget as HTMLElement, placement: 'bottom', showArrow: true })]
    });
  }

  openDockable(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      inputs: {
        title: '📥 Dockable App',
        contentText: 'Click minimize (-) to hide it into the translucent tray bar. Reopen by clicking the dock tab!',
        showMinimizeIcon: true
      },
      width: '360px',
      plugins: [draggablePlugin(), dockPlugin()]
    });
  }

  openWindowManager(): void {
    this.dialog.open(DefaultDialogComponent, {
      modal: false,
      resizable: true,
      inputs: {
        title: '👑 Consolidated App',
        contentText: 'Combines snap grids, drag bounds, and bottom docking into one core pipeline.',
        showMinimizeIcon: true,
        showMaximizeIcon: true
      },
      width: '420px',
      height: '260px',
      plugins: [windowManagerPlugin()]
    });
  }
}


