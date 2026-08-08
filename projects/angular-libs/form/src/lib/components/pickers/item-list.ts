import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

export type AlListItemValue = string | number;

export interface AlListItem {
  label: string;
  value: AlListItemValue;
  disabled?: boolean;
}

/**
 * Scrollable listbox used by time pickers (hours/minutes) and calendar month/year menus.
 */
@Component({
  selector: 'al-item-list',
  template: `
    <ul
      #listEl
      class="al-item-list"
      role="listbox"
      tabindex="0"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-activedescendant]="activeDescendantId()"
      (keydown)="onKeyDown($event)">
      @for (item of items(); track item.value; let i = $index) {
        <li
          [attr.id]="optionId(i)"
          class="al-item-list__item"
          role="option"
          [class.al-item-list__item--selected]="isSelected(item)"
          [class.al-item-list__item--disabled]="!!item.disabled"
          [attr.aria-selected]="isSelected(item)"
          [attr.aria-disabled]="item.disabled || null"
          (click)="onClick(item)">
          {{ item.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      height: inherit;
      overflow-y: auto;
      scrollbar-width: none;
      outline: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    .al-item-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .al-item-list:focus {
      outline: none;
    }
    .al-item-list__item {
      padding: 0.35rem 0.75rem;
      cursor: pointer;
      text-align: center;
      border-radius: var(--al-picker-radius, 0.25rem);
      color: inherit;
    }
    .al-item-list__item:hover:not(.al-item-list__item--disabled) {
      background: var(--al-picker-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .al-item-list__item--selected,
    .al-item-list__item--selected:hover {
      background: var(--al-picker-selected-bg, var(--al-form-focus, #ea580c));
      color: var(--al-picker-selected-fg, #fff);
    }
    .al-item-list__item--disabled {
      color: var(--al-picker-muted, #9ca3af);
      cursor: not-allowed;
      opacity: 0.65;
    }
    .al-item-list:focus .al-item-list__item--selected {
      outline: 2px solid var(--al-form-border, #c4c4c4);
      outline-offset: -2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlItemList {
  private static nextId = 0;
  private readonly listId = `al-il-${++AlItemList.nextId}`;

  readonly items = input.required<readonly AlListItem[]>();
  readonly value = model<AlListItemValue | null>(null);
  readonly ariaLabel = input<string>('');
  readonly itemSelected = output<AlListItem>();

  private readonly listEl = viewChild<ElementRef<HTMLUListElement>>('listEl');

  protected optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  protected isSelected(item: AlListItem): boolean {
    return item.value === this.value();
  }

  protected activeDescendantId(): string | null {
    const items = this.items();
    const idx = items.findIndex((item) => item.value === this.value());
    return idx >= 0 ? this.optionId(idx) : null;
  }

  focusList(): void {
    this.listEl()?.nativeElement.focus();
  }

  scrollToSelected(): void {
    requestAnimationFrame(() => {
      const el = this.listEl()?.nativeElement.querySelector('.al-item-list__item--selected');
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  protected onClick(item: AlListItem): void {
    if (item.disabled) {
      return;
    }
    this.value.set(item.value);
    this.itemSelected.emit(item);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const items = this.items();
    if (!items.length) {
      return;
    }

    const enabledIndexes = items
      .map((item, i) => (item.disabled ? -1 : i))
      .filter((i) => i >= 0);
    if (!enabledIndexes.length) {
      return;
    }

    const currentIndex = items.findIndex((item) => item.value === this.value());
    const currentEnabledPos = enabledIndexes.indexOf(currentIndex);

    const selectIndex = (index: number): void => {
      const item = items[index];
      if (!item || item.disabled) {
        return;
      }
      this.value.set(item.value);
      this.scrollToSelected();
    };

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextPos =
          currentEnabledPos >= 0 && currentEnabledPos < enabledIndexes.length - 1
            ? currentEnabledPos + 1
            : 0;
        selectIndex(enabledIndexes[nextPos]);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prevPos =
          currentEnabledPos > 0 ? currentEnabledPos - 1 : enabledIndexes.length - 1;
        selectIndex(enabledIndexes[prevPos]);
        break;
      }
      case 'Home': {
        event.preventDefault();
        selectIndex(enabledIndexes[0]);
        break;
      }
      case 'End': {
        event.preventDefault();
        selectIndex(enabledIndexes[enabledIndexes.length - 1]);
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (currentIndex >= 0 && !items[currentIndex].disabled) {
          this.itemSelected.emit(items[currentIndex]);
        }
        break;
      }
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const host = target.closest('al-item-list');
        const container = host?.parentElement || document.body;
        const allLists = Array.from(
          container.querySelectorAll<HTMLElement>('al-item-list .al-item-list'),
        );
        const listIndex = allLists.indexOf(target);
        if (event.key === 'ArrowRight' && listIndex > -1 && listIndex < allLists.length - 1) {
          allLists[listIndex + 1].focus();
        } else if (event.key === 'ArrowLeft' && listIndex > 0) {
          allLists[listIndex - 1].focus();
        }
        break;
      }
    }
  }
}
