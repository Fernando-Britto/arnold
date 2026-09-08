# Manual Override Authorization Specification

## Purpose

Allow Administrador to grant access to a member who would otherwise be denied (e.g., quota overdue but payment confirmed for next business day), with mandatory audit trail and reason logging.

## Requirements

### Requirement: Override Authorization Endpoint

The system **MUST** provide a POST `/api/socios/{socio_id}/access-override` endpoint restricted to ADMIN role with mandatory reason validation.

#### Scenario: Admin approves override with valid reason

- GIVEN a member's check-in was denied (quota vencida)
- WHEN Administrador calls POST `/api/socios/{socio_id}/access-override`
- WITH request body: `{ motivo: "Próximo pago confirmado para 2026-08-15" }`
- THEN the system validates: motivo length ≥ 10 chars, motivo is non-empty
- AND creates AuditoriaAcceso: `{ usuario_id: admin_id, socio_id, accion: OVERRIDE_GRANT, motivo: "...", resultado: ALLOW, timestamp, ip_address, user_agent }`
- AND creates Asistencia record: `{ socio_id, timestamp, motivo: null }`
- AND returns HTTP 200: `{ success: true, message: "Access granted; logged" }`

#### Scenario: Override requires non-empty reason

- GIVEN override form with empty motivo field
- WHEN POST `/api/socios/{socio_id}/access-override` is called with `{ motivo: "" }`
- THEN the system validates reason, fails validation
- AND returns HTTP 400: `{ code: "VALIDATION_ERROR", message: "Reason required; minimum 10 characters" }`
- AND NO AuditoriaAcceso is created
- AND NO Asistencia is created

#### Scenario: Override reason too short rejected

- GIVEN override reason: "OK" (2 chars)
- WHEN POST `/api/socios/{socio_id}/access-override` is called
- THEN the system rejects (reason < 10 chars)
- AND returns HTTP 400: `{ code: "VALIDATION_ERROR", message: "Reason required; minimum 10 characters" }`

#### Scenario: Only ADMIN can approve override

- GIVEN a request from non-ADMIN user (e.g., Recepcionista)
- WHEN POST `/api/socios/{socio_id}/access-override` is called
- THEN middleware checks JWT role, finds role ≠ ADMIN
- AND returns HTTP 403: `{ code: "FORBIDDEN", message: "Admin role required" }`
- AND no override is applied

### Requirement: Override Confirmation Dialog

The system **SHOULD** display a UI confirmation before applying override.

#### Scenario: Dialog shows member info and reason prompt

- GIVEN a member's check-in denied
- WHEN Recepcionista clicks "Request Override" button
- THEN the system displays modal dialog showing:
  - Member name and ID
  - Denial reason (e.g., "Cuota vencida")
  - Text field: "Reason for override (min 10 chars)"
  - Buttons: "Approve" (disabled until reason filled), "Cancel"

#### Scenario: Dialog submission triggers API call

- GIVEN modal dialog with reason filled in
- WHEN user clicks "Approve" button
- THEN the dialog calls POST `/api/socios/{socio_id}/access-override` with motivo
- AND on success (200): modal closes, Asistencia created, UI shows "Access granted"
- AND on failure (400): modal shows error message, user can edit reason and retry

### Requirement: Override Audit Trail

The system **MUST** log all override decisions with complete context for compliance.

#### Scenario: Override logged with full context

- GIVEN an override approved
- WHEN AuditoriaAcceso is created
- THEN the record includes:
  - `usuario_id`: Admin ID (who approved)
  - `socio_id`: Member ID (who was overridden)
  - `accion`: OVERRIDE_GRANT
  - `motivo`: Explicit reason provided by admin
  - `resultado`: ALLOW
  - `timestamp`: Server time (when override occurred)
  - `ip_address`: Admin's IP (where override was triggered)
  - `user_agent`: Admin's browser (forensic detail)

#### Scenario: Override history queryable by member

- GIVEN Administrador viewing member profile
- WHEN filtering audit logs by socio_id
- THEN the system displays all OVERRIDE_GRANT actions for that member
- AND admin can see: when overridden, who overrode, what reason was given

#### Scenario: Override history queryable by admin

- GIVEN Administrador viewing their own activity
- WHEN filtering audit logs by usuario_id (self)
- THEN the system displays all overrides approved by that admin
- AND admin can track: who they overrode, when, for what reason

### Requirement: Denial Reasons and Override Justifications

The system **MUST** categorize override reasons for audit clarity.

#### Scenario: Common override reasons documented

- GIVEN predefined override categories (OPTIONAL UI enhancement):
  - "Payment confirmed for [date]"
  - "Grace period authorized"
  - "Technical error; manual resolution"
  - "Management discretion"
  - "Other: [free text]"
- WHEN admin provides reason
- THEN the reason is logged as-is (free text), allowing admin discretion
- AND audit displays full reason verbatim

#### Scenario: Override reason never changes after creation

- GIVEN an override logged with motivo = "Próximo pago confirmado"
- WHEN any time passes
- THEN the AuditoriaAcceso record is immutable (append-only)
- AND the reason displayed in audit logs remains unchanged

## Error Handling

| Scenario | Code | HTTP | Message | Recovery |
|----------|------|------|---------|----------|
| Empty reason | VALIDATION_ERROR | 400 | Reason required; minimum 10 chars | Provide reason |
| Reason too short | VALIDATION_ERROR | 400 | Reason required; minimum 10 chars | Lengthen reason |
| Not ADMIN | FORBIDDEN | 403 | Admin role required | Use Admin account |
| Member not found | NOT_FOUND | 404 | Socio not found | Check member ID |
| DB error | SERVER_ERROR | 500 | Unable to process override | Retry or manual |

## Data Flow

```
Recepcionista: Check-in attempt → DENIED (quota overdue)
              ↓
              "Request Override" button shown
              ↓
              Clicks button → Override dialog displayed
              ↓
              Enters reason (min 10 chars), clicks "Approve"
              ↓
Middleware: Validates JWT role = ADMIN
           ↓
           Authorization endpoint: POST /api/socios/{id}/access-override
           ↓
           Service layer: Validates reason, creates AuditoriaAcceso, creates Asistencia
           ↓
           Returns 200 success
           ↓
Recepcionista UI: Modal closes, "Access Granted" message shown
              ↓
              Asistencia record now exists for member
```

## Security Properties

- ✅ Only ADMIN can approve overrides (role enforced by middleware)
- ✅ Reason is mandatory (min 10 chars prevents empty justifications)
- ✅ All overrides logged to append-only AuditoriaAcceso
- ✅ Audit log is queryable by date, actor, member, action
- ✅ Override cannot be revoked after approval (Asistencia immutable)
- ✅ IP address and User-Agent logged for forensics
- ✅ Timestamp is server-side (cannot be spoofed)

## GDPR/Compliance Notes

- All overrides are indefinitely retained in AuditoriaAcceso
- Admin identities and reasons are logged (PII in logs)
- Member identities are logged (PII in logs)
- Define separate data retention and access policy for logs per legal team
- Logs may need encryption and restricted access controls
