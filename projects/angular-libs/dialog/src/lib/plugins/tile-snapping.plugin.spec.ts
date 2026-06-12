import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { tileSnappingPlugin } from './tile-snapping.plugin';

@Component({
  selector: 'test-snap-cmp',
  standalone: true,
  template: '<div>Snappy Dialog</div>',
})
class TestSnapComponent {}

describe('tileSnappingPlugin', () => {
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

  afterEach(() => {
    // Make sure we clean up any stranded overlays
    const overlays = Array.from(document.querySelectorAll('.al-tile-overlay'));
    overlays.forEach((over) => over.remove());
  });

  it('should display snapping overlay when Alt + triggerKeyCode is pressed', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestSnapComponent, {
      modal: false,
      plugins: [tileSnappingPlugin({ triggerKeyCode: 'KeyS', rows: 3, cols: 3 })],
    });

    try {
      expect(document.querySelector('.al-tile-overlay')).toBeNull();

      // Dispatch KeyS with altKey
      const event = new KeyboardEvent('keydown', {
        altKey: true,
        code: 'KeyS',
        bubbles: true,
      });
      window.dispatchEvent(event);

      const overlay = document.querySelector('.al-tile-overlay');
      expect(overlay).not.toBeNull();

      const cells = document.querySelectorAll('.al-tile-cell');
      expect(cells.length).toBe(9); // 3 * 3

      // Close overlay with Escape
      const esc = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      window.dispatchEvent(esc);

      // Timeout for transition/removal
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(document.querySelector('.al-tile-overlay')).toBeNull();
    } finally {
      ref.close();
    }
  });
});
