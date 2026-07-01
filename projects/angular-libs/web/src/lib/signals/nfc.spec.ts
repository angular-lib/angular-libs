import { TestBed } from '@angular/core/testing';
import { nfcSignal } from './nfc';

class MockNDEFReader {
  static instances: MockNDEFReader[] = [];
  listeners: Record<string, Set<any>> = { reading: new Set(), readingerror: new Set() };
  scan = vi.fn().mockResolvedValue(undefined);
  write = vi.fn().mockResolvedValue(undefined);

  constructor() {
    MockNDEFReader.instances.push(this);
  }

  addEventListener(type: string, cb: any) {
    this.listeners[type]?.add(cb);
  }

  removeEventListener(type: string, cb: any) {
    this.listeners[type]?.delete(cb);
  }

  dispatch(type: string, event: any) {
    this.listeners[type]?.forEach((cb) => cb(event));
  }
}

describe('nfcSignal', () => {
  beforeEach(() => {
    MockNDEFReader.instances = [];
    (window as any).NDEFReader = MockNDEFReader;
  });

  afterEach(() => {
    delete (window as any).NDEFReader;
  });

  it('should report unsupported when NDEFReader is absent', () => {
    delete (window as any).NDEFReader;
    const nfc = TestBed.runInInjectionContext(() => nfcSignal());
    expect(nfc.state().supported).toBe(false);
  });

  it('should scan and set reading state to true', async () => {
    const nfc = TestBed.runInInjectionContext(() => nfcSignal());
    await nfc.scan();

    expect(nfc.state().reading).toBe(true);
    expect(nfc.state().error).toBeNull();
  });

  it('should decode a reading event into records', async () => {
    const nfc = TestBed.runInInjectionContext(() => nfcSignal());
    await nfc.scan();

    const reader = MockNDEFReader.instances[0];
    const encoder = new TextEncoder();
    reader.dispatch('reading', {
      serialNumber: 'ABC-123',
      message: {
        records: [{ recordType: 'text', data: encoder.encode('hello'), encoding: 'utf-8' }],
      },
    });

    expect(nfc.state().message?.serialNumber).toBe('ABC-123');
    expect(nfc.state().message?.records[0].data).toBe('hello');
  });

  it('should surface readingerror events onto the error state', async () => {
    const nfc = TestBed.runInInjectionContext(() => nfcSignal());
    await nfc.scan();

    const reader = MockNDEFReader.instances[0];
    const err = new Error('tag read failed');
    reader.dispatch('readingerror', { error: err });

    expect(nfc.state().error).toBe(err);
  });

  it('should not register duplicate reading listeners when scan() is called more than once', async () => {
    const nfc = TestBed.runInInjectionContext(() => nfcSignal());
    await nfc.scan();
    await nfc.scan();

    expect(MockNDEFReader.instances.length).toBe(1);
    expect(MockNDEFReader.instances[0].listeners['reading'].size).toBe(1);
  });
});
