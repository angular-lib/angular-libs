import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { provideDialog } from './provide-dialog';
import { DefaultDialogComponent } from './components/default-dialog.component';
import { resolveDialogAppearance } from './dialog.types';
import {
  applyDialogTokens,
  dialogTokenStyle,
  dialogTokensAsCss,
  DIALOG_TOKEN_VARS,
} from './dialog-tokens';

@Component({
  selector: 'kit-sheet',
  standalone: true,
  template: `
    <header data-al-dialog-part="header">
      <h2 data-al-dialog-part="title">Kit sheet</h2>
    </header>
    <section data-al-dialog-part="content">Body</section>
  `,
})
class KitSheetComponent {}

describe('Dialog design-system DX', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  afterEach(() => {
    document.querySelectorAll('dialog.al-dialog').forEach((el) => el.remove());
  });

  describe('token bridge helpers', () => {
    it('maps short names and raw custom properties', () => {
      expect(DIALOG_TOKEN_VARS.bg).toBe('--al-dialog-bg');
      expect(dialogTokenStyle({ bg: 'var(--kit-surface)', accent: 'blue' })).toEqual({
        '--al-dialog-bg': 'var(--kit-surface)',
        '--al-dialog-accent': 'blue',
      });
      expect(dialogTokenStyle({ '--al-dialog-shadow': 'none' })).toEqual({
        '--al-dialog-shadow': 'none',
      });
    });

    it('applyDialogTokens writes CSS variables on the element', () => {
      const el = document.createElement('div');
      applyDialogTokens(el, { bg: 'ivory', '--al-dialog-border-radius': '12px' });
      expect(el.style.getPropertyValue('--al-dialog-bg')).toBe('ivory');
      expect(el.style.getPropertyValue('--al-dialog-border-radius')).toBe('12px');
    });

    it('dialogTokensAsCss emits a rule for a host stylesheet', () => {
      const css = dialogTokensAsCss({ bg: 'var(--kit-surface)' });
      expect(css).toContain('dialog.al-dialog');
      expect(css).toContain('--al-dialog-bg: var(--kit-surface);');
    });

    it('resolveDialogAppearance defaults scheme to false when headless', () => {
      expect(resolveDialogAppearance({})).toEqual({ appearance: 'default', scheme: 'auto' });
      expect(resolveDialogAppearance({ appearance: 'headless' })).toEqual({
        appearance: 'headless',
        scheme: false,
      });
      expect(resolveDialogAppearance({ appearance: 'headless', scheme: 'auto' })).toEqual({
        appearance: 'headless',
        scheme: 'auto',
      });
    });
  });

  it('open() of a consumer component is chrome-less by default', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent);
    try {
      expect(ref.dialogEl.dataset['alDialogChrome']).toBe('none');
      expect(ref.dialogEl.dataset['alDialogIntent']).toBe('open');
      expect(ref.dialogEl.dataset['alDialogAppearance']).toBe('default');
      expect(ref.dialogEl.dataset['alDialogScheme']).toBe('auto');
      expect(ref.dialogEl.classList.contains('al-dialog-headless')).toBe(false);
      expect(ref.dialogEl.querySelector('al-default-dialog')).toBeNull();
      expect(ref.dialogEl.querySelector('[data-al-dialog-part="title"]')?.textContent).toContain(
        'Kit sheet',
      );
    } finally {
      void ref.close();
    }
  });

  it('appearance: headless adds the structural shell class and skips auto scheme', () => {
    TestBed.configureTestingModule({
      providers: [provideDialog({ appearance: 'headless' }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent);
    try {
      expect(ref.options.appearance).toBe('headless');
      expect(ref.options.scheme).toBe(false);
      expect(ref.dialogEl.classList.contains('al-dialog-headless')).toBe(true);
      expect(ref.dialogEl.dataset['alDialogAppearance']).toBe('headless');
      expect(ref.dialogEl.dataset['alDialogScheme']).toBe('none');
    } finally {
      void ref.close();
    }
  });

  it('applies token bridge vars on the native dialog', () => {
    TestBed.configureTestingModule({
      providers: [
        provideDialog({
          tokens: { bg: 'var(--kit-surface)', accent: 'var(--kit-primary)' },
        }),
        DialogService,
      ],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent, {
      tokens: { borderRadius: '16px', '--al-dialog-shadow': 'none' },
    });
    try {
      expect(ref.dialogEl.style.getPropertyValue('--al-dialog-bg')).toBe('var(--kit-surface)');
      expect(ref.dialogEl.style.getPropertyValue('--al-dialog-accent')).toBe('var(--kit-primary)');
      expect(ref.dialogEl.style.getPropertyValue('--al-dialog-border-radius')).toBe('16px');
      expect(ref.dialogEl.style.getPropertyValue('--al-dialog-shadow')).toBe('none');
    } finally {
      void ref.close();
    }
  });

  it('merges global contentClass / panelClass with per-call classes', () => {
    TestBed.configureTestingModule({
      providers: [
        provideDialog({ contentClass: 'kit-dialog', panelClass: 'kit-panel' }),
        DialogService,
      ],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent, { contentClass: 'danger', panelClass: 'elevated' });
    try {
      expect(ref.dialogEl.classList.contains('kit-panel')).toBe(true);
      expect(ref.dialogEl.classList.contains('elevated')).toBe(true);
      const content = ref.dialogEl.querySelector('[data-al-dialog-content]');
      expect(content?.classList.contains('kit-dialog')).toBe(true);
      expect(content?.classList.contains('danger')).toBe(true);
    } finally {
      void ref.close();
    }
  });

  it('confirm() records intent, default chrome, and inherits DS defaults', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideDialog({
          appearance: 'headless',
          contentClass: 'kit-dialog',
          tokens: { bg: 'canvas' },
        }),
        DialogService,
      ],
    });
    const service = TestBed.inject(DialogService);
    const pending = service.confirm({ message: 'Sure?' });
    await Promise.resolve();
    const ref = service.openDialogs[0];
    expect(ref.dialogEl.dataset['alDialogIntent']).toBe('confirm');
    expect(ref.dialogEl.dataset['alDialogChrome']).toBe('default');
    expect(ref.dialogEl.classList.contains('al-dialog-headless')).toBe(true);
    expect(ref.dialogEl.style.getPropertyValue('--al-dialog-bg')).toBe('canvas');
    const content = ref.dialogEl.querySelector('[data-al-dialog-content]');
    expect(content?.classList.contains('kit-dialog')).toBe(true);
    expect((ref.component as DefaultDialogComponent).appearance()).toBe('headless');
    expect(ref.dialogEl.querySelector('[data-al-dialog-part="title"]')).not.toBeNull();
    expect(ref.dialogEl.querySelector('[data-al-dialog-action="primary"]')).not.toBeNull();
    (ref.component as DefaultDialogComponent).onSecondary();
    await expect(pending).resolves.toBe(false);
  });

  it('alert() records intent alert', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const pending = service.alert({ message: 'Done' });
    await Promise.resolve();
    const ref = service.openDialogs[0];
    expect(ref.dialogEl.dataset['alDialogIntent']).toBe('alert');
    expect(ref.dialogEl.getAttribute('role')).toBe('alertdialog');
    (ref.component as DefaultDialogComponent).onPrimary();
    await pending;
  });

  it('toast() and popover() expose intent hooks', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const toast = service.toast('Saved');
    const pop = service.popover(KitSheetComponent, { anchor });
    try {
      expect(toast.dialogEl.dataset['alDialogIntent']).toBe('toast');
      expect(toast.dialogEl.dataset['alDialogChrome']).toBe('default');
      expect(pop.dialogEl.dataset['alDialogIntent']).toBe('popover');
      expect(pop.dialogEl.dataset['alDialogChrome']).toBe('none');
      expect(pop.dialogEl.querySelector('[data-al-dialog-part="arrow"]')).not.toBeNull();
    } finally {
      void toast.close();
      void pop.close();
      anchor.remove();
    }
  });

  it('scheme: dark sets the data attribute without going headless', () => {
    TestBed.configureTestingModule({
      providers: [provideDialog({ scheme: 'dark' }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent);
    try {
      expect(ref.dialogEl.dataset['alDialogScheme']).toBe('dark');
      expect(ref.dialogEl.classList.contains('al-dialog-headless')).toBe(false);
    } finally {
      void ref.close();
    }
  });

  it('updateConfig merges tokens', () => {
    TestBed.configureTestingModule({
      providers: [provideDialog({ tokens: { bg: 'a', accent: 'b' } }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    service.updateConfig({ tokens: { accent: 'c', borderRadius: '8px' } });
    expect(service.config().tokens).toEqual({ bg: 'a', accent: 'c', borderRadius: '8px' });
  });

  it('labelledby uses data-al-dialog-part=title when present', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(KitSheetComponent);
    try {
      const labelledBy = ref.dialogEl.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const title = ref.dialogEl.querySelector('[data-al-dialog-part="title"]');
      expect(title?.id).toBe(labelledBy);
    } finally {
      void ref.close();
    }
  });
});
