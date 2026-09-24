import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from './event-bus';
import { MemoryStorage } from './testing/memory-storage';

interface CanvasEvents {
  'shape:moved': number;
  'shape:colored': string;
  'shortcut:undo': void;
  'clicked': void;
  'reset': void;
}

@Injectable()
class CanvasBus extends ALEventBus<CanvasEvents> {
  shape = this.projection(
    { x: 0, color: 'red' },
    {
      'shape:moved': (s, x) => ({ ...s, x }),
      'shape:colored': (s, color) => (color === s.color ? s : { ...s, color }),
    },
    { undo: { limit: 3 } },
  );
  clicks = this.projection(0, { clicked: (n) => n + 1, reset: () => 0 });
  log = this.projection<string[]>([], { 'shape:colored': (lines, c) => [...lines, c], reset: () => [] });

  constructor() {
    super();
    this.on('shortcut:undo', () => this.shape.undo());
  }
}

describe('ALEventBus.projection', () => {
  let bus: CanvasBus;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CanvasBus] });
    bus = TestBed.inject(CanvasBus);
  });

  it('counts every occurrence, including identical payloads', () => {
    bus.emit('clicked');
    bus.emit('clicked');
    bus.emit('clicked');
    expect(bus.clicks.state()).toBe(3);
    bus.emit('reset');
    expect(bus.clicks.state()).toBe(0);
  });

  it('types reducers from the state, including empty literals', () => {
    bus.emit('shape:colored', 'blue');
    expect(bus.log.state()).toEqual(['blue']);
  });

  it('undo/redo restore whole states across event keys', () => {
    bus.emit('shape:moved', 10);
    bus.emit('shape:colored', 'blue');
    bus.shape.undo();
    expect(bus.shape.state()).toEqual({ x: 10, color: 'red' });
    bus.shape.undo();
    expect(bus.shape.state()).toEqual({ x: 0, color: 'red' });
    expect(bus.shape.canUndo()).toBe(false);
    expect(bus.shape.undo()).toBe(false);

    bus.shape.redo();
    expect(bus.shape.state().x).toBe(10);
    expect(bus.shape.canRedo()).toBe(true);
    bus.emit('shape:moved', 20);
    expect(bus.shape.canRedo()).toBe(false);
  });

  it('does not record history when a reducer returns the same state', () => {
    bus.emit('shape:colored', 'red');
    expect(bus.shape.canUndo()).toBe(false);
  });

  it('respects the undo limit; clearHistory and reset work', () => {
    for (const x of [1, 2, 3, 4, 5]) bus.emit('shape:moved', x);
    while (bus.shape.undo());
    expect(bus.shape.state().x).toBe(2);

    bus.shape.clearHistory();
    expect([bus.shape.canUndo(), bus.shape.canRedo()]).toEqual([false, false]);
    bus.shape.reset();
    expect(bus.shape.state()).toEqual({ x: 0, color: 'red' });
  });

  it('undo triggered from a handler behaves like a direct call', () => {
    bus.emit('shape:moved', 5);
    bus.emit('shortcut:undo');
    expect(bus.shape.state().x).toBe(0);
    expect(bus.shape.canRedo()).toBe(true);
  });

  it('undo is a no-op without the undo option', () => {
    bus.emit('clicked');
    expect(bus.clicks.canUndo()).toBe(false);
    expect(bus.clicks.undo()).toBe(false);
    expect(bus.clicks.state()).toBe(1);
  });
});

describe('ALEventBus.projection persist', () => {
  let storage: MemoryStorage;

  function open(version = 1) {
    @Injectable()
    class CartBus extends ALEventBus<{ 'cart:add': string; 'cart:clear': void }> {
      cart = this.projection<string[]>(
        [],
        { 'cart:add': (items, sku) => [...items, sku], 'cart:clear': () => [] },
        { undo: true, persist: { key: 'cart', version, storage } },
      );
      label = this.projection('none', { 'cart:add': (_s, sku) => sku }, { persist: 'projection-spec-label' });
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [CartBus] });
    return TestBed.inject(CartBus);
  }

  beforeEach(() => {
    storage = new MemoryStorage();
    localStorage.removeItem('projection-spec-label');
  });

  it('restores the state after a reload, and saves on every change including undo/redo', () => {
    const bus = open();
    bus.emit('cart:add', 'a');
    bus.emit('cart:add', 'b');
    expect(open().cart.state()).toEqual(['a', 'b']);

    const reloaded = open();
    expect(reloaded.cart.canUndo()).toBe(false); // history is not saved
    reloaded.emit('cart:add', 'c');
    reloaded.cart.undo();
    expect(storage.json('cart')).toEqual({ v: 1, data: ['a', 'b'] });
    reloaded.cart.redo();
    expect(open().cart.state()).toEqual(['a', 'b', 'c']);
  });

  it('reset() returns to the initial state and removes the saved value', () => {
    const bus = open();
    bus.emit('cart:add', 'a');
    bus.cart.reset();
    expect(storage.items.has('cart')).toBe(false);
    expect(open().cart.state()).toEqual([]);
  });

  it('starts from the initial state when the saved version differs', () => {
    open().emit('cart:add', 'a');
    expect(open(2).cart.state()).toEqual([]);
  });

  it('accepts a plain storage key and uses localStorage', () => {
    open().emit('cart:add', 'z');
    expect(open().label.state()).toBe('z');
    localStorage.removeItem('projection-spec-label');
  });
});
