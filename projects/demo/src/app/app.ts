import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ALShortcutService, visualHintsPlugin } from '@angular-libs/shortcut';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('demo');
  protected readonly isCollapsed = signal(false);

  private readonly shortcutService = inject(ALShortcutService);

  constructor() {
    // Register visual hints globally across all pages so pressing Ctrl + G works anywhere!
    this.shortcutService.registerPlugin(visualHintsPlugin({ triggerShortcut: 'ctrl+g' }));
  }

  protected toggleSidebar(): void {
    this.isCollapsed.update((val) => !val);
  }
}
