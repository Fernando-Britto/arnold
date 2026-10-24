# Design: maquina-ejercicios (Etapa 2 — Ejercicio ↔ Máquina)

> Required fields per `openspec/config.yaml` (`design`): `approach`, `architecture`, `implementation_plan`. All three are covered below (Approach → "Technical Approach" + "Architecture Decisions"; Architecture → "Architecture Decisions" + "Data Flow" + "Interfaces / Contracts"; Implementation Plan → "Slice Plan & LOC Forecast" + "Strict TDD Plan").

## Technical Approach

Introduce an explicit many-to-many join model `EjercicioMaquina`, copy the structural shape of `EjercicioEnRutina`, and manage it through a new nested REST resource (`GET`/`PUT /api/maquinas/[id]/ejercicios`) plus a machine-list expanded row and an accessible assignment modal. Close the Etapa-1 loop by wiring the real association count into `handleMaquinaDelete`. Extend `GET /api/ejercicios` with **opt-in** `limit`/`offset` so the modal never loads the full ~1,324-row catalog.

The approach maps 1:1 to the proposal's nine points and the three delta specs (`maquina-ejercicio-assignment`, `maquinas-crud`, `ejercicios-crud`). Layering follows ARQ-1 strictly: pure domain logic in `src/domains/maquina/` (no Prisma), repository/handler IO in `src/domains/maquina/maquina-repositorio.ts` and `src/api/maquinas.ts`, thin routes in `src/app/api/maquinas/[id]/ejercicios/route.ts`.

## Architecture Decisions

### Decision: `EjercicioMaquina` join model with `onDelete: Cascade` on both sides

**Choice**: An explicit join model, mirroring `EjercicioEnRutina`, with `@@unique([maquinaId, ejercicioId])`, secondary indexes on both FKs, and `onDelete: Cascade` on **both** relations.

**Alternatives considered**:
- *Implicit Prisma M2M* (`maquina Maquina[]` with no model) — rejected: the spec requires an explicit join table with its own unique constraint and indexes.
- *`onDelete: Restrict` on both sides* — rejected: would force manual cleanup and would incorrectly add a `DELETE_BLOCKED_ASSIGNED` path on exercise deletion.

**Rationale**:
- `maquina → EjercicioMaquina` = `Cascade`: the handler already blocks machine deletion upstream via `puedeEliminar` (returns 409 `DELETE_BLOCKED_EJERCICIOS` when the count > 0). If the handler permits deletion (count = 0), there are no rows to cascade. Matches the established `Rutina → EjercicioEnRutina` pattern.
- `ejercicio → EjercicioMaquina` = `Cascade`: **mandatory** for the feature contract. Exercise deletion is already gated by `EjercicioEnRutina.ejercicio` (`Restrict`) and `RegistroDeProgreso.ejercicio` (`Restrict`); those throw `P2003` → `DELETE_BLOCKED_ASSIGNED` **before** the M2M cascade can matter. If an exercise is legitimately deleted (no routine/progress references), its M2M rows must disappear automatically. A `Restrict` here would incorrectly block exercise deletion whenever a machine link exists.

**Why it does not break `DELETE_BLOCKED_ASSIGNED`**: the two `Restrict` relations (`EjercicioEnRutina`, `RegistroDeProgreso`) remain the **only** relations that reject exercise deletion. `EjercicioRepository.delete` (lines 229–257) catches `P2003` and maps to `DELETE_BLOCKED_ASSIGNED`. The new `Cascade` relation never participates in a `P2003` for the *exercise-delete* path: when there is a routine/progress reference the `Restrict` FK fires first (and Prisma reports `EjercicioEnRutina`/`RegistroDeProgreso` in `meta`), and when there isn't one the cascade cleans up silently. The `mensajeBloqueoPorRelacion` helper only recognizes `EjercicioEnRutina` and `RegistroDeProgreso` — `EjercicioMaquina` is intentionally **not** added there because it never produces a block.

### Decision: Hand-written additive-only migration with inline FK constraints

**Choice**: `prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` containing exactly 4 statements — one `CREATE TABLE` (with the PK and both FK constraints declared **inline** via table-level `CONSTRAINT ... FOREIGN KEY ... REFERENCES`), one `CREATE UNIQUE INDEX`, and two `CREATE INDEX`. Zero `DROP`, zero `ALTER`, zero mention of `Maquina_nombre_ubicacion_key`.

**Alternatives considered**:
- *`prisma migrate dev`* — **rejected and forbidden**: the orphan expression index `Maquina_nombre_ubicacion_key` (from `20261023120000_maquina_nombre_ubicacion_unique`) uses `lower(btrim(...))`, which Prisma cannot represent in `schema.prisma`; `migrate dev` would detect it and emit a `DROP INDEX` or propose a reset.
- *Prisma-generated FK style (`ALTER TABLE ... ADD CONSTRAINT`)* — rejected: the pre-migration check requires `0` occurrences of `ALTER`. PostgreSQL accepts inline `REFERENCES` in `CREATE TABLE`, so the FKs are created without a separate `ALTER`.

**Rationale**: inline FK constraints let the file satisfy the "additive only, no `ALTER`" rule while still creating real foreign keys with `ON DELETE CASCADE ON UPDATE CASCADE`. The unique-index name (`EjercicioMaquina_maquinaId_ejercicioId_key`) and the two secondary names (`EjercicioMaquina_maquinaId_idx`, `EjercicioMaquina_ejercicioId_idx`) follow Prisma's naming convention, so `prisma migrate status` stays consistent and `migrate deploy` treats the migration as applied.

### Decision: Existence validation lives in the pure domain via an injected `ReadonlySet`

**Choice**: `validarAsignacionEjercicios(ejercicioIds, existentes: ReadonlySet<string>)` is pure (no Prisma import — the `dominios-puros.guard.test.ts` guard stays green). The handler materializes `existentes` from a single `findMany` query, then calls the pure function.

**Alternatives considered**:
- *Existence check inside the domain via Prisma* — rejected: violates ARQ-1.
- *Re-verify existence inside the `$transaction`* — considered; rejected for this stage. The residual TOCTOU (an exercise deleted between the handler's pre-check and the transaction write) is the same already-accepted race as `EjercicioEnRutina`. The FK constraint is the backstop: `createMany` would fail with `P2003` → 500 (fail-closed, logged server-side), never a silent corruption. See Risks.

### Decision: Pagination on `GET /api/ejercicios` is opt-in (backwards compatibility wins over "default 20")

**Choice**: `limit`/`offset` apply **only when at least one of them is present** in the request. When both are omitted, `getAll` behaves exactly as today (no `LIMIT`/`OFFSET`; returns all matches).

**Rationale**: The `/ejercicios` screen (`fetchEjercicios()` → `GET /api/ejercicios` with no params) relies on the full list for client-side pagination (`POR_PAGINA = 50`, "Ver más ejercicios"). A literal "default 20" would silently truncate that screen. The spec's `ejercicios-crud` delta contains an internal tension — "default 20 when omitted" vs "returns all matches exactly as before" — and the stronger, explicit backwards-compatibility requirement wins. "Default 20 / max 50" then means: when pagination is triggered (e.g. `?offset=40` alone), a missing `limit` defaults to 20; a missing `offset` defaults to 0; `limit` is bounded to `[1, 50]`. The `ejercicios-crud` spec delta was reconciled to this opt-in behavior.

### Decision: Audit belongs in the route, not the handler

**Choice**: best-effort `MODIFICACION` audit (via `registrarOperacion`, in a `try/catch` that never alters the response) lives in the route's `PUT`, using `auth.user.id` and `detalles: { maquinaId, ejerciciosAsignados: result.length }`.

**Rationale**: matches the existing `PUT /api/maquinas/[id]` pattern exactly (route owns audit, handler stays actor-agnostic). The proposal sketched `handleMaquinaEjerciciosPut(id, ejercicioIds, actorId)`; I drop `actorId` from the handler signature to keep the handler free of audit/actor concerns and consistent with every existing route in this codebase.

### Decision: Assignment modal pagination ("Ver más") and selection model

**Pagination**: the exercise list API returns no total count. The modal keeps an accumulated result list and a `nextOffset`, requests `limit=50`, and shows a "Ver más" button **only when the last page returned exactly `limit` (50) items** — a short page means the end. Clicking it requests `offset = nextOffset` (advanced by `limit`) and appends the rows; the button hides when a short page arrives. An empty search fetches the first page only.

**Selection**: a `Set<string>` of `ejercicioIds`, independent from the visible page. It is seeded when the modal opens with the machine's currently assigned exercises (`fetchMaquinaEjercicios`), so assigned exercises that are not on the visible page are part of the selection. Changing page or search must not drop items from the set. "Seleccionar todo visible" toggles only the current page's visible ids. Saving sends the full set as the replacement body; the backend replaces the association set atomically, so deselecting a previously assigned exercise removes it.

**Tests**: "Ver más" visible only on a full page and hidden on a short page; clicking it advances the offset and appends; selection survives page/search; assigned off-page exercises are pre-selected; save sends the full replacement set.

### Decision: `roleGatingMiddleware` is exact-match and is **not** the enforcement path for nested API routes

**Choice**: the nested path `/api/maquinas/[id]/ejercicios` is enforced by `hasRouteAccess` (prefix matching, used by `src/proxy.ts`) and by the route's `ALLOWED_ROLES = ["ADMINISTRADOR"]` (defense in depth). No new entry is added to `ROLE_GATE_MATRIX`.

**Rationale**: `roleGatingMiddleware` (line 47) does `ROLE_GATE_MATRIX[route]` — an **exact** lookup — and is consumed only by UI page-level gating (Home_Interno button disabling). It is never consulted for nested API sub-paths. The spec's wording ("covers the nested path by prefix in `role-gating.ts`") is technically inaccurate; the correct statement is: `hasRouteAccess` (prefix) and the wildcard cover it, and `roleGatingMiddleware` is out of scope for API sub-paths. The explicit test asserts `hasRouteAccess` behavior, not `roleGatingMiddleware`.

## Data Flow

```
MaquinasPage (/maquinas)
  ├─ MaquinaList ──(onSelect)──▶ selectedId toggles
  │    └─ TableRow (disclosure) + TableDetailRow
  │         └─ MaquinaExpandedRow ──GET /api/maquinas/[id]/ejercicios──▶ handleMaquinaEjerciciosGet ─▶ maquinaRepository.getEjerciciosAsociados
  │              └─ "Asignar ejercicios" ──▶ EjercicioAsignacionModal
  │                    ├─ search input ──(debounce 300ms)──▶ GET /api/ejercicios?search=&limit=50 ─▶ handleEjercicioList ─▶ ejercicioRepository.getAll (opt-in pagination)
  │                    ├─ multi-select (visible page only)
  │                    └─ Save ──▶ PUT /api/maquinas/[id]/ejercicios { ejercicioIds } ─▶ handleMaquinaEjerciciosPut
  │                                   ├─ getById ─▶ 404?
  │                                   ├─ obtenerEjerciciosExistentes ─▶ Set
  │                                   ├─ validarAsignacionEjercicios (pure) ─▶ 400 VALIDATION_* ?
  │                                   └─ reemplazarEjerciciosAsociados ─▶ $transaction(deleteMany + createMany + read-back)
  └─ DELETE machine ─▶ handleMaquinaDelete ─▶ contarEjerciciosAsociados ─▶ puedeEliminar ─▶ 409 DELETE_BLOCKED_EJERCICIOS | delete
```

The `PUT` is a full replacement (`last-writer-wins`): `deleteMany` + `createMany` run in one `$transaction`, so a concurrent read never observes a half-applied state.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `EjercicioMaquina` model; add `maquinas EjercicioMaquina[]` to `Ejercicio` and `ejercicios EjercicioMaquina[]` to `Maquina`. |
| `prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` | Create | Hand-written additive DDL (4 statements (1 `CREATE TABLE` + 1 `CREATE UNIQUE INDEX` + 2 `CREATE INDEX`), inline FKs). |
| `src/domains/maquina/maquina.ts` | Modify | Add `EjercicioAsociado`, `MAX_EJERCIOS_POR_MAQUINA`, `validarAsignacionEjercicios`, `ResultadoAsignacion`. |
| `src/domains/maquina/maquina.test.ts` | Modify | Unit tests for `validarAsignacionEjercicios`. |
| `src/domains/maquina/maquina-repositorio.ts` | Modify | Extend `MaquinaReader` (`ejercicioMaquina`, `ejercicio`, `$transaction`); add `contarEjerciciosAsociados`, `obtenerEjerciciosExistentes`, `getEjerciciosAsociados`, `reemplazarEjerciciosAsociados`. |
| `src/domains/maquina/maquina-repositorio.test.ts` | Modify | Unit tests (Prisma mocked) for the new methods. |
| `src/domains/ejercicio/ejercicio-repositorio.ts` | Modify | Add opt-in `limit`/`offset` to `getAll` (both `findMany` and `$queryRaw` paths). |
| `src/domains/ejercicio/ejercicio.test.ts` | Modify | Cover pagination + parameterized search. |
| `src/api/maquinas.ts` | Modify | Add `handleMaquinaEjerciciosGet`, `handleMaquinaEjerciciosPut`, client fetchers; wire real count into `handleMaquinaDelete`. |
| `src/api/maquinas.test.ts` | Modify | Cover new handlers + real-count delete path. |
| `src/api/ejercicios.ts` | Modify | Thread `limit`/`offset` through `handleEjercicioList`. |
| `src/app/api/maquinas/[id]/ejercicios/route.ts` | Create | `GET` + `PUT`, `await params`, `ALLOWED_ROLES`, `readJsonBody`, `mapErrorToResponse`, audit. |
| `src/app/api/maquinas/[id]/ejercicios/route.test.ts` | Create | Route tests (mock `@/api/maquinas`). |
| `src/app/api/ejercicios/route.ts` | Modify | Parse/validate `limit`/`offset`; export `parsePaginacion`. |
| `src/app/api/ejercicios/route.test.ts` | Modify | Cover pagination validation. |
| `src/lib/route-error-mapper.ts` | Modify | Add `VALIDATION_MAX_EJERCICIOS → 400`. |
| `src/lib/route-error-mapper.test.ts` | Modify | Cover new code. |
| `src/middleware/matrix-consistency.test.ts` | Modify | Add nested-path prefix assertion (`hasRouteAccess`). |
| `src/lib/authorization.test.ts` | Modify | Add nested-path prefix cases (RECEPCIONISTA/INSTRUCTOR/SOCIO denied, ADMIN allowed). |
| `src/components/maquina-crud/maquina-list.tsx` | Modify | Restore `disclosure`; add `TableDetailRow` + `MaquinaExpandedRow`. |
| `src/components/maquina-crud/maquina-list.test.tsx` | Modify | Replace the "no disclosure" assertion with expansion tests. |
| `src/components/maquina-crud/maquina-expanded-row.tsx` | Create | Expanded row (associated exercises + "Asignar ejercicios"). |
| `src/components/maquina-crud/maquina-expanded-row.test.tsx` | Create | Component tests. |
| `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` | Create | Accessible modal: debounced search, paginated multi-select, PUT save. |
| `src/components/maquina-crud/ejercicio-asignacion-modal.test.tsx` | Create | Component tests. |
| `src/app/maquinas/page.tsx` | Modify | Wire the expanded row's modal + refresh on save. |
| `tests/integration/ejercicio-maquina.integration.test.ts` | Create | Cascade, unique constraint, migration apply, transaction replace against `arnold_test`. |

No changes to `src/components/ui/table.tsx`, `src/hooks/use-modal-a11y.ts`, `src/lib/route-error-mapper.ts`'s `DELETE_BLOCKED_EJERCICIOS` mapping, or `src/middleware/role-gating.ts`.

## Interfaces / Contracts

### Prisma model (exact)

```prisma
model EjercicioMaquina {
  id          String    @id @default(cuid())
  ejercicio   Ejercicio @relation(fields: [ejercicioId], references: [id], onDelete: Cascade)
  ejercicioId String
  maquina     Maquina   @relation(fields: [maquinaId], references: [id], onDelete: Cascade)
  maquinaId   String
  createdAt   DateTime  @default(now())

  @@unique([maquinaId, ejercicioId])
  @@index([maquinaId])
  @@index([ejercicioId])
}
```

Relation fields (added): `Ejercicio.maquinas EjercicioMaquina[]` and `Maquina.ejercicios EjercicioMaquina[]`.

### Migration SQL (exact)

```sql
-- EjercicioMaquina (Etapa 2). Aditivo: sin DROP, sin ALTER, no toca Maquina_nombre_ubicacion_key.
-- Rollback manual (solo si se revierte sobre una base real):
--   DROP TABLE IF EXISTS "EjercicioMaquina";

CREATE TABLE "EjercicioMaquina" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EjercicioMaquina_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EjercicioMaquina_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EjercicioMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key" ON "EjercicioMaquina"("maquinaId", "ejercicioId");
CREATE INDEX "EjercicioMaquina_maquinaId_idx" ON "EjercicioMaquina"("maquinaId");
CREATE INDEX "EjercicioMaquina_ejercicioId_idx" ON "EjercicioMaquina"("ejercicioId");
```

**Pre-migration checks (Fernando, before `prisma migrate deploy` on Supabase)**:

1. `grep -c 'DROP\|ALTER' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → `0`.
2. `grep 'Maquina_nombre_ubicacion_key' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → no output.
3. `grep -c 'CREATE TABLE' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → `1`.
4. `grep -c 'CREATE UNIQUE INDEX' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → `1`.
5. `grep -c 'CREATE INDEX' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → `2`.
6. `grep -c 'ON DELETE CASCADE' prisma/migrations/20261024120000_ejercicio_maquina/migration.sql` → `2`.
7. `npm run test:integration` green (applies `prisma migrate deploy` against ephemeral Docker Postgres).

### Domain validation (exact)

```ts
// src/domains/maquina/maquina.ts (pure, no Prisma)
export const MAX_EJERCIOS_POR_MAQUINA = 100;

export interface EjercicioAsociado {
  id: string;
  nombre: string;
  grupoMuscular: string;
}

export type ErrorAsignacion = "VALIDATION_ERROR" | "VALIDATION_MAX_EJERCICIOS";

export type ResultadoAsignacion =
  | { ok: true; ejercicioIds: string[] }
  | { ok: false; code: ErrorAsignacion; message: string };

export function validarAsignacionEjercicios(
  ejercicioIds: string[],
  existentes: ReadonlySet<string>
): ResultadoAsignacion;
```

Precedence (first failure wins, in this order):

1. Duplicates (`new Set(ejercicioIds).size !== ejercicioIds.length`) → `{ ok: false, code: "VALIDATION_ERROR", message: "Hay ejercicios duplicados en la asignación" }`.
2. Over max (`ejercicioIds.length > MAX_EJERCIOS_POR_MAQUINA`) → `{ ok: false, code: "VALIDATION_MAX_EJERCICIOS", message: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina` }`.
3. Unknown ids (any `!existentes.has(id)`) → `{ ok: false, code: "VALIDATION_ERROR", message: "Uno o más ejercicios no existen" }`.
4. Otherwise (including `[]`) → `{ ok: true, ejercicioIds }`.

### Repository methods (exact)

Extend `MaquinaReader` (in `maquina-repositorio.ts`) with:

```ts
export interface MaquinaReader {
  maquina: { /* existing delegate unchanged */ };
  ejercicioMaquina: {
    count(args: { where: { maquinaId: string } }): Promise<number>;
    findMany(args: {
      where: { maquinaId: string };
      include: { ejercicio: { select: { id: true; nombre: true; grupoMuscular: true } } };
      orderBy: { ejercicio: { nombre: "asc" } };
    }): Promise<Array<{ ejercicio: { id: string; nombre: string; grupoMuscular: string } }>>;
    deleteMany(args: { where: { maquinaId: string } }): Promise<{ count: number }>;
    createMany(args: { data: Array<{ maquinaId: string; ejercicioId: string }> }): Promise<{ count: number }>;
  };
  ejercicio: {
    findMany(args: { where: { id: { in: string[] } }; select: { id: true } }): Promise<Array<{ id: string }>>;
  };
  $transaction<T>(fn: (tx: MaquinaReader) => Promise<T>): Promise<T>;
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
}
```

New methods on `MaquinaRepository`:

```ts
async contarEjerciciosAsociados(maquinaId: string, db?: MaquinaReader): Promise<number>;
async obtenerEjerciciosExistentes(ejercicioIds: string[], db?: MaquinaReader): Promise<ReadonlySet<string>>;
async getEjerciciosAsociados(maquinaId: string, db?: MaquinaReader): Promise<EjercicioAsociado[]>;
async reemplazarEjerciciosAsociados(maquinaId: string, ejercicioIds: string[], db?: MaquinaReader): Promise<EjercicioAsociado[]>;
```

`reemplazarEjerciciosAsociados` runs one `$transaction`:

```ts
return cliente.$transaction(async (tx) => {
  await tx.ejercicioMaquina.deleteMany({ where: { maquinaId } });
  if (ejercicioIds.length > 0) {
    await tx.ejercicioMaquina.createMany({
      data: ejercicioIds.map((ejercicioId) => ({ maquinaId, ejercicioId })),
    });
  }
  const filas = await tx.ejercicioMaquina.findMany({ /* include ejercicio, orderBy nombre */ });
  return filas.map((f) => f.ejercicio);
});
```

**404 vs empty-set distinction**: `getEjerciciosAsociados` returns `[]` for **both** "machine exists, zero associations" and "machine does not exist". The handler resolves this by calling `getById` first (404 if null) and only then `getEjerciciosAsociados`. The repository method deliberately does not distinguish — that responsibility belongs to the handler's prior existence check.

### API handler signatures (exact)

```ts
// src/api/maquinas.ts
export async function handleMaquinaEjerciciosGet(id: string): Promise<EjercicioAsociado[]>;
export async function handleMaquinaEjerciciosPut(id: string, body: unknown): Promise<EjercicioAsociado[]>;
```

`handleMaquinaEjerciciosGet`:

```ts
const maquina = await maquinaRepository.getById(id);
if (!maquina) throw codedError("NOT_FOUND", "Máquina no encontrada");
return maquinaRepository.getEjerciciosAsociados(id);
```

`handleMaquinaEjerciciosPut`:

```ts
const ejercicioIds = parseAsignacionBody(body);   // throws VALIDATION_ERROR on bad shape
const maquina = await maquinaRepository.getById(id);
if (!maquina) throw codedError("NOT_FOUND", "Máquina no encontrada");
const existentes = await maquinaRepository.obtenerEjerciciosExistentes(ejercicioIds);
const resultado = validarAsignacionEjercicios(ejercicioIds, existentes);
if (!resultado.ok) throw codedError(resultado.code, resultado.message);
return maquinaRepository.reemplazarEjerciciosAsociados(id, resultado.ejercicioIds);
```

`parseAsignacionBody(body: unknown): string[]` (private in `src/api/maquinas.ts`, mirrors the existing `esObjetoPlano` pattern):
- non-object body → `VALIDATION_ERROR` "El cuerpo debe ser un objeto".
- `ejercicioIds` missing or not an array → `VALIDATION_ERROR` "El campo ejercicioIds debe ser un arreglo".
- any element not a string → `VALIDATION_ERROR` "El campo ejercicioIds debe contener solo identificadores".

### Route file shape (`src/app/api/maquinas/[id]/ejercicios/route.ts`)

```ts
const ALLOWED_ROLES = ["ADMINISTRADOR"];
const ERROR_OPTIONS = { forbiddenMessage: "Se requiere rol de administrador", resourceName: "Máquina" };

export type GetSuccess = EjercicioAsociado[];
export type GetError = { code: string; message: string; status: number };
export type PutSuccess = EjercicioAsociado[];
export type PutError = { code: string; message: string; status: number };

export async function handleMaquinaEjerciciosGetRequest(id: string): Promise<GetSuccess | GetError>;
export async function handleMaquinaEjerciciosPutRequest(id: string, body: unknown): Promise<PutSuccess | PutError>;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> });
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> });
```

Both verbs: `autorizar(request)` (401/403) → `const { id } = await params` (Next 16.2, FX-06) → delegate to the request wrapper → on success `NextResponse.json(result, { status: 200 })`, else `NextResponse.json({ code, message }, { status })`. `PUT` additionally calls `readJsonBody(request)` and, after a `PutSuccess`, performs the best-effort audit:

```ts
try {
  await registrarOperacion({
    tipoOperacion: "MODIFICACION",
    responsableId: auth.user.id,
    detalles: { maquinaId: id, ejerciciosAsignados: result.length },
  });
} catch { /* best-effort, already logged */ }
```

### Error codes (decided)

| Condition | Code | HTTP | Message |
|---|---|---|---|
| Malformed body / non-array `ejercicioIds` | `VALIDATION_ERROR` | 400 | "El cuerpo debe ser un objeto" / "El campo ejercicioIds debe ser un arreglo" |
| Unknown exercise id | `VALIDATION_ERROR` | 400 | "Uno o más ejercicios no existen" |
| Duplicate ids | `VALIDATION_ERROR` | 400 | "Hay ejercicios duplicados en la asignación" |
| Over `MAX_EJERCIOS_POR_MAQUINA` | `VALIDATION_MAX_EJERCICIOS` | 400 | Interpolated from the constant: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina` |
| Missing machine (GET/PUT) | `NOT_FOUND` | 404 | "Máquina no encontrada" |
| Machine delete with associations | `DELETE_BLOCKED_EJERCICIOS` | 409 | "No se puede eliminar: N ejercicios usan esta máquina" (already mapped) |
| Non-ADMIN role | `FORBIDDEN` | 403 | "Se requiere rol de administrador" |

`VALIDATION_MAX_EJERCICIOS` is the **only** new code added to `route-error-mapper.ts` (the generic `VALIDATION_[A-Z_]+` regex already matches it with status 400; add an explicit `code === "VALIDATION_MAX_EJERCICIOS"` branch for clarity/self-documentation, mirroring the other explicit branches).

### Machine delete count wiring

```ts
export async function handleMaquinaDelete(id: string): Promise<void> {
  const existing = await maquinaRepository.getById(id);
  if (!existing) throw codedError("NOT_FOUND", "Máquina no encontrada");
  const ejerciciosAsociados = await maquinaRepository.contarEjerciciosAsociados(id);
  const decision = puedeEliminar(existing, { ejerciciosAsociados });
  if (!decision.permitido) {
    throw codedError("DELETE_BLOCKED_EJERCICIOS", `No se puede eliminar: ${decision.motivo}`);
  }
  await maquinaRepository.delete(id);
}
```

`puedeEliminar` is **unchanged**. Only its caller changes.

### Exercise pagination (exact)

`EjercicioRepository.getAll`:

```ts
async getAll(
  options?: { muscleGroup?: string; search?: string; limit?: number; offset?: number },
  db?: EjercicioReader
): Promise<EjercicioConUso[]>
```

Opt-in semantics (see Architecture Decision):

```ts
const paginar = options?.limit !== undefined || options?.offset !== undefined;
const take = paginar ? (options.limit ?? 20) : undefined;
const skip = paginar ? (options.offset ?? 0) : undefined;
```

**`findMany` (non-search) path** — append when paginating:

```ts
const filas = await cliente.ejercicio.findMany({
  where,
  orderBy: { nombre: "asc" },
  include: { _count: { select: { rutinas: true } } },
  omit: { instrucciones: true },
  ...(paginar ? { take, skip } : {}),
});
```

**`$queryRaw` (search) path** — append `LIMIT`/`OFFSET` after `ORDER BY`, term stays parameterized:

```ts
const limitSql = paginar ? Prisma.sql`LIMIT ${take}` : Prisma.empty;
const offsetSql = paginar ? Prisma.sql`OFFSET ${skip}` : Prisma.empty;
return cliente.$queryRaw<EjercicioConUso[]>(Prisma.sql`
  SELECT ${columnas}, (
    SELECT COUNT(*)::int FROM "EjercicioEnRutina"
    WHERE "EjercicioEnRutina"."ejercicioId" = "Ejercicio"."id"
  ) AS "enRutinas"
  FROM "Ejercicio"
  WHERE unaccent("nombre") ILIKE unaccent(${patron})
  ${filtroGrupo}
  ORDER BY "nombre" ASC
  ${limitSql}
  ${offsetSql}
`);
```

`${take}`/`${skip}` are numbers interpolated via `Prisma.sql`, so Prisma emits them as `$2`/`$3` parameters — never inlined. `LIMIT`/`OFFSET` accept parameters in PostgreSQL. The search term `${patron}` remains `$1`. `ORDER BY` precedes `LIMIT`/`OFFSET`. **No string concatenation is used for `limit` or `offset`**: both are `Prisma.sql` parameters, exactly like the search term.

**Route validation** (`src/app/api/ejercicios/route.ts`), exported pure helper:

```ts
export function parsePaginacion(rawLimit: string | null, rawOffset: string | null):
  | { ok: true; limit?: number; offset?: number }
  | { ok: false; message: string } {
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) return { ok: false, message: "El parámetro limit debe ser un número entero" };
    const limit = Number(rawLimit);
    if (limit < 1 || limit > 50) return { ok: false, message: "El parámetro limit debe estar entre 1 y 50" };
    /* ... */
  }
  if (rawOffset !== null && !/^\d+$/.test(rawOffset)) {
    return { ok: false, message: "El parámetro offset debe ser un número entero" };
  }
  return { ok: true, /* limit?, offset? */ };
}
```

`/^\d+$/` rejects negatives, decimals, empty, and non-numeric strings. `offset` is therefore always `>= 0`. `handleEjercicioList` in `src/api/ejercicios.ts` is simplified to always pass `options` through to `getAll` (the old short-circuit `if (search || muscleGroup) getAll(options) else getAll()` would drop pagination when only `limit`/`offset` are present — that is a bug the change must fix).

### Client fetchers (exact)

```ts
// src/api/maquinas.ts
export async function fetchMaquinaEjercicios(id: string): Promise<EjercicioAsociado[]>;
export async function reemplazarEjerciciosMaquina(id: string, ejercicioIds: string[]): Promise<EjercicioAsociado[]>;

// src/api/ejercicios.ts
export async function fetchEjerciciosBusqueda(params: { search?: string; limit?: number; offset?: number }): Promise<EjercicioConUso[]>;
```

`fetchEjerciciosBusqueda` bypasses the `conCache` list cache (search is dynamic); `reemplazarEjerciciosMaquina` calls `invalidarCache(CLAVES.maquinas)` after success (the machine list's delete-blocking count is derived from the association set).

## Testing Strategy

Strict TDD (RED → GREEN) per layer. Unit (Jest + mocked Prisma) vs integration (ephemeral `arnold_test`) vs component (Testing Library + jsdom).

| Layer | What to test | Approach |
|-------|-------------|----------|
| Domain (unit) | `validarAsignacionEjercicios` — valid distinct ids, empty set, duplicates, > MAX_EJERCIOS_POR_MAQUINA, unknown ids, precedence | `src/domains/maquina/maquina.test.ts` |
| Repository (unit) | `contarEjerciciosAsociados` delegates `count`; `getEjerciciosAsociados` delegates `findMany`+include+orderBy and maps `f.ejercicio`; `reemplazarEjerciciosAsociados` runs one `$transaction` (deleteMany → createMany → findMany) and `createMany` skipped when empty; `obtenerEjerciciosExistentes` maps to a `Set` | `src/domains/maquina/maquina-repositorio.test.ts` (Prisma mocked) |
| Repository (unit) | `EjercicioRepository.getAll` pagination: `take`/`skip` on `findMany`; `LIMIT`/`OFFSET` appended to the search SQL with the term still parameterized; no `LIMIT`/`OFFSET` when params omitted | `src/domains/ejercicio/ejercicio.test.ts` |
| Handlers (unit) | `handleMaquinaEjerciciosGet` (404 vs list), `handleMaquinaEjerciciosPut` (shape → 400, unknown → 400, dup → 400, > MAX_EJERCIOS_POR_MAQUINA → `VALIDATION_MAX_EJERCICIOS`, empty ok, replace), `handleMaquinaDelete` queries real count | `src/api/maquinas.test.ts` |
| Routes (unit) | `[id]/ejercicios/route.ts`: `await params`, 401/403 (`ALLOWED_ROLES`), 200 shape, 404, audit called with `{ maquinaId, ejerciciosAsignados }`, audit failure ignored; `ejercicios/route.ts`: `parsePaginacion` + 400 on invalid limit/offset | `src/app/api/maquinas/[id]/ejercicios/route.test.ts`, `src/app/api/ejercicios/route.test.ts` |
| Permissions (unit) | nested path: `hasRouteAccess` — ADMIN allowed (GET+PUT), RECEPCIONISTA/INSTRUCTOR/SOCIO denied (GET+PUT) | `src/middleware/matrix-consistency.test.ts`, `src/lib/authorization.test.ts` |
| Error mapping (unit) | `VALIDATION_MAX_EJERCICIOS → 400` | `src/lib/route-error-mapper.test.ts` |
| Integration | migration applies (4 additive statements); `@@unique` rejects duplicate; `onDelete: Cascade` cleans M2M on exercise delete; exercise-in-routine still 409 `DELETE_BLOCKED_ASSIGNED`; `reemplazarEjerciciosAsociados` replaces atomically | `tests/integration/ejercicio-maquina.integration.test.ts` |
| Component | `maquina-list.tsx` disclosure + expansion; `maquina-expanded-row.tsx` list + empty state + button; `ejercicio-asignacion-modal.tsx` `role="dialog"`, focus trap, Escape, debounce, paginated fetch (`limit=50`), multi-select, save via PUT, success/error notices | `*.test.tsx` under `src/components/maquina-crud/` |

**RED→GREEN order per slice** (each slice starts by writing the failing tests, then implements):

1. Domain: `maquina.test.ts` cases RED → implement `validarAsignacionEjercicios`.
2. Repository: `maquina-repositorio.test.ts` + `ejercicio-repositorio.test.ts` RED → implement methods (Prisma mocked). Integration test RED (against `arnold_test`, which requires the migration — written together with the migration).
3. Handlers + error mapping: `maquinas.test.ts` + `route-error-mapper.test.ts` RED → implement.
4. Routes + permissions: `[id]/ejercicios/route.test.ts` + `authorization.test.ts`/`matrix-consistency.test.ts` RED → implement route file.
5. Pagination route: `ejercicios/route.test.ts` RED → implement `parsePaginacion` + GET threading.
6. UI: component tests RED → implement `maquina-list`, `maquina-expanded-row`, `ejercicio-asignacion-modal`, page wiring.

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.` This change adds a DB join model, two REST endpoints, pure validation, and UI components. The hand-written migration is a data-layer additive DDL (not a shell/subprocess path), exercised under the ephemeral Docker Postgres integration suite and gated by the pre-migration grep checks.

## Migration / Rollout

The migration is **additive only** (4 statements (1 `CREATE TABLE` + 1 `CREATE UNIQUE INDEX` + 2 `CREATE INDEX`) with inline FKs). It does not touch `Maquina` or `Ejercicio`, and never drops `Maquina_nombre_ubicacion_key`.

**Rollback**: `git revert` the PR; if the migration already applied to a real DB, run the commented rollback `DROP TABLE IF EXISTS "EjercicioMaquina";`. No data loss in `Maquina`/`Ejercicio` — the new table holds only M2M links.

No feature flag is required: the endpoints and UI are additive; existing screens (`/ejercicios`, `/maquinas` Etapa-1 state) remain unchanged when the new params/features are unused. Data migration: none (new table starts empty).

## Slice Plan & LOC Forecast

Authored-line budget is **400** (`additions + deletions`) per review unit. The proposal's four PR clusters (schema+domain / repository+API+routes+permissions / UI / pagination+evidence) each exceed 400 when their tests are counted, so they are split into seven concrete slices. Each slice is a reviewable work unit with a start, finish, autonomous scope, verification, and rollback.

| # | Slice | Files | Est. LOC | Verdict |
|---|-------|-------|----------|---------|
| 1 | Schema + migration + domain (pure) | `schema.prisma`, `migration.sql`, `maquina.ts`, `maquina.test.ts` | ~185 | ≤400 ✅ |
| 2 | Repository + integration | `maquina-repositorio.ts`, `maquina-repositorio.test.ts`, `tests/integration/ejercicio-maquina.integration.test.ts` | ~330 | ≤400 ✅ |
| 3 | Handlers + error mapping + DELETE count | `maquinas.ts`, `maquinas.test.ts`, `route-error-mapper.ts`, `route-error-mapper.test.ts` | ~205 | ≤400 ✅ |
| 4 | Routes + permissions tests | `[id]/ejercicios/route.ts`, `route.test.ts`, `matrix-consistency.test.ts`, `authorization.test.ts` | ~300 | ≤400 ✅ |
| 5 | Pagination | `ejercicio-repositorio.ts` + test, `api/ejercicios.ts` + test, `app/api/ejercicios/route.ts` + test | ~230 | ≤400 ✅ |
| 6 | UI expanded row + fetchers | `maquina-list.tsx` + test, `maquina-expanded-row.tsx` + test, client fetchers | ~240 | ≤400 ✅ |
| 7 | Assignment modal + page wiring | `ejercicio-asignacion-modal.tsx` + test, `app/maquinas/page.tsx` | ~370 | ≤400 ✅ |

**Flags**:
- The natural "repository + API + routes + permissions" cluster (slices 2+3+4, ~835 LOC) **exceeds 400** and is split into three slices.
- The "UI expanded row + modal" cluster (slices 6+7, ~610 LOC) **exceeds 400** and is split into two slices.
- Docs (`openspec/specs/*` deltas + `decisions.md` P-57) are authored separately and do not count against the code review budget (PR 2d).

**Checkpoint boundaries**: each slice ends with `npm test` (unit) green and, for slices 1–2, `npm run test:integration` green; `tsc --noEmit` and `eslint` clean (no *new* errors) at every slice. Slice 1's migration is the only schema change and must be reviewed in isolation before any code depends on it.

## Open Questions

- [ ] **Spec reconciliation (non-blocking)**: the `ejercicios-crud` delta's "default 20 when omitted" vs "returns all matches when omitted" tension. This design resolves it as **opt-in pagination** (backwards compatibility wins); the archive phase should update the spec wording to state "pagination is opt-in; `limit` defaults to 20 and `offset` to 0 only when pagination is requested." No code ambiguity remains.
- [ ] **`enMaquinas` count on the exercise list**: deferred to Etapa 3–5 (per proposal Q3). Not implemented here.
- [ ] **`MAX_EJERCIOS_POR_MAQUINA` as a runtime `/configuracion` parameter**: stays a hard constant in Etapa 2; parameterize in Etapa 4–5 only if the business asks.

## Risks / Rejected Alternatives

| Risk / alternative | Assessment | Mitigation |
|---|---|---|
| `Cascade` vs `Restrict` on both sides | `Restrict` rejected (contradicts "exercise delete removes associations" and adds a `DELETE_BLOCKED_ASSIGNED` path). | `Cascade` on both sides; exercise delete still gated by the two existing `Restrict` relations. |
| `prisma migrate dev` dropping `Maquina_nombre_ubicacion_key` | **High** (human error). | Rule documented; pre-migration checks 1–5 above; CI/PR description must call it out. |
| Modal loading all ~1,324 rows | Medium. | Modal always requests `limit=50`; empty search returns the first page; "select all visible" scoped to current page. |
| `puedeEliminar` race (count=0 then association added before DELETE) | Low. | Same accepted race as `EjercicioEnRutina`; DB stays consistent via `Cascade`. |
| Concurrent PUT on same machine (validation→write gap) | Low. | `reemplazarEjerciciosAsociados` is one `$transaction` (deleteMany+createMany atomic); last-writer-wins; FK backstop (P2003 → 500, fail-closed). |
| `limit` over max (400 vs clamp) | **400 (reject), decided.** | A silent clamp hides a client bug and violates the spec's explicit "over-max → 400 VALIDATION_ERROR". Rejecting is explicit and cheap to handle client-side. |
| P-57 (ESLint pre-existing `react-hooks/purity` at `home-socio/page.tsx:129`, from `f4d1ac2`) | Certain (pre-existing). | Record as P-57 in `decisions.md`; this change introduces **no new** lint errors; P-57 is out of scope. |

## Numbering

New pending `P-57` (ESLint pre-existing error) recorded in `openspec/decisions.md`. Last task `T-053n`, last decision `D-73`, last pending `P-56`. No numbering conflicts introduced.
