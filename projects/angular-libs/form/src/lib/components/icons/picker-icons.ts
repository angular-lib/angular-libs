import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'al-icon-calendar',
  template: `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 1.75a.75.75 0 0 0-1.5 0V3H2.75A1.75 1.75 0 0 0 1 4.75v8.5C1 14.216 1.784 15 2.75 15h10.5A1.75 1.75 0 0 0 15 13.25v-8.5A1.75 1.75 0 0 0 13.25 3H12.5V1.75a.75.75 0 0 0-1.5 0V3h-6V1.75zM2.5 6.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V6.5h-11z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlIconCalendar {}

@Component({
  selector: 'al-icon-clock',
  template: `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.75-3.25a.75.75 0 0 0-1.5 0v3.5c0 .192.168.1.5.75H11a.75.75 0 0 0 0-1.5H8.75V4.75z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlIconClock {}
