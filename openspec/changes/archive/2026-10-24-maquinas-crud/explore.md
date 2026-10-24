# Exploration: maquinas-crud (Etapa 1 — asignación dinámica de ejercicios)

## Current State

The `Maquina` model exists in `prisma/schema.prisma` (lines 380–391) with fields `id`, `nombre`, `tipoEquipamiento` (enum `TipoEquipamiento`), `estado` (enum `EstadoMaquina`, default `DISPONIBLE`), `ubicacion`, `fechaAlta`, `updatedAt`. Indexes on `estado` and `tipoEquipamiento` only — **no uniqueness constraint** on (nombre, ubicacion).

There is **no API, no domain module, no screen, no `src/api/maquinas.ts`**. The only consumer today is `prisma/seed-data.ts` (line 244), which bulk-inserts machines when the table is empty, and `src/api/home-interno-data.ts` (line 66), which reads `prisma.maquina.findMany({ select: { estado: true } })` for the "Estado de Equipos" card on Home_Interno. The home-interno domain derives `EstadoMaquina` as a **local string-literal union type** (see Risks).

### Seed data (every seeded machine)

| nombre | tipoEquipamiento | estado | ubicacion |
|---|---|---|---|
| Prensa de piernas | MAQUINA_GUIADA | DISPONIBLE | "Sala principal" (hardcoded in seed) |
| **Polea alta** | MAQUINA_GUIADA | **OCUPADA** | "Sala principal" |
| Banco plano | PESO_LIBRE | DISPONIBLE | "Sala principal" |
| Rack de sentadillas | PESO_LIBRE | DISPONIBLE | "Sala principal" |
| Cinta 1 | CARDIO | DISPONIBLE | "Sala principal" |
| Bicicleta fija | CARDIO | FUERA_DE_SERVICIO | "Sala principal" |

**Polea alta is flagged**: it carries `estado: "OCUPADA"`, which under this change's rules is not assignable by an admin. Seed must change it to `DISPONIBLE`.

### Enums (schema.prisma)

- `TipoEquipamiento`: `MAQUINA_GUIADA`, `PESO_LIBRE`, `CARDIO`
- `EstadoMaquina`: `DISPONIBLE`, `OCUPADA`, `FUERA_DE_SERVICIO`, `INACTIVA`

---

## Affected Areas

### Pure domain (`src/domains/maquina/`)

New directory, new files — no existing code to modify. Follow `src/domains/membresia/membresia.ts` shape: a `maquina.ts` exporting `validateMaquina` (pure, no Prisma), `createMaquina` (normalization), a `Maquina` type, and a `MaquinaRepository` class whose Prisma access is loaded via `await import("@/lib/db")` (dynamic, so the domain stays browser-safe per `dominios-puros.guard.test.ts`).

### REST API — `src/app/api/maquinas/`

New files, modeled on `src/app/api/membresias/`:

- `src/app/api/maquinas/route.ts` — GET (list with filters) + POST
- `src/app/api/maquinas/[id]/route.ts` — GET + PUT + DELETE

Each exports both thin HTTP handlers (`GET`/`POST`/`PUT`/`DELETE`) and an exported `handle...Request` function for testability without `NextRequest` mocking. Pattern to copy verbatim: `route.ts:40-80` (list/create), `route.ts:45-105` (get-by-id), `route.ts:66-84` (update), `route.ts:90-105` (delete).

### API handler layer — `src/api/maquinas.ts`

New file, modeled on `src/api/membresias.ts`. Server-side handlers (`handleMaquinaList`, `handleMaquinaCreate`, `handleMaquinaGetById`, `handleMaquinaUpdate`, `handleMaquinaDelete`) + client wrappers (`fetchMaquinasList`, `deleteMaquina`). Validation throws `VALIDATION_ERROR: ...` or sets `error.code` for business errors (`NOT_FOUND`, `DELETE_BLOCKED_EJERCICIOS`, `DUPLICATE_NOMBRE_UBICACION`, `ESTADO_NO_ASIGNABLE`). The route handlers map these via `mapErrorToResponse`.

### Screen — `src/app/maquinas/page.tsx`

New file, copy `src/app/membresias/page.tsx`. Same imports pattern (`useAuth`, `useNotifications`, `handleApiError`, `ConfirmDialog`, `CrudPageLayout`, `CrudActions`, `FormPanelShell`, `ListPanelShell`). Replace `Membresia*` components with `Maquina*` equivalents in `src/components/maquina-crud/`.

### Navigation

- `src/components/layout/staff-rail.tsx` — add a "Máquinas" nav item. Best fit: new zone or append to "Operación" alongside Clientes/Rutinas/Ejercicios. Item: `{ section: "maquinas", label: "Máquinas", href: "/maquinas", roles: ["ADMINISTRADOR"] }`. **No Maquina type exists in `NavSection` union** — `"maquinas"` must be added to the `NavSection` type (line 8).

### Spec

- `openspec/specs/maquinas-crud/spec.md` — new spec, modeled on `openspec/specs/membresias-crud/spec.md`.

---

## Patterns to copy (concrete file paths)

### 1. API handler shape

`src/api/membresias.ts` — the canonical blueprint:
- `handleMembresiaCreate(input)` → validate → `repository.create(normalized)` → return domain object
- Throws `new Error(\`VALIDATION_ERROR: ${msg}\`)` with `(error as CodedError).code = "VALIDATION_ERROR"`
- Throws `NOT_FOUND: Máquina no encontrada` with `(error as CodedError).code = "NOT_FOUND"`
- Client wrappers use `throwIfNotOk` and `conCache`/`invalidarCache` from `@/lib/cache-cliente`

### 2. Audit call shape

`src/lib/audit.ts` → `registrarOperacion({ tipoOperacion, responsableId, detalles })`. The `RegistroDeAuditoria` model uses the **enum** `TipoOperacion` with values `ALTA | BAJA | MODIFICACION | ANULACION` (NOT free-text). Call sites:
- POST (create): `tipoOperacion: "ALTA"`, `detalles: { maquinaId: result.id }`
- PUT (update): `tipoOperacion: "MODIFICACION"`, `detalles: { maquinaId: result.id }`
- DELETE: `tipoOperacion: "BAJA"`, `detalles: { maquinaId: id }`

The call must be **best-effort** (never alters the HTTP response) — exactly as `membresias/route.ts:114-123` and `[id]/route.ts:144-161,174-182`.

### 3. Error mapping

`src/lib/route-error-mapper.ts` → `mapErrorToResponse(error, { resourceName: "Máquina", forbiddenMessage: "Se requiere rol de administrador" })`. New error codes this change needs (must be added to the mapper):
- `ESTADO_NO_ASIGNABLE` → 400 (admin sends `OCUPADA`)
- `DUPLICATE_NOMBRE_UBICACION` → 409 (unique violation on nombre+ubicacion)

Existing codes that apply directly: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `FORBIDDEN` (403), `SERVER_ERROR` (500).

### 4. Repository vs handler split

Follows the two-layer ARQ-1 pattern:
- `src/domains/maquina/maquina.ts` — **pure domain** (`validateMaquina`, `createMaquina`, types) + `MaquinaRepository` class (data access via dynamic `import("@/lib/db")`)
- `src/api/maquinas.ts` — **server handlers** that compose domain + repository (call from route handlers)

Validation logic lives in the domain, NOT in the handler — `dominios-puros.guard.test.ts` forbids static `@/lib/db` imports.

### 5. Test file naming and location

- `src/app/api/maquinas/route.test.ts` — HTTP handler tests (mock `@/api/maquinas`, `@/lib/db`, `@/lib/auth`, `@/lib/audit`)
- `src/app/api/maquinas/[id]/route.test.ts` and `[id]/route.delete.test.ts`
- `src/api/maquinas.test.ts` — server handler tests
- `src/domains/maquina/maquina.test.ts` — pure domain tests (validation, normalization)
- `src/components/maquina-crud/maquina-form.test.tsx`, `maquina-list.test.tsx` — UI component tests
- `src/lib/route-error-mapper.test.ts` — add new code cases here

### 6. How `/api/...` gets ADMIN-only protection today

Two independent gates:
- **Proxy** (`src/proxy.ts`): calls `decideAccess` → `hasRouteAccess(rol, pathname, method)` from `src/lib/authorization.ts`. ADMINISTRADOR has `'*'` wildcard (all methods, all paths) — so `/api/maquinas` is **already covered by the wildcard**. No entry needed in `ROLE_PERMISSIONS` for ADMIN.
- **Handler-level role check**: the `membresias` routes do NOT check roles in the handler (they rely entirely on the proxy + the fact that only ADMIN has wildcard access). But `pagos/route.ts` and others DO check `ALLOWED_ROLES` inside the handler (defense in depth). For machines (ADMIN-only), the proxy wildcard is sufficient, but an explicit `ALLOWED_ROLES = ["ADMINISTRADOR"]` check inside the handler is recommended for clarity and consistency with `authorization-consistency.test.ts`.

**Key nuance**: the `authorization-consistency.test.ts` scans every `route.ts`, reads `ALLOWED_ROLES` constants, and verifies the matrix does not over-grant. For a pure-ADMIN route, if the handler declares `const ALLOWED_ROLES = ["ADMINISTRADOR"]`, the test will verify non-ADMIN roles are NOT granted by the matrix. Since ADMIN has wildcard and no other role has `/api/maquinas` in their paths, this passes automatically. **No matrix entry needed** in `authorization.ts`.

### 7. Migration conventions

- Location: `prisma/migrations/<timestamp>_<description>/migration.sql`
- Naming: 14-digit timestamp (YYYYMMDDHHMMSS) + snake_case description. Last migration is `20261019120000_catalogo_ejercicios` (Oct 19). Today is Oct 23 → no collision risk. Next would be `20261023xxxxxx_<name>`.
- D-70 (`20261019120000_catalogo_ejercicios`) is the reference for a hand-written migration adding a unique index:
  ```sql
  CREATE UNIQUE INDEX "Ejercicio_datasetId_key" ON "Ejercicio"("datasetId");
  ```
- The `unaccent` extension already exists (`20261015200000_unaccent/migration.sql`) — available for accent-insensitive uniqueness.
- `prisma migrate status` currently at 18/18. This change adds one migration → 19/19.

### 8. Seed

`prisma/seed-data.ts` line 244–246: machines are inserted via `createMany` only `if ((await prisma.maquina.count()) === 0)` — already idempotent. Required fix: change `Polea alta`'s `estado` from `"OCUPADA"` to `"DISPONIBLE"` (line 155). The hardcoded `ubicacion: "Sala principal"` is also currently duplicated per-row via `.map()` — keep as-is or move to a shared constant; out of scope.

---

## Approaches for uniqueness (Scope item 4)

The requirement: no two machines with the same `nombre` AND same `ubicacion`, compared case- and accent-insensitive.

### Approach A: Hand-written unique index migration (like D-70)

Add a migration with an expression-based unique index:
```sql
CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key"
ON "Maquina" (lower(unaccent(nombre)), lower(unaccent(ubicacion)));
```
- **Pros**: enforced at the DB level (race-safe, no TOCTOU); `unaccent` extension already installed; follows D-70 convention; seed already has distinct (nombre, ubicacion) pairs (all "Sala principal" but different nombres) — **no seed collision**.
- **Cons**: requires catching `P2002` in the repository/handler and mapping to `DUPLICATE_NOMBRE_UBICACION`; slightly more complex SQL.
- **Effort**: Low

### Approach B: Domain-level check (query-then-insert)

In `MaquinaRepository.create`, first do `findFirst` with normalized comparison, throw `DUPLICATE_NOMBRE_UBICACION` if found.
- **Pros**: no migration; portable.
- **Cons**: **TOCTOU race** — two concurrent creates can both pass the check and insert duplicates; the domain layer has no transaction isolation guarantee here. Violates the "uniqueness enforced at the DB" principle.
- **Effort**: Low, but weaker correctness.

### Recommendation

**Approach A (unique index)** — it's the project's established pattern (D-70), race-safe, and the seed does not collide. The exploration confirms `unaccent` is available and the migration path is clean. sdd-design should confirm, but A is the strong default.

---

## Risks

1. **`EstadoMaquina` is a string-literal type duplicated across the codebase**, NOT a single Prisma enum import. Three locations:
   - `prisma/schema/prisma` enum `EstadoMaquina` (schema truth)
   - `src/domains/home-interno/home-interno.ts:14` — `export type EstadoMaquina = "DISPONIBLE" | "OCUPADA" | "FUERA_DE_SERVICIO" | "INACTIVA"`
   - `src/components/home-socio/tarjeta-detalle.tsx:41` — same union

   This change's domain should either (a) import the Prisma enum, or (b) keep its own literal type consistent with the schema. If the domain defines its own type, a guardian test or shared type is needed to prevent drift. **This duplication is a latent defect** — `home-interno.ts` and `tarjeta-detalle.tsx` will NOT auto-update if the schema enum changes.

2. **`tarjeta-detalle.tsx` uses `OCUPADA`** as a display value for "machine in use" (with `tiempoLibreEstimadoMin`). This is the socio-facing training view, where `OCUPADA` means "someone is using it right now" — a derived/runtime state, not the persisted `estado`. This usage is **compatible** with the rule "admin cannot set OCUPADA" (it's derived from active sessions, not the DB column), but the shared type name creates confusion. Must be documented in the spec so the `OCUPADA`-rejected-by-API rule is understood as "not assignable via CRUD," not "the value never appears."

3. **Home_Interno reads `prisma.maquina.findMany`** (`home-interno-data.ts:66`) for the "Estado de Equipos" card. After this change, the same `Maquina` table is user-managed. The card's `computeEstadoEquipos` filters `FUERA_DE_SERVICIO`/`INACTIVA` — no conflict, but the card assumes all machines are present. If a machine is deleted, the card naturally reflects it. No code change needed, but worth noting the shared table.

4. **DELETE is physical today, but the scope requires a 409 extension point for Etapa 2.** The `Maquina` model currently has **no relations** — nothing cascades, nothing blocks delete. The extension point is: when Etapa 2 adds `Ejercicio↔Maquina` (likely a join table or FK), the `delete` handler must check for referencing rows and throw `DELETE_BLOCKED_EJERCICIOS` → 409. Today's DELETE can be a simple physical delete, but the handler should be structured to add the guard easily (e.g., a `maquinaUsadaEnEjercicios(id)` repository method that returns 0 today). **Design decision needed**: add the guard scaffolding now (returns 0, no-op) or defer to Etapa 2.

5. **Seed idempotency**: the seed uses `createMany` guarded by `count() === 0`. Changing Polea alta's estado to `DISPONIBLE` is only effective on a fresh seed. **Machines already seeded with `OCUPADA` will keep it** unless the migration/handler also validates existing data. The API rejects `OCUPADA` on write, but does not prevent reading existing `OCUPADA` rows. This is fine (home-interno already handles the value), but the seed correction only takes effect on re-seed. Consider: should a migration fix existing `OCUPADA` rows, or is re-seed enough?

6. **OCUPADA state machine clarity**: `OCUPADA` exists in the enum but this API cannot set it. The spec must state that `OCUPADA` is a derived state set by the session engine (Etapa 4–5, out of scope). The API must return 400 `ESTADO_NO_ASIGNABLE` if `OCUPADA` is requested.

---

## Open questions for propose/spec/design

1. **Uniqueness**: confirm Approach A (unique index) vs B (domain check). Recommendation: A.
2. **DELETE strategy**: physical delete now + scaffolding for 409 guard, or full guard now? Recommendation: physical delete, add a repository method `ejerciciosQueUsanMaquina(id)` returning `[]` today, expand in Etapa 2.
3. **`EstadoMaquina` type**: should the new domain import from Prisma client (`import { EstadoMaquina } from "@prisma/client"`) or define a local literal? If import, `home-interno.ts` and `tarjeta-detalle.tsx` should migrate to it too (out of scope but noted).
4. **Migration for existing `OCUPADA` rows**: re-seed only, or also a data-fix migration?
5. **Screen zone in staff-rail**: "Operación" (alongside Clientes/Rutinas/Ejercicios) or a new zone? "Operación" fits semantically.
6. **Seed `ubicacion`**: currently hardcoded to "Sala principal" in `.map()`. Should the `MAQUINAS` constant in `seed-data.ts` include `ubicacion` per row for realism, or keep the shared default?

---

## Confirmations

- **Highest decision**: D-72 (confirmed, decisions.md:1318)
- **Highest open task**: T-050g (confirmed, sdd-tasks-tdd.md:93) — the stated "T-050" is a prefix; the last sub-task is T-050g
- **Highest open P**: P-50 (licensing/attribution for exercise media), P-11 (proxy caching), P-23 (Edge/Node discrepancy), P-30 (biometric hardware), P-44 (performance), P-49 (design confirmation), P-52 resolved
- **Last migration**: `20261019120000_catalogo_ejercicios` (18/18). No naming collision expected for an Oct 23 migration.
- **`RegistroDeAuditoria.accion`**: uses the `TipoOperacion` enum (`ALTA | BAJA | MODIFICACION | ANULACION`), NOT free-text. Confirmed at schema.prisma:588–593.

---

## Ready for Proposal

Yes. All patterns are confirmed from the Membresías CRUD reference implementation. The codebase is consistent and the exploration surface is complete. The two decisions above (uniqueness approach, DELETE strategy) can be resolved in propose or design — neither blocks spec.
