import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FormElement } from '../../types';
import { resolveFlexGrow, resolveFlexShrink, widthToCssVars } from '../../utils/layout';
import { unwrapMaybeSignal } from '../../utils/resolve-field';

/**
 * Layout shell around a form element (width / flex / line-break / hide).
 * Widths are applied via CSS vars + container queries on `al-form-elements`.
 */
@Component({
  selector: 'al-form-item',
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
    }
    :host(.al-form-item--sized) {
      flex-basis: var(--al-w-xs);
      width: var(--al-w-xs);
      max-width: var(--al-w-xs);
    }
    @container al-form (min-width: 576px) {
      :host(.al-form-item--sized) {
        flex-basis: var(--al-w-sm, var(--al-w-xs));
        width: var(--al-w-sm, var(--al-w-xs));
        max-width: var(--al-w-sm, var(--al-w-xs));
      }
    }
    @container al-form (min-width: 768px) {
      :host(.al-form-item--sized) {
        flex-basis: var(--al-w-md, var(--al-w-sm, var(--al-w-xs)));
        width: var(--al-w-md, var(--al-w-sm, var(--al-w-xs)));
        max-width: var(--al-w-md, var(--al-w-sm, var(--al-w-xs)));
      }
    }
    @container al-form (min-width: 992px) {
      :host(.al-form-item--sized) {
        flex-basis: var(--al-w-lg, var(--al-w-md, var(--al-w-sm, var(--al-w-xs))));
        width: var(--al-w-lg, var(--al-w-md, var(--al-w-sm, var(--al-w-xs))));
        max-width: var(--al-w-lg, var(--al-w-md, var(--al-w-sm, var(--al-w-xs))));
      }
    }
    :host(.al-form-item--line-break) {
      flex: 0 0 100% !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden;
    }
    :host(.al-form-item--hidden) {
      display: none !important;
    }
  `,
  host: {
    '[class.al-form-item--line-break]': 'isLineBreak()',
    '[class.al-form-item--hidden]': 'isHidden()',
    '[class.al-form-item--sized]': 'hasWidth()',
    '[style.flex-grow]': 'flexGrow()',
    '[style.flex-shrink]': 'flexShrink()',
    '[style.--al-w-xs]': 'cssVars().xs',
    '[style.--al-w-sm]': 'cssVars().sm',
    '[style.--al-w-md]': 'cssVars().md',
    '[style.--al-w-lg]': 'cssVars().lg',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormItem {
  readonly element = input.required<FormElement>();

  protected readonly isLineBreak = computed(() => this.element().type === 'line-break');

  protected readonly isHidden = computed(() => {
    const hide = this.element().hide;
    return hide == null ? false : !!unwrapMaybeSignal(hide);
  });

  protected readonly hasWidth = computed(() => {
    if (this.isLineBreak()) {
      return false;
    }
    return !!this.element().width;
  });

  protected readonly cssVars = computed(() => widthToCssVars(this.element().width));

  protected readonly flexGrow = computed(() => {
    if (this.isLineBreak()) {
      return '0';
    }
    return resolveFlexGrow(this.element());
  });

  protected readonly flexShrink = computed(() => {
    if (this.isLineBreak()) {
      return '0';
    }
    return resolveFlexShrink(this.element());
  });
}
