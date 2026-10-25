# Archive Report — maquina-ejercicios

- **Change**: `maquina-ejercicios` (Etapa 2 of "asignación dinámica de ejercicios")
- **Close date**: 2026-10-25
- **Artifact store**: openspec
- **Archived to**: `openspec/changes/archive/2026-10-25-maquina-ejercicios/`
- **Branch**: `feat/maquina-ejercicios`

## What shipped

- **Explicit M2M `EjercicioMaquina`** with composite uniqueness `[maquinaId, ejercicioId]` and `onDelete: Cascade` on both sides. Exercise deletion is still gated upstream by the two `Restrict` relations; machine deletion is gated by the real association count.
- **Migration `20261024120000_ejercicio_maquina`**, hand-written and additive (inline FKs, no `ALTER`), applied in Supabase.
- **Endpoints** `GET`/`PUT /api/maquinas/[id]/ejercicios` — full-set replacement, ADMINISTRADOR only, best-effort `MODIFICACION` audit.
- **Real-count delete**: `DELETE /api/maquinas/[id]` queries `contarEjerciciosAsociados`; `0` deletes physically, `> 0` returns 409 `DELETE_BLOCKED_EJERCICIOS`. The pure `puedeEliminar` function is unchanged.
- **Opt-in pagination** on `GET /api/ejercicios`: `limit` 1–50, `offset >= 0`; defaults 20/0 only when at least one param is present; both the `unaccent` raw-search path and the `findMany` path honor it, preserving `muscleGroup`, name ordering and `enRutinas`.
- **`/maquinas` expanded row** with lazy load (loading / empty / error+retry states).
- **Assignment modal**: accessible dialog, debounced accent-insensitive search, page size 50, "Ver más" only when the last page came back full, selection that survives pages and searches (including assigned exercises off the visible page), "N seleccionados", full-replacement `PUT`, success notice and list refresh.
- **Muscle-group filter** in the modal search, plus **"Seleccionar/Quitar los visibles"** bounded by the 100 cap with the at-cap message. `MAX_EJERCICIOS_POR_MAQUINA = 100`, with the validation message interpolated from the constant.

## Verified evidence (final state)

- `npm test`: **243 suites / 3502 tests** green.
- `npx prisma migrate status`: **20/20**, migration `20261024120000_ejercicio_maquina` applied in Supabase on 2026-10-25.
- Integration suite run by Fernando against the Docker Postgres (per `PROJECT-STATUS.md` close entry).
- Screen tested in the browser by Fernando; CP3 approved by the external reviewer.
- Gates not clean by design: `npx eslint .` still reports the pre-existing P-57 error only; this change adds no new lint errors. `tsc --noEmit` clean.

## Specs synced

| Domain | Action | Details |
|--------|--------|---------|
| `maquina-ejercicio-assignment` | **Created** | Full new-capability spec promoted byte-for-byte (435 lines, 12 requirements). |
| `maquinas-crud` | **Updated** | MODIFIED requirement "Delete and the `puedeEliminar` extension point" (real count + 409 `DELETE_BLOCKED_EJERCICIOS` + new blocked scenario); AC-010/AC-011 rewritten and their traceability rows updated. |
| `ejercicios-crud` | **Updated** | ADDED requirement "Exercise List API Pagination" (opt-in, `limit` 1–50, `offset >= 0`, defaults 20/0 only when pagination is active, both query paths, term stays parameterized); AC-008/AC-009 appended to the canonical AC list. |

Merges were performed with `gentle-ai sdd-archive-compose` (requirement bodies) on requirement-only deltas extracted mechanically from the change specs, so the delta's supporting plain sections were not injected mid-document. The canonical AC lists and traceability rows were updated in place afterwards, because `sdd-archive-compose` only merges `### Requirement` blocks.

## Task state

- Summary table: **18/18 tasks ✅** (T-054a … T-054r, including T-054q and the close task T-054r).
- Recorded inconsistency, preserved as-is (audit trail not rewritten): the per-task body sections for **T-054a, T-054b and T-054c** still show `Status: ⬜` with unchecked TDD boxes, while the summary table and the delivered code/tests mark them done.
- `verify-report.md` is absent from the change folder (no verify phase artifact was persisted).

## Pending items (recorded in `openspec/decisions.md`)

- **P-57** — pre-existing ESLint `react-hooks/purity` error (`Date.now()` during render) at `src/app/home-socio/page.tsx:129`, from `f4d1ac2`. Not fixed here; this change adds no new lint errors.
- **P-58** — `enMaquinas` count on the exercise list deferred; the list does not show how many machines use each exercise.
- **P-59** — `MAX_EJERCICIOS_POR_MAQUINA` as a runtime `/configuracion` parameter deferred; it remains a hard constant.
- **P-60** — automatic/suggested exercise-to-machine assignment (equipment + muscle group / machine type + name) as a future matching heuristic that only preselects in the modal, never assigns silently.

## Next

**Etapa 3 — motor de espera y sugerencia** (wait/suggestion engine, session-driven `OCUPADA`, Home_Socio machine visibility). P-60 is the natural seed for the suggestion half of that stage.

## Audit trail

Historical artifacts (`explore.md`, `proposal.md`, `design.md`, `tasks.md`, the three delta specs) were moved unchanged; `archive-report.md` is the only additive file. No archived content was rewritten, and no code, `prisma/`, or `tests/` files were touched during archive.
