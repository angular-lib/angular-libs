import { TestBed } from '@angular/core/testing';
import { ElementRef, signal, DestroyRef } from '@angular/core';
import { resizeObserverSignal } from './resize';

describe('resizeObserverSignal', () => {
  let mockObserve: any;
  let mockDisconnect: any;
  let observerCallback: any;

  beforeEach(() => {
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();

    // Mock global ResizeObserver
    class MockResizeObserver {
      constructor(callback: any) {
        observerCallback = callback;
      }
      observe = mockObserve;
      unobserve = vi.fn();
      disconnect = mockDisconnect;
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: any) => cb());
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize with default states', () => {
    const el = document.createElement('div');
    const size = TestBed.runInInjectionContext(() => resizeObserverSignal(el));

    expect(size().supported).toBe(true);
    expect(size().width).toBe(0);
    expect(size().height).toBe(0);
  });

  it('should register observer and update state on resize callbacks', () => {
    const el = document.createElement('div');
    const size = TestBed.runInInjectionContext(() => resizeObserverSignal(el));

    expect(mockObserve).toHaveBeenCalledWith(el, {});

    // Trigger observer callback
    const mockEntry = {
      target: el,
      contentRect: { width: 150, height: 300 } as DOMRectReadOnly,
    };

    observerCallback([mockEntry]);

    expect(size().width).toBe(150);
    expect(size().height).toBe(300);
  });

  it('should support ElementRef targets', () => {
    const el = document.createElement('div');
    const ref = new ElementRef(el);
    TestBed.runInInjectionContext(() => resizeObserverSignal(ref));

    expect(mockObserve).toHaveBeenCalledWith(el, {});
  });

  it('should support CSS selectors', () => {
    const el = document.createElement('div');
    el.id = 'target-id';
    document.body.appendChild(el);

    TestBed.runInInjectionContext(() => resizeObserverSignal('#target-id'));
    expect(mockObserve).toHaveBeenCalledWith(el, {});

    el.remove();
  });

  it('should support reactive signal target updates', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    const targetSignal = signal<HTMLElement | null>(el1);

    TestBed.runInInjectionContext(() => {
      resizeObserverSignal(targetSignal);
    });

    // Make sure it initialised with el1
    expect(mockObserve).toHaveBeenCalledWith(el1, {});

    // Dynamically update the signal to el2
    targetSignal.set(el2);
    TestBed.flushEffects();

    // Verify it cleans up the old elements and observes the new one
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalledWith(el2, {});
  });

  it('should disconnect when target element becomes null or undefined', () => {
    const el = document.createElement('div');
    const targetSignal = signal<HTMLElement | null>(el);

    TestBed.runInInjectionContext(() => {
      resizeObserverSignal(targetSignal);
    });

    expect(mockObserve).toHaveBeenCalledWith(el, {});

    targetSignal.set(null);
    TestBed.flushEffects();

    expect(mockDisconnect).toHaveBeenCalled();
  });
});
