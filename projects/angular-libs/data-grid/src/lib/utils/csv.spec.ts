import { vi } from 'vitest';
import { resolveColumns } from './cell-value';
import { defaultCsvColumnSeparator, downloadCsv, rowsToCsv, rowsToCsvExport } from './csv';

interface Row {
  name: string;
  amount: number;
  note?: string;
}

const cols = resolveColumns<Row>([
  { field: 'name', header: 'Navn' },
  { field: 'amount', header: 'Beløp' },
]);

describe('csv', () => {
  it('quotes separators, quotes and newlines', () => {
    const csv = rowsToCsv<Row>(
      [{ name: 'a,b', amount: 1 }, { name: 'say "hi"\nthere', amount: 2 }],
      cols,
      { columnSeparator: ';' },
    );
    expect(csv).toBe('Navn;Beløp\na,b;1\n"say ""hi""\nthere";2');
    expect(rowsToCsv<Row>([{ name: 'x;y', amount: 1 }], cols, { columnSeparator: ';' })).toContain(
      '"x;y";1',
    );
  });

  it('export escapes formula injection but keeps plain negative numbers', () => {
    const rows: Row[] = [
      { name: '=HYPERLINK("http://evil","x")', amount: -12.5 },
      { name: '+cmd', amount: 1 },
      { name: '-2+3', amount: 1 },
      { name: '@SUM(A1)', amount: 1 },
      { name: '\tTAB', amount: 1 },
      { name: '-12.5', amount: 1 },
      { name: 'plain', amount: 1 },
    ];
    const lines = rowsToCsvExport(rows, cols, { columnSeparator: ',' }).split('\r\n');
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://evil"",""x"")",-12.5`);
    expect(lines[2]).toBe(`'+cmd,1`);
    expect(lines[3]).toBe(`'-2+3,1`);
    expect(lines[4]).toBe(`'@SUM(A1),1`);
    expect(lines[5]).toBe(`'\tTAB,1`);
    expect(lines[6]).toBe(`-12.5,1`);
    expect(lines[7]).toBe(`plain,1`);
    // Opt-out.
    expect(rowsToCsvExport(rows.slice(1, 2), cols, { escapeFormulas: false, columnSeparator: ',' })).toBe(
      'Navn,Beløp\r\n+cmd,1',
    );
  });

  it('export uses CRLF and a locale list separator', () => {
    expect(defaultCsvColumnSeparator('nb-NO')).toBe(';');
    expect(defaultCsvColumnSeparator('de-DE')).toBe(';');
    expect(defaultCsvColumnSeparator('en-US')).toBe(',');
    const csv = rowsToCsvExport<Row>([{ name: 'Ærlig', amount: 3 }], cols, { locale: 'nb-NO' });
    expect(csv).toBe('Navn;Beløp\r\nÆrlig;3');
  });

  it('processCell / useFormatter control cell text', () => {
    const withFormatter = resolveColumns<Row>([
      { field: 'amount', valueFormatter: (v) => `kr ${String(v)}` },
    ]);
    const rows: Row[] = [{ name: 'a', amount: 5 }];
    expect(rowsToCsv(rows, withFormatter, { includeHeaders: false })).toBe('kr 5');
    expect(rowsToCsv(rows, withFormatter, { includeHeaders: false, useFormatter: false })).toBe('5');
    expect(
      rowsToCsv(rows, withFormatter, {
        includeHeaders: false,
        processCell: ({ value, formatted }) => `${formatted}|${String(value)}`,
      }),
    ).toBe('kr 5|5');
  });

  it('download prepends a UTF-8 BOM, attaches the anchor and revokes later', async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:x';
    });
    const revoke = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revoke;
    let attached = false;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        attached = this.isConnected;
      });
    try {
      downloadCsv('x.csv', 'a;b');
      expect(attached).toBe(true);
      expect(revoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith('blob:x');
      const bytes = new Uint8Array(await blobs[0]!.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(document.querySelector('a[download]')).toBeNull();
    } finally {
      click.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      vi.useRealTimers();
    }
  });
});
