# Role-Based Access Control (RBAC) Proxy Specification

> **Revision 2026-10-05.** Aligned with the implementation (T-026). The original text described routes that do not exist (`/recepcion/check-in`, `/admin/*`, `/instructor/*`, `/socio/*`, `/api/audit-logs`) and used `ADMIN` for the role. The real application uses the routes below and `ADMINISTRADOR`. Differences and reasons are in `openspec/decisions.md`. **DEFERRED** marks requirements not implemented yet.

## Purpose

Protect every page and API route by role (RN-06). Administrador has access to everything; Recepcionista manages Clientes and the staff home; Instructor manages Ejercicios and Rutinas and sees the staff home; Socio (member) reaches only the member home and its own data.

## Implementation notes

- Runs in `src/proxy.ts` (Next 16, **Node.js runtime**; the former `middleware.ts` ran on the Edge runtime, where Prisma and `jsonwebtoken` do not work).
- The decision logic is the pure function `decideAccess` (`src/lib/access-decision.ts`); the access matrix lives in `src/lib/authorization.ts` (`ROLE_PERMISSIONS`, `hasRouteAccess`) and is the **single source of truth**. The table in this document mirrors it as of 2026-10-05; if they differ, the code is right and this table must be updated.
- `ROLE_GATE_MATRIX` (`src/middleware/role-gating.ts`) is kept aligned for UI use (e.g. disabling Home_Interno controls). `matrix-consistency.test.ts` verifies both matrices agree and `rn06-spec.test.ts` verifies they match this specification.

## Requirements

### Requirement: Route Protection by Role

The system **MUST** validate the session and the role before allowing access to any route that is not public.

#### Scenario: Authorized role gets through

- GIVEN a logged-in Usuario whose role is allowed for the method and path (per the table below)
- WHEN the request reaches the proxy
- THEN the proxy lets it continue to the page or route handler

#### Scenario: Role not allowed — API route

- GIVEN a logged-in Usuario whose role is not allowed for the method and path
- WHEN the request targets an API route (for example a Socio calling `GET /api/clientes`)
- THEN the proxy returns HTTP 403 `{ "code": "FORBIDDEN", "message": "No tenés permiso para esta acción" }`
- AND the message does **not** name the roles that would be allowed

#### Scenario: Role not allowed — page

- GIVEN a logged-in Usuario whose role is not allowed for the page
- WHEN the request targets a page (for example a Recepcionista opening `/ejercicios`, or an Instructor opening `/membresias`)
- THEN the proxy redirects to the home of the role: `/home-socio` for SOCIO, `/home-interno` for the other roles

#### Scenario: Unauthenticated request

- GIVEN a request with no `authToken` cookie
- WHEN it targets an API route → HTTP 401 `{ "code": "UNAUTHENTICATED", "message": "Iniciá sesión para continuar" }`
- WHEN it targets a page → redirect (HTTP 307) to `/login?from=<encoded path>`; for `/` the redirect is to `/login` without `from`

#### Scenario: Invalid session

- GIVEN a token that is invalid or expired, or whose Usuario no longer exists, is not `ACTIVO` or has `deletedAt` set
- WHEN it targets an API route → HTTP 401 `{ "code": "TOKEN_INVALID", "message": "Tu sesión no es válida. Iniciá sesión de nuevo" }`
- WHEN it targets a page → redirect to `/login?from=<encoded path>`

#### Scenario: Public routes

- GIVEN a request to `/login`, `/api/auth/login`, `/api/auth/register` (reserved) or `/api/auth/logout`
- THEN the proxy lets it through without a session (public routes also prevent redirect loops). `/api/auth/login` and `/api/auth/register` are rate limited by IP.

#### Scenario: Root route

- GIVEN a logged-in Usuario requests `/`
- THEN the proxy lets it through and the page redirects to the home of the role (see `authentication-login`)

### Requirement: Role Configuration and Route Mapping

The system **MUST** define which roles can access which routes through one centralized mapping (`src/lib/authorization.ts`). Matching is by path prefix (`startsWith`) and HTTP method. Administrador has a wildcard. Fine-grained rules (for example "only the Administrador may approve an access override" or "a Socio sees only their own data") are enforced **inside the handler**, not in the proxy.

#### Scenario: Recepcionista blocked from Ejercicios

- GIVEN role mapping `/ejercicios` → [ADMINISTRADOR, INSTRUCTOR] (ejercicios-crud AC-007)
- WHEN a Recepcionista opens `/ejercicios`
- THEN the proxy redirects to `/home-interno`

#### Scenario: Socio cannot read Rutinas templates

- GIVEN role mapping `/api/rutinas` → [ADMINISTRADOR, INSTRUCTOR] (rutinas-crud RN-06)
- WHEN a Socio calls `GET /api/rutinas`
- THEN the proxy returns HTTP 403 `FORBIDDEN`; the Socio's own routine is delivered by `GET /api/home-socio`

### Requirement: Middleware Chain Order

The system **MUST** execute: authentication → authorization → rate limiting.

#### Scenario: Authentication validates before authorization

- GIVEN a request enters the proxy
- THEN the session is validated first (cookie, JWT signature, expiration, Usuario `ACTIVO` in the database)
- AND only then is the role checked against the matrix (`decideAccess`)
- AND only then is the rate limit checked
- AND if authentication fails, authorization is never evaluated

#### Scenario: Rate limits

- GIVEN `/api/auth/login` and `/api/auth/register` → limit 8 requests per minute **per IP**; exceeded → HTTP 429 `{ "code": "RATE_LIMITED", "message": "Demasiados intentos. Probá de nuevo en un minuto." }`
- GIVEN any other authenticated **API** route → limit 100 requests per minute **per user**, grouped by base path (all `/api/clientes/*` count together); exceeded → HTTP 429 `RATE_LIMITED`
- GIVEN page navigations → no rate limit (page prefetching must not consume the quota)

### Requirement: Role-Based Landing

The system **SHOULD** send each authenticated user to the home of their role. The login endpoint returns `{ success, role }` and the client chooses the destination: SOCIO → `/home-socio`; ADMINISTRADOR, INSTRUCTOR, RECEPCIONISTA → `/home-interno`. (The original spec returned `{ redirectTo }`.)

### Requirement: Identity Seen by Route Handlers

Route handlers **MUST** obtain the identity from the session cookie (Bearer header only as fallback) and **MUST NOT** trust `x-user-*` headers. See `authentication-login`.

### Requirement: Denied-Access Audit Log — **DEFERRED (T-029)**

Failed authentication and denied authorization **SHOULD** be written to `AuditoriaAcceso` with `ACTION=DENIED` (see `access-audit-logging`). Not implemented.

## Route-to-Role Mapping (as of 2026-10-05)

`A` = ADMINISTRADOR (wildcard, every method), `I` = INSTRUCTOR, `R` = RECEPCIONISTA, `S` = SOCIO. `—` = not allowed.

### Public routes

| Route | Method | Notes |
|-------|--------|-------|
| `/login` | GET | Login page |
| `/api/auth/login` | POST | Rate limited by IP |
| `/api/auth/logout` | POST | Clears the cookie; no session needed |

### Pages (GET)

| Route | A | I | R | S | Source |
|-------|---|---|---|---|--------|
| `/` | ✔ | ✔ | ✔ | ✔ | Redirects to the home of the role |
| `/home-interno` | ✔ | ✔ | ✔ | — | home-interno-dashboard (AC-008: Socio is sent to Home_Socio) |
| `/home-socio` | ✔ | — | — | ✔ | home-socio-portal |
| `/ejercicios` | ✔ | ✔ | — | — | ejercicios-crud AC-007 |
| `/rutinas` | ✔ | ✔ | — | — | rutinas-crud RN-06 |
| `/clientes` | ✔ | — | ✔ | — | clientes-crud AC-008 |
| `/membresias` | ✔ | — | — | — | membresias-crud AC-008 |

### API routes

| Route | Method | A | I | R | S | Notes |
|-------|--------|---|---|---|---|-------|
| `/api/home-interno` | GET | ✔ | ✔ | ✔ | — | |
| `/api/home-socio` | GET | ✔ | — | — | ✔ | Endpoint not implemented yet (T-028) |
| `/api/ejercicios` | GET, POST, PUT, DELETE | ✔ | ✔ | — | — | |
| `/api/rutinas` | GET, POST, PUT, DELETE | ✔ | ✔ | — | — | Socio gets their routine via `/api/home-socio` |
| `/api/clientes` | GET, POST, PUT, DELETE | ✔ | — | ✔ | — | |
| `/api/membresias` | GET, POST, PUT, DELETE | ✔ | — | — | — | Management is Administrador-only (RN-06) |
| `/api/membresias/activas` | GET | ✔ | — | ✔ | — | Read-only list of **active** membresías for the Clientes form dropdown (membresias-crud AC-004); added by fix `ebeec5d` |
| `/api/socios` | GET | ✔ | ✔ | ✔ | ✔ | Socio: own record only (handler filter). R also POST, PUT |
| `/api/socios/{id}/access-override` | POST | ✔ | — | — | — | The proxy lets R through `/api/socios` (POST); the handler then **requires ADMINISTRADOR** |
| `/api/pagos` | GET | ✔ | — | ✔ | ✔ | Socio: own payments (handler filter). R also POST |
| `/api/sesiones` | GET, POST / GET, PUT | ✔ | GET, PUT | — | GET, POST | I: view and update sessions; S: own sessions |
| `/api/cierres` | GET, POST | ✔ | — | ✔ | — | |

## Error Responses

| Scenario | Code | HTTP | Behavior |
|----------|------|------|----------|
| No cookie, API | UNAUTHENTICATED | 401 | JSON |
| No cookie, page | — | 307 | Redirect to `/login?from=<path>` |
| Invalid/expired token or inactive Usuario, API | TOKEN_INVALID | 401 | JSON |
| Invalid/expired token or inactive Usuario, page | — | 307 | Redirect to `/login?from=<path>` |
| Role not allowed, API | FORBIDDEN | 403 | JSON, generic message |
| Role not allowed, page | — | 307 | Redirect to the home of the role |
| Rate limit exceeded | RATE_LIMITED | 429 | JSON |
| Token revoked | SESSION_EXPIRED / TOKEN_REVOKED | 401 | **Deferred (T-027)** |

## Security Properties

- ✅ Every protected route validates the JWT and the Usuario's `estado` before checking the role
- ✅ The role is read from the database record of the validated Usuario, not from client input
- ✅ The proxy runs on every page and API route (matcher excludes only `_next`, `favicon.ico` and static images)
- ✅ Redirect loops prevented (`/login` and the auth endpoints are public)
- ✅ Error messages do not reveal which roles are required
- ✅ Handlers resolve identity from the same credential the proxy validated (cookie first)
- ⏳ Failed auth/authz logged to `AuditoriaAcceso` (T-029)
- ⏳ Revoked tokens rejected (T-027)
