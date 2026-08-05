/**
 * Floating note preview / editor — DOM-only (no CDK), same spirit as AlTooltipDirective.
 */

import type { Note } from './notes.types';

const STYLE_ID = 'al-dg-notes-styles';

const NOTES_CSS = `
.al-dg-cell--has-note {
  position: relative;
}
.al-dg-cell--has-note::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 10px 10px 0;
  border-color: transparent var(--al-dg-note-marker, #f59e0b) transparent transparent;
  pointer-events: none;
}
.al-dg-note-popover {
  position: fixed;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(280px, calc(100vw - 16px));
  padding: 10px;
  border: 1px solid var(--al-dg-border, #babfc7);
  border-radius: 8px;
  background: var(--al-dg-bg, #fff);
  color: var(--al-dg-fg, #181d1f);
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  font: 13px/1.35 ui-sans-serif, system-ui, sans-serif;
}
.al-dg-note-popover--preview {
  gap: 4px;
  padding: 8px 10px;
  pointer-events: none;
}
.al-dg-note-popover__title {
  font-size: 12px;
  font-weight: 650;
  color: var(--al-dg-muted, #5f6368);
}
.al-dg-note-popover__body {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow: auto;
}
.al-dg-note-popover__input {
  width: 100%;
  min-height: 88px;
  resize: vertical;
  box-sizing: border-box;
  border: 1px solid var(--al-dg-border, #babfc7);
  border-radius: 6px;
  padding: 8px;
  font: inherit;
  background: var(--al-dg-bg, #fff);
  color: inherit;
}
.al-dg-note-popover__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.al-dg-note-popover__btn {
  border: 1px solid var(--al-dg-border, #babfc7);
  border-radius: 6px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
  background: var(--al-dg-header-bg, #f8f8f8);
  color: inherit;
}
.al-dg-note-popover__btn--primary {
  background: var(--al-dg-accent, #2196f3);
  border-color: var(--al-dg-accent, #2196f3);
  color: #fff;
}
.al-dg-note-popover__btn--danger {
  color: var(--al-dg-danger, #d32f2f);
}
`;

export function ensureNotesStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = NOTES_CSS;
  document.head.appendChild(style);
}

export type NotePopoverMode = 'preview' | 'edit';

export interface NotePopoverHandlers {
  onSave: (text: string) => void;
  onRemove: () => void;
  onClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export interface OpenNotePopoverOptions {
  anchor: DOMRect;
  note: Note | undefined;
  isNew: boolean;
  /** Hover shows read-only preview; context menu / Shift+F2 opens the editor. */
  mode: NotePopoverMode;
  handlers: NotePopoverHandlers;
}

export function openNotePopover(options: OpenNotePopoverOptions): HTMLElement {
  ensureNotesStyles();

  if (options.mode === 'preview') {
    return openPreviewPopover(options);
  }
  return openEditPopover(options);
}

function openPreviewPopover(options: OpenNotePopoverOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'al-dg-note-popover al-dg-note-popover--preview';
  root.setAttribute('data-testid', 'al-dg-note-preview');
  root.setAttribute('role', 'tooltip');

  const title = document.createElement('div');
  title.className = 'al-dg-note-popover__title';
  title.textContent = 'Note';

  const body = document.createElement('div');
  body.className = 'al-dg-note-popover__body';
  body.textContent = options.note?.text ?? '';

  root.append(title, body);
  document.body.appendChild(root);
  positionPopover(root, options.anchor);
  return root;
}

function openEditPopover(options: OpenNotePopoverOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'al-dg-note-popover';
  root.setAttribute('data-testid', 'al-dg-note-popover');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', options.isNew ? 'Add note' : 'Edit note');

  const title = document.createElement('div');
  title.className = 'al-dg-note-popover__title';
  title.textContent = options.isNew ? 'Add note' : 'Edit note';

  const input = document.createElement('textarea');
  input.className = 'al-dg-note-popover__input';
  input.value = options.note?.text ?? '';
  input.placeholder = 'Write a note…';
  input.setAttribute('data-testid', 'al-dg-note-input');

  const actions = document.createElement('div');
  actions.className = 'al-dg-note-popover__actions';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'al-dg-note-popover__btn al-dg-note-popover__btn--danger';
  removeBtn.textContent = 'Remove';
  removeBtn.disabled = options.isNew && !options.note?.text;
  removeBtn.setAttribute('data-testid', 'al-dg-note-remove');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'al-dg-note-popover__btn';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'al-dg-note-popover__btn al-dg-note-popover__btn--primary';
  saveBtn.textContent = 'Save';
  saveBtn.setAttribute('data-testid', 'al-dg-note-save');

  actions.append(removeBtn, cancelBtn, saveBtn);
  root.append(title, input, actions);
  document.body.appendChild(root);

  positionPopover(root, options.anchor);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options.handlers.onClose();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      options.handlers.onSave(input.value);
    }
  };

  root.addEventListener('pointerenter', options.handlers.onPointerEnter);
  root.addEventListener('pointerleave', options.handlers.onPointerLeave);
  root.addEventListener('keydown', onKey);
  saveBtn.addEventListener('click', () => options.handlers.onSave(input.value));
  cancelBtn.addEventListener('click', () => options.handlers.onClose());
  removeBtn.addEventListener('click', () => options.handlers.onRemove());

  queueMicrotask(() => input.focus());

  return root;
}

export function closeNotePopover(el: HTMLElement | null): void {
  el?.remove();
}

function positionPopover(el: HTMLElement, anchor: DOMRect): void {
  const pad = 8;
  const width = el.offsetWidth || 280;
  const height = el.offsetHeight || 160;
  let left = anchor.left;
  let top = anchor.bottom + 6;
  if (left + width > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - width - pad);
  }
  if (top + height > window.innerHeight - pad) {
    top = Math.max(pad, anchor.top - height - 6);
  }
  el.style.left = `${Math.max(pad, left)}px`;
  el.style.top = `${Math.max(pad, top)}px`;
}
