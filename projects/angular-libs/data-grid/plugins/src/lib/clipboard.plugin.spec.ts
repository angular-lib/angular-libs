import { describe, expect, it, vi } from 'vitest';
import { GridCapabilities } from '@angular-libs/data-grid/plugin';
import {
  clipboardPlugin,
  shouldDeferToNativeClipboard,
} from './clipboard.plugin';

function selectText(el: Node): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

describe('shouldDeferToNativeClipboard', () => {
  it('defers when DOM text is selected', () => {
    const pre = document.createElement('pre');
    pre.textContent = '{"rowId":2,"event":"click"}';
    document.body.appendChild(pre);
    selectText(pre);

    expect(shouldDeferToNativeClipboard(new Event('copy'))).toBe(true);

    clearSelection();
    pre.remove();
  });

  it('does not defer a collapsed caret', () => {
    clearSelection();
    expect(shouldDeferToNativeClipboard(new Event('copy'))).toBe(false);
  });

  it('defers when the copy target is an editor field', () => {
    const input = document.createElement('input');
    expect(shouldDeferToNativeClipboard({ target: input } as unknown as Event)).toBe(true);
  });
});

describe('clipboardPlugin copy', () => {
  it('leaves native copy alone when sidebar text is selected', () => {
    const caps = new GridCapabilities();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const getText = vi.fn(() => 'Ada Lovelace 1');
    const plugin = clipboardPlugin({ paste: false });
    plugin.setup?.({
      api: { getSelectionClipboardText: getText } as never,
      element: host,
      injector: null as never,
      slots: { enableCopy: () => () => undefined } as never,
      capabilities: caps,
    });

    const copy = caps.getInteractions().find((item) => item.id === 'clipboard-copy');
    expect(copy).toBeTruthy();
    const detach = copy!.setup(host);

    const pre = document.createElement('pre');
    pre.textContent = '{"rowId":2}';
    host.appendChild(pre);
    selectText(pre);

    const event = new Event('copy', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(getText).not.toHaveBeenCalled();

    clearSelection();
    detach?.();
    host.remove();
  });

  it('copies the focused cell when nothing is selected', () => {
    const caps = new GridCapabilities();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const plugin = clipboardPlugin({ paste: false });
    plugin.setup?.({
      api: { getSelectionClipboardText: () => 'Ada Lovelace 1' } as never,
      element: host,
      injector: null as never,
      slots: { enableCopy: () => () => undefined } as never,
      capabilities: caps,
    });

    const copy = caps.getInteractions().find((item) => item.id === 'clipboard-copy');
    const detach = copy!.setup(host);
    clearSelection();

    const event = new Event('copy', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    detach?.();
    host.remove();
  });
});
