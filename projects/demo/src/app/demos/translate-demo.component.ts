import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ALTranslate, TranslatePipe } from '@angular-libs/translate';

@Component({
  selector: 'app-translate-demo',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Translation Playground 🌐</h2>
        <p class="description">Client-optimized internationalization suite built on top of Angular Signals.</p>
      </div>

      <div class="layout-grid">
        <!-- SETTINGS -->
        <div class="column">
          <div class="widget-card">
            <h3>⚙️ Localization Controller</h3>
            <p class="sub-caption">Toggle dictionary locales lazily with synchronous speeds.</p>

            <div class="form-group">
              <label>Select Language</label>
              <div class="btn-group-row">
                <button class="btn" [class.btn-active]="currentLang() === 'en'" (click)="setLang('en')">🇺🇸 English</button>
                <button class="btn" [class.btn-active]="currentLang() === 'es'" (click)="setLang('es')">🇪🇸 Español</button>
                <button class="btn" [class.btn-active]="currentLang() === 'fr'" (click)="setLang('fr')">🇫🇷 Français</button>
              </div>
            </div>

            <div class="form-group">
              <label>Name Parameter</label>
              <input type="text" [value]="userName()" (input)="onNameInput($event)" placeholder="Type name...">
            </div>

            <div class="form-group">
              <label>Message Count ({{ messageCount() }})</label>
              <input type="range" min="0" max="50" [value]="messageCount()" (input)="onCountInput($event)" class="range-slider">
            </div>
          </div>
        </div>

        <!-- TRANSLATION PREVIEWS -->
        <div class="column">
          <div class="widget-card">
            <h3>🪘 Pipe Translation</h3>
            <p class="sub-caption">Renders using the impure, reactive <code>translate</code> pipe.</p>
            <div class="translation-preview">
              <p class="translated-text">{{ 'GREETING' | translate: { name: userName() } }}</p>
            </div>
          </div>

          <div class="widget-card">
            <h3>⚡ Programmatic Signal Selection</h3>
            <p class="sub-caption">Accesses computed values directly inside component Typescript logic.</p>
            <div class="translation-preview border-purple">
              <p class="translated-text text-purple">{{ computedGreeting() }}</p>
            </div>
          </div>

          <div class="widget-card">
            <h3>🔢 Numeric Pluralization</h3>
            <p class="sub-caption">Dynamic multi-variable replacement matching number values.</p>
            <div class="translation-preview border-orange">
              <p class="translated-text text-orange">{{ 'ITEMS_COUNT' | translate: { count: messageCount() } }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container { padding: 24px; font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; }
    .header-section { background: linear-gradient(135deg, #0d9488, #10b981); color: white; padding: 24px; border-radius: 8px; margin-bottom: 30px; }
    .header-section h2 { margin: 0; font-size: 1.8rem; font-weight: 800; }
    .header-section .description { margin: 4px 0 0 0; color: rgba(255,255,255,0.9); font-size: 1rem; }
    .layout-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; }
    @media (max-width: 768px) { .layout-grid { grid-template-columns: 1fr; } }
    .widget-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; margin-bottom: 24px; }
    .widget-card h3 { margin: 0; color: #0f172a; font-size: 1.1rem; }
    .sub-caption { margin: 4px 0 16px 0; color: #64748b; font-size: 0.85rem; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; color: #334155; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 6px; }
    .form-group input[type="text"] { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; outline: none; }
    .range-slider { width: 100%; accent-color: #0d9488; cursor: pointer; }
    .btn-group-row { display: flex; gap: 8px; }
    .btn { flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; font-size: 0.85rem; background: white; color: #334155; cursor: pointer; transition: all 0.2s; }
    .btn-active { background: #0d9488; color: white; border-color: #0d9488; }
    .translation-preview { background: #f8fafc; border-radius: 6px; padding: 12px; border-left: 4px solid #0d9488; }
    .translation-preview.border-purple { border-left-color: #8b5cf6; }
    .translation-preview.border-orange { border-left-color: #f97316; }
    .translated-text { margin: 0; font-size: 1rem; font-weight: bold; color: #115e59; line-height: 1.4; }
    .translated-text.text-purple { color: #6d28d9; }
    .translated-text.text-orange { color: #c2410c; }
  `]
})
export class TranslateDemoComponent {
  private translate = inject(ALTranslate);

  userName = signal('Ava');
  messageCount = signal(5);
  currentLang = this.translate.currentLang;

  computedGreeting = computed(() => {
    return this.translate.get('SAMPLE_TEXT');
  });

  setLang(lang: string) {
    this.translate.loadLanguage(lang);
  }

  onNameInput(event: Event) {
    this.userName.set((event.target as HTMLInputElement).value);
  }

  onCountInput(event: Event) {
    this.messageCount.set(Number((event.target as HTMLInputElement).value));
  }
}


