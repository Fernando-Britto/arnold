# Access Audit Logging Specification

## Purpose

Create immutable audit trail of all access decisions (login, check-in, override) with timestamp, actor, member, decision, and reason. Enable compliance and investigation.

## Requirements

### Requirement: Comprehensive Access Logging

The system **MUST** log every access attempt (granted or denied) to the AuditoriaAcceso table.

#### Scenario: Successful login is logged

- GIVEN a valid login via POST `/api/auth/login`
- WHEN the JWT is issued successfully
- THEN the system creates AuditoriaAcceso: `{ usuario_id, socio_id: null, accion: LOGIN, motivo: null, resultado: ALLOW, timestamp, ip_address, user_agent }`

#### Scenario: Failed login attempt is logged

- GIVEN an invalid login (wrong password)
- WHEN POST `/api/auth/login` is attempted
- THEN the system creates AuditoriaAcceso: `{ usuario_id: null, socio_id: null, accion: LOGIN, motivo: "Invalid credentials", resultado: DENY, timestamp, ip_address, user_agent }`

#### Scenario: Check-in allowed is logged

- GIVEN a member check-in with valid membership and quota
- WHEN GET `/api/socios/{id}/check-in-status` returns allowed=true
- THEN the system creates AuditoriaAcceso: `{ usuario_id: recepcionista_id, socio_id: member_id, accion: CHECK_IN, motivo: null, resultado: ALLOW, timestamp, ip_address, user_agent }`

#### Scenario: Check-in denied is logged

- GIVEN a member check-in with expired membership
- WHEN GET `/api/socios/{id}/check-in-status` returns allowed=false
- THEN the system creates AuditoriaAcceso: `{ usuario_id: recepcionista_id, socio_id: member_id, accion: CHECK_IN, motivo: "Expired membership", resultado: DENY, timestamp, ip_address, user_agent }`

### Requirement: Override Authorization Logging

The system **MUST** log every admin override with mandatory reason field.

#### Scenario: Override grants access and logs reason

- GIVEN a check-in denied (overdue quota)
- WHEN Administrador calls POST `/api/socios/{id}/access-override` with `{ motivo: "Próximo pago confirmado para viernes" }`
- THEN the system creates AuditoriaAcceso: `{ usuario_id: admin_id, socio_id: member_id, accion: OVERRIDE_GRANT, motivo: "Próximo pago confirmado para viernes", resultado: ALLOW, timestamp, ip_address, user_agent }`
- AND creates Asistencia record for the member
- AND returns success to UI

#### Scenario: Override requires non-empty reason

- GIVEN override form submitted with empty reason field
- WHEN POST `/api/socios/{id}/access-override` is called with `{ motivo: "" }`
- THEN the system validates reason length (min 10 chars)
- AND returns HTTP 400: `{ code: "VALIDATION_ERROR", message: "Reason required (min 10 chars)" }`
- AND NO AuditoriaAcceso record is created
- AND NO Asistencia is created

#### Scenario: Manual denial is logged

- GIVEN a check-in response displayed to Recepcionista
- WHEN Recepcionista clicks "Deny" (manual confirmation)
- THEN the system creates AuditoriaAcceso: `{ usuario_id: recepcionista_id, socio_id: member_id, accion: MANUAL_DENY, motivo: null, resultado: DENY, timestamp, ip_address, user_agent }`

### Requirement: Audit Log Query Interface

The system **MUST** provide queryable audit logs to Administrador via admin dashboard.

#### Scenario: Query by member ID

- GIVEN Administrador at `/admin/audit-log`
- WHEN filtering by member ID (e.g., "M123")
- THEN the system queries AuditoriaAcceso where socio_id = M123
- AND displays all access attempts (login, check-in, override) for that member in reverse chronological order

#### Scenario: Query by date range

- GIVEN Administrador filtering logs
- WHEN selecting date range "2026-08-01" to "2026-08-10"
- THEN the system queries AuditoriaAcceso where timestamp >= start AND timestamp <= end
- AND displays all access attempts in that range

#### Scenario: Query by actor (user who performed action)

- GIVEN Administrador filtering logs
- WHEN selecting actor "Recepcionista A" (usuario_id)
- THEN the system queries AuditoriaAcceso where usuario_id = actor_id
- AND displays all actions (logins, check-ins, overrides) performed by that user

#### Scenario: Query by action type

- GIVEN filtering options: LOGIN, CHECK_IN, OVERRIDE_GRANT, MANUAL_DENY
- WHEN Administrador selects accion = OVERRIDE_GRANT
- THEN the system shows all override decisions with actor, member, reason, timestamp

#### Scenario: Combined filters

- GIVEN multiple filters applied simultaneously
- WHEN filtering by date range AND member ID AND action type
- THEN the system applies all conditions: `WHERE timestamp >= start AND socio_id = member AND accion = action`
- AND displays combined results

### Requirement: Immutable Audit Log

The system **MUST** ensure audit records cannot be deleted or modified.

#### Scenario: Audit records are append-only

- GIVEN an AuditoriaAcceso record created
- WHEN any time passes
- THEN the record is immutable (no UPDATE, DELETE permissions on AuditoriaAcceso for any user)
- AND only INSERT is allowed (append-only)

#### Scenario: Deletion attempts logged separately

- GIVEN an Administrador attempts to delete an audit log entry
- WHEN DELETE is attempted on AuditoriaAcceso
- THEN the system rejects the request (403 Forbidden)
- AND logs the deletion attempt attempt to a separate SecurityEvent log for audit

## Audit Trail Content

**AuditoriaAcceso** table structure:

```
id: uuid (primary key, auto-generated)
usuario_id: uuid (FK to Usuario, nullable for failed logins)
socio_id: uuid (FK to Socio, nullable for login actions)
accion: enum (LOGIN | CHECK_IN | OVERRIDE_GRANT | MANUAL_DENY)
motivo: string (nullable; required for OVERRIDE_GRANT)
resultado: enum (ALLOW | DENY)
timestamp: timestamp (server time, immutable)
ip_address: string (IPv4/IPv6 of request)
user_agent: string (User-Agent header)
created_at: timestamp (record creation time)
```

## Query Response Format

```json
{
  "total": 42,
  "page": 1,
  "records": [
    {
      "id": "audit-001",
      "timestamp": "2026-08-10T14:30:00Z",
      "usuario_id": "user-123",
      "usuario_nombre": "Recepcionista A",
      "socio_id": "socio-456",
      "socio_nombre": "Juan García",
      "accion": "OVERRIDE_GRANT",
      "resultado": "ALLOW",
      "motivo": "Próximo pago confirmado",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0..."
    }
  ]
}
```

## Retention Policy

- **Default Retention**: Indefinite (all records kept)
- **Backup**: Daily encrypted backup to secure storage
- **Export**: Administrador can export logs as CSV for external archival
- **GDPR**: PII (email, IP) in logs subject to data retention policy; define separately

## Security Properties

- ✅ Append-only (no updates after creation)
- ✅ Server-side timestamp (cannot be spoofed)
- ✅ IP address and User-Agent captured for forensics
- ✅ All access decisions logged (100% coverage)
- ✅ Query results filtered by user role (Administrador only)
- ✅ Query operations themselves logged to separate audit trail
- ✅ Encryption at rest for backup storage
