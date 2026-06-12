import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface NfcRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: any;
}

export interface NfcMessage {
  serialNumber: string;
  records: NfcRecord[];
}

export interface NfcSignalState {
  /** If the Web NFC API is supported of the browser. */
  supported: boolean;
  /** Active reading/scanning state representing listener activation. */
  reading: boolean;
  /** Active error thrown during Web NFC reading/writing operations. */
  error: Error | null;
  /** Transcribed message output from a read NFC tag. */
  message: NfcMessage | null;
}

export interface NfcSignal {
  /** Readonly signal tracking NFC operational states, scanner activation, and tag readings. */
  state: Signal<NfcSignalState>;
  /** Activates and launches the local NFC scanner listener. */
  scan(): Promise<void>;
  /** Writes dynamic message payloads onto targeted nearby NFC tags. */
  write(message: any, options?: any): Promise<void>;
}

/**
 * Accesses and interacts with Web NFC/RFID transponders for reading and writing data safely.
 *
 * @returns An object matching NfcSignal with reactive metadata states and scan/write actions.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (nfc.state().supported) {
 *       <button (click)="nfc.scan()">Start NFC Scan</button>
 *       @if (nfc.state().message) {
 *         <p>Tag Serial: {{ nfc.state().message?.serialNumber }}</p>
 *       }
 *     }
 *   `
 * })
 * export class NfcComponent {
 *   nfc = nfcSignal();
 * }
 * ```
 */
export function nfcSignal(): NfcSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const ndefReaderClass = win ? (win as any).NDEFReader : null;
  const supported = !!ndefReaderClass;

  const state = signal<NfcSignalState>({
    supported,
    reading: false,
    error: null,
    message: null,
  });

  let readerInstance: any = null;

  const handleReading = (event: any) => {
    const rawMessage = event.message;
    const serialNumber = event.serialNumber || '';
    const records: NfcRecord[] = [];

    if (rawMessage && rawMessage.records) {
      for (const record of rawMessage.records) {
        let parsedData = null;
        try {
          if (record.data) {
            const decoder = new TextDecoder(record.encoding || 'utf-8');
            parsedData = decoder.decode(record.data);
          }
        } catch {
          parsedData = record.data;
        }

        records.push({
          recordType: record.recordType || '',
          mediaType: record.mediaType,
          id: record.id,
          data: parsedData,
        });
      }
    }

    state.set({
      supported,
      reading: true,
      error: null,
      message: {
        serialNumber,
        records,
      },
    });
  };

  const handleReadingError = (event: any) => {
    state.update((prev) => ({
      ...prev,
      error: event.error || new Error('NFC Reading error occurred.'),
    }));
  };

  const scan = async (): Promise<void> => {
    if (!supported) {
      const err = new Error('Web NFC is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      throw err;
    }

    try {
      if (!readerInstance) {
        readerInstance = new ndefReaderClass();
      }

      await readerInstance.scan();
      state.set({
        supported,
        reading: true,
        error: null,
        message: null,
      });

      readerInstance.addEventListener('reading', handleReading);
      readerInstance.addEventListener('readingerror', handleReadingError);
    } catch (err: any) {
      const parsedErr = err instanceof Error ? err : new Error(String(err));
      state.update((prev) => ({
        ...prev,
        reading: false,
        error: parsedErr,
      }));
      throw parsedErr;
    }
  };

  const write = async (message: any, options?: any): Promise<void> => {
    if (!supported) {
      const err = new Error('Web NFC is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      throw err;
    }

    try {
      if (!readerInstance) {
        readerInstance = new ndefReaderClass();
      }

      await readerInstance.write(message, options);
    } catch (err: any) {
      const parsedErr = err instanceof Error ? err : new Error(String(err));
      state.update((prev) => ({ ...prev, error: parsedErr }));
      throw parsedErr;
    }
  };

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      if (readerInstance) {
        readerInstance.removeEventListener('reading', handleReading);
        readerInstance.removeEventListener('readingerror', handleReadingError);
      }
    });
  }

  return {
    state: state.asReadonly(),
    scan,
    write,
  };
}
