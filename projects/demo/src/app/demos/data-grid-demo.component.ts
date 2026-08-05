import { Component, computed, resource, signal, viewChild } from '@angular/core';
import { form, min, required } from '@angular/forms/signals';
import {
  DataGrid,
  DataGridCellDirective,
  applyCellEdit,
  applyRowEdit,
  createGrid,
  type CellEditEvent,
  type ColumnOrGroupDef,
  type DataGridContextMenuContext,
  type DataGridContextMenuItem,
  type DataGridToolbarSlotItem,
  type PasteEvent,
  type RowEditContext,
  type RowEditEvent,
  type RowReorderEvent,
  serializeGridState,
  parseGridState,
} from '@angular-libs/data-grid';
import {
  aggregateRowPlugin,
  cellRangePlugin,
  defaultGridPlugins,
  flashCellsPlugin,
  notesPlugin,
  rowDragPlugin,
  rowGroupPlugin,
  sideBarPlugin,
  noteKey,
  type Note,
  type NotesMap,
} from '@angular-libs/data-grid/plugins';
import { eventLogPlugin } from './plugins/event-log.plugin';
import { sampleStatusPlugin } from './plugins/sample-status.plugin';

interface Employee {
  id: number;
  name: string;
  role: string;
  department: string;
  salary: number;
  active: boolean;
}

/** Host bag for toolbar `actionClick` — app/plugins only (controller is a separate param). */
interface DemoGridContext {
  flash: ReturnType<typeof flashCellsPlugin<Employee>>;
}

function emptyEmployee(): Employee {
  return { id: 0, name: '', role: '', department: '', salary: 0, active: false };
}

function seedEmployees(count: number): Employee[] {
  const roles = ['Engineer', 'Designer', 'PM', 'Support', 'Sales'];
  const departments = ['Platform', 'Product', 'Growth', 'Ops'];
  const names = [
    'Ada Lovelace',
    'Grace Hopper',
    'Alan Turing',
    'Katherine Johnson',
    'Claude Shannon',
    'Barbara Liskov',
    'Donald Knuth',
    'Margaret Hamilton',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`,
    role: roles[i % roles.length]!,
    department: departments[i % departments.length]!,
    salary: 70_000 + ((i * 1373) % 80_000),
    active: i % 7 !== 0,
  }));
}

const STATE_KEY = 'al-data-grid-demo-state';

@Component({
  selector: 'app-data-grid-demo',
  imports: [DataGrid, DataGridCellDirective],
  template: `
    <section class="demo">
      <header class="demo__header">
        <div>
          <h2>Data Grid</h2>
          <p>
            Held plugins via <code>createGrid</code> + host-owned Signal Form
            (<code>[rowForm]</code>).
          </p>
        </div>
        <div class="demo__controls">
          <label>
            Rows
            <select [value]="rowCount()" (change)="setRowCount($any($event.target).value)">
              <option value="50">50</option>
              <option value="500">500</option>
              <option value="5000">5,000</option>
            </select>
          </label>
          <label class="check">
            <input type="checkbox" [checked]="paginate()" (change)="paginate.set($any($event.target).checked)" />
            Pagination
          </label>
          <label class="check">
            <input type="checkbox" [checked]="sideBar.enabled()" (change)="sideBar.setEnabled($any($event.target).checked)" />
            Tool panels
          </label>
          <label class="check">
            <input
              type="checkbox"
              [checked]="fullRowEdit()"
              (change)="fullRowEdit.set($any($event.target).checked)"
            />
            Full-row edit
          </label>
          <label class="check">
            <input
              type="checkbox"
              [checked]="drag.enabled()"
              (change)="drag.setEnabled($any($event.target).checked)"
            />
            Row drag
          </label>
          <button type="button" class="btn" (click)="saveState()">Save state</button>
          <button type="button" class="btn" (click)="restoreState()">Restore</button>
          <span class="meta">{{ selectedIds().length }} selected · last: {{ lastAction() }}</span>
        </div>
      </header>

      <aside class="demo__foundation" data-testid="al-dg-demo-foundation">
        <p class="demo__foundation-hint">
          Keys: arrows · Shift+arrows range · Home/End · Enter/F2 edit · Space select · ↑ header ·
          Enter sort · Alt+↓ column menu · Esc clears range/menu
        </p>
      </aside>

      <div class="demo__grid">
        <al-data-grid
          #gridRef
          [controller]="grid"
          [data]="rows()"
          [(selectedIds)]="selectedIds"
          [pagination]="paginate()"
          [pageSize]="25"
          [virtual]="!paginate()"
          [rowHeight]="36"
          [columnReorder]="true"
          [contextMenu]="true"
          [contextMenuItems]="menuItems"
          [context]="demoContext"
          [toolbarActions]="demoToolbar()"
          [editMode]="fullRowEdit() ? 'fullRow' : 'cell'"
          [rowForm]="employeeForm"
          [(rowEditSession)]="editSession"
          [rowClass]="rowClass"
          (cellEdit)="onEdit($event)"
          (rowEdit)="onRowEdit($event)"
          (rowReorder)="onReorder($event)"
          (paste)="onPaste($event)"
        >
          <ng-template alGridCell="role" let-value="value">
            <span class="role">{{ value }}</span>
          </ng-template>
        </al-data-grid>
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
      flex: 0 0 auto;
    }

    .demo__header h2 {
      margin: 0 0 4px;
      font-size: 1.35rem;
    }

    .demo__header p {
      margin: 0;
      color: #6b7280;
    }

    .demo__header code {
      font-size: 0.9em;
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
    }

    .demo__controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .demo__controls label {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #6b7280;
    }

    .demo__controls .check {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
    }

    .demo__controls select,
    .btn {
      min-width: 96px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #fff;
      font: inherit;
      cursor: pointer;
    }

    .meta {
      font-size: 13px;
      color: #374151;
      margin-top: 16px;
    }

    .demo__foundation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 16px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      flex: 0 0 auto;
    }

    .demo__foundation-hint {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }

    .demo__foundation-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .demo__foundation-menu {
      font-size: 13px;
      color: #2196f3;
      font-weight: 600;
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

    .role {
      font-weight: 600;
      color: #1565c0;
    }

    :host ::ng-deep .row-inactive {
      opacity: 0.55;
    }
  `,
})
export class DataGridDemoComponent {
  readonly gridRef = viewChild<DataGrid<Employee>>('gridRef');

  readonly rowCount = signal(500);
  readonly paginate = signal(false);
  readonly fullRowEdit = signal(true);
  readonly selectedIds = signal<Array<string | number>>([]);
  readonly rows = signal(seedEmployees(500));
  readonly lastAction = signal('—');
  readonly editSession = signal<RowEditContext<Employee> | null>(null);

  /** Persistent Signal Forms model — always available to the host. */
  readonly employeeModel = signal(emptyEmployee());
  readonly employeeForm = form(this.employeeModel, (path) => {
    required(path.name, { message: 'Name is required' });
    min(path.salary, 1, { message: 'Salary must be > 0' });
  });

  readonly rowId = (row: Employee) => row.id;

  /** Held plugins — adapters stay stable; toggle chrome via adapter APIs. */
  readonly groups = rowGroupPlugin<Employee>({ columns: [] });
  readonly sideBar = sideBarPlugin<Employee>({
    panels: ['columns', 'filters'],
    position: 'right',
    // Events is registered by eventLogPlugin.
    defaultPanel: 'events',
  });
  readonly drag = rowDragPlugin<Employee>(false);
  private readonly aggregate = aggregateRowPlugin<Employee>();
  private readonly sample = sampleStatusPlugin<Employee>();
  private readonly events = eventLogPlugin<Employee>();
  /** Host-owned notes bag (simulates async API load). */
  private readonly notesBackend = new Map<string, Note>([
    [noteKey(2, 'name'), { text: 'Check salary band before review.' }],
  ]);
  readonly notesResource = resource({
    loader: async (): Promise<NotesMap> => {
      await new Promise((r) => setTimeout(r, 120));
      return Object.fromEntries(this.notesBackend);
    },
  });
  readonly notes = notesPlugin<Employee>({
    notes: this.notesResource.value,
    save: async ({ rowId, columnId, note }) => {
      await new Promise((r) => setTimeout(r, 80));
      const key = noteKey(rowId, columnId);
      if (note === undefined) {
        this.notesBackend.delete(key);
      } else {
        this.notesBackend.set(key, note);
      }
    },
    reload: () => {
      this.notesResource.reload();
    },
  });
  readonly flash = flashCellsPlugin<Employee>();
  readonly cellRange = cellRangePlugin<Employee>();

  readonly columns: ColumnOrGroupDef<Employee>[] = [
    {
      headerName: 'Identity',
      children: [
        { field: 'name', filter: true, pinned: 'left', width: 180, editable: true },
        {
          field: 'role',
          filter: 'set',
          flex: 1,
          editable: true,
          cellEditor: 'select',
          cellEditorParams: {
            values: ['Engineer', 'Designer', 'PM', 'Support', 'Sales'],
          },
        },
      ],
    },
    {
      headerName: 'Org',
      children: [
        {
          field: 'department',
          filter: 'set',
          flex: 1,
          editable: true,
          cellEditor: 'select',
          cellEditorParams: {
            values: ['Platform', 'Product', 'Growth', 'Ops'],
          },
        },
        {
          field: 'salary',
          editable: true,
          filter: 'number',
          type: 'number',
          align: 'right',
          width: 120,
          aggFunc: 'sum',
          valueFormatter: (value) =>
            typeof value === 'number'
              ? value.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                })
              : '',
        },
        {
          field: 'active',
          header: 'Active',
          width: 90,
          align: 'center',
          type: 'boolean',
          filter: 'boolean',
          editable: true,
        },
      ],
    },
  ];

  /** Compose plugins once — toggle sidebar / row drag with adapters, not `setPlugins`. */
  readonly grid = createGrid<Employee>({
    columns: this.columns,
    rowId: this.rowId,
    rows: this.rows,
    selection: 'multi',
    editInteraction: 'default',
    plugins: [
      ...defaultGridPlugins<Employee>({ sideBar: false }),
      this.drag,
      this.aggregate,
      this.groups,
      this.sample,
      this.notes,
      this.flash,
      this.cellRange,
      this.sideBar,
      this.events,
    ],
  });

  /** Opaque host bag for toolbar actions — not the grid controller. */
  readonly demoContext: DemoGridContext = {
    flash: this.flash,
  };

  /** Host toolbar actions — use `params.controller` / `params.api` / `params.context`. */
  readonly demoToolbar = computed((): readonly DataGridToolbarSlotItem[] => {
    const hasSelection = this.selectedIds().length > 0;
    return [
      {
        id: 'demo-add-row',
        order: 10,
        icon: '+',
        color: '#059669',
        ariaLabel: 'Add row',
        title: 'Add row (controller applyTransaction)',
        actionClick: ({ controller }) => {
          const id = Date.now();
          controller.applyTransaction({
            add: [
              {
                id,
                name: `New hire ${id}`,
                role: 'Engineer',
                department: 'Platform',
                salary: 80_000,
                active: true,
              },
            ],
            addIndex: 0,
          });
        },
      },
      {
        id: 'demo-remove-selected',
        order: 11,
        icon: '−',
        color: '#dc2626',
        ariaLabel: 'Remove selected',
        title: 'Remove selected rows',
        disabled: !hasSelection,
        actionClick: ({ api, controller }) => {
          const remove = api.getSelectedRows();
          if (!remove.length) {
            return;
          }
          controller.applyTransaction({ remove });
          api.setSelectedRows([]);
        },
      },
      {
        id: 'demo-flash-cells',
        order: 85,
        icon: '✧',
        color: '#d97706',
        ariaLabel: 'Flash cells',
        title: 'Flash selected rows (or sample cells)',
        actionClick: ({ api, context }) => {
          const { flash } = context as DemoGridContext;
          const selected = api.getSelectedIds();
          if (selected.length) {
            flash.flashCells({
              rowIds: selected,
              color: '#fbbf24',
              duration: 1200,
            });
            return;
          }
          flash.flashCells({
            cells: [
              { rowId: 1, columnId: 'salary' },
              { rowId: 2, columnId: 'name' },
              { rowId: 3, columnId: 'role' },
            ],
            color: '#34d399',
            duration: 1200,
          });
        },
      },
    ];
  });

  readonly rowClass = (row: Employee) => (row.active ? null : 'row-inactive');

  readonly menuItems = (ctx: DataGridContextMenuContext<Employee>): DataGridContextMenuItem<Employee>[] => [
    {
      id: 'copy-name',
      label: `Copy “${ctx.row.name}”`,
      action: () => {
        void navigator.clipboard?.writeText(ctx.row.name);
        this.lastAction.set(`copied ${ctx.row.name}`);
      },
    },
    {
      id: 'edit-row',
      label: 'Edit row',
      action: () => {
        this.gridRef()?.startRowEdit(ctx.row, ctx.rowId, ctx.rowIndex);
        this.lastAction.set(`editing #${ctx.rowId}`);
      },
    },
    {
      id: 'toggle-active',
      label: ctx.row.active ? 'Mark away' : 'Mark active',
      separator: true,
      action: () => {
        this.rows.update((list) =>
          list.map((row) => (row.id === ctx.rowId ? { ...row, active: !row.active } : row)),
        );
        this.lastAction.set(`toggled #${ctx.rowId}`);
      },
    },
    {
      id: 'export',
      label: 'Export CSV',
      action: () => {
        this.gridRef()?.exportCsv();
        this.lastAction.set('exported CSV');
      },
    },
  ];

  setRowCount(value: string): void {
    const count = Number(value);
    this.rowCount.set(count);
    this.rows.set(seedEmployees(count));
    this.selectedIds.set([]);
  }

  onEdit(event: CellEditEvent<Employee>): void {
    this.rows.update((list) => applyCellEdit(list, event, (row) => row.id));
    this.lastAction.set(`cell edit #${event.rowId}.${event.columnId}`);
  }

  onRowEdit(event: RowEditEvent<Employee>): void {
    this.rows.update((list) => applyRowEdit(list, event, (row) => row.id));
    this.lastAction.set(`row saved #${event.rowId}`);
  }

  onReorder(event: RowReorderEvent<Employee>): void {
    this.rows.set([...event.rows]);
    this.lastAction.set(`reordered ${event.fromIndex} → ${event.toIndex}`);
  }

  onPaste(event: PasteEvent<Employee>): void {
    this.rows.update((list) => {
      const next = [...list];
      for (let i = 0; i < event.suggestedRows.length; i++) {
        const suggested = event.suggestedRows[i]!;
        const id = suggested.id;
        const idx = next.findIndex((r) => r.id === id);
        if (idx >= 0) {
          next[idx] = suggested;
        }
      }
      return next;
    });
    this.lastAction.set(`pasted ${event.matrix.length}×${event.columnIds.length}`);
  }

  saveState(): void {
    const grid = this.gridRef();
    if (!grid || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STATE_KEY, serializeGridState(grid.getState()));
  }

  restoreState(): void {
    const grid = this.gridRef();
    if (!grid || typeof localStorage === 'undefined') {
      return;
    }
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      return;
    }
    const state = parseGridState(raw);
    if (state) {
      grid.setState(state);
    }
  }
}
