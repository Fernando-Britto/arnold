# SDD Tasks: ARNOLD MVP Core (TDD Mode)

**Status**: IN EXECUTION — T-001 … T-021c and T-026 done; T-023b and T-024 pending  
**Date**: 2026-09-12 (approved) · Updated 2026-10-05  
**Mode**: Strict TDD (strict_tdd: true)  
**Delivery**: Chained PRs (≤400 LOC each) — 28 planned + additions (see [Scope changes during apply](#scope-changes-during-apply))  
**Total LOC**: 7,885 planned baseline · actuals are tracked per task below  
**Companion docs**: [`decisions.md`](./decisions.md) (why we deviated) · [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md) (current state & open items)

---

## Overview

28 implementation tasks split across 28 chained PRs (T-021 split into T-021a + T-021b for risk management, T-023 split into T-023a + T-023b for scope separation, T-025 added for /access-override endpoint). Each task pairs implementation with corresponding test file(s). Test-first discipline enforced: tests written before implementation (red-green-refactor).

> **Update 2026-10-05**: 4 tasks were added during apply (T-021c, T-026a/b/c) and T-021 grew well past its estimate. See [Execution Status](#execution-status) and [Scope changes during apply](#scope-changes-during-apply).

**Key metrics**:
- Domain models: 4 (Ejercicio, Rutina, Cliente, Membresía)
- CRUD screens: 4 (Ejercicios, Rutinas, Clientes, Membresías)
- Home pages: 2 (Home_Socio, Home_Interno)
- Special endpoints: 1 (Manual override authorization)
- Infrastructure: Auth (JWT, rate limiting, DB singleton), fine-grained access control
- Test files: ~45 .test.ts / .test.tsx files
- Est. execution time: 8–12 weeks (with parallel review)

## Execution Status

Legend: ✅ done · ⏳ pending · ➕ added during apply (not in the original plan).  
"Actual LOC" = lines added, tests and docs included, measured from git; "—" = not measured.

| Task | Status | PR | Actual LOC | Note |
|------|--------|----|-----------|------|
| T-001 Prisma schema | ✅ | PR-001-A | — | |
| T-022 Role gating | ✅ | PR-001-B | — | Matrix later unified in T-026c |
| T-023a Auth infrastructure | ✅ | PR-001-C | — | |
| T-002 – T-005 Ejercicio | ✅ | PR-002-A … PR-003-A | — | |
| T-025 Manual override | ✅ | PR-003-B | — | |
| T-006 – T-009 Rutina | ✅ | PR-003-C … PR-005-A | — | |
| T-010 – T-013 Cliente | ✅ | PR-005-B … PR-006-B | — | FX-08, FX-09 fixed later; FX-13, FX-14 follow-up fixes (D-26, D-27) |
| T-014 – T-017 Membresía | ✅ | PR-006-C … PR-007-C | — | |
| T-018, T-019 Home_Socio | ✅ | PR-008-A, PR-008-B | — | Data endpoint added later as T-028 |
| T-028 ➕ `GET /api/home-socio` | ✅ | PR-012-A/B/C | — | Domain + Prisma payload + route; D-29 |
| T-020 Home_Interno components | ✅ | PR-008-C | — | FX-01, FX-02 fixed in T-021a |
| T-021a Home_Interno Part 1 | ✅ | PR-009-A1/A2/A3 | 934 (est. 250) | Scope grew, see D-01 |
| T-021b Home_Interno Part 2 | ✅ | PR-009-B | 336 (est. 150) | +31 LOC rename refactor |
| T-021c Home_Interno data API | ✅ ➕ | PR-009-C1/C2/C3 | 505 | Not in plan, see D-01, D-02, D-10 |
| T-026a Login/logout API | ✅ ➕ | PR-011-A | 259 | By Fernando, see D-08 |
| T-026b Login page + SessionUser | ✅ ➕ | PR-011-B | 290 | By Fernando |
| T-026c Proxy + RBAC + cookie-first | ✅ ➕ | PR-011-C | 381 | By Fernando, see D-07 |
| T-023b UI utilities | ⏳ | PR-009-D (was PR-009-C) | — | Renumbered, see D-15 |
| T-024 Test fixtures | ⏳ | PR-010-A | — | `tests/fixtures/home-interno-data.ts` anticipates part of it (D-16) |

## Scope changes during apply

Rationale for each item lives in [`decisions.md`](./decisions.md); this is the index.

1. **T-021 grew from 400 to 1,806 LOC** (+4.5×) and was split into 7 PRs to respect the 400-LOC cap — D-01.
   Cause: T-020 only built `OperationCard` and `ActivityColumn`; four components, the domain derivations and the
   data API were never assigned to any task.
2. **New tasks**: T-021c (Home_Interno data API) and T-026a/b/c (authentication) — D-15.
3. **PR renumbering**: `PR-009-C` was used by T-021c, so **T-023b moves to `PR-009-D`** — D-15.
4. **Spec vs design**: the spec wins where the SVG disagrees (one alert type, no "+12% vs ayer") — D-03, D-04.
5. **RN-06 vs AC-004 conflict** (Recepcionista needs the active-membership dropdown but Membresías is Admin-only)
   resolved with a dedicated read-only endpoint, not by loosening RN-06 — D-09.
6. **Role-aware controls**: controls whose destination a role cannot open render disabled with a tooltip — D-06.
7. **T-021b depended on T-024** (fixtures), which is not done: a shared `tests/fixtures/home-interno-data.ts`
   stands in — D-16.
8. **Lint criterion** reinterpreted as "no new errors in touched files" because the repo carries 115 pre-existing
   errors — D-14.
9. **Ten defects fixed** along the way (FX-01 … FX-10); register in `decisions.md` §2.

---

## Complete Task List (Execution Order)

### T-001: Prisma Schema + Models
- **Status**: ✅ Done
- **Spec**: sdd-design.md §1.4, requirements.md
- **What**: Define all entities in prisma/schema.prisma
- **LOC**: 120 (schema only, no paired tests)
- **Acceptance**: `npx prisma validate` passes
- **PR**: PR-001-A (solo)
- **Risk**: Low
- **Dependencies**: None

### T-022: Role Gating Middleware + Auth Context Updates
- **Status**: ✅ Done
- **Spec**: RN-06 (role-based access control)
- **What**: Middleware for /ejercicios, /rutinas, /clientes, /membresias + React Context role state
- **Test file**: src/middleware/role-gating.test.ts, src/contexts/auth.test.tsx
- **LOC**: 120 (impl) + 100 (tests) = 220
- **Acceptance**: `npm test -- src/middleware/role-gating` + `src/contexts/auth` passes (6+ role scenarios)
- **PR**: PR-001-B
- **Risk**: Low (straightforward middleware)
- **Dependencies**: T-001

### T-023a: Auth Infrastructure (JWT, DB Singleton, Rate Limiting)
- **Status**: ✅ Done
- **Spec**: T-022 design (auth + rate limiting), sdd-design.md §1.2–1.3
- **What**: auth.ts (hashPassword, comparePassword, createJWT, verifyJWT) + db.ts (Prisma singleton) + rateLimit.ts (checkRateLimit, cleanupRateLimitLogsIfNeeded) + fine-grained-auth.ts (canApproveAccessOverride, canAccessSocioData, etc.)
- **Test file**: src/lib/auth.test.ts, src/lib/rateLimit.test.ts, src/lib/fine-grained-auth.test.ts
- **LOC**: 210 (impl, already written) + 180 (tests) = 390
- **Acceptance**: `npm test -- src/lib/` passes (JWT sign/verify, bcrypt hash/compare, rate limit sliding window, admin-only checks)
- **PR**: PR-001-C
- **Risk**: Low (foundational utilities, no dependencies on domain models)
- **Dependencies**: T-001 (Prisma schema)

### T-002: Ejercicio Domain Model + Repository
- **Status**: ✅ Done
- **Spec**: ejercicios-crud/spec.md
- **What**: Domain model + validation + Prisma repository
- **Test file**: src/domains/ejercicio/ejercicio.test.ts
- **LOC**: 180 (impl) + 120 (tests) = 300
- **Acceptance**: `npm test -- src/domains/ejercicio/` passes (8+ scenarios)
- **PR**: PR-002-A
- **Risk**: Low
- **Dependencies**: T-001

### T-003: Ejercicio FormPanel + ListPanel Components
- **Status**: ✅ Done
- **Spec**: ejercicios-crud/spec.md
- **What**: React controlled form + table with Modify/Delete
- **Test files**: src/components/ejercicio-crud/ejercicio-form.test.tsx, ejercicio-list.test.tsx
- **LOC**: 220 (comp) + 160 (tests) = 380
- **Acceptance**: `npm test -- src/components/ejercicio-crud/` passes (6+ scenarios)
- **PR**: PR-002-B
- **Risk**: Medium
- **Dependencies**: T-002

### T-004: Ejercicio API Route
- **Status**: ✅ Done
- **Spec**: ejercicios-crud/spec.md
- **What**: POST/PUT/DELETE endpoints → Ejercicio repo + Next.js route.ts with JWT auth
- **Test file**: src/api/ejercicios.test.ts, tests/api/ejercicios.route.test.ts
- **LOC**: 140 (impl) + 110 (tests) = 250 (does not include route.ts + auth tests: see T-023a)
- **Acceptance**: `npm test -- src/api/ejercicios` passes (6+ scenarios)
- **Route.ts**: src/app/api/ejercicios/route.ts (40 LOC, GET/POST handlers with error mapping per spec)
- **PR**: PR-002-C
- **Risk**: Low
- **Dependencies**: T-002

### T-005: Ejercicio CRUD Screen + Role Gating
- **Status**: ✅ Done
- **Spec**: ejercicios-crud/spec.md (RN-06 gating)
- **What**: Page /ejercicios with FormPanel + ListPanel + auth
- **Test file**: src/app/ejercicios/page.test.tsx
- **LOC**: 160 (page) + 90 (tests) = 250
- **Acceptance**: `npm test -- src/app/ejercicios/` passes (3+ role/flow scenarios)
- **PR**: PR-003-A
- **Risk**: Medium
- **Dependencies**: T-003, T-004, T-022 (role gating)

### T-025: Manual Override Authorization (Admin-Only)
- **Status**: ✅ Done
- **Spec**: manual-override-authorization/spec.md, rbac-middleware/spec.md, access-audit-logging/spec.md
- **What**: POST /api/socios/{id}/access-override endpoint with ADMIN-only validation + Asistencia override logic + Next.js route.ts with JWT auth
- **Test file**: src/api/socios/access-override.test.ts, tests/api/socios-access-override.route.test.ts
- **LOC**: 140 (handler) + 120 (tests) = 260 (does not include route.ts + auth tests: see T-023a)
- **Acceptance**: `npm test -- src/api/socios/access-override` passes (admin check, motivo validation, asistencia update)
- **Route.ts**: src/app/api/socios/[id]/access-override/route.ts (80 LOC, JWT extraction, ADMIN role check, error mapping per spec, params as Promise)
- **PR**: PR-003-B
- **Risk**: Low (uses existing canApproveAccessOverride() + simple endpoint logic)
- **Dependencies**: T-022 (auth middleware), T-005 (Socio endpoint pattern)

### T-006: Rutina Domain Model + Repository
- **Status**: ✅ Done
- **Spec**: rutinas-crud/spec.md
- **What**: Domain model + validation (frecuencia 1–7, duracion ≥1, nivelDeDificultad enum)
- **Test file**: src/domains/rutina/rutina.test.ts
- **LOC**: 200 (impl) + 130 (tests) = 330
- **Acceptance**: `npm test -- src/domains/rutina/` passes (validation + CRUD tests)
- **PR**: PR-003-C
- **Risk**: Low
- **Dependencies**: T-001

### T-007a: Rutina FormPanel + EjercicioEnRutina Basic
- **Status**: ✅ Done
- **Spec**: rutinas-crud/spec.md
- **What**: Form for Rutina + nested table for EjercicioEnRutina (add rows)
- **Test file**: src/components/rutina-crud/rutina-form.test.tsx
- **LOC**: 200 (comp) + 120 (tests) = 320
- **Acceptance**: `npm test -- src/components/rutina-crud/` passes (form + nested add scenarios)
- **PR**: PR-004-A
- **Risk**: Medium
- **Dependencies**: T-006, T-002 (Ejercicio dropdown)

### T-007b: EjercicioEnRutina Advanced (Row Editing, Reordering)
- **Status**: ✅ Done
- **Spec**: rutinas-crud/spec.md
- **What**: Edit/delete/reorder rows in nested table
- **Test file**: src/components/rutina-crud/ejercicio-en-rutina-list.test.tsx
- **LOC**: 80 (comp) + 60 (tests) = 140
- **Acceptance**: `npm test -- src/components/rutina-crud/` passes (advanced scenarios)
- **PR**: PR-004-B
- **Risk**: Medium
- **Dependencies**: T-007a

### T-008: Rutina API Route
- **Status**: ✅ Done
- **Spec**: rutinas-crud/spec.md
- **What**: CRUD endpoints + cascade logic for EjercicioEnRutina + Next.js route.ts with JWT auth
- **Test file**: src/api/rutinas.test.ts
- **LOC**: 170 (impl) + 120 (tests) = 290 (route.ts + auth tests included in T-023a)
- **Acceptance**: `npm test -- src/api/rutinas` passes (7+ scenarios)
- **Route.ts**: src/app/api/rutinas/route.ts (include GET/POST with error mapping per spec)
- **PR**: PR-004-C
- **Risk**: Medium
- **Dependencies**: T-006

### T-009: Rutina CRUD Screen + Role Gating
- **Status**: ✅ Done
- **Spec**: rutinas-crud/spec.md (RN-06 gating)
- **What**: Page /rutinas with form, list, nested editing
- **Test file**: src/app/rutinas/page.test.tsx
- **LOC**: 180 (page) + 100 (tests) = 280
- **Acceptance**: `npm test -- src/app/rutinas/` passes (role + nested UX scenarios)
- **PR**: PR-005-A
- **Risk**: Medium
- **Dependencies**: T-007b, T-008, T-022 (role gating)

### T-010: Cliente Domain Model + Repository
- **Status**: ✅ Done
- **Spec**: clientes-crud/spec.md
- **What**: Domain model (nombre, dni, telefono, email, membresiaAsignada, estadoCuenta)
- **Test file**: src/domains/cliente/cliente.test.ts
- **LOC**: 210 (impl) + 140 (tests) = 350
- **Acceptance**: `npm test -- src/domains/cliente/` passes (validation + CRUD + RN-01 downstream)
- **PR**: PR-005-B
- **Risk**: Low
- **Dependencies**: T-001

### T-011: Cliente FormPanel + ListPanel (Membresía dropdown)
- **Status**: ✅ Done
- **Spec**: clientes-crud/spec.md
- **What**: Form + table with membresía dropdown, estado transitions
- **Test file**: src/components/cliente-crud/cliente-form.test.tsx, cliente-list.test.tsx
- **LOC**: 240 (comp) + 150 (tests) = 390
- **Acceptance**: `npm test -- src/components/cliente-crud/` passes (form + dropdown scenarios)
- **PR**: PR-005-C
- **Risk**: Medium
- **Dependencies**: T-010

### T-012: Cliente API Route
- **Status**: ✅ Done
- **Spec**: clientes-crud/spec.md (RN-01 cascading)
- **What**: CRUD endpoints + Membresía assignment effects + Next.js route.ts with JWT auth
- **Test file**: src/api/clientes.test.ts
- **LOC**: 160 (impl) + 110 (tests) = 270 (route.ts + auth tests included in T-023a)
- **Acceptance**: `npm test -- src/api/clientes` passes (7+ scenarios)
- **Route.ts**: src/app/api/clientes/route.ts (include GET/POST with error mapping per spec)
- **PR**: PR-006-A
- **Risk**: Medium
- **Dependencies**: T-010

### T-013: Cliente CRUD Screen + Membresía Integration
- **Status**: ✅ Done
- **Spec**: clientes-crud/spec.md (RN-06 gating)
- **What**: Page /clientes with form, list, membresía population
- **Test file**: src/app/clientes/page.test.tsx
- **LOC**: 190 (page) + 110 (tests) = 300
- **Acceptance**: `npm test -- src/app/clientes/` passes (role + membresía integration)
- **PR**: PR-006-B
- **Risk**: Medium
- **Dependencies**: T-011, T-012, T-022 (role gating)

### T-014: Membresía Domain Model + Repository
- **Status**: ✅ Done
- **Spec**: membresias-crud/spec.md
- **What**: Domain model (nombre, precio, periodicidad, descripcion, estado)
- **Test file**: src/domains/membresia/membresia.test.ts
- **LOC**: 200 (impl) + 130 (tests) = 330
- **Acceptance**: `npm test -- src/domains/membresia/` passes (validation + estado transitions)
- **PR**: PR-006-C
- **Risk**: Low
- **Dependencies**: T-001

### T-015: Membresía FormPanel + ListPanel
- **Status**: ✅ Done
- **Spec**: membresias-crud/spec.md
- **What**: Form + table with estado dropdown, delete confirmation
- **Test file**: src/components/membresia-crud/membresia-form.test.tsx, membresia-list.test.tsx
- **LOC**: 220 (comp) + 140 (tests) = 360
- **Acceptance**: `npm test -- src/components/membresia-crud/` passes (form + list scenarios)
- **PR**: PR-007-A
- **Risk**: Medium
- **Dependencies**: T-014

### T-016: Membresía API Route
- **Status**: ✅ Done
- **Spec**: membresias-crud/spec.md
- **What**: CRUD endpoints, prevent deletion if Clientes reference + Next.js route.ts with JWT auth
- **Test file**: src/api/membresias.test.ts
- **LOC**: 150 (impl) + 100 (tests) = 250 (route.ts + auth tests included in T-023a)
- **Acceptance**: `npm test -- src/api/membresias` passes (referential integrity scenarios)
- **Route.ts**: src/app/api/membresias/route.ts (include GET/POST with error mapping per spec)
- **PR**: PR-007-B
- **Risk**: Medium
- **Dependencies**: T-014

### T-017: Membresía CRUD Screen + Role Gating
- **Status**: ✅ Done
- **Spec**: membresias-crud/spec.md (RN-06 gating)
- **What**: Page /membresias with form, list
- **Test file**: src/app/membresias/page.test.tsx
- **LOC**: 170 (page) + 95 (tests) = 265
- **Acceptance**: `npm test -- src/app/membresias/` passes (role + estado transitions)
- **PR**: PR-007-C
- **Risk**: Medium
- **Dependencies**: T-015, T-016, T-022 (role gating)

### T-018: Tarjeta_Detalle + Supporting Components
- **Status**: ✅ Done
- **Spec**: home-socio-portal/spec.md §3.2
- **What**: Exercise detail card (nombre, grupoMuscular, icon, descripcion, series/reps/descanso)
- **Test file**: src/components/home-socio/tarjeta-detalle.test.tsx
- **LOC**: 160 (comp) + 110 (tests) = 270
- **Acceptance**: `npm test -- src/components/home-socio/tarjeta-detalle` passes (rendering + data updates)
- **PR**: PR-008-A
- **Risk**: High (focal component, UX-critical)
- **Dependencies**: T-002, T-006 (Ejercicio + Rutina data)

### T-019: Home_Socio Page Layout (Fila1, Fila2, Fila3)
- **Status**: ✅ Done
- **Spec**: home-socio-portal/spec.md §2–3
- **What**: Layout orchestration + data binding (Progreso, Aforo, Tarjeta_Rutina, Tarjeta_Detalle, Racha, Membresía)
- **Test file**: src/app/home-socio/page.test.tsx
- **LOC**: 220 (page) + 140 (tests) = 360
- **Acceptance**: `npm test -- src/app/home-socio/page` passes (layout + data flow scenarios)
- **PR**: PR-008-B
- **Risk**: High (multi-source data orchestration)
- **Dependencies**: T-018, T-022 (auth context)

### T-020: Home_Interno Components (Operation + Activity)
- **Status**: ✅ Done
- **Spec**: home-interno-dashboard/spec.md §3–4
- **What**: Operation card (machines + occupancy) + Activity column (event stream)
- **Test file**: src/components/home-interno/operation-card.test.tsx, activity-column.test.tsx
- **LOC**: 200 (comp) + 130 (tests) = 330
- **Acceptance**: `npm test -- src/components/home-interno/{operation,activity}` passes (rendering + updates)
- **PR**: PR-008-C
- **Risk**: High (operational data complexity)
- **Dependencies**: T-002 (Máquina), T-010 (Cliente)

### T-021a: Home_Interno Page Layout — Part 1 (Rows 1–3)
- **Status**: ✅ Done — actual 934 LOC over PR-009-A1/A2/A3 (estimate below is the original plan)
- **Spec**: home-interno-dashboard/spec.md §2–3
- **What**: Layout for Row_Acciones (quick actions buttons), Row_Hoy (Alertas, Aforo, Caja), Row_Operacion (3 status cards) + initial data binding
- **Test file**: src/app/home-interno/page-part1.test.tsx
- **LOC**: 150 (page layout + aggregation) + 100 (tests) = 250
- **Acceptance**: `npm test -- src/app/home-interno/page-part1` passes (layout + first 3 row aggregations)
- **PR**: PR-009-A
- **Risk**: High (aggregation queries, operational data)
- **Dependencies**: T-020, T-022 (auth context)
- **Scope change (D-01)**: the 250-LOC estimate assumed the zone components already existed. They did not, so the work
  became three PRs: **PR-009-A1** domain (`computeAforo`, `computeAlertasVencimiento`, `computePersonalEnTurno`,
  `aggregateHomeInterno`; 260 LOC), **PR-009-A2** components (`QuickActions`, `AlertasCard`, `AforoHoyCard`, `CajaCard`;
  309 LOC), **PR-009-A3** API contract + page (365 LOC).
- **Deviations from the spec/design**: only the "Vencimiento" alert (D-03); no "+12% vs ayer"; "Cierre de Caja" is only
  a trigger; unmapped buttons (Registrar Pago, Asignar Rutina, Control Acceso) are documented no-ops.

### T-021b: Home_Interno Page Layout — Part 2 (Rows 4–5 + Integration)
- **Status**: ✅ Done — actual 336 LOC (+31 rename refactor) in PR-009-B (estimate below is the original plan)
- **Spec**: home-interno-dashboard/spec.md §4–5
- **What**: Layout for Row_Gestion (4 counter cards), Col_Actividad (event stream) + complete page integration and data flow
- **Test file**: src/app/home-interno/page-part2.test.tsx
- **LOC**: 100 (page layout + data integration) + 50 (tests) = 150
- **Acceptance**: `npm test -- src/app/home-interno/page-part2` passes (final 2 rows + full integration scenarios)
- **PR**: PR-009-B
- **Risk**: High (event stream, counter aggregations, multi-source integration)
- **Dependencies**: T-021a, T-024 (fixtures for consistent test data)
- **Scope change**: actual 336 LOC. Adds `CounterCard` (OperationCard requires icon + footer, counters have neither),
  moves `formatHaceTiempo` to the domain layer, extends the contract with `contadores` + `eventos`. Cards whose
  destination the role cannot open are disabled (D-06). T-024 was not available, so a shared fixture was created (D-16).

### T-021c: Home_Interno Data API (added during apply)
- **Status**: ✅ Done
- **Spec**: home-interno-dashboard/spec.md §2–5 (data scenarios)
- **What**: `GET /api/home-interno` collects raw facts with Prisma (machines, payments, roster with last cuota and last
  attendance, today's check-ins, on-shift staff, counters, 24h events). Business rules stay in the domain layer (D-02).
- **Files**: `src/lib/gym-time.ts`, `src/api/home-interno-data.ts`, `src/app/api/home-interno/route.ts` (+ tests,
  including a server → client → domain contract test)
- **LOC**: 505 actual (54 + 389 + 62) — not in the original plan
- **PR**: PR-009-C1 / PR-009-C2 / PR-009-C3
- **Why added**: the T-021a page called `/api/home-interno`, which nobody had planned. Home_Interno answered 404 and
  never loaded (found in `next dev` logs).
- **Risk**: High — Prisma queries could not be run in the assistant's environment; verified with mocked Prisma, a
  schema-field script (41 checks) and a 200 response from the author's dev database. Numbers vs real data: open (P-02).
- **Dependencies**: T-021a, T-021b, T-026 (the proxy enforces who can call it)

### T-026a: Auth Login/Logout API (added during apply, by Fernando)
- **Status**: ✅ Done
- **Spec**: authentication-login/spec.md — with deviations (D-08)
- **What**: `POST /api/auth/login` and `/logout`; JWT with `jti`; httpOnly cookie `authToken` (24h, SameSite=Strict);
  `JWT_SECRET` required in production (FX-10); simulated hash to equalise response time; account status checked
  after the password.
- **LOC**: 259 actual · **PR**: PR-011-A · **Dependencies**: T-023a

### T-026b: Login Page + SessionUser (added during apply, by Fernando)
- **Status**: ✅ Done
- **What**: `/login` page, client-safe `SessionUser` (never carries the password hash), real logout,
  `AuthProvider` mounted in the root layout from the session cookie.
- **LOC**: 290 actual · **PR**: PR-011-B · **Dependencies**: T-026a

### T-026c: Proxy, Unified RBAC, Cookie-first Handlers (added during apply, by Fernando)
- **Status**: ✅ Done
- **What**: `middleware.ts` → `proxy.ts` on the Node runtime (D-07, FX-05); permission matrix unified per RN-06 with
  consistency and RN-06 spec tests; pure `decideAccess`; `await params` for Next 16 (FX-06); `extractUserFromRequest`
  and cookie priority over `Bearer` (FX-07).
- **LOC**: 381 actual (7 commits) · **PR**: PR-011-C · **Dependencies**: T-026a, T-026b
- **Known gaps**: no token revocation or refresh (D-08, P-06); the proxy queries the DB on every page navigation (P-11).

### T-023b: UI Utilities (Validation, Formatting, Error Handling)
- **Status**: ⏳ Pending
- **Spec**: Cross-cutting concerns (email, DNI, phone formats; API error handling)
- **What**: validateEmail, formatDNI, formatPhone, handleApiError, notification context
- **Test file**: src/utils/validation.test.ts, src/utils/formatting.test.ts
- **LOC**: 130 (util) + 110 (tests) = 240
- **Acceptance**: `npm test -- src/utils/` passes (all utility + error handling tests)
- **PR**: PR-009-D (was PR-009-C; renumbered, D-15)
- **Risk**: Low (unit tests, isolated)
- **Dependencies**: None (independent utilities)

### T-024: Test Fixtures & Factories
- **Status**: ⏳ Pending
- **Spec**: Test infrastructure (data generation)
- **What**: Factories for Ejercicio, Rutina, Cliente, Membresía, Usuario, EjercicioEnRutina
- **Test file**: tests/factories/*.ts (with light integration tests)
- **LOC**: 180 (factories) + 60 (test coverage) = 240
- **Acceptance**: `npm test -- tests/factories` passes; factories produce valid data per domains
- **PR**: PR-010-A
- **Risk**: Low (data generators, essential for seeding)
- **Dependencies**: T-001 (Prisma schema)

---

## Workload Forecast (with Tests) — CORRECTED

| Category | LOC | Tasks | Notes |
|----------|-----|-------|-------|
| Prisma schema (T-001) | 120 | 1 | Schema definition, no tests |
| Domain models + repos (T-002, T-006, T-010, T-014) | 1,310 | 4 | 300 + 330 + 350 + 330 (impl + tests included) |
| Components (T-003, T-007a, T-007b, T-011, T-015, T-018, T-020) | 2,190 | 7 | 380 + 320 + 140 + 390 + 360 + 270 + 330 (impl + tests included) |
| API routes (T-004, T-008, T-012, T-016, T-025) | 1,320 | 5 | 250 + 290 + 270 + 250 + 260 (impl + tests included) |
| Page components (T-005, T-009, T-013, T-017, T-019, T-021a, T-021b) | 1,855 | 7 | 250 + 280 + 300 + 265 + 360 + 250 + 150 (impl + tests included) |
| Role gating middleware (T-022) | 220 | 1 | JWT validation + route access matrix (impl + tests included) |
| Auth infrastructure (T-023a) | 390 | 1 | JWT, DB singleton, rate limiting, fine-grained auth (impl + tests included) |
| UI utilities (T-023b) | 240 | 1 | Validation, formatting, error handling (impl + tests included) |
| Test fixtures (T-024) | 240 | 1 | Factories + setup |
| **TOTAL** | **7,885** | **28 tasks** | **Verified sum of all 28 task LOC values (T-021a/b, T-023a/b, T-025 as separate tasks)** |

**Test file breakdown** (already included in LOC above):
- Domain tests: ~600 LOC (unit specs)
- Component tests: ~700 LOC (render + interaction specs)
- API tests: ~450 LOC (endpoint + integration specs, includes T-025)
- Page tests: ~600 LOC (flow + UX specs)
- Auth infrastructure tests: ~180 LOC (JWT, rate limiting, helpers)
- UI utilities tests: ~110 LOC (validation + formatting)
- **Total test LOC: ~2,640**

### Added during apply (actuals)

| Item | Actual LOC | vs plan |
|------|-----------|---------|
| T-021a + T-021b (planned 250 + 150) | 1,270 (934 + 336) | +870 |
| Rename refactor `Part1` → neutral names | 31 | not planned |
| T-021c Home_Interno data API | 505 | not planned |
| T-026a / T-026b / T-026c (authentication) | 930 (259 + 290 + 381) | not planned |
| **T-021 family (a + b + c + refactor)** | **1,806** | planned 400 → **4.5×** |

Defect fixes (FX-01 … FX-10) are small and tracked separately in `decisions.md` §2.


---

## Chained PR Strategy (28 PRs, ≤400 LOC each)

**Ordering enforces dependency flow and TDD discipline** (T-021 split into T-021a + T-021b for risk management):

1. **PR-001-A**: T-001 (120 LOC) — Prisma schema foundation
2. **PR-001-B**: T-022 (220 LOC) — Role gating middleware (required before any screen tests)
3. **PR-001-C**: T-023a (390 LOC) — Auth infrastructure (JWT, DB singleton, rate limiting)
4. **PR-002-A**: T-002 (300 LOC) — Ejercicio domain
5. **PR-002-B**: T-003 (380 LOC) — Ejercicio components
6. **PR-002-C**: T-004 (250 LOC) — Ejercicio API
7. **PR-003-A**: T-005 (250 LOC) — Ejercicio screen + role gate
8. **PR-003-B**: T-025 (260 LOC) — Manual override authorization (/api/socios/{id}/access-override)
9. **PR-003-C**: T-006 (330 LOC) — Rutina domain
10. **PR-004-A**: T-007a (320 LOC) — Rutina form + nested basic
11. **PR-004-B**: T-007b (140 LOC) — Rutina nested advanced
12. **PR-004-C**: T-008 (290 LOC) — Rutina API
13. **PR-005-A**: T-009 (280 LOC) — Rutina screen + role gate
14. **PR-005-B**: T-010 (350 LOC) — Cliente domain
15. **PR-005-C**: T-011 (390 LOC) — Cliente components
16. **PR-006-A**: T-012 (270 LOC) — Cliente API
17. **PR-006-B**: T-013 (300 LOC) — Cliente screen + membresía integration + role gate
18. **PR-006-C**: T-014 (330 LOC) — Membresía domain
19. **PR-007-A**: T-015 (360 LOC) — Membresía components
20. **PR-007-B**: T-016 (250 LOC) — Membresía API
21. **PR-007-C**: T-017 (265 LOC) — Membresía screen + role gate
22. **PR-008-A**: T-018 (270 LOC) — Tarjeta_Detalle + supporting components
23. **PR-008-B**: T-019 (360 LOC) — Home_Socio page layout
24. **PR-008-C**: T-020 (330 LOC) — Home_Interno components
25. **PR-009-A1 / A2 / A3**: T-021a (planned 250 LOC as one PR; **actual 260 + 309 + 365**) — Home_Interno page layout (Part 1: Rows 1–3), split into domain / components / page
26. **PR-009-B**: T-021b (planned 150 LOC; **actual 336**) — Home_Interno page layout (Part 2: Rows 4–5 + integration)
    - **PR-009-C1 / C2 / C3**: T-021c ➕ (**actual 54 + 389 + 62**) — Home_Interno data API (`gym-time`, payload builder, route)
    - **PR-011-A / B / C**: T-026a/b/c ➕ (**actual 259 + 290 + 381**) — authentication (login API, login page, proxy + RBAC)
27. **PR-009-D**: T-023b (240 LOC) — UI utilities (validation, formatting, error handling). *Renumbered from PR-009-C (D-15)*
28. **PR-010-A**: T-024 (240 LOC) — Test Fixtures & Factories

**Total (original plan)**: 7,885 LOC across 28 PRs (each ≤400 LOC). The additions above bring the PR count past 28; every added PR also stayed ≤400 LOC.

**Each PR**:
- ≤400 LOC (hard limit, verified)
- Complete feature slice (not just models, then services, then UI)
- Tests paired with implementation (same PR, TDD-first)
- Rollback boundary clear
- Single Conventional Commit message
- T-022 (Role Gating) placed EARLY to enable screen test verification

---

## CRITICAL: Role Gating Sequencing (T-022 Dependency)

**T-022 (PR-001-B) must execute BEFORE screen test verification for:**
- T-005 (PR-002-C): Ejercicio screen — requires role gating tests to pass
- T-009 (PR-004-B): Rutina screen — requires role gating tests to pass
- T-013 (PR-005-C): Cliente screen — requires role gating tests to pass
- T-017 (PR-007-A): Membresía screen — requires role gating tests to pass

**Updated dependency graph:**

```
T-001 (Prisma) →
├─ T-022 (Role Gating) [MUST BE HERE]
├─ T-023a (Auth Infrastructure: JWT, DB, Rate Limiting)
├─ T-002 (Ejercicio Domain) → T-003 (Ejercicio UI) → T-004 (Ejercicio API) → T-005 (Screen + Gate) → T-025 (Override Authorization)
├─ T-006 (Rutina Domain) → T-007a/b (Rutina UI) → T-008 (API) → T-009 (Screen + Gate)
├─ T-010 (Cliente Domain) → T-011 (Cliente UI) → T-012 (API) → T-013 (Screen + Gate)
├─ T-014 (Membresía Domain) → T-015 (UI) → T-016 (API) → T-017 (Screen + Gate)
├─ T-018 (Tarjeta_Detalle) → T-019 (Home_Socio)
├─ T-020 (Home_Interno Components) → T-021a (Home_Interno Part 1) → T-021b (Home_Interno Part 2) → T-021c (Home_Interno Data API, added)
├─ T-023a → T-026a (Login API, added) → T-026b (Login page, added) → T-026c (Proxy + RBAC, added)
├─ T-023b (UI Utilities: Validation, Formatting)
└─ T-024 (Test Fixtures)
```

---

## TDD Discipline Checklist

**Before `sdd-apply` for each task**:

- [ ] Test file created (.test.ts / .test.tsx) with all scenarios
- [ ] Tests fail (red phase)
- [ ] Implementation added (green phase)
- [ ] All tests pass: `npm test -- <path>`
- [ ] No type errors (`npx tsc --noEmit`) and **no new lint errors in touched files** (repo-wide `npm run lint` is not clean: 115 pre-existing errors, see D-14)
- [ ] Coverage ≥60% for new code
- [ ] **Smoke test** (`npm run dev` + `curl`/browser) for any task that touches routing, auth, proxy or API routes (D-21)
- [ ] Run the **full** `npm test` before the PR, not only the touched folders (L-10)
- [ ] Rollback boundary documented
- [ ] Commit message follows Conventional Commits

**Test command template**:
```bash
npm test -- src/domains/ejercicio/
npm test -- src/components/ejercicio-crud/
npm test -- src/api/ejercicios
npm test -- src/app/ejercicios
npm test -- src/middleware/role-gating
```

---

## Key Learnings

1. **Nested Component Complexity** (T-007a/b): EjercicioEnRutina table editing + reordering + validation splits across 2 tasks to stay ≤200 LOC per task.

2. **Home Page Integration Risk** (T-019, T-021a, T-021b): Multi-source data (Ejercicio, Rutina, Membresía, Cliente, Máquina) requires seeded test DB or comprehensive mock API. Use T-024 fixtures extensively. T-021 split into Part 1 (aggregations) and Part 2 (integration) to maintain LOC discipline under high risk.

3. **Referential Integrity Across Layers** (T-005 delete, T-016 delete, T-012 API): Domain validation → API error response (409 Conflict + reason) → UI confirmation modal. Test all 3 layers.

4. **Role Gating Dependency** (T-022): MUST execute in PR-001-B (immediately after Prisma schema) before any CRUD screen tests can pass. Screen test scenarios include role verification that requires working gating middleware.

5. **Test Data Consistency** (T-024): Factories must exactly match Prisma schema. Schema changes require factory updates. Document factory API clearly.

6. **Estimate by walking the mockup** (T-021): every card in the SVG needs an owner task. The plan skipped four components
   and the data API, so T-021 ran 4.5× over (L-01, D-01).

7. **Specs collide** (RN-06 vs AC-004): when a screen consumes a resource owned by a different role, cross-check both
   specs before touching permissions (L-02, D-09).

8. **Permissive mocks hide model drift** (FX-09): mocks shaped like the old model plus `objectContaining` let an
   editing bug through. Add guards driven by `prisma/schema.prisma` (L-03).

9. **Unit tests do not run the proxy** (FX-05, FX-07): after touching authentication do a manual smoke test
   (login → screen → API) (L-05).

10. **Reserve PR ids in the plan** before using them in a commit; `PR-009-C` was assigned twice (L-04).

11. **The author's `next dev` logs are the best bug report**: FX-08 and FX-09 were found there, not in the test suite (L-06).

12. **A utility layer is not a feature** (T-023a, T-022): JWT helpers and a role matrix do not give a login; the task that
    issues the session (T-026) was missing from the plan (L-07, D-24).

13. **Specs go stale too**: update the spec in the same PR that deviates from it (L-08, `decisions.md` §6).

14. **An `any` that silences the compiler hides the bug** (FX-13, FX-14): removing it exposed both the Prisma input-shape
    conflict and invalid enum values (L-09).

15. **Run the full suite before the PR**: a DB-backed test timed out only with all suites in parallel (FX-16, L-10).

---

## Next Phase: sdd-apply — current state

Executed so far: T-001 → … → T-021c and T-026a/b/c (see [Execution Status](#execution-status)).

Suggested order for what is left (details and severities in `decisions.md` §3 and `PROJECT-STATUS.md`):

1. **Verify before building more**: run `npx tsc --noEmit` locally (P-01), compare `/api/home-interno` numbers with
   real data (P-02), edit a client (name + membership + status) against the real database (P-21) and check the clients
   that were edited while FX-09 was open.
2. **P-03** Clientes screen: show the list even if the membership dropdown fails (`Promise.allSettled`).
3. **P-04** Make `ClienteRepository.create()` atomic (Usuario + Socio).
4. **T-023b** (PR-009-D) and **T-024** (PR-010-A), as planned.
5. **P-05** `/api/home-socio` (proposed T-028), **P-08** user seed script, **P-06 / P-20** token revocation and refresh
   (proposed T-027, needs a migration).
6. **P-15** log denied access to `AuditoriaAcceso` (proposed T-029); **P-16** rate-limit key outside Vercel;
   **P-22** rewrite the `authentication-login` spec.

Workflow (D-13): one branch per task from an up-to-date `main`, tests first, ≤400 LOC per PR, `npm test` green before merging.
