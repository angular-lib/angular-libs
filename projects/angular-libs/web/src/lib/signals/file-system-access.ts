import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface FileSystemSignalState {
  /** Whether the File System Access API is supported in the current environment. */
  supported: boolean;
  /** The active file handle if a file has been selected or saved. */
  fileHandle: any | null;
  /** The loaded file metadata of the current active file. */
  file: File | null;
  /** The text contents of the loaded active file. */
  content: string | null;
  /** Active loading/processing state. */
  loading: boolean;
  /** Active error thrown during operations. */
  error: Error | null;
}

export interface FileSystemSignal {
  /** Readonly signal tracking operational states, loading/error states, and active file context. */
  state: Signal<FileSystemSignalState>;
  /** Opens the native file picker, reads text details (optional), and stores context reactively. */
  open(options?: { readAsText?: boolean; [key: string]: any }): Promise<File | null>;
  /** Saves contents onto disk, optionally opening save dialogue if no active handle is selected. */
  save(content: string, options?: any): Promise<void>;
  /** Resets state values by clearing the open file details. */
  clear(): void;
}

/**
 * Interacts with the local File System Access API to read and write files on the user's disk.
 *
 * @returns An object matching FileSystemSignal with state properties and file operation tasks.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (fs.state().supported) {
 *       <button (click)="fs.open()">Open Text File</button>
 *       @if (fs.state().content) {
 *         <textarea [value]="fs.state().content" (input)="fs.save($any($event.target).value)"></textarea>
 *       }
 *     }
 *   `
 * })
 * export class FileSystemComponent {
 *   fs = fileSystemSignal();
 * }
 * ```
 */
export function fileSystemSignal(): FileSystemSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const supported = !!(win && 'showOpenFilePicker' in win);

  const state = signal<FileSystemSignalState>({
    supported,
    fileHandle: null,
    file: null,
    content: null,
    loading: false,
    error: null,
  });

  const open = async (options?: { readAsText?: boolean; [key: string]: any }): Promise<File | null> => {
    if (!supported) {
      const err = new Error('File System Access API is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      throw err;
    }

    state.update((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [handle] = await (win as any).showOpenFilePicker(options);
      const file = await handle.getFile();
      let content: string | null = null;

      const shouldReadAsText = options?.readAsText !== false;
      if (shouldReadAsText) {
        content = await file.text();
      }

      state.set({
        supported,
        fileHandle: handle,
        file,
        content,
        loading: false,
        error: null,
      });

      return file;
    } catch (err: any) {
      // Don't report AbortError (user cancelled picker) as a hard failure state
      const isAbort = err instanceof Error && err.name === 'AbortError';
      state.update((prev) => ({
        ...prev,
        loading: false,
        error: isAbort ? null : err instanceof Error ? err : new Error(String(err)),
      }));
      throw err;
    }
  };

  const save = async (content: string, options?: any): Promise<void> => {
    if (!supported) {
      const err = new Error('File System Access API is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      throw err;
    }

    state.update((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let handle = state().fileHandle;

      if (!handle) {
        handle = await (win as any).showSaveFilePicker(options);
      }

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      const file = await handle.getFile();
      state.set({
        supported,
        fileHandle: handle,
        file,
        content,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      state.update((prev) => ({
        ...prev,
        loading: false,
        error: isAbort ? null : err instanceof Error ? err : new Error(String(err)),
      }));
      throw err;
    }
  };

  const clear = () => {
    state.set({
      supported,
      fileHandle: null,
      file: null,
      content: null,
      loading: false,
      error: null,
    });
  };

  return {
    state: state.asReadonly(),
    open,
    save,
    clear,
  };
}
