/**
 * Host design-system → `--al-dialog-*` token bridge.
 *
 * Short keys map onto the public CSS variables. Raw custom properties
 * (`--al-dialog-bg`, `--kit-anything` is not remapped) can also be passed through.
 */

export interface DialogTokens {
  bg?: string;
  color?: string;
  border?: string;
  borderRadius?: string;
  shadow?: string;
  backdrop?: string;
  accent?: string;
  fontFamily?: string;
  headerBg?: string;
  headerBorderColor?: string;
  headerPadding?: string;
  titleColor?: string;
  subtitleColor?: string;
  contentPadding?: string;
  footerBg?: string;
  footerBorderColor?: string;
  footerPadding?: string;
  btnPrimaryBg?: string;
  btnPrimaryColor?: string;
  btnPrimaryHoverBg?: string;
  btnSecondaryBg?: string;
  btnSecondaryColor?: string;
  btnSecondaryHoverBg?: string;
  actionBtnColor?: string;
  actionBtnHoverBg?: string;
  actionBtnHoverColor?: string;
}

/** Short token names → CSS custom properties applied on `dialog.al-dialog`. */
export const DIALOG_TOKEN_VARS = {
  bg: '--al-dialog-bg',
  color: '--al-dialog-color',
  border: '--al-dialog-border',
  borderRadius: '--al-dialog-border-radius',
  shadow: '--al-dialog-shadow',
  backdrop: '--al-dialog-backdrop',
  accent: '--al-dialog-accent',
  fontFamily: '--al-dialog-font-family',
  headerBg: '--al-dialog-header-bg',
  headerBorderColor: '--al-dialog-header-border-color',
  headerPadding: '--al-dialog-header-padding',
  titleColor: '--al-dialog-title-color',
  subtitleColor: '--al-dialog-subtitle-color',
  contentPadding: '--al-dialog-content-padding',
  footerBg: '--al-dialog-footer-bg',
  footerBorderColor: '--al-dialog-footer-border-color',
  footerPadding: '--al-dialog-footer-padding',
  btnPrimaryBg: '--al-btn-primary-bg',
  btnPrimaryColor: '--al-btn-primary-color',
  btnPrimaryHoverBg: '--al-btn-primary-hover-bg',
  btnSecondaryBg: '--al-btn-secondary-bg',
  btnSecondaryColor: '--al-btn-secondary-color',
  btnSecondaryHoverBg: '--al-btn-secondary-hover-bg',
  actionBtnColor: '--al-action-btn-color',
  actionBtnHoverBg: '--al-action-btn-hover-bg',
  actionBtnHoverColor: '--al-action-btn-hover-color',
} as const satisfies Record<keyof DialogTokens, `--${string}`>;

/**
 * Token bridge map: short names and/or raw `--*` custom properties.
 *
 * @example
 * ```ts
 * provideDialog({
 *   tokens: {
 *     bg: 'var(--kit-color-surface)',
 *     accent: 'var(--kit-color-primary)',
 *     '--al-dialog-shadow': 'var(--kit-shadow-lg)',
 *   },
 * });
 * ```
 */
export type DialogTokenMap = DialogTokens & {
  [customProp: `--${string}`]: string | undefined;
};

function resolveTokenProperty(key: string): string | undefined {
  if (key.startsWith('--')) return key;
  return DIALOG_TOKEN_VARS[key as keyof DialogTokens];
}

/** Flatten a {@link DialogTokenMap} to CSS custom-property declarations. */
export function dialogTokenStyle(tokens: DialogTokenMap | null | undefined): Record<string, string> {
  if (!tokens) return {};
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value == null || value === '') continue;
    const prop = resolveTokenProperty(key);
    if (prop) style[prop] = value;
  }
  return style;
}

/** Apply a token bridge to an element (typically the native `<dialog>`). */
export function applyDialogTokens(
  target: HTMLElement,
  tokens: DialogTokenMap | null | undefined,
): void {
  const style = dialogTokenStyle(tokens);
  for (const [prop, value] of Object.entries(style)) {
    target.style.setProperty(prop, value);
  }
}

/**
 * Build a CSS rule that maps host tokens onto `dialog.al-dialog`.
 * Useful for injecting a `<style>` tag from a design-system package.
 */
export function dialogTokensAsCss(
  tokens: DialogTokenMap,
  selector = 'dialog.al-dialog',
): string {
  const decls = Object.entries(dialogTokenStyle(tokens))
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');
  return decls ? `${selector} {\n${decls}\n}` : `${selector} {}`;
}
