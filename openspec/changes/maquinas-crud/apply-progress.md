# Apply Progress: maquinas-crud

## Work Unit

**Unit**: PR-1a-4 (Slice 4 of 1a)
**Tasks**: T-053f (handlers + client wrappers)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/api/maquinas.test.ts src/lib/cache-cliente.test.ts` |
| Focused test result | Test Suites: 2 passed, 2 total — Tests: 24 passed, 24 total |
| Runtime harness | `npm test -- --silent` → Test Suites: 233 passed, 233 total — Tests: 3286 passed, 3286 total |
| Rollback boundary | Revert `src/api/maquinas.ts`, `src/api/maquinas.test.ts`, and the one-line addition to `src/lib/cache-cliente.ts`. No routes, UI, seed, or migration are touched; no consumer imports these files yet. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053f handlers | `src/api/maquinas.test.ts` | Unit | ✅ cache-cliente 7/7 | ✅ Written (module missing) | ✅ 17/17 handler tests pass | ✅ list filters/no-filters, create invalid/OCUPADA/normalize/duplicate, get 404, update 404/OCUPADA-unchanged/validation/duplicate, delete 404/puedeEliminar | ✅ Clean — explicit `definedFields`, local `codedError` helper, no `any` |
| T-053f client wrappers | `src/api/maquinas.test.ts` | Unit | N/A (new) | ✅ Written | ✅ 4/4 wrapper tests pass | ✅ fetch caches under `CLAVES.maquinas`; create/update/delete each invalidate `CLAVES.maquinas` | ✅ Clean — mirrors `membresias.ts` shape |
| CLAVES.maquinas | `src/api/maquinas.test.ts` | Structural | N/A (new key) | ✅ Test references `CLAVES.maquinas` before it exists | ✅ Key added, tests pass | ➖ Single constant addition | ➖ None needed |

## Cumulative Task Status

| Task | Status | PR / slice | Est. LOC | Actual LOC | Date | Note |
|---|---|---|---|---|---|---|
| T-053a Dominio puro de máquina | ✅ | PR-1a-1 | ≈350 | — | 2026-10-23 | Slice 1 of 1a |
| T-053b Repositorio, unicidad y `P2002` | ✅ | PR-1a-2 | ≈240 | — | 2026-10-23 | Slice 2 of 1a |
| T-053c Migración del índice único + integración | 🔄 | PR-1a-2 | ≈117 | — | 2026-10-23 | Files ready; integration test blocked by unavailable Docker |
| T-053d Mapeo de errores nuevos | ✅ | PR-1a-3 | ≈135 | ≈103 | 2026-10-24 | Slice 3 of 1a |
| T-053e Permisos: solo Administrador | ✅ | PR-1a-3 | ≈42 | ≈43 | 2026-10-24 | Slice 3 of 1a |
| T-053f Handlers de API y envoltorios cliente | ✅ | PR-1a-4 | ≈321 | ≈198 | 2026-10-24 | Slice 4 of 1a; 17 handler + 4 wrapper tests, all green |
| T-053g Rutas `GET`/`POST /api/maquinas` | ⬜ | PR-1a-5 | ≈240 | — | — | Slice 5 of 1a |
| T-053h Rutas `GET`/`PUT`/`DELETE /api/maquinas/[id]` | ⬜ | PR-1a-6 | ≈360 | — | — | Slice 6 of 1a |
| T-053i Formulario y distintivo de estado | ⬜ | PR-1b-1 | ≈340 | — | — | Slice 1 of 1b |
| T-053j Panel del formulario (alta/edición) | ⬜ | PR-1b-2 | ≈190 | — | — | Slice 2 of 1b |
| T-053k Listado con filtros y búsqueda | ⬜ | PR-1b-3 | ≈240 | — | — | Slice 3 of 1b |
| T-053l Navegación y seed de «Polea alta» | ⬜ | PR-1b-4 | ≈13 | — | — | Slice 4 of 1b; must land before T-053m |
| T-053m Pantalla `/maquinas` | ⬜ | PR-1b-4 | ≈330 | — | — | Slice 4 of 1b |
| T-053n Cierre documental (P-53, P-54, D-73) | ⬜ | none (direct to `dev`) | ≈80 | — | — | After all slices merge |

## Files Touched (PR-1a-4)

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/api/maquinas.ts` | Created | +177 / −0 | Five server handlers (`handleMaquinaList/Create/GetById/Update/Delete`) and four client wrappers (`fetchMaquinasList`, `createMaquina`, `updateMaquina`, `deleteMaquina`). Local `codedError(code, message)` helper; explicit `OCUPADA` guard before validation on POST/PUT; `definedFields` merge on PUT; `puedeEliminar` consulted on DELETE. |
| `src/api/maquinas.test.ts` | Created | +313 / −0 | Strict TDD tests: mocked `maquinaRepository`; 17 handler assertions + 4 wrapper assertions covering all required 15 cases plus create/update invalidation. |
| `src/lib/cache-cliente.ts` | Modified | +1 / −0 | Added `maquinas: "maquinas"` to `CLAVES`. |
| `openspec/changes/maquinas-crud/tasks.md` | Modified | +4 / −4 | Marked T-053f complete and updated detail checkboxes. |

**Total authored changed lines**: 491 insertions + 4 deletions = 495 changed lines for PR-1a-4 as a whole.
Note: the full slice (impl + tests + cache key) is above the 400-line review budget; this slice is committed as one commit on `feat/asignacion-dinamica` per the already-chosen Option B delivery decision (no GitHub PRs).

## Verification Results

### 1. Focused tests
```
npm test -- src/api/maquinas.test.ts src/lib/cache-cliente.test.ts

Test Suites: 2 passed, 2 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        2.65 s
```
(Jest also emitted its routine worker-force-exit warning after the suite; tests themselves pass.)

### 2. Full suite
```
npm test -- --silent

Test Suites: 233 passed, 233 total
Tests:       3286 passed, 3286 total
Snapshots:   0 total
Time:        41.715 s
```

### 3. Type check
```
npx tsc --noEmit
(no output)
```

### 4. Linter
```
npx eslint src/api/maquinas.ts src/api/maquinas.test.ts src/lib/cache-cliente.ts
(no output)
```

## Notes / Deviations

- Implementation matches `design.md`: handler signatures, `codedError` helper, client-wrapper shape mirroring `membresias.ts`, cache invalidation after writes, and explicit `OCUPADA` rejection on POST and unchanged PUT.
- No `any` used; Spanish user-facing messages; no direct `@/lib/db` import.
- `definedFields` was made explicit (per-field) rather than a generic `Object.entries` helper to keep TypeScript strict mode happy without casts.
- Added two wrapper tests beyond the listed 15 (create/update invalidation) because the behavior mandates all three write wrappers invalidate `CLAVES.maquinas`.
- No routes, UI, seed, migration, or `authorization.ts` were modified in this slice.
