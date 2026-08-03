import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { provideDialog } from './provide-dialog';
import { definePlugin } from './define-plugin';
import { resolveBehaviorPlugins, mergePlugins } from './behavior-resolver';
import { DefaultDialogComponent } from './components/default-dialog.component';
import { DIALOG_CONFIG, resolveDialogStrings } from './dialog.types';

@Component({
  selector: 'dx-test-cmp',
  standalone: true,
  template: '<div><button type="button">Ok</button></div>',
})
class DxTestComponent {}

describe('Dialog DX redesign', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  });

  afterEach(() => {
    document.querySelectorAll('dialog.al-dialog').forEach((el) => el.remove());
    document.querySelector('.al-dialog-taskbar')?.remove();
  });

  it('provideDialog seeds DialogService config', () => {
    TestBed.configureTestingModule({
      providers: [provideDialog({ width: '420px', window: { drag: true, dock: false } }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    expect(service.config().width).toBe('420px');
    expect(service.config().window?.dock).toBe(false);
    expect(TestBed.inject(DIALOG_CONFIG).width).toBe('420px');
  });

  it('resolveDialogStrings supports object, factory, and Signal', () => {
    expect(resolveDialogStrings({ close: 'X' })?.close).toBe('X');
    expect(resolveDialogStrings(() => ({ close: 'Y' }))?.close).toBe('Y');
    const s = signal({ close: 'Z' });
    expect(resolveDialogStrings(s)?.close).toBe('Z');
    s.set({ close: 'Z2' });
    expect(resolveDialogStrings(s)?.close).toBe('Z2');
  });

  it('applies factory strings when opening DefaultDialog', () => {
    TestBed.configureTestingModule({
      providers: [
        provideDialog({
          strings: () => ({ close: 'Schließen', minimize: 'Minimieren' }),
        }),
        DialogService,
      ],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(DefaultDialogComponent, {
      inputs: { title: 'T', showMinimizeIcon: true },
    });
    try {
      expect(ref.component.closeTooltip()).toBe('Schließen');
      expect(ref.component.minimizeTooltip()).toBe('Minimieren');
    } finally {
      void ref.close();
    }
  });

  it('applies Signal strings when opening DefaultDialog', () => {
    const strings = signal({ close: 'Cerrar' });
    TestBed.configureTestingModule({
      providers: [provideDialog({ strings }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(DefaultDialogComponent, { inputs: { title: 'T' } });
    try {
      expect(ref.component.closeTooltip()).toBe('Cerrar');
    } finally {
      void ref.close();
    }
  });

  it('updateConfig replaces Signal/factory strings instead of spreading them', () => {
    TestBed.configureTestingModule({
      providers: [provideDialog({ strings: { close: 'A' } }), DialogService],
    });
    const service = TestBed.inject(DialogService);
    const live = signal({ close: 'B' });
    service.updateConfig({ strings: live });
    expect(resolveDialogStrings(service.config().strings)?.close).toBe('B');
    service.updateConfig({ strings: () => ({ close: 'C' }) });
    expect(resolveDialogStrings(service.config().strings)?.close).toBe('C');
    service.updateConfig({ strings: { minimize: 'M' } });
    // plain→plain merges; close from previous factory is replaced entirely by new object
    expect(resolveDialogStrings(service.config().strings)).toEqual({ minimize: 'M' });
  });

  it('resolveBehaviorPlugins maps flags and respects false disables', () => {
    const enabled = resolveBehaviorPlugins({ drag: true, snap: true, dock: true }, {});
    expect(enabled.plugins.map((p) => p.id).sort()).toEqual(
      ['dock', 'draggable', 'snap-to-edge', 'tile-snapping'].sort(),
    );

    const disabled = resolveBehaviorPlugins(
      { drag: false, snap: false, dock: false },
      { drag: true, snap: true, dock: true },
    );
    expect(disabled.plugins.length).toBe(0);
    expect(disabled.disabledIds.has('draggable')).toBe(true);

    const merged = mergePlugins(
      { plugins: [{ id: 'draggable', setup: () => undefined }] },
      disabled,
      { plugins: [{ id: 'custom' }] },
    );
    expect(merged.find((p) => p.id === 'draggable')).toBeUndefined();
    expect(merged.find((p) => p.id === 'custom')).toBeTruthy();
  });

  it('window() opens modeless with default drag/snap/dock plugins', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.window(DxTestComponent, { id: 'w1' });
    try {
      expect(ref.options.modal).toBe(false);
      const ids = (ref.options.plugins ?? []).map((p) => p.id);
      expect(ids).toContain('draggable');
      expect(ids).toContain('dock');
      expect(ids).toContain('tile-snapping');
      expect(ref.dialogEl.getAttribute('aria-modal')).toBe('false');
    } finally {
      void ref.close();
    }
  });

  it('window() respects snap: false against defaults', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.window(DxTestComponent, { snap: false });
    try {
      const ids = (ref.options.plugins ?? []).map((p) => p.id);
      expect(ids).not.toContain('tile-snapping');
      expect(ids).not.toContain('snap-to-edge');
      expect(ids).toContain('draggable');
    } finally {
      void ref.close();
    }
  });

  it('DialogRef layout methods update state signal', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.window(DxTestComponent);
    try {
      expect(ref.state()).toBe('open');
      expect(ref.minimize()).toBe(true);
      expect(ref.state()).toBe('minimized');
      expect(ref.restore()).toBe(true);
      expect(ref.state()).toBe('open');
      expect(ref.maximize()).toBe(true);
      expect(ref.state()).toBe('maximized');
    } finally {
      void ref.close();
    }
  });

  it('open applies size preset, contentClass, and aria-modal', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(DxTestComponent, {
      size: 'md',
      contentClass: 'my-content',
    });
    try {
      expect(ref.dialogEl.style.width).toBe('480px');
      expect(ref.dialogEl.getAttribute('aria-modal')).toBe('true');
      const content = ref.dialogEl.querySelector('[data-al-dialog-content]');
      expect(content?.classList.contains('my-content')).toBe(true);
    } finally {
      void ref.close();
    }
  });

  it('definePlugin returns the plugin object', () => {
    const plugin = definePlugin({
      id: 'x',
      onOpen() {},
    });
    expect(plugin.id).toBe('x');
  });

  it('DefaultDialog primary/secondary close with results', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open<DefaultDialogComponent, boolean>(DefaultDialogComponent, {
      inputs: {
        title: 'Sure?',
        contentText: 'Please confirm',
        primaryButtonText: 'Yes',
        secondaryButtonText: 'No',
      },
    });

    const closed = ref.closed;
    ref.component.onPrimary();
    const event = await closed;
    expect(event.result).toBe(true);
    expect(event.source).toBe('primary');
  });

  it('confirm() resolves boolean from DefaultDialog', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);

    const pending = service.confirm({ title: 'Delete?', message: 'Gone forever' });
    // Allow open to complete
    await Promise.resolve();
    const openRef = service.openDialogs[0];
    expect(openRef).toBeTruthy();
    (openRef.component as DefaultDialogComponent).onPrimary();
    await expect(pending).resolves.toBe(true);
  });

  it('toast() attaches auto-close plugin', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.toast('Saved', { duration: 1000 });
    try {
      expect((ref.options.plugins ?? []).some((p) => p.id === 'auto-close')).toBe(true);
      expect(ref.options.modal).toBe(false);
    } finally {
      void ref.close();
    }
  });

  it('toast() sets a11y live region, position class, and stack offset', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const first = service.toast('One', { position: 'top-left' });
    const second = service.toast('Two', { position: 'top-left' });
    try {
      expect(first.dialogEl.getAttribute('role')).toBe('status');
      expect(first.dialogEl.getAttribute('aria-live')).toBe('polite');
      expect(first.dialogEl.classList.contains('al-toast-top-left')).toBe(true);
      expect(second.dialogEl.classList.contains('al-toast-top-left')).toBe(true);

      // Force measurable heights (jsdom often reports 0 until styled).
      first.dialogEl.style.height = '40px';
      second.dialogEl.style.height = '50px';
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      expect(first.dialogEl.style.getPropertyValue('--al-toast-stack-offset')).toBe('0px');
      const secondOffset = Number.parseFloat(
        second.dialogEl.style.getPropertyValue('--al-toast-stack-offset'),
      );
      expect(secondOffset).toBeGreaterThanOrEqual(40);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('confirm() uses DialogStrings defaults for titles and buttons', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideDialog({
          strings: {
            confirmTitle: 'Sure?',
            ok: 'Yes',
            cancel: 'No',
          },
        }),
        DialogService,
      ],
    });
    const service = TestBed.inject(DialogService);
    const pending = service.confirm({ message: 'Proceed?' });
    await Promise.resolve();
    const openRef = service.openDialogs[0];
    const cmp = openRef.component as DefaultDialogComponent;
    expect(cmp.title()).toBe('Sure?');
    expect(cmp.primaryButtonText()).toBe('Yes');
    expect(cmp.secondaryButtonText()).toBe('No');
    cmp.onSecondary();
    await expect(pending).resolves.toBe(false);
  });

  it('confirm() accepts animation and per-call strings', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const pending = service.confirm({
      message: 'Go?',
      animation: 'fade',
      strings: { confirmTitle: 'Custom', ok: 'Go', cancel: 'Stop' },
    });
    await Promise.resolve();
    const openRef = service.openDialogs[0];
    expect(openRef.options.animation).toBe('fade');
    const cmp = openRef.component as DefaultDialogComponent;
    expect(cmp.title()).toBe('Custom');
    cmp.onPrimary();
    await expect(pending).resolves.toBe(true);
  });

  it('restores focus to opener for modal dialogs', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();

    const ref = service.open(DxTestComponent);
    expect(ref._opener).toBe(btn);
    await ref.close();
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('closed promise resolves { result, source }', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(DxTestComponent);
    const pending = ref.closed;
    await ref.close('ok', 'manual');
    await expect(pending).resolves.toEqual({ result: 'ok', source: 'manual' });
  });
});
