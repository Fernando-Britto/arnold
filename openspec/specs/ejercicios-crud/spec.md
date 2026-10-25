# Ejercicios CRUD Specification

## Purpose

Create, read, update, and delete Ejercicio records (nombre, grupoMuscular, descripcion) via the FormPanel + ListPanel layout pattern.

## Requirements

### Requirement: Staff-Only CRUD Access

The system **MUST** restrict access to Ejercicios CRUD to Administrador and Instructor roles (RN-06); full gating mechanics in `openspec/specs/rbac-middleware/spec.md`.

#### Scenario: Instructor accesses Ejercicios CRUD

- GIVEN an authenticated Instructor
- WHEN they navigate to the Ejercicios screen
- THEN FormPanel and ListPanel render

#### Scenario: Socio blocked from Ejercicios CRUD

- GIVEN an authenticated Socio
- WHEN they attempt to navigate to the Ejercicios screen
- THEN the system denies access and redirects to Home_Socio

### Requirement: Ejercicio Creation Validation

The system **MUST** validate `nombre` (required, 3–100 chars), `grupoMuscular` (required, from predefined list), and `descripcion` (optional, max 500 chars) before persisting a new Ejercicio.

#### Scenario: Valid creation succeeds

- GIVEN nombre="Press Militar", grupoMuscular="Hombros", descripcion="Ejercicio de empuje vertical"
- WHEN the user submits the FormPanel
- THEN the system creates the Ejercicio, populates the read-only ID field, and adds it to ListPanel

#### Scenario: Missing required field rejected

- GIVEN nombre="" (empty)
- WHEN the user submits the FormPanel
- THEN the system rejects the submission with a field-level error on Nombre and does not persist

#### Scenario: Nombre below minimum length rejected

- GIVEN nombre="Ab" (2 chars)
- WHEN the user submits
- THEN the system rejects with "Mínimo 3 caracteres"

#### Scenario: Descripcion exceeding max length rejected

- GIVEN descripcion is 501 characters
- WHEN the user submits
- THEN the system rejects with "Máximo 500 caracteres"

### Requirement: Ejercicio Edit Flow

The system **MUST** load an existing Ejercicio's data into FormPanel when selected from ListPanel, and apply the same validation rules on update.

#### Scenario: Select row loads form for edit

- GIVEN ListPanel shows an existing Ejercicio
- WHEN the user clicks "Modify" on that row
- THEN FormPanel populates with the Ejercicio's current nombre, grupoMuscular, descripcion, and ID

#### Scenario: Update persists changes

- GIVEN FormPanel is populated for edit and the user changes descripcion
- WHEN the user submits
- THEN the system updates the existing Ejercicio record (same ID) and reflects the change in ListPanel

### Requirement: Ejercicio Deletion with Confirmation

The system **MUST** require confirmation before deleting an Ejercicio, and **MUST** prevent deletion if the Ejercicio is referenced by any EjercicioEnRutina.

#### Scenario: Delete unreferenced exercise

- GIVEN an Ejercicio with zero EjercicioEnRutina references
- WHEN the user clicks Delete and confirms
- THEN the system removes the Ejercicio and it disappears from ListPanel

#### Scenario: Delete blocked for referenced exercise

- GIVEN an Ejercicio referenced by at least one EjercicioEnRutina (in use by a Rutina)
- WHEN the user clicks Delete
- THEN the system rejects deletion with a message indicating the exercise is in use, and does not remove it

### Requirement: ListPanel Search and Sort

The system **MUST** support sorting on Nombre and Grupo muscular columns, and filtering (search) by name/muscle group via the ActionBar Search button.

#### Scenario: Search filters by name substring

- GIVEN ListPanel has Ejercicios named "Press Militar", "Sentadilla", "Press Banca"
- WHEN the user searches "Press"
- THEN ListPanel shows only "Press Militar" and "Press Banca"

#### Scenario: Sort by Grupo muscular

- GIVEN ListPanel is unsorted
- WHEN the user clicks the Grupo muscular column header
- THEN rows reorder alphabetically by grupoMuscular

### Requirement: Exercise List API Pagination

The system **MUST** extend `GET /api/ejercicios` with optional pagination query params:

- `limit` — number of rows per page. **MUST** be an integer in the range `[1, 50]`. Default `20` when pagination is active (i.e. when at least one of `limit`/`offset` is present) and `limit` is omitted.
- `offset` — number of rows to skip. **MUST** be an integer `>= 0`. Default `0` when pagination is active and `offset` is omitted.

Validation **MUST** apply to both params when present:

- Non-numeric, negative, zero (for `limit`), or `limit > 50` values **MUST** return 400 `VALIDATION_ERROR`.
- `offset` negative or non-numeric **MUST** return 400 `VALIDATION_ERROR`.

Pagination is **opt-in**: when neither `limit` nor `offset` is present, no `LIMIT`/`OFFSET` is applied and the endpoint returns the full match set. This is required because the existing `/ejercicios` screen paginates client-side and MUST keep receiving the full list.

The pagination **MUST** apply to **both** query paths in `EjercicioRepository.getAll`:

- The `unaccent` accent-insensitive search path (`$queryRaw`): the `LIMIT`/`OFFSET` **MUST** be appended while keeping the search term parameterized (never interpolated into the SQL string). The `muscleGroup` filter **MUST** be preserved.
- The non-search `findMany` path: `take`/`skip` **MUST** be applied while preserving the `muscleGroup` filter, name ordering, and the `enRutinas` `_count`.

When both params are omitted, the endpoint **MUST** behave exactly as before (backwards-compatible): the existing `/ejercicios` screen does not pass these params, so its behavior is unchanged.

#### Scenario: Default behavior when params omitted

- GIVEN `GET /api/ejercicios` with no `limit`/`offset`
- WHEN the request is processed
- THEN the endpoint returns all matches exactly as before (backwards-compatible)

#### Scenario: Limit caps the result size

- GIVEN `GET /api/ejercicios?limit=50`
- WHEN the request is processed
- THEN the endpoint returns at most 50 rows

#### Scenario: Offset skips rows

- GIVEN `GET /api/ejercicios?limit=20&offset=20`
- WHEN the request is processed
- THEN the endpoint returns rows 21..40 (skipping the first 20)

#### Scenario: Accent-insensitive search preserved with pagination

- GIVEN `GET /api/ejercicios?search=triceps&limit=50`
- WHEN the request is processed
- THEN the endpoint returns at most 50 accent-insensitive matches ("Tríceps" matches "triceps"), with the search term always parameterized

#### Scenario: Invalid limit rejected

- GIVEN `GET /api/ejercicios?limit=abc` (or `limit=0`, `limit=-1`, `limit=51`)
- WHEN the request is processed
- THEN the endpoint returns 400 `VALIDATION_ERROR`

#### Scenario: Invalid offset rejected

- GIVEN `GET /api/ejercicios?offset=-5` (or `offset=abc`)
- WHEN the request is processed
- THEN the endpoint returns 400 `VALIDATION_ERROR`

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-06 (role-based access) | CRUD screen access gating (xref: rbac-middleware spec) |

Note: Ejercicio has no dedicated RN in requirements.md beyond RN-06 access gating; referential integrity (blocking delete when in use) is a data-model constraint derived from the EjercicioEnRutina relationship, not a numbered RN.

## Acceptance Criteria

- **AC-001**: Nombre is required, 3–100 chars; violating either bound blocks submission with a field-level error.
- **AC-002**: Grupo muscular is required and restricted to the predefined system list; free text is rejected.
- **AC-003**: Descripcion is optional; when present, capped at 500 chars.
- **AC-004**: ID field is always read-only and populated only after successful creation.
- **AC-005**: Delete is blocked when the Ejercicio is referenced by any EjercicioEnRutina row.
- **AC-006**: Search filters ListPanel by nombre or grupoMuscular substring match, debounced 300ms.
- **AC-007**: Non-Administrador/Instructor roles cannot reach this screen.
- **AC-008**: `GET /api/ejercicios` accepts optional `limit` (1–50) and `offset` (>= 0); pagination is **opt-in** — when both are omitted the endpoint returns the full match set exactly as before; when at least one is present, omitted values default to 20/0; invalid/non-numeric/negative values (and `limit > 50`) return 400 `VALIDATION_ERROR`.
- **AC-009**: Pagination applies to both the `unaccent` search path and the non-search `findMany` path, preserving `muscleGroup`, name ordering, and `enRutinas`; the search term stays parameterized.

## Pending Decisions

- **grupoMuscular predefined list values**: The exact set of allowed values (e.g., "Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Abdomen") is not yet finalized. Design must confirm the complete enumeration before backend validation is implemented.

## Edge Cases

- **Duplicate nombre**: The design does not specify uniqueness on Ejercicio.nombre; duplicates are allowed (e.g., variations of the same lift name), unlike DNI in Clientes.
- **Whitespace-only nombre**: MUST be trimmed and treated as empty, triggering the required-field error.
- **Deleting while referenced elsewhere in an open form**: If another user has the Ejercicio open in an unsaved Rutina edit when it's deleted, the Rutina form MUST show a stale-reference error on next save attempt, not silently drop the row.
- **Grupo muscular list changes**: If the predefined list changes and an existing Ejercicio's grupoMuscular value is no longer in the list, the edit form MUST still show the stored value (read-only fallback) until explicitly changed.

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| nombre="Sentadilla", grupoMuscular="Piernas", descripcion="" | Created; descripcion stored as empty/null |
| nombre="AB" | Rejected: "Mínimo 3 caracteres" |
| Delete Ejercicio used in 2 Rutinas | Rejected: "No se puede eliminar: en uso por 2 rutinas" |
| Search "sentad" (lowercase) | Matches "Sentadilla" (case-insensitive) |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Required field missing | VALIDATION_REQUIRED | Campo requerido | Highlight field, block submit |
| Nombre length invalid | VALIDATION_LENGTH | Nombre debe tener entre 3 y 100 caracteres | Highlight field |
| Delete blocked (in use) | DELETE_BLOCKED_IN_USE | No se puede eliminar: en uso por N rutinas | Suggest removing from routines first |
| Persist failure (DB error) | DB_ERROR | No se pudo guardar el ejercicio | Retry, preserve form state |
