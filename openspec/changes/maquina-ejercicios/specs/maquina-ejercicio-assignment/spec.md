# Maquina-Ejercicio Assignment Specification

## Purpose

Associate `Ejercicio` records with `Maquina` records through an explicit many-to-many join model (`EjercicioMaquina`), managed from the machine's detail view in `/maquinas`. This is Etapa 2 of the "asignación dinámica de ejercicios" initiative: it closes the loop Etapa 1 left open (`puedeEliminar` wired to a hardcoded `0`) and gives the Administrador an API and UI to assign/unassign exercises per machine.

The association is **permissive**: an exercise with zero machine links is valid and simply means it never waits. An empty set is a legitimate state — "remove all associations" — and makes the machine deletable again.

## Requirements

### Requirement: EjercicioMaquina Join Model

The system **MUST** model the association as an explicit join table `EjercicioMaquina`, following the existing `EjercicioEnRutina` pattern:

- A composite unique constraint `@@unique([maquinaId, ejercicioId])` **MUST** prevent duplicate (maquina, ejercicio) pairs.
- Secondary indexes **MUST** exist on both foreign keys (`maquinaId` and `ejercicioId`).
- `onDelete: Cascade` **MUST** be declared on **both** sides:
  - `maquina → EjercicioMaquina`: `Cascade`, because the handler-level `puedeEliminar` already blocks machine deletion upstream (a machine with associations returns 409). If the handler allows the delete (count = 0), there are no rows to cascade. This matches the established `Rutina → EjercicioEnRutina` pattern.
  - `ejercicio → EjercicioMaquina`: `Cascade`, because deleting an exercise **MUST NOT** be blocked by the new relation — the M2M rows disappear automatically when the exercise is legitimately deleted. A `Restrict` here would incorrectly add a new `DELETE_BLOCKED_ASSIGNED` path.
- Relation fields **MUST** be added to both `Ejercicio` (e.g. `maquinas EjercicioMaquina[]`) and `Maquina` (e.g. `ejercicios EjercicioMaquina[]`).

The association **MUST** be permissive: an exercise with no machines is valid, and a machine with no exercises is valid.

#### Scenario: Join table enforces composite uniqueness

- GIVEN `EjercicioMaquina` rows linking `maquinaId=M1` to `ejercicioId=E1`
- WHEN the system attempts to insert a second row for `(M1, E1)`
- THEN the unique constraint rejects the duplicate pair

#### Scenario: Exercise deletion cascades machine links

- GIVEN an exercise `E1` associated with machine `M1` (one `EjercicioMaquina` row)
- WHEN `E1` is legitimately deleted (not blocked by `EjercicioEnRutina` or `RegistroDeProgreso`)
- THEN the `EjercicioMaquina` rows referencing `E1` are removed automatically (`onDelete: Cascade`), and the delete succeeds

#### Scenario: Machine deletion is blocked upstream, not at the DB

- GIVEN a machine `M1` with associated exercises (count > 0)
- WHEN the Administrador attempts `DELETE /api/maquinas/M1`
- THEN the handler returns 409 `DELETE_BLOCKED_EJERCICIOS` before any DB delete fires; the `onDelete: Cascade` is never exercised for a non-empty machine

### Requirement: Migration — Additive Only

The system **MUST** introduce the join table via a **hand-written, additive-only** migration at `prisma/migrations/<ts>_ejercicio_maquina/migration.sql` containing exactly:

- One `CREATE TABLE "EjercicioMaquina"`.
- One `CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key"`.
- Two secondary `CREATE INDEX` statements (one per FK).

The migration **MUST NOT** contain any `DROP`, `ALTER`, or any reference to `Maquina_nombre_ubicacion_key` (the orphan expression index from `20261023120000_maquina_nombre_ubicacion_unique`). The project **MUST NOT** run `prisma migrate dev`, which would detect that unrepresentable expression index and emit a `DROP INDEX` or propose a reset.

#### Scenario: Migration is additive only

- GIVEN the hand-written migration file
- WHEN a pre-migration check greps the SQL
- THEN it contains 0 occurrences of `DROP`, `ALTER`, or `Maquina_nombre_ubicacion_key`, and exactly 4 additive statements (1 `CREATE TABLE` + 3 `CREATE INDEX`)

#### Scenario: Migration applies cleanly on an ephemeral database

- GIVEN the ephemeral Docker Postgres used by `npm run test:integration`
- WHEN the migration runs
- THEN the `EjercicioMaquina` table and its three indexes are created without touching `Maquina` or `Ejercicio`

### Requirement: Assignment Input Validation

The system **MUST** validate the assignment input in the pure domain (`src/domains/maquina/`), with no Prisma import. A pure function `validarAsignacionEjercicios(ejercicioIds, existentes)` **MUST** enforce, with the constant `MAX_EJERCIOS_POR_MAQUINA = 50`:

- **Existence**: every `ejercicioId` **MUST** reference an existing exercise. Any unknown id → 400 `VALIDATION_ERROR`.
- **No duplicates**: the input **MUST NOT** contain duplicate ids. Duplicates → 400 `VALIDATION_ERROR`.
- **Maximum**: `ejercicioIds.length` **MUST** be `<= MAX_EJERCIOS_POR_MAQUINA` (50). Exceeding → 400 `VALIDATION_MAX_EJERCICIOS`.
- **Empty set valid**: `ejercicioIds: []` **MUST** be accepted and means "remove all associations".

The body **MUST** be a JSON object with a `ejercicioIds` array; a non-object body or a non-array `ejercicioIds` → 400 `VALIDATION_ERROR`.

#### Scenario: Valid assignment accepted

- GIVEN `ejercicioIds: ["E1", "E2", "E3"]` where all three exist and are distinct
- WHEN the Administrador submits a PUT
- THEN validation passes and the association set is replaced

#### Scenario: Empty set accepted

- GIVEN `ejercicioIds: []`
- WHEN the Administrador submits a PUT
- THEN validation passes and the machine is left with no associations (becoming deletable)

#### Scenario: Unknown exercise id rejected

- GIVEN `ejercicioIds: ["E1", "E-MISSING"]` where `E-MISSING` does not exist
- WHEN the Administrador submits a PUT
- THEN the system returns 400 `VALIDATION_ERROR` ("Uno o más ejercicios no existen") and changes nothing

#### Scenario: Duplicate ids rejected

- GIVEN `ejercicioIds: ["E1", "E1"]`
- WHEN the Administrador submits a PUT
- THEN the system returns 400 `VALIDATION_ERROR` ("Hay ejercicios duplicados en la asignación") and changes nothing

#### Scenario: Over the 50-exercise ceiling rejected

- GIVEN `ejercicioIds` with 51 distinct existing ids
- WHEN the Administrador submits a PUT
- THEN the system returns 400 `VALIDATION_MAX_EJERCICIOS` and changes nothing

#### Scenario: Malformed body rejected

- GIVEN a PUT body that is not an object, or whose `ejercicioIds` is not an array
- WHEN the request reaches the API
- THEN the system returns 400 `VALIDATION_ERROR`

### Requirement: Read Associated Exercises

The system **MUST** expose `GET /api/maquinas/[id]/ejercicios` returning the exercises associated with the machine. Each entry **MUST** contain at least `id`, `nombre`, and `grupoMuscular`. When the machine does not exist, the endpoint **MUST** return 404 `NOT_FOUND` ("Máquina no encontrada"). The endpoint is ADMINISTRADOR-only (see Permission Requirement).

#### Scenario: List associated exercises

- GIVEN machine `M1` associated with exercises `E1` and `E2`
- WHEN the Administrador calls `GET /api/maquinas/M1/ejercicios`
- THEN the system returns `[{ id: E1, nombre, grupoMuscular }, { id: E2, nombre, grupoMuscular }]`

#### Scenario: Empty association list

- GIVEN machine `M1` with no associations
- WHEN the Administrador calls `GET /api/maquinas/M1/ejercicios`
- THEN the system returns an empty array (not an error)

#### Scenario: Missing machine returns 404

- GIVEN an id that matches no machine
- WHEN the Administrador calls `GET /api/maquinas/<missing>/ejercicios`
- THEN the system returns 404 `NOT_FOUND` with "Máquina no encontrada"

### Requirement: Replace Associated Exercises

The system **MUST** expose `PUT /api/maquinas/[id]/ejercicios` as a **full replacement** of the association set, receiving `{ ejercicioIds: string[] }`. It **MUST**:

- Validate the input per the Assignment Input Validation requirement.
- Return 404 `NOT_FOUND` when the machine does not exist (checked **before** exercising the association write).
- Atomically replace the set inside a single `prisma.$transaction` (validate all ids exist, then `deleteMany` + `createMany`), so a concurrent read cannot observe a half-applied state.
- Return the new association list (same shape as GET).
- Last-writer-wins: concurrent PUTs on the same machine are not optimistic-locked; the latest write wins.

#### Scenario: Replacement persists atomically

- GIVEN machine `M1` associated with `[E1, E2]`
- WHEN the Administrador submits `PUT` with `ejercicioIds: ["E2", "E3"]`
- THEN the system replaces the set so `M1` is now associated with `[E2, E3]`, and returns that new list

#### Scenario: Replace on a missing machine returns 404

- GIVEN an id that matches no machine
- WHEN the Administrador submits `PUT`
- THEN the system returns 404 `NOT_FOUND` with "Máquina no encontrada", without writing anything

#### Scenario: Empty replacement removes all associations

- GIVEN machine `M1` associated with `[E1, E2]`
- WHEN the Administrador submits `PUT` with `ejercicioIds: []`
- THEN the system removes all associations and returns `[]`

### Requirement: Audit Trail for Assignment

The system **MUST** record a best-effort `MODIFICACION` audit entry on a successful PUT, via `registrarOperacion`, with `detalles: { maquinaId, ejerciciosAsignados: n }` (the count of exercises after replacement) and the actor's `responsableId`. An audit failure **MUST NOT** change the HTTP response: the error is logged server-side and the request completes normally.

#### Scenario: Successful assignment is audited

- GIVEN the Administrador replaces the set with 3 exercises
- WHEN the PUT succeeds
- THEN `registrarOperacion` is called with tipoOperacion="MODIFICACION", responsableId = the actor, detalles = { maquinaId, ejerciciosAsignados: 3 }

#### Scenario: Audit failure does not alter the response

- GIVEN `registrarOperacion` throws
- WHEN the PUT succeeds
- THEN the HTTP response is unchanged (200 with the new list); the audit error is logged server-side

### Requirement: Machine Delete Uses the Real Association Count

The system **MUST** wire the real association count into machine deletion. `handleMaquinaDelete` **MUST** query the repository for the real `ejerciciosAsociados` count (`contarEjerciciosAsociados`) and pass it to the **unchanged** pure function `puedeEliminar(maquina, { ejerciciosAsociados })`. When the count is 0 the delete proceeds physically. When the count is > 0 the handler **MUST** return 409 `DELETE_BLOCKED_EJERCICIOS` with message "No se puede eliminar: N ejercicios usan esta máquina" (already mapped in `route-error-mapper.ts`).

#### Scenario: Machine with associations cannot be deleted

- GIVEN machine `M1` with 3 associated exercises
- WHEN the Administrador calls `DELETE /api/maquinas/M1`
- THEN the system returns 409 `DELETE_BLOCKED_EJERCICIOS` with "No se puede eliminar: 3 ejercicios usan esta máquina", and the machine is not deleted

#### Scenario: Machine with zero associations deletes physically

- GIVEN machine `M1` with 0 associated exercises
- WHEN the Administrador calls `DELETE /api/maquinas/M1`
- THEN the system deletes the machine physically and returns success

### Requirement: Exercise Deletion Is Not Blocked by the New Relation

The new `EjercicioMaquina` relation **MUST NOT** introduce a new deletion-blocking path for exercises. Deleting an exercise that has machine associations **MUST** succeed, with the M2M rows cleaned up by `onDelete: Cascade`. The existing `DELETE_BLOCKED_ASSIGNED` (409) behavior from `EjercicioEnRutina` (onDelete: Restrict) and `RegistroDeProgreso` (onDelete: Restrict) **MUST** remain unchanged: an exercise still referenced by a routine or progress history is still blocked via `P2003` → `DELETE_BLOCKED_ASSIGNED`.

#### Scenario: Exercise with machine links deletes cleanly

- GIVEN exercise `E1` associated with machine `M1`, and NOT referenced by any routine or progress record
- WHEN the user deletes `E1`
- THEN the exercise is removed and its `EjercicioMaquina` rows cascade away

#### Scenario: Exercise in a routine is still blocked

- GIVEN exercise `E1` referenced by an `EjercicioEnRutina` row AND associated with a machine
- WHEN the user deletes `E1`
- THEN the system returns 409 `DELETE_BLOCKED_ASSIGNED` (from the routine relation), and the machine association is irrelevant to the outcome

### Requirement: ADMINISTRADOR-Only Access

The new nested path `/api/maquinas/[id]/ejercicios` **MUST** inherit the ADMINISTRADOR-only restriction of the `/api/maquinas` prefix in **both** permission matrices:

- `src/middleware/role-gating.ts` — the existing `"/api/maquinas": [Rol.ADMINISTRADOR]` entry covers the nested path by prefix.
- `src/lib/authorization.ts` — the ADMINISTRADOR `'*'` wildcard grants access; no defensive entry is added.

`RECEPCIONISTA`, `INSTRUCTOR`, and `SOCIO` **MUST** be denied (403 `FORBIDDEN`) on both `GET` and `PUT`. Handler-level defense in depth **MUST** declare `ALLOWED_ROLES = ["ADMINISTRADOR"]` (consistent with the existing `/api/maquinas` route).

#### Scenario: Administrador allowed

- GIVEN an authenticated Administrador
- WHEN they call `GET` or `PUT /api/maquinas/[id]/ejercicios`
- THEN access is granted

#### Scenario: Recepcionista denied

- GIVEN an authenticated Recepcionista
- WHEN they call `GET` or `PUT /api/maquinas/[id]/ejercicios`
- THEN the system returns 403 `FORBIDDEN` ("Se requiere rol de administrador")

#### Scenario: Instructor denied

- GIVEN an authenticated Instructor
- WHEN they call `GET` or `PUT /api/maquinas/[id]/ejercicios`
- THEN the system returns 403 `FORBIDDEN`

#### Scenario: Socio denied

- GIVEN an authenticated Socio
- WHEN they call `GET` or `PUT /api/maquinas/[id]/ejercicios`
- THEN the system returns 403 `FORBIDDEN`

### Requirement: `/maquinas` Expanded Row and Assignment UI

The system **MUST** restore the expandable-row affordance on `/maquinas`:

- `disclosure` **MUST** be added to `TableHeader` and `TableRow` (rendering the chevron, rotated when selected), following the `EjercicioListPanel` pattern.
- A `TableDetailRow` **MUST** render under the selected row, listing the associated exercises (name + muscle group) fetched via `GET /api/maquinas/[id]/ejercicios`, with an "Asignar ejercicios" button.
- The empty state **MUST** render "Sin ejercicios asignados".

#### Scenario: Expanded row lists associated exercises

- GIVEN the Administrador on `/maquinas` clicks a machine row with 2 associated exercises
- WHEN the row expands
- THEN the detail row lists both exercises (name + muscle group) and shows the "Asignar ejercicios" button

#### Scenario: Expanded row shows the empty state

- GIVEN the Administrador expands a machine with no associations
- WHEN the detail row renders
- THEN it shows "Sin ejercicios asignados" and the "Asignar ejercicios" button

### Requirement: Assignment Modal

The system **MUST** provide an accessible modal (`useModalA11y`: `role="dialog"`, `aria-labelledby`, Escape closes, focus trap, focus return) to assign/unassign exercises, containing:

- A debounced (~300ms) accent-insensitive search input that queries `GET /api/ejercicios?search=<term>&limit=50`.
- Paginated results — the modal **MUST NEVER** load all exercises at once; empty search returns the first page only.
- Multi-select checkboxes; "Seleccionar todo visible" scoped to the current page.
- Save via `PUT /api/maquinas/[id]/ejercicios` (a single atomic write of the full `ejercicioIds` array).
- A success notice on save; `handleApiError` surfacing Spanish error messages on failure.

#### Scenario: Modal opens accessibly

- GIVEN the Administrador clicks "Asignar ejercicios"
- WHEN the modal opens
- THEN it has `role="dialog"`, focus moves into the dialog, and focus is trapped

#### Scenario: Escape closes the modal

- GIVEN the modal is open
- WHEN the Administrador presses Escape
- THEN the modal closes and focus returns to the "Asignar ejercicios" button

#### Scenario: Debounced accent-insensitive search

- GIVEN the modal's search input
- WHEN the Administrador types "triceps" (accent-less)
- THEN the modal queries the server and matches exercises named "Tríceps" (accent-insensitive), debounced ~300ms

#### Scenario: Paginated results never load the full catalog

- GIVEN an empty search
- WHEN the modal fetches exercises
- THEN it requests `GET /api/ejercicios?limit=50` and renders at most the first 50 rows (never all 1,324)

#### Scenario: Save persists via PUT

- GIVEN the Administrador checks/unchecks several exercises
- WHEN they click save
- THEN the modal calls `PUT /api/maquinas/[id]/ejercicios` with the full `ejercicioIds` array, shows a success notice on success, and the expanded row refreshes

#### Scenario: Save failure surfaces an error toast

- GIVEN the PUT fails with a mapped error (e.g. 400 `VALIDATION_ERROR`)
- WHEN the Administrador saves
- THEN `handleApiError` surfaces the Spanish message as an error toast and the modal stays open with the selection intact

### Requirement: Exercise Search Pagination

The system **MUST** extend `GET /api/ejercicios` with optional pagination params (see the `ejercicios-crud` delta spec for the authoritative requirement):

- `limit` — default 20, max 50.
- `offset` — default 0.

The accent-insensitive `unaccent` search and the `muscleGroup` filter **MUST** be preserved on the paginated path. The modal uses this endpoint with `limit=50`; the existing `/ejercicios` screen does not pass these params, so its behavior is unchanged.

#### Scenario: Paginated list caps the result size

- GIVEN 1,324 exercises
- WHEN the client calls `GET /api/ejercicios?limit=50`
- THEN the system returns at most 50 rows

#### Scenario: Accent-insensitive search preserved with pagination

- GIVEN the search term "triceps" and `limit=50`
- WHEN the client calls `GET /api/ejercicios?search=triceps&limit=50`
- THEN the system returns at most 50 accent-insensitive matches, term always parameterized (never interpolated into SQL)

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| Permissive association (exercise with no machines is valid) | `EjercicioMaquina` join + PUT empty set |
| Admin-only management (RN-06 / D-73) | `/api/maquinas/[id]/ejercicios` + `/maquinas` UI |
| Machine deletion gated by associations | `puedeEliminar` real count → 409 `DELETE_BLOCKED_EJERCICIOS` |
| Exercise deletion unaffected by the new relation | `onDelete: Cascade` on `ejercicio → EjercicioMaquina` |

## Acceptance Criteria

- **AC-201**: `EjercicioMaquina` join model exists with `@@unique([maquinaId, ejercicioId])`, secondary indexes on both FKs, `onDelete: Cascade` on both sides, and relation fields on `Ejercicio` and `Maquina`.
- **AC-202**: The hand-written migration is additive only (`CREATE TABLE` + 3 `CREATE INDEX`; 0 occurrences of `DROP`, `ALTER`, or `Maquina_nombre_ubicacion_key`) and applies cleanly against the ephemeral Docker Postgres.
- **AC-203**: `validarAsignacionEjercicios` enforces existence, no-duplicates, `<= MAX_EJERCIOS_POR_MAQUINA` (50), and accepts the empty set `[]`.
- **AC-204**: `GET /api/maquinas/[id]/ejercicios` returns `{ id, nombre, grupoMuscular }` per associated exercise; 404 `NOT_FOUND` when the machine is missing.
- **AC-205**: `PUT /api/maquinas/[id]/ejercicios` performs full replacement with validation: unknown ids → 400 `VALIDATION_ERROR`, duplicates → 400 `VALIDATION_ERROR`, >50 → 400 `VALIDATION_MAX_EJERCICIOS`, empty allowed; returns the new list.
- **AC-206**: `PUT /api/maquinas/[id]/ejercicios` returns 404 `NOT_FOUND` when the machine is missing, without writing anything.
- **AC-207**: A successful PUT audits `MODIFICACION` with `{ maquinaId, ejerciciosAsignados: n }` best-effort; audit failure never changes the response.
- **AC-208**: `handleMaquinaDelete` uses the real `ejerciciosAsociados` count; >0 → 409 `DELETE_BLOCKED_EJERCICIOS` ("No se puede eliminar: N ejercicios usan esta máquina"); 0 → physical delete.
- **AC-209**: Deleting an exercise with machine associations succeeds (M2M rows cascade); deleting an exercise in a routine still returns 409 `DELETE_BLOCKED_ASSIGNED`.
- **AC-210**: `/api/maquinas/[id]/ejercicios` is ADMINISTRADOR-only via the `/api/maquinas` prefix in both matrices; RECEPCIONISTA, INSTRUCTOR, SOCIO → 403 on GET and PUT.
- **AC-211**: `GET /api/ejercicios` gains optional `limit` (default 20, max 50) and `offset` (default 0); invalid/non-numeric/negative → 400 `VALIDATION_ERROR`; `unaccent` search and `muscleGroup` preserved; backwards-compatible when omitted.
- **AC-212**: `/maquinas` restores the `disclosure` chevron and the expanded row listing associated exercises (name + muscle group) with an "Asignar ejercicios" button and empty state "Sin ejercicios asignados".
- **AC-213**: The assignment modal is accessible (`role="dialog"`, Escape, focus trap, focus return), debounces accent-insensitive search (~300ms), paginates results (never all at once), multi-selects, and saves via `PUT`.
- **AC-214**: The modal shows a success notice on save and surfaces failures via `handleApiError`.
- **AC-215**: `matrix-consistency.test.ts` proves the nested path is denied for non-ADMIN roles via the prefix match; the full `npm test`, `npm run test:integration`, `tsc --noEmit`, and `eslint` stay green with no new errors (P-57 recorded in `openspec/decisions.md`).

## Acceptance Criteria → Test Traceability

| AC | Test file | Test name(s) |
|----|-----------|--------------|
| AC-201 | `tests/integration/ejercicio-maquina.integration.test.ts` | "creates the EjercicioMaquina table and unique index"; "enforces @@unique([maquinaId, ejercicioId])"; "cascades on exercise delete"; "cascades on machine delete (count=0 path)" |
| AC-202 | `tests/integration/ejercicio-maquina.integration.test.ts` | "applies the additive migration with 4 statements and no DROP/ALTER" |
| AC-203 | `src/domains/maquina/maquina.test.ts` | "validarAsignacionEjercicios rejects unknown ids", "rejects duplicates", "rejects > 50", "accepts empty set", "accepts valid distinct ids" |
| AC-204 | `src/app/api/maquinas/[id]/ejercicios/route.test.ts`, `src/api/maquinas.test.ts` | "GET returns associated exercises (id/nombre/grupoMuscular)", "GET returns empty list", "GET 404 on missing machine" |
| AC-205 | `src/app/api/maquinas/[id]/ejercicios/route.test.ts`, `src/api/maquinas.test.ts` | "PUT validates unknown ids (400)", "PUT validates duplicates (400)", "PUT validates >50 (400 VALIDATION_MAX_EJERCICIOS)", "PUT accepts empty set", "PUT replaces and returns the new list" |
| AC-206 | `src/app/api/maquinas/[id]/ejercicios/route.test.ts` | "PUT 404 on missing machine without writing" |
| AC-207 | `src/app/api/maquinas/[id]/ejercicios/route.test.ts` | "PUT audits MODIFICACION with { maquinaId, ejerciciosAsignados }", "audit failure does not change the response" |
| AC-208 | `src/api/maquinas.test.ts`, `src/app/api/maquinas/[id]/route.delete.test.ts` | "DELETE uses real count and returns 409 DELETE_BLOCKED_EJERCICIOS", "DELETE with 0 associations deletes physically" |
| AC-209 | `tests/integration/ejercicio-maquina.integration.test.ts`, `src/domains/ejercicio/ejercicio-repositorio.test.ts` | "exercise with machine links deletes cleanly", "exercise in a routine still returns DELETE_BLOCKED_ASSIGNED" |
| AC-210 | `src/middleware/matrix-consistency.test.ts`, `src/app/api/maquinas/[id]/ejercicios/route.test.ts` | "denies RECEPCIONISTA/INSTRUCTOR/SOCIO on /api/maquinas/1/ejercicios via prefix", "route rejects non-ADMIN roles" |
| AC-211 | `src/domains/ejercicio/ejercicio-repositorio.test.ts`, `src/app/api/ejercicios/route.test.ts` | "getAll applies limit/offset", "rejects non-numeric/negative limit/offset (400)", "preserves unaccent search with pagination", "backwards-compatible defaults" |
| AC-212 | `src/components/maquina-crud/maquina-list.test.tsx`, `maquina-expanded-row.test.tsx` | "renders disclosure chevron", "expands row with associated exercises", "shows Sin ejercicios asignados", "shows Asignar ejercicios button" |
| AC-213 | `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` | "role=dialog and focus trap", "Escape closes and returns focus", "debounced accent-insensitive search", "paginated results (limit=50)", "multi-select checkboxes" |
| AC-214 | `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` | "success notice on save", "handleApiError toast on failure" |
| AC-215 | `src/middleware/matrix-consistency.test.ts` | "guards stay green"; full `npm test` + `npm run test:integration` + `tsc --noEmit` + `eslint` |

## Edge Cases

- **Exercise in a routine AND associated with a machine**: the `Restrict` on `EjercicioEnRutina` fires first (P2003 → `DELETE_BLOCKED_ASSIGNED`); the machine association is irrelevant.
- **`puedeEliminar` race** (count=0 at check, association added before DELETE): same accepted race as `EjercicioEnRutina` on exercise deletion; `onDelete: Cascade` keeps the DB consistent (no integrity violation).
- **Concurrent PUTs on the same machine**: `reemplazarEjerciciosAsociados` runs in a single transaction; PUT is last-writer-wins (no optimistic lock).
- **Empty PUT `[]`**: valid — removes all associations and makes the machine deletable.
- **`unaccent` search + pagination**: the raw-SQL path must keep the term parameterized (`$1`) when adding `LIMIT/OFFSET`, never interpolated.
- **`Maquina_nombre_ubicacion_key` orphan index**: never run `prisma migrate dev`; the new migration must not mention it.

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Machine missing on GET/PUT | NOT_FOUND (404) | "Máquina no encontrada" | Refresh list |
| Unknown exercise id | VALIDATION_ERROR (400) | "Uno o más ejercicios no existen" | Correct selection |
| Duplicate ids | VALIDATION_ERROR (400) | "Hay ejercicios duplicados en la asignación" | Remove duplicates |
| Over 50 exercises | VALIDATION_MAX_EJERCICIOS (400) | "No se pueden asignar más de 50 ejercicios a una máquina" | Reduce selection |
| Machine delete with associations | DELETE_BLOCKED_EJERCICIOS (409) | "No se puede eliminar: N ejercicios usan esta máquina" | Remove exercise relations first |
| Non-ADMIN role | FORBIDDEN (403) | "Se requiere rol de administrador" | Sign in as ADMINISTRADOR |

## Open Questions

- **`enMaquinas` count on the exercise list** (deferred): should `EjercicioConUso` later expose how many machines an exercise is associated with? Recommendation: defer to Etapa 3–5 when the exercise detail needs it; Etapa 2 stays machine-centric.
- **Max exercises as a runtime parameter** (deferred): keep `MAX_EJERCIOS_POR_MAQUINA = 50` as a domain constant in Etapa 2; parameterize in Etapa 4–5 only if the business asks.
