import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import {
  buildHourItems,
  buildMinuteItems,
  clampTimeString,
  normalizeTime,
  pad2,
  parseTime,
} from '../../utils/date-time';
import { AlFieldShell } from '../field-shell/field-shell';
import { AlIconClock } from '../icons/picker-icons';
import { AlItemList } from '../pickers/item-list';
import type { AlListItemValue } from '../pickers/item-list';
import { PICKER_PANEL_STYLES } from '../pickers/picker-styles';

let nextTimeAnchor = 0;

@Component({
  selector: 'al-time-field',
  imports: [AlFieldShell, AlItemList, AlIconClock],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="''"
      [clearableOverride]="true"
      [controlAnchor]="fieldAnchor"
      [hasValue]="hasValue()"
      (clear)="onShellClear($event)">
      @if (field(); as f) {
        <input
          #inputRef
          class="al-picker-input"
          type="time"
          [id]="af.controlId()"
          [value]="displayValue()"
          [attr.min]="props().min ?? '00:00'"
          [attr.max]="props().max ?? '23:59'"
          [attr.step]="minuteStepSeconds()"
          [attr.placeholder]="props().placeholder ?? null"
          [attr.aria-invalid]="af.invalid() || null"
          [attr.aria-describedby]="af.describedById()"
          [disabled]="af.disabled()"
          [readOnly]="af.readonly()"
          (input)="onNativeInput($event)"
          (blur)="markTouched()"
          (keydown)="onInputKeydown($event)" />
      }
      <button
        type="button"
        alControlTrail
        class="al-trail-btn"
        aria-label="Open time picker"
        [disabled]="af.disabled() || af.readonly()"
        (click)="openPicker($event)">
        <al-icon-clock />
      </button>
    </al-field-shell>

    <div
      #panelRef
      class="al-picker-panel"
      popover="auto"
      [style.position-anchor]="fieldAnchor"
      (toggle)="onPopoverToggle($event)"
      (keydown)="onPanelKeydown($event)">
      @if (hasEverOpened()) {
        <div class="al-picker-time">
          <al-item-list
            #hourList
            [items]="hourItems()"
            [value]="hh()"
            ariaLabel="Hours"
            (valueChange)="onHourChange($event)"
            (itemSelected)="onHourSelected()" />
          <al-item-list
            #minuteList
            [items]="minuteItems()"
            [value]="mm()"
            ariaLabel="Minutes"
            (valueChange)="onMinuteChange($event)"
            (itemSelected)="hidePopover()" />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      position: relative;
    }
    ${PICKER_PANEL_STYLES}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTimeField {
  protected readonly fieldAnchor = `--al-time-${++nextTimeAnchor}`;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'time' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRef');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');
  private readonly hourList = viewChild('hourList', { read: AlItemList });
  private readonly minuteList = viewChild('minuteList', { read: AlItemList });
  private readonly lists = viewChildren(AlItemList);

  protected readonly hasEverOpened = signal(false);
  /** Staging hour while popover is open (`00`–`23`). */
  protected readonly stagedHh = signal<string | null>(null);
  protected readonly stagedMm = signal<string | null>(null);

  protected readonly props = computed(() => this.element().props ?? {});

  protected readonly displayValue = computed(() => {
    const v = this.field()?.()?.value();
    return normalizeTime(typeof v === 'string' ? v : v == null ? '' : String(v));
  });

  protected readonly hasValue = computed(() => this.displayValue().length > 0);

  protected readonly hh = computed(() => {
    const staged = this.stagedHh();
    if (staged != null) {
      return staged;
    }
    return parseTime(this.displayValue())?.hours != null
      ? pad2(parseTime(this.displayValue())!.hours)
      : null;
  });

  protected readonly mm = computed(() => {
    const staged = this.stagedMm();
    if (staged != null) {
      return staged;
    }
    return parseTime(this.displayValue())?.minutes != null
      ? pad2(parseTime(this.displayValue())!.minutes)
      : null;
  });

  protected readonly hourItems = computed(() =>
    buildHourItems(this.props().min ?? '00:00', this.props().max ?? '23:59'),
  );

  protected readonly minuteItems = computed(() =>
    buildMinuteItems(
      this.hh(),
      this.props().min ?? '00:00',
      this.props().max ?? '23:59',
      this.minuteStep(),
    ),
  );

  protected minuteStep(): number {
    const step = this.props().step;
    if (step == null) {
      return 1;
    }
    const n = typeof step === 'string' ? Number(step) : step;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  /** Native `step` is in seconds. */
  protected readonly minuteStepSeconds = computed(() => this.minuteStep() * 60);

  protected onNativeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const normalized = normalizeTime(el.value);
    if (!normalized) {
      this.writeValue('');
      return;
    }
    this.writeValue(
      clampTimeString(normalized, this.props().min ?? '00:00', this.props().max ?? '23:59'),
    );
  }

  protected onHourChange(value: AlListItemValue | null): void {
    if (typeof value !== 'string') {
      return;
    }
    this.stagedHh.set(value);
    const mm = this.mm() ?? '00';
    this.commitStaged(value, mm);
  }

  protected onMinuteChange(value: AlListItemValue | null): void {
    if (typeof value !== 'string') {
      return;
    }
    this.stagedMm.set(value);
    const hh = this.hh() ?? '00';
    this.commitStaged(hh, value);
  }

  protected onHourSelected(): void {
    this.minuteList()?.focusList();
    this.minuteList()?.scrollToSelected();
  }

  protected onShellClear(event: Event): void {
    event.stopPropagation();
    this.writeValue('');
    this.stagedHh.set(null);
    this.stagedMm.set(null);
    this.props().onClear?.({
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    });
  }

  protected openPicker(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const state = this.field()?.();
    if (state?.disabled() || state?.readonly()) {
      return;
    }
    const panel = this.panelRef()?.nativeElement;
    if (!panel) {
      return;
    }
    this.seedStage();
    this.hasEverOpened.set(true);
    if (!panel.matches(':popover-open')) {
      panel.showPopover();
    }
    requestAnimationFrame(() => {
      this.hourList()?.focusList();
      this.lists().forEach((list) => list.scrollToSelected());
    });
  }

  protected hidePopover(): void {
    const panel = this.panelRef()?.nativeElement;
    if (panel?.matches(':popover-open')) {
      panel.hidePopover();
    }
  }

  protected onPopoverToggle(event: Event): void {
    const e = event as ToggleEvent;
    if (e.newState === 'open') {
      this.hasEverOpened.set(true);
      this.seedStage();
      requestAnimationFrame(() => {
        this.hourList()?.focusList();
        this.lists().forEach((list) => list.scrollToSelected());
      });
    } else {
      this.stagedHh.set(null);
      this.stagedMm.set(null);
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.openPicker();
    } else if (event.key === 'Escape') {
      this.hidePopover();
    } else if (event.key === 'Enter') {
      this.hidePopover();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.hidePopover();
      this.inputRef()?.nativeElement.focus();
    } else if (event.key === 'Enter') {
      this.hidePopover();
      this.inputRef()?.nativeElement.focus();
    }
  }

  protected markTouched(): void {
    this.field()?.()?.markAsTouched();
  }

  private seedStage(): void {
    const t = parseTime(this.displayValue());
    this.stagedHh.set(t ? pad2(t.hours) : '00');
    this.stagedMm.set(t ? pad2(t.minutes) : '00');
  }

  private commitStaged(hh: string, mm: string): void {
    const raw = `${hh}:${mm}`;
    this.writeValue(
      clampTimeString(raw, this.props().min ?? '00:00', this.props().max ?? '23:59'),
    );
  }

  private writeValue(value: string): void {
    const state = this.field()?.();
    if (!state || state.disabled()) {
      return;
    }
    state.value.set(value as never);
    state.markAsDirty();
    state.markAsTouched();
  }
}
