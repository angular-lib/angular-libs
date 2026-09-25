/**
 * Package-layout gates (see ARCHITECTURE.md "Package layout").
 *
 * Every class / token is declared in the primary entry. `/plugin` and
 * `/internals` only re-export ɵ-prefixed primary symbols via the package
 * specifier, so dist never holds two declarations of e.g. `DataGridApi`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as primary from '@angular-libs/data-grid';
import * as internals from '@angular-libs/data-grid/internals';
import * as plugin from '@angular-libs/data-grid/plugin';
import * as internalsBacking from './internals-api';
import * as pluginBacking from './plugin-api';

const LIB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function moduleSpecifiers(source: string): string[] {
  return [...source.matchAll(/\bfrom\s+'([^']+)'/g)].map((m) => m[1]);
}

describe('package layout', () => {
  it('ɵ backing modules only export ɵ-prefixed names', () => {
    for (const mod of [pluginBacking, internalsBacking]) {
      for (const key of Object.keys(mod)) expect(key.startsWith('ɵ'), key).toBe(true);
    }
  });

  it('secondary entries re-export the primary declaration (no duplicates)', () => {
    const primaryExports = primary as Record<string, unknown>;
    for (const mod of [plugin, internals] as Record<string, unknown>[]) {
      for (const [key, value] of Object.entries(mod)) {
        const source = `ɵ${key}` in primaryExports ? primaryExports[`ɵ${key}`] : primaryExports[key];
        expect(value, key).toBe(source);
      }
    }
  });

  it('every ɵ primary export is surfaced by a secondary entry', () => {
    const surfaced = new Set([...Object.keys(plugin), ...Object.keys(internals)]);
    const orphans = Object.keys(primary)
      .filter((key) => key.startsWith('ɵ'))
      .filter((key) => !surfaced.has(key.slice(1)));
    expect(orphans).toEqual([]);
  });

  it('secondary entry files import core only via the package specifier', () => {
    for (const entry of ['plugin/src', 'internals/src']) {
      for (const file of tsFiles(join(LIB_ROOT, entry))) {
        const specs = moduleSpecifiers(readFileSync(file, 'utf8'));
        expect(specs, relative(LIB_ROOT, file)).toEqual(
          specs.map(() => '@angular-libs/data-grid'),
        );
      }
    }
  });

  it('first-party plugins never reach into core by relative path or /internals', () => {
    for (const file of tsFiles(join(LIB_ROOT, 'plugins/src'))) {
      if (file.endsWith('.spec.ts')) continue;
      const rel = relative(LIB_ROOT, file);
      for (const spec of moduleSpecifiers(readFileSync(file, 'utf8'))) {
        expect(spec, rel).not.toBe('@angular-libs/data-grid/internals');
        if (spec.startsWith('.')) {
          expect(relative(LIB_ROOT, join(dirname(file), spec)).startsWith('plugins/src'), `${rel} -> ${spec}`).toBe(true);
        }
      }
    }
  });
});
