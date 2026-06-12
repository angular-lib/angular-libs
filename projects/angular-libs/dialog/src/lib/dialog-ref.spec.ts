import { DialogRef } from './dialog-ref';
import { minimize, maximize, restore, getPosition, getSize } from './actions';
import { getWindowState } from './actions/state';

describe('DialogRef', () => {
  let dialogEl: HTMLDialogElement;
  let contentRoot: HTMLElement;
  let dialogRef: DialogRef;

  beforeEach(() => {
    dialogEl = document.createElement('dialog');
    dialogEl.close = vi.fn().mockImplementation(() => {
      dialogEl.open = false;
    });
    // The dialog must be visually 'open' to toggle min/max natively
    dialogEl.open = true;

    contentRoot = document.createElement('div');
    contentRoot.dataset['alDialogContent'] = 'true';
    dialogEl.appendChild(contentRoot);
    document.body.appendChild(dialogEl);

    // Initialize with modal = false, since minimize only works on non-modal dialogs
    dialogRef = new DialogRef(dialogEl, { modal: false });
  });

  afterEach(() => {
    dialogRef._finishClose(); // cleanup event listeners
    dialogEl.remove();
  });

  it('should mirror minimize class to the content root', () => {
    minimize(dialogRef);
    expect(dialogEl.classList.contains('al-dialog-minimized')).toBe(true);
    expect(contentRoot.classList.contains('al-dialog-minimized')).toBe(true);

    restore(dialogRef);
    expect(dialogEl.classList.contains('al-dialog-minimized')).toBe(false);
    expect(contentRoot.classList.contains('al-dialog-minimized')).toBe(false);
  });

  it('should mirror maximize class to the content root', () => {
    maximize(dialogRef);
    expect(dialogEl.classList.contains('al-dialog-maximized')).toBe(true);
    expect(contentRoot.classList.contains('al-dialog-maximized')).toBe(true);

    restore(dialogRef);
    expect(dialogEl.classList.contains('al-dialog-maximized')).toBe(false);
    expect(contentRoot.classList.contains('al-dialog-maximized')).toBe(false);
  });

  it('should run beforeClose hook on plugins and block close if plugin returns false', async () => {
    let beforeCloseSource: string | null = null;
    const mockPlugin = {
      beforeClose: vi.fn().mockImplementation((event) => {
        beforeCloseSource = event.source;
        return false; // prevent closing
      })
    };
    const ref = new DialogRef(dialogEl, { modal: false, plugins: [mockPlugin] });
    
    await ref.close('some-result', 'escape');
    
    expect(mockPlugin.beforeClose).toHaveBeenCalledWith({ element: dialogEl, dialogRef: ref, injector: null, source: 'escape' });
    expect(beforeCloseSource).toBe('escape');
    expect(dialogEl.open).toBe(true); // close was prevented!
  });

  it('should run beforeClose hook on plugins and allow close if they return true or void', async () => {
    const mockPlugin = {
      beforeClose: vi.fn().mockReturnValue(true)
    };
    const ref = new DialogRef(dialogEl, { modal: false, plugins: [mockPlugin] });
    
    await ref.close('some-result', 'manual');
    
    expect(mockPlugin.beforeClose).toHaveBeenCalledWith({ element: dialogEl, dialogRef: ref, injector: null, source: 'manual' });
    expect(dialogEl.open).toBe(false); // close occurred!
  });

  it('should trigger _onStateChange when minimize, restore, and maximize are called with correct states', () => {
    const onStateChange = vi.fn();
    getWindowState(dialogRef)._onStateChange = onStateChange;

    minimize(dialogRef);
    expect(onStateChange).toHaveBeenCalledWith('minimized');

    restore(dialogRef);
    expect(onStateChange).toHaveBeenCalledWith('restored');

    maximize(dialogRef);
    expect(onStateChange).toHaveBeenCalledWith('maximized');
  });

  it('should trigger onMinimize, onMaximize, and onRestore callback properties and layout change plugin hooks', () => {
    const localMinimize = vi.fn();
    const localMaximize = vi.fn();
    const localRestore = vi.fn();

    const mockPlugin = {
      onLayoutChange: vi.fn(),
    };

    const ref = new DialogRef(dialogEl, {
      modal: false,
      plugins: [mockPlugin],
    });

    const state = getWindowState(ref);
    state.onMinimize = localMinimize;
    state.onMaximize = localMaximize;
    state.onRestore = localRestore;

    minimize(ref);
    expect(localMinimize).toHaveBeenCalledTimes(1);
    expect(mockPlugin.onLayoutChange).toHaveBeenCalledWith({
      element: dialogEl,
      dialogRef: ref,
      injector: null,
      changes: {
        state: 'minimized',
        x: getPosition(ref).x,
        y: getPosition(ref).y,
        width: getSize(ref).width,
        height: getSize(ref).height,
      },
    });

    restore(ref);
    expect(localRestore).toHaveBeenCalledTimes(1);
    expect(mockPlugin.onLayoutChange).toHaveBeenCalledWith({
      element: dialogEl,
      dialogRef: ref,
      injector: null,
      changes: {
        state: 'normal',
        x: getPosition(ref).x,
        y: getPosition(ref).y,
        width: getSize(ref).width,
        height: getSize(ref).height,
      },
    });

    maximize(ref);
    expect(localMaximize).toHaveBeenCalledTimes(1);
    expect(mockPlugin.onLayoutChange).toHaveBeenCalledWith({
      element: dialogEl,
      dialogRef: ref,
      injector: null,
      changes: {
        state: 'maximized',
        x: getPosition(ref).x,
        y: getPosition(ref).y,
        width: getSize(ref).width,
        height: getSize(ref).height,
      },
    });

    restore(ref);
    expect(localRestore).toHaveBeenCalledTimes(2);
  });
});
