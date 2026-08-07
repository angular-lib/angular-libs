# Behavioral hosts — governance

Ownership map (session / host / plugin / binder): see
[ARCHITECTURE.md — Ownership](../../../ARCHITECTURE.md#ownership-session--host--plugin).

## Rule

**Do not add new feature methods on the `DataGrid` class.**

Put behavior on a focused host under `src/lib/hosts/` (or a plugin). `DataGrid` stays an
orchestrator: inputs/models/outputs, template binds hosts/session directly, and thin
cross-cutting coordinators (`onGridKeydown`, `onEscapeKey`). Runtime ownership lives on
`createDataGridSession` (`src/lib/session/create-session.ts`).

| New code is… | Put it on… |
| --- | --- |
| Core table behavior (always on) | a **host** |
| Opt-in / tree-shake / held adapter | a **plugin** |
| Cross-cutting runtime wiring / paint | **session** |
| Angular IO only | **binder** (no domain state) |

## Hard LOC targets

Enforced by [`governance.spec.ts`](./governance.spec.ts).

| Layer | Hard limit |
| --- | --- |
| `data-grid.ts` (binder) | ≤ **910** LOC (F3: achieved ~857; prefer ≤1000) |
| Each `*.host.ts` | ≤ **500** LOC |
| Fat hosts (`viewport`, `edit-sync`, `column-layout`) | ≤ **600** LOC |

Soft guidance: keep the binder ≤1000; split a host if it becomes a second binder.
New features go on a host method or plugin — never a binder-only API.

## Existing API façades

`composeDataGridApiHost` wires **behavioral hosts** (plus thin adapters for locale /
sidebar / clipboard paste / `openColumnMenu`) into the imperative API surface. Hosts own
the logic; the binder template calls hosts/session directly (F3).
