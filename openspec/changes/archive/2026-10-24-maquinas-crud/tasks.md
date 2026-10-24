# Tasks: Máquinas CRUD (Etapa 1 — asignación dinámica de ejercicios)

> **Numbering note (deviation from the phase request).** The phase brief asked the new tasks to start at
> **T-051**, taking T-050g as the highest task. That is true only inside `openspec/sdd-tasks-tdd.md`. The live
> project records already use **T-051** (`D-71`, músculos por ejercicio, parte 1) and **T-052** (`D-72`, modal de
> ejercicios de la rutina) — see `PROJECT-STATUS.md:178-180` and `openspec/decisions.md:1292-1338`. Reusing those
> IDs would create a collision with documented, completed work. This plan therefore starts at **T-053** and keeps
> the repo's letter-suffix convention (`T-053a` … `T-053n`).

> **Authoritative inputs:** `proposal.md`, `explore.md`, `design.md` (slice boundaries and technical decisions),
> `openspec/changes/maquinas-crud/specs/maquinas-crud/spec.md` (AC-001…AC-015 are the contract; the SDD working
> copy lives under the change and `sdd-archive` promotes it to `openspec/specs/maquinas-crud/spec.md`),
> `openspec/config.yaml`, `openspec/decisions.md` (D-41…D-72), `PROJECT-STATUS.md`, `AGENTS.md` (Next.js 16.2,
> `proxy.ts`, async `params`).

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines — PR 1a as requested | **≈1,803** (additions + deletions, tests included, generated files excluded) |
| Estimated changed lines — PR 1b as requested | **≈1,073** |
| Estimated changed lines — both original PRs | **≈2,876** (plus ≈80 lines of close documentation = **≈2,956**) |
| Estimated changed lines — chained slices | **≈1,805** (1a, 6 slices) + **≈1,113** (1b, 4 slices) = **≈2,918** |
| Largest single slice | **≈360** (`PR-1a-6`, `[id]/route.ts` + tests) — under 400 |
| 400-line budget risk | **High** for the two originally requested PRs (1a is ≈4.5× the budget; 1b ≈2.7×) |
| Chained PRs recommended | **Yes** |
| Suggested split | PR-1a-1 → PR-1a-2 → PR-1a-3 → PR-1a-4 → PR-1a-5 → PR-1a-6 → PR-1b-1 → PR-1b-2 → PR-1b-3 → PR-1b-4 (+ close, no PR) |
| Delivery strategy | ask-on-risk |
| Chain strategy | **decided**: one slice = one commit on `feat/asignacion-dinamica`; no GitHub PRs |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: one slice = one commit on `feat/asignacion-dinamica` (no GitHub PRs)
400-line budget risk: High

### Delivery decision (2026-10-23)

**Option B chosen** (consistent with D-01): the ten slices below are applied as **ten commits on
`feat/asignacion-dinamica`**, not as GitHub PRs. Each slice includes its tests and must leave
`npm test`, `npx tsc --noEmit` and `npx eslint` green before the commit is requested.
Apply pauses at three human checkpoints: (1) domain + migration + Docker Postgres test, (2) full API
with permissions and audit, (3) screen + nav + seed. After that, the close task (T-053n) records P-53,
P-54 and D-73.

### Two options for the human

- **Option A — keep the two PRs (1a + 1b) and request `size:exception`.** Fastest to a reviewable feature, but both
  PRs are far above the 400-line budget and need maintainer approval before merge.
- **Option B — chain into ten slices, each ≤400.** Slower (ten reviews) but every PR is autonomous, test-paired and
  revertible on its own. The 1a/1b boundary is preserved: slices `PR-1a-*` are PR 1a, `PR-1b-*` are PR 1b.

### Suggested Work Units

Base is `feat/asignacion-dinamica` (cut from `dev`); with the chosen Option B, every slice commits on that
branch in order, so the "Base (if chained)" column below is informational only.

| Unit | Goal | Likely PR | Base (if chained) | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|---|
| 1 | Pure machine domain (validation, normalization, `ESTADOS_ASIGNABLES`, `puedeEliminar`) | PR-1a-1 | tracker / `dev` | `npm test -- src/domains/maquina/maquina.test.ts` | N/A — pure Jest, no runtime surface | Revert PR; no data, no schema, no consumers |
| 2 | Repository + uniqueness (pre-check, `P2002`) + migration + Docker integration test | PR-1a-2 | PR-1a-1 | `npm test -- src/domains/maquina/maquina-repositorio.test.ts` + `npm run test:integration` | Ephemeral Docker Postgres (`npm run test:integration`) | Revert PR; `DROP INDEX IF EXISTS "Maquina_nombre_ubicacion_key"` if the migration already ran |
| 3 | Error mapping (`ESTADO_NO_ASIGNABLE`, `DUPLICATE_NOMBRE_UBICACION`, `DELETE_BLOCKED_EJERCICIOS`) + permission entries and denial tests | PR-1a-3 | PR-1a-2 | `npm test -- src/lib/route-error-mapper.test.ts src/middleware/matrix-consistency.test.ts` | N/A — pure matrix/mapper unit tests (proxy not exercised) | Revert PR; permissions revert to deny-by-default |
| 4 | Server handlers + client wrappers (`src/api/maquinas.ts`) | PR-1a-4 | PR-1a-3 | `npm test -- src/api/maquinas.test.ts` | N/A — repository mocked | Revert PR; no route imports it yet |
| 5 | `GET`/`POST /api/maquinas` route | PR-1a-5 | PR-1a-4 | `npm test -- src/app/api/maquinas/route.test.ts` | `npm run dev` + admin login + `curl` (D-21 smoke) | Revert PR; endpoint disappears, no data mutated |
| 6 | `GET`/`PUT`/`DELETE /api/maquinas/[id]` route (async `params`) | PR-1a-6 | PR-1a-5 | `npm test -- src/app/api/maquinas` | `npm run dev` + admin login + `curl` (D-21 smoke) | Revert PR; writes were only reachable through it |
| 7 | `maquina-form` + `estado-badge` components | PR-1b-1 | PR-1a-6 | `npm test -- src/components/maquina-crud/maquina-form.test.tsx src/components/maquina-crud/estado-badge.test.tsx` | N/A — jsdom; browser check is a manual follow-up | Revert PR; no page imports them yet |
| 8 | `maquina-form-panel` (submit wiring, notices, cache invalidation) | PR-1b-2 | PR-1b-1 | `npm test -- src/components/maquina-crud/maquina-form-panel.test.tsx` | N/A — API wrappers mocked | Revert PR; no page imports it yet |
| 9 | `maquina-list` (table, estado/tipo filters, name search) | PR-1b-3 | PR-1b-2 | `npm test -- src/components/maquina-crud/maquina-list.test.tsx` | N/A — jsdom | Revert PR; no page imports it yet |
| 10 | Staff-rail entry + `NavSection` union, seed fix, `/maquinas` page | PR-1b-4 | PR-1b-3 | `npm test -- src/app/maquinas/page.test.tsx src/components/layout/staff-rail.test.tsx tests/prisma-seed.test.ts` | `npm run seed` on a scratch DB + manual `/maquinas` check | Revert PR; seed constant reverts, nav item disappears |

### 1a / 1b → chained-slice mapping (LOC per slice)

| Original PR | Slice | Tasks | Est. LOC | Cumulative |
|---|---|---|---|---|
| 1a | PR-1a-1 | T-053a | ≈350 | 350 |
| 1a | PR-1a-2 | T-053b + T-053c | ≈357 | 707 |
| 1a | PR-1a-3 | T-053d + T-053e | ≈177 | 884 |
| 1a | PR-1a-4 | T-053f | ≈321 | 1,205 |
| 1a | PR-1a-5 | T-053g | ≈240 | 1,445 |
| 1a | PR-1a-6 | T-053h | ≈360 | 1,805 |
| **1a subtotal** | 6 slices | 8 tasks | **≈1,805** | — |
| 1b | PR-1b-1 | T-053i | ≈340 | 340 |
| 1b | PR-1b-2 | T-053j | ≈190 | 530 |
| 1b | PR-1b-3 | T-053k | ≈240 | 770 |
| 1b | PR-1b-4 | T-053l + T-053m | ≈343 | 1,113 |
| **1b subtotal** | 4 slices | 5 tasks | **≈1,113** | — |
| close | no PR (direct to `dev`) | T-053n | ≈80 (docs) | — |
| **Total** | 10 slices + close | 14 tasks | **≈2,998** | — |

Why 1b is ≈1,113 and not the design's ≈1,073: the design grouped form + form-panel + badge at ≈490 in one table row
and then sliced them as ≈340 + ≈190. The ≈40 difference is rounding of the shared estimate, not new scope.

Slice order note: the design's `PR-1a-3` was "API" and `PR-1a-4` "errores y permisos". This plan swaps those two
slices to follow the requested red→green order (mapper/permissions before handlers). The slice boundaries and LOC are
unchanged, and no import requires the old order: handlers throw codes, only the routes consume the mapper.

---

## Execution Status

Legend: ⬜ pending · ✅ done · 🔄 in progress. "Actual LOC" is filled during apply; the estimate column keeps the
planning number (tests included).

| Task | Status | PR / slice | Est. LOC | Date | Note |
|---|---|---|---|---|---|
| T-053a Dominio puro de máquina | ✅ | PR-1a-1 | ≈350 | 2026-10-23 | Slice 1 of 1a |
| T-053b Repositorio, unicidad y `P2002` | ✅ | PR-1a-2 | ≈240 | 2026-10-23 | Slice 2 of 1a |
| T-053c Migración del índice único + integración | ✅ | PR-1a-2 | ≈117 | 2026-10-23 | Integración 26/26 verde contra el Postgres de Docker (verificado por Fernando) |
| T-053d Mapeo de errores nuevos | ✅ | PR-1a-3 | ≈135 | 2026-10-24 | Slice 3 of 1a |
| T-053e Permisos: solo Administrador | ✅ | PR-1a-3 | ≈42 | 2026-10-24 | Slice 3 of 1a |
| T-053f Handlers de API y envoltorios cliente | ✅ | PR-1a-4a + 4b | ≈321 | 2026-10-24 | 4a (handlers) y 4b (wrappers + `CLAVES.maquinas`) completos |
| T-053g Rutas `GET`/`POST /api/maquinas` | ✅ | PR-1a-5a + 5b | ≈240 | 2026-10-24 | 5a (GET) y 5b (POST + auditoría ALTA) completos |
| T-053h Rutas `GET`/`PUT`/`DELETE /api/maquinas/[id]` | ✅ | PR-1a-6a + 6b + 6c | ≈360 | 2026-10-24 | 6a (GET), 6b (PUT + MODIFICACION) y 6c (DELETE + BAJA, 204 sin cuerpo) completos |
| T-053i Formulario y distintivo de estado | ✅ | PR-1b-1 | ≈340 | 2026-10-24 | Slice 1 of 1b; 372 líneas añadidas, ≤400 |
| T-053j Panel del formulario (alta/edición) | ✅ | PR-1b-2 | ≈190 | 2026-10-24 | Slice 2 of 1b; 291 líneas añadidas (impl + tests), ≤400 |
| T-053k Listado con filtros y búsqueda | ✅ | PR-1b-3 | ≈240 | 2026-10-24 | Slice 3 of 1b; 367 líneas añadidas (impl + tests), ≤400 |
| T-053l Navegación y seed de «Polea alta» | ✅ | PR-1b-4 | ≈13 | 19 | 2026-10-24 | Rail + seed: `NavSection`/ítem "Máquinas" y `Polea alta` → `DISPONIBLE` con test AC-014; 19 líneas en el slice de seed |
| T-053m Pantalla `/maquinas` | ✅ | PR-1b-4 | ≈330 | 2026-10-24 | Slice 4 of 1b; 352 líneas añadidas (205 impl + 147 tests), ≤400 |
| T-053n Cierre documental (P-53, P-54, D-73) | ⬜ | none (direct to `dev`) | ≈80 | — | After all slices merge |

---

## task_breakdown

### Phase 1 — Pure domain (PR-1a-1)

#### T-053a · Dominio puro de máquina

- **Status**: ✅ · **Slice**: PR-1a-1 (part of PR 1a) · **Est. LOC**: ≈350 (≈150 impl + ≈200 tests)
- **Files**:
  - `src/domains/maquina/maquina.ts` (new)
  - `src/domains/maquina/maquina.test.ts` (new)
- **TDD (RED → GREEN)**:
  1. - [x] RED — write `src/domains/maquina/maquina.test.ts` with these test names:
     - `validateMaquina > acepta una máquina válida`
     - `validateMaquina > rechaza nombre vacío o solo espacios`
     - `validateMaquina > rechaza nombre de 1 carácter`
     - `validateMaquina > rechaza nombre de 81 caracteres`
     - `validateMaquina > rechaza ubicación vacía`
     - `validateMaquina > rechaza ubicación de 1 carácter`
     - `validateMaquina > rechaza ubicación de 81 caracteres`
     - `validateMaquina > rechaza tipoEquipamiento fuera del enum`
     - `validateMaquina > rechaza estado OCUPADA con el mensaje del panel`
     - `validateMaquina > acepta DISPONIBLE, FUERA_DE_SERVICIO e INACTIVA`
     - `normalizarTexto > quita extremos y colapsa espacios internos`
     - `normalizeMaquina > conserva mayúsculas y tildes en el valor guardado`
     - `ESTADOS_ASIGNABLES > no incluye OCUPADA`
     - `puedeEliminar > permite cuando ejerciciosAsociados es 0`
     - `puedeEliminar > bloquea con 3 y devuelve "3 ejercicios usan esta máquina"`
  2. - [x] RED — run the suite, confirm it fails to import the module.
  3. - [x] GREEN — implement `maquina.ts` with `import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client"`
     (type-only; the pure file never imports Prisma at runtime), `ESTADOS_ASIGNABLES`, `TIPOS_EQUIPAMIENTO`,
     `Maquina`, `MaquinaInput`, `ValidationResult`, `normalizarTexto`, `validateMaquina`, `normalizeMaquina`,
     `puedeEliminar`. Exact messages: `El nombre debe tener entre 2 y 80 caracteres`,
     `La ubicación debe tener entre 2 y 80 caracteres`, `Tipo de equipamiento inválido`,
     `El estado OCUPADA no puede asignarse desde este panel`.
  4. - [x] REFACTOR — no changes needed beyond keeping the file free of data access (ARQ-1).
- **Acceptance criteria**: AC-002, AC-003, AC-004, AC-005 (domain half), AC-011.
- **Dependencies**: none.
- **Verification**:
  ```bash
  npm test -- src/domains/maquina/maquina.test.ts src/domains/dominios-puros.guard.test.ts
  npx tsc --noEmit
  npx eslint src/domains/maquina
  ```
- **Note**: `OCUPADA` is rejected by `validateMaquina` as a validation error; the handler (T-053f) upgrades it to the
  specific `ESTADO_NO_ASIGNABLE` code. Do not add a fourth `EstadoMaquina` union (P-54).

### Phase 2 — Repository + uniqueness persisted (PR-1a-2)

#### T-053b · Repositorio, unicidad y `P2002`

- **Status**: ✅ · **Slice**: PR-1a-2 (part of PR 1a) · **Est. LOC**: ≈240 (≈120 impl + ≈120 tests)
- **Files**:
  - `src/domains/maquina/maquina-repositorio.ts` (new)
  - `src/domains/maquina/maquina-repositorio.test.ts` (new)
- **TDD (RED → GREEN)**:
   1. - [x] RED — write `maquina-repositorio.test.ts` with a mocked `MaquinaReader` (`maquina.*` + `$queryRaw`):
      - `create > consulta el duplicado antes de insertar`
      - `create > compara con unaccent(lower(btrim(...)))`
      - `create > traduce P2002 a DUPLICATE_NOMBRE_UBICACION`
      - `create > propaga un error que no es P2002`
      - `create > inserta los valores ya normalizados`
      - `update > excluye el propio id de la pre-consulta` (assert `AND "id" <>` in the query text and the bound value)
      - `update > traduce P2002 a DUPLICATE_NOMBRE_UBICACION`
      - `getById > devuelve null cuando no existe`
      - `getAll > traduce estado, tipoEquipamiento y nombre a un where de Prisma`
      - `getAll > usa contains + mode insensitive para nombre`
      - `delete > propaga errores de infraestructura`
   2. - [x] RED — confirm the failures are missing-module/missing-behavior, not typos.
   3. - [x] GREEN — implement `MaquinaReader` (only the delegate methods and `$queryRaw` used), `MaquinaRepository`
      with `create`, `getById`, `getAll`, `update`, `delete`, `existeDuplicado`, `esErrorP2002`
      (`(error as { code?: unknown } | null)?.code === "P2002"`), `maquinaRepository` singleton, and the deferred
      `getPrisma()` via `await import("@/lib/db")`. Pre-check SQL exactly as the design:
      `unaccent(lower(btrim($1)))` and the same for `ubicacion`.
   4. - [x] REFACTOR — keep `shortcut:` comment on the P2002 catch: `shortcut: a second unique field would need meta.target disambiguation, revisit when one exists`.
- **Acceptance criteria**: AC-006, AC-007 (repository half), AC-015 (guard).
- **Dependencies**: T-053a (types, `normalizeMaquina`).
- **Verification**:
  ```bash
  npm test -- src/domains/maquina/maquina-repositorio.test.ts
  npx tsc --noEmit
  npx eslint src/domains/maquina
  ```
- **Note**: injection (`db?: MaquinaReader`) is the same pattern as `ejercicio-repositorio.ts` (D-70) and keeps the
  pre-check and `P2002` testable without Prisma.

#### T-053c · Migración del índice único + prueba de integración

- **Status**: 🔄 · **Slice**: PR-1a-2 (part of PR 1a) · **Est. LOC**: ≈117 (≈5 SQL + ≈112 test)
- **Files**:
  - `prisma/migrations/20261023120000_maquina_nombre_ubicacion_unique/migration.sql` (new)
  - `tests/integration/maquina.integration.test.ts` (new)
  - `prisma/seed-data.ts` (one-word change: export the existing `MAQUINAS` constant so the test asserts the real
    seed pairs instead of a copy)
- **TDD (RED → GREEN)**:
   1. - [x] RED — write `tests/integration/maquina.integration.test.ts` (real Postgres guard: `current_database()`
      must be `arnold_test`, same as `ejercicio.integration.test.ts`):
      - `rechaza un duplicado que solo difiere en mayúsculas con P2002`
      - `el repositorio traduce el duplicado de mayúsculas a DUPLICATE_NOMBRE_UBICACION`
      - `la pre-consulta rechaza un duplicado que solo difiere en tildes`
      - `el índice no pliega tildes: el duplicado con tilde entra por SQL crudo`
      - `los seis pares (nombre, ubicacion) del seed son distintos y se insertan sin colisión`
   2. - [ ] RED — `npm run test:integration` before the SQL exists (the index is missing, `P2002` does not fire). **Blocked**: Docker no está disponible en este entorno.
   3. - [x] GREEN — add the hand-written migration:
      ```sql
      CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key"
        ON "Maquina" (lower(btrim("nombre")), lower(btrim("ubicacion")));
      ```
      and export `MAQUINAS` from `prisma/seed-data.ts` (no value change in this task).
   4. - [x] REFACTOR — none. Do **not** add `unaccent()` to the index (STABLE, not IMMUTABLE).
- **Acceptance criteria**: AC-006, AC-015.
- **Dependencies**: T-053a (canonical form), T-053b (repository mapping).
- **Verification**:
  ```bash
  npm run test:integration
  npx tsc --noEmit
  npx eslint tests/integration
  ```
- **Note**: `npm run test:integration` runs the whole integration config (`jest.integration.config.ts --runInBand`);
  it does not accept a file pattern. Migration counter goes 18/18 → 19/19.

### Phase 3 — Error mapping and permissions (PR-1a-3)

#### T-053d · Mapeo de errores nuevos

- **Status**: ✅ · **Slice**: PR-1a-3 (part of PR 1a) · **Est. LOC**: ≈135 (≈60 impl + ≈75 tests)
- **Files**:
  - `src/lib/route-error-mapper.ts` (modify)
  - `src/lib/route-error-mapper.test.ts` (modify)
- **TDD (RED → GREEN)**:
   1. - [x] RED — extend `route-error-mapper.test.ts` (mirror the existing `DELETE_BLOCKED_ASSIGNED` describes):
     - `ESTADO_NO_ASIGNABLE > mapea el código explícito a 400`
     - `ESTADO_NO_ASIGNABLE > mapea el prefijo "ESTADO_NO_ASIGNABLE: ..." a 400`
     - `DUPLICATE_NOMBRE_UBICACION > mapea el código explícito a 409`
     - `DUPLICATE_NOMBRE_UBICACION > mapea el prefijo a 409`
     - `DELETE_BLOCKED_EJERCICIOS > mapea el código explícito a 409 y conserva el conteo`
     - `DELETE_BLOCKED_EJERCICIOS > mapea el prefijo a 409 y quita "DELETE_BLOCKED_EJERCICIOS: "`
     - `los tres códigos esperados no escriben en console.error`
   2. - [x] RED — the new assertions fail (codes fall through to 500).
   3. - [x] GREEN — add the three codes to the explicit-`code` branch **and** to the `validationCodeMatch`
      alternation, with statuses 400 / 409 / 409 and `stripCodePrefix`. Fixed messages:
      `El estado OCUPADA no puede asignarse desde este panel`,
      `Ya existe una máquina con el mismo nombre y ubicación`; `DELETE_BLOCKED_EJERCICIOS` keeps the handler text
      (`No se puede eliminar: N ejercicios usan esta máquina`).
   4. - [x] REFACTOR — group the three new blocks next to `DELETE_BLOCKED_ASSIGNED` and update the header comment list.
- **Acceptance criteria**: AC-005 (API half), AC-006 (API half), AC-011 (mapping), AC-009.
- **Dependencies**: none for compilation; must land before T-053g/T-053h.
- **Verification**:
  ```bash
  npm test -- src/lib/route-error-mapper.test.ts
  npx tsc --noEmit
  npx eslint src/lib/route-error-mapper.ts src/lib/route-error-mapper.test.ts
  ```

#### T-053e · Permisos: solo Administrador

- **Status**: ✅ · **Slice**: PR-1a-3 (part of PR 1a) · **Est. LOC**: ≈42 (≈10 impl + ≈32 tests)
- **Files**:
  - `src/middleware/role-gating.ts` (modify)
  - `src/middleware/matrix-consistency.test.ts` (modify)
  - `src/middleware/role-gating.test.ts` (modify only if a local, non-duplicated assertion adds value)
- **TDD (RED → GREEN)**:
   1. - [x] RED — add a `describe("máquinas es solo de Administrador")` to `matrix-consistency.test.ts`:
     - `it.each` over `["/maquinas", "/api/maquinas"] × [RECEPCIONISTA, INSTRUCTOR, SOCIO]` →
       `roleGatingMiddleware(...)` is `false` **and** `hasRouteAccess(rol, route, "GET").allowed` is `false`
     - `it.each` over the two routes → ADMIN is `true` in **both** matrices
   2. - [x] RED — confirm the failures (routes absent from `ROLE_GATE_MATRIX` → `roleGatingMiddleware` false while
      `hasRouteAccess` grants ADMIN through the wildcard).
   3. - [x] GREEN — add to `ROLE_GATE_MATRIX`:
      ```ts
      "/maquinas": [Rol.ADMINISTRADOR],
      "/api/maquinas": [Rol.ADMINISTRADOR],
      ```
      Do **not** add an entry to `src/lib/authorization.ts` (ADMIN wildcard already covers it; spec requirement).
   4. - [x] REFACTOR — none.
- **Acceptance criteria**: AC-001, AC-015.
- **Dependencies**: none.
- **Verification**:
  ```bash
  npm test -- src/middleware/matrix-consistency.test.ts src/middleware/role-gating.test.ts src/lib/authorization.test.ts
  npx tsc --noEmit
  npx eslint src/middleware
  ```
- **Note**: the existing `it.each` over every matrix key stays untouched and covers the new keys automatically.

### Phase 4 — API handlers (PR-1a-4)

#### T-053f · Handlers de API y envoltorios cliente

- **Status**: ✅ · **Slice**: PR-1a-4 (part of PR 1a) · **Est. LOC**: ≈321 (≈170 impl + ≈150 tests + 1 cache key)
- **Files**:
  - `src/api/maquinas.ts` (new)
  - `src/api/maquinas.test.ts` (new)
  - `src/lib/cache-cliente.ts` (modify: add `maquinas: "maquinas"` to `CLAVES`)
- **TDD (RED → GREEN)**:
   1. - [x] RED — `src/api/maquinas.test.ts`, repository and cache mocked (`jest.mock("@/domains/maquina/maquina-repositorio")`):
      - `handleMaquinaList > devuelve la lista y propaga los filtros`
      - `handleMaquinaList > acepta llamarse sin filtros`
      - `handleMaquinaCreate > rechaza una entrada inválida con VALIDATION_ERROR`
      - `handleMaquinaCreate > rechaza OCUPADA con ESTADO_NO_ASIGNABLE`
      - `handleMaquinaCreate > normaliza antes de guardar`
      - `handleMaquinaCreate > propaga DUPLICATE_NOMBRE_UBICACION del repositorio`
      - `handleMaquinaGetById > lanza NOT_FOUND con "Máquina no encontrada"`
      - `handleMaquinaUpdate > lanza NOT_FOUND cuando no existe`
      - `handleMaquinaUpdate > rechaza OCUPADA aunque el valor no cambie`
      - `handleMaquinaUpdate > valida el registro combinado`
      - `handleMaquinaUpdate > propaga DUPLICATE_NOMBRE_UBICACION`
      - `handleMaquinaDelete > lanza NOT_FOUND cuando no existe`
      - `handleMaquinaDelete > consulta puedeEliminar con 0 y borra`
      - `fetchMaquinasList > guarda la respuesta en CLAVES.maquinas`
      - `deleteMaquina > invalida CLAVES.maquinas`
   2. - [x] RED — confirm failures (`Cannot find module './maquinas'`).
   3. - [x] GREEN — implement the five handlers plus `fetchMaquinasList`, `createMaquina`, `updateMaquina`,
      `deleteMaquina`. Use a local `codedError(code, message)` helper (no `any`). Merge order on update:
      read existing → merged (near-update semantics: absent field keeps the current value) → `OCUPADA` guard →
      `validateMaquina(merged)` → `normalizeMaquina` → repository update.
   4. - [x] REFACTOR — client wrappers invalidate `CLAVES.maquinas` after create/update/delete (delete already must).
- **Acceptance criteria**: AC-005, AC-006, AC-007 (handler half), AC-008, AC-009, AC-010.
- **Dependencies**: T-053a, T-053b.
- **Verification**:
  ```bash
  npm test -- src/api/maquinas.test.ts src/lib/cache-cliente.test.ts
  npx tsc --noEmit
  npx eslint src/api/maquinas.ts src/api/maquinas.test.ts src/lib/cache-cliente.ts
  ```
- **Note**: handlers use the `maquinaRepository` singleton (same shape as `ejercicioRepository`) so tests mock the
  module rather than `@/lib/db`.
- **T-053d forward note**: the handler test MUST assert `ESTADO_NO_ASIGNABLE` by checking explicitly `estado === "OCUPADA"` on POST and on PUT without changes.

### Phase 5 — Collection routes (PR-1a-5)

#### T-053g · Rutas `GET`/`POST /api/maquinas`

- **Status**: ✅ · **Slice**: PR-1a-5 (part of PR 1a) · **Est. LOC**: ≈240 (≈120 impl + ≈120 tests) · **Actual LOC**: 344 (181 route.ts + 163 route.test.ts)
- **Files**:
  - `src/app/api/maquinas/route.ts` (new)
  - `src/app/api/maquinas/route.test.ts` (new)
- **TDD (RED → GREEN)**:
   1. - [x] RED — `route.test.ts` with `@/api/maquinas`, `@/lib/auth`, `@/lib/audit` mocked:
      - `GET > lista todas las máquinas`
      - `GET > pasa estado, tipoEquipamiento y nombre como filtros`
      - `GET > acepta estado=OCUPADA`
      - `GET > devuelve [] cuando no hay resultados`
      - `GET > responde 400 VALIDATION_ERROR para estado=FOO`
      - `GET > responde 400 VALIDATION_ERROR para tipoEquipamiento=FOO`
      - `GET > responde 400 cuando el handler lanza VALIDATION_ERROR`
      - `POST > crea y responde 201`
      - `POST > audita ALTA con el id del actor y { maquinaId }`
      - `POST > responde 403 a un rol distinto de ADMINISTRADOR`
      - `POST > responde 400 a OCUPADA con ESTADO_NO_ASIGNABLE`
      - `POST > responde 409 a un duplicado`
      - `POST > un fallo de auditoría no cambia la respuesta`
   2. - [x] RED — failures are missing module.
   3. - [x] GREEN — implement `GET` + `POST`, the exported `handleMaquinaListRequest` /
      `handleMaquinaCreateRequest`, discriminated unions and guards (copy `membresias/route.ts`), and
      `const ALLOWED_ROLES = ["ADMINISTRADOR"]` enforced with `extractUserFromRequest` → 403 `FORBIDDEN`
      (`defensa en profundidad`, same shape as `configuracion/route.ts`). Audit after success with
      `tipoOperacion: "ALTA"`, `detalles: { maquinaId: result.id }`, best-effort.
   4. - [x] REFACTOR — reuse `readJsonBody` for the body; keep the route thin.
- **Acceptance criteria**: AC-001, AC-007, AC-012.
- **Dependencies**: T-053d (mapper), T-053e (permissions), T-053f (handlers).
- **Verification**:
  ```bash
  npm test -- src/app/api/maquinas/route.test.ts
  npx tsc --noEmit
  npx eslint src/app/api/maquinas
  ```
  Smoke (D-21), with `npm run dev` running:
  ```bash
  curl -s -c /tmp/arnold.jar -X POST localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"admin@arnold.test","password":"Arnold2026!"}'
  curl -s -b /tmp/arnold.jar 'localhost:3000/api/maquinas?estado=DISPONIBLE'
  curl -s -b /tmp/arnold.jar -X POST localhost:3000/api/maquinas \
    -H 'content-type: application/json' \
    -d '{"nombre":"Polea baja","ubicacion":"Sala principal","tipoEquipamiento":"MAQUINA_GUIADA","estado":"DISPONIBLE"}'
  ```
- **Note**: mocked tests do not exercise the proxy or async params; the curl smoke is mandatory for this slice (D-21).

### Phase 6 — By-id routes (PR-1a-6)

#### T-053h · Rutas `GET`/`PUT`/`DELETE /api/maquinas/[id]`

- **Status**: ⬜ · **Slice**: PR-1a-6 (part of PR 1a) · **Est. LOC**: ≈360 (≈180 impl + ≈180 tests)
- **Files**:
  - `src/app/api/maquinas/[id]/route.ts` (new)
  - `src/app/api/maquinas/[id]/route.test.ts` (new)
  - `src/app/api/maquinas/[id]/route.delete.test.ts` (new)
- **TDD (RED → GREEN)**:
  1. - [ ] RED — `route.test.ts`:
     - `GET > devuelve la máquina por id`
     - `GET > responde 404 con "Máquina no encontrada"`
     - `PUT > actualiza y responde 200`
     - `PUT > audita MODIFICACION (incluido un cambio solo de estado)`
     - `PUT > responde 404 cuando no existe`
     - `PUT > responde 400 a OCUPADA sin cambios con ESTADO_NO_ASIGNABLE`
     - `PUT > responde 409 a un duplicado`
     - `PUT > responde 403 a un rol distinto de ADMINISTRADOR`
     - `params > espera la promesa antes de leer el id` (call the exported `handle...Request` and the HTTP
       function with `params: Promise.resolve({ id })`)
     `route.delete.test.ts`:
     - `DELETE > borra y responde 204 sin cuerpo`
     - `DELETE > audita BAJA con { maquinaId: id }`
     - `DELETE > responde 404 cuando no existe`
     - `DELETE > un fallo de auditoría no cambia la respuesta`
     - `DELETE > responde 403 a un rol distinto de ADMINISTRADOR`
  2. - [ ] RED — confirm failures.
  3. - [ ] GREEN — implement the three verb handlers with `{ params }: { params: Promise<{ id: string }> }` and
     `const { id } = await params` (Next 16, FX-06), the three exported `handle...Request` functions, the union
     types/guards, `ALLOWED_ROLES`, audit `MODIFICACION`/`BAJA`, and `new NextResponse(null, { status: 204 })`
     for DELETE (never `NextResponse.json` on 204).
  4. - [ ] REFACTOR — share the success/error envelope shapes with the collection route only if it removes real
     duplication; otherwise leave the two files parallel (matches `membresias`).
- **Acceptance criteria**: AC-001, AC-008, AC-009, AC-010, AC-012.
- **Dependencies**: T-053d, T-053e, T-053f.
- **Verification**:
  ```bash
  npm test -- src/app/api/maquinas
  npx tsc --noEmit
  npx eslint "src/app/api/maquinas/[id]"
  ```
  Smoke (D-21) with the admin cookie from T-053g:
  ```bash
  curl -s -b /tmp/arnold.jar localhost:3000/api/maquinas/<id>
  curl -s -b /tmp/arnold.jar -X PUT localhost:3000/api/maquinas/<id> \
    -H 'content-type: application/json' \
    -d '{"nombre":"Polea baja","ubicacion":"Sala principal","tipoEquipamiento":"MAQUINA_GUIADA","estado":"FUERA_DE_SERVICIO"}'
  curl -s -i -b /tmp/arnold.jar -X DELETE localhost:3000/api/maquinas/<id>
  ```
- **Note**: the 204 branch and `await params` are the two runtime footguns with no coverage in mocked tests (FX-06).

### Phase 7 — Form + estado badge (PR-1b-1)

#### T-053i · Formulario y distintivo de estado

- **Status**: ✅ · **Slice**: PR-1b-1 (part of PR 1b) · **Est. LOC**: ≈340 (≈170 impl + ≈170 tests) · **Actual LOC**: 372 (229 impl + 143 tests)
- **Files**:
  - `src/components/maquina-crud/estado-badge.tsx` (new)
  - `src/components/maquina-crud/estado-badge.test.tsx` (new)
  - `src/components/maquina-crud/maquina-form.tsx` (new)
  - `src/components/maquina-crud/maquina-form.test.tsx` (new)
- **TDD (RED → GREEN)**:
   1. - [x] RED — component tests:
      - `estado-badge > muestra DISPONIBLE como success`
      - `estado-badge > muestra OCUPADA como warning`
      - `estado-badge > muestra FUERA_DE_SERVICIO como danger`
      - `estado-badge > muestra INACTIVA como neutral`
      - `maquina-form > renderiza nombre, ubicación, tipo y estado`
      - `maquina-form > el select de estado solo ofrece los tres valores asignables`
      - `maquina-form > al editar una fila OCUPADA inicializa el estado en DISPONIBLE`
      - `maquina-form > muestra el error de nombre demasiado corto`
      - `maquina-form > impide enviar con estado OCUPADA`
      - `maquina-form > envía los valores normalizados`
   2. - [x] RED — confirm failures (módulos no existen).
   3. - [x] GREEN — implement both components. `estado-badge.tsx` maps `EstadoMaquina` to the existing
      `TableStatusBadge` variant; `maquina-form.tsx` is controlled, imports `validateMaquina`,
      `ESTADOS_ASIGNABLES`, `TIPOS_EQUIPAMIENTO` from the pure domain (never the repository).
   4. - [x] REFACTOR — reuse `TableStatusBadge` from `src/components/ui/table.tsx` (the one
      `src/components/membresia-crud/membresia-list-panel.tsx` already imports) instead of writing a new badge
      primitive. Variants: success / warning / danger / neutral.
- **Acceptance criteria**: AC-005 (UI half), AC-013 (form/badge half).
- **Dependencies**: T-053a (validation and constants).
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/maquina-form.test.tsx src/components/maquina-crud/estado-badge.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud
  ```

### Phase 8 — Form panel (PR-1b-2)

#### T-053j · Panel del formulario (alta/edición)

- **Status**: ✅ · **Slice**: PR-1b-2 (part of PR 1b) · **Est. LOC**: ≈190 (≈100 impl + ≈90 tests) · **Actual LOC**: 168 (76 impl + 92 tests)
- **Files**:
  - `src/components/maquina-crud/maquina-form-panel.tsx` (new)
  - `src/components/maquina-crud/maquina-form-panel.test.tsx` (new)
- **TDD (RED → GREEN)**:
   1. - [x] RED — `maquina-form-panel.test.tsx` con `global.fetch`, notificaciones y caché mockeados:
      - `crea una máquina y avisa el éxito`
      - `edita una máquina y avisa el éxito`
      - `muestra el mensaje del servidor cuando la API falla`
      - `no envía dos veces mientras la primera petición está en curso`
      - `llama onSuccess con la máquina devuelta`
      - `llama onCancel al cancelar`
   2. - [x] RED — confirmado fallo por módulo inexistente.
   3. - [x] GREEN — implementado `MaquinaFormPanel` con guard `submittingRef`, `notify("success", ...)`,
      `handleApiError`, `throwIfNotOk` y `onSuccess`; sin aviso de desactivación.
   4. - [x] REFACTOR — none.
- **Acceptance criteria**: AC-013 (create/edit wiring).
- **Dependencies**: T-053f (client wrappers), T-053i (form).
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/maquina-form-panel.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud
  ```
- **Note**: flagged micro-deviation from the design's component-map sentence ("POST/PUT via `fetch`"): this panel
  calls the mandated `createMaquina` / `updateMaquina` wrappers so there is a single error/cache path. If apply hits a
  blocker, fall back to the raw-`fetch` shape of `membresia-form-panel.tsx`.

### Phase 9 — List (PR-1b-3)

#### T-053k · Listado con filtros y búsqueda

- **Status**: ✅ · **Slice**: PR-1b-3 (part of PR 1b) · **Est. LOC**: ≈240 (≈130 impl + ≈110 tests) · **Actual LOC**: 237 (101 impl + 136 tests)
- **Files**:
  - `src/components/maquina-crud/maquina-list.tsx` (new)
  - `src/components/maquina-crud/maquina-list.test.tsx` (new)
- **TDD (RED → GREEN)**:
   1. - [x] RED — `maquina-list.test.tsx`:
      - `renderiza las columnas ID, Nombre, Tipo, Ubicación y Estado`
      - `filtra por estado`
      - `filtra por tipo de equipamiento`
      - `busca por nombre sin distinguir mayúsculas`
      - `combina los tres filtros`
      - `muestra un mensaje cuando no hay resultados`
      - `selecciona una fila al hacer clic`
      - `dibuja el estado con EstadoBadge`
   2. - [x] RED — confirm failures (`Cannot find module './maquina-list'`).
   3. - [x] GREEN — implemented the table plus the two `<select>` filters and the `nombre` search input; combine
      `estadoFilter`, `tipoEquipamientoFilter` and `searchTerm` in one `useMemo`; selection is controlled by the page.
   4. - [x] REFACTOR — reused `Table`, `TableHeader`, `TableRow`, `TableCell` and sort helpers from `src/components/ui/table.tsx`; no new table primitive.
- **Acceptance criteria**: AC-007 (UI half), AC-013 (list half).
- **Dependencies**: T-053i (`estado-badge`).
- **Verification**:
  ```bash
  npm test -- src/components/maquina-crud/maquina-list.test.tsx
  npx tsc --noEmit
  npx eslint src/components/maquina-crud/maquina-list.tsx src/components/maquina-crud/maquina-list.test.tsx
  ```

### Phase 10 — Rail + seed, then the screen (PR-1b-4)

> Order note: the phase brief lists the screen (10) before the rail (11). The screen cannot compile first:
> `CrudPageLayout` types its `section` prop as `NavSection` (`src/components/layout/crud-page-layout.tsx:6`), so
> `"maquinas"` must be in the union before `page.tsx` passes `section="maquinas"`. Within this slice the rail task
> lands first (same PR, no extra review boundary).

#### T-053l · Navegación y seed de «Polea alta»

- **Status**: ✅ (rail) · **Slice**: PR-1b-4 (part of PR 1b) · **Est. LOC**: ≈13 (≈8 impl + ≈5 tests) · **Actual LOC**: 15 (2 impl + 13 tests)
- **Files**:
  - `src/components/layout/staff-rail.tsx` (modify: add `"maquinas"` to `NavSection`, add the nav item to the
    "Operación" zone)
  - `src/components/layout/staff-rail.test.tsx` (modify)
  - `prisma/seed-data.ts` (modify line ≈155: `Polea alta` `estado: "OCUPADA"` → `"DISPONIBLE"`, plus the comment
    stating the fix only affects an empty DB) — **excluded from current slice**
  - `tests/prisma-seed.test.ts` (modify) — **excluded from current slice**
- **TDD (RED → GREEN)**:
   1. - [x] RED — `staff-rail.test.tsx`:
      - `ADMINISTRADOR ve los 9 destinos con sus rutas` (asserts `Máquinas` href `/maquinas`)
      - `%s no ve el enlace Máquinas` for RECEPCIONISTA, INSTRUCTOR, SOCIO
   2. - [x] RED — confirm failures (union member missing, nav item missing).
   3. - [x] GREEN — add the rail item
      `{ section: "maquinas", label: "Máquinas", href: "/maquinas", roles: ["ADMINISTRADOR"] }` and the union member.
   4. - [x] REFACTOR — none.
- **Acceptance criteria**: AC-013 (nav half). AC-014 deferred with seed.
- **Dependencies**: none for the rail; T-053e for the permission intent (the rail filters client-side).
- **Verification**:
  ```bash
  npm test -- src/components/layout/staff-rail.test.tsx
  npx tsc --noEmit
  npx eslint src/components/layout/staff-rail.tsx src/components/layout/staff-rail.test.tsx
  ```
- **Note**: Seed changes (`Polea alta` → `DISPONIBLE` and `tests/prisma-seed.test.ts`) were explicitly excluded from
  this slice by preflight instruction. No data-fix migration. Already-seeded databases keep their `OCUPADA` row until
  the admin edits it from `/maquinas`.

#### T-053m · Pantalla `/maquinas`

- **Status**: ✅ · **Slice**: PR-1b-4 (part of PR 1b) · **Est. LOC**: ≈330 (≈180 impl + ≈150 tests) · **Actual LOC**: 352 (205 impl + 147 tests)
- **Files**:
  - `src/app/maquinas/page.tsx` (new)
  - `src/app/maquinas/page.test.tsx` (new)
- **TDD (RED → GREEN)**:
  1. - [x] RED — `page.test.tsx` with `@/api/maquinas`, `@/contexts/auth`, `@/contexts/notifications` mocked:
     - `renderiza la tabla para el Administrador`
     - `redirige a /home-socio a un rol que no es Administrador`
     - `muestra el error de carga con handleApiError`
     - `crea una máquina desde el modal y refresca la lista`
     - `edita una máquina y refresca la lista`
     - `abre ConfirmDialog y borra al confirmar`
     - `no borra si se cancela la confirmación`
     - `muestra el 409 DELETE_BLOCKED_EJERCICIOS como aviso de error`
  2. - [x] RED — confirm failures (`Cannot find module './page'`).
  3. - [x] GREEN — implement `MaquinasPage` with ADMIN guard, modal create/edit (`useModalA11y`), `ConfirmDialog`,
     `CrudPageLayout` / `ListPanelShell` / `CrudActions`, `handleApiError`, and `MaquinaList`. Create/edit use
     `MaquinaFormPanel`; the 409 `DELETE_BLOCKED_EJERCICIOS` surfaces the server message on the layout error area.
  4. - [x] REFACTOR — kept the state shape parallel to membresías; no shared CRUD page hook extracted.
- **Acceptance criteria**: AC-013.
- **Dependencies**: T-053g, T-053h, T-053j, T-053k, T-053l (union member).
- **Verification**:
  ```bash
  npm test -- src/app/maquinas/page.test.tsx
  npx tsc --noEmit
  npx eslint src/app/maquinas
  ```
  Manual check (browser, not automatable in this repo — `e2e_available: false`): log in as
  `admin@arnold.test` / `Arnold2026!`, open `/maquinas` from the rail, create, edit (including a row stored as
  `OCUPADA`), and delete with confirmation.

### Phase 11 — Close

#### T-053n · Cierre documental (P-53, P-54, P-55, D-73)

- **Status**: ⬜ · **Slice**: none (direct to `dev`, matching the repo's close-task convention) · **Est. LOC**: ≈80 (docs)
- **Files**:
  - `openspec/decisions.md` (modify: record **P-53**, **P-54**, **D-73**, and mark any resolved IDs)
  - `PROJECT-STATUS.md` (modify: task table, "Cambios recientes", pendientes)
  - `openspec/sdd-tasks-tdd.md` (modify: append T-053a…T-053n to the Execution Status table with actual LOC)
  - `odd/tasks/maquinas.md` (update: it already exists from apply; objective, one step per slice with ✅/⬜, risks, verification, pending items — same shape as `odd/tasks/catalogo-ejercicios.md`)
- **Checklist**:
  1. - [ ] Record **P-53** — INACTIVA counts in Home_Interno's "Estado de equipos" total, so deleting machines lowers
     the percentage; revisit the denominator when the machines feature closes. Home_Interno is not touched here.
  2. - [ ] Record **P-54** — `EstadoMaquina` is still duplicated as literal unions in
     `src/domains/home-interno/home-interno.ts` and `src/components/home-socio/tarjeta-detalle.tsx`; this change
     imports the Prisma type and adds no fourth definition. Consolidation is deferred.
  3. - [ ] Record **D-73** — uniqueness, separating **what Fernando decided** from **what the AI proposed**:
     - Fernando chose approach **(b)**: a unique index on `lower(btrim(nombre)), lower(btrim(ubicacion))` plus a
       repository pre-check with `unaccent(lower(btrim(...)))`, and rejected both the `lower(unaccent(...))` index
       (`unaccent()` is STABLE, index expressions must be IMMUTABLE) and an IMMUTABLE wrapper (schema/`search_path`
       portability, dictionary-change footgun).
     - The AI had proposed the `unaccent()` expression index in `sdd-explore` (Approach A); that proposal was not
       adopted.
     - Residual accepted: accent-only collisions under a concurrent race; `P2002` closes the case-only race.
  4. - [ ] Update `PROJECT-STATUS.md` (status, migrations 18/18 → 19/19, "Cambios recientes").
  5. - [ ] Append the 14 tasks and actual LOC to `openspec/sdd-tasks-tdd.md`.
  6. - [ ] Update `odd/tasks/maquinas.md` (it already exists). Correct the "integración bloqueada por Docker" line:
     the integration suite already passed **26/26** green against the ephemeral Docker Postgres.
  7. - [ ] Confirm the migration counter in `PROJECT-STATUS.md` reflects the real state after `prisma migrate deploy`
     (do not assume 19/19 without checking).
  8. - [ ] Record **P-55** — `POST`, `GET` (by id) and `PUT` responses include a `status` field inside the resource
     JSON (`{ ...maquina, status }`), same as Membresías. It is not a functional bug; the HTTP status should be the
     only source. Do not fix it in this feature.
- **Acceptance criteria**: none functional; closes the documentation debt required by the proposal.
- **Dependencies**: all previous tasks merged.
- **Verification**:
  ```bash
  npm test
  npx tsc --noEmit
  npx prisma migrate status
  ```
- **Note**: the spec (`openspec/specs/maquinas-crud/spec.md`) is already written and belongs to PR 1a; this task only
  closes documentation. Do not edit `decisions.md` before this task.

---

## dependencies

### Dependency graph

```
T-053a (domain)
  ├── T-053b (repository) ── T-053c (migration + integration)
  ├── T-053i (form + badge) ── T-053j (form-panel) ── T-053m (page)
  └── T-053k (list) ──────────────────────────────────┘

T-053d (error mapper) ─┐
T-053e (permissions) ──┼── T-053g (collection routes) ── T-053h (by-id routes)
T-053f (API handlers) ─┘         │                              │
                                 └────────── T-053m (page) ──────┘

T-053l (rail union + seed) ── T-053m (page; needs NavSection)
T-053n (close) after every task above
```

### Per-task dependencies

| Task | Must land after |
|---|---|
| T-053a | — |
| T-053b | T-053a |
| T-053c | T-053a, T-053b |
| T-053d | — (independent; before T-053g) |
| T-053e | — (independent; before T-053g) |
| T-053f | T-053a, T-053b |
| T-053g | T-053d, T-053e, T-053f |
| T-053h | T-053d, T-053e, T-053f |
| T-053i | T-053a |
| T-053j | T-053f, T-053i |
| T-053k | T-053i |
| T-053l | — (seed); union member before T-053m |
| T-053m | T-053g, T-053h, T-053j, T-053k, T-053l |
| T-053n | all of the above |

### Hard external dependencies

- Ephemeral Docker Postgres for `npm run test:integration` (T-053c and every PR's final gate).
- `unaccent` extension (already applied by `20261015200000_unaccent`) for the repository pre-check.
- `admin@arnold.test` / `Arnold2026!` from `npm run seed` for the D-21 smoke tests.
- No new npm dependency.

---

## acceptance_tests

Every acceptance criterion from `openspec/specs/maquinas-crud/spec.md` maps to a RED test written before its
implementation. Rows marked N/A stay omitted.

| AC | Covered by | Test file(s) | Key test names |
|---|---|---|---|
| AC-001 | T-053e, T-053g, T-053h | `src/middleware/matrix-consistency.test.ts`, `src/app/api/maquinas/route.test.ts`, `src/app/api/maquinas/[id]/route.test.ts` | `deniega RECEPCIONISTA/INSTRUCTOR/SOCIO en /maquinas y /api/maquinas en ambas matrices`; `responde 403 a un rol distinto de ADMINISTRADOR` |
| AC-002 | T-053a, T-053f | `src/domains/maquina/maquina.test.ts`, `src/api/maquinas.test.ts`, `src/components/maquina-crud/maquina-form.test.tsx` | `rechaza nombre vacío/1/81`, `quita extremos y colapsa espacios internos`, `rechaza una entrada inválida con VALIDATION_ERROR` |
| AC-003 | T-053a, T-053f | same | `rechaza ubicación vacía/1/81`, `normaliza antes de guardar` |
| AC-004 | T-053a | `src/domains/maquina/maquina.test.ts` | `rechaza tipoEquipamiento fuera del enum`, `acepta MAQUINA_GUIADA, PESO_LIBRE y CARDIO` |
| AC-005 | T-053a, T-053d, T-053f, T-053h, T-053i | domain, mapper, handlers, by-id route, form | `rechaza estado OCUPADA`, `mapea ESTADO_NO_ASIGNABLE a 400`, `rechaza OCUPADA aunque el valor no cambie`, `el select de estado solo ofrece los tres valores asignables` |
| AC-006 | T-053b, T-053c, T-053d, T-053f, T-053g | repository, integration, mapper, handlers, collection route | `consulta el duplicado antes de insertar`, `traduce P2002 a DUPLICATE_NOMBRE_UBICACION`, `rechaza un duplicado que solo difiere en mayúsculas`, `la pre-consulta rechaza un duplicado que solo difiere en tildes` |
| AC-007 | T-053b, T-053f, T-053g, T-053k | repository, handlers, collection route, list | `lista todas las máquinas`, `filtra por estado`, `filtra por tipo de equipamiento`, `busca por nombre sin distinguir mayúsculas`, `combina los tres filtros`, `devuelve [] cuando no hay resultados` |
| AC-008 | T-053f, T-053h | handlers, by-id route | `lanza NOT_FOUND con "Máquina no encontrada"`, `responde 404 con "Máquina no encontrada"` |
| AC-009 | T-053d, T-053f, T-053h | mapper, handlers, by-id route | `actualiza y responde 200`, `audita MODIFICACION (incluido un cambio solo de estado)`, `responde 404 cuando no existe`, `responde 409 a un duplicado` |
| AC-010 | T-053a, T-053f, T-053h | domain, handlers, `route.delete.test.ts` | `permite cuando ejerciciosAsociados es 0`, `consulta puedeEliminar con 0 y borra`, `borra y responde 204 sin cuerpo`, `responde 404 cuando no existe` |
| AC-011 | T-053a, T-053d | domain, mapper | `bloquea con 3 y devuelve "3 ejercicios usan esta máquina"`, `mapea DELETE_BLOCKED_EJERCICIOS a 409 y conserva el conteo` |
| AC-012 | T-053g, T-053h | collection route, by-id route | `audita ALTA con el id del actor y { maquinaId }`, `audita MODIFICACION`, `audita BAJA`, `un fallo de auditoría no cambia la respuesta` |
| AC-013 | T-053i, T-053j, T-053k, T-053l, T-053m | components, page, rail | `renderiza la tabla para el Administrador`, `crea una máquina desde el modal y refresca la lista`, `edita una máquina y refresca la lista`, `abre ConfirmDialog y borra al confirmar`, `no borra si se cancela la confirmación`, `muestra el 409 DUPLICATE_NOMBRE_UBICACION como aviso de error`, `muestra "Máquinas" al Administrador` |
| AC-014 | T-053l | `tests/prisma-seed.test.ts` | `siembra la Polea alta como DISPONIBLE`; `es repetible: ... catálogos solo si no existen` (non-empty table untouched) |
| AC-015 | T-053a, T-053e, all PRs | `src/domains/dominios-puros.guard.test.ts`, `src/middleware/matrix-consistency.test.ts`, full `npm test` | `dominios-puros.guard`, `matrix-consistency`, full suite green before every PR |

### Not covered by AC (deliberately)

- Home_Interno's "Estado de equipos" card — not modified (P-53).
- `EstadoMaquina` literal-union consolidation — not modified (P-54).
- `Ejercicio↔Maquina` relations, waitlist, session-driven `OCUPADA`, Home_Socio visibility — later etapas.

---

## TDD and verification gate per slice

Before opening each PR (D-21, D-13, L-10):

- [ ] Tests written first, observed failing for the right reason.
- [ ] Focused suite green: `npm test -- <paths listed in the task>`.
- [ ] Full suite green before the PR: `npm test`.
- [ ] `npx tsc --noEmit` clean (if `.next/dev/types/validator.ts` breaks, `rm -rf .next` — known gotcha).
- [ ] `npx eslint <touched paths>` reports no new errors.
- [ ] D-21 smoke test for every slice that touches routes/auth/proxy (T-053g, T-053h, T-053m).
- [ ] PR ≤400 changed lines (`git diff --shortstat` against the base); generated files excluded.
- [ ] Conventional commit, no AI attribution.
- [ ] Rollback boundary in the PR description.

## Out of scope (do not implement here)

- `src/domains/home-interno/home-interno.ts` and `src/components/home-socio/tarjeta-detalle.tsx` (P-54).
- Home_Interno "Estado de equipos" logic (P-53).
- `src/lib/authorization.ts` entries for the new routes (ADMIN wildcard is enough).
- A data-fix migration for already-seeded `OCUPADA` rows (the admin edits the row from `/maquinas`).
- Per-row seed `ubicacion` (open question in the spec; the shared `"Sala principal"` stays).
- Requesting either `size:exception` or the chain strategy — that is the human's decision before apply.

---

## Post-apply adjustments

### List/page search and filter adjustments

> Applied on `feat/asignacion-dinamica` after T-053k and T-053m were initially complete.

- [x] Move search control out of `MaquinaList`: accept `searchTerm` prop, remove internal `useState` and input, filter `nombre` with `normalizeSortText`.
- [x] Wire `MaquinasPage` to pass `searchTerm={searchTerm}` (the same state used by `CrudActions`) into `MaquinaList`.
- [x] Add visible `<label>` elements above the estado and tipo selects (keep `aria-label` on the selects).
- [x] Change empty option text to `"Todos los estados"` and `"Todos los tipos"`.
- [x] Remove `disclosure` from `TableHeader` and `TableRow` in `maquina-list.tsx`; assert `[data-disclosure-indicator]` is absent.
- [x] Update `maquina-list.test.tsx` and `page.test.tsx` to cover the new prop-driven search, labels, empty options, and missing chevron; keep existing estado/tipo/empty/loading/selection tests green.

**Files touched**: `src/components/maquina-crud/maquina-list.tsx`, `src/components/maquina-crud/maquina-list.test.tsx`, `src/app/maquinas/page.tsx`, `src/app/maquinas/page.test.tsx`.

**Changed lines**: 151 (103 insertions + 48 deletions). Well under the 400-line review budget.
