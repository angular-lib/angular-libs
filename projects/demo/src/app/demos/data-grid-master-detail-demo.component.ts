import { Component, signal } from '@angular/core';
import { DataGrid, createGrid, type ColumnDef } from '@angular-libs/data-grid';
import {
  defaultGridPlugins,
  masterDetailPlugin,
} from '@angular-libs/data-grid/plugins';

interface CallRecord {
  callId: number;
  direction: string;
  number: string;
  duration: number;
}

interface Account {
  id: number;
  name: string;
  account: number;
  calls: CallRecord[];
}

const ACCOUNTS: Account[] = [
  {
    id: 1,
    name: 'Mila Smith',
    account: 177_000,
    calls: [
      { callId: 1, direction: 'Out', number: '(02) 555-0121', duration: 72 },
      { callId: 2, direction: 'In', number: '(02) 555-0199', duration: 45 },
    ],
  },
  {
    id: 2,
    name: 'Evelyn Taylor',
    account: 188_000,
    calls: [{ callId: 3, direction: 'In', number: '(03) 555-0144', duration: 120 }],
  },
  {
    id: 3,
    name: 'Noah Wilson',
    account: 165_000,
    calls: [],
  },
  {
    id: 4,
    name: 'Olivia Brown',
    account: 192_500,
    calls: [
      { callId: 4, direction: 'Out', number: '(04) 555-0177', duration: 33 },
      { callId: 5, direction: 'Out', number: '(04) 555-0188', duration: 91 },
      { callId: 6, direction: 'In', number: '(04) 555-0101', duration: 15 },
    ],
  },
];

const detailColumns: ColumnDef<CallRecord>[] = [
  { field: 'callId', header: 'Call ID', width: 90 },
  { field: 'direction', header: 'Direction', width: 100 },
  { field: 'number', header: 'Number', flex: 1 },
  {
    field: 'duration',
    header: 'Duration (s)',
    type: 'number',
    width: 120,
    align: 'right',
  },
];

@Component({
  selector: 'app-data-grid-master-detail-demo',
  imports: [DataGrid],
  template: `
    <section class="demo">
      <header class="demo__header">
        <div>
          <h2>Master / Detail</h2>
          <p>
            AG-inspired expand rows via <code>masterDetailPlugin</code> — detail is a
            full-width display-kind panel (built-in table or custom component).
          </p>
        </div>
        <div class="demo__controls">
          <button type="button" class="btn" (click)="expandAll()" data-testid="md-expand-all">
            Expand all
          </button>
          <button type="button" class="btn" (click)="masterDetail.collapseAll()" data-testid="md-collapse-all">
            Collapse all
          </button>
        </div>
      </header>

      <div class="demo__grid">
        <al-data-grid [controller]="grid" [data]="rows()" />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    .demo {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    .demo__header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      align-items: end;
    }
    .demo__header h2 {
      margin: 0 0 4px;
      font-size: 1.35rem;
    }
    .demo__header p {
      margin: 0;
      color: #6b7280;
      max-width: 52rem;
    }
    .demo__header code {
      font-size: 0.9em;
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
    }
    .demo__controls {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #fff;
      font: inherit;
      cursor: pointer;
    }
    .demo__grid {
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    al-data-grid {
      height: 100%;
      min-height: 0;
    }
  `,
})
export class DataGridMasterDetailDemoComponent {
  readonly rows = signal(ACCOUNTS);

  readonly masterDetail = masterDetailPlugin<Account, CallRecord>({
    getDetailRows: (row) => row.calls,
    detailColumns,
    detailRowHeight: 168,
    isRowMaster: (row) => row.calls.length > 0,
    isOpenByDefault: (row) => row.id === 1,
  });

  readonly grid = createGrid<Account>({
    columns: [
      this.masterDetail.expandColumn(),
      { field: 'name', header: 'Name', flex: 1, filter: true },
      { field: 'account', header: 'Account', type: 'number', width: 140, align: 'right' },
      {
        id: 'calls',
        header: 'Calls',
        width: 90,
        align: 'right',
        valueGetter: (row) => row.calls.length,
      },
    ],
    rowId: (row) => row.id,
    plugins: [...defaultGridPlugins({ sideBar: false }), this.masterDetail],
    selection: 'single',
    viewport: { rowHeight: 40, virtual: true },
  });

  expandAll(): void {
    const ids = this.rows()
      .filter((r) => r.calls.length > 0)
      .map((r) => r.id);
    this.masterDetail.expandAll(ids);
  }
}
