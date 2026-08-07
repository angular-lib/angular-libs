/**
 * Hard LOC gates for the binder + behavioral hosts.
 * See GOVERNANCE.md — do not grow past these without splitting work out of the binder.
 *
 * F3: template binds hosts/session directly; binder ~857.
 * Prefer ≤1000; ratchet = achieved + ~50 buffer.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTS_DIR = dirname(fileURLToPath(import.meta.url));
const BINDER_PATH = join(HOSTS_DIR, '../components/data-grid/data-grid.ts');

/** F3 achieved ~857; +50 buffer. Prefer ≤1000. */
const BINDER_LOC_MAX = 910;
const HOST_LOC_MAX = 500;
/** Viewport / EditSync / ColumnLayout own signals + presentation helpers. */
const FAT_HOST_LOC_MAX = 600;
const FAT_HOSTS = new Set([
  'viewport.host.ts',
  'edit-sync.host.ts',
  'column-layout.host.ts',
]);

function lineCount(path: string): number {
  const text = readFileSync(path, 'utf8');
  if (!text.length) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

describe('data-grid governance (GOVERNANCE.md)', () => {
  it(`data-grid.ts LOC <= ${BINDER_LOC_MAX}`, () => {
    const loc = lineCount(BINDER_PATH);
    expect(loc).toBeLessThanOrEqual(BINDER_LOC_MAX);
  });

  it(`each *.host.ts LOC <= ${HOST_LOC_MAX} (fat hosts <= ${FAT_HOST_LOC_MAX})`, () => {
    const hosts = readdirSync(HOSTS_DIR).filter((name) => name.endsWith('.host.ts'));
    expect(hosts.length).toBeGreaterThan(0);
    for (const name of hosts) {
      const loc = lineCount(join(HOSTS_DIR, name));
      const max = FAT_HOSTS.has(name) ? FAT_HOST_LOC_MAX : HOST_LOC_MAX;
      expect(loc, `${name} has ${loc} LOC`).toBeLessThanOrEqual(max);
    }
  });
});
