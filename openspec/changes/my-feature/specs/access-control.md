# Access Control Foundation — Specification (Phase 1)

## Overview

Phase 1 implements authentication, authorization, member access verification, and audit logging. These five capabilities form the foundational layer enabling staff (Recepcionista, Instructor, Admin) to verify member eligibility and log all access decisions.

---

## UC-01: Staff Login with Role-Based Access

### Requirement: Email/Password Authentication

The system **MUST** provide a login route accepting email and password, validate credentials against the `Usuario` table, and issue a JWT token in an httpOnly cookie upon success.

#### Scenario: Valid credentials accepted

- GIVEN a registered Recepcionista with email `recepcion@arnold.gym` and hashed password
- WHEN the user submits email and password via POST `/api/auth/login`
- THEN the system validates the password hash, generates a JWT token (expires 24h), and sets an httpOnly cookie
- AND the system redirects to `/recepcion/check-in`

#### Scenario: Invalid email or password rejected

- GIVEN an invalid email or wrong password submitted
- WHEN POST `/api/auth/login` is called
- THEN the system returns `{ code: "AUTH_INVALID", message: "Email or password incorrect", recoverable: true }`
- AND no cookie is set

#### Scenario: Account disabled rejected

- GIVEN a Usuario with `status: DISABLED`
- WHEN POST `/api/auth/login` is attempted
- THEN the system returns `{ code: "AUTH_DISABLED", message: "Account disabled", recoverable: false }`

### Requirement: Session Persistence

The system **MUST** persist user session across page reloads using httpOnly cookies with `Secure` and `SameSite=Strict` flags.

#### Scenario: Token remains valid after navigation

- GIVEN a logged-in Recepcionista with active JWT cookie
- WHEN the user navigates to another route
- THEN the cookie is automatically sent; middleware validates it; user remains authenticated

#### Scenario: Token expiration and refresh

- GIVEN a JWT token expiring in 24h
- WHEN the user makes a request with an expired token
- THEN middleware detects expiration, attempts refresh token (7d lifetime) validation
- AND on success, issues a new JWT in httpOnly cookie
- AND on refresh failure, redirects to login

---

## UC-21: Member Access Verification (Check-In)

### Requirement: Membership Validation

The system **MUST** verify that a member has one active membership and is within quota payment status.

#### Scenario: Active membership with valid quota

- GIVEN a Socio with active Membresía (not expired) and Cuota status `Pagada`
- WHEN Recepcionista enters member ID at `/api/socios/{id}/check-in-status`
- THEN the system returns `{ allowed: true, reason: "Cuota activa" }`
- AND the system creates an `Asistencia` record

#### Scenario: Membership expired, outside grace period

- GIVEN Membresía with `fecha_vencimiento < today` and RN-02 grace period = 0 days
- WHEN check-in is attempted
- THEN the system returns `{ allowed: false, reason: "Membresía vencida" }`
- AND no Asistencia record is created
- AND `AuditoriaAcceso` is logged with `accion: CHECK_IN, resultado: DENY`

#### Scenario: Grace period logic (if RN-02 changes)

- GIVEN Membresía expired but within configurable grace period
- WHEN check-in is attempted
- THEN the system returns `{ allowed: true, reason: "En período de gracia" }`
- AND an `AuditoriaAcceso` warning log is created

#### Scenario: Quota overdue (RN-03)

- GIVEN Membresía active but Cuota status `Vencida` without override
- WHEN check-in is attempted
- THEN the system returns `{ allowed: false, reason: "Cuota vencida; requiere autorización" }`

---

## IRQ-15: Admin Override with Audit Trail

### Requirement: Manual Override Authorization

The system **MUST** allow an Administrador to grant access to a denied member with mandatory confirmation dialog, reason field, and audit logging.

#### Scenario: Override with reason approved

- GIVEN a member whose check-in was denied (quota overdue)
- WHEN Administrador clicks "Autorizar" button with reason "Autorizado Excepcionalmente - Próximo pago viernes"
- THEN the system creates `AuditoriaAcceso` entry: `{ usuario_id: admin_id, socio_id: member_id, accion: OVERRIDE_GRANT, motivo: "reason", resultado: ALLOW, timestamp, ip_address }`
- AND the member access is granted; Asistencia is created

#### Scenario: Override without reason rejected

- GIVEN the override reason field is empty
- WHEN Administrador submits the override form
- THEN the system returns validation error: `{ code: "VALIDATION_ERROR", message: "Reason required (min 10 chars)" }`
- AND no access is granted; no audit log is created

#### Scenario: Override logged with full context

- GIVEN any override is granted
- THEN the `AuditoriaAcceso` record includes: actor (Admin user ID), timestamp, IP address, user agent, socio_id, explicit reason
- AND the log is queryable by date range, actor ID, and member ID

---

## Security & Token Lifecycle

### Requirement: JWT Token Security

The system **MUST** use JWT tokens stored in httpOnly cookies with secure flags and implement proper token revocation on logout.

#### Scenario: Token revocation on logout

- GIVEN a logged-in user
- WHEN POST `/api/auth/logout` is called
- THEN the JWT's `jti` claim is stored in `TokenRevocation` table with `revoked_at: now`
- AND middleware checks revocation list before validating tokens
- AND the httpOnly cookie is cleared

#### Scenario: No localStorage leakage

- GIVEN any authentication flow
- WHEN tokens are stored
- THEN tokens MUST NOT be stored in localStorage
- AND validation in tests confirms httpOnly-only storage

---

## Data Models

| Model | Fields | Purpose |
|-------|--------|---------|
| **Usuario** | id, email, password_hash, role (ADMIN\|INSTRUCTOR\|RECEPCIONISTA), status (ACTIVE\|DISABLED), created_at, updated_at | Staff accounts |
| **Socio** | id, ..., usuario_id (FK, nullable) | Link members to portal users (Phase 3) |
| **Membresía** | id, socio_id, fecha_vencimiento, status (Activa\|Vencida\|Cancelada), created_at | Membership validity |
| **Cuota** | id, socio_id, mes, estado (Pagada\|Pendiente\|Vencida), fecha_vencimiento | Monthly payment tracking |
| **AuditoriaAcceso** | id, usuario_id, socio_id, accion (LOGIN\|CHECK_IN\|OVERRIDE_GRANT\|MANUAL_DENY), motivo (nullable), resultado (ALLOW\|DENY), timestamp, ip_address, user_agent | Immutable audit log |
| **TokenRevocation** | token_jti, revoked_at | Logout tracking |

---

## Error Handling

| Scenario | Error Code | Message | Recoverable |
|----------|-----------|---------|-------------|
| Invalid credentials | `AUTH_INVALID` | Email or password incorrect | ✅ Yes |
| Account disabled | `AUTH_DISABLED` | Account disabled | ❌ No |
| Membership expired | `MEMBERSHIP_EXPIRED` | Membresía vencida | ✅ Yes (override) |
| Quota overdue | `QUOTA_OVERDUE` | Cuota vencida; requiere autorización | ✅ Yes (override) |
| Token expired | `TOKEN_EXPIRED` | Attempting refresh... | ✅ Yes (auto-refresh) |
| Validation error | `VALIDATION_ERROR` | Reason required (min 10 chars) | ✅ Yes |

---

## Success Criteria

- Recepcionista logs in; session persists across reloads ✅
- `/admin/check-in` accessible only to Recepcionista role ✅
- Check-in: enter member ID → validate membership + quota → display decision ✅
- All access attempts logged with timestamp, user, decision, reason ✅
- Override grants access; logged with motivo, admin ID, IP, timestamp ✅
- Tokens expire 24h; refresh tokens 7d ✅
- httpOnly/Secure/SameSite=Strict enforced ✅
