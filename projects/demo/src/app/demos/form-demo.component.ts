import { Component, computed, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import {
  AlSignalForm,
  AlTextInput,
  FORM_WIDTHS,
  createForm,
  formFactories,
  seedSelection,
  toColumnDefs,
} from '@angular-libs/form';
import type { FormUiFieldTree } from '@angular-libs/form';

interface DemoUser {
  username: string;
  age: number;
  bio: string;
  active: boolean;
  roleId: number;
  tagIds: number[];
  folderId: number;
  countryCode: string;
  skillIds: number[];
  assigneeId: number;
  firstName: string;
  lastName: string;
  secret: string;
  query: string;
  website: string;
  birthDate: string;
  meetingTime: string;
  appointment: string;
  plan: string;
  notifications: boolean;
  volume: number;
  avatar: File | null;
  attachments: File[];
  accentColor: string;
  labels: string[];
  estimateSeconds: number | null;
  customNote: string;
}

const ROLE_ITEMS = [
  { id: 2, name: 'Editor', description: 'Content edit', dept: 'Content' },
  { id: 3, name: 'Viewer', description: 'Read only', dept: 'Content' },
  { id: 1, name: 'Admin', description: 'Full access', dept: 'Platform' },
  { id: 4, name: 'Auditor', description: 'Compliance', dept: 'Platform' },
] as const;

const TAG_ITEMS = [
  { id: 10, name: 'Angular' },
  { id: 11, name: 'Signals' },
  { id: 12, name: 'TypeScript' },
  { id: 13, name: 'RxJS' },
  { id: 14, name: 'CSS' },
] as const;

/** Mutable so creatable skills can append. */
const SKILL_CATALOG: { id: number; name: string }[] = [
  { id: 100, name: 'TypeScript' },
  { id: 101, name: 'RxJS' },
  { id: 102, name: 'NgRx' },
];

let nextSkillId = 200;

const FOLDER_TREE: Record<string, unknown>[] = [
  {
    id: 1,
    name: 'Projects',
    children: [
      {
        id: 2,
        name: 'Angular Libs',
        children: [
          { id: 3, name: 'Form' },
          { id: 4, name: 'Dialog' },
        ],
      },
      { id: 5, name: 'Demo App' },
    ],
  },
  {
    id: 6,
    name: 'Archive',
    children: [
      { id: 7, name: '2024' },
      { id: 8, name: '2025' },
    ],
  },
];

const COUNTRY_ITEMS = [
  { code: 'NO', name: 'Norway', region: 'Nordics' },
  { code: 'SE', name: 'Sweden', region: 'Nordics' },
  { code: 'DK', name: 'Denmark', region: 'Nordics' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'US', name: 'United States', region: 'Americas' },
  { code: 'CA', name: 'Canada', region: 'Americas' },
] as const;

const REMOTE_PEOPLE = Array.from({ length: 80 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  email: `person${i + 1}@example.com`,
}));

const f = formFactories<DemoUser>();

/** Minimal custom field used by `f.custom` in the demo. */
@Component({
  selector: 'app-demo-custom-note',
  imports: [AlTextInput, FormField],
  template: `
    @if (field(); as fieldTree) {
      <al-text-input
        [formField]="$any(fieldTree)"
        [placeholder]="placeholder()" />
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
class DemoCustomNote {
  readonly field = input<FormUiFieldTree | null>(null);
  readonly placeholder = input('Custom editor…');
}

@Component({
  selector: 'app-form-demo',
  imports: [AlSignalForm, JsonPipe],
  template: `
    <h2>Signal Form</h2>
    <p>
      Host-owned <code>form()</code> + all built-in editors (text, number, pickers, select,
      radio, switch, slider, file, color, tags, duration, custom, layout).
    </p>

    <al-signal-form [form]="userForm" [controller]="formUi" />

    <div class="actions">
      <button type="button" (click)="trySubmit()">Submit</button>
      <button type="button" (click)="reset()">Reset</button>
      <button type="button" (click)="reseed()">Reseed display</button>
    </div>

    @if (lastSearch()) {
      <p class="search-echo">Last search: <code>{{ lastSearch() }}</code></p>
    }
    @if (lastCreatedSkill()) {
      <p class="search-echo">Created skill: <code>{{ lastCreatedSkill() }}</code></p>
    }

    <h3>Model</h3>
    <pre>{{ modelPreview() | json }}</pre>

    <h3>toColumnDefs</h3>
    <pre>{{ columns | json }}</pre>
  `,
  styles: `
    :host {
      display: block;
      max-width: 48rem;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      margin-block: 1rem;
    }
    .search-echo {
      font-size: 0.9rem;
      opacity: 0.85;
    }
    pre {
      background: #f4f4f4;
      padding: 0.75rem;
      overflow: auto;
      font-size: 0.85rem;
    }
  `,
})
export class FormDemoComponent {
  readonly model = signal<DemoUser>({
    username: 'ada',
    age: 36,
    bio: '',
    active: true,
    roleId: 1,
    tagIds: [10],
    folderId: 3,
    countryCode: 'NO',
    skillIds: [100],
    assigneeId: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    secret: 'analytical',
    query: '',
    website: 'example',
    birthDate: '1815-12-10',
    meetingTime: '09:30',
    appointment: '2026-08-15T14:00',
    plan: 'pro',
    notifications: true,
    volume: 40,
    avatar: null,
    attachments: [],
    accentColor: '#ea580c',
    labels: ['signals', 'forms'],
    estimateSeconds: 3723,
    customNote: 'Hello from custom',
  });

  readonly lastSearch = signal('');
  readonly lastCreatedSkill = signal('');

  /** JSON-friendly view (File → name/size/type). */
  readonly modelPreview = computed(() => {
    const m = this.model();
    return {
      ...m,
      avatar: fileMeta(m.avatar),
      attachments: m.attachments.map((file) => fileMeta(file)),
    };
  });

  readonly userForm = form(this.model, (p) => {
    required(p.username, { message: 'Required' });
    required(p.firstName, { message: 'Required' });
    min(p.age, 0, { message: 'Age must be ≥ 0' });
    min(p.roleId, 1, { message: 'Pick a role' });
    min(p.volume, 0);
    max(p.volume, 100);
  });

  readonly formUi = createForm<DemoUser>({
    elements: [
      f.row([
        f.text({
          path: 'firstName',
          label: 'First name',
          width: FORM_WIDTHS.half,
          props: { clearable: true },
        }),
        f.text({
          path: 'lastName',
          label: 'Last name',
          width: FORM_WIDTHS.half,
          props: { clearable: true },
        }),
      ]),
      f.lineBreak(),
      f.text({
        path: 'username',
        label: 'Username',
        width: FORM_WIDTHS.half,
        props: { clearable: true },
      }),
      f.number({
        path: 'age',
        label: 'Age',
        width: FORM_WIDTHS.half,
        props: { clearable: true },
      }),
      f.lineBreak(),
      f.text({
        path: 'website',
        label: 'Website',
        width: FORM_WIDTHS.full,
        labelHelp: 'Stored without scheme',
        props: { prefix: 'https://', suffix: '.com', clearable: true },
      }),
      f.password({
        path: 'secret',
        label: 'Password',
        width: FORM_WIDTHS.half,
        props: { clearable: true },
      }),
      f.search({
        path: 'query',
        label: 'Search',
        width: FORM_WIDTHS.half,
        props: {
          debounceMs: 250,
          onSearch: ({ term }) => this.lastSearch.set(term),
        },
      }),
      f.lineBreak(),
      f.textarea({
        path: 'bio',
        label: 'Bio',
        width: FORM_WIDTHS.full,
        props: { rows: 3, maxLength: 120, autoGrow: true },
      }),
      f.checkbox({
        path: 'active',
        label: 'Active',
        width: FORM_WIDTHS.half,
        props: { checkboxLabel: 'Enabled' },
      }),
      f.switch({
        path: 'notifications',
        label: 'Notifications',
        width: FORM_WIDTHS.half,
        props: { switchLabel: 'Email alerts' },
      }),

      f.space({ props: { height: '0.35rem' } }),

      f.date({
        path: 'birthDate',
        label: 'Birth date',
        width: FORM_WIDTHS.third,
        props: { clearable: true },
      }),
      f.time({
        path: 'meetingTime',
        label: 'Meeting time',
        width: FORM_WIDTHS.third,
        props: { step: 5, clearable: true },
      }),
      f.datetime({
        path: 'appointment',
        label: 'Appointment',
        width: FORM_WIDTHS.third,
        props: { step: 15, clearable: true },
      }),
      f.lineBreak(),
      f.duration({
        path: 'estimateSeconds',
        label: 'Estimate',
        width: FORM_WIDTHS.half,
        labelHelp: 'Total seconds (hh:mm:ss)',
        props: { showSeconds: true, maxHours: 99 },
      }),
      f.color({
        path: 'accentColor',
        label: 'Accent',
        width: FORM_WIDTHS.half,
        props: { showHex: true },
      }),

      f.space({ props: { height: '0.35rem' } }),

      f.radio({
        path: 'plan',
        label: 'Plan',
        width: FORM_WIDTHS.full,
        props: {
          direction: 'row',
          options: [
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
            { value: 'team', label: 'Team' },
          ],
        },
      }),
      f.slider({
        path: 'volume',
        label: 'Volume',
        width: FORM_WIDTHS.full,
        labelHelp: 'min/max from form schema (0–100)',
        props: { step: 5, showValue: true },
      }),
      f.tags({
        path: 'labels',
        label: 'Labels',
        width: FORM_WIDTHS.full,
        props: { placeholder: 'Add label…', maxTags: 8 },
      }),
      f.file({
        path: 'avatar',
        label: 'Avatar',
        width: FORM_WIDTHS.half,
        props: { accept: 'image/*' },
      }),
      f.file({
        path: 'attachments',
        label: 'Attachments',
        width: FORM_WIDTHS.half,
        props: { multiple: true, maxFiles: 5 },
      }),
      f.custom({
        path: 'customNote',
        label: 'Custom note',
        width: FORM_WIDTHS.full,
        labelHelp: 'formCustom + AlTextInput',
        props: {
          component: DemoCustomNote,
          inputs: { placeholder: 'Type in a custom field…' },
        },
      }),

      f.space({ props: { height: '0.35rem' } }),

      f.select({
        path: 'roleId',
        label: 'Role (search + columns)',
        width: FORM_WIDTHS.half,
        labelHelp: 'Client search, multi-column panel, groupBy dept',
        props: {
          valueKey: 'id',
          labelKeys: ['name', 'description'],
          placeholder: 'Pick a role…',
          searchable: true,
          groupBy: 'dept',
          columns: [
            { field: 'name', header: 'Role', width: '40%' },
            { field: 'description', header: 'Access', width: '40%' },
            { field: 'dept', header: 'Dept', width: '20%' },
          ],
          items: [...ROLE_ITEMS],
          emptyValue: 0,
        },
      }),
      f.select({
        path: 'countryCode',
        label: 'Country (grouped)',
        width: FORM_WIDTHS.half,
        labelHelp: 'groupBy region',
        props: {
          valueKey: 'code',
          labelKeys: ['name'],
          placeholder: 'Pick a country…',
          searchable: true,
          groupBy: 'region',
          items: [...COUNTRY_ITEMS],
          emptyValue: '',
        },
      }),
      f.lineBreak(),
      f.select({
        path: 'tagIds',
        label: 'Tags (lazy multi + checkboxes)',
        width: FORM_WIDTHS.full,
        labelHelp: 'loadItems with delay + enableCheckboxes',
        props: {
          valueKey: 'id',
          labelKeys: ['name'],
          multiple: true,
          enableCheckboxes: true,
          placeholder: 'Pick tags…',
          loadItems: () =>
            new Promise((resolve) => {
              setTimeout(() => resolve([...TAG_ITEMS]), 400);
            }),
        },
      }),
      f.select({
        path: 'skillIds',
        label: 'Skills (creatable)',
        width: FORM_WIDTHS.full,
        labelHelp: 'Type a new name → Enter / Create. onCreate returns a real id (S2-safe).',
        props: {
          valueKey: 'id',
          labelKeys: ['name'],
          multiple: true,
          searchable: true,
          placeholder: 'Pick or create skills…',
          items: SKILL_CATALOG,
          creatable: {
            createOnComma: true,
            onCreate: (term) => {
              const row = { id: nextSkillId++, name: term.trim() };
              SKILL_CATALOG.push(row);
              this.lastCreatedSkill.set(`${row.name} (#${row.id})`);
              return row;
            },
          },
        },
      }),
      f.select({
        path: 'folderId',
        label: 'Folder (tree)',
        width: FORM_WIDTHS.full,
        labelHelp: 'Nested children — Left/Right or chevron to expand',
        props: {
          valueKey: 'id',
          labelKeys: ['name'],
          placeholder: 'Pick a folder…',
          tree: {
            childrenKey: 'children',
            defaultExpanded: 'selected-ancestors',
          },
          items: FOLDER_TREE,
          emptyValue: 0,
        },
      }),
      f.select({
        path: 'assigneeId',
        label: 'Assignee (paged datasource)',
        width: FORM_WIDTHS.full,
        labelHelp: 'Scroll the panel to load more; search hits the loader',
        props: {
          valueKey: 'id',
          labelKeys: ['name', 'email'],
          placeholder: 'Search people…',
          searchable: true,
          panelMaxHeight: 220,
          columns: [
            { field: 'name', header: 'Name' },
            { field: 'email', header: 'Email' },
          ],
          datasource: {
            chunkSize: 20,
            debounceMs: 200,
            loader: async ({ startRow, endRow, searchTerm, abortSignal }) => {
              await delay(180, abortSignal);
              const q = (searchTerm ?? '').trim().toLowerCase();
              const filtered = q
                ? REMOTE_PEOPLE.filter(
                    (p) =>
                      p.name.toLowerCase().includes(q) ||
                      p.email.toLowerCase().includes(q),
                  )
                : REMOTE_PEOPLE;
              return filtered.slice(startRow, endRow);
            },
          },
          emptyValue: 0,
        },
      }),
    ],
  });

  readonly columns = toColumnDefs(this.formUi.elements());

  constructor() {
    this.reseed();
  }

  reseed(): void {
    seedSelection(this.formUi, {
      roleId: [{ id: 1, name: 'Admin', description: 'Full access', dept: 'Platform' }],
      tagIds: [{ id: 10, name: 'Angular' }],
      folderId: [{ id: 3, name: 'Form' }],
      countryCode: [{ code: 'NO', name: 'Norway', region: 'Nordics' }],
      skillIds: [{ id: 100, name: 'TypeScript' }],
      assigneeId: [{ id: 1, name: 'Person 1', email: 'person1@example.com' }],
    });
  }

  trySubmit(): void {
    this.formUi.markAllTouched(this.userForm);
    if (this.userForm().invalid()) {
      this.formUi.focusFirstInvalid(this.userForm);
      return;
    }
  }

  reset(): void {
    const empty: DemoUser = {
      username: '',
      age: 0,
      bio: '',
      active: false,
      roleId: 0,
      tagIds: [],
      folderId: 0,
      countryCode: '',
      skillIds: [],
      assigneeId: 0,
      firstName: '',
      lastName: '',
      secret: '',
      query: '',
      website: '',
      birthDate: '',
      meetingTime: '',
      appointment: '',
      plan: 'free',
      notifications: false,
      volume: 0,
      avatar: null,
      attachments: [],
      accentColor: '#000000',
      labels: [],
      estimateSeconds: null,
      customNote: '',
    };
    this.model.set(empty);
    this.userForm().reset(empty);
    this.formUi.resetUi();
    this.lastSearch.set('');
    this.lastCreatedSkill.set('');
  }
}

function fileMeta(file: File | null): { name: string; size: number; type: string } | null {
  if (!file) return null;
  return { name: file.name, size: file.size, type: file.type };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
