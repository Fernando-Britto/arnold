# Rutinas CRUD Specification

## Purpose

Create, read, update, and delete Rutina templates (nombre, objetivoPrincipal, frecuenciaSemanal, duracionEstimada, nivelDeDificultad, descripcion) plus their Ejercicios de la rutina subsection (EjercicioEnRutina: series, repeticiones, descanso).

## Requirements

### Requirement: Staff-Only CRUD Access

The system **MUST** restrict access to Rutinas CRUD to Administrador and Instructor roles (RN-06); full gating mechanics in `openspec/specs/rbac-middleware/spec.md`.

#### Scenario: Instructor accesses Rutinas CRUD

- GIVEN an authenticated Instructor
- WHEN they navigate to the Rutinas screen
- THEN FormPanel, Ejercicios de la rutina subsection, and ListPanel render

### Requirement: Rutina Creation Validation

The system **MUST** validate `nombre` (required, 3–100 chars), `objetivoPrincipal` (required, predefined enum), `frecuenciaSemanal` (required, integer 1–7), `duracionEstimada` (required, integer > 0 minutes), `nivelDeDificultad` (required, one of Básico/Intermedio/Avanzado), `descripcion` (optional, max 500 chars).

#### Scenario: Valid creation succeeds

- GIVEN nombre="Fuerza Full Body", objetivoPrincipal="Fuerza", frecuenciaSemanal=3, duracionEstimada=60, nivelDeDificultad="Intermedio"
- WHEN the user submits the FormPanel
- THEN the system creates the Rutina, populates the read-only ID, and adds it to ListPanel with 0 exercises

#### Scenario: frecuenciaSemanal out of range rejected

- GIVEN frecuenciaSemanal=8
- WHEN the user submits
- THEN the system rejects with "Debe estar entre 1 y 7 días"

#### Scenario: duracionEstimada non-positive rejected

- GIVEN duracionEstimada=0
- WHEN the user submits
- THEN the system rejects with "Debe ser mayor a 0"

#### Scenario: nivelDeDificultad must be one of three options

- GIVEN the radio group only exposes Básico, Intermedio, Avanzado
- WHEN the form renders
- THEN no other value is selectable, and submission without a selection is rejected as required

### Requirement: Ejercicios de la Rutina Subsection Management

The system **MUST** allow adding Ejercicio rows to the Rutina via the "Catálogo" button (multi-select modal), and editing `series`, `repeticiones`, `descanso` (seconds) inline per row, with row deletion.

#### Scenario: Add exercises from catalog

- GIVEN the "Catálogo" modal is open showing all Ejercicio records
- WHEN the user multi-selects 3 exercises and confirms
- THEN the subtable adds 3 rows with EJERCICIO name populated and SER./REPS./DESCANSO defaulted to editable spinner inputs

#### Scenario: Edit series/reps/descanso inline

- GIVEN a subtable row exists for "Press Militar"
- WHEN the user sets SER.=4, REPS.=8, DESCANSO=90 (seconds)
- THEN the row reflects the new values, displaying DESCANSO as min:sec (e.g., "1:30")

#### Scenario: Remove exercise from routine

- GIVEN a subtable row exists
- WHEN the user clicks the row's delete action
- THEN the EjercicioEnRutina row is removed from the Rutina (not the underlying Ejercicio)

#### Scenario: Search filters catalog before adding

- GIVEN the "Buscar ejercicio..." field is present in the subsection
- WHEN the user types "sentad"
- THEN the catalog search results (or inline suggestions) filter to matching Ejercicio names

### Requirement: Rutina Deletion with Assignment Guard (RN-04)

The system **MUST** prevent deletion of a Rutina that is currently assigned as any Socio's active routine (RN-04: a Socio can only have one active routine at a time, so an active-assignment link always exists somewhere if in use).

#### Scenario: Delete unassigned Rutina template

- GIVEN a Rutina with zero active Socio assignments
- WHEN the user clicks Delete and confirms
- THEN the system removes the Rutina and its EjercicioEnRutina rows

#### Scenario: Delete blocked for actively assigned Rutina

- GIVEN a Rutina is the active routine for at least one Socio (RN-04)
- WHEN the user clicks Delete
- THEN the system rejects deletion with a message indicating active assignments exist

### Requirement: ListPanel Sort and Exercise Count

The system **MUST** show a live Ejercicios count column reflecting the number of EjercicioEnRutina rows, sortable alongside Nombre, Objetivo, Frecuencia, Duración, Nivel.

#### Scenario: Ejercicios count updates after subsection edit

- GIVEN a Rutina has 4 exercises in its subsection at save time
- WHEN ListPanel renders that Rutina's row
- THEN the Ejercicios column shows 4

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-04 (single active routine per Socio) | Deletion guard when Rutina is actively assigned |
| RN-06 (role-based access) | CRUD screen access gating (xref: rbac-middleware spec) |

Note: Per sdd-design.md §8, the per-Socio *assignment* flow itself (linking a Rutina to a Socio, triggered from Home_Interno's "Asignar Rutina" quick action) is **out of scope** for this spec — this screen manages Rutina templates and their EjercicioEnRutina composition only.

## Acceptance Criteria

- **AC-001**: frecuenciaSemanal accepts only integers 1–7 inclusive.
- **AC-002**: duracionEstimada accepts only integers > 0.
- **AC-003**: nivelDeDificultad is restricted to exactly Básico, Intermedio, Avanzado.
- **AC-004**: descanso is stored in seconds but displayed as min:sec in the subtable UI.
- **AC-005**: Deleting a Rutina is blocked while RN-04 active-assignment references exist.
- **AC-006**: Deleting an EjercicioEnRutina row removes only the association, never the underlying Ejercicio.
- **AC-007**: ListPanel's Ejercicios column count always matches the persisted EjercicioEnRutina row count for that Rutina.

## Edge Cases

- **Zero exercises on save**: A Rutina MAY be saved with zero EjercicioEnRutina rows (e.g., a template still being built); ListPanel shows "0" in Ejercicios column, no block.
- **Duplicate exercise added twice**: If the same Ejercicio is added to the subtable twice via "Catálogo", the system MUST either merge into one row or reject the duplicate add — the design does not specify duplicate sets/supersets, so treat as a single EjercicioEnRutina per Ejercicio per Rutina (reject duplicate add attempt with a message).
- **descanso=0**: Valid (no rest between sets is a legitimate training pattern); MUST NOT be rejected as a required-field violation, only the field type (integer ≥ 0) is enforced.
- **objetivoPrincipal list changes**: If the enum list changes after a Rutina was created with an older value, the edit form MUST preserve the stored value read-only until explicitly changed, mirroring the Ejercicio grupoMuscular edge case.

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| frecuenciaSemanal=3, duracionEstimada=45, nivelDeDificultad="Básico" | Created successfully |
| frecuenciaSemanal=0 | Rejected: "Debe estar entre 1 y 7 días" |
| EjercicioEnRutina descanso=125 | Subtable shows "2:05" |
| Delete Rutina assigned to 1 active Socio | Rejected: "Rutina asignada activamente a 1 socio(s)" |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| frecuenciaSemanal out of range | VALIDATION_RANGE | Debe estar entre 1 y 7 días | Highlight field |
| duracionEstimada non-positive | VALIDATION_RANGE | Debe ser mayor a 0 | Highlight field |
| Delete blocked (active assignment, RN-04) | DELETE_BLOCKED_ASSIGNED | Rutina asignada activamente a N socio(s) | Reassign socios first |
| Duplicate exercise add | DUPLICATE_EXERCISE | El ejercicio ya está en la rutina | Edit existing row instead |
