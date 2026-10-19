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
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)
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
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)

### Requirement: Quota Payment Validation

> **Estados de pago**: los estados `Pagada`, `Pendiente` y `Vencida` de abajo se calculan según [`pagos-cuotas`](../pagos-cuotas/spec.md) (D-40):
> `AL_DIA` (≈ Pagada), `PENDIENTE` (del 1 al día límite, entra con aviso), `VENCIDA` (requiere autorización) y `SIN_CUOTA` (se trata como vencida).
> Si esta sección y `pagos-cuotas` se contradicen, vale `pagos-cuotas`.

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
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)
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

The system **MUST** create an Asistencia (attendance) record on every check-in whose **identity is
verified** (valid DNI + PIN), regardless of the business decision:

- **Allowed** check-in → `estado = PERMITIDO`.
- **Business denial** (membership/quota inactive, anti-passback, etc.) → `estado = DENEGADO`, keeping
  the attempt history. Consumers of the attendance history MUST filter `estado = PERMITIDO`.
- **Identity failure** (unknown DNI, missing/incorrect PIN) → **no** Asistencia; only AuditoriaAcceso.

`metodo` records how the identity was verified: `DNI_PIN` (reception or door keypad), `HUELLA`
(fingerprint sensor), or `MANUAL` (legacy records).

#### Scenario: Asistencia created on successful check-in

- GIVEN check-in allowed (membership + quota valid)
- WHEN GET `/api/socios/{socio_id}/check-in-status` returns allowed=true
- THEN the system creates Asistencia record: `{ socio_id, timestamp: now(), motivo: null }`
- AND returns success to Recepcionista UI

#### Scenario: Asistencia DENEGADO on business denial

- GIVEN a verified identity (DNI + PIN) whose membership/quota is invalid (or anti-passback applies)
- WHEN status is queried
- THEN the system creates an Asistencia record with `estado = DENEGADO` and `motivo = <the denial reason>`
- AND AuditoriaAcceso is logged with `resultado = DENY`

#### Scenario: No Asistencia on identity failure

- GIVEN an unknown DNI, a member without a PIN, or an incorrect PIN
- WHEN the check-in is attempted
- THEN the system does NOT create an Asistencia record (no verified identity)
- AND only AuditoriaAcceso is logged (with `resultado = DENY` and a generic reason)

### Requirement: Fingerprint Access

The system **MUST** resolve the Socio from the `huellaId` returned by the fingerprint sensor and apply
the **same business decision** as DNI + PIN: account state, calculated payment status, and anti-passback.
Only the identity step differs; the business rules do not.

The sensor compares the fingerprint locally and sends only the template ID. The system **MUST NOT**
store biometric templates (Ley 25.326): it keeps only the `Socio ↔ huellaId` relation and the informed
consent timestamp.

The fingerprint endpoint is `POST /api/dispositivo/acceso/verificar` with `{ huellaId, confianza }`,
authenticated with a `Dispositivo` token (no user session).

A `confianza` below `HUELLA_CONFIANZA_MINIMA` (50) **MUST** deny access without evaluating the quota.
An unknown `huellaId` **MUST** deny access and record an `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
**without** creating an `Asistencia`.

A verified identity **MUST** create an `Asistencia` with `metodo = HUELLA` and its `AuditoriaAcceso`.

#### Scenario: Enrolled member with valid quota is allowed

- GIVEN a Socio with an enrolled `huellaId`, an active account, and the current quota paid
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }` with a valid device token
- THEN the system returns `{ autorizado: true }`
- AND creates an `Asistencia` with `estado = PERMITIDO` and `metodo = HUELLA`
- AND creates `AuditoriaAcceso: { accion: CHECK_IN, resultado: ALLOW }`

#### Scenario: Business denial applies to fingerprint access

- GIVEN a Socio identified by `huellaId` whose account is inactive/blocked, whose quota is expired or missing, or who is inside the anti-passback window
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }`
- THEN the system returns `{ autorizado: false, motivo: <the denial reason> }`
- AND creates an `Asistencia` with `estado = DENEGADO` and `motivo = <the denial reason>`
- AND creates `AuditoriaAcceso: { accion: CHECK_IN, resultado: DENY, motivo: <the denial reason> }`

#### Scenario: Unknown fingerprint denies without Asistencia

- GIVEN a `huellaId` that does not belong to any Socio
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }`
- THEN the system returns `{ autorizado: false, motivo: "Huella no reconocida" }`
- AND creates only `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
- AND does NOT create an `Asistencia`

#### Scenario: Low confidence denies without evaluating the quota

- GIVEN an enrolled `huellaId`
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 49 }`
- THEN the system returns `{ autorizado: false, motivo: "Confianza insuficiente" }`
- AND creates only `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
- AND does NOT query the quota or create an `Asistencia`

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

## Known drift

This spec still describes endpoints and DTOs that **do not exist** in the implementation:
`GET /api/socios/{socio_id}/check-in-status` and the response DTOs `{ allowed, reason, warning }`
(with error codes such as `MEMBER_NOT_FOUND`, `MEMBERSHIP_EXPIRED`, `QUOTA_OVERDUE`).

The real contract is:

- `POST /api/acceso/check-in` — reception kiosk, user session.
- `POST /api/dispositivo/acceso` — door, `Dispositivo` token.
- `POST /api/dispositivo/acceso/verificar` — fingerprint, `Dispositivo` token.

The requirements above remain the normative description of the business rules; endpoint and DTO
details in the older scenarios are kept for history and should not be treated as the current API.
