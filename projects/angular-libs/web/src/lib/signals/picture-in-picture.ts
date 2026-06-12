import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface PictureInPictureSignalState {
  /** If Picture-in-Picture is supported and enabled in the browser. */
  supported: boolean;
  /** Whether Picture-in-Picture mode is currently active. */
  active: boolean;
}

export interface PictureInPictureSignal {
  /** Readonly signal containing current PiP support and active status. */
  state: Signal<PictureInPictureSignalState>;
  /** Requests entering Picture-in-Picture mode for a specific HTMLVideoElement. */
  request(videoElement: HTMLVideoElement): Promise<any>;
  /** Exits active Picture-in-Picture mode. */
  exit(): Promise<void>;
}

/**
 * Exposes a reactive state and control commands for Picture-In-Picture (PiP) video streams.
 *
 * @returns An object matching PictureInPictureSignal with state methods.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <video #myVideo src="movie.mp4" controls></video>
 *     <button (click)="pip.request(myVideo)">Float video</button>
 *   `
 * })
 * export class VideoPlayerComponent {
 *   pip = pictureInPictureSignal();
 * }
 * ```
 */
export function pictureInPictureSignal(): PictureInPictureSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const supported = !!(doc && 'pictureInPictureEnabled' in doc && doc.pictureInPictureEnabled);

  const state = signal<PictureInPictureSignalState>({
    supported,
    active: !!(doc && doc.pictureInPictureElement),
  });

  let activeVideoElement: HTMLVideoElement | null = null;

  const handleEnterPiP = () => {
    state.set({ supported, active: true });
  };

  const handleLeavePiP = () => {
    state.set({ supported, active: false });
    activeVideoElement = null;
  };

  const cleanUpListeners = () => {
    if (activeVideoElement) {
      activeVideoElement.removeEventListener('enterpictureinpicture', handleEnterPiP);
      activeVideoElement.removeEventListener('leavepictureinpicture', handleLeavePiP);
    }
  };

  const request = async (videoElement: HTMLVideoElement): Promise<any> => {
    if (!supported || !doc) return null;

    try {
      if (doc.pictureInPictureElement === videoElement) {
        return doc.pictureInPictureElement;
      }

      cleanUpListeners();

      const pipWindow = await videoElement.requestPictureInPicture();
      activeVideoElement = videoElement;

      videoElement.addEventListener('enterpictureinpicture', handleEnterPiP);
      videoElement.addEventListener('leavepictureinpicture', handleLeavePiP);

      state.set({ supported, active: true });
      return pipWindow;
    } catch (err) {
      state.set({ supported, active: false });
      throw err;
    }
  };

  const exit = async (): Promise<void> => {
    if (!supported || !doc) return;
    try {
      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture();
      }
      cleanUpListeners();
      state.set({ supported, active: false });
    } catch (err) {
      throw err;
    }
  };

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      cleanUpListeners();
    });
  }

  return {
    state: state.asReadonly(),
    request,
    exit,
  };
}
