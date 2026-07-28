/**
 * Find match navigation — host owns match list; this owns index cycling.
 */

export interface FindControllerOptions {
  getMatchCount: () => number;
  getActiveIndex: () => number;
  setActiveIndex: (index: number) => void;
  /** Called after index changes (scroll / focus). */
  onNavigate?: () => void;
}

export class FindController {
  constructor(private readonly options: FindControllerOptions) {}

  next(): boolean {
    const count = this.options.getMatchCount();
    if (!count) {
      return false;
    }
    const next = (this.options.getActiveIndex() + 1) % count;
    this.options.setActiveIndex(next);
    this.options.onNavigate?.();
    return true;
  }

  prev(): boolean {
    const count = this.options.getMatchCount();
    if (!count) {
      return false;
    }
    const next = (this.options.getActiveIndex() - 1 + count) % count;
    this.options.setActiveIndex(next);
    this.options.onNavigate?.();
    return true;
  }

  /** Clamp active index into `[0, count)`. */
  clamp(): void {
    const count = this.options.getMatchCount();
    if (!count) {
      this.options.setActiveIndex(0);
      return;
    }
    const idx = this.options.getActiveIndex();
    if (idx < 0 || idx >= count) {
      this.options.setActiveIndex(((idx % count) + count) % count);
    }
  }
}
