# Delta for ejercicios-crud

## ADDED Requirements

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

## Acceptance Criteria (Delta)

- **AC-008**: `GET /api/ejercicios` accepts optional `limit` (1–50) and `offset` (>= 0); pagination is **opt-in** — when both are omitted the endpoint returns the full match set exactly as before; when at least one is present, omitted values default to 20/0; invalid/non-numeric/negative values (and `limit > 50`) return 400 `VALIDATION_ERROR`.
- **AC-009**: Pagination applies to both the `unaccent` search path and the non-search `findMany` path, preserving `muscleGroup`, name ordering, and `enRutinas`; the search term stays parameterized.

## Acceptance Criteria → Test Traceability

| AC | Test file | Test name(s) |
|----|-----------|--------------|
| AC-008 | `src/app/api/ejercicios/route.test.ts`, `src/domains/ejercicio/ejercicio-repositorio.test.ts` | "parses limit/offset with defaults", "rejects non-numeric/negative/out-of-range limit (400)", "rejects invalid offset (400)", "backwards-compatible when params omitted" |
| AC-009 | `src/domains/ejercicio/ejercicio-repositorio.test.ts` | "getAll applies take/skip on findMany path", "getAll appends LIMIT/OFFSET to the search query with parameterized term", "preserves muscleGroup filter and enRutinas count" |
