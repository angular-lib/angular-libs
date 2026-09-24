import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlDialog,
  DialogParts,
  DialogService,
  DefaultDialogComponent,
  Toaster,
  defineDialog,
  definePlugin,
  injectDialog,
} from '@angular-libs/dialog';

interface DemoUser {
  name: string;
  email: string;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Typed dialog: required `user` input, `DemoUser` result, dirty guard, async save. */
@Component({
  selector: 'app-edit-user-dialog',
  imports: [DialogParts],
  template: `
    <al-dialog-header>
      Edit user
      <p alDialogSubtitle alDialogDescription>Close with unsaved changes to see the guard.</p>
    </al-dialog-header>
    <al-dialog-body>
      <label class="field">
        Name
        <input [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      <label class="field">
        Email
        <input [value]="email()" (input)="email.set($any($event.target).value)" />
      </label>
      <label class="check">
        <input type="checkbox" [checked]="fail()" (change)="fail.set(!fail())" />
        Make the next save fail
      </label>
      @if (save.error()) {
        <p class="al-dialog-error" role="alert">Could not save. Try again.</p>
      }
    </al-dialog-body>
    <al-dialog-footer>
      <button class="al-btn al-btn-secondary" alDialogClose>Cancel</button>
      <button class="al-btn al-btn-primary" [disabled]="save.pending()" (click)="save()">
        {{ save.pending() ? 'Saving…' : 'Save' }}
      </button>
    </al-dialog-footer>
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.875rem; }
    .field input { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    .check { display: flex; gap: 6px; align-items: center; font-size: 0.8125rem; color: #64748b; }
  `,
})
class EditUserDialogComponent {
  readonly user = input.required<DemoUser>();
  readonly dialog = injectDialog<DemoUser>();

  readonly name = linkedSignal(() => this.user().name);
  readonly email = linkedSignal(() => this.user().email);
  readonly fail = signal(false);

  constructor() {
    this.dialog.guard(
      () =>
        !this.dirty() ||
        this.dialog.confirm({
          title: 'Discard changes?',
          confirmText: 'Discard',
          cancelText: 'Keep editing',
          tone: 'danger',
        }),
    );
  }

  readonly save = this.dialog.action(async () => {
    await wait(800);
    if (this.fail()) throw new Error('Simulated failure');
    return { name: this.name(), email: this.email() };
  });

  private dirty(): boolean {
    return this.name() !== this.user().name || this.email() !== this.user().email;
  }
}

const EditUserDialog = defineDialog(EditUserDialogComponent, { size: 'md', sheetBelow: 'sm' });

@Component({
  selector: 'app-dialog-demo',
  standalone: true,
  imports: [CommonModule, AlDialog],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Dialog Playground</h2>
        <p class="description">Default design via <code>DialogService</code> + CSS, or Aria-style <code>alDialog</code> on your markup.</p>
        <button class="btn btn-danger" (click)="closeAll()">Close All</button>
      </div>

      <section class="section">
        <h3 class="section-title">Default design (batteries)</h3>
        <div class="grid">
          <div class="card">
            <h4>Window</h4>
            <p>Modeless with drag, snap, and dock by default.</p>
            <button class="btn btn-success" (click)="openWindow()">Open Window</button>
          </div>
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

      <section class="section">
        <h3 class="section-title">Typed dialogs, async actions &amp; Toaster</h3>
        <div class="grid">
          <div class="card">
            <h4>defineDialog + parts</h4>
            <p><code>await dialog.run(EditUserDialog, {{ '{' }} user {{ '}' }})</code> → typed outcome. Dirty guard, async save, bottom sheet on phones.</p>
            <button class="btn btn-primary" (click)="editUser()">Edit {{ user().name }}</button>
            @if (lastOutcome()) {
              <p class="result">{{ lastOutcome() }}</p>
            }
          </div>
          <div class="card">
            <h4>Async confirm</h4>
            <p><code>confirm({{ '{' }} onConfirm, tone: 'danger' {{ '}' }})</code>: spinner, dismiss blocked, first attempt fails with retry.</p>
            <button class="btn btn-danger" (click)="deleteProject()">Delete project</button>
          </div>
          <div class="card">
            <h4>Toaster</h4>
            <p>Queue, Undo action, promise toast, pause on hover, swipe / Escape to dismiss.</p>
            <div class="row">
              <button class="btn btn-blue" (click)="archive()">Archive</button>
              <button class="btn btn-teal" (click)="sync()">Sync</button>
              <button class="btn btn-secondary" (click)="toaster.error('Connection lost')">Error</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Design system (Aria-style)</h3>
        <div class="grid">
          <div class="card">
            <h4>alDialog</h4>
            <p>Headless directive on <em>your</em> <code>&lt;dialog&gt;</code>. Your CSS only — no <code>core.css</code>.</p>
            <button class="btn btn-primary" type="button" (click)="kitOpen.set(true)">Open kit dialog</button>
          </div>
        </div>
        <dialog
          alDialog
          class="kit-sheet"
          [open]="kitOpen()"
          labelledBy="kit-title"
          describedBy="kit-desc"
          (closed)="kitOpen.set(false)"
        >
          <h2 id="kit-title">Edit user</h2>
          <p id="kit-desc">Your chrome. The lib only handles focus, Escape, and backdrop.</p>
          <form (submit)="$event.preventDefault(); kitOpen.set(false)">
            <label>
              Name
              <input type="text" name="name" value="Ada" />
            </label>
            <div class="kit-actions">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-secondary" (click)="kitOpen.set(false)">Lukk</button>
            </div>
          </form>
        </dialog>
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
    .btn-secondary { background: #e2e8f0; color: #0f172a; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .kit-sheet {
      border: 0;
      padding: 1.5rem;
      width: min(420px, 100%);
      border-radius: 12px;
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff8ef;
      color: #3b2f1a;
      box-shadow: 0 16px 40px rgb(59 47 26 / 18%);
    }
    .kit-sheet::backdrop { background: rgb(59 47 26 / 35%); }
    .kit-sheet h2 { margin: 0 0 0.35rem; font-size: 1.35rem; }
    .kit-sheet p { margin: 0 0 1rem; color: #6b5a3e; }
    .kit-sheet label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; }
    .kit-sheet input { padding: 0.45rem 0.6rem; border: 1px solid #d4c4a8; border-radius: 6px; font: inherit; }
    .kit-actions { display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: flex-end; }
  `],
})
export class DialogDemoComponent {
  private dialog = inject(DialogService);
  protected toaster = inject(Toaster);
  lastConfirm: boolean | null = null;
  kitOpen = signal(false);

  user = signal<DemoUser>({ name: 'Ada Lovelace', email: 'ada@example.com' });
  lastOutcome = signal<string | null>(null);
  private deleteAttempts = 0;

  async editUser(): Promise<void> {
    const outcome = await this.dialog.run(EditUserDialog, { user: this.user() });
    if (outcome.ok) {
      this.user.set(outcome.value);
      this.lastOutcome.set(`Saved: ${outcome.value.name}`);
      this.toaster.success('User saved');
    } else {
      this.lastOutcome.set(`Dismissed (${outcome.reason})`);
    }
  }

  async deleteProject(): Promise<void> {
    this.deleteAttempts = 0;
    const deleted = await this.dialog.confirm({
      title: 'Delete project?',
      message: 'All boards and files are removed. This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
      sheetBelow: 'sm',
      errorText: 'The server did not respond. Try again.',
      onConfirm: async () => {
        await wait(900);
        if (++this.deleteAttempts === 1) throw new Error('Simulated timeout');
      },
    });
    if (deleted) this.toaster.success('Project deleted');
  }

  archive(): void {
    this.toaster.show('Conversation archived', {
      action: { label: 'Undo', onClick: () => this.toaster.show('Restored') },
    });
  }

  sync(): void {
    void this.toaster
      .promise(wait(1500).then(() => 42), {
        loading: 'Syncing…',
        success: (n) => `Synced ${n} items`,
        error: 'Sync failed',
      })
      .catch(() => {});
  }

  closeAll(): void {
    this.dialog.closeAll();
    this.toaster.dismissAll();
    this.kitOpen.set(false);
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
        showFullscreenIcon: true,
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
            }, 1000);
          },
        }),
      ],
    });
  }
}
