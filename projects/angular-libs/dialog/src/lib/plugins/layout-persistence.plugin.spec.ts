import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { layoutPersistencePlugin } from './layout-persistence.plugin';
import { getPosition, getSize, isMaximized, setPosition } from '../actions';

@Component({
  selector: 'test-persist-cmp',
  standalone: true,
  template: '<div>Persistent Dialog</div>',
})
class TestPersistComponent {}

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  setItem(key: string, value: string) {
    this.store[key] = value;
  }
}

describe('layoutPersistencePlugin', () => {
  let mockStorage: MockStorage;

  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('should restore previously saved coordinates and dimensions on setup', async () => {
    const savedState = {
      position: { x: 150, y: 250 },
      size: { width: '450px', height: '350px' },
      minimized: false,
      maximized: false,
    };
    mockStorage.setItem('al_dlg-key-1', JSON.stringify(savedState));

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      plugins: [layoutPersistencePlugin({ key: 'dlg-key-1', storage: mockStorage })],
    });

    try {
      expect(getPosition(ref).x).toBe(150);
      expect(getPosition(ref).y).toBe(250);
      expect(getSize(ref).width).toBe('450px');
      expect(getSize(ref).height).toBe('350px');
    } finally {
      ref.close();
    }
  });

  it('should save position, size, minimized, and maximized changes dynamically', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      modal: false,
      plugins: [layoutPersistencePlugin({ key: 'dlg-key-2', storage: mockStorage })],
    });

    try {
      // Wait for initial non-modal centering timeout
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPosition(ref, 50, 100, '300px', '200px');

      // Force mutation observer update
      await new Promise((resolve) => setTimeout(resolve, 10));

      const savedRaw = mockStorage.getItem('al_dlg-key-2');
      expect(savedRaw).toBeDefined();

      const saved = JSON.parse(savedRaw!);
      expect(saved.position.x).toBe(50);
      expect(saved.position.y).toBe(100);
      expect(saved.size.width).toBe('300px');
      expect(saved.size.height).toBe('200px');
      expect(saved.minimized).toBe(false);
      expect(saved.maximized).toBe(false);
    } finally {
      ref.close();
    }
  });

  it('should restore minimized or maximized state onOpen', async () => {
    const savedStateMaximized = {
      position: { x: 0, y: 0 },
      size: { width: '100vw', height: '100vh' },
      minimized: false,
      maximized: true,
    };
    mockStorage.setItem('al_dlg-key-max', JSON.stringify(savedStateMaximized));

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      plugins: [layoutPersistencePlugin({ key: 'dlg-key-max', storage: mockStorage })],
    });

    try {
      expect(isMaximized(ref)).toBe(true);
    } finally {
      ref.close();
    }
  });

  it('should support dynamic state solutions with synchronous custom restore and save callbacks', async () => {
    let savedState: any = null;
    const initialConfig = {
      position: { x: 120, y: 180 },
      size: { width: '500px', height: '400px' },
      minimized: false,
      maximized: false,
    };

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      modal: false,
      plugins: [
        layoutPersistencePlugin({
          restore: () => initialConfig,
          save: (state) => {
            savedState = state;
          },
        }),
      ],
    });

    try {
      expect(getPosition(ref).x).toBe(120);
      expect(getPosition(ref).y).toBe(180);
      expect(getSize(ref).width).toBe('500px');
      expect(getSize(ref).height).toBe('400px');

      setPosition(ref, 200, 300, '600px', '500px');
      expect(savedState).not.toBeNull();
      expect(savedState.position.x).toBe(200);
      expect(savedState.position.y).toBe(300);
      expect(savedState.size.width).toBe('600px');
      expect(savedState.size.height).toBe('500px');
    } finally {
      ref.close();
    }
  });

  it('should support dynamic state solutions with asynchronous custom restore', async () => {
    const apiConfig = {
      position: { x: 230, y: 340 },
      size: { width: '200px', height: '150px' },
      minimized: false,
      maximized: false,
    };
    const asyncRestorePromise = Promise.resolve(apiConfig);

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      plugins: [
        layoutPersistencePlugin({
          restore: () => asyncRestorePromise,
        }),
      ],
    });

    try {
      // Allow async promise microtask to flush
      await asyncRestorePromise;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(getPosition(ref).x).toBe(230);
      expect(getPosition(ref).y).toBe(340);
      expect(getSize(ref).width).toBe('200px');
      expect(getSize(ref).height).toBe('150px');
    } finally {
      ref.close();
    }
  });

  it('should support override prefix or custom prefix on storage', async () => {
    const savedState = {
      position: { x: 100, y: 100 },
      size: { width: '100px', height: '100px' },
      minimized: false,
      maximized: false,
    };
    mockStorage.setItem('custom_dlg-key-custom', JSON.stringify(savedState));

    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestPersistComponent, {
      plugins: [layoutPersistencePlugin({ key: 'dlg-key-custom', prefix: 'custom_', storage: mockStorage })],
    });

    try {
      expect(getPosition(ref).x).toBe(100);
      expect(getPosition(ref).y).toBe(100);
    } finally {
      ref.close();
    }
  });
});
