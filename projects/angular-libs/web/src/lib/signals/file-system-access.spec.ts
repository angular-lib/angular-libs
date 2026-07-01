import { TestBed } from '@angular/core/testing';
import { fileSystemSignal } from './file-system-access';

function createMockFile(text: string) {
  return {
    text: vi.fn().mockResolvedValue(text),
  };
}

function createMockWritable() {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockHandle(file: any, writable: any) {
  return {
    getFile: vi.fn().mockResolvedValue(file),
    createWritable: vi.fn().mockResolvedValue(writable),
  };
}

describe('fileSystemSignal', () => {
  afterEach(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
  });

  it('should report unsupported when showOpenFilePicker is absent', () => {
    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    expect(fs.state().supported).toBe(false);
  });

  it('should open a file and read its text content', async () => {
    const file = createMockFile('hello world');
    const handle = createMockHandle(file, createMockWritable());
    (window as any).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    const result = await fs.open();

    expect(result).toBe(file);
    expect(fs.state().content).toBe('hello world');
    expect(fs.state().fileHandle).toBe(handle);
    expect(fs.state().loading).toBe(false);
  });

  it('should not treat picker cancellation (AbortError) as an error', async () => {
    const abortErr = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    (window as any).showOpenFilePicker = vi.fn().mockRejectedValue(abortErr);

    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    await expect(fs.open()).rejects.toThrow();

    expect(fs.state().error).toBeNull();
    expect(fs.state().loading).toBe(false);
  });

  it('should save content via the writable stream and close it on success', async () => {
    const writable = createMockWritable();
    const handle = createMockHandle(createMockFile('saved'), writable);
    (window as any).showOpenFilePicker = vi.fn();
    (window as any).showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    await fs.save('saved');

    expect(writable.write).toHaveBeenCalledWith('saved');
    expect(writable.close).toHaveBeenCalled();
    expect(writable.abort).not.toHaveBeenCalled();
    expect(fs.state().content).toBe('saved');
  });

  it('should abort the writable stream (not leave it open) when write fails', async () => {
    const writable = createMockWritable();
    const writeErr = new Error('disk full');
    writable.write.mockRejectedValue(writeErr);
    const handle = createMockHandle(createMockFile(''), writable);
    (window as any).showOpenFilePicker = vi.fn();
    (window as any).showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    await expect(fs.save('content')).rejects.toThrow('disk full');

    expect(writable.abort).toHaveBeenCalled();
    expect(writable.close).not.toHaveBeenCalled();
    expect(fs.state().error).toBe(writeErr);
    expect(fs.state().loading).toBe(false);
  });

  it('should clear state back to defaults', async () => {
    const file = createMockFile('hello');
    const handle = createMockHandle(file, createMockWritable());
    (window as any).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    const fs = TestBed.runInInjectionContext(() => fileSystemSignal());
    await fs.open();
    fs.clear();

    expect(fs.state().fileHandle).toBeNull();
    expect(fs.state().file).toBeNull();
    expect(fs.state().content).toBeNull();
  });
});
