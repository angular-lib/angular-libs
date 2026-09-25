import { isEditorEventTarget } from '../hosts/edit-focus';

/** Cells / headers the grid keyboard model owns (body, header, floating filter). */
const OWN_CELL_SELECTOR =
  '.al-data-grid__td, .al-data-grid__th, [role="gridcell"], [role="columnheader"]';

/**
 * The grid-owned cell / header containing `target`, or the host / frame itself —
 * `null` for toolbar, pager, sidebar, menu, and nested detail grids (K1).
 */
export function ownGridSurfaceOf(host: HTMLElement, target: EventTarget | null): HTMLElement | null {
  // Nearest grid must be this host — nested detail grids are their own realm.
  if (!(target instanceof HTMLElement) || target.closest('al-data-grid') !== host) {
    return null;
  }
  if (target === host || target.classList.contains('al-data-grid__frame')) {
    return target;
  }
  return target.closest<HTMLElement>(OWN_CELL_SELECTOR);
}

/** DOM focus sits on this grid's own cell / header / frame (not an editor or chrome control). */
export function domFocusOnOwnCell(host: HTMLElement): boolean {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  return !!active && ownGridSurfaceOf(host, active) === active;
}

/** Native control inside a cell (renderer button / link) — let Enter / Space activate it. */
function isInteractiveDescendant(surface: HTMLElement, target: HTMLElement): boolean {
  return (
    target !== surface &&
    !!target.closest('button, a[href], [role="button"], [role="link"], summary')
  );
}

export interface GridKeydownDeps {
  host: HTMLElement;
  onEscape(event: KeyboardEvent): void;
  tryToggleFocusedBoolean(): boolean;
  /** Full-row edit with `arrowEditing: 'moveHorizontal'` lets ←/→ leave the field. */
  passHorizontalWhileEditing(): boolean;
  tryTypeToEdit(event: KeyboardEvent): boolean;
  handleFocusKeydown(event: KeyboardEvent): boolean;
}

/**
 * Host `(keydown)` coordinator. Only keys whose target is this grid's own
 * cell / header (or the frame) drive the focus model — toolbar, pager, sidebar,
 * menu, and nested grids keep their native behavior. Editor targets
 * (`isEditorEventTarget`, incl. custom editor hosts) only get Escape and the
 * full-row horizontal hand-off; Enter / Tab stay with the editor.
 */
export function handleGridKeydown(event: KeyboardEvent, deps: GridKeydownDeps): void {
  if (event.defaultPrevented) {
    return;
  }
  const target = event.target as HTMLElement | null;
  const surface = ownGridSurfaceOf(deps.host, target);
  if (!surface || !target) {
    return;
  }
  const inField = isEditorEventTarget(target);

  // Escape must cancel edit even while focus is inside an editor field.
  if (event.key === 'Escape') {
    deps.onEscape(event);
    return;
  }

  const space = event.key === ' ' || event.key === 'Spacebar';
  if ((space || event.key === 'Enter') && isInteractiveDescendant(surface, target)) {
    return;
  }

  if (space && !inField && deps.tryToggleFocusedBoolean()) {
    event.preventDefault();
    return;
  }

  const passHorizontal =
    (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && deps.passHorizontalWhileEditing();
  if (inField && !passHorizontal) {
    return;
  }

  if (!inField && deps.tryTypeToEdit(event)) {
    event.preventDefault();
    return;
  }

  if (deps.handleFocusKeydown(event)) {
    event.preventDefault();
  }
}
