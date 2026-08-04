import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ALShortcutService,
  ALShortcutDirective,
  inputSuppressorPlugin,
  chordPlugin,
  contextGuardPlugin,
  rebindPlugin,
  twicePlugin
} from '@angular-libs/shortcut';
import {
  commandPalettePlugin,
  type ALShortcutVisualHintsPlugin,
} from '@angular-libs/shortcut/plugins';

@Component({
  selector: 'app-shortcut-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, ALShortcutDirective],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <div>
          <h2>Keyboard Shortcuts</h2>
          <p class="description">Modular, zoneless shortcut registry with a plugin pipeline.</p>
        </div>
      </div>

      <section class="section">
        <h3 class="section-title">Try it</h3>
        <div class="layout-grid">
          <div class="card">
            <h4>Focus &amp; press</h4>
            <p class="card-desc">Click a box, then press its key combination.</p>

            <div class="shortcut-box"
                 tabindex="0"
                 [alShortcut]="'ctrl+s'"
                 [alShortcutPriority]="10"
                 [alShortcutDescription]="'Saves workspace configurations locally'"
                 (alShortcutTriggered)="onShortcutTriggered('Ctrl + S')">
              <div class="box-content">
                <strong>Save</strong>
                <kbd>Ctrl + S</kbd>
                <span class="box-tip">Only while this box is focused</span>
              </div>
            </div>

            <div class="shortcut-box"
                 tabindex="0"
                 [alShortcut]="'ctrl+i'"
                 [alShortcutPriority]="5"
                 [alShortcutDescription]="'Bypasses suppressor locks to check for system errors'"
                 (alShortcutTriggered)="onShortcutTriggered('Ctrl + I')">
              <div class="box-content">
                <strong>Input bypass</strong>
                <kbd>Ctrl + I</kbd>
                <span class="box-tip">Works even inside text inputs</span>
              </div>
            </div>

            <div class="global-hint">
              <kbd>Ctrl + Alt + Z</kbd> works anywhere on the page
            </div>
          </div>

          <div class="card console-card">
            <div class="log-header">
              <h4>Event console</h4>
              <button class="btn btn-ghost" (click)="clearLogs()">Clear</button>
            </div>
            <p class="card-desc">Live log of intercepted shortcut callbacks.</p>

            <div class="logs-viewport">
              @if (logs().length === 0) {
                <div class="empty-logs">Press a shortcut to see events here</div>
              } @else {
                @for (log of logs(); track log.id) {
                  <div class="log-entry">
                    <span class="log-tag" [ngClass]="getLogClass(log.tag)">{{ log.tag }}</span>
                    <span class="log-msg">{{ log.message }}</span>
                  </div>
                }
              }
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Plugins</h3>
        <div class="plugin-grid">

          <div class="card">
            <span class="badge">command-palette</span>
            <h4>Command palette</h4>
            <p class="card-desc">
              Fuzzy-search all registered actions. Navigate with <kbd>↑</kbd> <kbd>↓</kbd>, run with <kbd>Enter</kbd>.
            </p>
            <button class="btn btn-primary" (click)="commandPalette.open()">
              Open <kbd class="kbd-on-dark">Ctrl + Shift + P</kbd>
            </button>
          </div>

          <div class="card">
            <span class="badge">rebind</span>
            <h4>Key rebinding</h4>
            <p class="card-desc">
              Override shortcuts at runtime. Changes show up in the command palette immediately.
            </p>
            <div class="rebind-settings">
              <label class="rebind-item">
                <span class="rebind-label">Save</span>
                <kbd>Ctrl+S</kbd>
                <span class="arrow">→</span>
                <input
                  type="text"
                  class="rebind-input"
                  [ngModel]="customSaveKey()"
                  (ngModelChange)="onSaveKeyOverride($event)"
                  placeholder="ctrl+shift+y" />
              </label>
              <label class="rebind-item">
                <span class="rebind-label">Global</span>
                <kbd>Ctrl+Alt+Z</kbd>
                <span class="arrow">→</span>
                <input
                  type="text"
                  class="rebind-input"
                  [ngModel]="customGlobalKey()"
                  (ngModelChange)="onGlobalKeyOverride($event)"
                  placeholder="alt+q" />
              </label>
            </div>
            <button class="btn btn-ghost" (click)="resetKeybinds()">Reset defaults</button>
          </div>

          <div class="card">
            <span class="badge">visual-hints</span>
            <h4>Link hints</h4>
            <p class="card-desc">
              Overlay letter badges on clickable targets. Type the letters to click.
            </p>
            <button class="btn btn-primary" (click)="toggleLinkNavigation()">
              Activate <kbd class="kbd-on-dark">Ctrl + G</kbd>
            </button>
          </div>

          <div class="card">
            <span class="badge">chord</span>
            <h4>Key sequences</h4>
            <p class="card-desc">
              Multi-key combos within a short window (resets after 1.5s idle).
            </p>
            <ul class="key-list">
              <li><kbd>G</kbd> <kbd>P</kbd> — Profile</li>
              <li><kbd>G</kbd> <kbd>H</kbd> — Home</li>
              <li><kbd>Ctrl+K</kbd> <kbd>Ctrl+M</kbd> — Mute</li>
            </ul>
          </div>

          <div class="card">
            <span class="badge">context-guard</span>
            <h4>Context whitelist</h4>
            <p class="card-desc">
              When gaming mode is on, only whitelisted keys fire — everything else is blocked.
            </p>
            <label class="toggle-row" [class.active]="isGamingModeActive()">
              <input type="checkbox" [checked]="isGamingModeActive()" (change)="toggleGamingMode()" />
              <span>Gaming mode (WASD)</span>
            </label>
            @if (isGamingModeActive()) {
              <p class="status-note">
                Allowed: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>Esc</kbd>.
                <kbd>Ctrl+Alt+Z</kbd> is blocked.
              </p>
            }
          </div>

          <div class="card">
            <span class="badge">input-suppressor</span>
            <h4>Input suppressor</h4>
            <p class="card-desc">
              Blocks shortcuts while typing, except declared bypasses like <kbd>Ctrl + I</kbd>.
            </p>
            <label class="field-label" for="demo-input">Test field</label>
            <input
              id="demo-input"
              type="text"
              placeholder="Type here, then try Ctrl+S vs Ctrl+I"
              class="form-control" />
          </div>

          <div class="card">
            <span class="badge">twice</span>
            <h4>Double-press</h4>
            <p class="card-desc">
              Fires when a key is tapped twice in quick succession.
            </p>
            <ul class="key-list">
              <li>Double <kbd>Shift</kbd> — Log notification</li>
              <li>Double <kbd>Escape</kbd> — Clear console</li>
            </ul>
          </div>

        </div>
      </section>
    </div>
  `,
  styles: `
    .demo-container {
      padding: 24px;
      font-family: system-ui, sans-serif;
      max-width: 1000px;
      margin: 0 auto;
    }

    .header-section {
      background: linear-gradient(135deg, #1e3a8a, #3b82f6);
      color: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 28px;
    }
    .header-section h2 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 800;
    }
    .header-section .description {
      margin: 6px 0 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.95rem;
    }

    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 1.15rem;
      color: #1e293b;
      margin: 0 0 14px;
      font-weight: 700;
      border-left: 4px solid #3b82f6;
      padding-left: 10px;
    }

    .layout-grid,
    .plugin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 800px) {
      .layout-grid,
      .plugin-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: white;
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card h4 {
      margin: 0;
      font-size: 1.05rem;
      color: #0f172a;
      font-weight: 700;
    }
    .card-desc {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.45;
      flex-grow: 1;
    }

    .badge {
      align-self: flex-start;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    kbd {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      color: #334155;
      display: inline-block;
      font-size: 0.78em;
      font-weight: 600;
      padding: 1px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .kbd-on-dark {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.35);
      color: white;
    }

    .shortcut-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .shortcut-box:hover { border-color: #cbd5e1; background: #f1f5f9; }
    .shortcut-box:focus {
      border-color: #3b82f6;
      background: #eff6ff;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .box-content {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      font-size: 0.9rem;
      color: #334155;
    }
    .box-tip {
      flex-basis: 100%;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .global-hint {
      margin-top: 4px;
      padding: 10px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      color: #166534;
      font-size: 0.85rem;
    }

    .console-card { min-height: 280px; }
    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logs-viewport {
      background: #0f172a;
      border-radius: 6px;
      padding: 12px;
      flex-grow: 1;
      min-height: 200px;
      max-height: 280px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      color: #f8fafc;
    }
    .empty-logs {
      color: #64748b;
      text-align: center;
      padding-top: 72px;
    }
    .log-entry {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid #1e293b;
    }
    .log-tag {
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.7rem;
      color: white;
      align-self: flex-start;
      text-transform: uppercase;
    }
    .log-msg { color: #cbd5e1; }
    .log-success { background: #059669; }
    .log-chord { background: #7c3aed; }
    .log-context { background: #d97706; }
    .log-game { background: #ea580c; }

    .btn {
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-ghost {
      background: transparent;
      color: #64748b;
      border: 1px solid #e2e8f0;
      padding: 6px 12px;
    }
    .btn-ghost:hover { background: #f8fafc; color: #334155; }

    .rebind-settings {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .rebind-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #475569;
    }
    .rebind-label {
      font-weight: 600;
      font-size: 0.75rem;
      color: #64748b;
      width: 48px;
    }
    .arrow { color: #94a3b8; }
    .rebind-input {
      padding: 4px 8px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem;
      width: 120px;
      outline: none;
    }
    .rebind-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    .key-list {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.85rem;
      color: #475569;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .key-list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      user-select: none;
    }
    .toggle-row.active {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .status-note {
      margin: 0;
      font-size: 0.8rem;
      color: #92400e;
      line-height: 1.4;
    }

    .field-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-control {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.9rem;
      box-sizing: border-box;
      outline: none;
    }
    .form-control:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
    }
  `
})
export class ShortcutDemoComponent {
  private readonly shortcutService = inject(ALShortcutService);

  logs = signal<{ id: string; tag: string; message: string }[]>([]);
  private globalUnsub: (() => void) | null = null;

  isGamingModeActive = signal(false);

  customSaveKey = signal('ctrl+s');
  customGlobalKey = signal('ctrl+alt+z');

  readonly chords = this.shortcutService.registerPlugin(chordPlugin({
    timeoutMs: 1500
  }));

  readonly commandPalette = this.shortcutService.registerPlugin(commandPalettePlugin({
    triggerShortcut: 'ctrl+shift+p',
    placeholder: 'Search workspace commands...'
  }));

  readonly contextGuard = this.shortcutService.registerPlugin(contextGuardPlugin());

  readonly rebind = this.shortcutService.registerPlugin(rebindPlugin());

  readonly twice = this.shortcutService.registerPlugin(twicePlugin({
    delayMs: 300
  }));

  constructor() {
    const overrideSave = this.rebind.getOverride('ctrl+s');
    if (overrideSave !== undefined) this.customSaveKey.set(overrideSave);
    const overrideGlobal = this.rebind.getOverride('ctrl+alt+z');
    if (overrideGlobal !== undefined) this.customGlobalKey.set(overrideGlobal);

    this.shortcutService.registerPlugin(inputSuppressorPlugin(['ctrl+i']));

    this.twice.register('shift', () => {
      this.addLog('SUCCESS', 'Tapped [ Shift ] twice: Simple Notification Active.');
    }, { description: 'Launch shift double tap action' });

    this.twice.register('escape', () => {
      this.clearLogs();
      this.addLog('SUCCESS', 'Tapped [ Escape ] twice: Cleared Console Logs!');
    }, { description: 'Clear console logs' });

    this.globalUnsub = this.shortcutService.register({
      shortcut: 'ctrl+alt+z',
      action: () => {
        this.onShortcutTriggered('Ctrl + Alt + Z (Global)');
      },
      description: 'Global system actions demo trigger combo'
    });

    this.chords.register('g p', () => this.addLog('CHORD', 'Navigated to Profile Page (chord: g p)'), { description: 'Go to Profile Page' });
    this.chords.register('g h', () => this.addLog('CHORD', 'Navigated to Home Page (chord: g h)'), { description: 'Go to Home Page' });
    this.chords.register('ctrl+k ctrl+m', () => this.addLog('CHORD', 'Muted notification sounds (chord: ctrl+k ctrl+m)'), { description: 'Toggle Audio Mute' });

    this.shortcutService.register([
      {
        shortcut: 'w',
        action: () => this.addLog('GAME', 'Moved Forward'),
        description: 'Move Forward (Gaming Mode)'
      },
      {
        shortcut: 's',
        action: () => this.addLog('GAME', 'Moved Backward'),
        description: 'Move Backward (Gaming Mode)'
      },
      {
        shortcut: 'a',
        action: () => this.addLog('GAME', 'Moved Left'),
        description: 'Move Left (Gaming Mode)'
      },
      {
        shortcut: 'd',
        action: () => this.addLog('GAME', 'Moved Right'),
        description: 'Move Right (Gaming Mode)'
      }
    ]);

    this.contextGuard.addRule('gaming-mode', {
      type: 'allow',
      shortcuts: ['w', 'a', 's', 'd', 'esc']
    });
  }

  onShortcutTriggered(shortcutName: string) {
    this.addLog('SUCCESS', `Shortcut [ ${shortcutName} ] executed successfully.`);
  }

  onSaveKeyOverride(val: string) {
    this.customSaveKey.set(val);
    this.rebind.setOverride('ctrl+s', val);
    this.addLog('CONTEXT', `Save Content shortcut overridden to: ${val || 'DISABLED'}`);
  }

  onGlobalKeyOverride(val: string) {
    this.customGlobalKey.set(val);
    this.rebind.setOverride('ctrl+alt+z', val);
    this.addLog('CONTEXT', `Global system action overridden to: ${val || 'DISABLED'}`);
  }

  resetKeybinds() {
    this.customSaveKey.set('ctrl+s');
    this.customGlobalKey.set('ctrl+alt+z');
    this.rebind.clearOverrides();
    this.addLog('CONTEXT', 'All custom shortcut overrides reverted to defaults.');
  }

  toggleGamingMode() {
    const active = !this.isGamingModeActive();
    this.isGamingModeActive.set(active);
    this.contextGuard.setContext('gaming-mode', active);
    this.addLog('CONTEXT', `Gaming Mode is now ${active ? 'ACTIVE (only game keys W/A/S/D and Esc allowed!)' : 'INACTIVE (all shortcuts restored)'}`);
  }

  toggleLinkNavigation() {
    const visualHints = this.shortcutService.getPlugin<ALShortcutVisualHintsPlugin>('visual-hints');
    if (visualHints) {
      if (visualHints.isActive()) {
        visualHints.stopHinting();
      } else {
        visualHints.startHinting();
      }
    }
  }

  addLog(tag: string, message: string) {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logs.update((current) => [{ id, tag, message }, ...current]);
  }

  getLogClass(tag: string): string {
    switch (tag.toLowerCase()) {
      case 'success': return 'log-success';
      case 'chord': return 'log-chord';
      case 'context': return 'log-context';
      case 'game': return 'log-game';
      default: return '';
    }
  }

  clearLogs() {
    this.logs.set([]);
  }

  ngOnDestroy() {
    if (this.globalUnsub) this.globalUnsub();
  }
}
