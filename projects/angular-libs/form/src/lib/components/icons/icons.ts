import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Tiny inline SVGs for built-in lead/trail cues (no icon font). */
@Component({
  selector: 'al-icon-search',
  template: `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.5 2a4.5 4.5 0 1 1 2.85 8.1l3.27 3.28a.75.75 0 1 1-1.06 1.06l-3.28-3.27A4.5 4.5 0 0 1 6.5 2zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlIconSearch {}

@Component({
  selector: 'al-icon-eye',
  template: `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 3c3.2 0 5.9 1.9 7.2 4.6a.75.75 0 0 1 0 .8C13.9 11.1 11.2 13 8 13s-5.9-1.9-7.2-4.6a.75.75 0 0 1 0-.8C2.1 4.9 4.8 3 8 3zm0 1.5c-2.4 0-4.5 1.4-5.6 3.5 1.1 2.1 3.2 3.5 5.6 3.5s4.5-1.4 5.6-3.5c-1.1-2.1-3.2-3.5-5.6-3.5zM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlIconEye {}

@Component({
  selector: 'al-icon-eye-off',
  template: `
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.22 2.22a.75.75 0 0 1 1.06 0l10.5 10.5a.75.75 0 1 1-1.06 1.06l-1.7-1.7A7.7 7.7 0 0 1 8 13c-3.2 0-5.9-1.9-7.2-4.6a.75.75 0 0 1 0-.8 8.3 8.3 0 0 1 2.7-2.9L2.22 3.28a.75.75 0 0 1 0-1.06zM8 4.5c.5 0 1 .08 1.46.22l-1.1 1.1A2 2 0 0 0 6.18 7.9L5.05 6.78A3.5 3.5 0 0 1 8 4.5zm5.48 1.66-1.2 1.2c.2.35.32.74.32 1.14a2 2 0 0 1-2.34 1.97l-1.13 1.13c.28.06.57.1.87.1 2.4 0 4.5-1.4 5.6-3.5a8 8 0 0 0-1.12-1.04z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlIconEyeOff {}
