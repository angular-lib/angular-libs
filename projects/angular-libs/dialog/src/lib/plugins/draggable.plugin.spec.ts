import { draggablePlugin } from './draggable.plugin';

describe('draggablePlugin', () => {
  let dialogEl: HTMLDialogElement;
  let contentRoot: HTMLElement;
  let teardown: () => void;

  beforeEach(() => {
    dialogEl = document.createElement('dialog');

    contentRoot = document.createElement('div');
    contentRoot.dataset['alDialogContent'] = 'true';
    dialogEl.appendChild(contentRoot);
    document.body.appendChild(dialogEl);

    const mockDialogRef = {
      dialogEl,
      options: {},
    } as any;

    const plugin = draggablePlugin();
    teardown = plugin.setup!({ element: dialogEl, dialogRef: mockDialogRef, injector: null as any }) as () => void;
  });

  afterEach(() => {
    teardown();
    dialogEl.remove();
  });

  it('should mirror dragging class to the content root on pointer interaction', () => {
    // Start drag
    const pointerDown = new PointerEvent('pointerdown', { button: 0, bubbles: true });
    dialogEl.dispatchEvent(pointerDown);

    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(true);
    expect(contentRoot.classList.contains('al-dialog-dragging')).toBe(true);

    // Stop drag
    const pointerUp = new PointerEvent('pointerup', { bubbles: true });
    dialogEl.dispatchEvent(pointerUp);

    expect(dialogEl.classList.contains('al-dialog-dragging')).toBe(false);
    expect(contentRoot.classList.contains('al-dialog-dragging')).toBe(false);
  });
});
