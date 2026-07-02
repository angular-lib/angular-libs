import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ALShortcutService,
  ALShortcutDirective,
  inputSuppressorPlugin,
  chordPlugin,
  commandPalettePlugin,
  contextGuardPlugin,
  rebindPlugin,
  twicePlugin
} from '@angular-libs/shortcut';

@Component({
  selector: 'app-shortcut-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, ALShortcutDirective],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Keyboard Shortcuts Playground ⌨️</h2>
        <p class="description">A high-performance, modular, zoneless shortcut registry with dynamic plugin pipelines.</p>
      </div>

      <!-- SECTION 1: CORE REGISTRATION -->
      <section class="section mb-6">
        <h3 class="section-title">⚡ Simple Key Shortcuts (Core)</h3>
        <div class="layout-grid">
          <!-- SHORTCUTS PANEL -->
          <div class="column">
            <div class="widget-card h-100">
              <h3>🎨 Click & Press to Test</h3>
              <p class="sub-caption">Click a box to focus, then press its key combination.</p>

              <!-- DIRECTIVE ATTACHMENT BOX -->
              <div class="shortcut-box" 
                   tabindex="0"
                   [alShortcut]="'ctrl+s'" 
                   [alShortcutPriority]="10"
                   [alShortcutDescription]="'Saves workspace configurations locally'"
                   (alShortcutTriggered)="onShortcutTriggered('Ctrl + S')">
                <span class="box-icon">💾</span>
                <div class="box-content">
                  <strong>Save Action</strong> (<kbd>Ctrl + S</kbd>)
                  <p class="box-tip">Only triggers while this box has blue focus border.</p>
                </div>
              </div>
              
              <div class="shortcut-box" 
                   tabindex="0"
                   [alShortcut]="'ctrl+i'" 
                   [alShortcutPriority]="5"
                   [alShortcutDescription]="'Bypasses suppressor locks to check for system errors'"
                   (alShortcutTriggered)="onShortcutTriggered('Ctrl + I')">
                <span class="box-icon">⚡</span>
                <div class="box-content">
                  <strong>Input Exception Bypass</strong> (<kbd>Ctrl + I</kbd>)
                  <p class="box-tip">Bypasses the "Input Suppressor" rule even inside text inputs.</p>
                </div>
              </div>

              <div class="global-info-box mt-4">
                <span class="info-badge">Global Shortcut</span>
                Press <kbd>Ctrl + Alt + Z</kbd> anywhere on the page to trigger!
              </div>
            </div>
          </div>

          <!-- CONSOLE PANEL -->
          <div class="column">
            <div class="widget-card flex-column h-100">
              <div class="log-header">
                <h3>📜 Keyboard Event Console</h3>
                <button class="btn btn-outline-danger btn-sm" (click)="clearLogs()">Clear</button>
              </div>
              <p class="sub-caption">Real-time logger showing active shortcut interception callbacks.</p>
              
              <div class="logs-viewport">
                @if (logs().length === 0) {
                  <div class="empty-logs">Try pressing shortcuts or buttons to log events...</div>
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
        </div>
      </section>

      <!-- SECTION 2: PLUGINS PIPELINES -->
      <section class="section mb-6">
        <h3 class="section-title">⚙️ Advanced Custom Plugins</h3>
        <div class="plugin-grid">

          <!-- COMMAND PALETTE PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-rose">command-palette</span>
              <h4>🔍 Universal Command Palette</h4>
            </div>
            <p class="plugin-desc">
              Launches an interactive fuzzy-search query list overlay registering all available workspace actions. Navigate using <kbd>↑</kbd> and <kbd>↓</kbd> arrows and press <kbd>Enter</kbd> to execute!
            </p>

            <div class="mt-4">
              <button class="btn btn-rose w-100 py-2 clickable" (click)="commandPalette.open()">
                Open Command Palette (Press <kbd>Ctrl + Shift + P</kbd>)
              </button>
            </div>
          </div>

          <!-- REBIND PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-purple" style="background-color: #f5f3ff; color: #7c3aed;">rebind</span>
              <h4>🔒 Dynamic Keybinder Overrides</h4>
            </div>
            <p class="plugin-desc">
              Redefines default library shortcuts dynamically. Changes are immediately updated globally and automatically reflected inside the Command Palette tool!
            </p>

            <div class="rebind-settings">
              <div class="rebind-item">
                <span class="rebind-label">Save Action:</span>
                <kbd>Ctrl+S</kbd> &rarr;
                <input 
                  type="text" 
                  class="rebind-input"
                  [ngModel]="customSaveKey()" 
                  (ngModelChange)="onSaveKeyOverride($event)"
                  placeholder="e.g. ctrl+shift+y" />
              </div>
              <div class="rebind-item">
                <span class="rebind-label">Global Action:</span>
                <kbd>Ctrl+Alt+Z</kbd> &rarr;
                <input 
                  type="text" 
                  class="rebind-input"
                  [ngModel]="customGlobalKey()" 
                  (ngModelChange)="onGlobalKeyOverride($event)"
                  placeholder="e.g. alt+q" />
              </div>
            </div>
            
            <div class="mt-4">
              <button class="btn btn-outline-danger w-100 py-1" (click)="resetKeybinds()">
                Reset Defaults
              </button>
            </div>
          </div>

          <!-- VISUAL HINTS PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-sky">visual-hints</span>
              <h4>🎯 Vimium Link Hints Mode</h4>
            </div>
            <p class="plugin-desc">
              Overlays unique single-character or double-character navigation badges over every clickable target in the viewport. Type matching letters to click instantly!
            </p>

            <div class="mt-4">
              <button class="btn btn-sky w-100 py-2 clickable" (click)="toggleLinkNavigation()">
                Activate Link Hints (Press <kbd>Ctrl + G</kbd>)
              </button>
            </div>
          </div>

          <!-- CHORD PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-purple">chord</span>
              <h4>🎹 Sequence Keys</h4>
            </div>
            <p class="plugin-desc">
              Allows defining Vim-like or VS-Code-like multi-key sequence combinations shortly after each other. Try the live sequences registered below!
            </p>
            
            <div class="chord-list-wrapper">
              <ul class="chord-list">
                <li><kbd>G</kbd> then <kbd>P</kbd> &rarr; Navigate to Profile</li>
                <li><kbd>G</kbd> then <kbd>H</kbd> &rarr; Navigate to Home</li>
                <li><kbd>Ctrl+K</kbd> then <kbd>Ctrl+M</kbd> &rarr; Toggle Audio Mute</li>
              </ul>
            </div>
            <p class="field-help mt-2">History logs resets after 1.5s of keyboard inactivity.</p>
          </div>

          <!-- CONTEXT GUARD PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-amber">context-guard</span>
              <h4>🎮 Context Scope & Whitelists</h4>
            </div>
            <p class="plugin-desc">
              Dynamically controls/toggles shortcut eligibility states based on app contexts (e.g. Gaming). When active, <strong>ALL</strong> non-gaming shortcuts are suppressed safely!
            </p>

            <div class="gaming-mode-box" [ngClass]="isGamingModeActive() ? 'gaming-active' : 'gaming-inactive'">
              <label class="gaming-label">
                <input type="checkbox" [checked]="isGamingModeActive()" (change)="toggleGamingMode()" />
                🎮 Enable Retro WASD Gaming Mode
              </label>
              @if (isGamingModeActive()) {
                <div class="gaming-status gaming-status-active">
                  🔥 Custom keys whitelisted: <kbd>W</kbd>, <kbd>A</kbd>, <kbd>S</kbd>, <kbd>D</kbd> and <kbd>Esc</kbd>. Global shortcut <kbd>Ctrl+Alt+Z</kbd> is now BLOCKED! Try it out!
                </div>
              } @else {
                <div class="gaming-status gaming-status-inactive">
                  Enable mode to test gaming whitelist restriction pipeline rules.
                </div>
              }
            </div>
          </div>

          <!-- INPUT SUPPRESSOR PLUGIN -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-indigo">input-suppressor</span>
              <h4>🚫 Input Conflict Suppressor</h4>
            </div>
            <p class="plugin-desc">
              Stops shortcut execution when typing inside text inputs, textareas, or text-editable nodes. Combos are suppressed while active, except for declared bypass keys like <kbd>Ctrl + I</kbd>.
            </p>

            <div class="form-group mt-3">
              <label for="demo-input">Interactive Test Field:</label>
              <input 
                id="demo-input"
                type="text" 
                placeholder="Type here..."
                class="form-control" />
              <p class="field-help">Try typing inside here & pressing <kbd>Ctrl + S</kbd> (Suppressed) vs <kbd>Ctrl + I</kbd> (Allowed!).</p>
            </div>
          </div>

          <!-- TWICE DOUBLE PRESS PLUGIN (NEW!) -->
          <div class="plugin-card">
            <div class="plugin-card-header">
              <span class="badge badge-teal">twice</span>
              <h4>⚡ Rapid Double-Press Action</h4>
            </div>
            <p class="plugin-desc">
              Executes callback events immediately when single keys are tapped twice rapidly in succession (e.g. double-tapping Shift or Escape).
            </p>

            <div class="chord-list-wrapper">
              <ul class="chord-list">
                <li>Double <kbd>Shift</kbd> &rarr; Log standard notification</li>
                <li>Double <kbd>Escape</kbd> &rarr; Clear console logs quickly</li>
              </ul>
            </div>
            <div class="mt-4">
              <p class="field-help type-badge-desc">Trigger standard keyboard keyups globally to test.</p>
            </div>
          </div>

        </div>
      </section>
    </div>
  `,
  styles: `
    .demo-container { padding: 24px; font-family: system-ui, -apple-system, sans-serif; max-width: 1100px; margin: 0 auto; }
    .header-section { background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 24px; border-radius: 12px; margin-bottom: 32px; }
    .header-section h2 { margin: 0; font-size: 1.8rem; font-weight: 800; }
    .header-section .description { margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 0.95rem; }
    
    .section { margin-bottom: 36px; }
    .section-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 20px; }

    .layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 800px) { .layout-grid { grid-template-columns: 1fr; } }
    
    .widget-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
    .widget-card h3 { margin: 0; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    .sub-caption { margin: 4px 0 16px 0; color: #64748b; font-size: 0.85rem; }
    
    .shortcut-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; outline: none; transition: all 0.2s ease; }
    .shortcut-box:hover { background: #f1f5f9; border-color: #94a3b8; }
    .shortcut-box:focus { border-color: #3b82f6; border-style: solid; background: #eff6ff; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
    .box-icon { font-size: 1.5rem; }
    .box-content { font-size: 0.9rem; color: #334155; line-height: 1.4; }
    .box-tip { font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0; }
    kbd { background-color: #e2e8f0; border-radius: 4px; border: 1px solid #cbd5e1; color: #1e293b; display: inline-block; font-size: .85em; font-weight: 700; padding: 2px 5px; box-shadow: 0 1px 0 rgba(0,0,0,0.1); }

    .form-group { margin-top: 16px; }
    .form-group label { display: block; color: #475569; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; outline: none; transition: border 0.15s ease-in-out; }
    .form-control:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
    .field-help { font-size: 0.8rem; color: #64748b; margin: 6px 0 0 0; line-height: 1.4; }
    
    .btn { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: bold; font-size: 0.85rem; background: white; color: #334155; cursor: pointer; transition: all 0.2s ease; }
    .btn-outline-danger { border-color: #fca5a5; color: #dc2626; }
    .btn-outline-danger:hover { background: #fef2f2; border-color: #ef4444; }
    .btn-teal { background: #0d9488; color: white; border: none; }
    .btn-teal:hover { background: #0f766e; }
    .btn-rose { background: #e11d48; color: white; border: none; }
    .btn-rose:hover { background: #be123c; }
    .btn-sky { background: #0284c7; color: white; border: none; }
    .btn-sky:hover { background: #0369a1; }
    .w-100 { width: 100%; }
    .py-2 { padding-top: 10px; padding-bottom: 10px; }
    
    .global-info-box { padding: 14px; background: #ecfdf5; border: 1px solid #a3f7bf; border-radius: 8px; color: #065f46; font-size: 0.85rem; line-height: 1.5; }
    .info-badge { background: #059669; color: white; font-weight: bold; font-size: 0.7rem; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-right: 6px; }

    .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .logs-viewport { background: #0f172a; border-radius: 8px; padding: 14px; flex-grow: 1; min-height: 250px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; color: #f8fafc; border: 1px solid #1e293b; }
    .empty-logs { color: #64748b; text-align: center; padding-top: 90px; }
    .log-entry { margin-bottom: 8px; display: flex; gap: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .log-tag { font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: white; align-self: flex-start; }
    .log-msg { color: #e2e8f0; }

    /* Log Tags styles */
    .log-success { background: #10b981; }
    .log-chord { background: #8b5cf6; }
    .log-context { background: #f59e0b; }
    .log-game { background: #d97706; }

    /* PLUGIN PIPELINES GRID */
    .plugin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 800px) { .plugin-grid { grid-template-columns: 1fr; } }
    .plugin-card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; }
    .plugin-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .plugin-card-header h4 { margin: 0; color: #1e293b; font-size: 1.1rem; font-weight: 700; }
    .plugin-desc { font-size: 0.9rem; color: #475569; line-height: 1.5; margin: 0 0 10px 0; }
    .badge { padding: 4px 8px; border-radius: 5px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .badge-indigo { background: #e0e7ff; color: #4338ca; }
    .badge-teal { background: #ccfbf1; color: #0f766e; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-sky { background: #e0f2fe; color: #0369a1; }

    .chord-list { margin: 8px 0; padding-left: 20px; font-size: 0.85rem; color: #475569; }
    .chord-list li { margin-bottom: 6px; }

    /* Custom Non-Tailwind Styles to replace helper utilities cleanly */
    .rebind-settings { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; font-size: 0.85rem; color: #475569; }
    .rebind-item { display: flex; align-items: center; gap: 8px; }
    .rebind-label { font-weight: 500; font-size: 0.75rem; color: #64748b; width: 96px; }
    .rebind-input { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 0.75rem; width: 112px; text-align: center; outline: none; }
    .rebind-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
    
    .chord-list-wrapper { margin-top: 8px; font-size: 0.85rem; color: #475569; }
    .type-badge-desc { font-size: 0.75rem; color: #94a3b8; }

    .gaming-mode-box { margin-top: 8px; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .gaming-mode-box.gaming-active { background: #fffbeb; border-color: #fde68a; }
    .gaming-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; user-select: none; font-size: 0.85rem; color: #334155; }
    .gaming-status { margin-top: 8px; font-size: 0.75rem; }
    .gaming-status-active { color: #b45309; font-weight: 500; }
    .gaming-status-inactive { color: #64748b; }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
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

  // Register plugins dynamically
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
    // Load overrides from storage if existing
    const overrideSave = this.rebind.getOverride('ctrl+s');
    if (overrideSave !== undefined) this.customSaveKey.set(overrideSave);
    const overrideGlobal = this.rebind.getOverride('ctrl+alt+z');
    if (overrideGlobal !== undefined) this.customGlobalKey.set(overrideGlobal);

    // Register standard ignore-inputs plugin
    this.shortcutService.registerPlugin(inputSuppressorPlugin(['ctrl+i']));

    // Register twice action keys
    this.twice.register('shift', () => {
      this.addLog('SUCCESS', 'Tapped [ Shift ] twice: Simple Notification Active.');
    }, { description: 'Launch shift double tap action' });

    this.twice.register('escape', () => {
      this.clearLogs();
      this.addLog('SUCCESS', 'Tapped [ Escape ] twice: Cleared Console Logs!');
    }, { description: 'Clear console logs' });

    // Register simple programmatic Global Shortcut
    this.globalUnsub = this.shortcutService.register({
      shortcut: 'ctrl+alt+z',
      action: () => {
        this.onShortcutTriggered('Ctrl + Alt + Z (Global)');
      },
      description: 'Global system actions demo trigger combo'
    });

    // Register Chords
    this.chords.register('g p', () => this.addLog('CHORD', 'Navigated to Profile Page (chord: g p)'), { description: 'Go to Profile Page' });
    this.chords.register('g h', () => this.addLog('CHORD', 'Navigated to Home Page (chord: g h)'), { description: 'Go to Home Page' });
    this.chords.register('ctrl+k ctrl+m', () => this.addLog('CHORD', 'Muted notification sounds (chord: ctrl+k ctrl+m)'), { description: 'Toggle Audio Mute' });

    // Register Gaming Keys
    this.shortcutService.register([
      {
        shortcut: 'w',
        action: () => this.addLog('GAME', 'Moved Forward ⬆️'),
        description: 'Move Forward (Gaming Mode)'
      },
      {
        shortcut: 's',
        action: () => this.addLog('GAME', 'Moved Backward ⬇️'),
        description: 'Move Backward (Gaming Mode)'
      },
      {
        shortcut: 'a',
        action: () => this.addLog('GAME', 'Moved Left ⬅️'),
        description: 'Move Left (Gaming Mode)'
      },
      {
        shortcut: 'd',
        action: () => this.addLog('GAME', 'Moved Right ➡️'),
        description: 'Move Right (Gaming Mode)'
      }
    ]);

    // Limit combinations while gaming mode is active!
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
    // Find the global visual-hints plugin to toggle it
    const visualHintsPluginInstance = (this.shortcutService as any).plugins?.find(
      (p: any) => p.id === 'visual-hints'
    );
    if (visualHintsPluginInstance) {
      if (visualHintsPluginInstance.isActive()) {
        visualHintsPluginInstance.stopHinting();
      } else {
        visualHintsPluginInstance.startHinting();
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
