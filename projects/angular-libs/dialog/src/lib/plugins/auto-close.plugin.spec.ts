import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { autoClosePlugin } from './auto-close.plugin';

@Component({
  selector: 'test-autoclose-cmp',
  standalone: true,
  template: '<div>Auto-Close Dialog</div>',
})
class TestAutoCloseComponent {}

describe('autoClosePlugin', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      const event = new Event('close');
      this.dispatchEvent(event);
    });
  });

  it('should automatically close the dialog after the specified duration', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestAutoCloseComponent, {
      plugins: [autoClosePlugin({ duration: 50 })],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);
      // Wait for timer
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(ref.dialogEl.open).toBe(false);
      expect(ref.closeSource).toBe('auto-close');
    } finally {
      ref.close();
    }
  });

  it('should pause/reset close countdown on mouseenter and resume on mouseleave if pauseOnHover is true', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestAutoCloseComponent, {
      plugins: [autoClosePlugin({ duration: 50, pauseOnHover: true })],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);

      // Mouseenters halfway through timer duration
      await new Promise((resolve) => setTimeout(resolve, 25));
      ref.dialogEl.dispatchEvent(new MouseEvent('mouseenter'));

      // Wait past duration to ensure it didn't close
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(ref.dialogEl.open).toBe(true);

      // Mouseleaves, restarting timer
      ref.dialogEl.dispatchEvent(new MouseEvent('mouseleave'));

      // Wait a little bit (less than duration)
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(ref.dialogEl.open).toBe(true);

      // Wait enough time to finish duration
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(ref.dialogEl.open).toBe(false);
      expect(ref.closeSource).toBe('auto-close');
    } finally {
      ref.close();
    }
  });
});
