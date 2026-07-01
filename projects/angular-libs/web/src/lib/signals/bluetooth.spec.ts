import { TestBed } from '@angular/core/testing';
import { bluetoothSignal } from './bluetooth';

function createMockDevice(name: string) {
  const listeners = new Map<string, Set<any>>();
  return {
    name,
    gatt: { connected: false, disconnect: vi.fn() },
    addEventListener: vi.fn((type: string, cb: any) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: any) => {
      listeners.get(type)?.delete(cb);
    }),
    dispatch(type: string) {
      listeners.get(type)?.forEach((cb) => cb());
    },
  };
}

describe('bluetoothSignal', () => {
  let mockBluetooth: { requestDevice: any };

  beforeEach(() => {
    mockBluetooth = { requestDevice: vi.fn() };
    Object.defineProperty(navigator, 'bluetooth', {
      value: mockBluetooth,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (navigator as any).bluetooth;
  });

  it('should report unsupported when navigator.bluetooth is absent', () => {
    delete (navigator as any).bluetooth;
    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    expect(bt.state().supported).toBe(false);
  });

  it('should request and connect a device', async () => {
    const device = createMockDevice('Device A');
    device.gatt.connected = true;
    mockBluetooth.requestDevice.mockResolvedValue(device);

    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    const result = await bt.requestDevice({ acceptAllDevices: true });

    expect(result).toBe(device);
    expect(bt.state().device).toBe(device);
    expect(bt.state().connected).toBe(true);
    expect(bt.state().loading).toBe(false);
    expect(device.addEventListener).toHaveBeenCalledWith('gattserverdisconnected', expect.any(Function));
  });

  it('should set error state and rethrow when requestDevice fails', async () => {
    const err = new Error('User cancelled');
    mockBluetooth.requestDevice.mockRejectedValue(err);

    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    await expect(bt.requestDevice()).rejects.toThrow('User cancelled');
    expect(bt.state().error).toBe(err);
    expect(bt.state().loading).toBe(false);
  });

  it('should detach the previous device listener when a new device is selected (no leak)', async () => {
    const deviceA = createMockDevice('Device A');
    const deviceB = createMockDevice('Device B');
    mockBluetooth.requestDevice.mockResolvedValueOnce(deviceA).mockResolvedValueOnce(deviceB);

    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    await bt.requestDevice();
    await bt.requestDevice();

    expect(deviceA.removeEventListener).toHaveBeenCalledWith('gattserverdisconnected', expect.any(Function));
    expect(bt.state().device).toBe(deviceB);
  });

  it('should not misattribute a stale device disconnect event to the newly active device', async () => {
    const deviceA = createMockDevice('Device A');
    const deviceB = createMockDevice('Device B');
    deviceB.gatt.connected = true;
    mockBluetooth.requestDevice.mockResolvedValueOnce(deviceA).mockResolvedValueOnce(deviceB);

    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    await bt.requestDevice();
    await bt.requestDevice();

    // deviceA's listener was removed above, but simulate it still firing (e.g. a queued event)
    // by dispatching directly - it must not affect state for the now-active deviceB.
    deviceA.dispatch('gattserverdisconnected');

    expect(bt.state().device).toBe(deviceB);
    expect(bt.state().connected).toBe(true);
  });

  it('should disconnect cleanly, removing the listener and calling gatt.disconnect', async () => {
    const device = createMockDevice('Device A');
    device.gatt.connected = true;
    mockBluetooth.requestDevice.mockResolvedValue(device);

    const bt = TestBed.runInInjectionContext(() => bluetoothSignal());
    await bt.requestDevice();
    bt.disconnect();

    expect(device.removeEventListener).toHaveBeenCalledWith('gattserverdisconnected', expect.any(Function));
    expect(device.gatt.disconnect).toHaveBeenCalled();
    expect(bt.state().device).toBeNull();
    expect(bt.state().connected).toBe(false);
  });
});
