import { TestBed } from '@angular/core/testing';
import { ALShortcutService } from './shortcut.service';
import { ALShortcutDirective } from './shortcut.directive';
import { onShortcut } from './shortcut.hooks';
import { Component, ElementRef, runInInjectionContext, EnvironmentInjector, viewChild } from '@angular/core';
import { inputSuppressorPlugin } from './plugins/input-suppressor.plugin';
import { twicePlugin } from './plugins/twice.plugin';
import { rebindPlugin } from './plugins/rebind.plugin';
import { chordPlugin } from './plugins/chord.plugin';
import { commandPalettePlugin } from './plugins/command-palette.plugin';
import { contextGuardPlugin } from './plugins/context-guard.plugin';
import { visualHintsPlugin } from './plugins/visual-hints.plugin';

@Component({
  template: `
    <div #host [alShortcut]="'ctrl+s'" (alShortcutTriggered)="onShortcutPressed($event)"></div>
    <input #inp type="text" [alShortcut]="'ctrl+s'" (alShortcutTriggered)="onShortcutPressed($event)" />
  `,
  imports: [ALShortcutDirective],
  standalone: true,
})
class TestHostComponent {
  readonly hostEl = viewChild.required<ElementRef<HTMLDivElement>>('host');
  readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('inp');
  triggered = false;
  lastEvent: KeyboardEvent | null = null;

  onShortcutPressed(event: KeyboardEvent) {
    this.triggered = true;
    this.lastEvent = event;
  }
}

@Component({
  template: `
    <div [alShortcut]="'ctrl+g'" [alShortcutGlobal]="true" (alShortcutTriggered)="onGlobalShortcutPressed($event)"></div>
  `,
  imports: [ALShortcutDirective],
  standalone: true,
})
class TestGlobalHostComponent {
  triggered = false;
  onGlobalShortcutPressed(event: KeyboardEvent) {
    this.triggered = true;
  }
}

describe('ALShortcutService & ALShortcutDirective', () => {
  let service: ALShortcutService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent, TestGlobalHostComponent],
    });
    service = TestBed.inject(ALShortcutService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should register and execute a global shortcut', () => {
    let triggered = false;
    let receivedEvent: KeyboardEvent | null = null;

    const unsub = service.register({
      shortcut: 'Ctrl+Alt+S',
      action: (ev) => {
        triggered = true;
        receivedEvent = ev;
      },
      preventDefault: false, // Don't prevent default on simulated tests
    });

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      altKey: true,
    });

    // Simulate keydown event dispatch
    document.dispatchEvent(event);

    expect(triggered).toBe(true);
    expect(receivedEvent).toBe(event);

    // Test unsubscribe
    triggered = false;
    unsub();
    document.dispatchEvent(event);
    expect(triggered).toBe(false);
  });

  it('should support physical Shift + Digit layout translations (e.g. shift+1 mapping)', () => {
    let triggered = false;
    const unsub = service.register({
      shortcut: 'shift+1',
      action: () => {
        triggered = true;
      },
      preventDefault: false,
    });

    // Pressing 'Shift + 1' results in key '!' and code 'Digit1'
    const event = new KeyboardEvent('keydown', {
      key: '!',
      code: 'Digit1',
      shiftKey: true,
    });

    document.dispatchEvent(event);
    expect(triggered).toBe(true);

    unsub();
  });

  it('should translate macOS Option/Alt Layout modified keys using fallback code matching', () => {
    let triggered = false;
    let receivedEvent: KeyboardEvent | null = null;

    const unsub = service.register({
      shortcut: 'ctrl+alt+z',
      action: (ev) => {
        triggered = true;
        receivedEvent = ev;
      },
      preventDefault: false,
    });

    // Simulated macOS Alt event: pressing 'Alt + Z' results in unicode symbol 'Ω' as the event.key,
    // but the physical event.code remains 'KeyZ'.
    const event = new KeyboardEvent('keydown', {
      key: 'Ω',
      code: 'KeyZ',
      ctrlKey: true,
      altKey: true,
    });

    document.dispatchEvent(event);

    expect(triggered).toBe(true);
    expect(receivedEvent).toBe(event);

    unsub();
  });

  it('should utilize W3C navigator.keyboard.getLayoutMap layout translations if available', () => {
    let triggered = false;
    let receivedEvent: KeyboardEvent | null = null;

    const unsub = service.register({
      shortcut: 'ctrl+alt+a',
      action: (ev) => {
        triggered = true;
        receivedEvent = ev;
      },
      preventDefault: false,
    });

    // Provide a mocked getLayoutMap resolution
    const mockMap = new Map<string, string>();
    mockMap.set('KeyA', 'a');
    (service as any).layoutMap = mockMap;

    // Simulate keydown event with a modified locale character layout displacement
    const event = new KeyboardEvent('keydown', {
      key: 'æ',
      code: 'KeyA',
      ctrlKey: true,
      altKey: true,
    });

    document.dispatchEvent(event);

    expect(triggered).toBe(true);
    expect(receivedEvent).toBe(event);

    unsub();
  });

  it('should normalise shortcut structures natively', () => {
    let triggered = false;
    service.register({
      shortcut: 'Shift+Alt+Escape',
      action: () => {
        triggered = true;
      },
      preventDefault: false,
    });

    const event = new KeyboardEvent('keydown', {
      key: 'escape',
      shiftKey: true,
      altKey: true,
    });

    document.dispatchEvent(event);
    expect(triggered).toBe(true);
  });

  it("should block keydown repeat events by default and allow them optionally", () => {
    let triggeredCount = 0;

    const unsub = service.register({
      shortcut: "ctrl+.",
      action: () => {
        triggeredCount++;
      },
      preventDefault: false,
    });

    const standardEvent = new KeyboardEvent("keydown", {
      key: ".",
      ctrlKey: true,
      repeat: false,
    });

    const repeatEvent = new KeyboardEvent("keydown", {
      key: ".",
      ctrlKey: true,
      repeat: true,
    });

    document.dispatchEvent(standardEvent);
    document.dispatchEvent(repeatEvent);

    // By default allowRepeat is false, so repeat should be blocked.
    expect(triggeredCount).toBe(1);

    // Re-register with allowRepeat enabled
    unsub();
    triggeredCount = 0;

    const unsubRepeat = service.register({
      shortcut: "ctrl+.",
      action: () => {
        triggeredCount++;
      },
      preventDefault: false,
      allowRepeat: true,
    });

    document.dispatchEvent(standardEvent);
    document.dispatchEvent(repeatEvent);

    // Should allow both standard and repeat events
    expect(triggeredCount).toBe(2);

    unsubRepeat();
  });

  it('should support priority configuration', () => {
    const order: number[] = [];

    service.register({ shortcut: 'ctrl+a', action: () => order.push(1), priority: 10, preventDefault: false });
    service.register({ shortcut: 'ctrl+a', action: () => order.push(2), priority: 20, preventDefault: false });
    service.register({ shortcut: 'ctrl+a', action: () => order.push(3), priority: 5, preventDefault: false });

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
    });

    document.dispatchEvent(event);

    // Highest priority (20 -> 10 -> 5) should execute first
    expect(order).toEqual([2, 1, 3]);
  });

  it('should support functional plugins' , () => {
    const serviceWithPlugin = TestBed.inject(ALShortcutService);
    let triggered = false;

    serviceWithPlugin.registerPlugin(inputSuppressorPlugin());
    serviceWithPlugin.register({
      shortcut: 'ctrl+s',
      action: () => {
        triggered = true;
      },
      preventDefault: false,
    });

    const input = document.createElement('input');
    document.body.appendChild(input);

    const eventInInput = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
    });

    input.dispatchEvent(eventInInput);
    expect(triggered).toBe(false); // Suppressed inside input via inputSuppressorPlugin

    // Now emit on document body
    const eventOutside = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
    });
    document.body.dispatchEvent(eventOutside);
    expect(triggered).toBe(true);

    // Clean up DOM element
    input.remove();
  });

  it('should prevent default browser behavior when configured', () => {
    let triggered = false;
    service.register({
      shortcut: 'ctrl+s',
      action: () => {
        triggered = true;
      },
      preventDefault: true,
    });

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      cancelable: true,
    });

    const preventSpy = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);
    expect(triggered).toBe(true);
    expect(preventSpy).toHaveBeenCalled();
  });

  it('should support bulk-registering multiple shortcuts simultaneously with a unified unsubscribe', () => {
    let saveTriggered = false;
    let printTriggered = false;

    const unsubAll = service.register([
      {
        shortcut: 'ctrl+s',
        action: () => {
          saveTriggered = true;
        },
        preventDefault: false,
      },
      {
        shortcut: 'ctrl+p',
        action: () => {
          printTriggered = true;
        },
        preventDefault: false,
      },
    ]);

    const saveEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const printEvent = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });

    document.dispatchEvent(saveEvent);
    document.dispatchEvent(printEvent);

    expect(saveTriggered).toBe(true);
    expect(printTriggered).toBe(true);

    // Reset flags and trigger teardown
    saveTriggered = false;
    printTriggered = false;
    unsubAll();

    document.dispatchEvent(saveEvent);
    document.dispatchEvent(printEvent);

    expect(saveTriggered).toBe(false);
    expect(printTriggered).toBe(false);
  });

  it('should work declaration-style using the ALShortcutDirective', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
    });

    expect(component.triggered).toBe(false);
    component.hostEl().nativeElement.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.triggered).toBe(true);
    expect(component.lastEvent).toBe(event);
  });

  it('should support global-scoped registration when alShortcutGlobal is true', () => {
    const fixture = TestBed.createComponent(TestGlobalHostComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const event = new KeyboardEvent('keydown', {
      key: 'g',
      ctrlKey: true,
      bubbles: true,
    });

    expect(component.triggered).toBe(false);
    // Dispatching directly to document instead of component element
    document.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.triggered).toBe(true);
  });

  it('should support double press plugin (twicePlugin)', () => {
    const serviceWithTwice = TestBed.inject(ALShortcutService);
    const twice = serviceWithTwice.registerPlugin(twicePlugin({ delayMs: 400 }));

    let callCount = 0;
    const unsub = twice.register('shift', () => {
      callCount++;
    }, { description: 'Double Shift' });

    expect(twice.getTwiceRegistrations()).toEqual([
      { sequence: 'shift', description: 'Double Shift' }
    ]);

    // First shift tap
    const ev1 = new KeyboardEvent('keyup', { key: 'Shift' });
    document.dispatchEvent(ev1);
    expect(callCount).toBe(0);

    // Second shift tap (within 400ms)
    const ev2 = new KeyboardEvent('keyup', { key: 'Shift' });
    document.dispatchEvent(ev2);
    expect(callCount).toBe(1);

    // Test cleanup
    unsub();
    const ev3 = new KeyboardEvent('keyup', { key: 'Shift' });
    document.dispatchEvent(ev3);
    document.dispatchEvent(ev3);
    expect(callCount).toBe(1); // Should not increase after unsubscribe
  });

  it('should support rebindPlugin on setOverride and clearOverrides', () => {
    const serviceWithRebind = TestBed.inject(ALShortcutService);
    const rebind = serviceWithRebind.registerPlugin(rebindPlugin({ storageKey: 'test-rebind-keys' }));

    let triggeredCount = 0;
    const unsub = serviceWithRebind.register({
      shortcut: 'ctrl+s',
      action: () => triggeredCount++,
      preventDefault: false,
    });

    // 1. Initially ctrl+s triggers it
    const eventCtrlS = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    document.dispatchEvent(eventCtrlS);
    expect(triggeredCount).toBe(1);

    // 2. Set override to ctrl+shift+s
    rebind.setOverride('ctrl+s', 'ctrl+shift+s');
    
    // Pressing ctrl+s shouldn't do anything now
    document.dispatchEvent(eventCtrlS);
    expect(triggeredCount).toBe(1);

    // Pressing ctrl+shift+s should work
    const eventCtrlShiftS = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true });
    document.dispatchEvent(eventCtrlShiftS);
    expect(triggeredCount).toBe(2);

    // 3. Clear overrides
    rebind.clearOverrides();

    // ctrl+shift+s shouldn't work anymore
    document.dispatchEvent(eventCtrlShiftS);
    expect(triggeredCount).toBe(2);

    // ctrl+s should work again!
    document.dispatchEvent(eventCtrlS);
    expect(triggeredCount).toBe(3);

    unsub();
  });

  it('should retrospectively capture and rebind existing shortcuts', () => {
    const serviceWithRebind = TestBed.inject(ALShortcutService);

    let preTriggered = 0;
    // 1. Register a shortcut BEFORE registering rebindPlugin
    const originalUnsub = serviceWithRebind.register({
      shortcut: 'ctrl+y',
      action: () => preTriggered++,
      preventDefault: false,
    });

    const eventCtrlY = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
    document.dispatchEvent(eventCtrlY);
    expect(preTriggered).toBe(1);

    // 2. Register rebindPlugin (it should retrospectively capture the ctrl+y shortcut!)
    const rebind = serviceWithRebind.registerPlugin(rebindPlugin({ storageKey: 'test-rebind-keys-retro' }));

    // 3. Set override for ctrl+y to ctrl+i
    rebind.setOverride('ctrl+y', 'ctrl+i');

    // Key ctrl+y should NOT trigger it anymore
    document.dispatchEvent(eventCtrlY);
    expect(preTriggered).toBe(1);

    // Key ctrl+i SHOULD trigger it
    const eventCtrlI = new KeyboardEvent('keydown', { key: 'i', ctrlKey: true });
    document.dispatchEvent(eventCtrlI);
    expect(preTriggered).toBe(2);

    // 4. Test original unsub when overridden
    originalUnsub();

    // Now ctrl+i should NOT trigger anymore
    document.dispatchEvent(eventCtrlI);
    expect(preTriggered).toBe(2);
  });

  it('should support onShortcut functional Hook in injection context', () => {
    let triggered = false;
    const injector = TestBed.inject(EnvironmentInjector);

    runInInjectionContext(injector, () => {
      onShortcut('ctrl+k', () => { triggered = true; }, { preventDefault: false });
    });

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true
    });
    document.dispatchEvent(event);

    expect(triggered).toBe(true);
  });

  it('should support programmatically triggering actions via service.trigger()', () => {
    let saveCount = 0;
    const unsub = service.register({
      shortcut: 'ctrl+s',
      action: () => { saveCount++; },
      description: 'Save Document',
    });

    const result = service.trigger('ctrl+s');
    expect(result).toBe(true);
    expect(saveCount).toBe(1);

    // Trigger via descriptor object
    const shortcuts = service.getShortcuts();
    expect(shortcuts.length).toBeGreaterThan(0);
    const saveShortcut = shortcuts.find(s => s.description === 'Save Document');
    expect(saveShortcut).toBeDefined();

    const resultDescriptor = service.trigger(saveShortcut!);
    expect(resultDescriptor).toBe(true);
    expect(saveCount).toBe(2);

    unsub();
  });

  it('should support chordPlugin for multi-key sequences', () => {
    const chord = service.registerPlugin(chordPlugin({ timeoutMs: 1000 }));
    let chordRun = false;

    const unsub = chord.register('g d', () => {
      chordRun = true;
    }, { description: 'Go to Definition' });

    expect(chord.getChords()).toEqual([
      { sequence: 'g d', description: 'Go to Definition' }
    ]);

    // Key sequence: 'g' then 'd'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    expect(chordRun).toBe(true);

    // Test teardown
    unsub();
    chordRun = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(chordRun).toBe(false);
  });

  it('should support commandPalettePlugin toggling and shortcuts lookup', () => {
    const palette = service.registerPlugin(commandPalettePlugin({ triggerShortcut: 'ctrl+shift+p' }));
    let saveTriggered = false;

    const unsubSave = service.register({
      shortcut: 'ctrl+s',
      action: () => { saveTriggered = true; },
      description: 'Save Workspace File'
    });

    expect(palette.visible()).toBe(false);

    palette.open();
    expect(palette.visible()).toBe(true);

    const available = palette.getShortcuts();
    expect(available.some(item => item.description === 'Save Workspace File')).toBe(true);

    palette.close();
    expect(palette.visible()).toBe(false);

    unsubSave();
  });

  it('should support contextGuardPlugin to dynamically block or whitelist shortcuts', () => {
    const guard = service.registerPlugin(contextGuardPlugin());
    let actionCount = 0;

    const unsub = service.register({
      shortcut: 'ctrl+s',
      action: () => { actionCount++; },
      preventDefault: false
    });

    guard.addRule('modal-active', { type: 'block', shortcuts: ['ctrl+s'] });

    // When context is inactive, ctrl+s works
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(actionCount).toBe(1);

    // Activate 'modal-active' context
    guard.setContext('modal-active', true);
    expect(guard.isContextActive('modal-active')).toBe(true);
    expect(guard.getActiveContexts()).toEqual(['modal-active']);

    // ctrl+s should be blocked now
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(actionCount).toBe(1);

    // Deactivate context
    guard.setContext('modal-active', false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(actionCount).toBe(2);

    unsub();
  });

  it('should support visualHintsPlugin link hinting mode', () => {
    const hints = service.registerPlugin(visualHintsPlugin({ triggerShortcut: 'ctrl+g' }));

    const btn = document.createElement('button');
    btn.textContent = 'Action Button';
    document.body.appendChild(btn);

    let clicked = false;
    btn.addEventListener('click', () => { clicked = true; });

    expect(hints.isActive()).toBe(false);

    hints.startHinting();
    expect(hints.isActive()).toBe(true);

    hints.stopHinting();
    expect(hints.isActive()).toBe(false);

    btn.remove();
  });
});
