/** Shared CSS for date/time picker popovers (inlined into field components). */
export const PICKER_PANEL_STYLES = `
  .al-picker-panel {
    margin: 0;
    padding: 0.5rem;
    border: 1px solid var(--al-form-border, #c4c4c4);
    border-radius: var(--al-picker-radius, 0.25rem);
    background: var(--al-picker-surface, #fff);
    color: inherit;
    box-shadow: var(--al-picker-panel-shadow, 0 4px 16px rgba(0, 0, 0, 0.12));
    inset: unset;
    left: anchor(left);
    top: anchor(bottom);
    position-try-fallbacks: flip-block, flip-inline;
  }
  .al-picker-panel:popover-open {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @supports not (anchor-name: --x) {
    .al-picker-panel {
      left: 0;
      top: 100%;
    }
  }
  .al-picker-actions {
    display: flex;
    gap: 0.35rem;
    justify-content: flex-end;
  }
  .al-picker-actions button {
    border: 1px solid var(--al-form-border, #c4c4c4);
    background: var(--al-picker-surface, #fff);
    border-radius: var(--al-picker-radius, 0.25rem);
    padding: 0.3rem 0.6rem;
    font: inherit;
    cursor: pointer;
    color: inherit;
  }
  .al-picker-actions button:hover {
    background: var(--al-picker-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .al-picker-time {
    display: flex;
    gap: 0.25rem;
    height: 12rem;
  }
  .al-picker-time al-item-list {
    flex: 1 1 0;
    min-width: 3rem;
    border: 1px solid var(--al-form-border, #c4c4c4);
    border-radius: var(--al-picker-radius, 0.25rem);
  }
  .al-picker-datetime {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
  }
  input.al-picker-input::-webkit-calendar-picker-indicator {
    display: none;
  }
  input.al-picker-input {
    color-scheme: inherit;
  }
`;
