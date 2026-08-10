# Offline-first SQLite (deferred)

Status: **not shipped**. Build only when a real app needs offline-first with relational local data + socket sync. Until then, prefer `indexedDBPlugin` / `persistPlugin`.

## Why defer

- IndexedDB covers most store persistence needs today.
- SQLite WASM adds OPFS/COOP/COEP, worker, and bundle cost.
- Sync (LWW, conflicts, server clocks) is product work, not just a plugin.

## Target architecture

```text
UI mutation
  → sqlitePlugin.write
  → SQLite (OPFS)          ← source of truth
  → project → ALStore      ← reactive UI
  → socket.send(op)        ← outbox while offline

socket.subscribe(op)
  → sqlite.apply (idempotent opId)
  → project → ALStore
```

- **Store core**: no SQLite/socket imports. Optional secondary entry only.
- **Socket**: existing `@angular-libs/socket` (outbox + multiplex) as transport.
- **Glue**: `@angular-libs/store/sqlite` peers on `@sqlite.org/sqlite-wasm` (+ optional socket).

## Packaging

- Secondary entry: `@angular-libs/store/sqlite` (same pattern as `rxjs-interop`)
- Optional peers: `@sqlite.org/sqlite-wasm`, `@angular-libs/socket`
- Core stays lightweight; `onDestroy` on `ALStorePlugin` is already available for cleanup

## MVP API (when building)

```ts
todosDb = this.registerPlugin(
  sqlitePlugin('todos', {
    table: 'todos',
    db: sharedDb, // one connection per app
    sync: {
      send: (op) => socket.send(op),
      subscribe: (handler) => socket.subscribe(handler),
      mapIncoming: (msg) => /* SyncOp | null */,
      isConnected: socket.isConnected,
      status: socket.status,
    },
  }),
);

// Mutate via plugin API only — not store.set on synced keys
await todosDb.upsert(todo);
```

Also ship:

- `openSqliteDb()` / thin `SqliteDb` façade (mockable in tests)
- `createSqliteOutboxStorage(db)` → `WebSocketOutboxStorage`
- Signals: `isReady`, `syncStatus`, `all`
- CRUD: `upsert` / `upsertMany` / `remove` / `setAll`
- Idempotent apply via `opId` + `applied_ops` table
- Conflict v1: last-write-wins on `updatedAt` (document client-clock limits)

## Implementation checklist

1. Secondary entry under `projects/angular-libs/store/sqlite/`
2. `SqliteDb` interface + wasm adapter + memory mock for tests
3. `sqlitePlugin` (write → project → optional sync.emit)
4. `createSqliteOutboxStorage`
5. Unit tests (CRUD, idempotent remote apply, outbox round-trip)
6. Demo: offline CRUD + mock/real socket; document COOP/COEP for OPFS
7. README: mutate via plugin, no dual-persist with IndexedDB, OPFS headers

## Runtime constraints to document

- OPFS persistence: worker + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`
- Fail-soft without OPFS (memory / warning)
- SSR: browser-only; no-op or skip open on server

## Explicit non-goals (first ship)

- CRDT / conflict UI
- Schema migration framework
- Multi-tab concurrent SQLite writers
- Hard dependency on socket inside store core
- Separate npm package (keep secondary entry)

## Later improvements (after MVP)

- Server timestamps / version vectors instead of client LWW
- All DB I/O in a worker; main thread only gets projections
- Multiplex topics per aggregate in app wiring (not inside sqlite plugin)
- Dev warning if synced keys are mutated via `store.set`
- Split `createSqliteOutboxStorage` if socket types leak too much

## Trigger to build

Start when at least one of:

- A consuming app needs offline writes with queryable local relational data
- IndexedDB key-value becomes a bottleneck for the same sync story
- You are ready to own OPFS deploy headers and a real sync protocol with the backend
