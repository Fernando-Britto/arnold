# Design: Máquinas CRUD (Etapa 1 — asignación dinámica de ejercicios)

## approach

Build the machine catalog CRUD by cloning the proven **Membresías CRUD blueprint** layer-by-layer
(`src/app/api/membresias/`, `src/api/membresias.ts`, `src/domains/membresia/`, `src/app/membresias/page.tsx`),
with three deliberate upgrades that this change's requirements force:

1. **Uniqueness of `(nombre, ubicacion)`** is enforced in *two layers* (approach **(b)**, already chosen by
   the human): a hand-written `CREATE UNIQUE INDEX` on `lower(btrim(...))` (race-safe, case-insensitive, but
   **not** accent-folding) plus a repository pre-check using `unaccent()` (accent-insensitive, best-effort,
   not race-safe). The index guarantees correctness under concurrency; the pre-check returns the friendly
   `DUPLICATE_NOMBRE_UBICACION` for accent-only collisions the index cannot see. `P2002` from a lost race is
   caught and re-thrown as the same code.
2. **`estado = OCUPADA` is not assignable.** It is a *derived* state owned by the session engine (Etapa 4–5).
   The pure domain's `validateMaquina` rejects it; the handlers surface the specific `ESTADO_NO_ASIGNABLE`
   (400) code, including on PUT where the value is unchanged.
3. **A `puedeEliminar` extension point** — a pure function consulted by the DELETE handler today with
   `ejerciciosAsociados: 0` (always permits), and wired to the real `Ejercicio↔Maquina` count in Etapa 2.

The domain module is split into `maquina.ts` (pure) + `maquina-repositorio.ts` (data access via a
`MaquinaReader` interface) rather than a single `membresia.ts`-style file — see
[Architecture Decision: domain split](#architecture-decision-domain-split).

The `openspec/specs/maquinas-crud/spec.md` is already complete and is the contract this design satisfies;
it is **not** re-authored in apply. Recording P-53/P-54 in `openspec/decisions.md` is a later tasks/close
step, out of scope for this phase.

## architecture

### Layering (ARQ-1)

```
src/app/api/maquinas/route.ts        → thin HTTP (GET/POST), maps errors, audits
src/app/api/maquinas/[id]/route.ts   → thin HTTP (GET/PUT/DELETE), maps errors, audits
        │ calls
src/api/maquinas.ts                  → server handlers + client wrappers
        │ calls
src/domains/maquina/maquina.ts       → pure: validate, normalize, puedeEliminar, constants, types
src/domains/maquina/maquina-repositorio.ts → data access (Prisma via MaquinaReader)
```

- Pure business logic lives in `src/domains/maquina/maquina.ts` with **no data access** (ARQ-1).
- The repository loads Prisma only via `await import("@/lib/db")` (deferred), keeping the module
  browser-safe per `src/domains/dominios-puros.guard.test.ts`.
- `MaquinaReader` declares only the delegate methods + `$queryRaw` the repository uses, so unit tests
  inject a mocked reader and never touch Prisma — the same DI pattern as `ejercicio-repositorio.ts`
  (D-70), which the guard test's own docstring cites as canonical.

### Data flow

```
                    GET /api/maquinas?estado=&tipoEquipamiento=&nombre=
Administrador ──▶ route.ts ──▶ handleMaquinaList ──▶ MaquinaRepository.getAll (findMany + where)
                                                          │
                   POST /api/maquinas                     ▼
Administrador ──▶ route.ts ──▶ handleMaquinaCreate ──▶ validateMaquina (pure)
                                                          │ normalizeMaquina (pure)
                                                          ▼
                                              MaquinaRepository.create
                                                 ├─ existeDuplicado (unaccent pre-check)
                                                 ├─ maquina.create  → P2002? → DUPLICATE_NOMBRE_UBICACION
                                                 └─ return Maquina
                                                          │
                   route.ts ◀── registrarOperacion({ALTA, responsableId, {maquinaId}})  (best-effort)
```

Same shape for `PUT /api/maquinas/[id]` (merge → `estado==="OCUPADA"` guard → validate/normalize →
pre-check excluding self → update) and `DELETE` (`puedeEliminar(maquina, { ejerciciosAsociados: 0 })` →
physical delete).

---

## Architecture Decisions

### Decision: Two-layer uniqueness — index (case-insensitive) + pre-check (accent-insensitive)

**Choice**: approach **(b)**.

1. Hand-written migration adds:

   ```sql
   CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key"
     ON "Maquina" (lower(btrim("nombre")), lower(btrim("ubicacion")));
   ```

2. The repository runs an accent- and case-insensitive pre-check **before** insert/update:

   ```sql
   SELECT 1 FROM "Maquina"
   WHERE  unaccent(lower(btrim("nombre")))    = unaccent(lower(btrim($1)))
     AND  unaccent(lower(btrim("ubicacion"))) = unaccent(lower(btrim($2)))
     [ AND "id" <> $3 ]   -- only on update, to exclude self
   LIMIT 1
   ```

3. The repository catches Prisma `P2002` and re-throws `DUPLICATE_NOMBRE_UBICACION`.

**Alternatives considered**:

- **`lower(unaccent(...))` inside the index** — rejected: Postgres requires index expressions to be
  `IMMUTABLE`; `unaccent()` is declared `STABLE` (its output depends on the `unaccent` dictionary config),
  so `CREATE INDEX ... ON ... (lower(unaccent(col)))` fails with `functions in index expression must be
  marked IMMUTABLE`.
- **An `IMMUTABLE` wrapper around `unaccent`** (e.g. `CREATE FUNCTION public.unaccent_immutable(text)
  RETURNS text IMMUTABLE AS $$ SELECT public.unaccent($1) $$ LANGUAGE sql`) — rejected. It *would* allow
  the accent fold inside the index, but: (a) it depends on the `unaccent` extension living in a specific
  schema (`public` vs Supabase's `extensions` schema), which makes the migration non-portable across the
  dev DB, the Docker test DB and Supabase; (b) it hardcodes a `search_path` assumption that the rest of the
  codebase deliberately avoids (the existing `20261015200000_unaccent` migration calls `unaccent`
  unqualified); (c) an `IMMUTABLE` wrapper that ignores dictionary changes is a footgun — a dictionary
  update would silently change the index semantics without reindexing. The two-layer design is more honest
  and keeps every Postgres-level object `IMMUTABLE`-safe.
- **Domain-only check (approach B from explore)** — rejected: TOCTOU race; two concurrent creates both
  pass the `findFirst` and insert duplicates. The DB index is the only race-safe layer.

**Why the pre-check lives in the repository, not the pure domain**: ARQ-1 forbids data access in the pure
domain. The pre-check is a query, so it belongs in `maquina-repositorio.ts` (same place as the `P2002`
catch). The handler stays thin: it validates/normalizes and calls `repository.create` / `repository.update`.

**Canonical form — what is stored vs what is compared** (this resolves the proposal's §Approach 4
inconsistency, see the note in [Risks](#risks-and-rejected-alternatives)):

- **Stored**: `normalizeMaquina` produces `trim(value)` + collapse of internal whitespace runs to single
  spaces (`value.trim().replace(/\s+/g, " ")`). Case and accents are **preserved** in the stored value.
- **Compared by the index**: `lower(btrim(nombre))`, `lower(btrim(ubicacion))` — case-insensitive,
  accent-**sensitive** (because `unaccent` cannot be in the index).
- **Compared by the pre-check**: `unaccent(lower(btrim(...)))` — case- and accent-insensitive.

Because normalization runs **upstream of both layers**, the stored value already has no leading/trailing
whitespace and no internal runs, so the index's `btrim` and the pre-check's `btrim` are belt-and-suspenders
(covers any row inserted outside this code path). The spec's requirement "the two layers must agree on the
canonical form" holds because there is exactly one normalization entry point (`normalizeMaquina`).

**`P2002` detection without `any`**: follow the established `esErrorP2002` helper (`src/api/rutinas.ts:76`):

```ts
function esErrorP2002(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}
```

`Maquina` has exactly one unique constraint after this change (the new index; `id` is a cuid PK and cannot
collide), so any `P2002` on `maquina.create`/`maquina.update` is necessarily the `(nombre, ubicacion)`
index. No `meta.target` disambiguation is required today; a `shortcut:` comment marks that a second unique
field would need it.

**Migration**: `prisma/migrations/20261023120000_maquina_nombre_ubicacion_unique/migration.sql` (timestamp
after the last migration `20261019120000_catalogo_ejercicios`), exact SQL as above. `prisma migrate
status` goes 18/18 → 19/19.

**Integration proof**: `tests/integration/maquina.integration.test.ts` runs under
`npm run test:integration` (ephemeral Docker Postgres, real `prisma migrate deploy`). It asserts:
1. A raw second `prisma.maquina.create` with only **case** differing rejects with `P2002` (proves
   `lower(...)` folding in the index).
2. The **repository** maps that case-only duplicate to `DUPLICATE_NOMBRE_UBICACION`.
3. An **accent-only** duplicate ("Polea" vs "Poléa") is rejected by the repository pre-check with
   `DUPLICATE_NOMBRE_UBICACION` **before** insert.
4. A raw `prisma.maquina.create` of the accent-only duplicate **succeeds** at the DB level (proves the
   index does **not** fold accents — the pre-check is the accent layer).
5. The seed's six `(nombre, ubicacion)` pairs are all distinct (all `"Sala principal"` but different
   `nombre`s) — a **verified precondition** that the migration applies cleanly to a seeded DB.

---

### Decision: `puedeEliminar` returns `{ permitido, motivo }`, and Etapa 1 passes `0`

**Choice**: a pure function in `src/domains/maquina/maquina.ts`:

```ts
export function puedeEliminar(
  maquina: Maquina,
  context: { ejerciciosAsociados: number }
): { permitido: boolean; motivo: string | null } {
  if (context.ejerciciosAsociados > 0) {
    return {
      permitido: false,
      motivo: `${context.ejerciciosAsociados} ejercicios usan esta máquina`,
    };
  }
  return { permitido: true, motivo: null };
}
```

The DELETE handler (`handleMaquinaDelete`) fetches the machine (404 if absent), calls
`puedeEliminar(maquina, { ejerciciosAsociados: 0 })`, and:

```ts
const decision = puedeEliminar(maquina, { ejerciciosAsociados: 0 });
if (!decision.permitido) {
  throw codedError("DELETE_BLOCKED_EJERCICIOS", `No se puede eliminar: ${decision.motivo}`);
}
await repository.delete(id);
```

**Error code decision**: introduce **`DELETE_BLOCKED_EJERCICIOS`** (409). The spec already assumes it.
Rationale: `DELETE_BLOCKED_ASSIGNED` is already semantically overloaded (Membresía→Socio **and**
Ejercicio→Rutina FK block), and its message template is "N socios asignados", whereas this is "N ejercicios
usan esta máquina". The code is part of the API contract — a distinct code lets clients branch without
string-matching (D-39's lesson about the Ejercicios delete). **No spec update is needed**: the spec
(Requirement "Delete and the `puedeEliminar` extension point") already mandates `DELETE_BLOCKED_EJERCICIOS`
and its blocked-branch unit test. `puedeEliminar`'s blocked branch is unit-tested today with a non-zero
count, even though the Etapa 1 handler always passes `0`.

---

### Decision: Domain split — `maquina.ts` (pure) + `maquina-repositorio.ts` (data)

**Choice**: two files, following the **newest** domain pattern (`ejercicio.ts` + `ejercicio-repositorio.ts`,
`rutina.ts` + `rutina-repositorio.ts`) instead of the proposal's single `membresia.ts`-style file.

- `src/domains/maquina/maquina.ts` — pure: `Maquina`, `MaquinaInput` types, `TipoEquipamiento` /
  `EstadoMaquina` re-exports, `ESTADOS_ASIGNABLES`, `TIPOS_EQUIPAMIENTO`, `validateMaquina`,
  `normalizeMaquina`, `normalizarTexto`, `puedeEliminar`. No Prisma import at all (not even type-only).
- `src/domains/maquina/maquina-repositorio.ts` — `MaquinaReader` interface, `MaquinaRepository` class,
  `maquinaRepository` singleton. `import type { Prisma } from "@prisma/client"` at the top; the *value*
  `Prisma` (for `Prisma.sql`) is loaded dynamically inside the `$queryRaw` method.

**Alternatives considered**: single `maquina.ts` (the proposal's literal instruction). Rejected because
the repository needs `$queryRaw` for the accent-insensitive pre-check, and injecting a `MaquinaReader`
(a) keeps the pure file free of any Prisma mention, and (b) makes the pre-check and `P2002` unit-testable
with a plain mocked reader rather than mocking `await import("@/lib/db")`. The split is explicitly endorsed
by the guard test's docstring, which lists `ejercicio-repositorio.ts` and `rutina-repositorio.ts` as the
canonical examples.

**Exact import strategy that keeps `dominios-puros.guard.test.ts` green** (the guard rejects only static
`import ... from "@/lib/db"`):

```ts
// maquina-repositorio.ts
import type { Maquina, Prisma } from "@prisma/client"; // type-only: erased at compile time

export interface MaquinaReader {
  maquina: {
    create(args: { data: ... }): Promise<Maquina>;
    findUnique(args: { where: { id: string } }): Promise<Maquina | null>;
    findMany(args?: { where?: ...; orderBy?: { nombre: "asc" } }): Promise<Maquina[]>;
    update(args: { where: { id: string }; data: ... }): Promise<Maquina>;
    delete(args: { where: { id: string } }): Promise<Maquina>;
  };
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
}

async function getPrisma(): Promise<MaquinaReader> {
  const { prisma } = await import("@/lib/db"); // deferred: never a static import
  return prisma;
}
```

The pure `maquina.ts` never imports Prisma at all, so the client-side form (`maquina-form.tsx` importing
`validateMaquina`) pulls zero Prisma into the browser bundle.

**Type source (avoids a fourth `EstadoMaquina` definition, P-54)**: the domain imports the enum **types**
from Prisma (`import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client"`) rather than declaring
its own literal unions, so this change does **not** add a fourth `EstadoMaquina` definition. The
assignable subset is a runtime constant, not a type:

```ts
export const ESTADOS_ASIGNABLES = ["DISPONIBLE", "FUERA_DE_SERVICIO", "INACTIVA"] as const;
export type EstadoAsignable = (typeof ESTADOS_ASIGNABLES)[number];
export const TIPOS_EQUIPAMIENTO = ["MAQUINA_GUIADA", "PESO_LIBRE", "CARDIO"] as const;
```

`validateMaquina` checks `estado` against `ESTADOS_ASIGNABLES` (rejects `OCUPADA`) and `tipoEquipamiento`
against `TIPOS_EQUIPAMIENTO`. The two existing `EstadoMaquina` literal unions (P-54) are left untouched.

---

### Decision: API layer mirrors `src/api/membresias.ts`, with Next 16 async `params`

**Choice**: `src/api/maquinas.ts` exposes server handlers + client wrappers, thin routes re-export
`handle...Request` functions for testability without `NextRequest` mocking.

Handler signatures:

```ts
export async function handleMaquinaList(filters: { estado?: EstadoMaquina; tipoEquipamiento?: TipoEquipamiento; nombre?: string } = {}): Promise<Maquina[]>;
export async function handleMaquinaCreate(input: MaquinaInput): Promise<Maquina>;
export async function handleMaquinaGetById(id: string): Promise<Maquina>;
export async function handleMaquinaUpdate(id: string, input: MaquinaInput): Promise<Maquina>;
export async function handleMaquinaDelete(id: string): Promise<void>;
```

Client wrappers (mirror `membresias.ts`): `fetchMaquinasList()` (uses `conCache` with a new
`CLAVES.maquinas` key), `createMaquina(input)`, `updateMaquina(id, input)`, `deleteMaquina(id)` (invalidates
`CLAVES.maquinas`). The list search/type/estado filters are applied **server-side** in `handleMaquinaList`
via Prisma `where` (`estado`/`tipoEquipamiento` exact match, `nombre: { contains, mode: "insensitive" }`),
satisfying spec AC-007 at the route level regardless of what the UI does.

**Next 16 route handler signature** (verified against
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` lines 82–99 — "`params`:
a promise that resolves to an object containing the dynamic route parameters"):

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;               // ← await params (FX-06, Next 16)
  const result = await handleMaquinaGetByIdRequest(id);
  if (isGetSuccess(result)) return NextResponse.json(result, { status: 200 });
  return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
```

Each route exports `handle...Request` plus the typed discriminated-union success/error shapes and their
guards, copied verbatim from `membresias/route.ts` / `[id]/route.ts`. DELETE returns
`new NextResponse(null, { status: 204 })` (204 has no body; `NextResponse.json` on 204 throws — the same
footgun the membresías route documents at line 183).

---

### Decision: Error mapping additions

**Choice**: add three codes to `src/lib/route-error-mapper.ts`, in **both** the explicit-`code` branch and
the message-prefix regex (so a handler error carrying `.code` *and* one carrying only a `PREFIX: msg` both
map correctly):

| Code | Status | Message (Spanish, from spec Error Handling) |
|------|--------|----------------------------------------------|
| `ESTADO_NO_ASIGNABLE` | 400 | `El estado OCUPADA no puede asignarse desde este panel` |
| `DUPLICATE_NOMBRE_UBICACION` | 409 | `Ya existe una máquina con el mismo nombre y ubicación` |
| `DELETE_BLOCKED_EJERCICIOS` | 409 | `No se puede eliminar: N ejercicios usan esta máquina` (strip prefix; message carries the count) |

Concretely: add `ESTADO_NO_ASIGNABLE`, `DUPLICATE_NOMBRE_UBICACION`, `DELETE_BLOCKED_EJERCICIOS` to the
alternation in `validationCodeMatch` (line 180) and a `status` line each (400 / 409 / 409); add explicit
`if (code === "...")` blocks mirroring `DELETE_BLOCKED_ASSIGNED` (line 97). All three use
`stripCodePrefix(message)` so the `PREFIX: ` never leaks to the client. `ESTADO_NO_ASIGNABLE` and
`DUPLICATE_NOMBRE_UBICACION` use the fixed spec message (the handler throws the full `PREFIX: <message>`);
`DELETE_BLOCKED_EJERCICIOS` carries the dynamic count. Test additions in `route-error-mapper.test.ts`
follow the existing `DELETE_BLOCKED_ASSIGNED` describe blocks (prefix case + explicit-code case, assert
`spy` not called for the expected codes).

---

### Decision: Permissions — `role-gating.ts` entries only, no `authorization.ts` entry

**Choice**: add to `ROLE_GATE_MATRIX` in `src/middleware/role-gating.ts`:

```ts
"/maquinas": [Rol.ADMINISTRADOR],
"/api/maquinas": [Rol.ADMINISTRADOR],
```

**No entry in `src/lib/authorization.ts`**: `ADMINISTRADOR` has the `'*'` wildcard (all methods, all
paths), and no other role has `/maquinas` or `/api/maquinas` in their paths, so `hasRouteAccess` denies
the three non-admin roles and allows ADMIN via the wildcard — exactly what the spec's "no defensive entry"
requirement demands. Handler-level `ALLOWED_ROLES = ["ADMINISTRADOR"]` is declared for defense-in-depth and
`authorization-consistency.test.ts` compliance (D-17, D-22).

**`matrix-consistency.test.ts` still passes**: it iterates *every* `ROLE_GATE_MATRIX` key via
`it.each`, asserting `roleGatingMiddleware(...) === hasRouteAccess(rol, route, "GET").allowed`. For the two
new keys, ADMIN → `true` (matrix includes ADMIN; `hasRouteAccess` falls through to wildcard → `true`), and
RECEPCIONISTA / INSTRUCTOR / SOCIO → `false` (not in the matrix array; no authorization prefix match →
`false`). Both sides agree, so the existing construction stays green with zero changes to the loop.

**Explicit denial tests** (spec AC-001 traceability) go in `matrix-consistency.test.ts` as a new describe
block asserting, for `route ∈ {"/maquinas", "/api/maquinas"}` and `rol ∈ {RECEPCIONISTA, INSTRUCTOR, SOCIO}`,
that **both** `roleGatingMiddleware` returns `false` **and** `hasRouteAccess(rol, route, "GET").allowed` is
`false`, plus ADMIN returns `true` in both. (Optionally mirrored in `role-gating.test.ts`, but the
consistency test is the canonical home since it already asserts both matrices in one place.)

---

### Decision: Audit — same shape as membresías, actor from the cookie

**Choice**: `registrarOperacion` from `src/lib/audit.ts`, best-effort (the function itself wraps the write
in try/catch and logs; it never throws). The actor id comes from
`extractUserFromRequest(request)` → `user.id` (cookie first, Bearer fallback — D-18), the same as
`membresias/route.ts:115`. Calls, placed in the thin route handlers *after* a success (never altering the
response):

```ts
// POST /api/maquinas (success)
await registrarOperacion({ tipoOperacion: "ALTA",        responsableId: user.id, detalles: { maquinaId: result.id } });
// PUT  /api/maquinas/[id] (success)
await registrarOperacion({ tipoOperacion: "MODIFICACION", responsableId: user.id, detalles: { maquinaId: result.id } });
// DELETE /api/maquinas/[id] (success)
await registrarOperacion({ tipoOperacion: "BAJA",        responsableId: user.id, detalles: { maquinaId: id } });
```

`detalles` is JSON-stringified by `registrarOperacion` (audit.ts:69). `TipoOperacion` enum (`ALTA | BAJA |
MODIFICACION | ANULACION`) is used verbatim — not free text (explore confirmation).

---

### Decision: Screen and components (UI)

**Choice**: `src/app/maquinas/page.tsx` clones `src/app/membresias/page.tsx` (client component,
`useAuth` + `useNotifications`, ADMIN-only redirect to `/home-socio` for non-admin, `handleApiError` for
load errors, `ConfirmDialog` for delete, `CrudPageLayout`/`FormPanelShell`/`ListPanelShell`/`CrudActions`).

Component map (membresías equivalent → máquinas equivalent):

| Membresías | Máquinas | Notes |
|---|---|---|
| `membresia-form.tsx` | `maquina-form.tsx` | Controlled form; fields nombre, ubicacion, tipoEquipamiento (select of `TIPOS_EQUIPAMIENTO`), estado (select of `ESTADOS_ASIGNABLES`). Imports `validateMaquina` for client-side validation. |
| `membresia-form-panel.tsx` | `maquina-form-panel.tsx` | POST/PUT via `fetch`, `throwIfNotOk`, `notify`, `invalidarCache(CLAVES.maquinas)`, re-entrancy `submittingRef`. **No** deactivation-warning branch (machines have no AC-005 analog). |
| `membresia-list-panel.tsx` | `maquina-list.tsx` | Table with ID / Nombre / Tipo / Ubicación / Estado. Estado rendered via `estado-badge`. Owns client-side `estado`+`tipoEquipamiento` filter selects and `nombre` search filter in `useMemo`. |
| (none — inline `TableStatusBadge`) | `estado-badge.tsx` | Small wrapper mapping `EstadoMaquina` → `TableStatusBadge` variant: `DISPONIBLE`→success, `OCUPADA`→warning, `FUERA_DE_SERVICIO`→danger, `INACTIVA`→neutral. |

**Filters/search state**: `nombre` search stays in `CrudActions` (the shared search input) and filters
client-side like membresías. `estado` and `tipoEquipamiento` are two `<select>`s rendered in
`MaquinaList`'s header (a compact filter row above the table), held in the page as `estadoFilter` /
`tipoEquipamientoFilter` state and passed down; `MaquinaList` combines the three conditions with `useMemo`.
The **API** also supports these as query params (tested at the route level, AC-007) — the UI's client-side
filtering is an independent, consistent choice, not a contradiction.

**OCUPADA row in the edit modal**: the `estado` `<select>` only offers `ESTADOS_ASIGNABLES`
(`DISPONIBLE`, `FUERA_DE_SERVICIO`, `INACTIVA`). When editing a row stored as `OCUPADA` (e.g. seeded
"Polea alta" on an already-seeded DB), `maquina-form.tsx` initializes `estado` to `"DISPONIBLE"` (the first
assignable value) because `"OCUPADA"` is not a valid option — the select therefore always has a valid
value and the form cannot be submitted while the row still carries `OCUPADA`. A submit that somehow
reaches the API with `OCUPADA` is still rejected server-side with 400 `ESTADO_NO_ASIGNABLE` (the
unchanged-value case, AC-005).

**Shared utilities**: `handleApiError` (surfaces the server's Spanish 4xx message, or its own 401/403/429/5xx
text), `NotificationProvider`/`useNotifications` (success toasts), `ConfirmDialog` (delete confirmation;
reuses `useModalA11y` for Esc / focus-trap / focus-return), `throwIfNotOk`/`ApiError` (typed errors with
`code`). All are used exactly as the membresías page does.

---

### Decision: Staff rail — `"maquinas"` in the "Operación" zone

**Choice**: add `"maquinas"` to the `NavSection` union (staff-rail.tsx line 8–18) and a nav item in the
"Operación" zone (next to Clientes / Rutinas / Ejercicios):

```ts
export type NavSection = /* …existing… */ | "maquinas";

// ZONES[0] (label: "Operación").items, appended:
{ section: "maquinas", label: "Máquinas", href: "/maquinas", roles: ["ADMINISTRADOR"] },
```

Zone choice "Operación" (not a new "Instalaciones" zone): machines are day-to-day salon operation, and a
single-item zone is rejected as noise (proposal open question 4). ADMINISTRADOR-only means the item is
invisible to other roles (the rail filters by `item.roles.includes(rol)`), and empty zones don't render.

---

### Decision: Seed — "Polea alta" becomes `DISPONIBLE`

**Choice**: `prisma/seed-data.ts` line 155, change `estado: "OCUPADA"` → `estado: "DISPONIBLE"` for the
`Polea alta` row, with a comment stating the fix only affects an empty DB (already-seeded installations fix
the row from `/maquinas`). Idempotency is untouched: the `createMany` is already guarded by
`count() === 0` (seed-data.ts:244). The six seeded `(nombre, ubicacion)` pairs remain distinct (all
`"Sala principal"`, different `nombre`s), so the new unique index applies to a seeded DB without error —
stated as a **verified precondition**.

---

## implementation_plan

Strict TDD at every layer, red → green, Jest only (`npm test`), plus the integration suite for the index
(`npm run test:integration`). Order follows the dependency graph: pure domain → repository → API handler →
error mapper/permissions → route → component.

### Red→green order and exact test files

| Layer | Test file (red first) | Kind |
|---|---|---|
| Pure domain | `src/domains/maquina/maquina.test.ts` | fast unit (no Prisma) |
| Repository | `src/domains/maquina/maquina-repositorio.test.ts` | unit (mocked `MaquinaReader` + `$queryRaw`) |
| Uniqueness index | `tests/integration/maquina.integration.test.ts` | integration (real Docker Postgres) |
| API handlers | `src/api/maquinas.test.ts` | unit (mocked repository) |
| Error mapper | `src/lib/route-error-mapper.test.ts` (additions) | unit |
| Permissions | `src/middleware/matrix-consistency.test.ts` (additions) | unit |
| Routes (list/create) | `src/app/api/maquinas/route.test.ts` | unit (mock `@/api/maquinas`, `@/lib/auth`, `@/lib/audit`) |
| Routes (by id) | `src/app/api/maquinas/[id]/route.test.ts`, `route.delete.test.ts` | unit |
| Components | `src/components/maquina-crud/maquina-form.test.tsx`, `maquina-form-panel.test.tsx`, `maquina-list.test.tsx`, `estado-badge.test.tsx` | component (jsdom) |
| Page | `src/app/maquinas/page.test.tsx` | component (jsdom; mock `@/api/maquinas`, `@/contexts/notifications`, `@/contexts/auth`) |

TDD discipline per task (D-21, sdd-tasks-tdd.md): test written → fails (red) → implementation → green →
`npx tsc --noEmit` clean → no new lint errors → full `npm test` before the PR. Routes/auth/proxy-touching
work gets the D-21 smoke test (`npm run dev` + curl), because mocked tests don't run the proxy or the async
`params` runtime.

### File-by-file plan

| File | Action | Description |
|------|--------|-------------|
| `src/domains/maquina/maquina.ts` | Create | Pure: `Maquina`/`MaquinaInput` types, `ESTADOS_ASIGNABLES`, `TIPOS_EQUIPAMIENTO`, `validateMaquina`, `normalizarTexto`, `normalizeMaquina`, `puedeEliminar`. Re-export `EstadoMaquina`/`TipoEquipamiento` from `@prisma/client` (type-only). |
| `src/domains/maquina/maquina.test.ts` | Create | Validation (nombre/ubicacion 2–80, tipo enum, estado assignable, OCUPADA rejected), normalization (trim + collapse), `puedeEliminar` (0 → permit, N → blocked), AC-002..005, AC-011. |
| `src/domains/maquina/maquina-repositorio.ts` | Create | `MaquinaReader`, `MaquinaRepository` (`create`, `getById`, `getAll`, `update`, `delete`, `existeDuplicado`), `esErrorP2002`, deferred `@/lib/db` load. |
| `src/domains/maquina/maquina-repositorio.test.ts` | Create | With mocked reader: pre-check fires, `P2002` → `DUPLICATE_NOMBRE_UBICACION`, update excludes self, filters passed to `findMany`. |
| `prisma/migrations/20261023120000_maquina_nombre_ubicacion_unique/migration.sql` | Create | `CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key" ON "Maquina" (lower(btrim("nombre")), lower(btrim("ubicacion")));` |
| `tests/integration/maquina.integration.test.ts` | Create | Proves index + pre-check against real Postgres (see Decision 1). |
| `src/api/maquinas.ts` | Create | `handleMaquinaList/Create/GetById/Update/Delete` + `fetchMaquinasList`/`createMaquina`/`updateMaquina`/`deleteMaquina`; throws coded errors. |
| `src/api/maquinas.test.ts` | Create | Handler tests: validation, `ESTADO_NO_ASIGNABLE` (incl. unchanged PUT), `DUPLICATE_NOMBRE_UBICACION` (pre-check + P2002), `NOT_FOUND`, delete consult `puedeEliminar`. |
| `src/lib/route-error-mapper.ts` | Modify | Add `ESTADO_NO_ASIGNABLE` 400, `DUPLICATE_NOMBRE_UBICACION` 409, `DELETE_BLOCKED_EJERCICIOS` 409 (explicit-code + regex). |
| `src/lib/route-error-mapper.test.ts` | Modify | New code cases (prefix + explicit-code, `spy` not called). |
| `src/middleware/role-gating.ts` | Modify | Add `"/maquinas"` and `"/api/maquinas"` → `[Rol.ADMINISTRADOR]`. |
| `src/middleware/matrix-consistency.test.ts` | Modify | Explicit RECEPCIONISTA/INSTRUCTOR/SOCIO denial in both matrices for both routes. |
| `src/app/api/maquinas/route.ts` | Create | Thin GET/POST + `handleMaquinaListRequest`/`handleMaquinaCreateRequest`; `ALLOWED_ROLES = ["ADMINISTRADOR"]`; audit ALTA. |
| `src/app/api/maquinas/route.test.ts` | Create | Route tests (mock `@/api/maquinas`, `@/lib/auth`, `@/lib/audit`): list, filters, search, create, audit, non-admin 403, audit-failure-doesn't-change-response. |
| `src/app/api/maquinas/[id]/route.ts` | Create | Thin GET/PUT/DELETE + `handle...Request`; `await params`; audit MODIFICACION/BAJA. |
| `src/app/api/maquinas/[id]/route.test.ts`, `route.delete.test.ts` | Create | by-id route tests. |
| `src/app/maquinas/page.tsx` | Create | CRUD screen (clone membresías). |
| `src/app/maquinas/page.test.tsx` | Create | Page flow/role/error-toast tests. |
| `src/components/maquina-crud/maquina-form.tsx` | Create | Controlled form; `ESTADOS_ASIGNABLES` select; OCUPADA→`DISPONIBLE` default on edit. |
| `src/components/maquina-crud/maquina-form-panel.tsx` | Create | POST/PUT wiring, `notify`, `invalidarCache`, re-entrancy guard. |
| `src/components/maquina-crud/maquina-list.tsx` | Create | Table + estado/tipo filters + search (client-side), `estado-badge`. |
| `src/components/maquina-crud/estado-badge.tsx` | Create | `EstadoMaquina` → `TableStatusBadge` variant map. |
| `src/components/maquina-crud/*.test.tsx` | Create | Component tests (AC-013). |
| `src/components/layout/staff-rail.tsx` | Modify | `"maquinas"` union member + nav item in "Operación". |
| `prisma/seed-data.ts` | Modify | Line 155 `OCUPADA` → `DISPONIBLE` + comment. |

---

## Interfaces / Contracts

```ts
// src/domains/maquina/maquina.ts (sketch)
import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

export type { EstadoMaquina, TipoEquipamiento };

export const ESTADOS_ASIGNABLES = ["DISPONIBLE", "FUERA_DE_SERVICIO", "INACTIVA"] as const;
export type EstadoAsignable = (typeof ESTADOS_ASIGNABLES)[number];
export const TIPOS_EQUIPAMIENTO = ["MAQUINA_GUIADA", "PESO_LIBRE", "CARDIO"] as const;

export interface Maquina {
  id: string;
  nombre: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoMaquina;
  ubicacion: string;
  fechaAlta: Date;
  updatedAt: Date;
}

export interface MaquinaInput {
  nombre?: string;
  ubicacion?: string;
  tipoEquipamiento?: TipoEquipamiento;
  estado?: EstadoMaquina;
}

export interface ValidationResult { valid: boolean; errors: string[]; }

export function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

export function validateMaquina(data: Partial<Maquina>, options?: { partial?: boolean }): ValidationResult;

export function normalizeMaquina(data: {
  nombre: string; ubicacion: string; tipoEquipamiento: TipoEquipamiento; estado: EstadoAsignable;
}): { nombre: string; ubicacion: string; tipoEquipamiento: TipoEquipamiento; estado: EstadoAsignable };

export function puedeEliminar(
  maquina: Maquina,
  context: { ejerciciosAsociados: number }
): { permitido: boolean; motivo: string | null };
```

```ts
// src/domains/maquina/maquina-repositorio.ts (sketch)
export class MaquinaRepository {
  async create(data: {...}, db?: MaquinaReader): Promise<Maquina> {
    const cliente = db ?? (await getPrisma());
    if (await this.existeDuplicado(data.nombre, data.ubicacion, undefined, cliente)) throw duplicateError();
    try {
      return await cliente.maquina.create({ data });
    } catch (e) {
      if (esErrorP2002(e)) throw duplicateError();
      throw e;
    }
  }
  async existeDuplicado(nombre: string, ubicacion: string, excluirId: string | undefined, db?: MaquinaReader): Promise<boolean> {
    const cliente = db ?? (await getPrisma());
    const { Prisma } = await import("@prisma/client");
    const excluido = excluirId ? Prisma.sql`AND "id" <> ${excluirId}` : Prisma.empty;
    const filas = await cliente.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT 1 AS n FROM "Maquina"
      WHERE  unaccent(lower(btrim("nombre")))    = unaccent(lower(btrim(${nombre})))
        AND  unaccent(lower(btrim("ubicacion"))) = unaccent(lower(btrim(${ubicacion})))
        ${excluido}
      LIMIT 1
    `);
    return filas.length > 0;
  }
}
export const maquinaRepository = new MaquinaRepository();
```

Handler error shaping (no `any`) mirrors `membresias.ts`:

```ts
type CodedError = Error & { code?: string };

function codedError(code: string, message: string): Error {
  const e = new Error(`${code}: ${message}`);
  (e as CodedError).code = code;
  return e;
}
// throw codedError("ESTADO_NO_ASIGNABLE", "El estado OCUPADA no puede asignarse desde este panel");
// throw codedError("DUPLICATE_NOMBRE_UBICACION", "Ya existe una máquina con el mismo nombre y ubicación");
// throw codedError("NOT_FOUND", "Máquina no encontrada");
```

---

## Testing Strategy

| Layer | What to test | Approach |
|-------|-------------|----------|
| Unit (pure domain) | nombre/ubicacion 2–80, tipo enum, estado assignable, OCUPADA rejected, trim+collapse normalization, `puedeEliminar` 0 vs N | Plain Jest, no Prisma (AC-002..005, AC-011) |
| Unit (repository) | pre-check query fired with normalized values, self-exclusion on update, `P2002` → `DUPLICATE_NOMBRE_UBICACION`, filters to `findMany` | Mocked `MaquinaReader` (AC-006) |
| Unit (handler) | `ESTADO_NO_ASIGNABLE` (POST + unchanged PUT), `DUPLICATE_NOMBRE_UBICACION`, `NOT_FOUND`, delete consults `puedeEliminar` | Mocked repository (AC-005, AC-006, AC-008..010) |
| Unit (mapper) | three new codes → 400/409/409 with Spanish messages, prefix stripped | `route-error-mapper.test.ts` |
| Unit (permissions) | RECEPCIONISTA/INSTRUCTOR/SOCIO denied, ADMIN allowed, in both matrices | `matrix-consistency.test.ts` (AC-001) |
| Unit (routes) | list/filters/search/create/update/delete, audit ALTA/MODIFICACION/BAJA, audit-failure-doesn't-change-response, non-admin 403 | Mock `@/api/maquinas`, `@/lib/auth`, `@/lib/audit` (AC-007..010, AC-012) |
| Integration | index rejects case-only dup (P2002); repository maps it; pre-check rejects accent-only dup; raw accent-only dup **succeeds** (proves two-layer); seed pairs distinct | `npm run test:integration` (ephemeral Docker Postgres) |
| Component | table/filters/search render, create/edit modal, forced assignable estado on OCUPADA row, delete confirmation, error toast | `@testing-library/react` (AC-013) |
| Page | ADMIN renders, non-admin redirects, load error, create/update/delete flows | jsdom (AC-013) |

No e2e (config `e2e_available: false`).

---

## PR Split and LOC Forecast

Authored changed lines = additions + deletions, excluding generated files. Estimates below are per-file
and include their paired tests, following the historical actuals (D-01: domain ≈250–340, API ≈250–320,
route ≈240–360, component ≈300–390, page ≈250–360 per PR).

| File(s) | Est. LOC |
|---|---|
| `maquina.ts` + `maquina.test.ts` | 350 |
| `maquina-repositorio.ts` + `maquina-repositorio.test.ts` | 240 |
| `migration.sql` + `tests/integration/maquina.integration.test.ts` | 116 |
| `src/api/maquinas.ts` + `maquinas.test.ts` | 320 |
| `route-error-mapper.ts` + `route-error-mapper.test.ts` (additions) | 135 |
| `role-gating.ts` + `matrix-consistency.test.ts` (additions) | 42 |
| `route.ts` + `route.test.ts` | 240 |
| `[id]/route.ts` + `[id]/route.test.ts` + `route.delete.test.ts` | 360 |
| **PR 1a subtotal** | **≈1,803** |
| `maquina-form.tsx` + `maquina-form-panel.tsx` + `estado-badge.tsx` + tests | 490 |
| `maquina-list.tsx` + test | 240 |
| `page.tsx` + `page.test.tsx` | 330 |
| `staff-rail.tsx` + `seed-data.ts` (additions) | 13 |
| **PR 1b subtotal** | **≈1,073** |

**Both PRs far exceed the 400-line review budget** (review policy: 400 changed lines). Following the D-01
precedent (treat the cap as hard; slice, don't weaken), propose chaining into **~6 backend + ~4 frontend
PRs**, each ≤400 and self-contained (implementation + tests together):

- **PR-1a-1** `maquina domain puro` — maquina.ts + maquina.test.ts (~350)
- **PR-1a-2** `maquina repositorio + unicidad` — maquina-repositorio.ts + test + migration.sql + integration test (~356)
- **PR-1a-3** `maquinas API` — maquinas.ts + maquinas.test.ts (~320)
- **PR-1a-4** `errores y permisos` — route-error-mapper (+test) + role-gating + matrix-consistency (~177)
- **PR-1a-5** `rutas /api/maquinas` — route.ts + route.test.ts (~240)
- **PR-1a-6** `rutas /api/maquinas/[id]` — [id]/route.ts + tests (~360)
- **PR-1b-1** `maquina form + estado badge` — form + form-panel + badge + form/panel tests (~490 → slice: form + badge + form test ≈340; form-panel in 1b-2)
- **PR-1b-2** `maquina form-panel` — form-panel + test (~190)
- **PR-1b-3** `maquina list` — maquina-list.tsx + test (~240)
- **PR-1b-4** `maquinas page + nav + seed` — page + page.test + staff-rail + seed-data (~343)

Final task numbering/ordering is the `sdd-tasks` phase's `task_breakdown`; this design fixes the slice
boundary and the `ask-on-risk` delivery means the human is consulted before any slice is merged over the
cap. `P-53`/`P-54` recording in `decisions.md` is **not** counted here (later close step).

---

## Risks / Tradeoffs / Rejected Alternatives

1. **`unaccent()` is `STABLE`** → cannot live in an index. Rejected `lower(unaccent(...))` index and the
   `IMMUTABLE`-wrapper workaround (Supabase `extensions` schema / `search_path` portability concern,
   unqualified-call convention, dictionary-change footgun) in favor of approach **(b)**. Residual: the index
   does not fold accents; the pre-check does, but it is not race-safe — the `P2002` catch closes the race.
   **Resolution of the proposal's internal inconsistency**: the proposal §Approach 4 said the pre-check uses
   "the same `lower(btrim(...))`"; the **spec wins** — the pre-check is **accent-insensitive**
   (`unaccent(lower(btrim(...)))`), as spec Requirement "Uniqueness" states. This design follows the spec.
2. **Accent-only collision under a concurrent race**: "Polea" inserted concurrently with "Poléa" both pass
   the pre-check and the index (no accent fold), leaving two rows. Accepted: the requirement is
   case/accent-insensitive uniqueness for *sequential* admin CRUD; the index guarantees the race-safe
   case-insensitive core. Documented, not silently ignored.
3. **`EstadoMaquina` drift (P-54)**: domain imports the Prisma enum *type* rather than adding a fourth
   literal union. The two existing duplicates (`home-interno.ts:14`, `tarjeta-detalle.tsx:41`) are **not**
   touched (out of scope; recorded as pending, not edited, in this phase).
4. **`OCUPADA` semantic clash**: admin cannot assign it, but the socio-facing `tarjeta-detalle.tsx` uses it
   as "in use now" (derived runtime). Spec already states `OCUPADA` is derived; the list shows existing
   `OCUPADA` rows as-is and the edit UI forces an assignable value.
5. **Seed fix only on empty DB**: already-seeded installs keep `OCUPADA` "Polea alta" until edited in
   `/maquinas`; no data-fix migration (admin fixes it from the UI). Comment added to the seed.
6. **Home_Interno "Estado de equipos" total (P-53)**: deleting/retiring machines lowers the card's
   baseline. Out of scope; no Home_Interno change.
7. **Two-layer canonical-form drift**: mitigated by a single normalization entry point (`normalizeMaquina`);
   both the index expression and the pre-check are documented to operate on that canonical form.
8. **DELETED code-path simplicity**: no `ejerciciosQueUsanMaquina()` scaffolding added today (dead code);
   the extension point is the `puedeEliminar` call site, documented for Etapa 2.

---

## Migration / Rollout

- One additive migration (`20261023120000_maquina_nombre_ubicacion_unique`) adding a unique index; `prisma
  migrate deploy` applies it. No data migration. Verified against the ephemeral Docker Postgres via
  `npm run test:integration` before merge.
- Rollback: `git revert` the PR; `DROP INDEX IF EXISTS "Maquina_nombre_ubicacion_key"` if the migration
  already applied. No data loss — writes go through the new handlers, which vanish with the revert.

## Open Questions

- None blocking. (Seed `ubicacion` per-row vs shared default is left as-is per the proposal; if per-row
  realism is desired it must be decided before PR-1b-4.)
