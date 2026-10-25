# Asignación de ejercicios a máquinas (T-054a..T-054r, D-74)

## Objetivo

Cerrar la **Etapa 2** de "asignación dinámica de ejercicios": asociar ejercicios a máquinas con un M2M
explícito, administrarlo desde la máquina con reemplazo total, bloquear la baja de una máquina con
asociaciones y mostrar la relación en `/maquinas` (fila expandida + modal de asignación), sin agregar el
motor de espera/sugerencia, que es la etapa siguiente.

## Alcance

- `prisma/schema.prisma` (`EjercicioMaquina` + relaciones en `Ejercicio` y `Maquina`)
- `prisma/migrations/20261024120000_ejercicio_maquina/migration.sql`
- `src/domains/maquina/maquina.ts` + `maquina.test.ts`
- `src/domains/maquina/maquina-repositorio.ts` + `maquina-repositorio.test.ts`
- `src/lib/route-error-mapper.ts` + `route-error-mapper.test.ts`
- `src/api/maquinas.ts` + `maquinas.test.ts`
- `src/app/api/maquinas/[id]/ejercicios/route.ts` + `route.test.ts`
- `src/domains/ejercicio/ejercicio-repositorio.ts`, `src/api/ejercicios.ts`, `src/app/api/ejercicios/route.ts` + tests
- `src/components/maquina-crud/maquina-expanded-row.tsx`, `ejercicio-asignacion-modal.tsx`, `maquina-list.tsx` + tests
- `src/app/maquinas/page.tsx` + `page.test.tsx`
- `tests/integration/ejercicio-maquina.integration.test.ts`
- `openspec/decisions.md`, `PROJECT-STATUS.md`, `openspec/sdd-tasks-tdd.md` y este archivo (cierre)

## Plan de slices

1. **T-054a** — Dominio puro de asignación (`validarAsignacionEjercicios`, `validarAsignacionPrevia`, máximo 100). ✅
2. **T-054b** — Modelo `EjercicioMaquina` (único compuesto, `Cascade` en ambos lados). ✅
3. **T-054c** — Migración aditiva escrita a mano + pre-chequeos. ✅ (CP1)
4. **T-054d** — Repositorio: conteo, lectura y reemplazo en una transacción. ✅
5. **T-054e** — Integración: cascada, unicidad y transacción. ✅
6. **T-054f** — Mapeo de `VALIDATION_MAX_EJERCICIOS` a 400. ✅
7. **T-054g** — Handlers de asignación + conteo real en la baja. ✅
8. **T-054h** — Ruta `GET`/`PUT /api/maquinas/[id]/ejercicios`. ✅
9. **T-054i** — Pruebas de permisos del path anidado. ✅ (CP2)
10. **T-054j** — Paginación opt-in en el repositorio de ejercicios. ✅
11. **T-054k** — Paginación en handler y ruta de ejercicios. ✅ (slice 5, ≈285 LOC)
12. **T-054l** — Fetchers cliente de asignación y búsqueda + validación temprana. ✅ (slice 6a, ≈256 LOC)
13. **T-054m** — Fila expandida de la máquina. ✅
14. **T-054n** — Disclosure y detalle en el listado. ✅ (slice 6b, ≈306 LOC con T-054m)
15. **T-054o** — Modal accesible de asignación. ✅ (slice 7a, 394 LOC)
16. **T-054p** — Cableado de `/maquinas`. ✅ (slice 7b, 98 LOC)
17. **T-054q** — Filtro por grupo muscular y selección de visibles en el modal. ✅ (slice 8, 287 LOC)
18. **T-054r** — Cierre documental (D-74, P-57..P-60). ✅ (cierre ejecutado)

## Checkpoints humanos

1. **CP1** — schema + migración + dominio puro (T-054a..T-054c): migración verificada contra el Postgres efímero de Docker.
2. **CP2** — API completa (T-054d..T-054i): repositorio, handlers, rutas, permisos y conteo real de la baja.
3. **CP3** — UI (T-054j..T-054p): paginación, fila expandida y modal; `/maquinas` probada en el navegador por Fernando.

## Decisión M2M / Cascade

Se usó una tabla de unión explícita `EjercicioMaquina`, como el precedente `Rutina → EjercicioEnRutina`:
`id` propio, `@@unique([maquinaId, ejercicioId])`, un índice por lado y `onDelete: Cascade` en **ambas**
relaciones.

- El borrado de un ejercicio ya está bloqueado por las relaciones `Restrict` existentes
  (`EjercicioEnRutina`, `RegistroDeProgreso`), así que la asociación nueva **no** agrega un camino
  `DELETE_BLOCKED_ASSIGNED`.
- El borrado de una máquina se bloquea en el handler con el conteo real (409 `DELETE_BLOCKED_EJERCICIOS`);
  con 0 asociaciones se conserva el borrado físico, por lo que el `Cascade` del lado de la máquina es seguro.

La migración es aditiva y escrita a mano (FKs inline, sin `DROP` ni `ALTER`). No se corre `prisma migrate dev`
contra la base compartida.

## Verificación

- `npm test` — **243 suites / 3501 tests** en verde.
- Suite de integración — la corrió Fernando (sin un conteo registrado acá).
- Migración `20261024120000_ejercicio_maquina` **aplicada** en Supabase por Fernando el 2026-10-25;
  `npx prisma migrate status`: **20/20**.
- Pantalla probada en el navegador por Fernando; **CP3 aprobado por el revisor externo**.

## Pendientes

- **P-57**: ESLint falla en `dev` por `Date.now()` durante el render en `src/app/home-socio/page.tsx:129`
  (`react-hooks/purity`); preexistente de `f4d1ac2`, no se corrigió en esta etapa.
- **P-58**: el conteo `enMaquinas` en el listado de ejercicios quedó diferido (Q3 de la propuesta / open
  question del diseño).
- **P-59**: `MAX_EJERCICIOS_POR_MAQUINA` como parámetro de `/configuracion` quedó diferido; sigue como
  constante dura.
- **P-60**: asignación automática o sugerida de ejercicios a máquinas (ver "Ideas futuras"); no se implementa
  en esta etapa.

## Ideas futuras

- **P-60 — Asignación automática o sugerida**: a partir del `equipamiento` y el `grupoMuscular` del ejercicio
  y del `tipoEquipamiento`/`nombre` de la máquina, proponer un conjunto de ejercicios. El administrador
  **revisa y confirma**; la sugerencia solo preselecciona en el modal, nunca asigna en silencio. Requiere una
  heurística de matching y tests de la preselección.

## Próximo paso: Etapa 3 (motor de espera y sugerencia)

Con la relación ejercicio↔máquina ya persistida, la Etapa 3 agrega el **motor de espera/sugerencia**: a
partir de las máquinas y sus ejercicios, decidir qué puede hacer el socio hoy y qué sugerirle. No forma
parte de este cambio.
