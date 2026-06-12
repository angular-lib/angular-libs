import { snapToEdgePlugin } from './snap-to-edge.plugin';
import { snapToEdge } from '../actions/snap-to-edge';

describe('snapToEdgePlugin', () => {
  let dialogEl: HTMLDialogElement;
  let teardown: () => void;
  let mockDialogRef: any;

  beforeEach(() => {
    // Mock the window size
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);

    dialogEl = document.createElement('dialog');
    // Ensure open so it passes open-checks
    Object.defineProperty(dialogEl, 'open', { value: true, writable: true });
    
    // Mock getBoundingClientRect
    dialogEl.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 200,
      top: 150,
      width: 400,
      height: 300,
    } as DOMRect);

    document.body.appendChild(dialogEl);

    mockDialogRef = {
      dialogEl,
      options: {
        plugins: []
      },
    } as any;

    const plugin = snapToEdgePlugin();
    mockDialogRef.options.plugins = [plugin];
    teardown = plugin.setup!({ element: dialogEl, dialogRef: mockDialogRef, injector: null as any }) as () => void;
  });

  afterEach(() => {
    if (teardown) teardown();
    dialogEl.remove();
    vi.unstubAllGlobals();
  });

  it('should snap to left when Alt + ArrowLeft is pressed', () => {
    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
    });

    dialogEl.dispatchEvent(keydown);

    // Expect transform translates x correctly to Align top-left with (0,0) and resize half-width
    expect(dialogEl.style.width).toBe('500px'); // 1000 / 2
    expect(dialogEl.style.height).toBe('800px'); // 800
    expect(dialogEl.style.transform).toBe('translate3d(0px, 0px, 0)');
  });

  it('should snap to right when Alt + ArrowRight is pressed', () => {
    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    });

    dialogEl.dispatchEvent(keydown);

    expect(dialogEl.style.width).toBe('500px'); // 1000 / 2
    expect(dialogEl.style.height).toBe('800px');
    expect(dialogEl.style.transform).toBe('translate3d(500px, 0px, 0)');
  });

  it('should snap to top when Alt + ArrowUp is pressed', () => {
    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      altKey: true,
      bubbles: true,
    });

    dialogEl.dispatchEvent(keydown);

    // Expect transform translates x correctly to Align top-left with (0,0) and resize half-height
    expect(dialogEl.style.width).toBe('1000px');
    expect(dialogEl.style.height).toBe('400px'); // 800 / 2
    expect(dialogEl.style.transform).toBe('translate3d(0px, 0px, 0)');
  });

  it('should snap to bottom when Alt + ArrowDown is pressed', () => {
    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      bubbles: true,
    });

    dialogEl.dispatchEvent(keydown);

    expect(dialogEl.style.width).toBe('1000px');
    expect(dialogEl.style.height).toBe('400px'); // 800 / 2
    expect(dialogEl.style.transform).toBe('translate3d(0px, 400px, 0)');
  });
});
