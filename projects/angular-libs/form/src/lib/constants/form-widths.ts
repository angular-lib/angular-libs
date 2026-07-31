/**
 * Responsive / named width presets (plain CSS values — no design-system coupling).
 * Half/third/quarter calcs subtract the form column gap so N items fit on one row.
 *
 * `--al-form-column-gap` is set on `al-form-elements` (default 1rem).
 * Calcs use `var(--al-form-column-gap)` without a comma-fallback so values stay
 * safe in CSSOM longhands (and would stay safe even in flex shorthand).
 *
 * Defaults apply from the smallest size so side-by-side works in typical app shells.
 * For “stack on mobile”, use `halfResponsive` / explicit maps.
 */
const gap = 'var(--al-form-column-gap)';
const halfCalc = `calc((100% - ${gap}) / 2)`;
const thirdCalc = `calc((100% - 2 * ${gap}) / 3)`;
const quarterCalc = `calc((100% - 3 * ${gap}) / 4)`;

export const FORM_WIDTHS = {
  full: '100%',
  /** Always ~50% (gap-aware). */
  half: halfCalc,
  /** Stack below sm, half from sm up. */
  halfResponsive: { xs: '100%', sm: halfCalc },
  third: thirdCalc,
  thirdResponsive: { xs: '100%', sm: halfCalc, md: thirdCalc },
  twoThirds: `calc((100% - ${gap}) * 2 / 3)`,
  quarter: quarterCalc,
  quarterResponsive: { xs: '100%', sm: halfCalc, md: quarterCalc },
  threeQuarters: `calc((100% - ${gap}) * 3 / 4)`,
  auto: 'auto',

  col1: `calc((100% - 11 * ${gap}) / 12)`,
  col2: `calc((100% - 5 * ${gap}) / 6)`,
  col3: quarterCalc,
  col4: thirdCalc,
  col5: `calc((100% - ${gap}) * 5 / 12)`,
  col6: halfCalc,
  col7: `calc((100% - ${gap}) * 7 / 12)`,
  col8: `calc((100% - ${gap}) * 2 / 3)`,
  col9: `calc((100% - ${gap}) * 3 / 4)`,
  col10: `calc((100% - ${gap}) * 5 / 6)`,
  col11: `calc((100% - ${gap}) * 11 / 12)`,
  col12: '100%',
} as const;
