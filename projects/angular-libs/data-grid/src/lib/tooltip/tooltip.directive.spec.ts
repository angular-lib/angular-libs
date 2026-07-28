import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlTooltipDirective } from './tooltip.directive';

@Component({
  template: `
    <input
      [alTooltip]="text()"
      [alTooltipDelay]="0"
      alTooltipVariant="error"
      alTooltipPosition="bottom"
    />
  `,
  imports: [AlTooltipDirective],
})
class Host {
  readonly text = signal<string | null>('Required');
}

describe('AlTooltipDirective', () => {
  let fixture: ComponentFixture<Host>;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  afterEach(() => {
    document.querySelectorAll('.al-dg-tooltip').forEach((el) => el.remove());
  });

  it('shows a tooltip on focus when content is set', () => {
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    const tip = document.querySelector('.al-dg-tooltip');
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe('Required');
    expect(tip!.classList.contains('al-dg-tooltip--visible')).toBe(true);
    expect(tip!.getAttribute('data-variant')).toBe('error');
    expect(input.getAttribute('aria-describedby')).toBe(tip!.id);
  });

  it('hides when content clears while open', () => {
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelector('.al-dg-tooltip--visible')).toBeTruthy();

    fixture.componentInstance.text.set(null);
    fixture.detectChanges();

    expect(document.querySelector('.al-dg-tooltip--visible')).toBeNull();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('updates live content while open', () => {
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    fixture.componentInstance.text.set('Too short');
    fixture.detectChanges();

    expect(document.querySelector('.al-dg-tooltip')!.textContent).toBe('Too short');
  });
});
