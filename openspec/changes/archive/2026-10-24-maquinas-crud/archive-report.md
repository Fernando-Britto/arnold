# Archive Report — maquinas-crud

| Field | Value |
|---|---|
| Change | `maquinas-crud` |
| Close date | 2026-10-24 |
| Artifact store | `openspec` |
| Branch | `feat/asignacion-dinamica` |
| Archived to | `openspec/changes/archive/2026-10-24-maquinas-crud/` |
| Promoted spec | `openspec/specs/maquinas-crud/spec.md` |

This report is the terminal record of the cycle. It describes the state of the change at close.
Historical artifacts (`proposal.md`, `explore.md`, `design.md`, `tasks.md`, `apply-progress.md`) were
moved unchanged and were not rewritten.

## Spec promotion

The change spec was a **full spec for a new capability**, not a delta spec. No canonical spec existed
at `openspec/specs/maquinas-crud/spec.md`, so no ADDED/MODIFIED/REMOVED composition was required. The
file was promoted by mechanical copy and verified byte-identical against the archived copy.

Promoted spec content: 12 requirements — Admin-Only Access; Input Validation and Normalization;
Assignable Estado Rules; Uniqueness of nombre + ubicacion; List, Filters and Search; Read by id;
Update; Delete and the `puedeEliminar` extension point; Audit Trail; `/maquinas` Screen; Seed Data;
Regression Guards.

## What shipped

**Domain** — `src/domains/maquina/maquina.ts`: pure validation and normalization (no Prisma import),
`nombre` and `ubicacion` 2–80 chars, `tipoEquipamiento` against `TipoEquipamiento`, assignable estado
rules (`DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA`; `OCUPADA` rejected as `ESTADO_NO_ASIGNABLE`),
and the `puedeEliminar(maquina, { ejerciciosAsociados })` extension point.

**Repository** — `src/domains/maquina/maquina-repositorio.ts`: duplicate pre-check using
`unaccent(lower(btrim(...)))`, translation of Prisma `P2002` to `DUPLICATE_NOMBRE_UBICACION`, and the
CRUD access layer.

**Migration** — `20261023120000_maquina_nombre_ubicacion_unique`: unique index on
`lower(btrim(nombre)), lower(btrim(ubicacion))`. Applied in Supabase; the index
`Maquina_nombre_ubicacion_key` was verified with `pg_indexes`.

**API** — `GET`/`POST /api/maquinas` and `GET`/`PUT`/`DELETE /api/maquinas/[id]`, with error mapping in
`src/lib/route-error-mapper.ts` (`DUPLICATE_NOMBRE_UBICACION` → 409, `ESTADO_NO_ASIGNABLE` → 400) and
client wrappers plus `CLAVES.maquinas`. DELETE returns 204 with no body and is blocked through
`puedeEliminar`.

**Permissions** — ADMINISTRADOR-only on both `/maquinas` and `/api/maquinas`. `role-gating.ts` carries
explicit entries; `authorization.ts` grants through the ADMIN `'*'` wildcard. Tests prove
`RECEPCIONISTA`, `INSTRUCTOR` and `SOCIO` are denied in both matrices.

**Audit** — `registrarOperacion` with `ALTA` (POST), `MODIFICACION` (PUT, including estado-only
changes) and `BAJA` (DELETE), each with `detalles: { maquinaId }`.

**UI** — `src/app/maquinas/page.tsx` modeled on `/membresias`, with `src/components/maquina-crud/`
(`maquina-form.tsx`, `maquina-list.tsx`, `estado-badge.tsx`), modal create/edit, `ConfirmDialog` delete,
page-owned search passed to the list, visible filter labels, and a "Máquinas" entry in the
`staff-rail.tsx` "Operación" zone.

**Seed** — `prisma/seed-data.ts` "Polea alta" changed from `OCUPADA` to `DISPONIBLE`; seed remains
idempotent (`createMany` only when `prisma.maquina.count() === 0`).

## Verified evidence at close

| Evidence | Result |
|---|---|
| `npm test` (jest/ts-jest) | 240 suites / 3382 tests passing |
| Integration suite (ephemeral Docker Postgres) | 26/26 passing |
| Migration `20261023120000_maquina_nombre_ubicacion_unique` | Applied in Supabase — `prisma migrate status` 19/19 |
| Unique index `Maquina_nombre_ubicacion_key` | Verified via `pg_indexes` |
| Manual smoke | 15-step flow green |
| Screen | Tested in the browser by Fernando |

`PROJECT-STATUS.md` corroborates these numbers in its close entry for T-053a–T-053n.

## Task accounting

Per the persisted `tasks.md` (the authoritative completion record, moved unchanged):

- T-053a through T-053m are marked ✅ (13 tasks).
- T-053n (documentation close: P-53, P-54, P-55, D-73) remains marked ⬜ in `tasks.md`. This archive
  phase does not repair historical checkboxes. The documentation deliverables that T-053n covers are
  present in the working tree: P-53, P-54, P-55, P-56 and D-73 recorded in `openspec/decisions.md`;
  the T-053a–T-053n execution rows appended to `openspec/sdd-tasks-tdd.md`; `PROJECT-STATUS.md`
  updated to the 19/19 migration state; and `odd/tasks/maquinas.md` updated.

Note for a future reader: the launch prompt for this archive phase stated that T-053a–T-053n were all
✅, while the persisted `tasks.md` shows T-053n ⬜. Both statements are recorded here rather than
resolved silently; the checkbox itself was left untouched.

## Deferred items (recorded, not fixed)

| ID | Item | Severity |
|---|---|---|
| P-53 | Home_Interno's "Estado de equipos" denominator counts `INACTIVA`, so deleting or retiring machines lowers the percentage. Revisit the denominator when touching Home_Interno; Home_Interno was not modified in this change. | Low |
| P-54 | `EstadoMaquina` remains duplicated as literal unions in `src/domains/home-interno/home-interno.ts` and `src/components/home-socio/tarjeta-detalle.tsx`. New code imports the Prisma type and adds no fourth definition; consolidation is deferred. | Low |
| P-55 | `POST`, `GET` (by id) and `PUT` include a `status` field inside the resource JSON (`{ ...maquina, status }`), matching Membresías. The HTTP status should be the single source; not fixed in this feature. | Low |
| P-56 | A concurrent update and delete can surface a Prisma `P2025` as a 500. It should be mapped to 404/409. Low-concurrency race; the happy path is covered by the smoke. | Low |

## Explicit scope exclusion — Etapa 2 NOT done

The `Ejercicio`↔`Maquina` associations and the expanded machine row are **Etapa 2** of the "asignación
dinámica de ejercicios" initiative. They are **out of scope for this change and were not
implemented**. This archive covers only Etapa 1: the admin-curated machine catalog. The
`puedeEliminar(maquina, { ejerciciosAsociados })` call site is the prepared extension point; it is
invoked with `0` today.

Also out of scope at close: session-driven `OCUPADA` (Etapa 4) and Home_Socio visibility (Etapa 5).

## SDD cycle

Spec promoted, change archived, source of truth updated at `openspec/specs/maquinas-crud/spec.md`.
Implementation: complete for Etapa 1. Verification: full suite, integration suite, real migration
state, index check, manual smoke and browser review all green. Unfinished at close: T-053n's checkbox
(it is unchecked in the persisted `tasks.md`; its documentation deliverables are present) and the four
deferred items above.
