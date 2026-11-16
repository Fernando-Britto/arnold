# Tasks: reasignacion-instructor (P-61)

> **Change**: `reasignacion-instructor` · **Rama**: `feat/reasignacion-instructor` · **Base**: `dev` ·
> **Almacén**: openspec.
>
> **Entradas**: `explore.md`, `proposal.md` (D-125…D-131), `design.md` (D-132/D-133) y el spec
> `reasignacion-instructor` (AC-571…AC-585).
>
> **Numeración**: tareas **T-058a–T-058e**, decisiones **D-125–D-133**, pendiente nuevo **P-72**.

## Reglas de ejecución

1. **Strict TDD**: primero la prueba, con el rojo por la razón correcta. No se avanza en rojo.
2. **Sin commits del agente**: un slice = un commit, lo hace Fernando.
3. **Sin PRs** (flujo del proyecto).
4. **Presupuesto** ≤400 líneas por commit, medidas con `git diff --shortstat`.
5. **Sin migraciones** ni cambios a `prisma/schema.prisma`, `prisma/migrations/**` ni `motor-espera.ts`.
6. **No tocar `sesion-de-entrenamiento.ts`**: la sesión no se modifica (D-125/D-127).
7. **Sin `any`**; los resultados de Prisma se castean a tipos explícitos.
8. **Textos en español rioplatense** en mensajes y tests.
9. **Auditoría dentro de la transacción** con `tx.registroDeAuditoria.create`, nunca `registrarOperacion`.
10. **Mutación obligatoria del lock**: quitar `enTransaccionBloqueada` o el guard debe hacer fallar el test de
    integración. Se documenta el resultado.
11. **La integración se escribe pero NO se ejecuta**: la corre Fernando con Docker.
12. `npm run lint` en 0 errores y sin `Date.now()`/`new Date()` en render.

## Slices

### T-058a · S0 · Dominio de reasignación

- **AC**: 574, 575, 576, 577, 578, 579, 580, 581, 584.
- **Archivos**: `src/domains/asignacion/reasignacion.ts` (nuevo), `asignacion-escrituras.ts` (+
  `cancelarEjecucion`), `asignacion-repositorio.ts` (+ `enTransaccionDeReasignacion`), tests
  `reasignacion.test.ts` y `asignacion-repositorio.escrituras.test.ts`.
- **RED**: fake del puerto — orden de llamadas (cancelar antes de crear), las 5 validaciones cortan sin
  escribir, `cancelarEjecucion` false → 409, un throw del `create` propaga (rollback).
- **GREEN**: implementar. **Mutación**: quitar el chequeo de `estado === EN_CURSO` del guard → falla un test.
- **Cota**: 330.

### T-058b · S1 · Lectura del staff

- **AC**: 571 (lado API), 572, 573.
- **Archivos**: `src/api/sesiones.ts` (+ `handleSesionesEnCursoStaff`), `src/app/api/reasignaciones/route.ts` (nuevo, GET), tests de ruta.
- **Cuerpo**: sesiones `EN_CURSO` ordenadas por `horaInicio`, con socio, ejercicio, `asignacionId`,
  `maquinaId` y `candidatos`. Roles INSTRUCTOR/ADMIN; 403 al resto.
- **Cota**: 240.

### T-058c · S2 · Endpoint de reasignación

- **AC**: 582, 583 (+ los 409 de S0 a través del handler).
- **Archivos**: `src/api/asignaciones.ts` (+ `handleReasignar`), `src/app/api/reasignaciones/route.ts` (POST),
  `src/lib/authorization.ts` (`/api/reasignaciones` GET+POST para INSTRUCTOR y ADMIN), tests.
- **Cuerpo**: body estricto `{ maquinaId }`, roles, mapeo de códigos a 400/404/409/500 y consistencia matriz ↔
  handler.
- **Cota**: 300.

### T-058d · S3 · Panel de sesiones en curso

- **AC**: 571 (lado UI), 572.
- **Archivos**: `src/components/home-interno/sesiones-en-curso.tsx` (nuevo), `src/app/home-interno/page.tsx`,
  tests del componente.
- **Cuerpo**: lista con socio, ejercicio, máquina y hora; vacío; solo INSTRUCTOR/ADMIN; sin pantalla de carga
  completa.
- **Cota**: 270.

### T-058e · S3/S4 · Acción de reasignar + integración

- **AC**: 578/579 en UI, 581.
- **Archivos**: el panel (+ selector de candidatos y `POST`), `tests/integration/reasignacion-instructor.integration.test.ts`
  (nuevo, **se escribe y no se ejecuta**).
- **Cuerpo**: selector con candidatos, botón deshabilitado mientras envía, 409 visible y refresco; integración
  contra Postgres con el lock y la mutación correspondiente.
- **Cota**: 225.

## Matriz AC → tarea → test

| AC | Tarea | Test |
|---|---|---|
| 571 | S1/S3 | `reasignaciones/route.test.ts` + `sesiones-en-curso.test.tsx` |
| 572 | S1 | `route.test.ts` "arma el DTO con y sin fila EN_CURSO" |
| 573 | S1 | `route.test.ts` "no devuelve finalizadas" |
| 574 | S0 | `reasignacion.test.ts` "cancela y crea en ese orden" |
| 575 | S0 | `reasignacion.test.ts` "fila sin máquina recibe máquina" |
| 576 | S0 | `reasignacion.test.ts` "no candidata" |
| 577 | S0 | `reasignacion.test.ts` "no disponible" |
| 578 | S0/S4 | `reasignacion.test.ts` "ocupada" + panel con 409 |
| 579 | S0 | `reasignacion.test.ts` "el socio ya terminó" |
| 580 | S0 | `reasignacion.test.ts` "audita con las cuatro piezas" |
| 581 | S0 | `tests/integration/reasignacion-instructor.integration.test.ts` |
| 582 | S2 | `asignaciones.reasignar.test.ts` "body estricto" |
| 583 | S2 | `route.test.ts` roles + `authorization` consistencia |
| 584 | S0 | `reasignacion.test.ts` "no toca la sesión" (el doble no recibe escrituras de sesión) |
| 585 | — | `git diff --name-only` sin `prisma/` ni `motor-espera.ts` |

## Puerta del change

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git diff --name-only origin/dev...HEAD   # sin prisma/ ni motor-espera.ts
```

## Smoke manual (Fernando, con Docker para la integración)

```bash
npm run test:integration    # incluye reasignacion-instructor.integration.test.ts
```
Luego, en el navegador: socio con sesión abierta → el instructor abre `Home_Interno` → "Sesiones en curso" →
elige otra máquina candidata → "Reasignar". En SQL: la fila anterior `CANCELADA`, una nueva `EN_CURSO` con la
máquina elegida, la sesión intacta y un `RegistroDeAuditoria` `MODIFICACION`.

## Estado de la implementación (2026-11-12)

| Slice | Estado | Medido |
|---|---|---|
| T-058a · S0 dominio | ✅ | `reasignacion.ts` + `cancelarEjecucion` + `enTransaccionDeReasignacion`; 12 tests nuevos |
| T-058b · S1 lectura | ✅ | `handleSesionesEnCursoStaff` + `GET /api/reasignaciones`; 5 tests del handler + ruta |
| T-058c · S2 reasignación | ✅ | `handleReasignar` + `POST` + matriz `/api/reasignaciones`; 14 tests del handler + 8 de ruta |
| T-058d · S3 panel | ✅ | `sesiones-en-curso.tsx` + montaje por rol; 6 tests |
| T-058e · S4 acción | ✅ | selector, `POST` y refresco (mismos tests del panel); integración escrita |
| Integración | ⏳ | `tests/integration/reasignacion-instructor.integration.test.ts` escrita, **no ejecutada** |
| Mutación del lock | ⏳ | la corre Fernando con Docker (`npm run test:integration`) |

Suite completa: **282 suites / 3957 tests** (+46 respecto de AC-566 anterior). Sin migraciones.
