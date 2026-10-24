# Máquinas CRUD Specification

## Purpose

Create, read, update, and delete Maquina records — the gym's physical machine catalog. Each machine carries `nombre`, `ubicacion`, `tipoEquipamiento` (Prisma enum `TipoEquipamiento`), and `estado` (Prisma enum `EstadoMaquina`), plus a read-only `id`, `fechaAlta` and `updatedAt`. This is Etapa 1 of the "asignación dinámica de ejercicios" initiative: it provides the admin-curated catalog that later stages (Ejercicio↔Maquina relations, waitlist/suggestion engine, session-driven `OCUPADA`, Home_Socio visibility) build on.

The catalog is ADMINISTRADOR-only. Writes are validated, normalized, uniqueness-checked, and audited. `OCUPADA` is a derived state owned by the session engine (Etapa 4–5), NOT assignable through CRUD.

## Requirements

### Requirement: Admin-Only Access

The system **MUST** restrict both `/maquinas` (screen) and `/api/maquinas` (API) to the `ADMINISTRADOR` role. `RECEPCIONISTA`, `INSTRUCTOR` and `SOCIO` **MUST** be denied on both routes. The restriction **MUST** be covered in BOTH permission matrices:

- `src/middleware/role-gating.ts` — explicit entries `"/maquinas": [Rol.ADMINISTRADOR]` and `"/api/maquinas": [Rol.ADMINISTRADOR]`.
- `src/lib/authorization.ts` — **no** defensive entry is added; the ADMIN `'*'` wildcard already grants access. An explicit test **MUST** prove that `RECEPCIONISTA`, `INSTRUCTOR` and `SOCIO` are denied in both matrices.

Handler-level defense in depth **SHOULD** also declare `ALLOWED_ROLES = ["ADMINISTRADOR"]` (consistent with `authorization-consistency.test.ts`), even though the proxy wildcard is sufficient.

#### Scenario: Administrador accesses the machine catalog

- GIVEN an authenticated Administrador
- WHEN they navigate to `/maquinas` or call any `/api/maquinas` endpoint
- THEN access is granted (screen renders; API processes the request)

#### Scenario: Recepcionista denied on both routes

- GIVEN an authenticated Recepcionista
- WHEN they attempt to reach `/maquinas` or `/api/maquinas`
- THEN the system denies access (403 FORBIDDEN) in BOTH the `role-gating.ts` matrix and the `authorization.ts` matrix

#### Scenario: Instructor denied on both routes

- GIVEN an authenticated Instructor
- WHEN they attempt to reach `/maquinas` or `/api/maquinas`
- THEN the system denies access (403 FORBIDDEN) in BOTH permission matrices

#### Scenario: Socio denied on both routes

- GIVEN an authenticated Socio
- WHEN they attempt to reach `/maquinas` or `/api/maquinas`
- THEN the system denies access (403 FORBIDDEN) in BOTH permission matrices

### Requirement: Input Validation and Normalization

The system **MUST** validate machine input in the pure domain (`src/domains/maquina/maquina.ts`), with no Prisma import:

- `nombre` — required, 2–80 characters.
- `ubicacion` — required, 2–80 characters.
- `tipoEquipamiento` — required, one of `MAQUINA_GUIADA`, `PESO_LIBRE`, `CARDIO` (the `TipoEquipamiento` Prisma enum).
- `estado` — required, one of `DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA` (`ESTADOS_ASIGNABLES`; see Assignable Estado Rules).

Normalization **MUST** apply `btrim` (trim leading/trailing whitespace) and collapse internal whitespace runs, and case-fold `nombre` and `ubicacion` for comparison purposes. The normalization **MUST** be shared between the domain pre-check and the DB index expression so both layers agree on the canonical form.

#### Scenario: Valid creation succeeds

- GIVEN nombre="Polea baja", ubicacion="Sala principal", tipoEquipamiento="MAQUINA_GUIADA", estado="DISPONIBLE"
- WHEN the Administrador submits the form
- THEN the system creates the machine, populates the read-only `id`, and adds it to the list

#### Scenario: Empty nombre rejected

- GIVEN nombre="" (or whitespace-only)
- WHEN the form submits
- THEN the system rejects with a validation error ("El nombre debe tener entre 2 y 80 caracteres")

#### Scenario: One-character nombre rejected

- GIVEN nombre="A"
- WHEN the form submits
- THEN the system rejects with a validation error

#### Scenario: Eighty-one-character nombre rejected

- GIVEN nombre is 81 characters
- WHEN the form submits
- THEN the system rejects with a validation error

#### Scenario: Invalid tipoEquipamiento rejected

- GIVEN tipoEquipamiento="ELIPTICA" (not a `TipoEquipamiento` value)
- WHEN the form submits
- THEN the system rejects with a validation error ("Tipo de equipamiento inválido")

#### Scenario: Missing ubicacion rejected

- GIVEN ubicacion is absent or empty
- WHEN the form submits
- THEN the system rejects with a validation error ("La ubicación debe tener entre 2 y 80 caracteres")

#### Scenario: Whitespace trimmed and collapsed

- GIVEN nombre="  Polea   baja  " and ubicacion=" Sala   principal "
- WHEN the form submits
- THEN the system normalizes to nombre="Polea baja" and ubicacion="Sala principal" before persistence and uniqueness comparison

### Requirement: Assignable Estado Rules

The system **MUST** only allow `DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA` to be written (the single `ESTADOS_ASIGNABLES` constant). The `OCUPADA` value of the `EstadoMaquina` enum is a derived state set by the session engine (Etapa 4–5); it **MUST NOT** be assignable through CRUD.

- POST or PUT with `estado="OCUPADA"` **MUST** return 400 `ESTADO_NO_ASIGNABLE`, **even when the value is unchanged** on PUT.
- GET list **MUST** return an existing `OCUPADA` row as-is (no filtering, no coercion).
- The edit UI **MUST** force the Administrador to pick one of the three assignable values, including for a row currently stored as `OCUPADA` (the seeded "Polea alta").

#### Scenario: POST with OCUPADA rejected

- GIVEN the Administrador submits a create with estado="OCUPADA"
- WHEN the request reaches the API
- THEN the system returns 400 with code `ESTADO_NO_ASIGNABLE`

#### Scenario: PUT with OCUPADA on a DISPONIBLE row rejected

- GIVEN a machine currently `DISPONIBLE`
- WHEN the Administrador submits a PUT changing estado to "OCUPADA"
- THEN the system returns 400 with code `ESTADO_NO_ASIGNABLE`

#### Scenario: PUT with unchanged OCUPADA still rejected

- GIVEN a machine currently stored as `OCUPADA` (e.g. the seeded "Polea alta" on an already-seeded DB)
- WHEN the Administrador submits a PUT that leaves estado="OCUPADA" (value unchanged)
- THEN the system returns 400 with code `ESTADO_NO_ASIGNABLE` — the write is rejected, not silently accepted

#### Scenario: Assignable estados accepted on write

- GIVEN estado="FUERA_DE_SERVICIO" (and separately "DISPONIBLE", "INACTIVA")
- WHEN the Administrador creates or updates a machine
- THEN the system persists the value

#### Scenario: List returns an existing OCUPADA row as-is

- GIVEN a machine whose stored `estado` is `OCUPADA`
- WHEN the Administrador loads the list
- THEN the row is returned with estado="OCUPADA" (unchanged, unfiltered)

#### Scenario: Edit UI forces an assignable estado for an OCUPADA row

- GIVEN the Administrador opens the edit modal for a machine stored as `OCUPADA`
- WHEN the estado field renders
- THEN the field offers only `DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA`, and the form cannot be submitted while it still carries `OCUPADA`

### Requirement: Uniqueness of nombre + ubicacion

The system **MUST** reject any two machines with the same `nombre` AND `ubicacion`, compared case- and accent-insensitively. Duplicates are rejected with 409 `DUPLICATE_NOMBRE_UBICACION`.

Uniqueness is a **two-layer** design:

1. **Database unique index** — a hand-written migration (following D-70's pattern) adds `CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key" ON "Maquina" (lower(btrim(nombre)), lower(btrim(ubicacion)))`. This layer is race-safe (no TOCTOU) and prevents raw-equal duplicates, but it does **not** fold accents.
2. **Domain pre-check** — the domain applies accent-insensitive comparison (using the already-installed `unaccent` extension in a query) to surface `DUPLICATE_NOMBRE_UBICACION` with a friendly message **before** the insert, covering accent-only collisions ("Polea" vs "Poléa") that the index does not catch.

The repository **MUST** also catch Prisma `P2002` (unique violation from the index) and re-throw it as `DUPLICATE_NOMBRE_UBICACION`, so a concurrent insert that races past the pre-check is still rejected.

**Why `unaccent()` cannot live in the index**: Postgres requires index expressions to be `IMMUTABLE`; `unaccent()` is declared `STABLE` (its output can vary with the `unaccent` dictionary configuration). Therefore `lower(unaccent(nombre))` cannot be part of the index, and the index uses `lower(btrim(...))` only. The accent fold is enforced at the domain layer instead. This tradeoff is intentional and documented.

#### Scenario: Exact duplicate rejected

- GIVEN a machine "Polea alta" / "Sala principal" exists
- WHEN the Administrador creates another "Polea alta" / "Sala principal"
- THEN the system returns 409 with code `DUPLICATE_NOMBRE_UBICACION`

#### Scenario: Case-only duplicate rejected

- GIVEN a machine "Polea alta" / "Sala principal" exists
- WHEN the Administrador creates "polea alta" / "sala principal"
- THEN the system returns 409 with code `DUPLICATE_NOMBRE_UBICACION`

#### Scenario: Accent-only duplicate rejected by domain pre-check

- GIVEN a machine "Polea" / "Sala principal" exists
- WHEN the Administrador creates "Poléa" / "Sala principal"
- THEN the domain pre-check returns the same friendly 409 `DUPLICATE_NOMBRE_UBICACION` (the index alone would not catch this, since it does not fold accents)

#### Scenario: Same name, different ubicacion allowed

- GIVEN a machine "Prensa de piernas" / "Sala principal" exists
- WHEN the Administrador creates "Prensa de piernas" / "Sala de musculación"
- THEN the system creates the machine (different ubicacion, no collision)

#### Scenario: Same ubicacion, different name allowed

- GIVEN a machine "Prensa de piernas" / "Sala principal" exists
- WHEN the Administrador creates "Prensa de piernas 2" / "Sala principal"
- THEN the system creates the machine (different nombre, no collision)

### Requirement: List, Filters and Search

The system **MUST** expose `GET /api/maquinas` returning all machines. The list **MUST** support:

- `estado` filter (exact match on the `EstadoMaquina` enum value).
- `tipoEquipamiento` filter (exact match on the `TipoEquipamiento` enum value).
- `nombre` substring search, case-insensitive (matching the `/membresias` list-panel convention).

Filters **MAY** be combined (all applied conjunctively).

#### Scenario: List returns all machines

- GIVEN the machine table has N machines
- WHEN the Administrador calls GET /api/maquinas with no filters
- THEN the system returns all N machines

#### Scenario: Filter by estado

- GIVEN machines in mixed estados
- WHEN the Administrador calls GET /api/maquinas?estado=DISPONIBLE
- THEN the system returns only machines with estado="DISPONIBLE"

#### Scenario: Filter by tipoEquipamiento

- GIVEN machines of mixed types
- WHEN the Administrador calls GET /api/maquinas?tipoEquipamiento=CARDIO
- THEN the system returns only CARDIO machines

#### Scenario: nombre substring search is case-insensitive

- GIVEN a machine "Prensa de piernas"
- WHEN the Administrador calls GET /api/maquinas?nombre=prensa
- THEN the system returns the machine (case-insensitive substring match)

#### Scenario: Combined filters

- GIVEN machines of mixed estados and types
- WHEN the Administrador calls GET /api/maquinas?estado=DISPONIBLE&tipoEquipamiento=PESO_LIBRE&nombre=banco
- THEN the system returns only machines satisfying ALL three constraints

#### Scenario: Empty result

- GIVEN no machine matches the filter/search criteria
- WHEN the Administrador calls GET /api/maquinas with those criteria
- THEN the system returns an empty list (not an error)

### Requirement: Read by id

The system **MUST** expose `GET /api/maquinas/[id]` returning the machine matching `id`, or 404 `NOT_FOUND` with a Spanish message when no machine matches.

#### Scenario: Read existing machine

- GIVEN a machine with a known id
- WHEN the Administrador calls GET /api/maquinas/[id]
- THEN the system returns the machine

#### Scenario: Read missing machine returns 404 with Spanish message

- GIVEN an id that matches no machine
- WHEN the Administrador calls GET /api/maquinas/[id]
- THEN the system returns 404 with code `NOT_FOUND` and message "Máquina no encontrada"

### Requirement: Update

The system **MUST** expose `PUT /api/maquinas/[id]`. Update **MUST**:

- Validate the same rules as create (nombre, ubicacion, tipoEquipamiento, assignable estado).
- Apply the same normalization.
- Update the machine fields.
- Audit `MODIFICACION` (including an estado-only change).
- Return 404 `NOT_FOUND` when the id does not exist.
- Return 409 `DUPLICATE_NOMBRE_UBICACION` when the update collides with another machine's nombre+ubicacion.

#### Scenario: Valid update succeeds

- GIVEN a machine with a known id
- WHEN the Administrador submits a PUT with a valid nombre, ubicacion, tipoEquipamiento and assignable estado
- THEN the system updates the machine and returns the updated record

#### Scenario: Estado-only update is audited

- GIVEN a machine currently `DISPONIBLE`
- WHEN the Administrador submits a PUT that changes only estado to "FUERA_DE_SERVICIO"
- THEN the system persists the change and records `MODIFICACION` in the audit trail

#### Scenario: Update of missing machine returns 404

- GIVEN an id that matches no machine
- WHEN the Administrador submits a PUT
- THEN the system returns 404 with code `NOT_FOUND`

#### Scenario: Update colliding with another machine returns 409

- GIVEN a machine "A" with a known id, and a second machine "B" named "Polea alta" / "Sala principal"
- WHEN the Administrador submits a PUT on "A" setting nombre="Polea alta" and ubicacion="Sala principal"
- THEN the system returns 409 with code `DUPLICATE_NOMBRE_UBICACION`

### Requirement: Delete and the `puedeEliminar` extension point

The system **MUST** expose `DELETE /api/maquinas/[id]`. In Etapa 1 the delete is **physical** (the `Maquina` model has no relations). The handler **MUST** consult the pure function:

```
puedeEliminar(maquina, { ejerciciosAsociados }) → { permitido: boolean, motivo: string | null }
```

In Etapa 1 the handler passes `ejerciciosAsociados = 0`, so `puedeEliminar` returns `{ permitido: true, motivo: null }` and the delete proceeds. The spec **MUST** document that Etapa 2 will pass the real `Ejercicio↔Maquina` count and map a denial to 409 with code `DELETE_BLOCKED_EJERCICIOS` (introduced rather than reusing `DELETE_BLOCKED_ASSIGNED`, because the message template differs: "N ejercicios usan esta máquina" vs "N socios asignados", and the code is part of the API contract). The pure function's blocked branch **MUST** be unit-tested now with a non-zero `ejerciciosAsociados`, even though the Etapa 1 API always passes 0.

#### Scenario: Permitted delete

- GIVEN a machine with a known id and `ejerciciosAsociados = 0`
- WHEN the Administrador calls DELETE /api/maquinas/[id] and confirms
- THEN the system physically removes the machine and returns success

#### Scenario: Delete of missing machine returns 404

- GIVEN an id that matches no machine
- WHEN the Administrador calls DELETE /api/maquinas/[id]
- THEN the system returns 404 with code `NOT_FOUND`

#### Scenario: `puedeEliminar` blocked branch (unit-tested now, wired in Etapa 2)

- GIVEN `puedeEliminar(maquina, { ejerciciosAsociados: 3 })`
- WHEN the pure function runs
- THEN it returns `{ permitido: false, motivo: "3 ejercicios usan esta máquina" }` — unit-tested today even though the Etapa 1 API passes 0

### Requirement: Audit Trail

The system **MUST** record a `RegistroDeAuditoria` entry for every write, via `registrarOperacion`, using the `TipoOperacion` enum:

- POST (create) → `ALTA`, `detalles: { maquinaId: result.id }`.
- PUT (update) → `MODIFICACION`, `detalles: { maquinaId: result.id }` (including estado-only changes).
- DELETE → `BAJA`, `detalles: { maquinaId: id }`.

The entry **MUST** include the actor (`responsableId`). Audit is **best-effort**: an audit failure **MUST NOT** change the HTTP response (the error is logged server-side and the request completes normally).

#### Scenario: Create is audited as ALTA

- GIVEN the Administrador creates a machine
- WHEN the write succeeds
- THEN `registrarOperacion` is called with tipoOperacion="ALTA", responsableId = the actor, detalles = { maquinaId }

#### Scenario: Update is audited as MODIFICACION

- GIVEN the Administrador updates a machine
- WHEN the write succeeds
- THEN `registrarOperacion` is called with tipoOperacion="MODIFICACION" and detalles = { maquinaId }

#### Scenario: Delete is audited as BAJA

- GIVEN the Administrador deletes a machine
- WHEN the delete succeeds
- THEN `registrarOperacion` is called with tipoOperacion="BAJA" and detalles = { maquinaId }

#### Scenario: Audit failure does not alter the response

- GIVEN `registrarOperacion` throws (e.g. the audit DB write fails)
- WHEN the create/update/delete completes
- THEN the HTTP response is unchanged (the write still returns its normal status); the audit error is logged server-side

### Requirement: `/maquinas` Screen

The system **MUST** provide an ADMINISTRADOR-only screen at `src/app/maquinas/page.tsx`, modeled on `/membresias`, with:

- A table listing machines.
- `estado` and `tipoEquipamiento` filters and a `nombre` search.
- Create and edit via a modal form.
- Delete via `ConfirmDialog` (reusing `useModalA11y` for Esc/focus-trap/focus-return).
- Notices via `NotificationProvider`.
- Error surfacing via `handleApiError`.
- Reuse of `src/components/ui/` layout components (`CrudPageLayout`, `FormPanelShell`, `ListPanelShell`, `CrudActions`, `ConfirmDialog`) and the `use-modal-a11y` hook (`src/hooks/use-modal-a11y.ts`).

New components live under `src/components/maquina-crud/` (`maquina-form.tsx`, `maquina-list.tsx`, `estado-badge.tsx`). The screen is linked from the staff rail (`src/components/layout/staff-rail.tsx`) in the "Operación" zone, adding `"maquinas"` to the `NavSection` union.

#### Scenario: Screen renders the machine table

- GIVEN an authenticated Administrador on `/maquinas`
- WHEN the page loads
- THEN the machine list renders with estado and tipoEquipamiento filters and a nombre search

#### Scenario: Create machine from the modal

- GIVEN the Administrador opens the create modal
- WHEN they fill valid fields and submit
- THEN the machine is created, a success notice appears, and the list refreshes

#### Scenario: Edit machine, including the forced estado choice

- GIVEN the Administrador opens the edit modal for a machine (including one stored as `OCUPADA`)
- WHEN they change a field and submit
- THEN the update persists and the list refreshes; for an `OCUPADA` row the estado field only offers the three assignable values

#### Scenario: Delete shows confirmation and then deletes

- GIVEN the Administrador clicks Delete on a machine
- WHEN the `ConfirmDialog` appears and they confirm
- THEN the machine is deleted and a success notice appears

#### Scenario: Delete confirmation canceled

- GIVEN the Administrador clicks Delete on a machine
- WHEN the `ConfirmDialog` appears and they cancel
- THEN nothing is deleted and the machine remains

#### Scenario: API error surfaces as a toast

- GIVEN a create/update/delete fails with a mapped error (e.g. 409 `DUPLICATE_NOMBRE_UBICACION`)
- WHEN the Administrador submits
- THEN `handleApiError` surfaces the Spanish message as an error toast and the form/list state remains usable

### Requirement: Seed Data

The seed **MUST** change "Polea alta" from `OCUPADA` to `DISPONIBLE` (`prisma/seed-data.ts` line 155). The seed **MUST** remain idempotent: machines are inserted via `createMany` only when `prisma.maquina.count() === 0`. The seed comment **SHOULD** state that the fix is only effective on an empty DB.

#### Scenario: Fresh seed produces Polea alta as DISPONIBLE

- GIVEN an empty machine table
- WHEN the seed runs
- THEN "Polea alta" is created with estado="DISPONIBLE" (and the other five machines as before)

#### Scenario: Pre-existing non-empty table is left untouched

- GIVEN a machine table that already has rows (count > 0)
- WHEN the seed runs
- THEN no machines are inserted or mutated; an existing "Polea alta" keeps its current estado (the admin fixes it from `/maquinas`)

### Requirement: Regression Guards

The system **MUST** keep the existing guard tests and the full Jest suite green:

- `src/middleware/matrix-consistency.test.ts` — extended with the explicit denial assertions for `/maquinas` and `/api/maquinas`.
- `src/domains/dominios-puros.guard.test.ts` — the new `src/domains/maquina/maquina.ts` must stay browser-safe (no static `@/lib/db` import).
- The full `npm test` suite.

#### Scenario: Matrix consistency stays green

- GIVEN the new `/maquinas` and `/api/maquinas` entries in `role-gating.ts` (and no `authorization.ts` entry)
- WHEN `matrix-consistency.test.ts` runs
- THEN it passes, including the explicit RECEPCIONISTA/INSTRUCTOR/SOCIO denial assertions

#### Scenario: Domain purity stays green

- GIVEN the new `src/domains/maquina/maquina.ts`
- WHEN `dominios-puros.guard.test.ts` runs
- THEN it passes (the domain loads Prisma only via dynamic `import("@/lib/db")` inside the repository class)

#### Scenario: Full suite stays green

- GIVEN the change is complete
- WHEN `npm test` runs
- THEN the entire Jest suite passes

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| Admin-only CRUD (RN-06) | Screen + API gating for `/maquinas` and `/api/maquinas`, ADMINISTRADOR only (xref: rbac-middleware spec) |
| `OCUPADA` is derived, not assignable | Assignable Estado Rules (Etapa 4–5 session engine) |
| Uniqueness nombre+ubicacion | Two-layer DB index + domain pre-check |

## Acceptance Criteria

- **AC-001**: Only `ADMINISTRADOR` can access `/maquinas` and `/api/maquinas`; `RECEPCIONISTA`, `INSTRUCTOR` and `SOCIO` are denied (403) in BOTH the `role-gating.ts` matrix and the `authorization.ts` matrix.
- **AC-002**: `nombre` is required, 2–80 chars, trimmed and whitespace-collapsed.
- **AC-003**: `ubicacion` is required, 2–80 chars, trimmed and whitespace-collapsed.
- **AC-004**: `tipoEquipamiento` ∈ {`MAQUINA_GUIADA`, `PESO_LIBRE`, `CARDIO`}.
- **AC-005**: `estado` ∈ {`DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA`}; `OCUPADA` on POST/PUT → 400 `ESTADO_NO_ASIGNABLE`, even when unchanged.
- **AC-006**: Duplicate nombre+ubicacion (case/accent-insensitive) → 409 `DUPLICATE_NOMBRE_UBICACION`.
- **AC-007**: `GET /api/maquinas` returns all machines; supports `estado` and `tipoEquipamiento` filters and case-insensitive `nombre` substring search.
- **AC-008**: `GET /api/maquinas/[id]` returns the machine, or 404 with "Máquina no encontrada".
- **AC-009**: `PUT /api/maquinas/[id]` validates/normalizes like create, updates, audits `MODIFICACION` (incl. estado-only), 404 when missing, 409 on duplicate.
- **AC-010**: `DELETE /api/maquinas/[id]` is physical; `puedeEliminar(maquina, { ejerciciosAsociados: 0 })` permits; 404 when missing.
- **AC-011**: `puedeEliminar` returns `{ permitido: false, motivo }` when `ejerciciosAsociados > 0` (Etapa 2 maps to 409 `DELETE_BLOCKED_EJERCICIOS`).
- **AC-012**: Every write records `RegistroDeAuditoria` (`ALTA`/`MODIFICACION`/`BAJA`) with the actor id; audit failure does not change the HTTP response.
- **AC-013**: `/maquinas` screen (ADMINISTRADOR only) provides table, filters, search, create/edit modal, `ConfirmDialog` delete, `NotificationProvider` notices, `handleApiError` error toasts, and reuses `src/components/ui/` + `use-modal-a11y`.
- **AC-014**: Fresh seed produces "Polea alta" as `DISPONIBLE`; seed stays idempotent (`count() === 0` guard).
- **AC-015**: `matrix-consistency.test.ts`, `dominios-puros.guard.test.ts` and the full Jest suite stay green.

## Edge Cases

- **Accent-only duplicate**: "Polea" vs "Poléa" passes the DB index (which does not fold accents) but is rejected by the domain pre-check with the same 409 `DUPLICATE_NOMBRE_UBICACION`. The two layers must never disagree on the canonical form.
- **`unaccent()` not IMMUTABLE**: the unique index must NOT contain `unaccent()`; it is declared `STABLE` in Postgres and cannot appear in an index expression. The accent fold lives in the domain pre-check only.
- **OCUPADA row already in the DB**: the list returns it unchanged; the edit UI forces one of the three assignable values; a PUT that leaves it `OCUPADA` is still rejected with 400.
- **Case-only duplicate**: "polea alta" vs "Polea alta" collides at the DB index (`lower(btrim(...))`), so it is rejected by the index even without the pre-check.
- **Concurrent creates racing past the pre-check**: the repository catches `P2002` and re-throws `DUPLICATE_NOMBRE_UBICACION`, so uniqueness holds regardless of the race.
- **Already-seeded installations**: the seed fix does not touch existing rows (idempotent `count() === 0` guard); the admin fixes "Polea alta" from the UI.
- **`INACTIVA` / `FUERA_DE_SERVICIO` rows**: deleting them lowers Home_Interno's "Estado de equipos" total; out of scope, recorded as P-53 (do not touch Home_Interno).

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| nombre="Polea baja", ubicacion="Sala principal", tipo=MAQUINA_GUIADA, estado=DISPONIBLE | Created |
| nombre="" | Rejected: "El nombre debe tener entre 2 y 80 caracteres" |
| nombre="A" | Rejected: validation error |
| nombre=81 chars | Rejected: validation error |
| ubicacion missing/empty | Rejected: "La ubicación debe tener entre 2 y 80 caracteres" |
| tipoEquipamiento="ELIPTICA" | Rejected: "Tipo de equipamiento inválido" |
| estado="OCUPADA" on POST | 400 `ESTADO_NO_ASIGNABLE` |
| estado="OCUPADA" on PUT (unchanged) | 400 `ESTADO_NO_ASIGNABLE` |
| "  Polea   baja  " / " Sala   principal " | Normalized to "Polea baja" / "Sala principal" |
| Duplicate "Polea alta"/"Sala principal" | 409 `DUPLICATE_NOMBRE_UBICACION` |
| "Poléa"/"Sala principal" when "Polea" exists | 409 `DUPLICATE_NOMBRE_UBICACION` (domain pre-check) |
| Same name, different ubicacion | Created |
| Same ubicacion, different name | Created |
| `puedeEliminar(maquina, { ejerciciosAsociados: 3 })` | `{ permitido: false, motivo: "3 ejercicios usan esta máquina" }` |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Validation failure | VALIDATION_ERROR | field-specific (e.g. "El nombre debe tener entre 2 y 80 caracteres") | Highlight field |
| estado=OCUPADA on write | ESTADO_NO_ASIGNABLE (400) | "El estado OCUPADA no puede asignarse desde este panel" | Pick an assignable estado |
| Duplicate nombre+ubicacion | DUPLICATE_NOMBRE_UBICACION (409) | "Ya existe una máquina con el mismo nombre y ubicación" | Rename or change ubicacion |
| Missing machine | NOT_FOUND (404) | "Máquina no encontrada" | Refresh list |
| Delete blocked by Ejercicios (Etapa 2) | DELETE_BLOCKED_EJERCICIOS (409) | "No se puede eliminar: N ejercicios usan esta máquina" | Remove exercise relations first |
| Forbidden role | FORBIDDEN (403) | "Se requiere rol de administrador" | Sign in as ADMINISTRADOR |

## Acceptance Criteria → Test Traceability

| AC | Test file | Test name(s) |
|----|-----------|--------------|
| AC-001 | `src/middleware/matrix-consistency.test.ts` | "denies RECEPCIONISTA/INSTRUCTOR/SOCIO on /maquinas and /api/maquinas in both matrices"; `src/app/api/maquinas/route.test.ts` and `[id]/route.test.ts` "rejects non-ADMIN roles" |
| AC-002 | `src/domains/maquina/maquina.test.ts` | "validates nombre 2–80", "rejects empty/1-char/81-char nombre", "trims and collapses whitespace" |
| AC-003 | `src/domains/maquina/maquina.test.ts` | "validates ubicacion 2–80", "rejects empty ubicacion" |
| AC-004 | `src/domains/maquina/maquina.test.ts` | "validates tipoEquipamiento against TipoEquipamiento enum" |
| AC-005 | `src/domains/maquina/maquina.test.ts` | "rejects OCUPADA on create", "rejects OCUPADA on update (unchanged)"; `src/api/maquinas.test.ts` "throws ESTADO_NO_ASIGNABLE"; `src/lib/route-error-mapper.test.ts` "maps ESTADO_NO_ASIGNABLE → 400" |
| AC-006 | `src/domains/maquina/maquina-repositorio.test.ts`, `tests/integration/maquina.integration.test.ts` | repository: "consulta el duplicado antes de insertar", "compara con unaccent(lower(btrim(...)))", "traduce P2002 a DUPLICATE_NOMBRE_UBICACION"; integration: "rechaza un duplicado que solo difiere en mayúsculas con P2002", "el repositorio traduce el duplicado de mayúsculas a DUPLICATE_NOMBRE_UBICACION", "la pre-consulta rechaza un duplicado que solo difiere en tildes", "el índice no pliega tildes: el duplicado con tilde entra por SQL crudo"; `src/lib/route-error-mapper.test.ts` "maps DUPLICATE_NOMBRE_UBICACION → 409" |
| AC-007 | `src/app/api/maquinas/route.test.ts` | "lists all machines", "filters by estado", "filters by tipoEquipamiento", "case-insensitive nombre search", "combined filters", "empty result" |
| AC-008 | `src/app/api/maquinas/[id]/route.test.ts` | "returns machine by id", "404 with Máquina no encontrada" |
| AC-009 | `src/app/api/maquinas/[id]/route.test.ts` | "updates machine", "audits MODIFICACION on estado-only change", "404 on missing", "409 on duplicate" |
| AC-010 | `src/app/api/maquinas/[id]/route.test.ts` / `route.delete.test.ts` | "deletes machine", "404 on missing delete" |
| AC-011 | `src/domains/maquina/maquina.test.ts` | "puedeEliminar returns blocked when ejerciciosAsociados > 0" |
| AC-012 | `src/app/api/maquinas/route.test.ts` and `[id]/route.test.ts` | "audits ALTA on create", "audits MODIFICACION on update", "audits BAJA on delete", "audit failure does not change response" |
| AC-013 | `src/components/maquina-crud/maquina-form.test.tsx`, `maquina-list.test.tsx` | "renders table/filters/search", "creates via modal", "edits with forced assignable estado", "delete confirmation", "error toast via handleApiError" |
| AC-014 | seed integration test | "fresh seed produces Polea alta DISPONIBLE", "seed is idempotent on non-empty table" |
| AC-015 | `src/middleware/matrix-consistency.test.ts`, `src/domains/dominios-puros.guard.test.ts`, full `npm test` | "guards stay green" |

## Open Questions

- **Resolved — Seed `ubicacion` per-row vs shared default**: keep `ubicacion: "Sala principal"` for all six seeded machines; only the `estado` of "Polea alta" changes from `OCUPADA` to `DISPONIBLE`.

