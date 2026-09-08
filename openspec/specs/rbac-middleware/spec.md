# Role-Based Access Control (RBAC) Middleware Specification

## Purpose

Protect routes based on user role. Recepcionista can access check-in interfaces; Administrador can access audit logs; Instructor manages routines; Socio (members) access personal dashboard only (Phase 3).

## Requirements

### Requirement: Route Protection by Role

The system **MUST** enforce role-based access control via middleware that validates user role before allowing route access.

#### Scenario: Recepcionista accesses check-in route

- GIVEN a logged-in user with role=RECEPCIONISTA
- WHEN accessing `/recepcion/check-in`
- THEN middleware validates token, extracts role from JWT
- AND role matches route requirement → allows access
- AND route handler renders CheckIn interface

#### Scenario: Non-Recepcionista blocked from check-in

- GIVEN a logged-in user with role=INSTRUCTOR
- WHEN accessing `/recepcion/check-in`
- THEN middleware validates token, extracts role from JWT
- AND role does NOT match required role → returns HTTP 403
- AND returns `{ code: "FORBIDDEN", message: "Recepcionista role required" }`

#### Scenario: Unauthenticated user redirected to login

- GIVEN a request with no valid Authorization cookie
- WHEN accessing `/recepcion/check-in`
- THEN middleware detects missing/invalid token
- AND returns HTTP 302 redirect to `/auth/login?from=/recepcion/check-in`

### Requirement: Role Configuration and Route Mapping

The system **MUST** define which roles can access which routes via a centralized mapping.

#### Scenario: Admin dashboard accessible to ADMIN only

- GIVEN role mapping: `/admin/dashboard` → [ADMIN]
- WHEN a request to `/admin/dashboard` is made
- THEN middleware checks JWT role against [ADMIN]
- AND ADMIN role → access granted
- AND other roles (RECEPCIONISTA, INSTRUCTOR, SOCIO) → 403 Forbidden

#### Scenario: Audit log view restricted to ADMIN

- GIVEN role mapping: `/admin/audit-log` → [ADMIN]
- WHEN a RECEPCIONISTA accesses `/admin/audit-log`
- THEN middleware returns 403; redirects to `/recepcion/check-in` (role's default dashboard)

#### Scenario: Member portal (Socio) requires future role

- GIVEN role mapping: `/socio/profile` → [SOCIO] (Phase 3)
- WHEN role mapping is defined but feature not yet implemented
- THEN middleware applies the rule; if accessed, returns 403 until Phase 3 implements Socio authentication

### Requirement: Role-Based Route Redirects

The system **SHOULD** redirect authenticated users to their role-appropriate dashboard instead of home on login.

#### Scenario: Recepcionista redirected to check-in

- GIVEN successful login with role=RECEPCIONISTA
- WHEN POST `/api/auth/login` completes
- THEN the system sets cookie, returns `{ redirectTo: "/recepcion/check-in" }`
- AND frontend navigates to Recepcionista dashboard

#### Scenario: Admin redirected to admin dashboard

- GIVEN successful login with role=ADMIN
- WHEN POST `/api/auth/login` completes
- THEN the system sets cookie, returns `{ redirectTo: "/admin/dashboard" }`
- AND frontend navigates to Admin dashboard

## Middleware Implementation

### Requirement: Middleware Chain Order

The system **MUST** execute middleware in correct order: authentication → authorization → rate limiting.

#### Scenario: Authentication validates before authorization

- GIVEN middleware stack: [auth, rbac, rateLimit]
- WHEN a request enters the stack
- THEN auth middleware runs first, validates JWT, extracts user
- AND rbac middleware runs next, checks role against route requirement
- AND rateLimit runs last, checks request count
- AND if auth fails, request stops; rbac is never evaluated

## Route-to-Role Mapping

| Route | Method | Allowed Roles | Purpose |
|-------|--------|---------------|---------|
| `/api/auth/login` | POST | Public | Login endpoint |
| `/api/auth/logout` | POST | Authenticated | Logout endpoint |
| `/api/auth/refresh` | POST | Authenticated | Token refresh |
| `/recepcion/check-in` | GET | RECEPCIONISTA | Check-in interface |
| `/api/socios/{id}/check-in-status` | GET | RECEPCIONISTA | Verify member |
| `/api/socios/{id}/access-override` | POST | ADMIN | Manual override |
| `/admin/dashboard` | GET | ADMIN | Admin dashboard |
| `/admin/audit-log` | GET | ADMIN | Access log viewer |
| `/api/audit-logs` | GET | ADMIN | Audit log API |
| `/socio/profile` | GET | SOCIO | Member profile (Phase 3) |
| `/instructor/routines` | GET | INSTRUCTOR | Routine management (Phase 3) |

## Error Responses

| Scenario | Code | HTTP | Message |
|----------|------|------|---------|
| No token | UNAUTHENTICATED | 302 | Redirect to login |
| Invalid/expired token | TOKEN_INVALID | 401 | Re-login required |
| Role not allowed | FORBIDDEN | 403 | Role insufficient |
| Token revoked | SESSION_EXPIRED | 401 | Session ended |

## Security Properties

- ✅ Every protected route validates JWT before checking role
- ✅ Role extracted from JWT; cannot be modified client-side
- ✅ Middleware executes on every request (cannot bypass)
- ✅ Failed auth/authz logged to AuditoriaAcceso with ACTION=DENIED
- ✅ Redirect loops prevented (login page is public)
- ✅ No sensitive data in error messages (does not leak role requirements)
