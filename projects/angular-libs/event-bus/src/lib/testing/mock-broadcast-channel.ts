/**
 * Test-only BroadcastChannel: delivers synchronously to every other open instance with the same name.
 * Each instance acts as its own tab unless `sameTab` is set, so the sender id is rewritten per sender.
 */
export class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  static sameTab = false;
  onmessage: ((event: { data: any }) => void) | null = null;
  closed = false;
  posted: any[] = [];
  readonly tab = `mock-tab-${MockBroadcastChannel.instances.length}`;
  constructor(public name: string) {
    MockBroadcastChannel.instances.push(this);
  }
  postMessage(data: any) {
    const message = structuredClone(data);
    this.posted.push(message);
    if (!MockBroadcastChannel.sameTab && message && typeof message === 'object' && 'sender' in message) {
      message.sender = this.tab;
    }
    MockBroadcastChannel.instances
      .filter((i) => i !== this && i.name === this.name && !i.closed)
      .forEach((i) => i.onmessage?.({ data: structuredClone(message) }));
  }
  close() {
    this.closed = true;
  }
  static install(): () => void {
    const original = (globalThis as any).BroadcastChannel;
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.instances = [];
    MockBroadcastChannel.sameTab = false;
    return () => ((globalThis as any).BroadcastChannel = original);
  }
}
