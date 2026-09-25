/**
 * K1 / K5 pure helpers: keyboard target scoping and the frame tab stop.
 */
import { ownGridSurfaceOf } from './grid-keydown';
import { isFocusCellRendered, type FocusRenderModel } from './tab-stop';

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('ownGridSurfaceOf (K1)', () => {
  const root = dom(`
    <al-data-grid id="outer">
      <al-data-grid-toolbar><button id="tool">Go</button></al-data-grid-toolbar>
      <div class="al-data-grid__frame" id="frame">
        <div class="al-data-grid__th" role="columnheader" id="th"><button id="thbtn"></button></div>
        <div class="al-data-grid__td" role="gridcell" id="td"><span id="inner"></span></div>
        <div class="al-data-grid__td" role="gridcell" id="detail">
          <al-data-grid id="nested"><div class="al-data-grid__td" id="ntd"></div></al-data-grid>
        </div>
        <al-data-grid-status-bar><button id="next">Next</button></al-data-grid-status-bar>
      </div>
      <div class="al-data-grid__ctx" role="menu"><button role="menuitem" id="item"></button></div>
    </al-data-grid>
  `);
  const host = root.querySelector<HTMLElement>('#outer')!;
  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`);

  afterAll(() => root.remove());

  it('accepts own cells / headers (and their descendants), host and frame', () => {
    expect(ownGridSurfaceOf(host, $('td'))).toBe($('td'));
    expect(ownGridSurfaceOf(host, $('inner'))).toBe($('td'));
    expect(ownGridSurfaceOf(host, $('thbtn'))).toBe($('th'));
    expect(ownGridSurfaceOf(host, host)).toBe(host);
    expect(ownGridSurfaceOf(host, $('frame'))).toBe($('frame'));
  });

  it('rejects toolbar, pager, menu, and nested-grid targets', () => {
    expect(ownGridSurfaceOf(host, $('tool'))).toBeNull();
    expect(ownGridSurfaceOf(host, $('next'))).toBeNull();
    expect(ownGridSurfaceOf(host, $('item'))).toBeNull();
    expect(ownGridSurfaceOf(host, $('ntd'))).toBeNull();
    expect(ownGridSurfaceOf(host, $('nested'))).toBeNull();
    expect(ownGridSurfaceOf(host, document.body)).toBeNull();
  });
});

describe('isFocusCellRendered (K5)', () => {
  const base: FocusRenderModel = {
    focus: { rowIndex: 5, columnId: 'a', realm: 'body' },
    visibleColumnIds: ['a', 'b'],
    hasColumnGroups: false,
    floatingFiltersShown: false,
    bodyRendered: true,
    renderedStart: 0,
    renderedCount: 20,
  };

  it('is true for a rendered body cell', () => {
    expect(isFocusCellRendered(base)).toBe(true);
  });

  it('is false when the row is virtualized away, the column hidden, or the body not rendered', () => {
    expect(isFocusCellRendered({ ...base, renderedStart: 10 })).toBe(false);
    expect(isFocusCellRendered({ ...base, visibleColumnIds: ['b'] })).toBe(false);
    expect(isFocusCellRendered({ ...base, bodyRendered: false })).toBe(false);
    expect(isFocusCellRendered({ ...base, focus: null })).toBe(false);
  });

  it('handles header and floating-filter realms', () => {
    const header = { ...base, focus: { rowIndex: 0, columnId: 'b', realm: 'header' as const } };
    expect(isFocusCellRendered(header)).toBe(true);
    const filter = { ...base, focus: { rowIndex: 0, columnId: 'b', realm: 'floatingFilter' as const } };
    expect(isFocusCellRendered(filter)).toBe(false);
    expect(isFocusCellRendered({ ...filter, floatingFiltersShown: true })).toBe(true);
  });
});
