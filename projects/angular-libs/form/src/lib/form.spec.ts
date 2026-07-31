import { describe, expect, it, vi } from 'vitest';
import {
  formCheckbox,
  formElementGroup,
  formFactories,
  formLineBreak,
  formNumber,
  formPassword,
  formRow,
  formSearch,
  formSelect,
  formSpace,
  formText,
  formTextarea,
} from './factories/index';
import { clearSelection, createForm, seedSelection } from './create-form';
import { toColumnDefs } from './utils/to-column-defs';
import { resolveFormField } from './utils/resolve-field';
import {
  clearFormValidationWarningsForTests,
  warnInvalidFormSetup,
} from './utils/validate-elements';
import {
  normalizeResponsiveWidth,
  resolveFlexStyle,
  resolveWidthForContainer,
  widthToCssVars,
} from './utils/layout';
import { FORM_WIDTHS } from './constants/form-widths';
import { FormFieldRegistry, defaultFormFieldRegistry } from './registry/form-field-registry';
import { registerBuiltInFormFields } from './registry/register-built-ins';
import type { FieldTree } from '@angular/forms/signals';

registerBuiltInFormFields();

interface User {
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
}

describe('factories', () => {
  it('sets element types', () => {
    expect(formText<User>({ path: 'username', label: 'U' }).type).toBe('text');
    expect(formNumber<User>({ path: 'age' }).type).toBe('number');
    expect(formTextarea<User>({ path: 'bio' }).type).toBe('textarea');
    expect(formCheckbox<User>({ path: 'active' }).type).toBe('checkbox');
    expect(formPassword<User>({ path: 'secret' }).type).toBe('password');
    expect(formSearch<User>({ path: 'query' }).type).toBe('search');
    expect(
      formSelect<User>({
        path: 'roleId',
        props: { valueKey: 'id', labelKeys: ['name'] },
      }).type,
    ).toBe('select');
    expect(formLineBreak().type).toBe('line-break');
    expect(formSpace({ width: FORM_WIDTHS.half }).type).toBe('space');
    expect(
      formElementGroup({
        props: { elements: [formText({ path: 'username' as any })] },
      }).type,
    ).toBe('group');
  });

  it('formRow wraps children in a full-width row group', () => {
    const row = formRow<User>([
      formText<User>({ path: 'firstName', width: FORM_WIDTHS.half }),
      formText<User>({ path: 'lastName', width: FORM_WIDTHS.half }),
    ]);
    expect(row.type).toBe('group');
    expect(row.width).toBe(FORM_WIDTHS.full);
    expect(row.props.direction).toBe('row');
    expect(row.props.elements).toHaveLength(2);
  });

  it('formFactories binds paths to the model type', () => {
    const f = formFactories<User>();
    const text = f.text({ path: 'username', label: 'U' });
    const row = f.row([f.text({ path: 'firstName' }), f.text({ path: 'lastName' })]);
    expect(text.path).toBe('username');
    expect(row.type).toBe('group');
    expect(row.props.elements).toHaveLength(2);
  });
});

describe('warnInvalidFormSetup', () => {
  it('warns once for unknown types and missing paths in dev', () => {
    clearFormValidationWarningsForTests();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = { username: {} } as unknown as FieldTree<User>;
    const elements = [
      { type: 'datepicker' as const, path: 'username' },
      formText<User>({ path: 'missing' as keyof User & string }),
    ];
    warnInvalidFormSetup(tree as never, elements as never, defaultFormFieldRegistry);
    warnInvalidFormSetup(tree as never, elements as never, defaultFormFieldRegistry);
    expect(warn).toHaveBeenCalled();
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('datepicker'))).toBe(true);
    expect(messages.some((m) => m.includes('missing'))).toBe(true);
    // second pass should not add duplicate keys
    expect(warn.mock.calls.length).toBeLessThanOrEqual(4);
    warn.mockRestore();
  });
});

describe('layout helpers', () => {
  it('normalizes string and map widths', () => {
    expect(normalizeResponsiveWidth('50%')).toEqual({ xs: '50%' });
    expect(normalizeResponsiveWidth(FORM_WIDTHS.half)?.xs).toContain('calc');
    expect(FORM_WIDTHS.half).not.toContain(',');
  });

  it('maps widths to CSS vars for container queries', () => {
    expect(widthToCssVars(FORM_WIDTHS.half).xs).toContain('calc');
    const responsive = widthToCssVars(FORM_WIDTHS.halfResponsive);
    expect(responsive.xs).toBe('100%');
    expect(responsive.sm).toContain('calc');
    expect(responsive.md).toBeNull();
    expect(responsive.lg).toBeNull();
  });

  it('resolves flex defaults from width', () => {
    expect(resolveFlexStyle({ type: 'text', width: '50%' })).toBe('0 0 auto');
    expect(resolveFlexStyle({ type: 'text' })).toBe('1');
    expect(resolveFlexStyle({ type: 'text', width: '50%', flex: 1 })).toBe('1');
    expect(resolveFlexStyle({ type: 'line-break' })).toBeNull();
  });

  it('resolves container widths with mobile stacking for sm-only maps', () => {
    expect(resolveWidthForContainer(FORM_WIDTHS.half, 400)).toContain('calc');
    expect(resolveWidthForContainer(FORM_WIDTHS.halfResponsive, 400)).toBe('100%');
    expect(resolveWidthForContainer(FORM_WIDTHS.halfResponsive, 600)).toContain('calc');
    expect(resolveWidthForContainer('50%', 400)).toBe('50%');
  });
});

describe('createForm + selectionDisplay + submit helpers', () => {
  it('seeds and clears selection display', () => {
    const ctrl = createForm<User>({
      elements: [formSelect<User>({ path: 'roleId', props: { valueKey: 'id', labelKeys: ['name'] } })],
    });
    seedSelection(ctrl, {
      roleId: [{ id: 1, name: 'Admin' }],
    });
    expect(ctrl.selectionFor('roleId')()).toEqual([{ id: 1, name: 'Admin' }]);
    clearSelection(ctrl, ['roleId']);
    expect(ctrl.selectionFor('roleId')()).toEqual([]);
  });

  it('tracks submitAttempted and resets UI', () => {
    const ctrl = createForm<User>({
      elements: [formText<User>({ path: 'username' })],
    });
    expect(ctrl.submitAttempted()).toBe(false);
    ctrl.markSubmitAttempted();
    expect(ctrl.submitAttempted()).toBe(true);
    seedSelection(ctrl, { roleId: [{ id: 1 }] } as any);
    ctrl.resetUi();
    expect(ctrl.submitAttempted()).toBe(false);
    expect(ctrl.selectionFor('roleId')()).toEqual([]);
  });
});

describe('toColumnDefs', () => {
  it('maps elements to column-shaped defs and flattens groups', () => {
    const cols = toColumnDefs<User>([
      formElementGroup({
        props: {
          elements: [
            formText<User>({ path: 'firstName', label: 'First' }),
            formText<User>({ path: 'lastName', label: 'Last' }),
          ],
        },
      }),
      formLineBreak(),
      formText<User>({ path: 'username', label: 'Username' }),
      formNumber<User>({ path: 'age', label: 'Age' }),
      formPassword<User>({ path: 'secret', label: 'Password' }),
      formSearch<User>({ path: 'query', label: 'Search' }),
      formCheckbox<User>({ path: 'active', label: 'Active' }),
      formSelect<User>({ path: 'roleId', label: 'Role', props: { valueKey: 'id', labelKeys: ['name'] } }),
    ]);
    expect(cols).toEqual([
      { field: 'firstName', header: 'First', type: 'text', editable: true },
      { field: 'lastName', header: 'Last', type: 'text', editable: true },
      { field: 'username', header: 'Username', type: 'text', editable: true },
      { field: 'age', header: 'Age', type: 'number', editable: true },
      { field: 'secret', header: 'Password', type: 'text', editable: true },
      { field: 'query', header: 'Search', type: 'text', editable: true },
      { field: 'active', header: 'Active', type: 'boolean', editable: true },
      { field: 'roleId', header: 'Role', type: 'text', editable: true },
    ]);
  });
});

describe('FormFieldRegistry', () => {
  it('resolves built-in select and layout types', () => {
    expect(defaultFormFieldRegistry.resolve('select')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('text')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('password')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('search')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('group')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('line-break')).toBeTruthy();
    expect(defaultFormFieldRegistry.resolve('space')).toBeTruthy();
  });

  it('child registry overrides parent', () => {
    class Fake {}
    const child = new FormFieldRegistry(defaultFormFieldRegistry);
    child.register('select', Fake);
    expect(child.resolve('select')).toBe(Fake);
    expect(child.resolve('text')).toBe(defaultFormFieldRegistry.resolve('text'));
  });
});

describe('resolveFormField', () => {
  it('resolves top-level paths on a FieldTree-shaped object', () => {
    const tree = { username: {}, age: {} } as unknown as FieldTree<User>;
    expect(resolveFormField(tree, 'username')).toBeTruthy();
    expect(resolveFormField(tree, 'missing')).toBeNull();
  });
});
