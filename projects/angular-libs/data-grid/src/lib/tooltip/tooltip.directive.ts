import {
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';

export type AlTooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type AlTooltipVariant = 'default' | 'error';

const STYLE_ID = 'al-dg-tooltip-styles';
const GAP = 6;

const TOOLTIP_CSS = `
.al-dg-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: min(280px, calc(100vw - 16px));
  padding: 4px 8px;
  border-radius: 4px;
  font: 12px/1.35 system-ui, -apple-system, sans-serif;
  color: #fff;
  background: #1f2937;
  box-shadow: 0 4px 12px rgb(0 0 0 / 18%);
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity 80ms ease, transform 80ms ease;
}
.al-dg-tooltip.al-dg-tooltip--visible {
  opacity: 1;
  transform: scale(1);
}
.al-dg-tooltip[data-variant='error'] {
  background: var(--al-dg-danger, #dc2626);
  color: #fff;
}
.al-dg-tooltip[data-position='top'] { transform-origin: bottom center; }
.al-dg-tooltip[data-position='bottom'] { transform-origin: top center; }
.al-dg-tooltip[data-position='left'] { transform-origin: center right; }
.al-dg-tooltip[data-position='right'] { transform-origin: center left; }
`;

function ensureTooltipStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TOOLTIP_CSS;
  document.head.appendChild(style);
}

/**
 * Lightweight floating tooltip for data-grid (no CDK).
 *
 * Shows on hover / focus when `[alTooltip]` is a non-empty string.
 * Content updates live while open (useful for Signal Forms validation).
 *
 * @example
 * ```html
 * <input [alTooltip]="fieldError(field)" alTooltipVariant="error" />
 * <button [alTooltip]="'Save row'" alTooltipPosition="bottom">Save</button>
 * ```
 */
@Directive({
  selector: '[alTooltip]',
  host: {
    '(mouseenter)': 'onEnter()',
    '(mouseleave)': 'onLeave()',
    '(focusin)': 'onEnter()',
    '(focusout)': 'onLeave()',
  },
})
export class AlTooltipDirective {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private tip: HTMLDivElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private open = false;
  private readonly tipId = `al-dg-tip-${Math.random().toString(36).slice(2, 9)}`;

  /** Tooltip text. Empty / null disables the tooltip. */
  readonly alTooltip = input<string | null | undefined>(null);
  /** Preferred placement relative to the host. */
  readonly alTooltipPosition = input<AlTooltipPosition>('top');
  /** Visual tone (`error` for validation messages). */
  readonly alTooltipVariant = input<AlTooltipVariant>('default');
  /** Delay before showing (ms). */
  readonly alTooltipDelay = input(120);

  constructor() {
    ensureTooltipStyles();

    effect(() => {
      const text = this.alTooltip()?.trim() ?? '';
      const variant = this.alTooltipVariant();
      const position = this.alTooltipPosition();
      untracked(() => this.syncOpenTooltip(text, variant, position));
    });

    this.destroyRef.onDestroy(() => this.destroyTip());
  }

  protected onEnter(): void {
    const text = this.alTooltip()?.trim();
    if (!text) {
      return;
    }
    this.clearTimer();
    const delay = Math.max(0, this.alTooltipDelay());
    if (delay === 0) {
      this.openTip(text);
      return;
    }
    this.showTimer = setTimeout(() => this.openTip(text), delay);
  }

  protected onLeave(): void {
    this.clearTimer();
    this.hideTip();
  }

  private syncOpenTooltip(
    text: string,
    variant: AlTooltipVariant,
    position: AlTooltipPosition,
  ): void {
    if (!text) {
      this.clearTimer();
      this.hideTip();
      return;
    }

    if (this.open && this.tip) {
      this.tip.textContent = text;
      this.tip.dataset['variant'] = variant;
      this.tip.dataset['position'] = position;
      this.positionTip();
      return;
    }

    // Live validation: reveal as soon as an error appears while focused.
    if (this.hostIsActive()) {
      this.clearTimer();
      this.openTip(text);
    }
  }

  private hostIsActive(): boolean {
    const el = this.host.nativeElement;
    return el.matches(':focus, :focus-within') || el.matches(':hover');
  }

  private openTip(text: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    ensureTooltipStyles();

    if (!this.tip) {
      this.tip = document.createElement('div');
      this.tip.id = this.tipId;
      this.tip.className = 'al-dg-tooltip';
      this.tip.setAttribute('role', 'tooltip');
      document.body.appendChild(this.tip);
    }

    this.tip.textContent = text;
    this.tip.dataset['variant'] = this.alTooltipVariant();
    this.tip.dataset['position'] = this.alTooltipPosition();
    this.positionTip();
    this.tip.classList.add('al-dg-tooltip--visible');
    this.host.nativeElement.setAttribute('aria-describedby', this.tipId);

    if (!this.open) {
      this.open = true;
      window.addEventListener('scroll', this.onReposition, true);
      window.addEventListener('resize', this.onReposition);
    }
  }

  private hideTip(): void {
    if (!this.tip) {
      return;
    }
    this.tip.classList.remove('al-dg-tooltip--visible');
    this.host.nativeElement.removeAttribute('aria-describedby');
    this.open = false;
    window.removeEventListener('scroll', this.onReposition, true);
    window.removeEventListener('resize', this.onReposition);
  }

  private destroyTip(): void {
    this.clearTimer();
    this.hideTip();
    this.tip?.remove();
    this.tip = null;
  }

  private clearTimer(): void {
    if (this.showTimer != null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private readonly onReposition = (): void => {
    if (this.open) {
      this.positionTip();
    }
  };

  private positionTip(): void {
    const tip = this.tip;
    if (!tip) {
      return;
    }

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const position = this.alTooltipPosition();
    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom':
        top = hostRect.bottom + GAP;
        left = hostRect.left + (hostRect.width - tipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tipRect.height) / 2;
        left = hostRect.left - tipRect.width - GAP;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tipRect.height) / 2;
        left = hostRect.right + GAP;
        break;
      case 'top':
      default:
        top = hostRect.top - tipRect.height - GAP;
        left = hostRect.left + (hostRect.width - tipRect.width) / 2;
        break;
    }

    const pad = 8;
    left = Math.min(Math.max(pad, left), window.innerWidth - tipRect.width - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - tipRect.height - pad);

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }
}
