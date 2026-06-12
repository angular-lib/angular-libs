import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { fullscreenPlugin } from './fullscreen.plugin';
import { isFullscreen, enterFullscreen, exitFullscreen } from '../actions/fullscreen';

@Component({
  selector: 'test-fullscreen-cmp',
  standalone: true,
  template: '<div>Fullscreen Dialog Content</div>',
})
class TestFullscreenComponent {}

describe('Fullscreen Plugin and Actions', () => {
  let originalFullscreenElement: any;
  let mockFullscreenElement: Element | null = null;

  beforeAll(() => {
    // Save original getter/setter
    originalFullscreenElement = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement');

    // Define mock fullscreenElement getter on document
    Object.defineProperty(document, 'fullscreenElement', {
      get: () => mockFullscreenElement,
      configurable: true,
    });

    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });

    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      const event = new Event('close');
      this.dispatchEvent(event);
    });

    HTMLElement.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: HTMLElement) {
      mockFullscreenElement = this;
      const event = new Event('fullscreenchange');
      document.dispatchEvent(event);
      return Promise.resolve();
    });

    HTMLDialogElement.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      mockFullscreenElement = this;
      const event = new Event('fullscreenchange');
      document.dispatchEvent(event);
      return Promise.resolve();
    });

    document.exitFullscreen = vi.fn().mockImplementation(() => {
      mockFullscreenElement = null;
      const event = new Event('fullscreenchange');
      document.dispatchEvent(event);
      return Promise.resolve();
    });
  });

  afterAll(() => {
    mockFullscreenElement = null;
    if (originalFullscreenElement) {
      Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement);
    }
  });

  it('should trigger enterFullscreen and exitFullscreen actions successfully', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestFullscreenComponent);

    try {
      expect(ref.dialogEl.open).toBe(true);
      expect(isFullscreen(ref)).toBe(false);

      const entered = await enterFullscreen(ref);
      expect(entered).toBe(true);
      expect(isFullscreen(ref)).toBe(true);
      expect(mockFullscreenElement).toBe(ref.dialogEl);

      const exited = await exitFullscreen(ref);
      expect(exited).toBe(true);
      expect(isFullscreen(ref)).toBe(false);
      expect(mockFullscreenElement).toBeNull();
    } finally {
      ref.close();
    }
  });

  it('should toggle fullscreen on keydown shortcut (Alt+Enter)', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestFullscreenComponent, {
      plugins: [fullscreenPlugin()],
    });

    try {
      expect(isFullscreen(ref)).toBe(false);

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        altKey: true,
        bubbles: true,
      });
      ref.dialogEl.dispatchEvent(keyEvent);

      // Need to yield for async requestFullscreen promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(isFullscreen(ref)).toBe(true);

      ref.dialogEl.dispatchEvent(keyEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(isFullscreen(ref)).toBe(false);
    } finally {
      ref.close();
    }
  });

  it('should clean up fullscreen state when dialog close is called', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);
    const ref = service.open(TestFullscreenComponent, {
      plugins: [fullscreenPlugin()],
    });

    try {
      await enterFullscreen(ref);
      expect(isFullscreen(ref)).toBe(true);

      ref.close();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(isFullscreen(ref)).toBe(false);
    } finally {
      ref.close();
    }
  });
});
