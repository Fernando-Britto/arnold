# Proposal: maquinas-crud (Etapa 1 — asignación dinámica de ejercicios)

## Intent

Enable the Administrador to register and manage the gym's physical machines — a catalog that today lives only in `prisma/schema.prisma` (`Maquina`) and a hardcoded seed. This is Etapa 1 of the "asignación dinámica de ejercicios" initiative: subsequent stages will wire Ejercicio↔Maquina relations (Etapa 2), the wait/suggestion engine (Etapa 3), session-driven `OCUPADA` state (Etapa 4) and Home_Socio visibility (Etapa 5).

Without this change, the admin has no way to add a new machine, retire one, or mark it out of service. Every downstream feature (dynamic assignment, waitlist, session tracking) requires a trustworthy, admin-curated machine catalog as its foundation.

## Scope

### In Scope

1. **Pure domain** at `src/domains/maquina/`: input validation (nombre 2–80, ubicacion 2–80, `tipoEquipamiento` against the Prisma enum, `estado` restricted to the admin-assignable subset), normalization (`btrim` + case-fold), and a `puedeEliminar(maquina, { ejerciciosAsociados })` pure function returning `{ permitido, motivo }`.
2. **REST API**: `GET/POST /api/maquinas` (list with `estado`, `tipoEquipamiento` filters and `nombre` search) and `GET/PUT/DELETE /api/maquinas/[id]`. ADMINISTRADOR only. All writes audited via `registrarOperacion` (`ALTA` / `MODIFICACION` / `BAJA`).
3. **Estado rules**: admin may only assign `DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA`. `OCUPADA` is rejected with 400 `ESTADO_NO_ASIGNABLE` on POST/PUT (even when unchanged). The existing seed row "Polea alta" currently carries `OCUPADA` and is shown as-is in the list; the edit UI forces one of the three assignable values for that row.
4. **Uniqueness**: no two machines with the same `nombre` + `ubicacion`, case- and accent-insensitive. Enforced by a hand-written migration adding a unique index on `lower(btrim(nombre)), lower(btrim(ubicacion))` (following D-70's pattern). A domain-level pre-check using the same normalization returns a friendly `DUPLICATE_NOMBRE_UBICACION` error (because `unaccent()` is STABLE, it cannot live inside the index — see Risks).
5. **DELETE**: physical today (the `Maquina` model has no relations). `puedeEliminar` is called with `ejerciciosAsociados = 0`; Etapa 2 passes the real count and maps to 409. Reuse `DELETE_BLOCKED_ASSIGNED` pattern from `route-error-mapper.ts` if the code fits, or introduce a new code with justification.
6. **Screen** `/maquinas` at `src/app/maquinas/page.tsx` (ADMINISTRADOR only), linked from the staff rail (`src/components/layout/staff-rail.tsx`, new `NavSection` `"maquinas"`). Modeled on `/membresias` — same layout components (`CrudPageLayout`, `FormPanelShell`, `ListPanelShell`, `CrudActions`, `ConfirmDialog`). New components under `src/components/maquina-crud/`.
7. **Seed fix**: change "Polea alta" from `OCUPADA` to `DISPONIBLE` in `prisma/seed-data.ts` line 155. Idempotency preserved (only effective on an empty DB — already-seeded installations fix the row from `/maquinas`).
8. **Spec**: `openspec/specs/maquinas-crud/spec.md` with requirements, acceptance criteria, edge cases and test scenarios traceable to Jest tests.

### Out of Scope (deferred to later etapas)

- `Ejercicio↔Maquina` relation (Etapa 2).
- Waitlist / suggestion engine (Etapa 3).
- Session-driven `OCUPADA` transition and check-in integration (Etapa 4).
- Home_Socio machine visibility (Etapa 5).
- New `/configuracion` parameters.
- Refactoring the `EstadoMaquina` drift in `home-interno.ts:14` and `tarjeta-detalle.tsx:41` (recorded as P-54, see Risks).
- Touching Home_Interno's "Estado de Equipos" card (recorded as P-53, see Risks).

## Capabilities

### New Capabilities

- `maquinas-crud`: CRUD of gym machines with validation, uniqueness, estado rules, audit trail, admin-only UI and API.

### Modified Capabilities

None. Home_Interno's `EstadoMaquina` consumers are explicitly **not** modified in this change (see P-53, P-54 in Risks).

## Stakeholder Impact

| Stakeholder | Impact |
|---|---|
| Administrador | Gains full CRUD UI + API to manage the machine catalog. New staff-rail entry "Máquinas". |
| Recepcionista / Instructor / Socio | Denied access to both `/maquinas` and `/api/maquinas` (explicit test in both permission matrices). No visible change otherwise. |
| Home_Interno card "Estado de Equipos" | No code change. Reading `prisma.maquina.findMany({ select: { estado: true } })` continues to work; the card naturally reflects user-driven deletions and estado changes. |
| Seed / fresh installs | "Polea alta" now starts `DISPONIBLE`. Already-seeded installations keep their existing `OCUPADA` row until manually edited through the new UI. |

## Approach

Follow the established **Membresías CRUD** blueprint (`src/app/api/membresias/`, `src/api/membresias.ts`, `src/domains/membresia/`, `src/app/membresias/page.tsx`):

1. **Layering** (ARQ-1):
   - `src/domains/maquina/maquina.ts` — pure domain: `validateMaquina`, `createMaquina`, `normalizeMaquina`, `puedeEliminar`, types, and `ESTADOS_ASIGNABLES` constant. Repository class loads Prisma via dynamic `import("@/lib/db")` to keep the module browser-safe (`dominios-puros.guard.test.ts`).
   - `src/api/maquinas.ts` — server handlers: `handleMaquinaList`, `handleMaquinaCreate`, `handleMaquinaGetById`, `handleMaquinaUpdate`, `handleMaquinaDelete`. Throw coded errors (`VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_NOMBRE_UBICACION`, `ESTADO_NO_ASIGNABLE`, `DELETE_BLOCKED_*`) mapped by `mapErrorToResponse`.
   - `src/app/api/maquinas/route.ts` and `[id]/route.ts` — thin HTTP handlers exporting both route handlers and `handle...Request` functions for testability without `NextRequest` mocking. `params` awaited (Next 16, FX-06).
2. **Permissions**: add `"/maquinas"` and `"/api/maquinas"` to `src/middleware/role-gating.ts` with `ADMINISTRADOR` only. **No** entry in `src/lib/authorization.ts` — the ADMIN `'*'` wildcard already covers it. `matrix-consistency.test.ts` must stay green. **Explicit test**: RECEPCIONISTA, INSTRUCTOR and SOCIO denied on both routes in BOTH matrices.
3. **Audit**: same shape as `membresias/route.ts` — `registrarOperacion({ tipoOperacion, responsableId, detalles })` using the `TipoOperacion` enum (`ALTA` / `MODIFICACION` / `BAJA`), best-effort (never alters the HTTP response).
4. **Uniqueness**: hand-written migration `prisma/migrations/<timestamp>_maquina_nombre_ubicacion_unique/migration.sql` adding `CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key" ON "Maquina" (lower(btrim(nombre)), lower(btrim(ubicacion)))`. Verified against the ephemeral Docker Postgres via `npm run test:integration`. Domain pre-check uses the same `lower(btrim(...))` normalization to return a friendly `DUPLICATE_NOMBRE_UBICACION` before hitting the DB; catch `P2002` in the repository and re-throw as the same code.
5. **Error mapping**: add `ESTADO_NO_ASIGNABLE → 400` and `DUPLICATE_NOMBRE_UBICACION → 409` to `src/lib/route-error-mapper.ts` with tests. Existing codes (`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `SERVER_ERROR`) apply directly.
6. **UI**: `src/app/maquinas/page.tsx` copies `src/app/membresias/page.tsx`. Components in `src/components/maquina-crud/` (`maquina-form.tsx`, `maquina-list.tsx`, `estado-badge.tsx`). Staff-rail item in the "Operación" zone alongside Clientes/Rutinas/Ejercicios.
7. **Strict TDD**: red → green at every layer (domain → handler → route → component), Jest only (`npm test`), integration test for the uniqueness index.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/domains/maquina/` | New | Pure domain: validation, normalization, `puedeEliminar`, `MaquinaRepository`. |
| `src/domains/maquina/maquina.test.ts` | New | Domain unit tests. |
| `src/api/maquinas.ts` | New | Server handlers + client wrappers (`fetchMaquinasList`, `deleteMaquina`). |
| `src/api/maquinas.test.ts` | New | Handler unit tests. |
| `src/app/api/maquinas/route.ts` | New | `GET` list + `POST` create. |
| `src/app/api/maquinas/route.test.ts` | New | Route unit tests (mock `@/api/maquinas`, `@/lib/db`, `@/lib/auth`, `@/lib/audit`). |
| `src/app/api/maquinas/[id]/route.ts` | New | `GET`/`PUT`/`DELETE`. |
| `src/app/api/maquinas/[id]/route.test.ts`, `route.delete.test.ts` | New | Route unit tests. |
| `src/app/maquinas/page.tsx` | New | CRUD screen (ADMINISTRADOR only). |
| `src/components/maquina-crud/` | New | `maquina-form.tsx`, `maquina-list.tsx`, `estado-badge.tsx` + tests. |
| `src/components/layout/staff-rail.tsx` | Modified | Add `"maquinas"` to `NavSection` union (line 8) and the nav item in "Operación". |
| `src/middleware/role-gating.ts` | Modified | Add `/maquinas` and `/api/maquinas` → `ADMINISTRADOR` only. |
| `src/middleware/matrix-consistency.test.ts` | Modified | Add explicit RECEPCIONISTA/INSTRUCTOR/SOCIO denial assertions for both routes in both matrices. |
| `src/lib/route-error-mapper.ts` | Modified | Add `ESTADO_NO_ASIGNABLE → 400` and `DUPLICATE_NOMBRE_UBICACION → 409`. |
| `src/lib/route-error-mapper.test.ts` | Modified | Cover new codes. |
| `prisma/migrations/<ts>_maquina_nombre_ubicacion_unique/migration.sql` | New | Hand-written unique index. |
| `prisma/seed-data.ts` | Modified | Line 155: Polea alta `estado: "OCUPADA"` → `"DISPONIBLE"`. |
| `openspec/specs/maquinas-crud/spec.md` | New | Spec with requirements, AC, edge cases, test scenarios. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **`unaccent()` is STABLE in Postgres**, so `lower(unaccent(...))` cannot live inside an index (requires IMMUTABLE). The chosen index uses `lower(btrim(...))` instead, which **does not fold accents**. | Certain | Mitigation is two-layer: (1) the unique index prevents raw-equal duplicates (race-safe); (2) a domain pre-check applies accent-insensitive comparison to surface `DUPLICATE_NOMBRE_UBICACION` with a friendly message *before* the insert. Document this tradeoff explicitly in the spec: the index alone does not fold accents, so "Polea" vs "Poléa" passes the index but is rejected by the pre-check. |
| **`EstadoMaquina` type drift** — duplicated as string-literal unions in `home-interno.ts:14` and `tarjeta-detalle.tsx:41`, not imported from Prisma. New code must not silently add a fourth definition. | Medium | New domain defines a single `ESTADOS_ASIGNABLES` constant; imports the Prisma `EstadoMaquina` enum for the full type. **Do not refactor** the two existing duplicates in this change (out of scope). Record as **P-54** in `openspec/decisions.md`: "Drift of `EstadoMaquina` literal types across three locations; consolidate when the feature closes." |
| **INACTIVA counts in Home_Interno's "Estado de equipos" total** (AC-005 of `home-interno-dashboard`), so deleting machines lowers the percentage. | Certain | Do not touch Home_Interno in this change. Record as **P-53** in `openspec/decisions.md`: "Revisit Home_Interno's 'Estado de equipos' denominators when the maquinas feature closes; today, deleting a machine changes the baseline." |
| **`OCUPADA` semantic clash** — admin cannot assign it, but the socio-facing `tarjeta-detalle.tsx` uses it to mean "machine in use right now" (derived runtime state). | Medium | Spec must state explicitly: `OCUPADA` is a derived state set by the session engine (Etapa 4–5), not assignable via CRUD. API returns 400 `ESTADO_NO_ASIGNABLE` if requested. The list shows existing `OCUPADA` rows as-is. The edit UI forces one of the three assignable values for such rows. Acceptance criterion + test required. |
| **Seed fix only effective on empty DB** — already-seeded installations keep the `OCUPADA` "Polea alta" row until edited manually. | Certain | Document in the spec and the seed file. Consider a data-fix migration? **Decision**: no migration; the admin fixes it from the new UI. The seed comment should state this. |
| **DELETE extension for Etapa 2** — needs a clean hook to reject deletes once `Ejercicio↔Maquina` exists. | Low | `puedeEliminar(maquina, { ejerciciosAsociados })` is the hook. Etapa 1 calls it with `0`; Etapa 2 passes the real count and maps the denial to 409. Reuse `DELETE_BLOCKED_ASSIGNED` code if it fits, or justify a new one (`DELETE_BLOCKED_EJERCICIOS`). |

## Rollback Plan

The change is additive — no existing behavior is modified except the seed constant and the staff-rail nav.

**If PR 1a needs reverting**:
1. `git revert` the PR merge commit.
2. Drop the new unique index if the migration applied: `DROP INDEX IF EXISTS "Maquina_nombre_ubicacion_key"`.
3. No data loss: no rows were mutated by the API (writes go through the new handlers, which no longer exist).

**If PR 1b needs reverting**:
1. `git revert` the PR merge commit.
2. Seed constant reverts with it — already-seeded DBs retain their current state.

**Full revert**: `git reset --hard` to the commit before the change. No migration needs to be rolled back (the unique index is purely additive and does not affect reads).

## Dependencies

- **Postgres `unaccent` extension**: already installed (`20261015200000_unaccent/migration.sql`). Not used in the index (STABLE), but available for the domain pre-check via `unaccent()` in a query.
- **Ephemeral Docker Postgres** (`npm run test:integration`): required to verify the hand-written migration before merging.
- **Membresías CRUD as blueprint**: existing patterns for API shape, audit calls, error mapping and UI layout.

## Success Criteria

- [ ] Administrador can create a machine with valid nombre (2–80), ubicacion (2–80), tipoEquipamiento (enum) and estado ∈ {DISPONIBLE, FUERA_DE_SERVICIO, INACTIVA}.
- [ ] Administrador cannot set estado = OCUPADA via API (400 `ESTADO_NO_ASIGNABLE`), even on PUT with unchanged value.
- [ ] Uniqueness: two machines with the same nombre+ubicacion (case/accent-insensitive) are rejected with 409 `DUPLICATE_NOMBRE_UBICACION`.
- [ ] DELETE is physical today; `puedeEliminar` returns `{ permitido: true, motivo: null }` when `ejerciciosAsociados = 0`.
- [ ] RECEPCIONISTA, INSTRUCTOR and SOCIO receive 403 on both `/maquinas` and `/api/maquinas` (test in both permission matrices).
- [ ] All writes (POST/PUT/DELETE) emit `registrarOperacion` with the correct `TipoOperacion` (`ALTA`/`MODIFICACION`/`BAJA`).
- [ ] `/maquinas` screen reachable from the staff rail, ADMINISTRADOR only, with list/form/delete flows working.
- [ ] Seed on an empty DB produces "Polea alta" as `DISPONIBLE`.
- [ ] `openspec/specs/maquinas-crud/spec.md` lists ACs traceable to Jest tests.
- [ ] `matrix-consistency.test.ts`, `dominios-puros.guard.test.ts` and the full `npm test` suite stay green.
- [ ] P-53 and P-54 recorded in `openspec/decisions.md`.

## PR Split

### PR 1a — Domain + API + permissions + audit + spec + migration
- Pure domain (`src/domains/maquina/` + tests).
- Server handlers (`src/api/maquinas.ts` + tests).
- Route handlers (`src/app/api/maquinas/route.ts`, `[id]/route.ts` + tests).
- `route-error-mapper.ts` additions + tests.
- Permission entries in `role-gating.ts` + denial tests in `matrix-consistency.test.ts`.
- Hand-written migration + integration test.
- `openspec/specs/maquinas-crud/spec.md`.
- P-53, P-54 entries in `openspec/decisions.md`.

### PR 1b — Screen + nav + seed
- `src/app/maquinas/page.tsx` + components in `src/components/maquina-crud/` + tests.
- Staff-rail nav item + `NavSection` union extension.
- `prisma/seed-data.ts` fix for Polea alta.

Each PR respects the ≤400-line review budget (chain via `chained-pr` if exceeded).

## Open Questions for Spec/Design

1. **Error code for DELETE blocked by Ejercicios (Etapa 2)**: reuse `DELETE_BLOCKED_ASSIGNED` (currently for Membresía→Socio) or introduce `DELETE_BLOCKED_EJERCICIOS`? Recommend: introduce a new code; the message template differs ("N ejercicios usan esta máquina" vs "N socios asignados"), and the code is part of the API contract.
2. **`EstadoMaquina` type source**: should the new domain import `EstadoMaquina` from `@prisma/client` or keep its own literal union? Recommend: import from Prisma (single source of truth) and leave the two existing duplicates alone (P-54).
3. **Filter semantics**: should `nombre` search be substring-insensitive (like `/membresias`) or word-based (like `busqueda.ts` for the exercise modal)? Recommend: substring-insensitive, matching the Membresías convention for CRUD list panels.
4. **Staff-rail zone**: "Operación" alongside Clientes/Rutinas/Ejercicios, or a new "Instalaciones" zone? Recommend: "Operación" — semantically fits and avoids a new zone for a single item.
5. **Seed `ubicacion`**: keep the shared default `"Sala principal"` for all machines, or give each seed row a distinct location for realism? Recommend: keep as-is (out of scope).
