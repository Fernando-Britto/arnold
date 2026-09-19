# Clientes CRUD Specification

## Purpose

Create, read, update, and delete Socio (Cliente) records: nombre, dni, telefono, email, membresiaAsignada, estadoCuenta, plus read-only id and fechaAlta.

## Requirements

### Requirement: Staff-Only CRUD Access

The system **MUST** restrict access to Clientes CRUD to Administrador and Recepcionista roles (RN-06); full gating mechanics in `openspec/specs/rbac-middleware/spec.md`.

#### Scenario: Recepcionista accesses Clientes CRUD

- GIVEN an authenticated Recepcionista
- WHEN they navigate to the Clientes screen
- THEN FormPanel and ListPanel render

### Requirement: Cliente Creation Validation

The system **MUST** validate `nombre` (required, 5–100 chars), `dni` (required, unique, format XX.XXX.XXX or XXXXXXXX), `telefono` (optional, format +54 9 XXXX XXXXXX), `email` (required, valid email format), `membresiaAsignada` (required, active memberships only), `estadoCuenta` (required, one of Activo/Inactivo/Bloqueado).

#### Scenario: Valid creation succeeds

- GIVEN nombre="Ana García", dni="30.123.456", email="ana@example.com", membresiaAsignada="Gold" (Activa), estadoCuenta="Activo"
- WHEN the user submits the FormPanel
- THEN the system creates the Socio, sets fechaAlta to the current date, populates the read-only ID, and adds it to ListPanel

#### Scenario: Duplicate DNI rejected on blur

- GIVEN an existing Socio with dni="30.123.456"
- WHEN a new form attempts to save dni="30.123.456"
- THEN the system rejects with a uniqueness error, checked on field blur before full submission

#### Scenario: Invalid email format rejected

- GIVEN email="not-an-email"
- WHEN the user submits
- THEN the system rejects with "Formato de email inválido"

#### Scenario: Membresía dropdown shows only active memberships

- GIVEN Membresía records exist with estado=Activa and estado=Inactiva
- WHEN the FormPanel renders the "Membresía asignada" dropdown
- THEN only Activa memberships appear, each showing name + price

### Requirement: Single Active Membership Per Socio (RN-01)

The system **MUST** enforce that a Socio has exactly one membresiaAsignada value at a time (RN-01: a member can only have one active membership at a time), enforced structurally via a single-select field, not multi-assignment.

#### Scenario: Changing membership replaces the previous assignment

- GIVEN a Socio currently has membresiaAsignada="Silver"
- WHEN the user edits the form and selects "Gold" instead, then submits
- THEN the system replaces the Socio's membresiaAsignada with "Gold" — no dual-membership state is created

### Requirement: Cliente Edit Flow

The system **MUST** load an existing Socio's data into FormPanel when selected, applying the same validation rules on update, with fechaAlta and ID remaining read-only.

#### Scenario: Select row loads form for edit

- GIVEN ListPanel shows an existing Socio
- WHEN the user clicks "Modify" on that row
- THEN FormPanel populates with current field values, with ID and Fecha de alta shown read-only

#### Scenario: DNI uniqueness check excludes self on edit

- GIVEN the Socio being edited already owns dni="30.123.456"
- WHEN the user submits the form unchanged
- THEN the system does not flag a duplicate-DNI error against the Socio's own existing record

### Requirement: Estado de Cuenta Status Badge

The system **MUST** render Estado in ListPanel as a color-coded badge: Activo=status-success, Inactivo=status-warning, Bloqueado=status-error, always paired with the text label (not color alone, per accessibility requirement in sdd-design.md §7.4).

#### Scenario: Bloqueado renders with error color and text

- GIVEN a Socio has estadoCuenta="Bloqueado"
- WHEN ListPanel renders that row
- THEN the badge shows status-error background with visible text "Bloqueado"

### Requirement: ListPanel Search and Sort

The system **MUST** support sorting on Nombre, DNI, Email, Membresía, Estado, and filtering via ActionBar Search.

#### Scenario: Search filters by DNI

- GIVEN ListPanel has multiple Socios
- WHEN the user searches "30.123.456"
- THEN ListPanel shows only the matching Socio

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-01 (single active membership) | membresiaAsignada field — single-select, not multi-assignment |
| RN-06 (role-based access) | CRUD screen access gating (xref: rbac-middleware spec) |

## Acceptance Criteria

- **AC-001**: Nombre is required, 5–100 chars.
- **AC-002**: DNI is required, unique across all Socios, format XX.XXX.XXX or XXXXXXXX, checked on blur.
- **AC-003**: Email is required and must match a valid email format.
- **AC-004**: Membresía asignada dropdown lists only Membresía records with estado=Activa (name + price shown).
- **AC-005**: A Socio has exactly one membresiaAsignada value at any time (RN-01) — changing it replaces, never appends.
- **AC-006**: Estado de la cuenta badge always pairs color with visible text label.
- **AC-007**: ID and Fecha de alta are always read-only, never editable via the form.
- **AC-008**: Non-Administrador/Recepcionista roles cannot reach this screen.

## Edge Cases

- **DNI format variants**: Both "XX.XXX.XXX" (with dots) and "XXXXXXXX" (digits only) MUST be accepted and normalized to a single canonical stored format for uniqueness comparison (e.g., digits-only), so "30.123.456" and "30123456" are treated as the same DNI.
- **Telefono omitted**: Valid; telefono is optional and MUST NOT block submission when empty.
- **No active memberships exist**: The "Membresía asignada" dropdown MUST show an empty/disabled state with a message (e.g., "No hay membresías activas") rather than an empty silent dropdown, and form submission MUST be blocked since the field is required.
- **Assigning an Inactiva membership via stale dropdown cache**: If a membership is deactivated between page load and form submit, the system MUST re-validate estado=Activa server-side and reject with an error, not silently accept a stale selection.
- **Changing estadoCuenta to Bloqueado**: MUST NOT delete or alter membresiaAsignada; blocking is independent of membership state (interacts with access control checks defined in `openspec/specs/member-access-check/spec.md`, out of scope here).

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| dni="30.123.456" then dni="30123456" (new Socio) | Second rejected as duplicate (normalized comparison) |
| email="ana@example.com" | Accepted |
| email="ana@" | Rejected: "Formato de email inválido" |
| membresiaAsignada dropdown, 2 Activa + 1 Inactiva memberships | Dropdown shows only the 2 Activa options |
| estadoCuenta="Bloqueado" | Badge: status-error, text "Bloqueado" |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Duplicate DNI | VALIDATION_DUPLICATE_DNI | DNI ya registrado | Correct DNI or find existing Socio |
| Invalid email | VALIDATION_EMAIL_FORMAT | Formato de email inválido | Correct format |
| No active membership selected | VALIDATION_REQUIRED | Debe seleccionar una membresía activa | Select from dropdown |
| Stale membership selection (deactivated) | MEMBERSHIP_NO_LONGER_ACTIVE | La membresía seleccionada ya no está activa | Refresh dropdown, re-select |
