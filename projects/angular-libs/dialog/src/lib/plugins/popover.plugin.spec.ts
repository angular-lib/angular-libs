import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { computePopoverPosition, popoverPlugin } from './popover.plugin';

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

describe('computePopoverPosition', () => {
  const midAnchor = {
    left: 100,
    top: 100,
    right: 150,
    bottom: 130,
    width: 50,
    height: 30,
  };

  it('keeps the preferred placement when it fits', () => {
    const result = computePopoverPosition({
      placement: 'bottom',
      anchor: midAnchor,
      dialogWidth: 200,
      dialogHeight: 80,
      offset: 10,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(140);
    expect(result.left).toBe(25);
  });

  it('flips bottom to top when there is no room below', () => {
    const result = computePopoverPosition({
      placement: 'bottom',
      anchor: { left: 100, top: 540, right: 150, bottom: 570, width: 50, height: 30 },
      dialogWidth: 200,
      dialogHeight: 180,
      offset: 10,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.placement).toBe('top');
    expect(result.top).toBe(350);
  });

  it('flips right to left near the right edge', () => {
    const result = computePopoverPosition({
      placement: 'right',
      anchor: { left: 720, top: 200, right: 770, bottom: 230, width: 50, height: 30 },
      dialogWidth: 200,
      dialogHeight: 80,
      offset: 8,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.placement).toBe('left');
    expect(result.left).toBe(512);
  });

  it('shifts on the cross axis after flip so the panel stays in view', () => {
    const result = computePopoverPosition({
      placement: 'bottom-left',
      anchor: { left: 700, top: 80, right: 760, bottom: 110, width: 60, height: 30 },
      dialogWidth: 200,
      dialogHeight: 80,
      offset: 8,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.placement).toBe('bottom-left');
    expect(result.left).toBe(596);
    expect(result.top).toBe(118);
  });

  it('falls back to clamp when both sides overflow', () => {
    const result = computePopoverPosition({
      placement: 'bottom',
      anchor: { left: 100, top: 180, right: 150, bottom: 200, width: 50, height: 20 },
      dialogWidth: 350,
      dialogHeight: 350,
      offset: 10,
      viewportWidth: 400,
      viewportHeight: 400,
    });
    // Bottom overflows less than top, then clamp into the viewport.
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(46);
    expect(result.left).toBe(4);
  });

  it('skips flip when flip is false and only clamps', () => {
    const result = computePopoverPosition({
      placement: 'bottom',
      anchor: { left: 100, top: 540, right: 150, bottom: 570, width: 50, height: 30 },
      dialogWidth: 200,
      dialogHeight: 180,
      offset: 10,
      viewportWidth: 800,
      viewportHeight: 600,
      flip: false,
    });
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(416);
  });
});

describe('popoverPlugin flip integration', () => {
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

  it('flips a bottom popover above the anchor near the viewport edge', async () => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    const service = TestBed.inject(DialogService);

    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });

    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
    anchorEl.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 540,
        right: 150,
        bottom: 570,
        width: 50,
        height: 30,
        x: 100,
        y: 540,
      }) as DOMRect;

    const ref = service.popover(TestPopoverComponent, {
      anchor: anchorEl,
      placement: 'bottom',
      offset: 10,
      showArrow: false,
    });

    Object.defineProperty(ref.dialogEl, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(ref.dialogEl, 'offsetHeight', { configurable: true, value: 180 });
    window.dispatchEvent(new Event('resize'));

    try {
      expect(ref.dialogEl.dataset['alPopoverPlacement']).toBe('top');
      expect(parseFloat(ref.dialogEl.style.top)).toBe(350);
    } finally {
      await ref.close();
      anchorEl.remove();
      if (innerHeight) {
        Object.defineProperty(window, 'innerHeight', innerHeight);
      }
    }
  });
});
