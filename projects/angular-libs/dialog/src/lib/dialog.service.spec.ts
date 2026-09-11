import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { resolveDismissFlags } from './dialog.types';

@Component({
  selector: 'test-cmp',
  standalone: true,
  template: '<div>Test content</div>',
})
class TestComponent {}

describe('DialogService Global Configuration', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it('should use default configurations off signal initializations', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });

    const service = TestBed.inject(DialogService);
    const ref = service.open(TestComponent);

    try {
      expect(ref.options.width).toBeUndefined();
      expect(ref.options.disableClose).toBeUndefined();
    } finally {
      ref.close();
    }
  });

  it('should apply global configuration values when updated via updateConfig() before opening', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });

    const service = TestBed.inject(DialogService);
    service.updateConfig({
      width: '500px',
      disableClose: true,
    });

    const ref = service.open(TestComponent);

    try {
      expect(ref.options.width).toBe('500px');
      expect(ref.options.disableClose).toBe(true);
    } finally {
      ref.close();
    }
  });

  it('should allow options passed to open() to override global config signal values', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });

    const service = TestBed.inject(DialogService);
    service.updateConfig({
      width: '500px',
      disableClose: true,
    });

    // Explicit options override global values
    const ref = service.open(TestComponent, {
      width: '300px',
      disableClose: false,
    });

    try {
      expect(ref.options.width).toBe('300px');
      expect(ref.options.disableClose).toBe(false);
    } finally {
      ref.close();
    }
  });

  it('should support dynamic runtime configurations via updateConfig', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });

    const service = TestBed.inject(DialogService);
    
    // Dynamically update the configuration
    service.updateConfig({
      width: '600px',
      disableClose: true,
    });

    const ref = service.open(TestComponent);

    try {
      expect(ref.options.width).toBe('600px');
      expect(ref.options.disableClose).toBe(true);
    } finally {
      ref.close();
    }
  });

  it('should deduplicate plugins with matching ids, prioritizing local options over global configs', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });

    const service = TestBed.inject(DialogService);
    
    const globalPlugin = {
      id: 'test-plugin',
      setup: vi.fn(),
    };
    const localPlugin = {
      id: 'test-plugin',
      setup: vi.fn(),
    };

    service.updateConfig({
      plugins: [globalPlugin],
    });

    const ref = service.open(TestComponent, {
      plugins: [localPlugin],
    });

    try {
      const plugins = ref.options.plugins || [];
      const testPlugins = plugins.filter(p => p.id === 'test-plugin');
      expect(testPlugins.length).toBe(1);
      expect(testPlugins[0]).toBe(localPlugin);
    } finally {
      ref.close();
    }
  });

  it('should remove the global fullscreenchange listener when the service is destroyed', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    TestBed.inject(DialogService);

    expect(addSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    const registeredHandler = addSpy.mock.calls.find((call) => call[0] === 'fullscreenchange')?.[1];

    TestBed.resetTestingModule();

    expect(removeSpy).toHaveBeenCalledWith('fullscreenchange', registeredHandler);
  });
});

describe('resolveDismissFlags', () => {
  it('defaults both on when nothing is set', () => {
    expect(resolveDismissFlags({})).toEqual({ closeOnEscape: true, closeOnBackdrop: true });
  });

  it('turns both off when disableClose is true', () => {
    expect(resolveDismissFlags({ disableClose: true })).toEqual({
      closeOnEscape: false,
      closeOnBackdrop: false,
    });
  });

  it('lets explicit flags override disableClose', () => {
    expect(resolveDismissFlags({ disableClose: true, closeOnEscape: true })).toEqual({
      closeOnEscape: true,
      closeOnBackdrop: false,
    });
    expect(resolveDismissFlags({ disableClose: true, closeOnBackdrop: true })).toEqual({
      closeOnEscape: false,
      closeOnBackdrop: true,
    });
  });

  it('honors independent Esc-only and backdrop-only settings', () => {
    expect(resolveDismissFlags({ closeOnEscape: true, closeOnBackdrop: false })).toEqual({
      closeOnEscape: true,
      closeOnBackdrop: false,
    });
    expect(resolveDismissFlags({ closeOnEscape: false, closeOnBackdrop: true })).toEqual({
      closeOnEscape: false,
      closeOnBackdrop: true,
    });
  });
});

describe('DialogService dismiss listeners', () => {
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
  });

  function dispatchBackdropClick(el: HTMLDialogElement): void {
    const opts: MouseEventInit = { clientX: 200, clientY: 200, bubbles: true };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function dispatchEscape(el: HTMLDialogElement): void {
    el.dispatchEvent(new Event('cancel', { cancelable: true }));
  }

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('both-on: Escape and backdrop each close the dialog', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);

    const escRef = service.open(TestComponent);
    dispatchEscape(escRef.dialogEl);
    await expect(escRef.closed).resolves.toEqual({ result: undefined, source: 'escape' });

    const backdropRef = service.open(TestComponent);
    dispatchBackdropClick(backdropRef.dialogEl);
    await expect(backdropRef.closed).resolves.toEqual({ result: undefined, source: 'backdrop' });
  });

  it('Esc-only: Escape closes, backdrop does not', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestComponent, { closeOnEscape: true, closeOnBackdrop: false });

    dispatchBackdropClick(ref.dialogEl);
    await flush();
    expect(ref.dialogEl.open).toBe(true);

    dispatchEscape(ref.dialogEl);
    await expect(ref.closed).resolves.toEqual({ result: undefined, source: 'escape' });
  });

  it('backdrop-only: backdrop closes, Escape does not', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestComponent, { closeOnEscape: false, closeOnBackdrop: true });

    dispatchEscape(ref.dialogEl);
    await flush();
    expect(ref.dialogEl.open).toBe(true);

    dispatchBackdropClick(ref.dialogEl);
    await expect(ref.closed).resolves.toEqual({ result: undefined, source: 'backdrop' });
  });

  it('both-off via disableClose: neither Escape nor backdrop closes', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestComponent, { disableClose: true });

    dispatchEscape(ref.dialogEl);
    dispatchBackdropClick(ref.dialogEl);
    await flush();
    expect(ref.dialogEl.open).toBe(true);

    await ref.close();
  });

  it('applies hasBackdrop, backdropClass, and fullscreenBelow classes', () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestComponent, {
      hasBackdrop: false,
      backdropClass: 'my-dim',
      fullscreenBelow: 'md',
    });

    try {
      expect(ref.dialogEl.classList.contains('al-dialog-no-backdrop')).toBe(true);
      expect(ref.dialogEl.classList.contains('my-dim')).toBe(true);
      expect(ref.dialogEl.classList.contains('al-dialog-fullscreen-below-md')).toBe(true);
    } finally {
      void ref.close();
    }
  });
});

describe('DialogService Dialog Hierarchy (parent/child dialogs)', () => {
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

  it('should cascade-close nested child dialogs when the parent closes', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const parentRef = service.open(TestComponent);
    const childRef = service.open(TestComponent, { parent: parentRef, modal: false });
    const grandchildRef = service.open(TestComponent, { parent: childRef, modal: false });

    expect(parentRef.children).toContain(childRef);
    expect(childRef.children).toContain(grandchildRef);

    await parentRef.close();

    expect(parentRef.dialogEl.open).toBe(false);
    expect(childRef.dialogEl.open).toBe(false);
    expect(grandchildRef.dialogEl.open).toBe(false);
    expect(childRef.closeSource).toBe('parent-closed');
    expect(grandchildRef.closeSource).toBe('parent-closed');
  });

  it('should detach a child from its parent once the child itself closes', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const parentRef = service.open(TestComponent);
    const childRef = service.open(TestComponent, { parent: parentRef, modal: false });

    await childRef.close();

    expect(parentRef.children).not.toContain(childRef);

    await parentRef.close();
  });
});
