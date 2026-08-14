/**
 * Floating note preview / editor — DOM-only (no CDK), same spirit as AlTooltipDirective.
 * Styles live in `data-grid.css` (binder-owned); no document.head injection.
 */

import type { Note } from './notes.types';

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
  /**
   * Prefer the grid host so binder CSS (`:host ::ng-deep`) applies.
   * Falls back to `document.body`.
   */
  container?: HTMLElement | null;
  labels?: NotePopoverLabels;
}

export interface NotePopoverLabels {
  title: string;
  add: string;
  edit: string;
  remove: string;
  placeholder: string;
  save: string;
  cancel: string;
}

const DEFAULT_NOTE_LABELS: NotePopoverLabels = {
  title: 'Note',
  add: 'Add note',
  edit: 'Edit note',
  remove: 'Remove note',
  placeholder: 'Write a note…',
  save: 'Save',
  cancel: 'Cancel',
};

export function openNotePopover(options: OpenNotePopoverOptions): HTMLElement {
  if (options.mode === 'preview') {
    return openPreviewPopover(options);
  }
  return openEditPopover(options);
}

function mountRoot(options: OpenNotePopoverOptions, root: HTMLElement): void {
  const container = options.container ?? (typeof document !== 'undefined' ? document.body : null);
  container?.appendChild(root);
  positionPopover(root, options.anchor);
}

function openPreviewPopover(options: OpenNotePopoverOptions): HTMLElement {
  const labels = { ...DEFAULT_NOTE_LABELS, ...options.labels };
  const root = document.createElement('div');
  root.className = 'al-dg-note-popover al-dg-note-popover--preview';
  root.setAttribute('data-testid', 'al-dg-note-preview');
  root.setAttribute('role', 'tooltip');

  const title = document.createElement('div');
  title.className = 'al-dg-note-popover__title';
  title.textContent = labels.title;

  const body = document.createElement('div');
  body.className = 'al-dg-note-popover__body';
  body.textContent = options.note?.text ?? '';

  root.append(title, body);
  mountRoot(options, root);
  return root;
}

function openEditPopover(options: OpenNotePopoverOptions): HTMLElement {
  const labels = { ...DEFAULT_NOTE_LABELS, ...options.labels };
  const heading = options.isNew ? labels.add : labels.edit;
  const root = document.createElement('div');
  root.className = 'al-dg-note-popover';
  root.setAttribute('data-testid', 'al-dg-note-popover');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', heading);

  const title = document.createElement('div');
  title.className = 'al-dg-note-popover__title';
  title.textContent = heading;

  const input = document.createElement('textarea');
  input.className = 'al-dg-note-popover__input';
  input.value = options.note?.text ?? '';
  input.placeholder = labels.placeholder;
  input.setAttribute('data-testid', 'al-dg-note-input');

  const actions = document.createElement('div');
  actions.className = 'al-dg-note-popover__actions';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'al-dg-note-popover__btn al-dg-note-popover__btn--danger';
  removeBtn.textContent = labels.remove;
  removeBtn.disabled = options.isNew && !options.note?.text;
  removeBtn.setAttribute('data-testid', 'al-dg-note-remove');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'al-dg-note-popover__btn';
  cancelBtn.textContent = labels.cancel;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'al-dg-note-popover__btn al-dg-note-popover__btn--primary';
  saveBtn.textContent = labels.save;
  saveBtn.setAttribute('data-testid', 'al-dg-note-save');

  actions.append(removeBtn, cancelBtn, saveBtn);
  root.append(title, input, actions);
  mountRoot(options, root);

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
