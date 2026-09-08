# Member Access Check Specification

## Purpose

Verify that a member (Socio) has an active membership and valid quota payment before granting check-in access.

## Requirements

### Requirement: Membership Validation

The system **MUST** query the Membresía table and verify status before granting access.

#### Scenario: Active membership grants access

- GIVEN a Socio with Membresía where `status = Activa` and `fecha_vencimiento > today`
- WHEN Recepcionista calls GET `/api/socios/{socio_id}/check-in-status`
- THEN the system queries Membresía, checks expiration date
- AND returns `{ allowed: true, reason: "Membresía activa", warning: null }`

#### Scenario: Expired membership denies access

- GIVEN a Socio with Membresía where `fecha_vencimiento <= today` and grace_period = 0 days (RN-02)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects expiration, returns `{ allowed: false, reason: "Membresía vencida; requiere renovación" }`
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: DENY, motivo: "Expired membership" }`

#### Scenario: Grace period allows access with warning

- GIVEN a Socio with Membresía expired but within grace period (e.g., 3 days, configurable)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects grace period window, returns `{ allowed: true, reason: "En período de gracia", warning: "Grace period ends 2026-08-13" }`
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: ALLOW, motivo: "Grace period applied" }`

#### Scenario: Cancelled membership denies access

- GIVEN a Socio with Membresía where `status = Cancelada`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system returns `{ allowed: false, reason: "Membresía cancelada" }`
- AND does NOT create Asistencia record

### Requirement: Quota Payment Validation

The system **MUST** verify current month's quota payment status (RN-03) before granting access.

#### Scenario: Quota paid grants access

- GIVEN a Socio with active Membresía AND Cuota for current month `estado = Pagada`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system queries Cuota, finds payment status
- AND returns `{ allowed: true, reason: "Cuota pagada" }`

#### Scenario: Overdue quota denies access (requires override)

- GIVEN a Socio with active Membresía BUT Cuota `estado = Vencida` (overdue, due_date < today)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects overdue payment, returns `{ allowed: false, reason: "Cuota vencida; requiere autorización" }`
- AND does NOT automatically create Asistencia
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: DENY, motivo: "Overdue quota" }`

#### Scenario: Pending quota (due but not overdue yet) allows access

- GIVEN a Socio with Cuota `estado = Pendiente` and `fecha_vencimiento > today`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system allows access with warning: `{ allowed: true, warning: "Quota due on 2026-08-15" }`

### Requirement: Membership + Quota Combination Logic

The system **MUST** check BOTH membership AND quota; both must be valid.

#### Scenario: Valid membership but overdue quota → DENY

- GIVEN Membresía is active but Cuota is vencida
- WHEN check-in status is queried
- THEN system returns `{ allowed: false, reason: "Cuota vencida; requiere autorización" }`

#### Scenario: Valid quota but expired membership (outside grace) → DENY

- GIVEN Cuota is pagada but Membresía is vencida (outside grace period)
- WHEN check-in status is queried
- THEN system returns `{ allowed: false, reason: "Membresía vencida" }`

#### Scenario: Both valid → ALLOW

- GIVEN both Membresía active and Cuota pagada
- WHEN check-in status is queried
- THEN system returns `{ allowed: true, reason: "Acceso permitido" }`
- AND creates Asistencia record with timestamp

### Requirement: Asistencia Record Creation

The system **MUST** create an Asistencia (attendance) record on allowed check-in.

#### Scenario: Asistencia created on successful check-in

- GIVEN check-in allowed (membership + quota valid)
- WHEN GET `/api/socios/{socio_id}/check-in-status` returns allowed=true
- THEN the system creates Asistencia record: `{ socio_id, timestamp: now(), motivo: null }`
- AND returns success to Recepcionista UI

#### Scenario: No Asistencia on denied check-in

- GIVEN check-in denied (membership/quota invalid)
- WHEN status is queried
- THEN system does NOT create Asistencia record
- AND only AuditoriaAcceso is logged (with resultado=DENY)

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Member not found | MEMBER_NOT_FOUND | Socio not found | Check ID |
| Expired membership | MEMBERSHIP_EXPIRED | Membresía vencida | Override or renew |
| Overdue quota | QUOTA_OVERDUE | Cuota vencida | Override or pay |
| Cancelled membership | MEMBERSHIP_CANCELLED | Membresía cancelada | Manual review |
| Database error | DB_ERROR | Unable to verify membership | Fallback to manual |

## Data Models

**Membresía** table:
```
id: uuid
socio_id: uuid (FK)
fecha_inicio: date
fecha_vencimiento: date
status: enum (Activa | Vencida | Cancelada)
created_at: timestamp
updated_at: timestamp
```

**Cuota** table:
```
id: uuid
socio_id: uuid (FK)
mes: int (1-12)
año: int
estado: enum (Pagada | Pendiente | Vencida)
fecha_vencimiento: date
monto: decimal
created_at: timestamp
updated_at: timestamp
```

**Asistencia** table:
```
id: uuid
socio_id: uuid (FK)
timestamp: timestamp
motivo: string (nullable)
created_at: timestamp
```

## Configuration

- **Grace Period** (RN-02): Configurable via env var `GRACE_PERIOD_DAYS` (default: 0)
- **Quota Due Date Logic** (RN-03): Due date = 1st of following month (e.g., June quota due 2026-07-01)

## Security Properties

- ✅ All checks logged to AuditoriaAcceso (both allowed and denied)
- ✅ Membership/quota queries use prepared statements (SQL injection safe)
- ✅ Timestamps use server time (cannot be spoofed client-side)
- ✅ No payment sensitive data exposed in responses
- ✅ Denial reasons generic (do not leak member financial status to unauthorized users)
