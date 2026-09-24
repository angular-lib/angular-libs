import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import {
  AlDialog,
  DialogParts,
  DialogService,
  PopoverService,
  Toaster,
  injectDialog,
} from '@angular-libs/dialog';
import { AlWindowHeader, WindowService } from '@angular-libs/dialog/window';

interface DemoUser {
  name: string;
  email: string;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A form dialog: typed result, dirty guard, async save with pending / error. */
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
        <input autofocus [value]="name()" (input)="name.set($any($event.target).value)" />
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
      <button class="al-btn al-btn-primary" [disabled]="save.pending()" [attr.aria-busy]="save.pending() || null" (click)="save()">
        Save
      </button>
    </al-dialog-footer>
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.875rem; }
    .field input { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    .check { display: flex; gap: 6px; align-items: center; font-size: 0.8125rem; }
  `,
})
class EditUserDialog {
  readonly user = input.required<DemoUser>();
  readonly dialog = injectDialog<DemoUser>();

  readonly name = linkedSignal(() => this.user().name);
  readonly email = linkedSignal(() => this.user().email);
  readonly fail = signal(false);

  constructor() {
    this.dialog.guard(
      () =>
        !this.dirty() ||
        this.dialog.confirm({ title: 'Discard changes?', confirmText: 'Discard', cancelText: 'Keep editing', tone: 'danger' }),
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

/** Popover content: returns the picked item. */
@Component({
  selector: 'app-menu',
  imports: [DialogParts],
  template: `
    <div class="menu">
      @for (item of items(); track item) {
        <button [alDialogClose]="item">{{ item }}</button>
      }
    </div>
  `,
  styles: `
    .menu { display: flex; flex-direction: column; padding: 4px; }
    .menu button { padding: 8px 12px; border: 0; border-radius: 6px; background: none; text-align: start; font: inherit; color: inherit; cursor: pointer; }
    .menu button:hover, .menu button:focus-visible { background: var(--al-dialog-secondary); }
  `,
})
class MenuPopover {
  readonly items = input.required<string[]>();
  readonly dialog = injectDialog<string>();
}

/** A window: drag, dock, snap (Alt+Arrow), tiles (Alt+S), fullscreen. */
@Component({
  selector: 'app-notes-window',
  imports: [AlWindowHeader],
  template: `
    <al-window-header>{{ title() }}</al-window-header>
    <div class="notes">
      <p>Drag the title bar, resize from the corner, Alt+Arrow to snap, Alt+S for the tile grid.</p>
      <textarea placeholder="Notes…"></textarea>
    </div>
  `,
  styles: `
    .notes { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; padding: 16px; }
    .notes p { margin: 0; font-size: 0.875rem; color: var(--al-dialog-muted); }
    .notes textarea { flex: 1; min-height: 80px; padding: 8px; border: var(--al-dialog-border); border-radius: 6px; font: inherit; background: none; color: inherit; }
  `,
})
class NotesWindow {
  readonly title = input('Notes');
}

@Component({
  selector: 'app-dialog-demo',
  imports: [AlDialog, DialogParts],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <div>
          <h2>Dialog Playground</h2>
          <p class="description">Native <code>&lt;dialog&gt;</code>, Popover API and CSS anchor positioning.</p>
        </div>
        <button class="btn btn-danger" (click)="closeAll()">Close all</button>
      </div>

      <section class="section">
        <h3 class="section-title">Dialogs</h3>
        <div class="grid">
          <div class="card">
            <h4>Form dialog</h4>
            <p><code>await dialog.open(EditUser, {{ '{' }} user {{ '}' }}).closed</code> — dirty guard, async save, bottom sheet on phones.</p>
            <button class="btn btn-primary" (click)="editUser()">Edit {{ user().name }}</button>
            @if (lastOutcome()) {
              <p class="result">{{ lastOutcome() }}</p>
            }
          </div>
          <div class="card">
            <h4>Async confirm</h4>
            <p><code>confirm({{ '{' }} onConfirm, tone: 'danger' {{ '}' }})</code> — spinner, dismiss blocked, the first attempt fails.</p>
            <button class="btn btn-danger" (click)="deleteProject()">Delete project</button>
          </div>
          <div class="card">
            <h4>Alert</h4>
            <p><code>await dialog.alert(…)</code></p>
            <button class="btn btn-secondary" (click)="dialog.alert({ title: 'Heads up', message: 'Maintenance tonight at 22:00.' })">Show alert</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Popover &amp; Toaster</h3>
        <div class="grid">
          <div class="card">
            <h4>Popover</h4>
            <p>Anchored with CSS anchor positioning, flips at edges, light dismiss.</p>
            <button class="btn btn-teal" (click)="openMenu($event)">Sort by: {{ sort() }}</button>
          </div>
          <div class="card">
            <h4>Toaster</h4>
            <p>Queue, Undo, promise toast, pause on hover, Escape to dismiss.</p>
            <div class="row">
              <button class="btn btn-blue" (click)="archive()">Archive</button>
              <button class="btn btn-teal" (click)="sync()">Sync</button>
              <button class="btn btn-secondary" (click)="toaster.error('Connection lost')">Error</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Windows (<code>@angular-libs/dialog/window</code>)</h3>
        <div class="grid">
          <div class="card">
            <h4>Window</h4>
            <p>Drag, resize, minimize to the dock, maximize, snap, tile grid, fullscreen.</p>
            <button class="btn btn-success" (click)="openWindow()">Open window</button>
          </div>
          <div class="card">
            <h4>Remembered window</h4>
            <p>One per id; position, size and mode survive a reload.</p>
            <button class="btn btn-purple" (click)="openPinned()">Open “Scratchpad”</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Headless (<code>alDialog</code>)</h3>
        <div class="grid">
          <div class="card">
            <h4>Your markup</h4>
            <p>Behavior only on your <code>&lt;dialog&gt;</code>; the parts work here too.</p>
            <button class="btn btn-primary" type="button" (click)="kitOpen.set(true)">Open kit dialog</button>
          </div>
        </div>
        <dialog alDialog class="kit-sheet" [open]="kitOpen()" (closed)="kitOpen.set(false)">
          <h2 alDialogTitle>Edit user</h2>
          <p alDialogDescription>Your chrome. The lib only handles Escape, backdrop, focus and scroll.</p>
          <div class="kit-actions">
            <button class="btn btn-secondary" alDialogClose>Close</button>
          </div>
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
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { padding: 8px 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 0.85rem; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-success { background: #10b981; color: white; }
    .btn-teal { background: #06b6d4; color: white; }
    .btn-purple { background: #8b5cf6; color: white; }
    .btn-blue { background: #2563eb; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-secondary { background: #e2e8f0; color: #0f172a; }
    .kit-sheet { border: 0; padding: 1.5rem; width: min(420px, 100%); border-radius: 12px; font-family: Georgia, 'Times New Roman', serif; background: #fff8ef; color: #3b2f1a; box-shadow: 0 16px 40px rgb(59 47 26 / 18%); }
    .kit-sheet::backdrop { background: rgb(59 47 26 / 35%); }
    .kit-sheet h2 { margin: 0 0 0.35rem; font-size: 1.35rem; }
    .kit-sheet p { margin: 0 0 1rem; color: #6b5a3e; }
    .kit-actions { display: flex; justify-content: flex-end; }
  `],
})
export class DialogDemoComponent {
  protected readonly dialog = inject(DialogService);
  protected readonly toaster = inject(Toaster);
  private readonly popover = inject(PopoverService);
  private readonly windows = inject(WindowService);

  readonly kitOpen = signal(false);
  readonly user = signal<DemoUser>({ name: 'Ada Lovelace', email: 'ada@example.com' });
  readonly lastOutcome = signal<string | null>(null);
  readonly sort = signal('Newest');
  private windowCount = 0;

  async editUser(): Promise<void> {
    const outcome = await this.dialog.open(EditUserDialog, { user: this.user() }, { mobile: 'sheet' }).closed;
    if (outcome.ok) {
      this.user.set(outcome.value);
      this.lastOutcome.set(`Saved: ${outcome.value.name}`);
      this.toaster.success('User saved');
    } else {
      this.lastOutcome.set(`Dismissed (${outcome.source})`);
    }
  }

  async deleteProject(): Promise<void> {
    let attempts = 0;
    const deleted = await this.dialog.confirm({
      title: 'Delete project?',
      message: 'All boards and files are removed. This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
      mobile: 'sheet',
      errorText: 'The server did not respond. Try again.',
      onConfirm: async () => {
        await wait(900);
        if (++attempts === 1) throw new Error('Simulated timeout');
      },
    });
    if (deleted) this.toaster.success('Project deleted');
  }

  async openMenu(event: MouseEvent): Promise<void> {
    const anchor = event.currentTarget as HTMLElement;
    const picked = await this.popover.open(anchor, MenuPopover, { items: ['Newest', 'Oldest', 'Name', 'Size'] }, { placement: 'bottom-start' }).closed;
    if (picked.ok) this.sort.set(picked.value);
  }

  archive(): void {
    this.toaster.show('Conversation archived', { action: { label: 'Undo', onClick: () => this.toaster.show('Restored') } });
  }

  sync(): void {
    void this.toaster
      .promise(wait(1500).then(() => 42), { loading: 'Syncing…', success: (n) => `Synced ${n} items`, error: 'Sync failed' })
      .catch(() => {});
  }

  openWindow(): void {
    this.windows.open(NotesWindow, { title: `Notes ${++this.windowCount}` }, { width: 420, height: 300 });
  }

  openPinned(): void {
    this.windows.open(NotesWindow, { title: 'Scratchpad' }, { id: 'scratchpad', persist: true, width: 360, height: 260 });
  }

  closeAll(): void {
    this.dialog.closeAll();
    this.toaster.dismissAll();
    this.kitOpen.set(false);
  }
}
