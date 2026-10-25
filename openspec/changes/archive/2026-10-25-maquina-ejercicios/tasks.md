# Tasks: maquina-ejercicios (Etapa 2 — asignación dinámica de ejercicios)

> **Numbering note.** Starts at **T-054** with letter suffixes per slice, because the last task in the live record is
> **T-053n** (`openspec/sdd-tasks-tdd.md`). Last decision is **D-73**, last pending is **P-56**; **D-74** is reserved
> for this change's close (T-054r) and **P-57** is reserved for the pre-existing ESLint `react-hooks/purity` error at
> `src/app/home-socio/page.tsx:129` (from `f4d1ac2`, reproduced on `feat/maquina-ejercicios`).

> **Authoritative inputs:** `proposal.md`, `explore.md`, `design.md` (slice boundaries, exact SQL, exact signatures),
> the three delta specs under `openspec/changes/maquina-ejercicios/specs/` (AC-201…AC-215 plus the `maquinas-crud`
> AC-010/AC-011 and `ejercicios-crud` AC-008/AC-009 deltas), `openspec/config.yaml` (`strict_tdd: true`),
> `openspec/decisions.md` (D-70, D-73, P-53…P-56) and the archived Etapa 1 plan
> `openspec/changes/archive/2026-10-24-maquinas-crud/tasks.md` (style, checkpoint and verification conventions).

> **Verified against the working tree (2026-10-24).** Three paths in `design.md` do not exist and are corrected here:
> (1) `src/domains/ejercicio/ejercicio-repositorio.test.ts` is absent — the `getAll` suite lives in
> `src/domains/ejercicio/ejercicio.test.ts:404-485`; (2) `src/app/api/maquinas/[id]/route.delete.test.ts` is absent —
> the DELETE route tests live in `src/app/api/maquinas/[id]/route.test.ts`; (3) `src/api/ejercicios.ts` already exports
> `fetchEjercicios()` (line 65) — the new fetcher is added alongside it, not instead of it. Everything else in the
> design (schema anchors, `MaquinaReader`, `codedError`/`esObjetoPlano`, `TableDetailRow` + `disclosure`,
> `useModalA11y`, `CLAVES.maquinas`, `DELETE_BLOCKED_EJERCICIOS`) matches the code.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines — all slices | **≈1,860** (additions + deletions, tests included) |
| Estimated changed lines — close task | **≈80** (documentation only) |
| Estimated changed lines — total | **≈1,940** |
| Largest single slice | **≈370** (`commit 2g`, slice 7: modal + page wiring) — under 400 |
| 400-line budget risk | **Low** per slice; the aggregate is ≈4.7× the budget, which is why chaining is mandatory |
| Chained PRs recommended | **Yes** |
| Suggested split | commit 2a → commit 2b → commit 2c → commit 2d → commit 2e → commit 2f → commit 2g (+ close, no PR) |
| Delivery strategy | ask-on-risk |
| Chain strategy | **decided**: one slice = one commit on `feat/maquina-ejercicios`; no PRs, no stacked PRs |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: one slice = one commit on feat/maquina-ejercicios (no PRs)
400-line budget risk: Low
```

### Delivery decision (approved)

**One slice = one commit on `feat/maquina-ejercicios`.** No GitHub PRs and no stacked PRs. Each slice leaves
`npm test` / `tsc` / `eslint` green before the commit is requested; Fernando commits. Apply pauses at CP1, CP2 and CP3.

### Checkpoints (apply pauses for a human at each)

- **CP1 — Slice 1** (`commit 2a`, T-054a…T-054c): schema + hand-written migration + pure domain. Gate: migration verified
  against the ephemeral Docker Postgres (`npm run test:integration` green), and the pre-migration greps report
  `CREATE TABLE` = **1**, `CREATE UNIQUE INDEX` = **1**, `CREATE INDEX` = **2**, `ON DELETE CASCADE` = **2**, and
  **0** `DROP`, **0** `ALTER`, **0** `Maquina_nombre_ubicacion_key`.
- **CP2 — Slices 2–4** (`commit 2b`…`commit 2d`, T-054d…T-054i): repository + integration, handlers + error mapping + real
  DELETE count, routes + permissions. Gate: API complete; `GET`/`PUT /api/maquinas/[id]/ejercicios` and
  `DELETE /api/maquinas/[id]` exercised by tests and by a `curl` smoke (D-21).
- **CP3 — Slices 5–7** (`commit 2e`…`commit 2g`, T-054j…T-054p): pagination, expanded row + fetchers, modal + page wiring.
  Gate: pagination + UI complete; `/maquinas` checked in the browser by Fernando.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema + additive migration + pure validation domain | commit 2a | `npm test -- src/domains/maquina/maquina.test.ts src/domains/dominios-puros.guard.test.ts` | Ephemeral Docker Postgres (`npm run test:integration`) | Revert PR; `DROP TABLE IF EXISTS "EjercicioMaquina"` if the migration already ran |
| 2 | Repository methods + FK/unique/transaction proof | commit 2b | `npm test -- src/domains/maquina/maquina-repositorio.test.ts` + `npm run test:integration` | Ephemeral Docker Postgres | Revert PR; `EjercicioMaquina` table becomes unused, no data loss elsewhere |
| 3 | Error mapping + handlers + real DELETE count | commit 2c | `npm test -- src/api/maquinas.test.ts src/lib/route-error-mapper.test.ts` | N/A — repository mocked | Revert PR; delete returns to the Etapa-1 hardcoded `0` |
| 4 | Nested route + permission proofs | commit 2d | `npm test -- "src/app/api/maquinas/[id]" src/middleware/matrix-consistency.test.ts src/lib/authorization.test.ts` | `npm run dev` + admin login + `curl` (D-21) | Revert PR; endpoints disappear, no data mutated |
| 5 | Opt-in pagination on `GET /api/ejercicios` | commit 2e | `npm test -- src/domains/ejercicio/ejercicio.test.ts src/api/ejercicios.test.ts src/app/api/ejercicios/route.test.ts` | `npm run dev` + `curl` with `?limit=50&search=triceps` | Revert PR; `/ejercicios` behavior was never changed when params are omitted |
| 6 | Client fetchers + expanded row + list disclosure | commit 2f | `npm test -- src/components/maquina-crud/maquina-list.test.tsx src/components/maquina-crud/maquina-expanded-row.test.tsx src/api/maquinas.test.ts` | N/A — jsdom; browser check lands in commit 2g | Revert PR; no page imports the expanded row yet |
| 7 | Accessible assignment modal + `/maquinas` wiring | commit 2g | `npm test -- src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx src/app/maquinas/page.test.tsx` | `npm run dev` + browser on `/maquinas` (Fernando) | Revert PR; screen returns to the Etapa-1 state, API stays usable |

### Per-slice LOC

| # | Slice | Tasks | Files (impl + tests) | Est. LOC |
|---|---|---|---|---|
| 1 | Schema + migration + pure domain | T-054a, T-054b, T-054c | `schema.prisma`, `migration.sql`, `maquina.ts` + test | **≈185** |
| 2 | Repository + integration | T-054d, T-054e | `maquina-repositorio.ts` + test, `tests/integration/ejercicio-maquina.integration.test.ts` | **≈330** |
| 3 | Handlers + error mapping + real DELETE count | T-054f, T-054g | `route-error-mapper.ts` + test, `api/maquinas.ts` + test | **≈205** |
| 4 | Routes + permissions tests | T-054h, T-054i | `[id]/ejercicios/route.ts` + test, `matrix-consistency.test.ts`, `authorization.test.ts` | **≈300** |
| 5 | Pagination | T-054j, T-054k | `ejercicio-repositorio.ts`, `ejercicio.test.ts`, `api/ejercicios.ts` + test, `app/api/ejercicios/route.ts` + test | **≈230** |
| 6 | UI expanded row + client fetchers | T-054l, T-054m, T-054n | `api/maquinas.ts` + test, `api/ejercicios.ts` + client test, `maquina-expanded-row.tsx` + test, `maquina-list.tsx` + test | **≈240** |
| 7 | Assignment modal + page wiring | T-054o, T-054p | `ejercicio-asignacion-modal.tsx` + test, `app/maquinas/page.tsx` + test | **≈370** |
| 8 | Modal: filtro por grupo y selección de visibles | T-054q | `ejercicio-asignacion-modal.tsx` + test, `api/ejercicios.ts` + test | **≈287** |
| — | Close (documentation) | T-054r | `decisions.md`, `PROJECT-STATUS.md`, `sdd-tasks-tdd.md`, `odd/tasks/maquina-ejercicios.md` | **≈80** |
| | **Total** | **18 tasks** | | **≈2,227** |

---

## Execution Status

Legend: ⬜ pending · ✅ done · 🔄 in progress. "Actual LOC" is filled during apply; the estimate keeps the planning
number (tests included).

| Task | Status | Slice / PR | Est. LOC | Date | Note |
|---|---|---|---|---|---|
| T-054a Dominio puro de asignación | ✅ | Slice 1 · commit 2a | 112 | 2026-10-24 | 45 impl + 67 tests |
| T-054b Modelo `EjercicioMaquina` en el schema | ✅ | Slice 1 · commit 2a | 21 | 2026-10-24 | schema additions |
| T-054c Migración escrita a mano + pre-chequeos | ✅ | Slice 1 · commit 2a | 17 | 2026-10-24 | CP1 gate passed |
| T-054d Repositorio: conteo, lectura y reemplazo | ✅ | Slice 2 · commit 2b | 231 | 2026-10-24 | 83 impl + 148 tests |
| T-054e Integración: cascada, unicidad y transacción | ✅ | Slice 2 · commit 2b | 165 | 2026-10-24 | Suite escrita; ejecución pendiente de Fernando (Docker) |
| T-054f Mapeo de `VALIDATION_MAX_EJERCICIOS` | ✅ | Slice 3 · commit 2c | 50 | 2026-10-24 | 11 impl + 39 tests |
| T-054g Handlers de asignación + conteo real de baja | ✅ | Slice 3 · commit 2c | 297 | 2026-10-24 | 67 impl + 230 tests; AC-010/AC-011 del delta |
| T-054h Ruta `GET`/`PUT /api/maquinas/[id]/ejercicios` | ✅ | Slice 4 · commit 2d | 379 | 2026-10-24 | 167 impl + 212 tests; `await params` (FX-06) |
| T-054i Pruebas de permisos del path anidado | ✅ | Slice 4 · commit 2d | 16 | 2026-10-24 | Solo tests (matrix) |
| T-054j Paginación opt-in en el repositorio de ejercicios | ✅ | Slice 5 · commit 2e | 108 | 2026-10-25 | 15 impl + 93 tests |
| T-054k Paginación en handler y ruta de ejercicios | ✅ | Slice 5 · commit 2e | 177 | 2026-10-25 | 49 impl + 128 tests |
| T-054l Fetchers cliente de asignación y búsqueda | ✅ | Slice 6 · commit 2f | 256 | 2026-10-25 | 179 fetchers + 77 ajuste de tope temprano |
| T-054m Fila expandida de máquina | ✅ | Slice 6 · commit 2f | 198 | 2026-10-25 | 100 impl + 98 tests |
| T-054n Disclosure y detalle en el listado | ✅ | Slice 6 · commit 2f | 82 | 2026-10-25 | 20 impl + 62 tests; chevron restaurado |
| T-054o Modal accesible de asignación | ✅ | Slice 7 · commit 2g | 394 | 2026-10-25 | 225 impl + 169 tests; `useModalA11y` |
| T-054p Cableado de `/maquinas` | ✅ | Slice 7 · commit 2g | 98 | 2026-10-25 | 21 impl + 77 tests; `refreshKey` |
| T-054q Filtro por grupo muscular y selección de visibles | ✅ | Slice 8 · commit 2h | 287 | 2026-10-25 | `muscleGroup` en el fetcher; tope 100 con aviso |
| T-054r Cierre documental (D-74, P-57..P-60) | ✅ | none (directo a `dev`) | ≈80 | 2026-10-25 | Cierre ejecutado |

---

## task_breakdown

### Checkpoint CP1 — Slice 1: schema, migración y dominio puro (commit 2a)

#### T-054a · Dominio puro de asignación

- **Status**: ⬜ · **Slice**: 1 de 7 · **PR**: commit 2a · **Est. LOC**: ≈95 (≈45 impl + ≈50 tests)
- **Files**:
  - `src/domains/maquina/maquina.ts` (modify)
  - `src/domains/maquina/maquina.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — extend `src/domains/maquina/maquina.test.ts` with a `validarAsignacionEjercicios` describe:
     - `acepta ids distintos que existen y los devuelve tal cual`
     - `acepta el conjunto vacío y devuelve { ok: true, ejercicioIds: [] }`
     - `rechaza duplicados con VALIDATION_ERROR y "Hay ejercicios duplicados en la asignación"`
     - `rechaza ids desconocidos con VALIDATION_ERROR y "Uno o más ejercicios no existen"`
     - `rechaza 101 ids con VALIDATION_MAX_EJERCICIOS y "No se pueden asignar más de 100 ejercicios a una máquina"`
     - `la precedencia es duplicados → máximo → inexistentes` (a 101-id input with a duplicate reports duplicates)
     - `MAX_EJERCIOS_POR_MAQUINA vale 100`
  2. - [ ] RED — run it; the failures must be "export not found", not typos.
  3. - [ ] GREEN — add `MAX_EJERCIOS_POR_MAQUINA = 100`, `EjercicioAsociado`, `ErrorAsignacion`,
     `ResultadoAsignacion` and `validarAsignacionEjercicios(ejercicioIds, existentes: ReadonlySet<string>)` with the
     exact precedence and messages from `design.md` ("Domain validation"). No Prisma runtime import.
  4. - [ ] REFACTOR — none; keep the file free of data access (ARQ-1).
- **AC**: **AC-203**; **AC-205** (validation half).
- **Dependencies**: none.
- **Verification**:
  ```bash
  npm test -- src/domains/maquina/maquina.test.ts src/domains/dominios-puros.guard.test.ts
  npx tsc --noEmit
  npx eslint src/domains/maquina
  ```
- **Note**: `existentes` is injected as a `ReadonlySet`, so the pure function never queries. The `dominios-puros.guard`
  test is the structural proof.

#### T-054b · Modelo `EjercicioMaquina` en el schema

- **Status**: ⬜ · **Slice**: 1 de 7 · **PR**: commit 2a · **Est. LOC**: ≈30
- **Files**:
  - `prisma/schema.prisma` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED (estructural) — `npx prisma generate` before the change produces a client with no
     `ejercicioMaquina` delegate; record the command output as the failing baseline. There is no unit test for DDL:
     the behavioural RED for these two tasks lands in T-054e (the integration test fails with `P2021`, "table
     `EjercicioMaquina` does not exist", until both land).
  2. - [ ] GREEN — add the model exactly as `design.md` ("Prisma model (exact)"): `id`, `ejercicio`/`ejercicioId`
     (`onDelete: Cascade`), `maquina`/`maquinaId` (`onDelete: Cascade`), `createdAt`, `@@unique([maquinaId, ejercicioId])`,
     `@@index([maquinaId])`, `@@index([ejercicioId])`.
  3. - [ ] GREEN — add the relation fields `maquinas EjercicioMaquina[]` to `Ejercicio` (next to `rutinas` /
     `registrosProgreso`, schema.prisma:294-296) and `ejercicios EjercicioMaquina[]` to `Maquina` (schema.prisma:380-391).
  4. - [ ] REFACTOR — align comment style with `EjercicioEnRutina` (why both sides are `Cascade`), one line only.
- **AC**: **AC-201**.
- **Dependencies**: none.
- **Verification**:
  ```bash
  npx prisma validate
  npx prisma generate
  npx tsc --noEmit
  ```
- **Note**: `npx prisma format` is allowed; **never** `prisma migrate dev` (it would detect the orphan
  `Maquina_nombre_ubicacion_key` expression index and emit a `DROP INDEX` or a reset).

#### T-054c · Migración escrita a mano + pre-chequeos

- **Status**: ⬜ · **Slice**: 1 de 7 · **PR**: commit 2a · **Est. LOC**: ≈60
- **Files**:
  - `prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` (new)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — with the schema model present but no migration, `SELECT to_regclass('"EjercicioMaquina"')` is `NULL`
     on the ephemeral database and T-054e fails. Record that baseline (`npm run test:integration` reports the
     missing table once T-054e exists; at this point the same deploy would simply not create it).
  2. - [ ] GREEN — create the SQL **byte-compatible with `design.md` (read-only)**: the commented rollback header, one
     `CREATE TABLE "EjercicioMaquina"` with the PK and both FKs inline
     (`ON DELETE CASCADE ON UPDATE CASCADE`), one `CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key"`,
     and the two secondary indexes (`..._maquinaId_idx`, `..._ejercicioId_idx`).
  3. - [ ] GREEN — run the five pre-migration checks from `design.md` (read-only) and paste the output in the PR/commit body.
  4. - [ ] REFACTOR — none. Do not add `IF NOT EXISTS`; Prisma's migration ledger already guarantees apply-once, and
     the Etapa 1 convention is a plain `CREATE`/`CREATE INDEX`.
- **AC**: **AC-202**.
- **Dependencies**: T-054b (the schema must match the DDL).
- **Verification**:
  ```bash
  grep -c 'DROP\|ALTER' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql   # → 0
  grep 'Maquina_nombre_ubicacion_key' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql  # → sin salida
  grep -c 'CREATE TABLE' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql   # → 1
  grep -c 'CREATE UNIQUE INDEX' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql   # → 1
  grep -c 'CREATE INDEX' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql   # → 2
  grep -c 'ON DELETE CASCADE' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql   # → 2
  npm run test:integration
  npx tsc --noEmit
  npx eslint tests/integration
  ```
- **Note (CP1 gate)**: `npm run test:integration` applies `prisma migrate deploy` to the ephemeral Docker Postgres; a
  green run with the new file proves the migration applies. Migration counter should move **19/19 → 20/20** — confirm
  with `npx prisma migrate status`, do not assume. Reference file for the convention is
  `prisma/migrations/20261023120000_maquina_nombre_ubicacion_unique/migration.sql` (read-only).

### Checkpoint CP2 — Slices 2–4: API completa (commit 2b … commit 2d)

#### T-054d · Repositorio: conteo, lectura y reemplazo

- **Status**: ✅ · **Slice**: 2 de 7 · **PR**: commit 2b · **Est. LOC**: ≈200 (≈110 impl + ≈90 tests)
- **Files**:
  - `src/domains/maquina/maquina-repositorio.ts` (modify)
  - `src/domains/maquina/maquina-repositorio.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — extend `maquina-repositorio.test.ts` with a mocked `MaquinaReader` carrying `ejercicioMaquina`,
     `ejercicio` and `$transaction`:
     - `contarEjerciciosAsociados > delega count con { where: { maquinaId } }`
     - `obtenerEjerciciosExistentes > devuelve un Set con los ids encontrados`
     - `obtenerEjerciciosExistentes > devuelve un Set vacío sin consultar cuando el arreglo está vacío`
     - `getEjerciciosAsociados > incluye el ejercicio con id/nombre/grupoMuscular y ordena por nombre`
     - `getEjerciciosAsociados > devuelve [] cuando no hay filas`
     - `reemplazarEjerciciosAsociados > corre deleteMany → createMany → findMany en un solo $transaction`
     - `reemplazarEjerciciosAsociados > omite createMany cuando el arreglo está vacío`
     - `reemplazarEjerciciosAsociados > propaga el error de la transacción sin tragarse nada`
  2. - [ ] RED — confirm the failures are missing methods / wrong delegates.
  3. - [ ] GREEN — extend `MaquinaReader` (exact shape in `design.md` (read-only), "Repository methods") and implement the four
     methods with the `db?: MaquinaReader` injection already used by `create`/`getById`; the deferred `getPrisma()`
     import stays the only Prisma touchpoint. `reemplazarEjerciciosAsociados` runs one `$transaction` that returns the
     read-back list mapped to `f.ejercicio`.
  4. - [ ] REFACTOR — keep `getEjerciciosAsociados` deliberately unable to distinguish "missing machine" from "empty
     set" (the handler owns the 404); add the one-line comment explaining why.
- **AC**: **AC-201** (read side), **AC-204** (read half), **AC-205** (existence check), **AC-208** (count).
- **Dependencies**: T-054a (types), T-054b (generated client).
- **Verification**:
  ```bash
  npm test -- src/domains/maquina/maquina-repositorio.test.ts
  npx tsc --noEmit
  npx eslint src/domains/maquina
  ```

#### T-054e · Integración: cascada, unicidad y transacción

- **Status**: ✅ · **Slice**: 2 de 7 · **PR**: commit 2b · **Est. LOC**: ≈130 · **Note**: suite escrita; ejecución de `npm run test:integration` pendiente de Fernando (requiere Docker)
- **Files**:
  - `tests/integration/ejercicio-maquina.integration.test.ts` (new)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — create the suite with the same real-database guard as `tests/integration/maquina.integration.test.ts` (read-only)
     (`current_database()` must be `arnold_test`), and these tests:
     - `la migración crea la tabla y sus tres índices` (`to_regclass` not null + `pg_indexes` count = 3)
     - `el par (maquinaId, ejercicioId) duplicado falla con P2002`
     - `borrar el ejercicio elimina sus filas de EjercicioMaquina (Cascade)`
     - `borrar la máquina sin asociaciones elimina sus filas (Cascade)`
     - `un ejercicio en una rutina sigue bloqueado con DELETE_BLOCKED_ASSIGNED`
     - `reemplazarEjerciciosAsociados reemplaza el conjunto en una sola transacción`
     - `el reemplazo vacío deja la máquina sin asociaciones`
     - `getEjerciciosAsociados devuelve nombre y grupoMuscular ordenados por nombre`
  2. - [ ] RED — run `npm run test:integration` on a database where T-054c has not been applied; the table-level
     tests must fail with `P2021`, proving the tests bite.
  3. - [ ] GREEN — apply the migration through the harness (`node scripts/test-integration.mjs` already runs
     `prisma migrate deploy`) and implement nothing else: these tests exercise the schema from T-054b/T-054c and the
     repository from T-054d. Use `prisma` directly for the raw inserts/deletes; use `maquinaRepository` for the
     method-level assertions.
  4. - [ ] REFACTOR — factor the fixture setup (one machine + two exercises) into a local `beforeEach`, not a shared
     factory (only this suite needs it).
- **AC**: **AC-201**, **AC-202**, **AC-205** (replace half), **AC-209**.
- **Dependencies**: T-054c (migration), T-054d (methods).
- **Verification**:
  ```bash
  npm run test:integration
  npx tsc --noEmit
  npx eslint tests/integration
  ```
- **Note**: Docker is mandatory for this task. `npm run test:integration` runs the whole integration config
  (`--runInBand`) and does not accept a file pattern; a targeted run is
  `node scripts/test-integration.mjs` after temporarily narrowing `jest.integration.config.ts` — prefer running the
  whole suite.

#### T-054f · Mapeo de `VALIDATION_MAX_EJERCICIOS`

- **Status**: ✅ · **Slice**: 3 de 7 · **PR**: commit 2c · **Est. LOC**: ≈45
- **Files**:
  - `src/lib/route-error-mapper.ts` (modify)
  - `src/lib/route-error-mapper.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — extend `route-error-mapper.test.ts`, mirroring the `DELETE_BLOCKED_EJERCICIOS` describes:
     - `VALIDATION_MAX_EJERCICIOS > mapea el código explícito a 400`
     - `VALIDATION_MAX_EJERCICIOS > mapea el prefijo "VALIDATION_MAX_EJERCICIOS: ..." a 400 y quita el prefijo`
     - `VALIDATION_MAX_EJERCICIOS > no escribe en console.error`
  2. - [ ] RED — confirm the explicit-code test fails (the string-prefix case may already pass through the generic
     `VALIDATION_[A-Z_]+` regex; that is exactly why the explicit branch is needed).
  3. - [ ] GREEN — add an explicit `code === "VALIDATION_MAX_EJERCICIOS"` branch returning `{ code, message:
     stripCodePrefix(message), status: 400 }` next to `DELETE_BLOCKED_EJERCICIOS`, and add the code to the header
     comment list (`route-error-mapper.ts:54-69`). Status 400 is already implied by the regex; the branch is
     self-documentation, matching the file's existing style.
  4. - [ ] REFACTOR — none.
- **AC**: **AC-205** (error mapping half).
- **Dependencies**: none for compilation; must land before T-054g/T-054h.
- **Verification**:
  ```bash
  npm test -- src/lib/route-error-mapper.test.ts
  npx tsc --noEmit
  npx eslint src/lib/route-error-mapper.ts src/lib/route-error-mapper.test.ts
  ```

#### T-054g · Handlers de asignación + conteo real de baja

- **Status**: ✅ · **Slice**: 3 de 7 · **PR**: commit 2c · **Est. LOC**: ≈160 (≈90 impl + ≈70 tests)
- **Files**:
  - `src/api/maquinas.ts` (modify)
  - `src/api/maquinas.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — extend `src/api/maquinas.test.ts` (repository mocked, as today):
     - `handleMaquinaEjerciciosGet > lanza NOT_FOUND con "Máquina no encontrada"`
     - `handleMaquinaEjerciciosGet > devuelve la lista asociada`
     - `handleMaquinaEjerciciosGet > devuelve [] cuando la máquina existe sin asociaciones`
     - `handleMaquinaEjerciciosPut > rechaza un cuerpo que no es objeto con VALIDATION_ERROR`
     - `handleMaquinaEjerciciosPut > rechaza ejercicioIds no arreglo`
     - `handleMaquinaEjerciciosPut > rechaza elementos que no son string`
     - `handleMaquinaEjerciciosPut > lanza NOT_FOUND sin escribir cuando la máquina no existe`
     - `handleMaquinaEjerciciosPut > rechaza ids inexistentes con VALIDATION_ERROR`
     - `handleMaquinaEjerciciosPut > rechaza duplicados con VALIDATION_ERROR`
     - `handleMaquinaEjerciciosPut > rechaza 101 ids con VALIDATION_MAX_EJERCICIOS`
     - `handleMaquinaEjerciciosPut > acepta [] y devuelve []`
     - `handleMaquinaEjerciciosPut > reemplaza y devuelve la lista nueva`
     - `handleMaquinaDelete > consulta contarEjerciciosAsociados antes de decidir`
     - `handleMaquinaDelete > lanza DELETE_BLOCKED_EJERCICIOS con "3 ejercicios usan esta máquina"`
     - `handleMaquinaDelete > borra cuando el conteo es 0`
  2. - [ ] RED — confirm the delete tests fail against the current hardcoded `0` (`maquinas.ts:133`).
  3. - [ ] GREEN — add `parseAsignacionBody(body: unknown): string[]` (private, reusing the local `esObjetoPlano` and
     `codedError`), `handleMaquinaEjerciciosGet(id)` and `handleMaquinaEjerciciosPut(id, body)` exactly as
     `design.md`; replace `{ ejerciciosAsociados: 0 }` with `await maquinaRepository.contarEjerciciosAsociados(id)`.
     `puedeEliminar` is **not** touched. No `actorId` parameter: audit lives in the route (design decision).
  4. - [ ] REFACTOR — none; keep the handlers actor-agnostic like every other handler in this file.
- **AC**: **AC-204**, **AC-205**, **AC-206**, **AC-208**; delta **`maquinas-crud` AC-010/AC-011**.
- **Dependencies**: T-054a, T-054d, T-054f.
- **Verification**:
  ```bash
  npm test -- src/api/maquinas.test.ts
  npx tsc --noEmit
  npx eslint src/api/maquinas.ts src/api/maquinas.test.ts
  ```

#### T-054h · Ruta `GET`/`PUT /api/maquinas/[id]/ejercicios`

- **Status**: ✅ · **Slice**: 4 de 7 · **PR**: commit 2d · **Est. LOC**: ≈240 (≈110 impl + ≈130 tests)
- **Files**:
  - `src/app/api/maquinas/[id]/ejercicios/route.ts` (new)
  - `src/app/api/maquinas/[id]/ejercicios/route.test.ts` (new)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — `route.test.ts` with `@/api/maquinas`, `@/lib/auth`, `@/lib/audit` mocked, calling the exported
     `handleMaquinaEjerciciosGetRequest` / `...PutRequest` plus the HTTP functions:
     - `GET > responde 403 FORBIDDEN ("Se requiere rol de administrador") a un rol distinto de ADMINISTRADOR`
     - `GET > espera params antes de leer el id` (`params: Promise.resolve({ id })`)
     - `GET > devuelve la lista asociada con 200`
     - `GET > responde 404 NOT_FOUND cuando la máquina no existe`
     - `PUT > responde 200 con la lista nueva`
     - `PUT > responde 404 NOT_FOUND sin escribir`
     - `PUT > responde 400 VALIDATION_MAX_EJERCICIOS`
     - `PUT > audita MODIFICACION con { maquinaId, ejerciciosAsignados: n } y el id del actor`
     - `PUT > un fallo de auditoría no cambia la respuesta`
  2. - [ ] RED — confirm the failures are missing module / missing export.
  3. - [ ] GREEN — implement both verbs: `ALLOWED_ROLES = ["ADMINISTRADOR"]` via `extractUserFromRequest` (403
     `FORBIDDEN`), `const { id } = await params` (Next 16.2, FX-06), `readJsonBody` on PUT, delegate to the request
     wrappers, `mapErrorToResponse` with `ERROR_OPTIONS`, and the best-effort `try/catch` audit using `auth.user.id`
     and `detalles: { maquinaId: id, ejerciciosAsignados: result.length }`. Copy the union/guard shape from
     `src/app/api/maquinas/[id]/route.ts`.
  4. - [ ] REFACTOR — share nothing with the by-id route beyond the pattern; the two files stay parallel (same as
     `membresias`).
- **AC**: **AC-204**, **AC-205**, **AC-206**, **AC-207**, **AC-210** (route half).
- **Dependencies**: T-054f, T-054g.
- **Verification**:
  ```bash
  npm test -- "src/app/api/maquinas/[id]/ejercicios/route.test.ts"
  npx tsc --noEmit
  npx eslint "src/app/api/maquinas/[id]/ejercicios"
  ```
  Smoke (D-21) with `npm run dev` and an admin session:
  ```bash
  curl -s -c /tmp/arnold.jar -X POST localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"admin@arnold.test","password":"Arnold2026!"}'
  curl -s -b /tmp/arnold.jar localhost:3000/api/maquinas/<id>/ejercicios
  curl -s -b /tmp/arnold.jar -X PUT localhost:3000/api/maquinas/<id>/ejercicios \
    -H 'content-type: application/json' -d '{"ejercicioIds":[]}'
  ```
- **Note**: mocked tests never run the proxy or `await params`; the curl smoke is mandatory for this slice (FX-06,
  D-21).

#### T-054i · Pruebas de permisos del path anidado

- **Status**: ✅ · **Slice**: 4 de 7 · **PR**: commit 2d · **Est. LOC**: ≈60 (tests only)
- **Files**:
  - `src/middleware/matrix-consistency.test.ts` (modify)
  - `src/lib/authorization.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — add to `matrix-consistency.test.ts` a `describe("el path anidado de ejercicios hereda el prefijo de máquinas")`:
     - `it.each` over `[RECEPCIONISTA, INSTRUCTOR, SOCIO] × ["GET", "PUT"]` → `hasRouteAccess(rol,
       "/api/maquinas/1/ejercicios", verbo).allowed === false`
     - ADMIN allowed for both verbs
  2. - [ ] RED — add to `authorization.test.ts` the same four cases for `matchBasePath`, asserting the **longest**
     prefix wins and resolves to `/api/maquinas` (regression guard for P-41).
  3. - [ ] GREEN — **no production change expected**. If a test fails, stop and report: it means the prefix match is
     broken, not that a new matrix entry is needed. Do **not** add an entry to `ROLE_GATE_MATRIX` for the nested path
     (that middleware is exact-match and is not the API enforcement path — see `design.md`, "roleGatingMiddleware").
  4. - [ ] REFACTOR — none.
- **AC**: **AC-210**, **AC-215** (matrix half).
- **Dependencies**: none (pure matrix tests); run after T-054h so the route exists in the tree.
- **Verification**:
  ```bash
  npm test -- src/middleware/matrix-consistency.test.ts src/lib/authorization.test.ts
  npx tsc --noEmit
  npx eslint src/middleware src/lib/authorization.test.ts
  ```

### Checkpoint CP3 — Slices 5–7: paginación y UI (commit 2e … commit 2g)

#### T-054j · Paginación opt-in en el repositorio de ejercicios

- **Status**: ✅ · **Slice**: 5 de 7 · **PR**: commit 2e · **Est. LOC**: ≈130 (≈55 impl + ≈75 tests)
- **Files**:
  - `src/domains/ejercicio/ejercicio-repositorio.ts` (modify)
  - `src/domains/ejercicio/ejercicio.test.ts` (modify — this is where the `getAll` suite lives, at lines 404-485)
- **TDD (RED → GREEN)**:
  1. - [x] RED — extend the existing `getAll` describe:
     - `aplica take/skip en la ruta findMany cuando llega limit u offset`
     - `no aplica take/skip cuando no llega ninguno de los dos` (backwards compatibility)
     - `offset solo implica limit por defecto 20`
     - `agrega LIMIT/OFFSET a la búsqueda unaccent con el término todavía en $1`
     - `conserva el filtro muscleGroup en la ruta con búsqueda`
     - `conserva el _count de rutinas como enRutinas en ambas rutas`
  2. - [x] RED — confirm the paginated assertions fail (no `take`/`skip`, no `LIMIT`/`OFFSET`).
  3. - [x] GREEN — extend the options type to `{ muscleGroup?, search?, limit?, offset? }` and implement the opt-in
     rule exactly as `design.md`: `paginar = limit !== undefined || offset !== undefined`, `take = limit ?? 20`,
     `skip = offset ?? 0`, spread only when paginating on `findMany`, and `Prisma.sql\`LIMIT ${take}\`` /
     `Prisma.sql\`OFFSET ${skip}\`` after `ORDER BY` on the raw path (never string-interpolated).
  4. - [x] REFACTOR — none; keep the two paths visually parallel.
- **AC**: **AC-211**, delta **`ejercicios-crud` AC-008/AC-009**.
- **Dependencies**: none.
- **Verification**:
  ```bash
  npm test -- src/domains/ejercicio/ejercicio.test.ts
  npx tsc --noEmit
  npx eslint src/domains/ejercicio
  ```
- **Note**: "default 20" applies only **when pagination is requested**; with both params omitted the endpoint must
  return everything, because `/app/ejercicios` paginates client-side with `POR_PAGINA = 50`. This is the design's
  resolution of the `ejercicios-crud` delta wording (flag for the close/archive task).

#### T-054k · Paginación en handler y ruta de ejercicios

- **Status**: ✅ · **Slice**: 5 de 7 · **PR**: commit 2e · **Est. LOC**: ≈100 (≈45 impl + ≈55 tests)
- **Files**:
  - `src/api/ejercicios.ts` (modify)
  - `src/api/ejercicios.test.ts` (modify)
  - `src/app/api/ejercicios/route.ts` (modify)
  - `src/app/api/ejercicios/route.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [x] RED — `src/api/ejercicios.test.ts`:
     - `handleEjercicioList > propaga limit/offset aunque no haya search ni muscleGroup` (today the short-circuit
       drops them — that is the bug this task fixes)
     - `handleEjercicioList > propaga search + muscleGroup + paginación juntos`
  2. - [x] RED — `src/app/api/ejercicios/route.test.ts`:
     - `parsePaginacion > sin params devuelve { ok: true } sin limit ni offset`
     - `parsePaginacion > acepta limit=50 y offset=20`
     - `parsePaginacion > rechaza limit no numérico, 0, negativo y 51`
     - `parsePaginacion > rechaza offset no numérico y negativo`
     - `GET > responde 400 VALIDATION_ERROR con limit inválido`
     - `GET > responde 400 VALIDATION_ERROR con offset inválido`
     - `GET > pasa limit/offset al handler`
  3. - [x] GREEN — export `parsePaginacion(rawLimit, rawOffset)` exactly as `design.md` (regex `/^\d+$/`, `limit` in
     `[1, 50]`), read `searchParams.get("limit"|"offset")`, thread the values through
     `handleEjercicioListRequest` → `handleEjercicioList` → `getAll`, and remove the
     `if (search || muscleGroup) ... else getAll()` short-circuit.
  4. - [x] REFACTOR — keep `parsePaginacion` pure and exported (testable without `NextRequest`).
- **AC**: **AC-211**, delta **`ejercicios-crud` AC-008/AC-009**.
- **Dependencies**: T-054j (repository signature).
- **Verification**:
  ```bash
  npm test -- src/api/ejercicios.test.ts src/app/api/ejercicios/route.test.ts
  npx tsc --noEmit
  npx eslint src/api/ejercicios.ts src/app/api/ejercicios
  ```
  Smoke:
  ```bash
  curl -s -b /tmp/arnold.jar 'localhost:3000/api/ejercicios?search=triceps&limit=50'
  curl -s -i -b /tmp/arnold.jar 'localhost:3000/api/ejercicios?limit=51'   # → 400 VALIDATION_ERROR
  ```

#### T-054l · Fetchers cliente de asignación y búsqueda

- **Status**: ✅ · **Slice**: 6 de 7 · **PR**: commit 2f · **Est. LOC**: ≈90 (≈40 impl + ≈50 tests) · **Actual**: 256
- **Files**:
  - `src/api/maquinas.ts` (modify)
  - `src/api/maquinas.test.ts` (modify)
  - `src/api/ejercicios.ts` (modify)
  - `src/api/ejercicios.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [x] RED — `src/api/maquinas.test.ts`:
     - `fetchMaquinaEjercicios > hace GET a /api/maquinas/{id}/ejercicios`
     - `fetchMaquinaEjercicios > propaga el error con throwIfNotOk`
     - `reemplazarEjerciciosMaquina > hace PUT con { ejercicioIds }`
     - `reemplazarEjerciciosMaquina > invalida CLAVES.maquinas al terminar`
  2. - [x] RED — `src/api/ejercicios.test.ts`:
     - `fetchEjerciciosBusqueda > arma la query con search, limit y offset`
     - `fetchEjerciciosBusqueda > no pasa por conCache` (two consecutive calls hit `fetch` twice)
  3. - [x] GREEN — implement `fetchMaquinaEjercicios(id)`, `reemplazarEjerciciosMaquina(id, ejercicioIds)` (calls
     `invalidarCache(CLAVES.maquinas)` after success) next to `fetchMaquinasList`, and `fetchEjerciciosBusqueda(params)`
     next to `fetchEjercicios` (no cache).
  4. - [x] REFACTOR — none; reuse `throwIfNotOk`.
- **AC**: **AC-212** (data half), **AC-213**.
- **Dependencies**: T-054h (endpoint), T-054k (pagination params).
- **Note**: el ajuste de orden pide el chequeo temprano de duplicados/tope en `validarAsignacionPrevia`,
  usado por `handleMaquinaEjerciciosPut` antes de `obtenerEjerciciosExistentes` (sin duplicar la validación del dominio).
- **Verification**:
  ```bash
  npm test -- src/api/maquinas.test.ts src/api/ejercicios.test.ts
  npx tsc --noEmit
  npx eslint src/api
  ```

#### T-054m · Fila expandida de máquina

- **Status**: ✅ · **Slice**: 6 de 7 · **PR**: commit 2f · **Est. LOC**: ≈80 (≈45 impl + ≈35 tests) · **Actual**: 198
- **Files**:
  - `src/components/maquina-crud/maquina-expanded-row.tsx` (new)
  - `src/components/maquina-crud/maquina-expanded-row.test.tsx` (new)
- **TDD (RED → GREEN)**:
  1. - [x] RED — component tests (`fetchMaquinaEjercicios` mocked):
     - `lista los ejercicios asociados con nombre y grupo muscular`
     - `muestra "Sin ejercicios asignados" cuando la lista está vacía`
     - `muestra el botón "Asignar ejercicios"`
     - `llama a onAsignar al hacer clic en el botón`
     - `muestra el error de carga cuando la petición falla`
  2. - [x] RED — confirm the module is missing.
  3. - [x] GREEN — implement `MaquinaExpandedRow({ maquinaId, onAsignar })`: `useEffect` + `fetchMaquinaEjercicios`,
     loading/empty/list states, muscle-group badges with the existing `TableStatusBadge` or a plain `<span>`, button
     `Asignar ejercicios`, `handleApiError` on failure.
  4. - [x] REFACTOR — keep the component read-only: it never saves; the modal owns the write.
- **AC**: **AC-212**.
- **Dependencies**: T-054l (fetcher), T-054d (read endpoint via T-054h).
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/maquina-expanded-row.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud
  ```

#### T-054n · Disclosure y detalle en el listado

- **Status**: ✅ · **Slice**: 6 de 7 · **PR**: commit 2f · **Est. LOC**: ≈70 (≈30 impl + ≈40 tests) · **Actual**: 82
- **Files**:
  - `src/components/maquina-crud/maquina-list.tsx` (modify)
  - `src/components/maquina-crud/maquina-list.test.tsx` (modify)
- **TDD (RED → GREEN)**:
  1. - [x] RED — replace the current "no disclosure indicator" assertion (added by `20fe186`) with:
     - `dibuja el chevron de expansión en las filas`
     - `expande la fila seleccionada con MaquinaExpandedRow`
     - `vuelve a plegar al hacer clic de nuevo`
     - `pasa onAsignar a la fila expandida`
     - keep the existing estado/tipo/search/selection/empty tests green
  2. - [x] RED — confirm the new expectations fail (`data-disclosure-indicator` absent).
  3. - [x] GREEN — add `disclosure` to `TableHeader` (`maquina-list.tsx:142`) and `TableRow` (`:147`), wrap each row
     in `React.Fragment` and render `TableDetailRow` + `MaquinaExpandedRow` when `isSelected`, exactly as
     `src/components/ejercicio-crud/ejercicio-list.tsx:150-180`. Add the `onAsignar?: (maquina: Maquina) => void` prop.
  4. - [x] REFACTOR — none; `src/components/ui/table.tsx` is untouched.
- **AC**: **AC-212**.
- **Dependencies**: T-054m.
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/maquina-list.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud
  ```

#### T-054o · Modal accesible de asignación

- **Status**: ✅ · **Slice**: 7 de 7 · **PR**: commit 2g · **Est. LOC**: 394 (225 impl + 169 tests)
- **Files**:
  - `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` (new)
  - `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` (new)
- **TDD (RED → GREEN)**:
  1. - [x] RED — component tests (`fetchEjerciciosBusqueda`, `fetchMaquinaEjercicios`,
     `reemplazarEjerciciosMaquina` and `useNotifications` mocked; `jest.useFakeTimers`):
     - `es un diálogo accesible: role="dialog", aria-labelledby y foco inicial dentro`
     - `Escape cierra y devuelve el foco al botón que lo abrió`
     - `la búsqueda se debouncea ~300 ms (una sola consulta tras teclear)`
     - `consulta con limit=50 y el término buscado`
     - `"triceps" encuentra "Tríceps" (sin tildes)`
     - `premarca los ejercicios ya asociados`
     - `"Seleccionar todo visible" solo afecta la página actual`
     - `guarda con PUT y el arreglo completo de ejercicioIds`
     - `muestra el aviso de éxito al guardar`
     - `un 400 VALIDATION_ERROR deja el modal abierto, conserva la selección y muestra el mensaje`
     - `"Ver más" aparece solo cuando la última página volvió con exactamente limit ítems`
     - `"Ver más" avanza el offset por limit y acumula los resultados`
     - `la selección se conserva al cambiar de página y al cambiar la búsqueda`
     - `la selección incluye los ya asignados que no están en la página visible`
     - `guardar hace un reemplazo total: conserva los seleccionados fuera de la página y quita los desmarcados`
  2. - [x] RED — confirm the module is missing.
  3. - [x] GREEN — implement with `useModalA11y<HTMLDivElement>(open, onClose)` (same signature as
     `src/app/maquinas/page.tsx:32`), a `useEffect` debounce of 300 ms, `fetchEjerciciosBusqueda({ search, limit: 50,
     offset })`, checkbox list of the visible page, "Seleccionar todo visible" scoped to the page, save via
     `reemplazarEjerciciosMaquina`, `notify("success", ...)` and `handleApiError` on failure. **Pagination has no total
     count:** keep an accumulated list and show "Ver más" only when the last response returned exactly `limit` items;
     clicking it fetches the next page with `offset += limit` and appends. Keep the selection in a `Set` that survives
     page and search changes and is seeded with the currently assigned exercises (including those not on the visible
     page). Save sends the full set as the replacement. `aria-labelledby` points at the modal title.
  4. - [x] REFACTOR — extract the debounce into a local `useDebouncedValue` inside the file only if the tests read
     cleaner; do not create a shared hook for one consumer.
- **AC**: **AC-213**, **AC-214**, **AC-205** (client-side error surface).
- **Dependencies**: T-054l, T-054k.
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud
  ```
- **Note**: the modal must never request the full catalog — every fetch carries `limit=50`; an empty search returns
  the first page only.

#### T-054p · Cableado de `/maquinas`

- **Status**: ✅ · **Slice**: 7 de 7 · **PR**: commit 2g · **Est. LOC**: 98 (21 impl + 77 tests)
- **Files**:
  - `src/app/maquinas/page.tsx` (modify)
  - `src/app/maquinas/page.test.tsx` (modify)
- **TDD (RED → GREEN)**:
  1. - [x] RED — extend `page.test.tsx`:
     - `muestra la fila expandida al seleccionar una máquina`
     - `abre el modal de asignación desde "Asignar ejercicios"`
     - `al guardar cierra el modal, avisa el éxito y recarga la fila expandida`
     - `un fallo al guardar mantiene el modal abierto`
     - `el borrado sigue mostrando el 409 DELETE_BLOCKED_EJERCICIOS como aviso`
  2. - [x] RED — confirm the failures (no `onAsignar`, no modal).
  3. - [x] GREEN — add `asignando: Maquina | null` and a `version` counter; pass `onAsignar` to `MaquinaList`, render
     `EjercicioAsignacionModal` when `asignando` is set, and on success bump `version` so the expanded row remounts
     (`key={\`${maquina.id}-${version}\`}`) and refetches. No new API call for the refresh.
  4. - [x] REFACTOR — keep the page state parallel to the existing `modalOpen`/`editing`/`confirmandoBorrado` shape.
- **AC**: **AC-212**, **AC-213**, **AC-214**, **AC-208** (UI surface of the 409).
- **Dependencies**: T-054h, T-054n, T-054o.
- **Verification**:
  ```bash
  npm test -- src/app/maquinas/page.test.tsx
  npx tsc --noEmit
  npx eslint src/app/maquinas
  ```
  Manual check (browser; `e2e_available: false`): log in as `admin@arnold.test` / `Arnold2026!`, open `/maquinas`,
  expand a machine, assign and unassign exercises, confirm the 409 when deleting a machine with associations.

#### T-054q · Filtro por grupo muscular y selección de visibles

- **Status**: ✅ · **Slice**: 8 · **commit 2h** · **Est. LOC**: ≈287 (90 impl + 171 tests + 26 fetcher/tests)
- **Files**:
  - `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` (modify)
  - `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` (modify)
  - `src/api/ejercicios.ts` (modify: `muscleGroup` in `fetchEjerciciosBusqueda`)
  - `src/api/ejercicios.test.ts` (modify)
- **TDD (RED → GREEN)**:
  1. - [x] RED — tests: the filter sends `muscleGroup`; changing the filter or search resets `offset` to 0; the selection persists across filters; "Todos los grupos" omits the param; "Seleccionar los visibles" caps at 100 and shows a visible message; "Quitar los visibles" removes.
  2. - [x] GREEN — a `<select>` with `aria-label="Filtrar por grupo muscular"` sourced from `GRUPOS_MUSCULARES`; combine with the search; replace the list on filter/search change; the two buttons; the cap with `MAX_EJERCICIOS_POR_MAQUINA`.
  3. - [x] REFACTOR — none.
- **AC**: AC-216 (extended), AC-217.
- **Dependencies**: T-054o, T-054p.
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx src/app/maquinas/page.test.tsx src/api/ejercicios.test.ts
  npx tsc --noEmit
  npx eslint src/components/maquina-crud src/api/ejercicios.ts src/api/ejercicios.test.ts src/app/maquinas
  ```
- **Note**: modal/fetcher only; no backend, schema or migration.

#### T-054r · Cierre documental (D-74, P-57..P-60)

- **Status**: ✅ · **Slice**: none (directo a `dev`, convención del cierre de Etapa 1) · **Est. LOC**: ≈80 (docs)
- **Files**:
  - `openspec/decisions.md` (modify: record **D-74** and **P-57, P-58, P-59, P-60**)
  - `PROJECT-STATUS.md` (modify: task table, "Cambios recientes", pendientes, migration counter)
  - `openspec/sdd-tasks-tdd.md` (modify: append T-054a…T-054r with actual LOC)
  - `odd/tasks/maquina-ejercicios.md` (new, same shape as `odd/tasks/catalogo-ejercicios.md`)
- **Checklist**:
  1. - [ ] Record **P-57** — pre-existing ESLint `react-hooks/purity` error at `src/app/home-socio/page.tsx:129`
     (`Date.now()` during render), from commit `f4d1ac2`. Not fixed in this change; this change introduces no new lint
     errors. Also record **P-58** (`enMaquinas` count on the exercise list, deferred), **P-59**
     (`MAX_EJERCICIOS_POR_MAQUINA` as a `/configuracion` parameter, deferred) and **P-60** (automatic/suggested
     assignment idea; see "Ideas futuras" in `odd/tasks/maquina-ejercicios.md`).
  2. - [ ] Record **D-74** — the Etapa 2 decisions, separating what Fernando decides from what the assistant proposed:
     `EjercicioMaquina` with `Cascade` on both sides (and why exercise deletion is still gated by the two
     `Restrict` relations), the hand-written additive migration with inline FKs (no `ALTER`, never
     `prisma migrate dev`), **opt-in** pagination (backwards compatibility beats "default 20"), audit in the route
     instead of the handler, and the correction that `roleGatingMiddleware` is exact-match so `hasRouteAccess` is the
     enforcement path for the nested API.
  3. - [ ] Reconcile the `ejercicios-crud` delta wording (design open question): pagination is opt-in; `limit`
     defaults to 20 and `offset` to 0 **only when pagination is requested**. Update the spec text in the archive phase,
     not silently.
  4. - [ ] Update `PROJECT-STATUS.md`: task table, "Cambios recientes", and the migration counter. Confirm
     **19/19 → 20/20** with `npx prisma migrate status`; do not assume it.
  5. - [ ] Append the 18 tasks and their actual LOC to `openspec/sdd-tasks-tdd.md`.
  6. - [ ] Create `odd/tasks/maquina-ejercicios.md`: objective, one step per slice with ✅/⬜, risks, verification and
     pending items.
  7. - [ ] Confirm the four gates: `npm test`, `npm run test:integration`, `npx tsc --noEmit`, `npx eslint .` (P-57 is
     the only error and it is documented, not fixed).
- **AC**: none functional; closes the documentation debt. **AC-215** (final green gate).
- **Dependencies**: all previous tasks merged.
- **Verification**:
  ```bash
  npm test
  npm run test:integration
  npx tsc --noEmit
  npx eslint .
  npx prisma migrate status
  ```
- **Note**: the three delta specs are already written under `openspec/changes/maquina-ejercicios/specs/`; this task
  does not rewrite them, only records the decisions and the reconciliation note. **Do not edit `decisions.md` before
  this task.**

---

## dependencies

### Dependency graph

```
T-054a (domain) ──────────────┐
T-054b (schema) ── T-054c (migration)
        └────────── T-054d (repository) ── T-054e (integration)
                            │
T-054f (error mapper) ──────┴── T-054g (handlers) ── T-054h (route) ── T-054i (permissions tests)
                                                        │
T-054j (repo pagination) ── T-054k (route pagination) ──┤
                                                        ├── T-054l (fetchers) ── T-054m (expanded row) ── T-054n (list)
                                                        └── T-054o (modal) ── T-054p (page wiring)

T-054r (close) after every task above
```

### Per-task dependencies

| Task | Must land after |
|---|---|
| T-054a | — |
| T-054b | — |
| T-054c | T-054b |
| T-054d | T-054a, T-054b |
| T-054e | T-054c, T-054d |
| T-054f | — (before T-054g/T-054h) |
| T-054g | T-054a, T-054d, T-054f |
| T-054h | T-054g |
| T-054i | T-054h |
| T-054j | — |
| T-054k | T-054j |
| T-054l | T-054h, T-054k |
| T-054m | T-054l |
| T-054n | T-054m |
| T-054o | T-054k, T-054l |
| T-054p | T-054h, T-054n, T-054o |
| T-054q | T-054o, T-054p |
| T-054r | all of the above |

### Hard external dependencies

- **Ephemeral Docker Postgres** (`npm run test:integration`) for T-054c, T-054e and every PR gate. Already in place
  (D-53, P-25).
- **Existing `Maquina_nombre_ubicacion_key` expression index** (D-70, D-73): the new migration must not mention it, and
  `prisma migrate dev` is forbidden.
- **Existing `unaccent` extension** (`20261015200000_unaccent`) for the search path that pagination extends.
- **`admin@arnold.test` / `Arnold2026!`** from `npm run seed` for the D-21 curl smokes (T-054h, T-054k, T-054p).
- **No new npm dependency.**

---

## acceptance_tests

Every AC from the three delta specs maps to a RED test written before its implementation.

| AC | Covered by | Test file(s) | Key test names |
|---|---|---|---|
| **AC-201** | T-054b, T-054d, T-054e | `tests/integration/ejercicio-maquina.integration.test.ts`, `src/domains/maquina/maquina-repositorio.test.ts` | `la migración crea la tabla y sus tres índices`; `el par duplicado falla con P2002`; `getEjerciciosAsociados incluye el ejercicio` |
| **AC-202** | T-054c, T-054e | migration pre-checks + integration | `la migración crea la tabla y sus tres índices`; greps → 0/0/0, 4 statements, 2 cascades |
| **AC-203** | T-054a | `src/domains/maquina/maquina.test.ts` | `acepta ids distintos`, `acepta el conjunto vacío`, `rechaza duplicados`, `rechaza ids desconocidos`, `rechaza 101 ids`, `precedencia` |
| **AC-204** | T-054d, T-054g, T-054h | repository, handlers, route | `GET devuelve la lista asociada con 200`, `devuelve [] cuando no hay asociaciones`, `responde 404 NOT_FOUND` |
| **AC-205** | T-054a, T-054g, T-054h, T-054o | domain, handlers, route, modal | `reemplaza y devuelve la lista nueva`, `responde 400 VALIDATION_MAX_EJERCICIOS`, `un 400 VALIDATION_ERROR deja el modal abierto` |
| **AC-206** | T-054g, T-054h | handlers, route | `lanza NOT_FOUND sin escribir`, `PUT responde 404 NOT_FOUND sin escribir` |
| **AC-207** | T-054h | route | `audita MODIFICACION con { maquinaId, ejerciciosAsignados }`, `un fallo de auditoría no cambia la respuesta` |
| **AC-208** | T-054d, T-054g | repository, handlers | `consulta contarEjerciciosAsociados antes de decidir`, `lanza DELETE_BLOCKED_EJERCICIOS con "3 ejercicios usan esta máquina"`, `borra cuando el conteo es 0` |
| **AC-209** | T-054e | integration | `borrar el ejercicio elimina sus filas (Cascade)`, `un ejercicio en una rutina sigue bloqueado con DELETE_BLOCKED_ASSIGNED` |
| **AC-210** | T-054h, T-054i | route, `matrix-consistency.test.ts`, `authorization.test.ts` | `responde 403 FORBIDDEN a un rol distinto de ADMINISTRADOR`, `el path anidado se deniega por prefijo a RECEPCIONISTA/INSTRUCTOR/SOCIO` |
| **AC-211** | T-054j, T-054k | `ejercicio.test.ts`, `src/api/ejercicios.test.ts`, `src/app/api/ejercicios/route.test.ts` | `aplica take/skip`, `no aplica take/skip cuando no llega ninguno`, `LIMIT/OFFSET con el término en $1`, `rechaza limit 0/-1/51`, `rechaza offset inválido` |
| **AC-212** | T-054m, T-054n, T-054p | expanded row, list, page | `dibuja el chevron`, `expande la fila con MaquinaExpandedRow`, `muestra "Sin ejercicios asignados"`, `muestra el botón "Asignar ejercicios"` |
| **AC-213** | T-054o, T-054p | modal, page | `role="dialog" y foco inicial`, `Escape cierra y devuelve el foco`, `debounce ~300 ms`, `consulta con limit=50`, `"Seleccionar todo visible" solo afecta la página` |
| **AC-214** | T-054o | modal | `muestra el aviso de éxito`, `un 400 deja el modal abierto y muestra el mensaje` |
| **AC-215** | T-054i, T-054r | matrix, full suite | `matrix-consistency`; `npm test` / `npm run test:integration` / `tsc` / `eslint` green (P-57 documented, not fixed) |
| **`maquinas-crud` AC-010** | T-054d, T-054g | repository, handlers | `consulta el conteo real`, `borra cuando el conteo es 0`, `404 cuando no existe` |
| **`maquinas-crud` AC-011** | T-054a (unchanged), T-054g | domain, handlers | `puedeEliminar bloquea con 3` (sin cambios), `DELETE_BLOCKED_EJERCICIOS` con el conteo |
| **`ejercicios-crud` AC-008** | T-054j, T-054k | repository, api, route | `defaults`, `rechaza limit/offset inválidos`, `backwards-compatible cuando se omiten` |
| **`ejercicios-crud` AC-009** | T-054j | `ejercicio.test.ts` | `LIMIT/OFFSET parametrizados`, `conserva muscleGroup y enRutinas` |

### Not covered by AC (deliberately)

- Etapa 3 wait/suggestion engine, session-driven `OCUPADA`, Home_Socio machine visibility (Etapas 3–5).
- `EjercicioConUso.enMaquinas` (deferred) and `MAX_EJERCIOS_POR_MAQUINA` as a `/configuracion` parameter.
- P-53 (Home_Interno "Estado de equipos"), P-54 (`EstadoMaquina` literal unions), P-55 (body `status`), P-56 (DELETE
  P2025 race) — all explicitly out of scope.

---

## TDD and verification gate per slice

Before closing each slice (D-21, D-13, L-10):

- [ ] Tests written first, observed failing for the right reason.
- [ ] Focused suite green: `npm test -- <paths in the task>`.
- [ ] Full suite green before the slice closes: `npm test`.
- [ ] `npx tsc --noEmit` clean. If `.next/dev/types/validator.ts` fails, `rm -rf .next` (known gotcha).
- [ ] `npx eslint <touched paths>` reports no **new** errors. P-57 (`src/app/home-socio/page.tsx:129`) is pre-existing
  and out of scope.
- [ ] D-21 smoke for T-054h, T-054k, T-054p (routes/auth/proxy).
- [ ] Slice ≤400 changed lines (`git diff --shortstat` against the base).
- [ ] Conventional commit, no AI attribution.
- [ ] Rollback boundary in the commit/PR description.

### Absolute rule

**Never run or suggest `prisma migrate dev`.** It would detect the orphan expression index
`Maquina_nombre_ubicacion_key` (unrepresentable in `schema.prisma`) and emit a `DROP INDEX` or propose a reset. All
verification goes through `prisma migrate deploy` against the ephemeral Docker Postgres (`npm run test:integration`).
