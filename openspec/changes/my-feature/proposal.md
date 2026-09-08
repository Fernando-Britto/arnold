# Proposal: Gym Management System — Operaciones Integrales (my-feature)

## Intent

Implementar un sistema integral que automatice la gestión operativa del gimnasio ARNOLD, eliminando dependencia de memoria humana para control de acceso, cobro de cuotas y auditoría. El sistema debe servir a cuatro actores con flujos de trabajo diferenciados: Administrador (gestión sistémica), Recepcionista (check-in y cobro), Instructor (gestión de rutinas), y Socio (visualización de estado y rutinas).

## Scope

### First-Slice Selection: Access Control Foundation

**Rationale**: Access Control is the foundational layer for all other staff features. Without verified member authentication and quota validation, Receptionist check-in, payment tracking, and machine assignment cannot operate safely. This slice enables:
- Staff (Recepcionista, Instructor) can log in and verify member status
- Member entry granted/denied based on active quota
- Audit trail of access decisions
- Foundation for Phase 2 (payment collection) and Phase 3 (member dashboard)

### In Scope (Phase 1 — Access Control)

**Authentication & Authorization**
- Login route (`/auth/login`) with email/password
- Session/token management (JWT or Next.js session cookies)
- RBAC middleware to protect routes by role (Administrador, Recepcionista, Instructor, Socio)
- Logout action

**Access Verification**
- Check-in interface (Recepcionista reads member QR or enters ID)
- Verify active membership status (RN-01: one active membership per member)
- Quota validation (RN-02: grace period = 0 days; deny immediately on expiration)
- Manual override capability with audit log (RN-03: Autorizado Excepcionalmente)

**Data Models**
- `Usuario` (email, password hash, role)
- `Socio` (member profile linked to Usuario)
- `Membresía` (status: Activa, Vencida, Cancelada; fecha_vencimiento)
- `Cuota` (monthly tracking; estado: Pagada, Pendiente, Vencida)
- `AccesoAuditoria` (timestamp, usuario_id, socio_id, decision, override_reason)

**Audit Trail**
- All access decisions logged to `AccesoAuditoria` table
- Accessible to Administrador via admin dashboard
- Exportable for compliance

### Out of Scope (Deferred to Phase 2+)

| Feature | Phase | Reason |
|---------|-------|--------|
| Payment collection & cashier close-out | Phase 2 | Requires completed quota validation (Phase 1) |
| Member dashboard & routine management | Phase 3 | Requires completed auth (Phase 1) and routine catalog (separate) |
| Machine dynamic assignment | Phase 4 | Requires routine assignment and machine occupancy tracking |
| Instructor utilities (exercise catalog, routine templates) | Phase 3 | Requires dedicated UX design |
| Report generation (financiero, attendance) | Phase 4 | Requires all prior audit data |

## Capabilities

### New Capabilities

- `authentication-login`: User login with email/password, session establishment
- `rbac-middleware`: Role-based route protection (Administrador, Recepcionista, Instructor, Socio)
- `member-access-check`: Verify active membership and quota status at check-in
- `access-audit-logging`: Record all access attempts (granted/denied) with timestamps and override reasons
- `manual-override-authorization`: Allow Administrador to grant manual access with audit trail

### Modified Capabilities

None — this is the foundation layer. Phase 2+ will extend these with payment and member-facing features.

## Approach

**Authentication Layer** (Next.js API Routes + Server Actions)
- Use Next.js `middleware.ts` to intercept requests and validate JWT/session
- Store session in `httpOnly` cookies (secure, inaccessible to XSS)
- Implement role-based access control via middleware guard
- Services layer handles token generation and validation

**UI Components** (React 19 + Tailwind CSS 4)
- Login form (minimal, no external login libraries initially)
- Check-in interface (QR reader or manual member ID entry)
- Access decision display (Granted / Denied with reason)
- Admin audit log viewer (tabular list of access attempts)

**Data Flow**
```
Check-in Form
  ↓ (Recepcionista enters member ID)
  ↓ [services/accessService.ts → adapters/memberAdapter.ts]
  ↓ Query: Socio + Membresía + Cuota status
  ↓ Validate RN-02 (grace period = 0)
  ↓ Log access attempt → AccesoAuditoria
  ↓ Return decision (Granted / Denied + reason)
  ↓ Display UI feedback
```

**Prerequisite Work** (blocking; must complete first)
1. Initialize testing framework (Jest + React Testing Library) — unblocks strict TDD
2. Implement error handling service layer (try/catch, typed responses)
3. Decide state management: Context API (lightweight) vs Zustand (if complex state emerges)
4. Backend API integration: Confirm endpoints exist for:
   - `POST /auth/login` (credentials)
   - `GET /members/{id}/memberships` (membership status)
   - `GET /members/{id}/quotas` (quota tracking)
   - `POST /audit/access-logs` (audit trail)

## Affected Areas

| Area | Impact | Details |
|------|--------|---------|
| `src/models/Usuario.ts` | New | User credentials, role enum, session metadata |
| `src/models/Socio.ts` | Modified | Link to Usuario, member identification |
| `src/models/Membresía.ts` | No change | Already defined; used in validation |
| `src/models/AccesoAuditoria.ts` | New | Audit log structure |
| `src/services/authService.ts` | New | Login, token/session management |
| `src/services/accessService.ts` | New | Membership/quota verification |
| `src/adapters/userAdapter.ts` | New | API response → Usuario model mapping |
| `src/adapters/accessAdapter.ts` | New | API response → access decision mapping |
| `src/components/LoginForm.tsx` | New | Reusable login UI |
| `src/components/CheckInWidget.tsx` | New | Reusable check-in UI |
| `src/components/AccessDecisionCard.tsx` | New | Display access result |
| `src/app/auth/login/page.tsx` | New | Login route |
| `src/app/admin/check-in/page.tsx` | New | Recepcionista check-in interface |
| `src/app/admin/audit-log/page.tsx` | New | Access audit log viewer |
| `middleware.ts` | New | RBAC middleware protecting all routes |
| `.env.local` | Modified | JWT_SECRET or session config |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **No testing framework** | High | Configure Jest + RTL before Phase 1 implementation. Unblocks strict TDD. |
| **No error handling service** | High | Define typed error responses in services layer (e.g., `AccessError { code, message, recoverable }`) before check-in logic. |
| **State management unclear** | Medium | Start with React Context; if state becomes complex (>3 nested providers), migrate to Zustand. No Redux (overkill for this scope). |
| **Backend API unavailable** | Medium | Assume endpoints exist; mock in tests. Design service interfaces to support easy adapter swaps. |
| **Password hashing not in frontend** | Low | Passwords sent over HTTPS to backend; backend hashes. Frontend NEVER stores plaintext. |
| **Session/token expiration** | Medium | Implement auto-refresh tokens. Recepcionista should not be logged out mid-shift. |
| **Concurrent access attempts** | Low | Queue check-in requests; API layer handles concurrency. Database row-level locking for quota updates. |

## Rollback Plan

**If Phase 1 fails or introduces critical bugs**:
1. Delete routes: `src/app/auth/`, `src/app/admin/check-in/`, `src/app/admin/audit-log/`
2. Remove middleware.ts (revert to no RBAC)
3. Delete services: `authService.ts`, `accessService.ts`
4. Delete models: `Usuario.ts`, `AccesoAuditoria.ts`
5. Revert `.env.local` to pre-Phase 1 state
6. Git reset to `main` and re-branch if needed
7. No data loss risk: all changes are code-only; no migrations required yet

**Automated rollback**: Tag `phase1-start` before implementation. If critical blocker emerges, `git reset --hard phase1-start`.

## Dependencies

- **Testing Framework**: Must be configured (Jest + React Testing Library) before strict TDD in Phase 1
- **Error Handling Service**: Define before services layer initialization
- **Backend API Endpoints**: Confirm `POST /auth/login`, `GET /members/{id}/memberships`, `GET /members/{id}/quotas`, `POST /audit/access-logs` exist or are planned
- **State Management Decision**: Choose Context API or Zustand; document in Phase 2
- **Environment Variables**: `JWT_SECRET`, `API_BASE_URL`, `NODE_ENV`

## Success Criteria

- [ ] **Authentication works**: Recepcionista logs in; session persists across page reload
- [ ] **RBAC enforced**: Visiting `/admin/check-in` without `Recepcionista` role redirects to login
- [ ] **Check-in flow complete**: Enter member ID → validate membership → display decision (Granted/Denied) with reason
- [ ] **Audit trail captured**: All access attempts logged with timestamp, user, decision, override reason
- [ ] **Manual override audited**: Administrador can override denial; override logged
- [ ] **No plaintext passwords**: All credentials hashed; tokens/sessions used for subsequent requests
- [ ] **Test coverage ≥80%** for auth, access, audit services (once testing framework configured)
- [ ] **Type safety**: `tsc --noEmit` passes; no `any` types in models, services, adapters
- [ ] **Error handling complete**: All service calls have try/catch; typed error responses
- [ ] **Performance acceptable**: Check-in decision returned in <500ms (local DB round-trip)

---

## Proposal Question Round

**Before finalizing this proposal, the following questions should be clarified with the product owner:**

1. **Authentication Method**: Should Phase 1 use JWT tokens or Next.js session cookies? (JWT is stateless; sessions require backend store. Recommend JWT for multi-server scale later.)

2. **Manual Override Scope**: Can any Administrador override access, or only specific roles? Should overrides require a reason (free text) or select from predefined reasons (e.g., "Autorizado Excepcionalmente", "Gracia Temporal")?

3. **Check-In Device**: Will Recepcionista use a barcode scanner, QR reader, or keyboard entry? This affects input method design.

4. **Audit Retention**: How long should access logs be kept? Do you need batch export to external system (e.g., monthly archival)?

5. **Socio Access**: Should members (Socio) be able to see their own access history? (Might be Phase 3 scope but worth clarifying now.)

---

## Project Dependencies & Decisions

**Artifact Store Mode**: hybrid (OpenSpec + Engram)  
**Change Name**: my-feature  
**First-Slice**: Access Control (Foundation)  
**Phase 1 Scope**: 3 new routes, 5 new models, 2 new services, 5 new components  
**Estimated Work**: ~40 committed hours (auth setup, RBAC, check-in UI, audit logging)  
**Review Complexity**: 400-line budget; recommend chained PRs if exceeded  
**Testing Requirement**: Jest + RTL must be configured before implementation starts

---

## Next Steps

1. **User approval**: Confirm Phase 1 scope (Access Control) matches vision, or request boundary adjustment
2. **Answer proposal questions**: Address 5 questions above to refine scope
3. **Spec phase**: Define acceptance criteria, test scenarios, and business rules (RN-01, RN-02, RN-03)
4. **Design phase**: Finalize technical architecture, authentication method, error handling strategy
5. **Testing setup**: Configure Jest + React Testing Library (blocker before apply phase)
6. **Implementation**: Break into atomic PRs using chained PR pattern if >400 lines
