import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { popoverPlugin } from './popover.plugin';

@Component({
  selector: 'test-popover-cmp',
  standalone: true,
  template: '<div>Popover Dialog</div>',
})
class TestPopoverComponent {}

describe('popoverPlugin', () => {
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

  it('should position the dialog next to an anchor element as a popover', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const anchorEl = document.createElement('button');
    anchorEl.id = 'trigger-btn';
    anchorEl.style.position = 'absolute';
    anchorEl.style.left = '100px';
    anchorEl.style.top = '100px';
    anchorEl.style.width = '50px';
    anchorEl.style.height = '30px';
    document.body.appendChild(anchorEl);

    // Stub getBoundingClientRect since jsdom doesn't fully lay elements out
    anchorEl.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      right: 150,
      bottom: 130,
      width: 50,
      height: 30,
      x: 100,
      y: 100,
    } as DOMRect);

    const ref = service.open(TestPopoverComponent, {
      modal: false,
      plugins: [
        popoverPlugin({
          anchor: anchorEl,
          placement: 'bottom',
          offset: 10,
          showArrow: true,
        }),
      ],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);

      // Trigger animation frame for positioning
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });

      // Assert that styles are overridden for a fixed layout
      expect(ref.dialogEl.style.position).toBe('fixed');
      expect(ref.dialogEl.style.margin).toBe('0px');
      expect(ref.dialogEl.style.inset).toBe('auto');

      // Verify and clean up
    } finally {
      ref.close();
      anchorEl.remove();
    }
  });

  it('should handle anchor selectors as string', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const anchorEl = document.createElement('div');
    anchorEl.id = 'test-div-anchor';
    document.body.appendChild(anchorEl);

    const ref = service.open(TestPopoverComponent, {
      modal: false,
      plugins: [
        popoverPlugin({
          anchor: '#test-div-anchor',
          placement: 'right',
        }),
      ],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);
    } finally {
      ref.close();
      anchorEl.remove();
    }
  });
});
