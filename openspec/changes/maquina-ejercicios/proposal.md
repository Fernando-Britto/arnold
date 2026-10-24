# Proposal: maquina-ejercicios (Etapa 2 — asignación dinámica de ejercicios)

## Intent

Associate exercises with gym machines through an explicit M2M relation, managed from the machine's detail view in `/maquinas`. This is Etapa 2 of the "asignación dinámica de ejercicios" initiative, building on the catalog established by Etapa 1 (`maquinas-crud`, D-73).

Etapa 1 left `Maquina` as a standalone table and `puedeEliminar(maquina, { ejerciciosAsociados })` wired to a hardcoded `0`. Etapa 2 closes that loop: introduces the `EjercicioMaquina` join model, replaces the hardcoded count with the real one, surfaces the association in the machine's expanded row, and adds the accessible modal to assign/unassign exercises from the machine.

Etapa 3 (wait/suggestion engine), Etapa 4–5 (session-driven `OCUPADA`, Home_Socio visibility, `/configuracion` runtime parameters) are explicitly out of scope.

## Scope

### In Scope

1. **Explicit join model** `EjercicioMaquina` in `prisma/schema.prisma`, copying the `EjercicioEnRutina` pattern. Composite unique key `@@unique([maquinaId, ejercicioId])`, secondary indexes on each FK, `onDelete: Cascade` on both sides (see Approach for the rationale). Relation fields added to both `Ejercicio` and `Maquina`.
2. **Hand-written migration** `prisma/migrations/<ts>_ejercicio_maquina/migration.sql` containing only additive DDL (`CREATE TABLE "EjercicioMaquina"` + 3 indexes). No `prisma migrate dev` — this protects the orphan `Maquina_nombre_ubicacion_key` expression index from being dropped. Verified against the ephemeral Docker Postgres (`npm run test:integration`). Pre-migration check scans the new SQL for any `DROP`, `ALTER`, or `Maquina_nombre_ubicacion_key` mention.
3. **Domain validation** in `src/domains/maquina/` (pure, no Prisma): all `ejercicioIds` must exist, no duplicates in the input, `ejercicioIds.length <= MAX_EJERCIOS_POR_MAQUINA = 50`, empty array `[]` is valid (means "remove all associations"). Pure function `asignarEjercicios` returns the validated list.
4. **REST API** at `src/app/api/maquinas/[id]/ejercicios/route.ts`:
   - `GET` — returns associated exercises for a machine (name, muscle group, id), 404 `NOT_FOUND` when the machine is missing.
   - `PUT` — full replacement: receives `{ ejercicioIds: string[] }`, validates, atomically replaces the association set, audits `MODIFICACION` (best-effort). Returns the new association list.
   - ADMINISTRADOR only (aligned with the existing `/api/maquinas` restriction). Errors via `route-error-mapper`.
5. **Wire real count into `handleMaquinaDelete`** (`src/api/maquinas.ts:133`): replace `ejerciciosAsociados: 0` with the real count from the repository, so `puedeEliminar` returns `{ permitido: false, motivo: "N ejercicios usan esta máquina" }` and the handler returns 409 `DELETE_BLOCKED_EJERCICIOS` (already mapped in `route-error-mapper.ts`).
6. **Exercise deletion**: the new relation **must not** introduce a new `DELETE_BLOCKED_ASSIGNED` path. The existing `Restrict` behavior on `EjercicioEnRutina` and `RegistroDeProgreso` is preserved. `EjercicioMaquina.ejercicio → onDelete: Cascade` cleans up M2M rows automatically when an exercise is legitimately deleted.
7. **Exercise search pagination** for the modal: extend `GET /api/ejercicios` with optional `limit` (default 20, max 50) and `offset` (default 0) params. The existing accent-insensitive `unaccent` search is preserved. No new endpoint.
8. **UI expansion on `/maquinas`**: restore `disclosure` on `TableHeader`/`TableRow`, add `TableDetailRow` listing the associated exercises (name + muscle group) with an "Asignar ejercicios" button. Accessible modal (`useModalA11y`): debounced search (300ms), multi-select checkboxes, paginated list from `GET /api/ejercicios`, save via `PUT /api/maquinas/[id]/ejercicios`. New components under `src/components/maquina-crud/` (`ejercicio-asignacion-modal.tsx`, `maquina-expanded-row.tsx`).

### Out of Scope

- Wait/suggestion engine (Etapa 3).
- Session-driven `OCUPADA`, check-in integration, Home_Socio machine visibility (Etapas 4–5).
- Runtime parameters in `/configuracion` (e.g. max exercises per machine).
- Assignment from the exercise detail side (only managed from the machine).
- Exercise list showing "N máquinas lo usan" (`enMaquinas` count).
- Refactoring the `EstadoMaquina` type drift (P-54), the body `status` field (P-55), or the DELETE P2025 race (P-56).
- Touching Home_Interno's "Estado de Equipos" card (P-53).

## Capabilities

> Contract between this proposal and the spec phase.

### New Capabilities

- `maquina-ejercicio-assignment`: M2M association between `Ejercicio` and `Maquina`, managed from the machine's detail view, with its own API endpoints (`GET` + `PUT /api/maquinas/[id]/ejercicios`), domain validation (max 50, existence check, dedup), audit trail and accessible assignment modal.

### Modified Capabilities

- `maquinas-crud`: `DELETE /api/maquinas/[id]` now queries the real `ejerciciosAsociados` count (replacing the hardcoded `0`) and returns 409 `DELETE_BLOCKED_EJERCICIOS` when the machine has exercises. Spec AC-010/AC-011 and the existing `puedeEliminar` unit test are now wired into the real handler. The existing `puedeEliminar` pure function is unchanged — only its caller changes.
- `ejercicios-crud`: `GET /api/ejercicios` gains optional `limit`/`offset` query params for pagination. Backwards-compatible (default 20 / 0). Existing accent-insensitive search and `muscleGroup` filter preserved.

## Stakeholder Impact

| Stakeholder | Impact |
|---|---|
| Administrador | Gains the ability to associate exercises with machines from `/maquinas` via the expanded row and assignment modal. Can no longer delete a machine that has exercises (409 `DELETE_BLOCKED_EJERCICIOS`). |
| Recepcionista / Instructor / Socio | No visible change. Access already denied to `/maquinas` and `/api/maquinas` (D-73). The new `/api/maquinas/[id]/ejercicios` endpoint inherits the same ADMINISTRADOR-only restriction. |
| Ejercicio CRUD (`/ejercicios`) | No UI change. The `GET /api/ejercicios` endpoint gains `limit`/`offset` but the existing page does not pass those params, so behavior is unchanged for the screen. The exercise DELETE path continues to block via `DELETE_BLOCKED_ASSIGNED` on `EjercicioEnRutina`/`RegistroDeProgreso`; the new M2M rows are cleaned up silently via `onDelete: Cascade`. |
| Seed / existing data | No change. The new table starts empty. Existing machines and exercises keep their current rows. |

## Approach

1. **Schema — explicit join model, `onDelete: Cascade` on both sides**. Follows `EjercicioEnRutina`'s shape but with a deliberate asymmetry in `onDelete` rationale:
   - `maquina → EjercicioMaquina`: `Cascade` because the handler-level `puedeEliminar` already blocks deletion upstream (D-73, spec AC-011). If the handler allows the delete (count=0), there are no rows to cascade. A `Restrict` here would only fire on a handler bug and is not worth the inconsistency with the established `Rutina → EjercicioEnRutina` pattern.
   - `ejercicio → EjercicioMaquina`: `Cascade` is **mandatory** for the feature's contract. Exercise deletion is already gated by `Restrict` on `EjercicioEnRutina` and `RegistroDeProgreso` (P2003 → `DELETE_BLOCKED_ASSIGNED`). If deletion proceeds, M2M rows must disappear. A `Restrict` here would incorrectly block exercise deletion whenever a machine association exists, contradicting the requirement.
2. **Migration — hand-written, additive only**. Filename `prisma/migrations/<ts>_ejercicio_maquina/migration.sql`. Contents: `CREATE TABLE "EjercicioMaquina"` + `CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key"` + two secondary indexes. Never runs `prisma migrate dev` — the orphan expression index `Maquina_nombre_ubicacion_key` (from `20261023120000_maquina_nombre_ubicacion_unique`) cannot be represented in `schema.prisma` (Prisma does not support expression indexes); `migrate dev` would detect it and either drop it or propose a reset.
3. **Layering (ARQ-1)**:
   - Pure domain in `src/domains/maquina/`: `validarAsignacionEjercicios(input, existentes)`, `MAX_EJERCIOS_POR_MAQUINA = 50`, types. No Prisma import.
   - Repository in `src/domains/maquina/maquina-repositorio.ts`: new methods `contarEjerciciosAsociados(maquinaId)`, `getEjerciciosAsociados(maquinaId)`, `reemplazarEjerciciosAsociados(maquinaId, ejercicioIds)` (the last two inside a single `prisma.$transaction` that `deleteMany`s and `createMany`s atomically).
   - Handlers in `src/api/maquinas.ts`: `handleMaquinaEjerciciosGet(id)`, `handleMaquinaEjerciciosPut(id, ejercicioIds, actorId)`. Update `handleMaquinaDelete` to query real count.
   - Routes in `src/app/api/maquinas/[id]/ejercicios/route.ts` (new file), `params` awaited (Next 16.2, FX-06).
4. **Permissions**: new path `/api/maquinas/[id]/ejercicios` falls under the existing `"/api/maquinas": [ADMINISTRADOR]` prefix in both `role-gating.ts` and the `authorization.ts` wildcard. **Explicit test** in `matrix-consistency.test.ts` proving the prefix match covers the nested path.
5. **Audit**: PUT uses `registrarOperacion({ tipoOperacion: "MODIFICACION", responsableId, detalles: { maquinaId, ejerciciosAsignados: n } })`. Best-effort — audit failure never alters the HTTP response.
6. **Error mapping**: `DELETE_BLOCKED_EJERCICIOS` is already mapped in `route-error-mapper.ts:107-113` (409, Spanish message "No se puede eliminar: N ejercicios usan esta máquina"). Add `VALIDATION_MAX_EJERCICIOS` (400) for the >50 case; reuse `NOT_FOUND` for missing machine, `VALIDATION_ERROR` for duplicate/unknown ids.
7. **Exercise search**: extend `EjercicioRepository.getAll` to accept `limit`/`offset`, pass through to both the `findMany` (no-search) path and the `$queryRaw` (search) path. Defaults keep the existing behavior.
8. **UI**:
   - `src/components/maquina-crud/maquina-list.tsx`: add `disclosure` prop to `TableHeader` and `TableRow`, wrap each row in a `React.Fragment` with a `TableDetailRow` containing `MaquinaExpandedRow`. Pattern copied from `src/components/ejercicio-crud/ejercicio-list.tsx:150-180`.
   - `src/components/maquina-crud/maquina-expanded-row.tsx` (new): list of associated exercises (name + muscle group badges) + "Asignar ejercicios" button. Empty state: "Sin ejercicios asignados".
   - `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` (new): `useModalA11y`, debounced search input (300ms), multi-select checkbox list with paginated results (50 per page), "Seleccionar todo visible" checkbox scoped to the current page, save/cancel buttons. Saves via `PUT /api/maquinas/[id]/ejercicios`.
   - Client fetchers in `src/api/maquinas.ts` (alongside `fetchMaquinasList`).
9. **Strict TDD**: red → green at every layer. Domain tests cover validation; handler tests cover orchestration; route tests cover HTTP + params; repository tests use the ephemeral Docker Postgres (`npm run test:integration`) to verify the new FK cascade, the unique constraint and the transaction replace. Component tests via Testing Library.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` | Modified | Add `EjercicioMaquina` model + relation fields on `Ejercicio` and `Maquina`. |
| `prisma/migrations/<ts>_ejercicio_maquina/migration.sql` | New | Hand-written: `CREATE TABLE "EjercicioMaquina"` + 3 indexes. Additive only. |
| `tests/integration/ejercicio-maquina.integration.test.ts` | New | Integration tests against Docker Postgres: FK cascade, unique constraint, transaction replace. |
| `src/domains/maquina/maquina.ts` | Modified | Add `validarAsignacionEjercicios`, `MAX_EJERCIOS_POR_MAQUINA = 50`, types. |
| `src/domains/maquina/maquina.test.ts` | Modified | Cover new pure functions. |
| `src/domains/maquina/maquina-repositorio.ts` | Modified | Add `contarEjerciciosAsociados`, `getEjerciciosAsociados`, `reemplazarEjerciciosAsociados`. |
| `src/domains/maquina/maquina-repositorio.test.ts` | Modified | Cover new methods (Prisma mocked). |
| `src/domains/ejercicio/ejercicio-repositorio.ts` | Modified | Add `limit`/`offset` to `getAll`. |
| `src/domains/ejercicio/ejercicio-repositorio.test.ts` | Modified | Cover pagination. |
| `src/api/maquinas.ts` | Modified | Add `handleMaquinaEjerciciosGet`, `handleMaquinaEjerciciosPut`, client fetchers. Wire real count into `handleMaquinaDelete`. |
| `src/api/maquinas.test.ts` | Modified | Cover new handlers + real-count delete path. |
| `src/app/api/maquinas/[id]/ejercicios/route.ts` | New | `GET` + `PUT`. `params` awaited. |
| `src/app/api/maquinas/[id]/ejercicios/route.test.ts` | New | Route tests. |
| `src/app/api/maquinas/[id]/route.delete.test.ts` | Modified | Update `handleMaquinaDelete` test to expect real count query. |
| `src/app/api/ejercicios/route.ts` | Modified | Parse `limit`/`offset` query params. |
| `src/app/api/ejercicios/route.test.ts` | Modified | Cover pagination. |
| `src/middleware/role-gating.ts` | Unchanged | Existing `"/api/maquinas"` prefix covers the nested path. |
| `src/middleware/matrix-consistency.test.ts` | Modified | Add explicit assertion that `/api/maquinas/1/ejercicios` is denied for non-ADMIN roles via prefix match. |
| `src/lib/route-error-mapper.ts` | Modified | Add `VALIDATION_MAX_EJERCICIOS → 400`. |
| `src/lib/route-error-mapper.test.ts` | Modified | Cover new code. |
| `src/components/maquina-crud/maquina-list.tsx` | Modified | Add `disclosure` + `TableDetailRow` expansion. |
| `src/components/maquina-crud/maquina-list.test.tsx` | Modified | Replace the "no disclosure indicator" assertion with expansion tests. |
| `src/components/maquina-crud/maquina-expanded-row.tsx` | New | Expanded row showing associated exercises + "Asignar ejercicios" button. |
| `src/components/maquina-crud/maquina-expanded-row.test.tsx` | New | Component tests. |
| `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` | New | Accessible modal with debounced search + multi-select. |
| `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` | New | Component tests. |
| `openspec/specs/maquina-ejercicios/spec.md` | New | Spec covering this change's requirements and acceptance criteria. |
| `openspec/specs/maquinas-crud/spec.md` | Modified | Update AC-010/AC-011 and the "Delete and the `puedeEliminar` extension point" requirement to reflect that the count is now real (Etapa 2 fulfilled). |
| `openspec/specs/ejercicios-crud/spec.md` | Modified | Document `limit`/`offset` on `GET /api/ejercicios`. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **`prisma migrate dev` accidentally drops `Maquina_nombre_ubicacion_key`** (the orphan expression index from `20261023120000`). | Medium (human error) | **Rule**: never run `prisma migrate dev`. Document in the design. Pre-migration check: the new migration SQL must not contain `DROP`, `ALTER`, or the string `Maquina_nombre_ubicacion_key`. The CI script could enforce this; at minimum the PR description must call it out. |
| **`onDelete: Cascade` on exercise side silently removes M2M rows** if a future bug bypasses the handler-level `DELETE_BLOCKED_ASSIGNED` check on exercise deletion. | Low | Same tradeoff already accepted for `Rutina → EjercicioEnRutina`. The `Restrict` on `EjercicioEnRutina` and `RegistroDeProgreso` remains the real gate; a bug that bypasses them would also bypass the M2M check. The cascade only affects the new table. |
| **Race: `puedeEliminar` sees count=0, another admin adds an exercise, DELETE proceeds** leaving orphan cascade cleanup. | Low | Same race already exists for exercise deletion via `EjercicioEnRutina`. Acceptable consistency model. The cascade keeps data clean; no integrity violation. |
| **Concurrent PUTs on the same machine**: between the "all ids exist" validation and the `deleteMany + createMany`, another PUT could delete one of the ids. | Low | `reemplazarEjerciciosAsociados` runs inside a single `prisma.$transaction`; the FK `onDelete: Cascade` on the exercise side would silently remove rows but not fail the write. Document in the spec that PUT is last-writer-wins; a stricter optimistic lock is out of scope. |
| **Exercise modal loads all 1,324 rows** if the search endpoint is called without pagination. | Medium | Modal always calls with `limit=50`. Empty search → first 50 exercises. User refines via search. No "load all" path in the client. |
| **`unaccent` search + pagination interaction**: the raw-SQL path uses `ILIKE unaccent(%term%)`; adding `LIMIT/OFFSET` to the raw SQL must keep the term parameterized (no interpolation). | Medium | The repository test suite must cover the search+pagination combination. Use `$queryRaw` parameterization as today. |
| **ESLint pre-existing failure on `dev`**: `react-hooks/purity` error at `src/app/home-socio/page.tsx:129` (`Date.now()` during render), pre-existing from `f4d1ac2`. Not fixed in this change. | Certain | Record as **P-57** in `openspec/decisions.md`. The change must not introduce *new* lint errors; this pre-existing one is out of scope. |

## Rollback Plan

The migration is **additive only** (one `CREATE TABLE` + three `CREATE INDEX` statements). It does not touch `Maquina` or `Ejercicio` tables, and does not drop `Maquina_nombre_ubicacion_key`.

**If the PR needs reverting**:
1. `git revert` the PR merge commit.
2. If the migration applied to a real DB, run the manual rollback SQL: `DROP TABLE IF EXISTS "EjercicioMaquina";`. The migration file should include this as a commented block at the top for the human applying it.
3. No data loss in `Maquina` or `Ejercicio` — the new table holds only the M2M links.
4. Revert the UI changes; the `/maquinas` screen returns to the Etapa 1 state.

**If only the UI PR needs reverting**: the API and schema remain usable from curl/other clients; no DB change to roll back on the UI side.

**Full revert**: `git reset --hard` to the commit before the change. The migration is reversible via `DROP TABLE "EjercicioMaquina"`.

## Dependencies

- **Ephemeral Docker Postgres** (`npm run test:integration`): required to verify the hand-written migration, the FK cascade behavior, the unique constraint and the transaction replace against a real DB. Already in place (D-53).
- **Existing `Maquina_nombre_ubicacion_key` expression index** (D-70, D-73): the new migration must not touch it. The rule "never run `prisma migrate dev`" remains in force.
- **Existing `unaccent` search path** in `EjercicioRepository.getAll`: the pagination extension reuses this path. No new search mechanism.
- **Existing `useModalA11y` hook** (`src/hooks/use-modal-a11y.ts`), `TableHeader/TableRow/TableDetailRow` with `disclosure` (`src/components/ui/table.tsx`), `CrudPageLayout` — reused, not rebuilt.
- **Existing `DELETE_BLOCKED_EJERCICIOS` error code** in `route-error-mapper.ts:107-113` — already mapped, no change needed.

## Success Criteria

- [ ] `EjercicioMaquina` model exists in `schema.prisma` with composite unique `@@unique([maquinaId, ejercicioId])` and `onDelete: Cascade` on both sides.
- [ ] Hand-written migration applies cleanly against the ephemeral Docker Postgres (`npm run test:integration` green).
- [ ] Pre-migration check: the migration SQL contains 0 occurrences of `DROP`, `ALTER`, or `Maquina_nombre_ubicacion_key`.
- [ ] `GET /api/maquinas/[id]/ejercicios` returns the associated exercises (name + muscle group), 404 when the machine is missing.
- [ ] `PUT /api/maquinas/[id]/ejercicios` validates (existence, uniqueness, max 50), atomically replaces the set, audits `MODIFICACION`, returns the new list.
- [ ] Empty PUT `ejercicioIds: []` succeeds and leaves the machine with no associations (machine becomes deletable).
- [ ] `handleMaquinaDelete` queries the real count; returns 409 `DELETE_BLOCKED_EJERCICIOS` when the machine has exercises.
- [ ] Deleting an exercise that has machine associations succeeds (M2M rows cascade); deleting an exercise in a routine still fails with 409 `DELETE_BLOCKED_ASSIGNED`.
- [ ] `GET /api/ejercicios?limit=50&search=triceps` returns at most 50 rows, accent-insensitive, paginated.
- [ ] `/maquinas` shows the expanded row with associated exercises + "Asignar ejercicios" button for ADMINISTRADOR.
- [ ] Assignment modal is accessible (Esc closes, focus trap, focus return, `role="dialog"`, aria-labelledby).
- [ ] Non-ADMIN roles (RECEPCIONISTA, INSTRUCTOR, SOCIO) get 403 on `GET/PUT /api/maquinas/[id]/ejercicios` (explicit test in `matrix-consistency.test.ts`).
- [ ] `openspec/specs/maquina-ejercicios/spec.md` lists ACs traceable to Jest tests.
- [ ] `openspec/specs/maquinas-crud/spec.md` is updated to reflect that the Etapa 2 hook is now wired.
- [ ] P-57 (ESLint pre-existing error) recorded in `openspec/decisions.md`.
- [ ] Full `npm test` + `npm run test:integration` + `tsc --noEmit` + `eslint` stay green (no *new* errors; P-57 acknowledged but not fixed here).

## PR Split

### PR 2a — Schema + migration + domain + repository + integration tests
- `prisma/schema.prisma`: `EjercicioMaquina` model + relation fields.
- `prisma/migrations/<ts>_ejercicio_maquina/migration.sql`: hand-written, additive only.
- `src/domains/maquina/maquina.ts`: `validarAsignacionEjercicios`, `MAX_EJERCIOS_POR_MAQUINA`, types.
- `src/domains/maquina/maquina-repositorio.ts`: new methods.
- `src/domains/ejercicio/ejercicio-repositorio.ts`: `limit`/`offset` on `getAll`.
- `tests/integration/ejercicio-maquina.integration.test.ts`: cascade, unique, replace.
- Domain + repository unit tests.

### PR 2b — API handlers + routes + permissions + audit + error mapping
- `src/api/maquinas.ts`: new handlers + wire real count into `handleMaquinaDelete` + client fetchers.
- `src/app/api/maquinas/[id]/ejercicios/route.ts` (new).
- `src/app/api/ejercicios/route.ts`: parse `limit`/`offset`.
- `src/middleware/matrix-consistency.test.ts`: explicit prefix-match assertion.
- `src/lib/route-error-mapper.ts`: add `VALIDATION_MAX_EJERCICIOS → 400`.
- Handler + route unit tests.

### PR 2c — UI: expanded row + assignment modal
- `src/components/maquina-crud/maquina-list.tsx`: `disclosure` + `TableDetailRow`.
- `src/components/maquina-crud/maquina-expanded-row.tsx` (new).
- `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` (new).
- Component tests.

### PR 2d — Specs + decisions
- `openspec/specs/maquina-ejercicios/spec.md` (new).
- `openspec/specs/maquinas-crud/spec.md` (updated).
- `openspec/specs/ejercicios-crud/spec.md` (updated).
- `openspec/decisions.md`: P-57 entry.

Each PR respects the ≤400-line review budget; chain via `chained-pr` if a slice exceeds it.

## Open Questions for Spec/Design

1. **Maximum exercises per machine**: the exploration recommends 50. Should this become a `ConfiguracionDelSistema` parameter now (Etapa 2) or stay a domain constant until Etapa 4–5 when the `/configuracion` panel grows? **Recommendation**: hard constant in Etapa 2; parameterize in Etapa 4–5 if the business asks.
2. **Audit detail shape**: the exploration suggests `detalles: { maquinaId, ejerciciosAsignados: n }` (count). Should the audit also include the added/removed ids (a diff)? **Recommendation**: count only; a diff is overkill for this stage and complicates the handler.
3. **Should `EjercicioConUso` expose `enMaquinas` count** (parallel to `enRutinas`) for the exercise list? The exploration flags it as useful but not required. **Recommendation**: defer to Etapa 3–5 when the exercise detail actually needs it. Etapa 2 stays machine-centric.
4. **Empty search in the modal**: should it return the first 50 exercises ordered by name, or a ranked set (e.g. most recently associated with this machine first)? **Recommendation**: alphabetical by name, no ranking. Ranking belongs to the suggestion engine (Etapa 3).
5. **`PUT` vs `PATCH`**: the exploration recommends full replacement (`PUT`) rather than add/remove deltas. The spec must state this clearly so the modal's "save" is a single atomic write. **Recommendation**: `PUT` with full `ejercicioIds` array.
6. **Next.js 16.2 async `params`**: the new `[id]/ejercicios/route.ts` must `await params` (FX-06). The design should call this out so the implementation does not repeat the old bug.
7. **Modal "select all visible" scope**: should it select only the current page, or (with pagination) all 1,324 exercises? **Recommendation**: current page only. A "select all 1,324" gesture is a footgun; the user refines by search instead.
