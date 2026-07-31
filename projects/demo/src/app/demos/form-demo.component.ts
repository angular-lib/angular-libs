import { Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { form, min, required } from '@angular/forms/signals';
import {
  AlSignalForm,
  FORM_WIDTHS,
  createForm,
  formFactories,
  seedSelection,
  toColumnDefs,
} from '@angular-libs/form';

interface DemoUser {
  username: string;
  age: number;
  bio: string;
  active: boolean;
  roleId: number;
  tagIds: number[];
  firstName: string;
  lastName: string;
  secret: string;
  query: string;
  website: string;
}

const ROLE_ITEMS = [
  { id: 1, name: 'Admin', description: 'Full access' },
  { id: 2, name: 'Viewer', description: 'Read only' },
] as const;

const TAG_ITEMS = [
  { id: 10, name: 'Angular' },
  { id: 11, name: 'Signals' },
  { id: 12, name: 'TypeScript' },
] as const;

const f = formFactories<DemoUser>();

@Component({
  selector: 'app-form-demo',
  imports: [AlSignalForm, JsonPipe],
  template: `
    <h2>Signal Form</h2>
    <p>
      Host-owned <code>form()</code> + <code>formFactories</code> / <code>formRow</code> + chrome + S2 selects.
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

    <h3>Model</h3>
    <pre>{{ model() | json }}</pre>

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
    firstName: 'Ada',
    lastName: 'Lovelace',
    secret: 'analytical',
    query: '',
    website: 'example',
  });

  readonly lastSearch = signal('');

  readonly userForm = form(this.model, (p) => {
    required(p.username, { message: 'Required' });
    required(p.firstName, { message: 'Required' });
    min(p.age, 0, { message: 'Age must be ≥ 0' });
    min(p.roleId, 1, { message: 'Pick a role' });
  });

  readonly formUi = createForm<DemoUser>({
    elements: [
      f.row([
        f.text({ path: 'firstName', label: 'First name', width: FORM_WIDTHS.half, props: { clearable: true } }),
        f.text({ path: 'lastName', label: 'Last name', width: FORM_WIDTHS.half, props: { clearable: true } }),
      ]),
      f.lineBreak(),
      f.text({ path: 'username', label: 'Username', width: FORM_WIDTHS.half, props: { clearable: true } }),
      f.number({ path: 'age', label: 'Age', width: FORM_WIDTHS.half, props: { clearable: true } }),
      f.lineBreak(),
      f.text({
        path: 'website',
        label: 'Website',
        width: FORM_WIDTHS.full,
        labelHelp: 'Stored without scheme',
        props: { prefix: 'https://', suffix: '.com', clearable: true },
      }),
      f.password({ path: 'secret', label: 'Password', width: FORM_WIDTHS.half, props: { clearable: true } }),
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
      f.select({
        path: 'roleId',
        label: 'Role',
        width: FORM_WIDTHS.half,
        props: {
          valueKey: 'id',
          labelKeys: ['name', 'description'],
          placeholder: 'Pick a role…',
          items: [...ROLE_ITEMS],
          emptyValue: 0,
        },
      }),
      f.lineBreak(),
      f.select({
        path: 'tagIds',
        label: 'Tags',
        width: FORM_WIDTHS.full,
        props: {
          valueKey: 'id',
          labelKeys: ['name'],
          multiple: true,
          placeholder: 'Pick tags…',
          loadItems: () =>
            new Promise((resolve) => {
              setTimeout(() => resolve([...TAG_ITEMS]), 400);
            }),
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
      roleId: [{ id: 1, name: 'Admin', description: 'Full access' }],
      tagIds: [{ id: 10, name: 'Angular' }],
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
      firstName: '',
      lastName: '',
      secret: '',
      query: '',
      website: '',
    };
    this.model.set(empty);
    this.userForm().reset(empty);
    this.formUi.resetUi();
    this.lastSearch.set('');
  }
}
