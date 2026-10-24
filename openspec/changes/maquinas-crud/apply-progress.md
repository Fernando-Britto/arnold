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
| T-053i Formulario y distintivo de estado | ✅ | PR-1b-1 | ≈340 | 372 | 2026-10-24 | Slice 1 of 1b; tests + components, ≤400 |
| T-053j Panel del formulario (alta/edición) | ✅ | PR-1b-2 | ≈190 | 168 | 2026-10-24 | Slice 2 of 1b; 168 líneas añadidas, ≤400 |
| T-053k Listado con filtros y búsqueda | ✅ | PR-1b-3 | ≈240 | 2026-10-24 | Slice 3 of 1b; 367 líneas añadidas (impl + tests), ≤400 |
| T-053l Navegación y seed de «Polea alta» | ✅ | PR-1b-4 | ≈13 | 19 | 2026-10-24 | Rail + seed: `NavSection`/ítem "Máquinas" y `Polea alta` → `DISPONIBLE` con test AC-014; 19 líneas en el slice de seed |
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

---

## Work Unit: PR-1b-1 — `maquina-form` + `estado-badge` components

**Unit**: PR-1b-1
**Tasks**: T-053i
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/components/maquina-crud` |
| Focused test result | Test Suites: 2 passed, 2 total — Tests: 10 passed, 10 total |
| Runtime harness | N/A — jsdom component tests; no route/page/DB surface touched |
| Rollback boundary | Revert `src/components/maquina-crud/estado-badge.tsx`, `estado-badge.test.tsx`, `maquina-form.tsx`, `maquina-form.test.tsx`. No page, nav, seed, API, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053i estado-badge | `src/components/maquina-crud/estado-badge.test.tsx` | Unit (jsdom) | N/A (new) | ✅ Written (module missing) | ✅ 4/4 pass | ✅ 4 estados × label + variant class | ✅ Clean — reused `TableStatusBadge`; small maps |
| T-053i maquina-form | `src/components/maquina-crud/maquina-form.test.tsx` | Unit (jsdom) | N/A (new) | ✅ Written (module missing) | ✅ 6/6 pass | ✅ render + edit + OCUPADA→DISPONIBLE + validation + normalized submit + cancel | ✅ Clean — mirrored `MembresiaForm` shape; no `any`; no own card/title |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/components/maquina-crud/estado-badge.tsx` | Created | +23 / −0 | Maps `EstadoMaquina` → `TableStatusBadge` variant/label: DISPONIBLE/success, OCUPADA/warning, FUERA_DE_SERVICIO/danger, INACTIVA/neutral. |
| `src/components/maquina-crud/estado-badge.test.tsx` | Created | +33 / −0 | Strict TDD: each estado renders Spanish label and expected variant class. |
| `src/components/maquina-crud/maquina-form.tsx` | Created | +206 / −0 | Controlled form with nombre, ubicación, tipoEquipamiento (Spanish labels), estado (assignable subset only). Validates with `validateMaquina`, normalizes via `normalizeMaquina`, maps errors to fields. OCUPADA/non-assignable rows default to DISPONIBLE. Guardar/Cancelar buttons disabled on `isLoading`. No card/title/max-w. |
| `src/components/maquina-crud/maquina-form.test.tsx` | Created | +110 / −0 | Strict TDD: render, pre-populate, OCUPADA→DISPONIBLE with no OCUPADA option, nombre validation blocks save and shows error, normalized submit calls `onSave` with four fields, Cancelar calls `onCancel`. |

**Total authored changed lines**: 372 insertions + 0 deletions = 372 changed lines. Under the 400-line review budget.

## Verification Results

### 1. Focused tests
```
npm test -- src/components/maquina-crud

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        ~6.2 s
```

### 2. Type check
```
npx tsc --noEmit
(no output after rm -rf .next to clear generated types bug)
```

### 3. Linter
```
npx eslint src/components/maquina-crud
(no output)
```

## Notes / Deviations

- Implementation matches `design.md` and the canonical `MembresiaForm` pattern: controlled inputs, field-level error mapping, `FormPanelShell` provides the frame (form has no card/title/max-w-*).
- `OCUPADA` rows are forced to `DISPONIBLE` on edit and `OCUPADA` is never rendered as an option.
- `validateMaquina` rejects `OCUPADA` with the exact spec message; the form does not need to special-case it beyond the option filter.
- No `any`; Spanish labels and messages; pure domain imports only (`validateMaquina`, `normalizeMaquina`, `ESTADOS_ASIGNABLES`, `TIPOS_EQUIPAMIENTO`).

---

## Work Unit: PR-1b-2 — `maquina-form-panel` (alta/edición)

**Unit**: PR-1b-2
**Tasks**: T-053j
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/components/maquina-crud/maquina-form-panel.test.tsx` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 8 passed, 8 total |
| Runtime harness | N/A — jsdom component tests; no route/page/DB surface touched |
| Rollback boundary | Revert `src/components/maquina-crud/maquina-form-panel.tsx` and `src/components/maquina-crud/maquina-form-panel.test.tsx`. No list, page, nav, seed, API, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053j maquina-form-panel | `src/components/maquina-crud/maquina-form-panel.test.tsx` | Unit (jsdom) | N/A (new) | ✅ Written (module missing) | ✅ 8/8 pass | ✅ create success + edit success + 409 API error + 401 session + network error + reentrancy + cancel | ✅ Clean — mirrored `MembresiaFormPanel` shape; no deactivation branch; no `any` |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/components/maquina-crud/maquina-form-panel.tsx` | Created | +76 / −0 | `MaquinaFormPanel` with `initialData?`, `onSuccess?`, `onCancel?`, `isEdit?`. Uses `MaquinaForm` with `key={initialData?.id ?? "nueva"}`. Raw `fetch` POST/PUT to `/api/maquinas[/${id}]`, `throwIfNotOk` with Spanish fallback, `invalidarCache(CLAVES.maquinas)`, success notification, `onSuccess(data)`. `submittingRef` re-entrancy guard; `isLoading` passed to form; error box with `bg-danger-soft text-danger`. No deactivation warning. |
| `src/components/maquina-crud/maquina-form-panel.test.tsx` | Created | +92 / −0 | Strict TDD: render new machine, create success POST/assert body/cache/notify/onSuccess, edit success PUT, 409 API error shows message and skips onSuccess/notify, 401 shows session expired, network error shows no connection, reentrancy (two submits → one fetch), onCancel callback. Mocks `global.fetch`, `@/contexts/notifications`, `@/lib/cache-cliente`. |

**Total authored changed lines**: 168 insertions + 0 deletions = 168 changed lines. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests
```
npm test -- src/components/maquina-crud/maquina-form-panel.test.tsx

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        ~5.0 s
```

### 2. Type check
```
npx tsc --noEmit
(no output)
```

### 3. Linter
```
npx eslint src/components/maquina-crud/maquina-form-panel.tsx src/components/maquina-crud/maquina-form-panel.test.tsx
(no output)
```

## Notes / Deviations

- Implementation follows the prompt's behavior spec and the canonical `MembresiaFormPanel` shape, but **without** the deactivation-warning branch (machines do not need it).
- Uses raw `fetch` + `throwIfNotOk` + `handleApiError` as specified in the prompt, rather than calling `createMaquina`/`updateMaquina` wrappers. The wrappers already exist (T-053f) and the panel could be switched to them later without behavior change.
- Spanish user-facing messages; no `any`; `MaquinaFormData` type mirrors the shape emitted by `MaquinaForm`.

---

## Work Unit: PR-1b-1a — `maquina-form` OCUPADA/unmapped-error adjustments

**Unit**: PR-1b-1a (post-merge adjustments to T-053i)
**Tasks**: Adjustment 1 (OCUPADA row starts unselected) + Adjustment 2 (fallback alert for unmapped validation errors)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/components/maquina-crud/maquina-form.test.tsx` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 10 passed, 10 total |
| Runtime harness | `npm test -- src/components/maquina-crud` → Test Suites: 4 passed, 4 total — Tests: 36 passed, 36 total |
| Rollback boundary | Revert `src/components/maquina-crud/maquina-form.tsx` and `src/components/maquina-crud/maquina-form.test.tsx`. No panel, list, page, nav, seed, API, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Adjustment 1 OCUPADA unselected | `src/components/maquina-crud/maquina-form.test.tsx` | Unit (jsdom) | ✅ 6/6 baseline | ✅ Written (select value DISPONIBLE, no empty option, no notice) | ✅ 10/10 pass | ✅ OCUPADA row unselected + empty option + notice; save without selection blocks; choose and save; assignable row keeps value | ✅ Extracted `esEstadoAsignable`, `mapErrorToField`, constants; no `any` |
| Adjustment 2 unmapped errors | `src/components/maquina-crud/maquina-form.test.tsx` | Unit (jsdom) | ✅ 6/6 baseline | ✅ Written (mocked `validateMaquina` returning `["Algo raro pasó"]`) | ✅ 10/10 pass | ✅ Alert rendered with "No se pudo guardar: Algo raro pasó"; `onSave` not called | ✅ Shared `globalErrors` state cleared on every field edit |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/components/maquina-crud/maquina-form.tsx` | Modified | +84 / −10 | Added empty-option logic for non-assignable initial estado; notice for OCUPADA rows; "Elegí un estado" field error when submitting unselected; collected unmapped validation errors into a global alert above the form; clear alert on every field edit. |
| `src/components/maquina-crud/maquina-form.test.tsx` | Modified | +77 / −6 | Replaced OCUPADA→DISPONIBLE test with strict RED tests for unselected state, empty option, notice, submit-blocking, choosing a value, assignable-row preservation, and unmapped-error alert. |

**Total authored changed lines**: 161 insertions + 16 deletions = 177 changed lines. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests (RED)
```
npm test -- src/components/maquina-crud/maquina-form.test.tsx

Test Suites: 1 failed, 1 total
Tests:       5 failed, 5 passed, 10 total
```

Failures:
- `una fila OCUPADA deja el select sin seleccionar y muestra el aviso` → select value was "DISPONIBLE", no empty option, no notice.
- `guardar sin elegir estado no llama a onSave y marca error en el campo` → no "Elegí un estado" error.
- `elegir un estado y guardar llama a onSave con el estado elegido` → onSave not called because estado was still unselected/defaulted.
- `una fila con estado asignable conserva su valor al abrir` → passed once OCUPADA logic was fixed (RED/green ordering shows it was written as RED before implementation).
- `un error sin campo conocido se muestra en la alerta y no llama a onSave` → no `role="alert"` element.

### 2. Focused tests (GREEN)
```
npm test -- src/components/maquina-crud/maquina-form.test.tsx

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        ~4.2 s
```

### 3. Component folder regression
```
npm test -- src/components/maquina-crud

Test Suites: 4 passed, 4 total
Tests:       36 passed, 36 total
Snapshots:   0 total
Time:        ~7.8 s
```

### 4. Type check
```
npx tsc --noEmit
(no output)
```

### 5. Linter
```
npx eslint src/components/maquina-crud/maquina-form.tsx src/components/maquina-crud/maquina-form.test.tsx
(no output)
```

## Notes / Deviations

- `tasks.md` was not edited because these two adjustments are corrections to the already-completed T-053i task, not new planned tasks.
- No form-panel, list, page, nav, seed, API, or DB files were touched.
- Spanish user-facing messages match the prompt exactly; no `any`; the unmapped-error alert uses `role="alert"` and clears on any field edit.

---

## Work Unit: PR-1b-4a — staff-rail `NavSection` union + "Máquinas" nav item

**Unit**: PR-1b-4a
**Tasks**: T-053l (rail portion only; seed excluded by preflight)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/components/layout/staff-rail.test.tsx` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 9 passed, 9 total |
| Runtime harness | N/A — jsdom component tests; no route/page/DB surface touched |
| Rollback boundary | Revert `src/components/layout/staff-rail.tsx` and `src/components/layout/staff-rail.test.tsx`. No seed, page, API, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053l rail | `src/components/layout/staff-rail.test.tsx` | Unit (jsdom) | N/A (modified existing) | ✅ Written (union member + nav item missing) | ✅ 9/9 pass | ✅ ADMIN sees `Máquinas` href `/maquinas`; RECEPCIONISTA/INSTRUCTOR/SOCIO do not | ✅ Clean — one union member, one nav item, role filter unchanged |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/components/layout/staff-rail.tsx` | Modified | +2 / −0 | Added `"maquinas"` to `NavSection` union; added `{ section: "maquinas", label: "Máquinas", href: "/maquinas", roles: ["ADMINISTRADOR"] }` to the "Operación" zone. |
| `src/components/layout/staff-rail.test.tsx` | Modified | +13 / −0 | Updated admin test to expect 9 links and assert `Máquinas` href; added `it.each` covering RECEPCIONISTA, INSTRUCTOR, SOCIO not seeing the link. |

**Total authored changed lines**: 15 insertions + 0 deletions = 15 changed lines. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests (RED)

```
npm test -- src/components/layout/staff-rail.test.tsx

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        2.424 s
```

### 2. Type check

```
npx tsc --noEmit
(no output)
```

### 3. Linter

```
npx eslint src/components/layout/staff-rail.tsx src/components/layout/staff-rail.test.tsx
(no output)
```

## Notes / Deviations

- Implementation matches `design.md` and the existing `NavSection` pattern: one union member plus one `NavItem` in the appropriate zone, filtered by `roles`.
- No seed changes were applied (`prisma/seed-data.ts`, `tests/prisma-seed.test.ts` untouched), per preflight instruction to keep the slice focused on the rail only.
- No page, API, component, or DB files were touched.
- `tasks.md` updated to reflect rail completion; seed portion remains pending for a later slice or close task.

---

## Work Unit: PR-1b-4b — seed «Polea alta» fix + AC-014 test

**Unit**: PR-1b-4b
**Tasks**: T-053l (seed portion)
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- tests/prisma-seed.test.ts` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 15 passed, 15 total |
| Runtime harness | N/A — unit tests with a fake Prisma; no route/page/DB surface touched |
| Rollback boundary | Revert `prisma/seed-data.ts` (`Polea alta` → `OCUPADA`) and `tests/prisma-seed.test.ts` (remove AC-014 test). No page, nav, API, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053l seed | `tests/prisma-seed.test.ts` | Unit | ✅ 14/14 baseline | ✅ Written (`estado` is `OCUPADA`) | ✅ 15/15 pass | ✅ Single scenario: empty DB → `createMany` includes `Polea alta` with `DISPONIBLE` + `Sala principal` | ✅ Clean — reused `fakePrisma` helper; no `any`; Spanish comment |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `prisma/seed-data.ts` | Modified | +5 / −1 | Changed `Polea alta` `estado` from `"OCUPADA"` to `"DISPONIBLE"`; added Spanish JSDoc comment explaining the fix only affects empty DBs (idempotent `count() === 0` guard). |
| `tests/prisma-seed.test.ts` | Modified | +13 / −0 | Added AC-014 test: `runSeed` with empty fake DB asserts `maquina.createMany` includes `Polea alta` with `estado: "DISPONIBLE"` and `ubicacion: "Sala principal"`. |

**Total authored changed lines**: 18 insertions + 1 deletion = 19 changed lines for the seed code slice. Well under the 400-line review budget.

## Verification Results

### 1. Focused tests (RED)

```
npm test -- tests/prisma-seed.test.ts

Test Suites: 1 failed, 1 total
Tests:       1 failed, 14 passed, 15 total
```

Failure:
- `siembra Polea alta como DISPONIBLE en una base vacía (AC-014)` → received `estado: "OCUPADA"`, expected `"DISPONIBLE"`.

### 2. Focused tests (GREEN)

```
npm test -- tests/prisma-seed.test.ts

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        2.382 s
```

### 3. Type check

```
npx tsc --noEmit
(no output)
```

### 4. Linter

```
npx eslint prisma/seed-data.ts tests/prisma-seed.test.ts
(no output)
```

## Notes / Deviations

- Implementation matches `design.md` §Decision: Seed — line 155 change plus idempotency comment.
- No page, nav, API, component, migration, or DB files were touched beyond the seed constant and its test.
- `tasks.md` updated to mark T-053l (rail + seed) complete.

---

## Work Unit: PR-1b-4c — `/maquinas` page (T-053m)

**Unit**: PR-1b-4c
**Tasks**: T-053m
**Date**: 2026-10-24
**Mode**: Strict TDD

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/app/maquinas/page.test.tsx` |
| Focused test result | Test Suites: 1 passed, 1 total — Tests: 8 passed, 8 total |
| Runtime harness | Full unit suite: `npm test -- --silent` → Test Suites: 240 passed, 240 total — Tests: 3377 passed, 3377 total |
| Rollback boundary | Revert `src/app/maquinas/page.tsx` and `src/app/maquinas/page.test.tsx`. No nav, seed, API, components, or DB changes. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| T-053m `/maquinas` page | `src/app/maquinas/page.test.tsx` | Unit (jsdom) | N/A (new file) | ✅ Written (`Cannot find module './page'`) | ✅ 8/8 pass | ✅ ADMIN list + "Nueva máquina"; INSTRUCTOR → /home-socio; unauth → /login; Acceso Denegado; create modal empty; modify modal selected; delete confirm + success; 409 DELETE_BLOCKED_EJERCICIOS message surfaces | ✅ Clean — modal uses `useModalA11y`; `CrudPageLayout` with `formPanel={null}`; no shared CRUD hook extracted |

## Files Touched

| File | Action | Lines | What Was Done |
|---|---|---|---|
| `src/app/maquinas/page.tsx` | Created | +205 / −0 | `MaquinasPage` default + named export. ADMIN-only auth guard (redirect /login or /home-socio; render "Acceso Denegado"). Loads list via `fetchMaquinasList`; errors via `handleApiError`. `CrudPageLayout section="maquinas"` with "Nueva máquina" `ActionButton` plus `CrudActions`. Create/edit in a modal (`role="dialog"`, `aria-modal="true"`, labelled title) whose panel uses `useModalA11y`; inside `MaquinaFormPanel` with `onSuccess` updating local list and closing modal. Delete uses `ConfirmDialog`; on confirm calls `deleteMaquina`, removes row, notifies success. 409 `DELETE_BLOCKED_EJERCICIOS` surfaces server message on the layout error area. Spanish UI; no `any`. |
| `src/app/maquinas/page.test.tsx` | Created | +147 / −0 | Strict TDD: mocks `next/navigation`, `@/contexts/auth`, `@/contexts/notifications`, `@/api/maquinas`; stubs `MaquinaFormPanel` exposing `initialData` and an `onSuccess` trigger. 8 tests cover ADMIN render, INSTRUCTOR redirect, unauthenticated redirect, access-denied render, create-modal empty data, modify-modal selected row, delete confirmation + success, and 409 blocked-delete server message. |
| `openspec/changes/maquinas-crud/tasks.md` | Modified | +27 / −31 | Marked T-053m complete with actual LOC (352 lines, 205 impl + 147 tests) and updated the task breakdown checklist/status. |

**Total authored changed lines**: 352 lines for the implementation slice (205 impl + 147 tests), within the 400-line budget. `tasks.md` bookkeeping adds 58 changed lines (27 insertions + 31 deletions) and is not part of the reviewable code slice. |

## Verification Results

### 1. Focused tests (RED)

```
npm test -- src/app/maquinas/page.test.tsx

Test Suites: 1 failed, 1 total
Tests:       0 total

Cannot find module './page' from 'src/app/maquinas/page.test.tsx'
```

### 2. Focused tests (GREEN)

```
npm test -- src/app/maquinas/page.test.tsx

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        ~4.0 s
```

### 3. Full suite

```
npm test -- --silent

Test Suites: 240 passed, 240 total
Tests:       3377 passed, 3377 total
Snapshots:   0 total
Time:        51.225 s
```

### 4. Type check

```
npx tsc --noEmit
(no output)
```

### 5. Linter

```
npx eslint src/app/maquinas/page.tsx src/app/maquinas/page.test.tsx
(no output)
```

## Notes / Deviations

- Implementation matches the preflight behavior spec and `design.md`: auth guard shape cloned from `MembresiasPage`, create/edit in a modal (not an inline `formPanel`), `ConfirmDialog` for delete, `handleApiError` for load/delete errors, and `DELETE_BLOCKED_EJERCICIOS` surfaced verbatim.
- The modal panel uses `useModalA11y` for Esc/focus-trap/focus-return; `ConfirmDialog` already uses the same hook internally.
- `MaquinaList` owns its own client-side estado/tipo/nombre filters (out of scope to modify), so the page-level `searchTerm` from `CrudActions` is maintained for UI consistency but not passed down.
- Spanish user-facing messages; no `any`; no static `@/lib/db` import.

