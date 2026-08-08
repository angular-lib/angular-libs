import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  buildHourItems,
  buildMinuteItems,
  clampTimeString,
  normalizeTime,
  pad2,
  parseTime,
} from '../../utils/date-time';
import { AlIconClock } from '../icons/picker-icons';
import { AlItemList } from '../pickers/item-list';
import type { AlListItemValue } from '../pickers/item-list';
import { AlPickerShell } from '../pickers/picker-shell';

let nextAnchor = 0;

/** Standalone time control. Value: `HH:mm` or `''`. */
@Component({
  selector: 'al-time-picker',
  imports: [AlPickerShell, AlItemList, AlIconClock],
  template: `
    <al-picker-shell
      #shell
      inputType="time"
      [anchorName]="resolvedAnchor()"
      [value]="value()"
      (valueChange)="onNativeValue($event)"
      (touch)="touch.emit()"
      [min]="rangeMin()"
      [max]="rangeMax()"
      [step]="minuteStepSeconds()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [id]="id()"
      [placeholder]="placeholder()"
      [invalid]="invalid()"
      [describedBy]="describedBy()"
      trailLabel="Open time picker"
      [closeOnEnter]="true"
      (opened)="onOpened()"
      (closed)="onClosed()">
      <al-icon-clock alPickerTrail />
      @if (shell.hasEverOpened()) {
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
            (itemSelected)="shell.close()" />
        </div>
      }
    </al-picker-shell>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTimePicker implements FormValueControl<string> {
  private readonly defaultAnchor = `--al-time-${++nextAnchor}`;

  readonly value = model<string>('');
  readonly touch = output<void>();

  readonly anchorName = input<string | undefined>(undefined);
  readonly rangeMin = input('00:00');
  readonly rangeMax = input('23:59');
  /** Minute step (e.g. 5, 15). Default 1. */
  readonly step = input<number | string>(1);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly invalid = input(false);
  readonly describedBy = input('');

  private readonly shell = viewChild(AlPickerShell);
  private readonly hourList = viewChild('hourList', { read: AlItemList });
  private readonly minuteList = viewChild('minuteList', { read: AlItemList });
  private readonly lists = viewChildren(AlItemList);

  protected readonly stagedHh = signal<string | null>(null);
  protected readonly stagedMm = signal<string | null>(null);

  protected readonly resolvedAnchor = computed(() => this.anchorName() || this.defaultAnchor);

  protected readonly hh = computed(() => {
    const staged = this.stagedHh();
    if (staged != null) {
      return staged;
    }
    const t = parseTime(this.value());
    return t ? pad2(t.hours) : null;
  });

  protected readonly mm = computed(() => {
    const staged = this.stagedMm();
    if (staged != null) {
      return staged;
    }
    const t = parseTime(this.value());
    return t ? pad2(t.minutes) : null;
  });

  protected readonly hourItems = computed(() => buildHourItems(this.rangeMin(), this.rangeMax()));

  protected readonly minuteItems = computed(() =>
    buildMinuteItems(this.hh(), this.rangeMin(), this.rangeMax(), this.minuteStep()),
  );

  protected minuteStep(): number {
    const step = this.step();
    const n = typeof step === 'string' ? Number(step) : step;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  protected readonly minuteStepSeconds = computed(() => this.minuteStep() * 60);

  protected onNativeValue(raw: string): void {
    const normalized = normalizeTime(raw);
    if (!normalized) {
      this.value.set('');
      return;
    }
    this.value.set(clampTimeString(normalized, this.rangeMin(), this.rangeMax()));
  }

  protected onHourChange(v: AlListItemValue | null): void {
    if (typeof v !== 'string') {
      return;
    }
    this.stagedHh.set(v);
    this.commit(v, this.mm() ?? '00');
  }

  protected onMinuteChange(v: AlListItemValue | null): void {
    if (typeof v !== 'string') {
      return;
    }
    this.stagedMm.set(v);
    this.commit(this.hh() ?? '00', v);
  }

  protected onHourSelected(): void {
    this.minuteList()?.focusList();
    this.minuteList()?.scrollToSelected();
  }

  protected onOpened(): void {
    const t = parseTime(this.value());
    this.stagedHh.set(t ? pad2(t.hours) : '00');
    this.stagedMm.set(t ? pad2(t.minutes) : '00');
    requestAnimationFrame(() => {
      this.hourList()?.focusList();
      this.lists().forEach((list) => list.scrollToSelected());
    });
  }

  protected onClosed(): void {
    this.stagedHh.set(null);
    this.stagedMm.set(null);
  }

  private commit(hh: string, mm: string): void {
    this.value.set(clampTimeString(`${hh}:${mm}`, this.rangeMin(), this.rangeMax()));
  }
}
