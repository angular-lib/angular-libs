import { DialogRef } from '../dialog-ref';

export interface WindowLayoutState {
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: string; height: string };
  lastStateRect?: DOMRect;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onRestore?: () => void;
  _onStateChange?: (state: 'minimized' | 'maximized' | 'restored') => void;
}

const windowStates = new WeakMap<DialogRef<any, any>, WindowLayoutState>();

export function getWindowState(ref: DialogRef<any, any>): WindowLayoutState {
  let state = windowStates.get(ref);
  if (!state) {
    state = {
      isMinimized: false,
      isMaximized: false,
      position: { x: 0, y: 0 },
      size: { width: '', height: '' },
    };
    windowStates.set(ref, state);
  }
  return state;
}

export function triggerLayoutChangeHook(
  dialogRef: DialogRef<any, any>,
  layoutState: 'normal' | 'minimized' | 'maximized' | 'resized' | 'dragged',
): void {
  const state = getWindowState(dialogRef);
  const plugins = dialogRef.options?.plugins;
  if (plugins) {
    plugins.forEach((p) => {
      p.onLayoutChange?.({
        element: dialogRef.dialogEl,
        dialogRef,
        injector: dialogRef.injector || (null as any),
        changes: {
          state: layoutState,
          x: state.position.x,
          y: state.position.y,
          width: state.size.width,
          height: state.size.height,
        },
      });
    });
  }
}

