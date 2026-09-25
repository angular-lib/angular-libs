/**
 * Trailing debounce for chrome text inputs (filters / quick filter / find).
 * `ms() <= 0` emits synchronously. Call `flush()` on Enter / blur and
 * `cancel()` on destroy so a late timer never writes after teardown.
 */
export class InputDebouncer<V> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingValue: { value: V } | null = null;

  constructor(
    private readonly emit: (value: V) => void,
    private readonly ms: () => number,
  ) {}

  get pending(): boolean {
    return this.pendingValue !== null;
  }

  push(value: V): void {
    const delay = this.ms();
    if (delay <= 0) {
      this.cancel();
      this.emit(value);
      return;
    }
    this.pendingValue = { value };
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), delay);
  }

  flush(): void {
    const pending = this.pendingValue;
    this.cancel();
    if (pending) {
      this.emit(pending.value);
    }
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingValue = null;
  }
}

/** Default `chrome.filterDebounceMs`. */
export const DEFAULT_FILTER_DEBOUNCE_MS = 200;
