import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormControlChromeProps, FormElementBaseConfig } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import {
  clearFieldValue,
  fieldHasStringValue,
  useFieldChrome,
} from '../../utils/field-state';
import { AlField } from '../field/field';
import { AlControlChrome } from '../control-chrome/control-chrome';

/**
 * Shared shell: AlField + AlControlChrome + clear/a11y wiring.
 * Field components project the native control (and optional lead/trail).
 */
@Component({
  selector: 'al-field-shell',
  imports: [AlField, AlControlChrome],
  template: `
    @if (field(); as f) {
      <al-field
        [field]="f"
        [label]="element().label"
        [hint]="element().hint"
        [labelHelp]="element().labelHelp"
        [controlId]="controlId()"
        [hideHeader]="!!element().hideHeader"
        [hideFooter]="!!element().hideFooter"
        [meta]="meta()"
        [submitAttempted]="submitAttempted()">
        <al-control-chrome
          [anchorName]="controlAnchor()"
          [prefix]="chromeProps()?.prefix"
          [suffix]="chromeProps()?.suffix"
          [clearable]="clearable()"
          [clearOnEscape]="!!chromeProps()?.clearOnEscape"
          [hasValue]="resolvedHasValue()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [invalid]="showInvalid()"
          [composing]="composing()"
          (clear)="onClear($event)">
          <ng-content select="[alControlLead]" />
          <ng-content />
          <ng-content select="[alControlTrail]" />
        </al-control-chrome>
      </al-field>
    } @else {
      <al-field [label]="element().label" [hint]="element().hint" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFieldShell {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElementBaseConfig>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);
  readonly hasValue = input<boolean | null>(null);
  readonly clearValue = input<unknown | undefined>(undefined);
  readonly clearableOverride = input<boolean | null>(null);
  readonly meta = input<string | null>(null);
  /** Shared with dropdown panels so they align to the chrome (not the whole field). */
  readonly controlAnchor = input<string | undefined>(undefined);

  readonly clear = output<Event>();

  protected readonly composing = signal(false);

  private readonly chrome = useFieldChrome(
    () => this.field(),
    () => this.element(),
    () => this.controller(),
  );

  readonly disabled = this.chrome.disabled;
  readonly readonly = this.chrome.readonly;
  readonly invalid = this.chrome.invalid;
  readonly submitAttempted = this.chrome.submitAttempted;
  readonly controlId = this.chrome.controlId;
  readonly describedById = this.chrome.describedById;

  protected readonly chromeProps = computed(() => {
    const props = (this.element() as FormElementBaseConfig & { props?: FormControlChromeProps }).props;
    return props;
  });

  protected readonly clearable = computed(() => {
    const override = this.clearableOverride();
    if (override != null) {
      return override;
    }
    return !!this.chromeProps()?.clearable;
  });

  protected readonly resolvedHasValue = computed(() => {
    const override = this.hasValue();
    if (override != null) {
      return override;
    }
    return fieldHasStringValue(this.field());
  });

  protected readonly showInvalid = computed(() => {
    const f = this.field();
    if (!f || !this.invalid()) {
      return false;
    }
    const s = f();
    return this.submitAttempted() || s.touched() || s.dirty();
  });

  setComposing(value: boolean): void {
    this.composing.set(value);
  }

  protected onClear(event: Event): void {
    const empty = this.clearValue();
    if (empty !== undefined) {
      clearFieldValue(this.field(), empty);
    }
    this.clear.emit(event);
  }
}
