# Apply Progress: maquinas-crud

## Work Unit

**Unit**: PR-1a-6 sub-slice 6a — `GET /api/maquinas/[id]` + route scaffolding
**Tasks**: T-053h (partial — GET only; PUT/DELETE are 6b/6c)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- --testPathPatterns='maquinas/\[id\]/route\.test\.ts'` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 6 passed, 6 total |
| Runtime harness | Full unit suite: `npm test -- --silent` → Test Suites: 235 passed, 235 total — Tests: 3308 passed, 3308 total (no `npm run dev` per preflight) |
| Rollback boundary | Revert `src/app/api/maquinas/[id]/route.ts` and `src/app/api/maquinas/[id]/route.test.ts`. No PUT/DELETE, UI, seed, migration, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053h GET by id | `src/app/api/maquinas/[id]/route.test.ts` | Unit | N/A (new file) | ✅ Written (module missing) | ✅ 6/6 tests pass | ✅ 200 success + 404 NOT_FOUND + 401 + 403 + request-helper 500 + helper 200 | ✅ Clean — copied `autorizar`/union/guard shape from collection route; no `any`; no static `@/lib/db` import |

## Cumulative Task Status

| Task | Status | PR / slice | Est. LOC | Actual LOC | Date | Note |
|---|---|---|---|---|---|---|
| T-053a Dominio puro de máquina | ✅ | PR-1a-1 | ≈350 | — | 2026-10-23 | Slice 1 of 1a |
| T-053b Repositorio, unicidad y `P2002` | ✅ | PR-1a-2 | ≈240 | — | 2026-10-23 | Slice 2 of 1a |
| T-053c Migración del índice único + integración | 🔄 | PR-1a-2 | ≈117 | — | 2026-10-23 | Files ready; integration test blocked by unavailable Docker |
| T-053d Mapeo de errores nuevos | ✅ | PR-1a-3 | ≈135 | ≈103 | 2026-10-24 | Slice 3 of 1a |
| T-053e Permisos: solo Administrador | ✅ | PR-1a-3 | ≈42 | ≈43 | 2026-10-24 | Slice 3 of 1a |
| T-053f Handlers de API y envoltorios cliente | ✅ | PR-1a-4 | ≈321 | ≈198 | 2026-10-24 | Slice 4 of 1a; 17 handler + 4 wrapper tests, all green |
| T-053g Rutas `GET`/`POST /api/maquinas` | ✅ | PR-1a-5 | ≈240 | 344 | 2026-10-24 | Slice 5 of 1a (route.ts + route.test.ts) |
| T-053h Rutas `GET`/`PUT`/`DELETE /api/maquinas/[id]` | 🔄 | PR-1a-6 | ≈360 | — | 2026-10-24 | Sub-slice 6a (GET + scaffolding) complete; PUT/DELETE pending as 6b/6c |
| T-053i Formulario y distintivo de estado | ⬜ | PR-1b-1 | ≈340 | — | — | Slice 1 of 1b |
| T-053j Panel del formulario (alta/edición) | ⬜ | PR-1b-2 | ≈190 | — | — | Slice 2 of 1b |
| T-053k Listado con filtros y búsqueda | ⬜ | PR-1b-3 | ≈240 | — | — | Slice 3 of 1b |
| T-053l Navegación y seed de «Polea alta» | ⬜ | PR-1b-4 | ≈13 | — | — | Slice 4 of 1b; must land before T-053m |
| T-053m Pantalla `/maquinas` | ⬜ | PR-1b-4 | ≈330 | — | — | Slice 4 of 1b |
| T-053n Cierre documental (P-53, P-54, D-73) | ⬜ | none (direct to `dev`) | ≈80 | — | — | After all slices merge |

## Files Touched (PR-1a-6 sub-slice 6a)

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/app/api/maquinas/[id]/route.ts` | Created | +106 / −0 | `GET` handler with Next 16 `await params`; local `autorizar` guard (`ADMINISTRADOR` only); `ALLOWED_ROLES`; `ERROR_OPTIONS`; `GetSuccess`/`GetError` discriminated union and `isGetSuccess` guard; exported `handleMaquinaGetByIdRequest` that calls `handleMaquinaGetById` and maps errors via `mapErrorToResponse`. No PUT/DELETE exports. |
| `src/app/api/maquinas/[id]/route.test.ts` | Created | +126 / −0 | Strict TDD tests mocking `@/api/maquinas`, `@/lib/auth`, `@/lib/db`: GET 200 by id, GET 404 `NOT_FOUND`, GET 401, GET 403 for `RECEPCIONISTA`, and `handleMaquinaGetByIdRequest` 500 mapping. |

**Total authored changed lines**: 232 insertions + 0 deletions = 232 changed lines for sub-slice 6a. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests
```
npm test -- --testPathPatterns='maquinas/\[id\]/route\.test\.ts'

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        ~4.2 s
```
(The literal pattern `src/app/api/maquinas/[id]/route.test.ts` is interpreted by Jest as a glob and does not match the `[id]` directory; `--testPathPatterns` is required to target this file.)

### 2. Full suite
```
npm test -- --silent

Test Suites: 235 passed, 235 total
Tests:       3308 passed, 3308 total
Snapshots:   0 total
Time:        61.572 s
```

### 3. Type check
```
npx tsc --noEmit
(no output)
```

### 4. Linter
```
npx eslint src/app/api/maquinas/[id]/route.ts src/app/api/maquinas/[id]/route.test.ts
(no output)
```

## Notes / Deviations

- Implementation matches `design.md` and the collection route shape: discriminated unions, `autorizar`, `ALLOWED_ROLES`, `ERROR_OPTIONS`, `mapErrorToResponse`, and Next 16 `await params`.
- No `any` used; Spanish user-facing messages; no direct `@/lib/db` import.
- PUT and DELETE handlers were deliberately omitted (per preflight); the route exports only `GET` and `handleMaquinaGetByIdRequest`.

---

## Work Unit: API handler body-validation fix

**Unit**: PR-1a-4c — `handleMaquinaCreate` / `handleMaquinaUpdate` non-object body guard
**Tasks**: T-053f body-validation fix (not in `tasks.md`; preflight bug fix)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/api/maquinas.test.ts` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 20 passed, 20 total |
| Runtime harness | N/A — repository-mocked unit tests; route/UI untouched |
| Rollback boundary | Revert `src/api/maquinas.ts` and `src/api/maquinas.test.ts` to HEAD. No route/DB/migration changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| body-validation fix | `src/api/maquinas.test.ts` | Unit | ✅ 17/17 baseline | ✅ Written (3 tests failed with TypeError/NOT_FOUND) | ✅ 20/20 pass | ✅ null + array cases for update; create null | ✅ Local `esObjetoPlano` guard; no `any` |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/api/maquinas.ts` | Modified | +23 / −7 | Added local `esObjetoPlano` type guard; early `VALIDATION_ERROR` throw in `handleMaquinaCreate` and `handleMaquinaUpdate`; narrowed guarded value with `const body = input as MaquinaInput` to satisfy strict TS. |
| `src/api/maquinas.test.ts` | Modified | +31 / −1 | Imported `MaquinaInput`; added three RED tests for `null`/`[]` bodies rejecting with `code: "VALIDATION_ERROR"` and message containing "El cuerpo debe ser un objeto"; asserted repository `create`/`update` are not called. |

**Total authored changed lines**: 54 insertions + 8 deletions = 62 changed lines. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests (RED)

```
npm test -- src/api/maquinas.test.ts

Test Suites: 1 failed, 1 total
Tests:       3 failed, 17 passed, 20 total
```

Failures:
- `handleMaquinaCreate(null)` → TypeError: Cannot read properties of null (reading 'estado')
- `handleMaquinaUpdate("m1", null)` → code: "NOT_FOUND"
- `handleMaquinaUpdate("m1", [])` → code: "NOT_FOUND"

### 2. Focused tests (GREEN)

```
npm test -- src/api/maquinas.test.ts

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

### 3. Type check

```
npx tsc --noEmit
(no output)
```

### 4. Linter

```
npx eslint src/api/maquinas.ts src/api/maquinas.test.ts
(no output)
```

## Notes / Deviations

- Implementation matches the preflight: local type guard, `codedError("VALIDATION_ERROR", "El cuerpo debe ser un objeto")`, no `any`, Spanish messages.
- The type guard narrows `input` to `Record<string, unknown>`; a subsequent `as MaquinaInput` cast is required inside each handler so TypeScript strict mode can resolve `body.estado`, `body.nombre`, etc. No behavior change for valid objects.
- `tasks.md` was not edited per the preflight instruction.
- `tasks.md` was not edited per the preflight instruction (the orchestrator tracks sub-slices).
