# Exploration: maquina-ejercicios (Etapa 2 — Ejercicio ↔ Maquina relation)

## Current State

- `Ejercicio` (src/domains/ejercicio/ejercicio.ts, schema.prisma lines 277–300) has only free-text `equipamiento` (Spanish: "Mancuerna", "Peso corporal") and **zero** relation to `Maquina`. `Maquina` (schema.prisma lines 380–391) has **no relations declared** — it is a standalone catalog table.
- The M2M does not exist in the schema, in the domain, in the API, or in the UI.
- `puedeEliminar` (src/domains/maquina/maquina.ts lines 113–124) already accepts `{ ejerciciosAsociados: number }` but the handler (src/api/maquinas.ts line 133) hardcodes `ejerciciosAsociados: 0`. Etapa 2 must wire the real count.
- `EjercicioEnRutina` (schema.prisma lines 332–351) is the existing explicit join table pattern with `@@unique([rutinaId, ejercicioId])` + `onDelete: Cascade` on the parent (rutina) and `onDelete: Restrict` on the child (ejercicio). This is the structural template to copy.

## Affected Areas

| Path | Why affected |
|------|--------------|
| `prisma/schema.prisma` | New `EjercicioMaquina` model + relation fields on both `Ejercicio` and `Maquina` |
| `prisma/migrations/<ts>_ejercicio_maquina/migration.sql` | Hand-written migration (no `prisma migrate dev`) |
| `src/domains/ejercicio/ejercicio.ts` | New `EjercicioConMaquina` shape or extend existing `EjercicioResumen` |
| `src/domains/ejercicio/ejercicio-repositorio.ts` | New read methods: `getEjerciciosDeMaquina`, `asignarEjercicios`, `contarEjercicios` |
| `src/domains/maquina/maquina.ts` | `Maquina` type already has `puedeEliminar`; no schema change needed in domain, but `MaquinaInput` stays unchanged |
| `src/domains/maquina/maquina-repositorio.ts` | New methods: `getMaquinaConEjercicios`, `asignarEjercicios(maquinaId, ejercicioIds)`, `contarEjerciciosAsociados(maquinaId)` |
| `src/api/maquinas.ts` | New `handleMaquinaEjerciciosGet` / `handleMaquinaEjerciciosPut`; update `handleMaquinaDelete` to wire real count |
| `src/api/ejercicios.ts` | Possibly extend `EjercicioConUso` with `enMaquinas` count (parallel to `enRutinas`) |
| `src/app/api/maquinas/[id]/ejercicios/route.ts` | **New file** — GET + PUT endpoints |
| `src/app/api/maquinas/[id]/route.ts` | `DELETE` must query real `ejerciciosAsociados` count before calling `puedeEliminar` |
| `src/app/api/ejercicios/[id]/route.ts` | DELETE must remove associations before/when deleting the exercise (see onDelete analysis below) |
| `src/components/maquina-crud/maquina-list.tsx` | Add `disclosure` to `TableHeader`/`TableRow`; add `TableDetailRow` with associated exercises + "Asignar ejercicios" button |
| `src/components/maquina-crud/ejercicio-asignacion-modal.tsx` | **New component** — accessible modal with search + multi-select |
| `src/lib/route-error-mapper.ts` | `DELETE_BLOCKED_EJERCICIOS` is already mapped (line 107–113) — no change needed |

## Approaches Considered

### 1. Explicit join table with composite unique constraint (DECISION CONFIRMED)

**Pattern to copy:** `EjercicioEnRutina` (schema.prisma lines 332–351).

```prisma
model EjercicioMaquina {
  id          String   @id @default(cuid())
  ejercicio   Ejercicio @relation(fields: [ejercicioId], references: [id], onDelete: Cascade)
  ejercicioId String
  maquina     Maquina  @relation(fields: [maquinaId], references: [id], onDelete: Cascade)
  maquinaId   String
  createdAt   DateTime @default(now())

  @@unique([maquinaId, ejercicioId])
  @@index([maquinaId])
  @@index([ejercicioId])
}
```

**onDelete analysis — this is the critical decision:**

| Side | Existing pattern | What Etapa 2 requires | Recommended `onDelete` | Rationale |
|------|-----------------|----------------------|----------------------|-----------|
| `maquina → EjercicioMaquina` | `EjercicioEnRutina.rutina` uses `Cascade` | Machine with associated exercises **cannot** be deleted (409 `DELETE_BLOCKED_EJERCICIOS`) | **`Cascade`** | The handler blocks deletion via `puedeEliminar` BEFORE the DB delete fires. If the handler allows the delete (count=0), there are no rows to cascade. Cascade is the safest choice because a `Restrict` here would conflict with the business rule only if the handler has a bug — and the handler already enforces it. |
| `ejercicio → EjercicioMaquina` | `EjercicioEnRutina.ejercicio` uses `Restrict` (blocks deletion if in routines) | Deleting an exercise **must remove its associations** (per scope) | **`Cascade`** | The exercise's own `Restrict` relations (`EjercicioEnRutina`, `RegistroDeProgreso`) already gate whether an exercise can be deleted. If deletion proceeds, the M2M rows must disappear automatically. A `Restrict` here would incorrectly block exercise deletion whenever a machine association exists, contradicting the requirement. |

**Key evidence from exercise deletion today (src/domains/ejercicio/ejercicio-repositorio.ts lines 229–257):**

- `Ejercicio.delete()` catches `P2003` (foreign key violation) and maps it to `DELETE_BLOCKED_ASSIGNED` (409).
- Today, exercise deletion is blocked ONLY by `EjercicioEnRutina` and `RegistroDeProgreso` (both `onDelete: Restrict`).
- If `EjercicioMaquina.ejercicio` used `onDelete: Restrict`, deleting an exercise with machine associations would throw `P2003` → `DELETE_BLOCKED_ASSIGNED` (409). This contradicts the requirement that "deleting an exercise removes its associations."
- Therefore: **`onDelete: Cascade` on the `ejercicio` side is mandatory** for the M2M rows to be cleaned up automatically.

**Pros:** Symmetric, simple, matches the `EjercicioEnRutina.rutina` pattern. The business rule (no machine deletion with exercises) is enforced at the handler level, not the DB level.
**Cons:** If a future bug bypasses the handler check, cascade would delete the association rows silently. But this is the same tradeoff already accepted for `Rutina → EjercicioEnRutina`.

### 2. `onDelete: Restrict` on both sides

Would force manual cleanup in code. Rejected: contradicts "deleting an exercise removes its associations" and adds unnecessary complexity.

### 3. Implicit Prisma M2M (`maquina Maquina[]` with no explicit model)

Rejected by decision 1 — the explicit join table is required.

---

## Maximum exercises per machine

**Recommendation: 50**

- A gym machine (e.g., "Polea baja") maps to a focused set of exercises. 50 is far beyond any realistic use case.
- The validation guards against UI errors and accidental bulk assignments, not a real business limit.
- The modal's search + multi-select UX already limits practical selections; 50 is a generous ceiling.
- Stored as a constant `MAX_EJERCIOS_POR_MAQUINA = 50` in the domain file, parallel to existing domain constants.

---

## Exercise search endpoint for the modal

**Can the existing endpoint serve the modal? YES, with caveats.**

### Existing capability (src/app/api/ejercicios/route.ts + src/domains/ejercicio/ejercicio-repositorio.ts lines 133–158):

- `GET /api/ejercicios?search=<term>&muscleGroup=<group>` already exists.
- `search` triggers a raw SQL path with `unaccent("nombre") ILIKE unaccent(%term%)` — **accent-insensitive** and **server-side**.
- The non-search path uses `findMany` with `_count` for `enRutinas`.

### What the modal needs:

| Need | Status |
|------|--------|
| Accent-insensitive search | ✅ Already supported via `unaccent` |
| No full 1,324-row load | ⚠️ The endpoint returns ALL matches with no pagination. With an empty or short `search`, it could return hundreds of rows. |
| Name + muscle group display | ✅ `nombre` and `grupoMuscular` are in `EjercicioResumen` |
| Multi-select state | Client-side only — no API change |

### Recommendation:

1. **Add server-side pagination** to `GET /api/ejercicios`: new optional `limit` (default 20, max 50) and `offset` params. This is a small, safe extension.
2. The modal calls `GET /api/ejercicios?search=<debounced>&limit=50` on each keystroke (debounced ~300ms). With empty search, it returns the first 50 — never all 1,324.
3. The "select all visible" checkbox only selects the current page; the user refines search to find more. This is the standard accessible pattern.

**Alternative considered:** A dedicated `GET /api/maquinas/[id]/ejercicios/disponibles?search=` endpoint. Rejected — duplicates search logic that already exists, adds a second code path for the same `unaccent` query. The existing endpoint already returns the shape the modal needs (`id`, `nombre`, `grupoMuscular`). The only addition is pagination.

---

## Expanded row restoration

### Current state of `MaquinaList` (src/components/maquina-crud/maquina-list.tsx):

- **No `disclosure`** prop on `TableHeader` (line 142) or `TableRow` (line 147–150).
- **No `TableDetailRow`** — the expanded row was never built or was removed.

### Pattern to copy:

`EjercicioListPanel` (src/components/ejercicio-crud/ejercicio-list.tsx lines 150–180):

```tsx
<TableHeader columns={...} sort={sort} onSort={handleSort} disclosure />
{visibles.map((ejercicio) => {
  const isSelected = ejercicio.id === selectedId;
  return (
    <React.Fragment key={ejercicio.id}>
      <TableRow selected={isSelected} onClick={...} disclosure>
        ...
      </TableRow>
      {isSelected && (
        <TableDetailRow>
          <EjercicioDetalle ejercicio={ejercicio} />
        </TableDetailRow>
      )}
    </React.Fragment>
  );
})}
```

### What's needed for MaquinaList:

1. Add `disclosure` to `TableHeader` (reserves the 40px chevron zone).
2. Add `disclosure` to `TableRow` (renders the chevron, rotates when selected).
3. Add a `TableDetailRow` after each selected row containing:
   - List of associated exercises (name + muscle group) — fetched via `GET /api/maquinas/[id]/ejercicios`.
   - "Asignar ejercicios" button that opens the modal.
4. The `onClick` → `onSelect` already toggles selection; the chevron visual is driven by `selected` state internally via the `disclosure` prop.

**No changes to `src/components/ui/table.tsx`** — `TableHeader`, `TableRow`, `TableDetailRow`, and `disclosure` are already implemented and tested.

---

## Migration conventions

### Last migration: `20261023120000_maquina_nombre_ubicacion_unique`

```sql
CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key"
  ON "Maquina" (lower(btrim("nombre")), lower(btrim("ubicacion")));
```

**Hand-written, idempotent (`CREATE UNIQUE INDEX` is not idempotent — should use `CREATE UNIQUE INDEX IF NOT EXISTS` or guard in the filename), only one statement.**

### The `Maquina_nombre_ubicacion_key` problem:

- This is an **expression index** using `lower(btrim(...))` — NOT representable in Prisma `schema.prisma` (Prisma does not support expression indexes).
- `prisma migrate dev` / `prisma migrate diff` would detect the "orphan" index and either emit a `DROP INDEX` or propose a `reset`.
- **Rule (already in project scope): never run `prisma migrate dev`.**

### New migration:

- Filename: `prisma/migrations/<ts>_ejercicio_maquina/migration.sql`
- Contents: `CREATE TABLE "EjercicioMaquina"` + `CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key"` + the two secondary indexes.
- Must be **additive only** — no `DROP`, no `ALTER` on existing tables.

### Pre-migration check for Fernando (before `prisma migrate deploy` in Supabase):

1. `grep -c 'DROP\|ALTER' prisma/migrations/<ts>_ejercicio_maquina/migration.sql` must return 0.
2. `grep 'Maquina_nombre_ubicacion_key' prisma/migrations/<ts>_ejercicio_maquina/migration.sql` must return nothing.
3. `grep -c 'CREATE TABLE\|CREATE INDEX' prisma/migrations/<ts>_ejercicio_maquina/migration.sql` should return the expected count (1 table + 3 indexes = 4 statements).
4. `npm run test:integration` passes against the ephemeral Docker Postgres.
5. Verify the new migration's DOWN is a manual `DROP TABLE "EjercicioMaquina"` (Prisma doesn't auto-generate rollbacks for hand-written SQL).

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `prisma migrate dev` accidentally drops `Maquina_nombre_ubicacion_key` | **High** | Never run it. Document the rule. Pre-migration check #2 above. |
| `onDelete: Cascade` on exercise side + `DELETE_BLOCKED_ASSIGNED` interaction | **Medium** | If an exercise has associations in `EjercicioEnRutina` (Restrict), deletion is still blocked by P2003 from that relation. The M2M cascade does not interfere. Test: delete an exercise with both routine AND machine associations → 409 from routine, machine associations cleaned up silently. |
| Full 1,324 exercise load in modal | **Medium** | Add pagination to `GET /api/ejercicios`. Modal never calls without a search term or without `limit`. |
| `puedeEliminar` race: count=0 at check, association added before DELETE | **Low** | Same race already exists for `EjercicioEnRutina` on exercise deletion. The DB-level `onDelete: Cascade` means no integrity violation. Acceptable for this feature's consistency model. |
| `PUT` replaces the full set — a concurrent read between validation and write could miss a deleted exercise | **Low** | Use a transaction: validate all IDs exist, then `deleteMany` + `createMany` atomically. |

---

## Open Questions

1. **Should `EjercicioConUso` expose `enMaquinas` (parallel to `enRutinas`)?** The exercise list could show how many machines an exercise is associated with — useful context but not required by scope. Recommendation: add it as an optional field in the repository's `getAll` (join count from `EjercicioMaquina`), surfaced only if the UI needs it.
2. **Audit granularity for PUT:** The scope says "best-effort MODIFICACION audit." Should the audit detail include the added/removed IDs or just the count? Recommendation: `detalles: { maquinaId, ejerciciosAsignados: n }` — the count is enough; a diff is overkill for this stage.
3. **Empty PUT (`ejerciciosIds: []`):** Valid — means "remove all associations" and the machine becomes deletable. Confirmed by decision 2 (permissive association).

---

## Recommendation

Proceed with:
1. Explicit `EjercicioMaquina` join table with `@@unique([maquinaId, ejercicioId])`, `onDelete: Cascade` on both sides.
2. New `GET` + `PUT` at `/api/maquinas/[id]/ejercicios`, ADMINISTRADOR-only, max 50 exercises per machine, validate all IDs exist, no duplicates, audit best-effort.
3. Wire `handleMaquinaDelete` to query real count and pass to `puedeEliminar`.
4. Add pagination (`limit`/`offset`) to `GET /api/ejercicios` to prevent full 1,324 loads in the modal.
5. Restore expanded row in `MaquinaList` using the existing `disclosure`/`TableDetailRow` pattern from `EjercicioListPanel`.
6. Hand-write the migration; never run `prisma migrate dev`; pre-check before `migrate deploy`.
