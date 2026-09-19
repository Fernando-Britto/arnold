# Membresías CRUD Specification

## Purpose

Create, read, update, and delete Membresía records: nombre, precio, periodicidad, descripcion, estado, plus read-only id.

## Requirements

### Requirement: Staff-Only CRUD Access

The system **MUST** restrict access to Membresías CRUD to Administrador role only (RN-06); full gating mechanics in `openspec/specs/rbac-middleware/spec.md`.

#### Scenario: Administrador accesses Membresías CRUD

- GIVEN an authenticated Administrador
- WHEN they navigate to the Membresías screen
- THEN FormPanel and ListPanel render

#### Scenario: Recepcionista blocked from Membresías CRUD

- GIVEN an authenticated Recepcionista
- WHEN they attempt to navigate to the Membresías screen
- THEN the system denies access

### Requirement: Membresía Creation Validation

The system **MUST** validate `nombre` (required, 3–50 chars), `precio` (required, decimal > 0, 2 decimals), `periodicidad` (required, integer > 0 days), `descripcion` (optional, max 300 chars), `estado` (required, Activa or Inactiva).

#### Scenario: Valid creation succeeds

- GIVEN nombre="Gold", precio=15000.00, periodicidad=30, estado="Activa"
- WHEN the user submits the FormPanel
- THEN the system creates the Membresía, populates the read-only ID, and adds it to ListPanel with 0 miembros

#### Scenario: Precio non-positive rejected

- GIVEN precio=0
- WHEN the user submits
- THEN the system rejects with "Debe ser mayor a 0"

#### Scenario: Periodicidad non-positive rejected

- GIVEN periodicidad=0
- WHEN the user submits
- THEN the system rejects with "Debe ser mayor a 0"

#### Scenario: Precio formatted with 2 decimals

- GIVEN the user enters precio=15000 (no decimals)
- WHEN the field loses focus or the form submits
- THEN the system normalizes display to "15000,00" (2 decimals) per the field's placeholder convention

### Requirement: Membresía Deactivation Guard (RN-01 downstream effect)

The system **MUST** prevent a Membresía's `estado` from being set to Inactiva if doing so would leave an active Socio without a valid membresiaAsignada replacement path — specifically, deactivating a Membresía does NOT retroactively unassign existing Socios (RN-01 governs Socio-side single assignment), but the system MUST warn the Administrador of the impact before confirming.

#### Scenario: Deactivating a membership with active members shows impact warning

- GIVEN a Membresía "Gold" is assigned to 42 active Socios
- WHEN the Administrador changes estado to "Inactiva" and submits
- THEN the system shows a confirmation warning ("42 socios tienen esta membresía asignada") before persisting the change

#### Scenario: Deactivated membership no longer offered on new assignments

- GIVEN Membresía "Gold" has estado="Inactiva"
- WHEN a Recepcionista opens the Clientes CRUD "Membresía asignada" dropdown
- THEN "Gold" does not appear as a selectable option (cross-reference: clientes-crud spec, AC-004)

### Requirement: Membresía Deletion Guard

The system **MUST** prevent deletion of a Membresía that is currently assigned (as membresiaAsignada) to any Socio, regardless of estado.

#### Scenario: Delete unassigned Membresía

- GIVEN a Membresía with zero Socios assigned
- WHEN the user clicks Delete and confirms
- THEN the system removes the Membresía

#### Scenario: Delete blocked for assigned Membresía

- GIVEN a Membresía is assigned to at least 1 Socio
- WHEN the user clicks Delete
- THEN the system rejects deletion with a message showing the assigned member count

### Requirement: ListPanel Miembros Count

The system **MUST** show a live "Miembros" count column reflecting the number of Socios with that Membresía as membresiaAsignada, non-sortable per design (display-only aggregate).

#### Scenario: Miembros count reflects current assignments

- GIVEN 42 Socios have membresiaAsignada="Gold"
- WHEN ListPanel renders the Gold row
- THEN the Miembros column shows 42

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-01 (single active membership per Socio, xref) | Deactivation/deletion impact warnings; dropdown filtering in Clientes CRUD |
| RN-06 (role-based access) | CRUD screen access gating, Administrador-only (xref: rbac-middleware spec) |

## Acceptance Criteria

- **AC-001**: Nombre is required, 3–50 chars.
- **AC-002**: Precio is required, must be > 0, displayed/stored with exactly 2 decimal places.
- **AC-003**: Periodicidad is required, must be a positive integer (days).
- **AC-004**: Descripcion is optional, capped at 300 chars.
- **AC-005**: Deactivating a Membresía with ≥1 assigned Socio requires an explicit confirmation showing the affected count.
- **AC-006**: Deleting a Membresía is blocked while ≥1 Socio has it as membresiaAsignada, regardless of estado.
- **AC-007**: ListPanel's Miembros column always matches the live count of Socios referencing that Membresía.
- **AC-008**: Only Administrador role can reach this screen.

## Edge Cases

- **Precio with more than 2 decimals entered**: MUST round or truncate to 2 decimals on save, not reject outright, unless the raw input is non-numeric.
- **Duplicate nombre**: Not specified as unique in requirements.md; duplicates (e.g., "Gold" renamed variants) are technically allowed unless a project convention forbids it — treat as allowed, flag for product decision if uniqueness is desired later.
- **Reactivating an Inactiva membership**: MUST be allowed at any time (no additional guard), immediately making it selectable again in Clientes CRUD.
- **periodicidad edited on an active plan**: Changing periodicidad does NOT retroactively alter existing Socios' Cuota due dates already generated; it only affects future Cuota generation cycles.
- **Zero assigned members but currently referenced by a pending Pago**: Deletion guard is based on membresiaAsignada references only; Pago/Cuota historical records are not blocking factors for this spec (out of scope — financial history retention is a separate concern).

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| precio=15000, periodicidad=30 | Stored as 15000.00 / 30 days |
| precio=-10 | Rejected: "Debe ser mayor a 0" |
| Deactivate "Gold" with 42 assigned Socios | Confirmation prompt: "42 socios tienen esta membresía asignada" |
| Delete "Silver" with 0 assigned Socios | Deleted successfully |
| Delete "Gold" with 42 assigned Socios | Rejected: "No se puede eliminar: 42 socios asignados" |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Precio non-positive | VALIDATION_RANGE | Debe ser mayor a 0 | Highlight field |
| Periodicidad non-positive | VALIDATION_RANGE | Debe ser mayor a 0 | Highlight field |
| Delete blocked (assigned) | DELETE_BLOCKED_ASSIGNED | No se puede eliminar: N socios asignados | Reassign socios first |
| Deactivation impact confirm declined | DEACTIVATION_CANCELLED | Cambio cancelado por el usuario | Form remains in edit state |
