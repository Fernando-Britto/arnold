# Máquinas CRUD (T-053a..T-053n)

## Objetivo

Construir el CRUD del catálogo de máquinas para la etapa 1 de "asignación dinámica de ejercicios":
dominio puro, repositorio con unicidad, migración de índice único, API, mapeo de errores, permisos,
componentes y pantalla `/maquinas`, todo ADMINISTRADOR-only.

## Alcance

- `src/domains/maquina/maquina.ts` + `maquina.test.ts`
- `src/domains/maquina/maquina-repositorio.ts` + `maquina-repositorio.test.ts`
- `prisma/migrations/20261023120000_maquina_nombre_ubicacion_unique/migration.sql`
- `tests/integration/maquina.integration.test.ts`
- `src/api/maquinas.ts` + `maquinas.test.ts`
- `src/lib/route-error-mapper.ts` + `route-error-mapper.test.ts`
- `src/middleware/role-gating.ts` + `matrix-consistency.test.ts`
- `src/app/api/maquinas/route.ts` + `route.test.ts`
- `src/app/api/maquinas/[id]/route.ts` + `route.test.ts` + `route.delete.test.ts`
- `src/components/maquina-crud/*` + tests
- `src/app/maquinas/page.tsx` + `page.test.tsx`
- `src/components/layout/staff-rail.tsx`
- `prisma/seed-data.ts`
- `openspec/changes/maquinas-crud/*` + `odd/tasks/maquinas.md`

## Plan de slices

1. **T-053a** — Dominio puro de máquina (validación, normalización, `ESTADOS_ASIGNABLES`, `puedeEliminar`). ✅
2. **T-053b** — Repositorio, unicidad y `P2002`. ✅
3. **T-053c** — Migración del índice único + prueba de integración. ✅ (26/26 contra el Postgres de Docker)
4. **T-053d** — Mapeo de errores nuevos (`ESTADO_NO_ASIGNABLE`, `DUPLICATE_NOMBRE_UBICACION`, `DELETE_BLOCKED_EJERCICIOS`). ✅
5. **T-053e** — Permisos: solo Administrador. ✅
6. **T-053f** — Handlers de API y envoltorios cliente. ✅ (4a + 4b)
7. **T-053g** — Rutas `GET`/`POST /api/maquinas`. ✅ (5a + 5b)
8. **T-053h** — Rutas `GET`/`PUT`/`DELETE /api/maquinas/[id]`. ✅ (6a + 6b + 6c)
9. **T-053i** — Formulario y distintivo de estado. ✅
10. **T-053j** — Panel del formulario (alta/edición). ✅
11. **T-053k** — Listado con filtros y búsqueda. ✅
12. **T-053l** — Navegación y seed de «Polea alta». ✅
13. **T-053m** — Pantalla `/maquinas`. ✅
14. **T-053n** — Cierre documental (P-53, P-54, P-55, P-56, D-73). ✅

## Checkpoints humanos

1. Dominio + migración + Docker Postgres (T-053a..T-053c).
2. API completa con permisos y auditoría (T-053d..T-053h).
3. Pantalla + navegación + seed (T-053i..T-053m).

## Decisión de unicidad

Se adoptó el **enfoque (b)**: un índice único en la base sobre `lower(btrim(nombre)), lower(btrim(ubicacion))`
(insensible a mayúsculas, sensible a tildes, `IMMUTABLE`, sin carrera) más una pre-consulta en el repositorio con
`unaccent(lower(btrim(...)))` (insensible a mayúsculas y tildes, no es carrera-safe, devuelve el mensaje amigable
`DUPLICATE_NOMBRE_UBICACION`).

Se rechazó `lower(unaccent(...))` en el índice porque `unaccent()` es `STABLE`, no `IMMUTABLE`, y Postgres no lo
permite en una expresión de índice. También se rechazó un wrapper `IMMUTABLE` por problemas de portabilidad de
`search_path` y cambios de diccionario.

## Verificación hasta ahora

- `npm test -- src/domains/maquina/maquina.test.ts` — 17/17 ✅
- `npm test -- src/domains/maquina/maquina-repositorio.test.ts` — 16/16 ✅
- `npm test -- src/domains/dominios-puros.guard.test.ts` — 1/1 ✅
- `npm test -- src/api/maquinas.test.ts src/app/api/maquinas` — 60/60 ✅
- `npm run test:integration` — **26/26 verde** contra el Postgres efímero de Docker ✅
- `npx tsc --noEmit` — limpio ✅
- `npx eslint` sobre lo tocado — limpio ✅
- `npm run build` — exit 0; `/api/maquinas` y `/api/maquinas/[id]` registradas ✅

## Smoke contra Supabase (2026-10-24, Fernando)

- Migración `20261023120000_maquina_nombre_ubicacion_unique` **aplicada** en Supabase.
- Índice `Maquina_nombre_ubicacion_key` **verificado** con `pg_indexes`.
- Los 15 pasos del guion dieron lo esperado: login 200, filtros válidos 200, filtros inválidos 400,
  alta 201, duplicado exacto 409, duplicado con tilde 409, `OCUPADA` 400, PUT solo de estado 200,
  cuerpos no objeto 400, primer DELETE 204 sin cuerpo, segundo DELETE 404, GET inexistente 404,
  socio 403, y auditoría con **ALTA / MODIFICACION / BAJA**.
- **Backend de `maquinas-crud` aprobado.**

## Pre-migration check en una base ya poblada

Antes de aplicar la migración en un entorno con datos reales, correr:

```sql
SELECT lower(btrim("nombre")) AS n, lower(btrim("ubicacion")) AS u, count(*)
FROM "Maquina"
GROUP BY 1, 2
HAVING count(*) > 1;
```

- Si devuelve filas, esas colisiones **solo por mayúsculas** harán fallar el `CREATE UNIQUE INDEX`.
- Colisiones **solo por tildes** NO las detecta el índice (no pliega tildes); deben resolverse manualmente antes
  de confiar en la unicidad, aunque la migración sí aplique.
- Los seis pares del seed son distintos (`MAQUINAS.nombre` únicos + `ubicacion: "Sala principal"`), así que un
  `createMany` desde seed limpio no colisiona.

## `prisma migrate dev` con un índice de expresión (precedente D-70)

`schema.prisma` no puede expresar índices sobre funciones (`lower(btrim(...))`), así que la migración es SQL crudo
aplicado por `prisma migrate deploy`. Cuando se corra `prisma migrate dev` o `prisma migrate diff`, es normal y
esperado que reporte una diferencia: el modelo Prisma no conoce el índice de expresión y la base sí lo tiene.

En D-70 el índice era sobre columnas planas (`@@unique([...])`), por eso `migrate diff` daba 0 diferencias. Acá
la diferencia es inevitable porque el índice es una expresión; no indicia un error. No correr `migrate dev`
contra la base compartida desde este entorno.

## Riesgos

- La pre-consulta `unaccent()` no es carrera-safe; `P2002` cierra la carrera para duplicados por mayúsculas, pero
  un par "Polea"/"Poléa" concurrente podría pasar ambas pre-consultas e insertar ambos. Es aceptado y documentado.
- `OCUPADA` queda como estado derivado: el admin no puede asignarlo, pero filas ya existentes se muestran tal cual.
- El índice único no pliega tildes; esa capa vive solo en el pre-check del repositorio.

## P-55 (pendiente chico, no corregir ahora)

Las respuestas de `POST`, `GET` (por id) y `PUT` de máquinas incluyen un campo `status` dentro del JSON del recurso
(porque la ruta hace `{ ...maquina, status: 201|200 }`). Es el mismo patrón que ya usa Membresías. No es un bug
funcional, pero ensucia el contrato: debería sacarse del body y dejar el status solo en el HTTP status code.
Se registra para el cierre (T-053n) y no se toca en esta feature.

## Resultado final

- **Backend aprobado** (smoke de 15 pasos y revisión de Fernando) y **pantalla aprobada** (probada en el navegador por Fernando).
- **240 suites / 3382 tests** unitarios en verde (`npm test`).
- Integración **26/26** contra el Postgres efímero de Docker.
- Migración `20261023120000_maquina_nombre_ubicacion_unique` **aplicada** (`npx prisma migrate status`: **19/19**).
- Índice `Maquina_nombre_ubicacion_key` **verificado** con `pg_indexes`.
- Smoke de **15 pasos** en verde (login, filtros válidos e inválidos, alta, duplicado exacto y con tilde, `OCUPADA`, PUT solo de estado, cuerpos inválidos, DELETE, 404 y 403, auditoría ALTA/MODIFICACION/BAJA).
- Pantalla `/maquinas` probada en el navegador.

## Pendientes

- **P-53**: `INACTIVA` cuenta en "Estado de equipos" de Home_Interno (AC-005); revisar cuando cierre la feature. Home_Interno no se tocó.
- **P-54**: `EstadoMaquina` duplicado como uniones literales en `home-interno.ts` y `tarjeta-detalle.tsx`; consolidación diferida.
- **P-55**: `status` dentro del JSON del recurso en `POST`/`GET`/`PUT`; el estado HTTP debería ser la única fuente.
- **P-56**: carrera entre actualización y borrado que puede salir como 500 (P2025); mapear a 404/409.
- **Etapa 2**: la fila expandida (mostrar los ejercicios de la máquina) y las asociaciones Ejercicio↔Maquina. El chevron de la fila quedó oculto a propósito hasta entonces.
