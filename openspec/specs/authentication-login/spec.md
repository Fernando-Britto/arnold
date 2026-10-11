# Authentication & Login Specification

> **Revision 2026-10-10 (P-22).** Rewritten to match the implementation (T-026, T-027, T-029, D-32, D-33, D-34). The original
> text was written before the code: it used the cookie name `Authorization`, the page `/auth/login`, a `Usuario` model with
> `ADMIN` / `ACTIVE` / `password_hash`, the error codes `SESSION_EXPIRED` and `TOKEN_REVOKED`, and promised automatic token
> refresh and "log out of all sessions". Those differences and why they exist are in `openspec/decisions.md` (D-17, D-18, D-23, §6).
> **Automatic token refresh is not implemented** (P-20); see [Deferred](#deferred-automatic-token-refresh-p-20).

## Purpose

Let every user (Administrador, Instructor, Recepcionista **and Socio**) authenticate with email and password, keep the session in
an httpOnly cookie, close it by revoking the token, and limit and audit login attempts.

## Implementation notes

- Session = a JWT in the cookie `authToken`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=86400`, and `Secure` **only when
  `NODE_ENV` is `production`** (so it also works over plain HTTP in development).
- JWT: signed with `JWT_SECRET` (required in production: without it the app throws; outside production a development fallback is used),
  expires in 24 h, claims `sub` (user id), `rol`, `email`, `nombre`, `jti`, `iat`, `exp`. It never carries the password or its hash.
- Passwords are stored with `bcryptjs`, cost 10, in `Usuario.password`.
- The login response is `{ success: true, role }`. The client decides the destination from the role: Socio → `/home-socio`, any other
  role → `/home-interno` (`homeRouteForRole`).
- Every page and API route except the public ones goes through `src/proxy.ts` (Next 16, Node.js runtime). The public paths are
  `/login`, `/api/auth/login`, `/api/auth/register` and `/api/auth/logout`. The access matrix itself is specified in `rbac-middleware`.
- Handlers that need the caller's identity read the cookie first and the `Authorization: Bearer` header as a fallback (D-18). They do
  not query revocations or the user again: they rely on the proxy having already filtered the request.
- Main files: `src/api/auth.ts` (login handler), `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/lib/auth.ts`,
  `src/lib/token-revocation.ts`, `src/proxy.ts`, `src/lib/access-decision.ts`, `src/lib/client-ip.ts`, `src/lib/rateLimit.ts`,
  `src/lib/audit.ts`, `src/app/login/page.tsx`, `src/contexts/auth.tsx`.

## Requirements

### Requirement: Email/Password Login Endpoint

The system **MUST** provide `POST /api/auth/login` that accepts `{ email, password }`, validates the credentials and, on success, sets
the session cookie and returns `{ success: true, role }`.

#### Scenario: Valid credentials grant access

- GIVEN an active Usuario (`estado: ACTIVO`, not deleted) and the correct password
- WHEN `POST /api/auth/login` with `{ email, password }`
- THEN the system returns HTTP 200 with `{ success: true, role: "<ROL>" }` and no password or hash in the body
- AND sets the cookie `authToken=<jwt>; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400` (plus `Secure` in production)
- AND the JWT expires 86400 s after it was issued and carries `sub`, `rol` and a `jti`
- AND the same applies to a Socio (the role only changes the destination chosen by the client)

#### Scenario: The email is normalised

- GIVEN a Usuario stored as `Recepcion@Arnold.gym`
- WHEN the login is attempted with ` recepcion@arnold.gym ` (spaces, other case)
- THEN the account is found: the email is trimmed and compared without regard to case
- AND a Usuario with `deletedAt` set is never found

#### Scenario: Invalid credentials rejected

- GIVEN an email that does not exist, or a wrong password
- WHEN `POST /api/auth/login`
- THEN the system returns HTTP 401: `{ code: "AUTH_INVALID", message: "Email o contraseña incorrectos", recoverable: true }`
- AND no cookie is set
- AND both cases answer the same way, and a password hash is compared even when the email does not exist (a dummy hash) to even out the
  response time, so the answer does not tell whether the email is registered

#### Scenario: Account that is not active is rejected

- GIVEN a Usuario with `estado` `INACTIVO` or `BLOQUEADO` and the **correct** password
- WHEN `POST /api/auth/login`
- THEN the system returns HTTP 403: `{ code: "AUTH_DISABLED", message: "Cuenta deshabilitada. Contactá al administrador.", recoverable: false }`
- AND no cookie is set
- AND the state is checked **after** the password, so a wrong password on a disabled account answers `AUTH_INVALID` and does not reveal the state

#### Scenario: Missing or malformed input

- GIVEN a body without `email` or `password`, with empty values, with non-string values, or that is not JSON
- WHEN `POST /api/auth/login`
- THEN the system returns HTTP 400: `{ code: "VALIDATION_ERROR", message: "Email y contraseña son obligatorios", recoverable: true }` (never a 500)
- AND no cookie is set

### Requirement: Login Attempt Rate Limit

The system **MUST** limit login attempts per client IP to slow down brute force (D-33).

#### Scenario: Attempts over the limit are rejected

- GIVEN a client IP that already made 8 requests to `/api/auth/login` in the last 60 seconds (sliding window; successful logins count too)
- WHEN it makes another request
- THEN the proxy returns HTTP 429: `{ code: "RATE_LIMITED", message: "Demasiados intentos. Probá de nuevo en un minuto." }`
- AND the request never reaches the login handler, so it is not audited
- AND the `/login` page shows "Demasiados intentos. Probá de nuevo en un minuto." **only** for a 429

#### Scenario: The client IP cannot be chosen by the client

- GIVEN a deployment on Vercel
- THEN the key is the IP set by the platform
- GIVEN a deployment outside Vercel with `TRUST_PROXY_HEADERS=true` (a trusted proxy in front that overwrites `x-forwarded-for`)
- THEN the key is the first hop of `x-forwarded-for`, then `x-real-ip`
- GIVEN anything else (including local development)
- THEN the key is `"unknown"` and all clients share one counter: the limit becomes global but cannot be evaded by forging a header;
  in production the server logs a single warning saying so

### Requirement: Login Audit

The system **MUST** record every login attempt in `AuditoriaAcceso` (see `access-audit-logging`; D-32) without ever breaking the login.

#### Scenario: Attempts are recorded

- WHEN a login succeeds THEN a row `accion: LOGIN`, `resultado: ALLOW` is stored for that user
- WHEN the password is wrong, or the email does not exist, THEN a row `LOGIN` / `DENY` with `motivo: AUTH_INVALID` is stored; `usuarioId`
  is the targeted user if the email exists and `null` otherwise
- WHEN the account is not active (correct password) THEN a row `LOGIN` / `DENY` with `motivo: AUTH_DISABLED` is stored
- AND each row stores the client IP and the user-agent
- AND a 400 (malformed input) and a 429 (rate limited) are **not** recorded: they are not access attempts

#### Scenario: Auditing never breaks or changes the response

- GIVEN the database fails while writing the audit row
- THEN the error is logged on the server and the login answers exactly as it would without auditing
- AND the audited IP is best effort (it accepts proxy headers even if they could be forged), unlike the key of the rate limit

### Requirement: Session Validation on Every Request

The system **MUST** validate the session on every request that is not public, reading the cookie, so that a session persists across page
reloads and navigation and stops working as soon as it is no longer valid.

#### Scenario: A valid session persists

- GIVEN a logged-in user whose cookie has not expired
- WHEN the user reloads the page or navigates
- THEN the browser sends the cookie, the proxy verifies the JWT signature and expiry, loads the user and lets the request continue
- AND the cookie is not renewed: the session lasts 24 h from login (there is no sliding expiry, see Deferred)

#### Scenario: A session is valid only if all of this holds

- GIVEN a request with the cookie
- THEN the session is valid only if the JWT verifies **and** the Usuario exists **and** its `estado` is `ACTIVO` **and** it is not deleted
  **and** its `jti` is not in `TokenRevocation`
- AND the user and the revocation are looked up in parallel, on each request
- AND disabling or deleting a user therefore cuts the access immediately, without waiting for the token to expire

#### Scenario: No session

- GIVEN a request to a protected API route without the cookie
- THEN the proxy returns HTTP 401 `{ code: "UNAUTHENTICATED", message: "Iniciá sesión para continuar" }`
- GIVEN a request to a protected page without the cookie
- THEN the proxy redirects (HTTP 307) to `/login?from=<path>` (`from` is omitted for `/`)
- AND the `/login` page does not use `from` yet: it always sends the user to the home of their role (P-09)

#### Scenario: Invalid session

- GIVEN a cookie whose token is expired, tampered with, revoked, or belongs to a disabled or deleted user
- WHEN a protected API route is requested THEN the proxy returns HTTP 401 `{ code: "TOKEN_INVALID", message: "Tu sesión no es válida. Iniciá sesión de nuevo" }`
- WHEN a protected page is requested THEN the proxy redirects (307) to `/login?from=<path>`
- AND no `ACCESS_DENIED` row is audited: an invalid session is not a permission denial

### Requirement: Logout and Token Revocation

The system **MUST** end the session on logout and make the logged-out token unusable even if a copy of it exists (D-34).

#### Scenario: Logout revokes the token and clears the cookie

- GIVEN a logged-in user
- WHEN `POST /api/auth/logout`
- THEN the system stores the token's `jti`, the user id and the token's expiry in `TokenRevocation` (revoking twice is harmless)
- AND deletes the revocations whose tokens have already expired
- AND returns HTTP 200 `{ success: true }` and clears the cookie (empty value, `Max-Age=0`)

#### Scenario: Logout always closes the browser session

- GIVEN no cookie, an invalid token, or a database failure while revoking
- WHEN `POST /api/auth/logout`
- THEN the system still returns HTTP 200 and clears the cookie (a database failure is written to the server log)
- AND the endpoint is public on purpose: clearing the cookie must not need a valid session

#### Scenario: A revoked token is rejected

- GIVEN a `jti` stored in `TokenRevocation`
- WHEN any protected request carries that token, even if its signature and user are valid
- THEN the proxy treats it as an invalid session (see above): 401 `TOKEN_INVALID` for the API, redirect to `/login` for pages

#### Scenario: Client behaviour

- WHEN the user presses "Cerrar sesión" (available in the top bar of the staff and of the Socio, FX-19)
- THEN the client calls `POST /api/auth/logout` and then goes to `/login`, **even if the call fails** (for example, no network)

## Deferred: Automatic Token Refresh (P-20)

**Not implemented.** The original design had a refresh token (7 d) rotated automatically. Today there is none: no `/api/auth/refresh`,
no refresh cookie. When the 24 h JWT expires the API answers 401 `TOKEN_INVALID`, pages redirect to `/login`, and the user logs in
again. Revocation (above) is independent of this and already works. If refresh is built, this section becomes a requirement and a
dedicated code for an expired session may be added then (today expired and revoked tokens are both `TOKEN_INVALID`).

## Error Responses

The login endpoint answers errors with this envelope:

```json
{ "code": "ERROR_CODE", "message": "Mensaje para el usuario", "recoverable": true }
```

| Code | HTTP | Source | Meaning |
|------|------|--------|---------|
| VALIDATION_ERROR | 400 | login | Missing or malformed email/password |
| AUTH_INVALID | 401 | login | Wrong email or password |
| AUTH_DISABLED | 403 | login | Account is `INACTIVO` or `BLOQUEADO` (correct password) |

Errors produced by the proxy have **no** `recoverable` field (`{ "code": "...", "message": "..." }`):

| Code | HTTP | Meaning |
|------|------|---------|
| UNAUTHENTICATED | 401 | No cookie on an API route |
| TOKEN_INVALID | 401 | Expired, tampered, revoked, or user disabled/deleted |
| FORBIDDEN | 403 | Valid session without permission (see `rbac-middleware`) |
| RATE_LIMITED | 429 | Too many login attempts per IP (8/min), or too many API requests per user (100/min, see `rbac-middleware`) |

`SESSION_EXPIRED` and `TOKEN_REVOKED`, which the original spec listed, are not used: both situations answer `TOKEN_INVALID`.

## Data Models

Defined in `prisma/schema.prisma` (the schema wins over any older name used in this spec):

```
Usuario          id (cuid), nombre, email (unique), password (bcrypt), rol (ADMINISTRADOR | INSTRUCTOR | RECEPCIONISTA | SOCIO),
                 estado (ACTIVO | INACTIVO | BLOQUEADO), createdAt, updatedAt, deletedAt?
TokenRevocation  jti (primary key), usuarioId?, expiraEn, revocadoEn
RateLimitLog     id, key (IP or user id), route, timestamp      -- sliding-window counter
AuditoriaAcceso  see access-audit-logging
```

## Security Properties and Limits

- ✅ The JWT lives in an `HttpOnly` cookie, so page scripts cannot read it.
- ✅ `SameSite=Strict` on the cookie.
- ⚠️ `Secure` is set only in production: in development the cookie travels over HTTP.
- ✅ Passwords hashed with `bcryptjs`, cost 10; the hash is never returned or logged.
- ✅ The JWT carries no password or secret; it does carry `email` and `nombre`.
- ✅ Revocation, user state and signature are checked on every protected request (the proxy runs on all routes).
- ✅ Wrong password and unknown email get the same answer (and a dummy hash evens out the time); the account state is only revealed after a correct password.
- ✅ Login attempts are rate limited per IP, and an unknown IP fails closed (shared counter).
- ✅ Every login attempt is audited without affecting the response.
- ⚠️ Logout revokes **only the token of the session that logs out**; there is no "log out of all sessions".
- ⚠️ No refresh and no rotation: a session lasts exactly 24 h and cannot be extended (P-20).
- ⚠️ `getSessionUser` (used by the root layout, to hand the user to the client, and by `/`, to redirect by role) only verifies the signature;
  it relies on the proxy, which runs first, to reject revoked or disabled sessions.
- ⚠️ `/api/auth/register` is listed as public and rate limited, but the route does not exist (P-10).

## Traceability

| Requirement | Tests | Verified against the real database |
|---|---|---|
| Login endpoint | `src/api/auth.test.ts`, `src/app/api/auth/login/route.test.ts`, `src/app/login/page.test.tsx` | Logins with real users (2026-10-08) |
| Rate limit | `src/proxy.test.ts`, `src/lib/client-ip.test.ts`, `src/lib/rateLimit.test.ts` | 10 requests: 8 × 401, then 429 (2026-10-08) |
| Login audit | `src/api/auth.test.ts`, `src/lib/audit.test.ts` | Rows `LOGIN/DENY`, `LOGIN/ALLOW` in `AuditoriaAcceso` (2026-10-08) |
| Session validation | `src/proxy.test.ts`, `src/lib/access-decision.test.ts`, `src/lib/auth.test.ts` | Indirectly: every check above went through the proxy |
| Logout and revocation | `src/app/api/auth/logout/route.test.ts`, `src/lib/token-revocation.test.ts`, `src/proxy.test.ts`, `src/contexts/auth-logout.test.tsx` | 403 before logout and 401 `TOKEN_INVALID` after, with `curl` (2026-10-09) |
