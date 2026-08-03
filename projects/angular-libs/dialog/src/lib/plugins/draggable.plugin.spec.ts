import { draggablePlugin } from './draggable.plugin';

describe('draggablePlugin', () => {
  let dialogEl: HTMLDialogElement;
  let contentRoot: HTMLElement;
  let teardown: (() => void) | void;

  function setupPlugin(options?: Parameters<typeof draggablePlugin>[0], withHeader = false) {
    dialogEl = document.createElement('dialog');
    dialogEl.style.width = '200px';
    dialogEl.style.height = '150px';
    Object.defineProperty(dialogEl, 'getBoundingClientRect', {
      value: () => ({
        left: 100,
        top: 100,
        right: 300,
        bottom: 250,
        width: 200,
        height: 150,
        x: 100,
        y: 100,
        toJSON() {},
      }),
    });

    contentRoot = document.createElement('div');
    contentRoot.dataset['alDialogContent'] = 'true';
    if (withHeader) {
      const header = document.createElement('header');
      header.className = 'al-dialog-header';
      contentRoot.appendChild(header);
    }
    dialogEl.appendChild(contentRoot);
    document.body.appendChild(dialogEl);

    const mockDialogRef = {
      dialogEl,
      options: {},
    } as any;

    const plugin = draggablePlugin(options);
    teardown = plugin.setup!({ element: dialogEl, dialogRef: mockDialogRef, injector: null as any });
  }

  afterEach(() => {
    teardown?.();
    dialogEl?.remove();
  });

  it('should mirror dragging class to the content root on pointer interaction', () => {
    setupPlugin();
    const pointerDown = new PointerEvent('pointerdown', {
      button: 0,
      bubbles: true,
      clientX: 150,
      clientY: 150,
    });
    dialogEl.dispatchEvent(pointerDown);

    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(true);
    expect(contentRoot.classList.contains('al-dialog-dragging')).toBe(true);

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(false);
    expect(contentRoot.classList.contains('al-dialog-dragging')).toBe(false);
  });

  it('should not start drag on the CSS resize edge when resize is enabled', () => {
    setupPlugin();
    dialogEl.style.resize = 'both';

    const onCorner = new PointerEvent('pointerdown', {
      button: 0,
      bubbles: true,
      clientX: 295, // near right edge of rect (right=300)
      clientY: 245, // near bottom edge (bottom=250)
    });
    dialogEl.dispatchEvent(onCorner);

    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(false);
  });

  it('should prefer .al-dialog-header as drag handle when present', () => {
    setupPlugin(undefined, true);

    const bodyDown = new PointerEvent('pointerdown', {
      button: 0,
      bubbles: true,
      clientX: 150,
      clientY: 200,
    });
    contentRoot.dispatchEvent(bodyDown);
    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(false);

    const header = contentRoot.querySelector('.al-dialog-header')!;
    const headerDown = new PointerEvent('pointerdown', {
      button: 0,
      bubbles: true,
      clientX: 150,
      clientY: 110,
    });
    header.dispatchEvent(headerDown);
    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(true);
  });
});
