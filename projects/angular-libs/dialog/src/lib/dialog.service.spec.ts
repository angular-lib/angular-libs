import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

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
});
