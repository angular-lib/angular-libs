import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DialogService,
  DefaultDialogComponent,
  definePlugin,
} from '@angular-libs/dialog';

@Component({
  selector: 'app-dialog-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Dialog Playground</h2>
        <p class="description">Intent-based API on native HTML5 <code>&lt;dialog&gt;</code>.</p>
        <button class="btn btn-danger" (click)="closeAll()">Close All</button>
      </div>

      <section class="section">
        <h3 class="section-title">Intents</h3>
        <div class="grid">
          <div class="card">
            <h4>Modal</h4>
            <p>Blocking dialog. Confirm/Cancel close with results.</p>
            <button class="btn btn-primary" (click)="openStandardModal()">Open Modal</button>
          </div>
          <div class="card">
            <h4>Confirm</h4>
            <p><code>await dialog.confirm(...)</code> → boolean.</p>
            <button class="btn btn-primary" (click)="openConfirm()">Confirm</button>
            @if (lastConfirm !== null) {
              <p class="result">Result: {{ lastConfirm }}</p>
            }
          </div>
          <div class="card">
            <h4>Window</h4>
            <p>Modeless with drag, snap, and dock by default.</p>
            <button class="btn btn-success" (click)="openWindow()">Open Window</button>
          </div>
          <div class="card">
            <h4>Popover</h4>
            <p>Anchored modeless surface.</p>
            <button class="btn btn-teal" (click)="openPopover($event)">Popover</button>
          </div>
          <div class="card">
            <h4>Toast</h4>
            <p>Auto-closes after a few seconds.</p>
            <button class="btn btn-blue" (click)="openToast()">Toast</button>
          </div>
          <div class="card">
            <h4>Customize</h4>
            <p>Custom plugin via <code>definePlugin</code> + theme tokens.</p>
            <button class="btn btn-purple" (click)="openCustom()">Custom plugin</button>
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
    .card { background: white; border-radius: 8px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
    .card h4 { margin: 8px 0; font-size: 1.05rem; color: #0f172a; }
    .card p { margin: 0 0 16px 0; color: #64748b; font-size: 0.85rem; line-height: 1.4; flex-grow: 1; }
    .result { margin-top: 8px !important; margin-bottom: 0 !important; color: #0f172a !important; font-weight: 600; }
    .btn { padding: 8px 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 0.85rem; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-success { background: #10b981; color: white; }
    .btn-teal { background: #06b6d4; color: white; }
    .btn-purple { background: #8b5cf6; color: white; }
    .btn-blue { background: #2563eb; color: white; }
    .btn-danger { background: #ef4444; color: white; }
  `],
})
export class DialogDemoComponent {
  private dialog = inject(DialogService);
  lastConfirm: boolean | null = null;

  closeAll(): void {
    this.dialog.closeAll();
  }

  openStandardModal(): void {
    this.dialog.open(DefaultDialogComponent, {
      inputs: {
        title: 'Secure Modal',
        contentText: 'Standard blocking modal. Primary and Cancel close with results.',
        primaryButtonText: 'Confirm',
        secondaryButtonText: 'Cancel',
      },
      size: 'md',
    });
  }

  async openConfirm(): Promise<void> {
    this.lastConfirm = await this.dialog.confirm({
      title: 'Discard changes?',
      message: 'This cannot be undone.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
    });
  }

  openWindow(): void {
    this.dialog.window(DefaultDialogComponent, {
      // Unique per open so multiple windows don't share minimize/size/position.
      id: `demo-window-${Date.now()}`,
      inputs: {
        title: 'Floating Window',
        contentText: 'Drag, Alt+S tile snap, Alt+Arrows edge snap, minimize to dock.',
        showMinimizeIcon: true,
        showMaximizeIcon: true,
        closeButtonText: 'Close',
      },
      size: 'md',
      height: '260px',
      resize: true,
    });
  }

  openPopover(event: MouseEvent): void {
    this.dialog.popover(DefaultDialogComponent, {
      anchor: event.currentTarget as HTMLElement,
      placement: 'bottom',
      inputs: {
        title: 'Popover',
        contentText: 'Anchored next to the trigger.',
        showCloseIcon: true,
      },
      width: '280px',
    });
  }

  openToast(): void {
    this.dialog.toast('Saved successfully', { duration: 3000, title: 'Toast' });
  }

  openCustom(): void {
    this.dialog.window(DefaultDialogComponent, {
      inputs: {
        title: 'Custom plugin',
        contentText: 'Border flashes once on open via definePlugin.',
        closeButtonText: 'OK',
      },
      contentClass: 'demo-custom-chrome',
      snap: false,
      dock: false,
      plugins: [
        definePlugin({
          id: 'flash-border',
          onOpen({ element }) {
            element.style.outline = '3px solid #8b5cf6';
            setTimeout(() => {
              element.style.outline = '';
            }, 600);
          },
        }),
      ],
    });
  }
}
