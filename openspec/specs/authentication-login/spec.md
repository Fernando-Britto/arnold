# Authentication & Login Specification

## Purpose

Enable staff (Recepcionista, Instructor, Administrador) to authenticate using email and password, with secure JWT token storage in httpOnly cookies and automatic session refresh.

## Requirements

### Requirement: Email/Password Login Endpoint

The system **MUST** provide a POST `/api/auth/login` endpoint that accepts email and password, validates credentials, and issues a JWT token in an httpOnly cookie.

#### Scenario: Valid credentials grant access

- GIVEN a registered Usuario with email `recepcion@arnold.gym` and bcrypt-hashed password
- WHEN POST `/api/auth/login` with `{ email, password }`
- THEN the system validates password hash match, generates JWT (exp 24h, includes jti, role, usuario_id)
- AND sets cookie: `Authorization=<jwt>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
- AND returns `{ success: true, role: "RECEPCIONISTA" }`

#### Scenario: Invalid credentials rejected

- GIVEN email not found or password mismatch
- WHEN POST `/api/auth/login` attempted
- THEN the system returns HTTP 401: `{ code: "AUTH_INVALID", message: "Email or password incorrect", recoverable: true }`
- AND no cookie is set

#### Scenario: Disabled account rejected

- GIVEN a Usuario with `status: DISABLED`
- WHEN POST `/api/auth/login` attempted
- THEN the system returns HTTP 403: `{ code: "AUTH_DISABLED", message: "Account disabled. Contact administrator.", recoverable: false }`

### Requirement: Session Persistence Across Navigation

The system **MUST** maintain authentication state via httpOnly cookie across page reloads and route navigation.

#### Scenario: Cookie persists after page reload

- GIVEN a logged-in user with valid JWT cookie
- WHEN the user refreshes the page
- THEN the browser automatically sends the Authorization cookie
- AND middleware validates JWT; user remains authenticated
- AND protected routes (e.g., `/recepcion/check-in`) load successfully

#### Scenario: Middleware validates token on each request

- GIVEN a request to a protected route
- WHEN middleware.ts runs
- THEN it reads the Authorization cookie, validates JWT signature and expiration
- AND on valid token: forwards to route handler
- AND on expired/invalid: returns HTTP 401; frontend triggers refresh flow

### Requirement: Automatic Token Refresh

The system **MUST** implement automatic refresh token rotation to prevent session expiration during Recepcionista shifts.

#### Scenario: Expired JWT triggers refresh

- GIVEN a JWT with exp approaching (within 5 min)
- WHEN a request is made with an expired token
- THEN middleware detects expiration, checks TokenRevocation table for jti
- AND calls POST `/api/auth/refresh` with refresh_token from secure cookie
- AND on success: issues new JWT (24h) + new refresh token (7d) in httpOnly cookies
- AND returns 200; original request is retried automatically

#### Scenario: Expired refresh token redirects to login

- GIVEN both JWT and refresh_token are expired/revoked
- WHEN POST `/api/auth/refresh` is attempted
- THEN the system returns HTTP 401: `{ code: "SESSION_EXPIRED", message: "Please log in again", recoverable: false }`
- AND frontend clears cookies, redirects to `/auth/login`

### Requirement: Logout and Token Revocation

The system **MUST** revoke tokens on logout and prevent reuse of revoked tokens.

#### Scenario: Logout clears session and revokes token

- GIVEN a logged-in user
- WHEN POST `/api/auth/logout` is called
- THEN the system extracts JWT jti, inserts into TokenRevocation table with revoked_at timestamp
- AND clears httpOnly cookies by setting Max-Age=0
- AND returns 200
- AND subsequent requests with that jti fail validation

#### Scenario: Revoked token is rejected

- GIVEN a jti is stored in TokenRevocation table
- WHEN middleware validates a token with that jti
- THEN middleware queries TokenRevocation, finds the jti, returns HTTP 401
- AND no request is processed

## Error Responses

All error responses follow this envelope:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "recoverable": true|false
}
```

| Code | HTTP | Meaning | Recovery |
|------|------|---------|----------|
| AUTH_INVALID | 401 | Wrong email or password | Retry login |
| AUTH_DISABLED | 403 | Account disabled | Contact admin |
| SESSION_EXPIRED | 401 | Token/refresh expired | Re-login |
| TOKEN_REVOKED | 401 | Token was revoked | Re-login |
| VALIDATION_ERROR | 400 | Missing email/password | Correct input |

## Data Models

**Usuario** table:
```
id: uuid
email: string (unique)
password_hash: string (bcrypt, never log)
role: enum (ADMIN | INSTRUCTOR | RECEPCIONISTA)
status: enum (ACTIVE | DISABLED)
created_at: timestamp
updated_at: timestamp
```

**TokenRevocation** table:
```
token_jti: string (unique, JWT jti claim)
revoked_at: timestamp
```

## Security Properties

- ✅ JWT stored in httpOnly cookies (XSS-proof)
- ✅ Secure flag enforces HTTPS only
- ✅ SameSite=Strict prevents CSRF
- ✅ Password hashed with bcrypt (cost ≥ 10)
- ✅ Token rotation: refresh tokens expire 7d, JWT 24h
- ✅ Token revocation validated on every request
- ✅ No sensitive data in JWT payload (no password, no reset tokens)
- ✅ Logout invalidates all sessions via TokenRevocation
