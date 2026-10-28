# Tasks: asignacion-integracion (Etapa 4 — Integración del motor de espera)

> **Change**: `asignacion-integracion` · **Rama**: `feat/asignacion-integracion` · **Base**: `dev` ·
> **Almacén de artefactos**: openspec (archivos).
>
> **Entradas**: `explore.md`, `proposal.md`, `design.md` (§2–§15), las cinco delta specs
> (`asignacion-ejercicio-persistencia`, `asignacion-orquestacion`, `asignacion-api`,
> `configuracion-sistema`, `member-access-check`), `openspec/config.yaml` (`strict_tdd: true`,
> `npm test`) y el estilo de `openspec/changes/archive/2026-10-25-motor-espera/tasks.md`
> (estructura, campos por tarea, verificación, rollback y forecast; no su tamaño).
>
> **Numeración**: tareas **T-056a–T-056g** (última registrada: T-055d), decisiones **D-88–D-109**
> (última: D-87), pendientes **P-68–P-71** (último: P-67). Verificado el 2026-10-26 contra
> `openspec/decisions.md`: no hay colisiones.
>
> **Rebanado**: siete slices verticales, alineados con `design.md` §14 y los cuatro checkpoints de
> Fernando (CP1, CP2, CP3, CP4). CP2 se parte en S2 (lecturas base) y S3 (entrada del motor, ocupantes,
> cola, escrituras y lock); CP4 se parte en S5 (handlers), S6 (rutas/RBAC/errores) y S7 (check-in y
> sesión). Cada slice entrega producción **y** las pruebas que la demuestran, deja la suite verde y es
> revisable por separado. Un commit que solo agrega pruebas no es una unidad de trabajo coherente.

## Reglas de ejecución

1. **Strict TDD (rojo → verde)**: en cada paso se escribe primero la prueba y se ejecuta. El rojo debe
   deberse a la razón correcta (símbolo no exportado, función ausente, tabla/columna inexistente o valor
   esperado distinto), nunca a un error de tipeo o de fixture. Después, la implementación mínima que pone
   el paso en verde. No se avanza con una prueba en rojo.
2. **Sin commits del agente**: el agente no commitea, no pushea, no abre PRs y no ejecuta migraciones.
   Cada slice lo commitea Fernando; **un slice = un commit**.
3. **Sin PRs** (flujo del proyecto). La revisión es por commit, no por pull request.
4. **Migraciones a mano y aditivas**: los dos archivos SQL se escriben a mano. Fernando los aplica con
   `npx prisma migrate deploy` (conexión directa, P-28). **Nunca** `prisma migrate dev`.
5. **Integración contra Docker Postgres**: los slices con persistencia se prueban con
   `npm run test:integration` (contenedor `arnold-test-db`, `127.0.0.1:5433`, `postgres:17-alpine`).
   La prueba de concurrencia **debe** correr contra Docker, no contra el pooler.
6. **Sin `any`**: TypeScript estricto. Los resultados de Prisma se castean a DTO explícitos, nunca con
   `any` ni con `as` sobre tipos de Prisma (el patrón permitido es `as unknown as <TipoDelPuerto>`).
7. **Textos en español**: `describe`/`it`, mensajes de validación y de error, etiquetas del panel y
   comentarios de porqué. Identificadores del dominio en español, como el resto del proyecto.
8. **No se toca `src/domains/asignacion/motor-espera.ts` ni sus tests** (ni sus tipos públicos, ni el
   guardián de dominios puros). Se consume tal cual. Si una tarea parece necesitar un cambio ahí, se
   detiene y se reporta.
9. **UI acotada**: el único cambio visual es el grupo “Motor de espera” con tres campos en
   `/configuracion`. No hay pantalla del socio, ni Home_Interno, ni componentes nuevos.
10. **Presupuesto**: ≤400 líneas autoradas (adiciones + eliminaciones, tests incluidos) por slice. Se
    mide con `git diff --shortstat` antes de pedir el commit. Si un slice se pasa, se detiene y se
    aplica el corte declarado; no se parte en silencio.
11. **Lint acotado a los archivos del slice**: no se ejecuta `npx eslint .` como gate. El error
    preexistente **P-57** en `src/app/home-socio/page.tsx:129` (`react-hooks/purity`) no es
    responsabilidad de esta change.
12. **Sin seed, sin reasignación de instructor y sin simulación de tesis.** No se agregan datos de
    ejemplo ni se implementa `EN_CURSO → CANCELADA` por instructor (P-61, Etapa 5).

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines — T-056a (CP1) | ≈240 estimado · **428 medidos**, por eso se parte en T-056a1 + T-056a2 (ver cortes) |
| Estimated changed lines — T-056b (CP2a) | ≈370 (puerto/DTO + lecturas base + tests) |
| Estimated changed lines — T-056c (CP2b) | ≈395 (ocupantes frescos + cola + P-67 + vencimiento + escrituras + lock + integración + cascada) |
| Estimated changed lines — T-056d (CP3) | **≈1.100** recalculado (3,0× sobre ≈365) — se parte en d1 + d2 + d3 |
| Estimated changed lines — T-056e (CP4a) | **≈825** recalculado (3,0× sobre ≈275) — se parte en e1 + e2 |
| Estimated changed lines — T-056f (CP4b) | **≈585** recalculado (3,0× sobre ≈195) — se parte en f1 + f2 |
| Estimated changed lines — T-056g (CP4c) | **≈1.170** recalculado (3,0× sobre ≈390) — se parte en g1 + g2 + g3 |
| Estimated changed lines — total | **≈2230** |
| Largest single slice (declarada) | ≈395 (T-056c) y ≈390 (T-056g) — por debajo de 400 |
| 400-line budget risk | **Medium**: T-056c y T-056g rozan el tope y las pruebas de integración son pesadas; T-056c aplica su corte declarado T-056c1/T-056c2 si el diff supera 400 |
| Chained PRs recommended | **No** (no hay PRs: un slice = un commit) |
| Suggested split | commit CP1 → CP2a → CP2b → CP3 → CP4a → CP4b → CP4c |
| Delivery strategy | ask-on-risk (rebanado ya autorizado; sin PRs) |
| Chain strategy | no aplica — sin PRs |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: no aplica (sin PRs: un slice = un commit en feat/asignacion-integracion)
400-line budget risk: Medium
```

No se requiere decisión previa al apply: el rebanado está autorizado por el diseño y el usuario. El
riesgo es de tamaño, no de alcance; se controla con `git diff --shortstat` y los cortes declarados.

### Estado de CP4 (cerrado) y lo que queda

CP4 se entregó en nueve commits: e1 (GET), e2 (POST), f1 (matriz + mapper), f2 (rutas), g1 (gancho de
check-in), g2 (adaptador + inicio), g2b (consumo dentro de la transacción), g3a (`registrarSerie`) y
g3b (`finalizarSesion`). La suite quedó en **262 suites / 3.717 tests** y la integración en
**9 suites / 54 tests**, con el flujo de sesión real contra Postgres.

**Pendientes al cerrar CP4** (ninguno es código de esta change):

1. **Smokes manuales**: el de CP4b (curl de `/api/asignaciones/*` con los cuatro roles) y el de CP4c
   (check-in + sesión) quedan escritos en este archivo para que los corra Fernando con `npm run dev`.
2. **`sdd-verify`** sobre el change completo, si se quiere un informe previo al archivo.
3. **Archivar** el change (`sdd-archive`) y registrar D-88…D-109 en `openspec/decisions.md`.
4. **Merge**: `feat/asignacion-integracion` → `dev`, y `dev` → `main` cuando la integración esté
   corrida en el entorno real.

### Estado de CP3 y estimaciones para CP4

CP3 se entregó en cinco commits: d1a (camino feliz, 318 líneas), d1b (fallback/inválido/errores,
375), d2a (decisión, 263), d2b (consultas y pasarelas, ≈300) y d3 (concurrencia en Postgres, 95).
Total ≈1.350 líneas frente a las ≈1.100 estimadas: **1,2×** sobre el recálculo, no el 3× de CP2. La
integración quedó en **8 suites / 50 tests**.

Para CP4 se mantiene la estimación recalculada al 3× como **cota superior** (CP2 la justificó), pero
la relación observada en CP3 sugiere que el número real estará más cerca de 2×:

| Tarea | Original | Cota 3× | Esperado ≈2× |
|---|---|---|---|
| T-056e | ≈275 | ≈825 | ≈550 |
| T-056f | ≈195 | ≈585 | ≈390 |
| T-056g | ≈390 | ≈1.170 | ≈780 |

Los cortes por archivo ya declarados (e1/e2, f1/f2, g1/g2/g3) siguen vigentes; se miden con `wc -l`
al crear cada archivo y se parte antes de pasar de ≈350 líneas.

### Lección: los tests con Prisma falso no ejecutan el SQL real

Un adaptador que escribe en base no está probado hasta que corre contra Postgres. En CP2 el doble
escondió que `SELECT pg_advisory_xact_lock(...)` devolvía una columna `void` que Prisma no sabe
deserializar; en CP4 el flujo de sesión (check-in → inicio → avance → fin) nunca había ejecutado su SQL
real. Regla: cada adaptador nuevo que escribe necesita **al menos un flujo contra Postgres** en
`tests/integration/`, aunque tenga unitarios completos.

### Lección: los tests de concurrencia se verifican con mutación

Un test de concurrencia que pasa **no prueba** que el lock exista. En CP3 el escenario "dos check-in
sobre la misma máquina" pasaba también sin el advisory lock, por timing. Antes de dar por bueno un
test de lock o de atomicidad, se comenta la sentencia del lock y se verifica que **falla**; recién
después se restaura. La mutación de CP4 dejó tres fallos: serialización de transacciones, dos
check-in sobre M1 y dos recálculos del mismo socio.

### Estimaciones corregidas con la medición de CP2

CP2 (T-056b + T-056c) se estimó en ≈740 líneas y midió **2.327** (3,1×). La desviación no es ruido: el puerto
con DTOs, los dobles de Prisma y los tests de integración pesan mucho más que la estimación original. Con esa
relación se recalcularon las tareas restantes antes de escribirlas.

| Tarea | Estimado original | Recalculado (3,0×) | Corte propuesto por responsabilidad | Archivos |
|---|---|---|---|---|
| T-056d | ≈365 | ≈1.100 | **d1** cálculo + reserva + fallback + `invalido` + timeout (≈340 de código, ≈360 de tests) · **d2** decisión ACEPTAR/ESPERAR (≈180 + ≈200) · **d3** concurrencia en Docker (≈120, ya escrito en CP2) | `orquestacion-calculo.ts`, `orquestacion-decision.ts`, `+ .test.ts` |
| T-056e | ≈275 | ≈825 | **e1** handler de sugerencia (≈140 + ≈180) · **e2** handler de decisión + contratos compartidos (≈120 + ≈150) | `src/api/asignaciones.ts` partido por handler |
| T-056f | ≈195 | ≈585 | **f1** rutas + `route-error-mapper` (≈120 + ≈150) · **f2** matriz RBAC + consistencia (≈60 + ≈180) | `src/app/api/asignaciones/**/route.ts`, `authorization.ts` |
| T-056g | ≈390 | ≈1.170 | **g1** gancho best-effort en `evaluarYRegistrarAcceso` + tests (≈90 + ≈200) · **g2** adaptador de sesión + tests (≈180 + ≈300) · **g3** cableado del adaptador en las rutas de sesión (≈80 + ≈120) | `integracion-asignaciones.ts`, `sesion-asignaciones.ts` |

**Regla de escritura (obligatoria desde CP3)**: medir con `wc -l` cada archivo nuevo apenas se crea. Si un
archivo va a superar **≈350 líneas**, se parte por responsabilidad **antes** de seguir escribiendo; no se
parte después. Los cortes de la tabla son el punto de partida, no una autorización para pasarse.

**Presupuesto de commit**: con estas cifras ningún commit puede superar 400 líneas, así que cada sub-tarea
(d1, d2, e1, e2, f1, f2, g1, g2, g3) es **un commit**. Si alguna supera 450 en la medición, se reporta antes
de partirla otra vez.

### Cortes declarados si un slice supera 400 líneas

| Slice | Corte | Razón |
|---|---|---|
| T-056a | **T-056a1** (`prisma/schema.prisma` + las dos migraciones + el test de integración ≈206) → **T-056a2** (dominio de configuración + lector único + panel + fixtures ≈222) | La medición real dio **428** líneas frente a las ≈240 estimadas; los tests de panel y el archivo de integración pesan más de lo previsto. Ambos bajo CP1 y cada uno queda bajo 400. |
| T-056c | **T-056c1** (lecturas de ocupantes/cola/P-67/vencimiento) → **T-056c2** (escrituras + advisory lock + tests de `escrituras`) | El repositorio es el slice más denso; el corte natural es lectura vs. escritura. Ambos quedan bajo CP2b. |
| T-056d | **T-056d1** (orquestación: cálculo, reserva, fallback, `invalido`, timeout, decisión) → **T-056d2** (prueba de concurrencia en Docker) | La prueba de concurrencia es un archivo aparte y se puede commitear después de la orquestación unitaria. Ambos bajo CP3. |
| T-056g | **T-056g1** (gancho de check-in + `acceso-asignacion.test.ts`) → **T-056g2** (adaptador de sesión + `sesion-asignaciones.test.ts`) | El corte natural es el archivo `integracion-asignaciones.ts`. Ambos bajo CP4c. |

En los tres casos, si se aplica el corte, se usan los IDs con sufijo `1`/`2` y se informa en el commit;
no se renumera el resto del plan.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| T-056a | Esquema, dos migraciones aditivas y los tres parámetros de configuración con panel | commit CP1 | `npm test -- src/domains/configuracion/configuracion.test.ts src/lib/configuracion.test.ts src/app/configuracion/page.test.tsx` | `npm run test:integration` (Docker) + `docker exec`/`psql` | Revertir el commit; si la migración se aplicó, ejecutar el rollback comentado |
| T-056b | Puerto/DTO y lecturas base del repositorio | commit CP2a | `npm test -- src/domains/asignacion/asignacion-repositorio.test.ts` | N/A — Prisma mockeado; sin base | Revertir el commit; el archivo y su test desaparecen; nada los importa |
| T-056c | Entrada del motor (ocupantes frescos/cola/P-67/vencimiento), escrituras, lock y cascada de ejercicio | commit CP2b | ídem + `npm run test:integration` | `npm run test:integration` (Docker) | Revertir el commit; la tabla queda; nadie la lee |
| T-056d | Orquestación, fallback, timeout y concurrencia | commit CP3 | `npm test -- src/domains/asignacion/orquestacion.test.ts` + `npm run test:integration` | `npm run test:integration -- --keep` (Docker, sin pooler) | Revertir el commit; el servicio desaparece; el repositorio queda sin llamante |
| T-056e | Handlers de sugerencia y decisión | commit CP4a | `npm test -- src/api/asignaciones.test.ts` | N/A — handlers puros; servicio mockeado | Revertir el commit; el handler desaparece; ninguna ruta lo importa |
| T-056f | Rutas, matriz RBAC y mapeo de errores | commit CP4b | `npm test -- src/app/api/asignaciones src/lib/authorization.test.ts src/lib/route-error-mapper.test.ts` | `npm run dev` + `curl` 401/403/200 | Revertir el commit; las rutas y los permisos vuelven al estado previo |
| T-056g | Gancho de check-in y adaptador de sesión | commit CP4c | `npm test -- src/api/acceso-asignacion.test.ts src/domains/sesion/sesion-asignaciones.test.ts` | `npm run dev` + `curl` de check-in + `psql` | Revertir el commit; el check-in y la sesión vuelven al comportamiento actual |

## Resumen de slices

| Task ID | Slice | CP | Archivos | LOC est. | Depende de | Verificación | Rollback |
|---|---|---|---|---|---|---|---|
| **T-056a** | Esquema, migraciones, configuración y panel | CP1 | `prisma/schema.prisma` (modificado), `prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql` (nuevo), `prisma/migrations/20261026120500_asignacion_configuracion/migration.sql` (nuevo), `src/domains/configuracion/configuracion.ts` (modificado), `src/lib/configuracion.ts` (modificado), `src/app/configuracion/page.tsx` (modificado), tests de configuración/panel (modificados), `tests/integration/configuracion-asignacion.integration.test.ts` (nuevo) | ≈240 | — | `npm test -- <tests>`; `npm run test:integration`; `npx tsc --noEmit`; `npx eslint <archivos>`; `npx prisma migrate diff` | Revertir el commit; rollback SQL comentado si la migración se aplicó |
| **T-056b** | Repositorio: puerto, DTO y lecturas base | CP2a | `src/domains/asignacion/asignacion-repositorio.ts` (nuevo), `src/domains/asignacion/asignacion-repositorio.test.ts` (nuevo) | ≈370 | T-056a | `npm test -- src/domains/asignacion/asignacion-repositorio.test.ts`; `npx tsc --noEmit`; `npx eslint <archivo>`; guardianes | Revertir el commit; el archivo y su test desaparecen; nada los importa |
| **T-056c** | Entrada del motor, ocupantes frescos, cola, P-67, vencimiento, escrituras y lock | CP2b | `src/domains/asignacion/asignacion-repositorio.ts` (modificado), `src/domains/asignacion/asignacion-repositorio.test.ts` (modificado), `tests/integration/asignacion-persistencia.integration.test.ts` (nuevo) | ≈395 | T-056b | `npm test -- src/domains/asignacion/asignacion-repositorio.test.ts`; `npm run test:integration`; `npx tsc --noEmit`; `npx eslint <archivos>` | Revertir el commit; la tabla y las columnas quedan; el código viejo no las lee |
| **T-056d** | Orquestación: lock, transacción, cálculo, reserva, fallback, timeout, decisión y concurrencia | CP3 | `src/domains/asignacion/orquestacion.ts` (nuevo), `src/domains/asignacion/orquestacion.test.ts` (nuevo), `tests/integration/asignacion-orquestacion.integration.test.ts` (nuevo; el de lock de CP2 es `asignacion-concurrencia.integration.test.ts`) | ≈365 | T-056c | `npm test -- src/domains/asignacion/orquestacion.test.ts`; `npm run test:integration`; `npx tsc --noEmit`; `npx eslint <archivos>` | Revertir el commit; el servicio desaparece; el repositorio queda sin llamante |
| **T-056e** | Handlers HTTP de sugerencia y decisión | CP4a | `src/api/asignaciones.ts` (nuevo), `src/api/asignaciones.test.ts` (nuevo) | ≈275 | T-056d | `npm test -- src/api/asignaciones.test.ts`; `npx tsc --noEmit`; `npx eslint <archivos>` | Revertir el commit; el handler desaparece; ninguna ruta lo importa todavía |
| **T-056f** | Rutas `/api/asignaciones/*`, matriz RBAC y error mapper | CP4b | `src/app/api/asignaciones/sugerencia/route.ts` (nuevo), `src/app/api/asignaciones/decidir/route.ts` (nuevo), `src/app/api/asignaciones/sugerencia/route.test.ts` (nuevo), `src/app/api/asignaciones/decidir/route.test.ts` (nuevo), `src/lib/authorization.ts` (modificado), `src/lib/authorization.test.ts` (modificado), `src/lib/route-error-mapper.ts` (modificado), `src/lib/route-error-mapper.test.ts` (modificado) | ≈195 | T-056e | `npm test -- src/app/api/asignaciones src/lib/authorization.test.ts src/lib/route-error-mapper.test.ts src/lib/authorization-consistency.test.ts`; `npx tsc --noEmit`; `npx eslint <archivos>` | Revertir el commit; rutas, matriz y mapper vuelven al estado previo |
| **T-056g** | Gancho de check-in y adaptador de sesión | CP4c | `src/api/acceso.ts` (modificado), `src/api/acceso-asignacion.test.ts` (nuevo), `src/domains/sesion/integracion-asignaciones.ts` (nuevo), `src/domains/sesion/sesion-de-entrenamiento.ts` (modificado), `src/domains/sesion/sesion-asignaciones.test.ts` (nuevo) | ≈390 | T-056f | `npm test -- src/api/acceso-asignacion.test.ts src/domains/sesion/sesion-asignaciones.test.ts`; `npm test`; `npm run test:integration`; `npx tsc --noEmit`; `npx eslint <archivos>` | Revertir el commit; el gancho y el adaptador desaparecen; la sesión y el check-in vuelven al comportamiento actual |

## task_breakdown

### T-056a · Esquema, migraciones, configuración y panel (CP1)

**Objetivo**: materializar la tabla `AsignacionDeEjercicio` y las tres columnas de configuración con
migraciones aditivas escritas a mano, y exponer `segundosEjecucionSerie` (60, 1–3600),
`minutosVencimientoReserva` (15, 0–1440) y `minutosInactividadSesion` (30, 1–1440) en el lector único, la
validación y el panel `/configuracion`. Al cerrar la tarea, `npm run test:integration` aplica las
migraciones desde cero y las columnas/tabla existen en Docker. No se toca código del motor ni se agrega
seed. El caso de borrado en cascada del ejercicio no se prueba acá: aterriza en la integración de T-056c.

**Archivos**:
- `prisma/schema.prisma` (modificado): enum `EstadoAsignacion`, modelo `AsignacionDeEjercicio` y las
  cuatro relaciones inversas en `Socio`, `Ejercicio`, `Maquina` y `SesionDeEntrenamiento`.
- `prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql` (nuevo).
- `prisma/migrations/20261026120500_asignacion_configuracion/migration.sql` (nuevo).
- `src/domains/configuracion/configuracion.ts` (modificado): tres entradas al final de
  `CAMPOS_CONFIGURACION`.
- `src/lib/configuracion.ts` (modificado): interfaz `Configuracion`, `CONFIGURACION_POR_DEFECTO` y
  `normalizarFila`.
- `src/app/configuracion/page.tsx` (modificado): grupo “Motor de espera”, etiquetas y `aFormulario`.
- `src/domains/configuracion/configuracion.test.ts` (modificado).
- `src/lib/configuracion.test.ts` (modificado).
- `src/app/configuracion/page.test.tsx` (modificado).
- `tests/integration/configuracion-asignacion.integration.test.ts` (nuevo).
- `src/lib/configuracion.guard.test.ts` (read-only, debe seguir verde).

**TDD paso a paso**:

1. - [ ] **RED — configuración de dominio.** Agregar a `src/domains/configuracion/configuracion.test.ts`
   los casos de los tres campos y ejecutar `npm test -- src/domains/configuracion/configuracion.test.ts`.
   Debe fallar porque `CAMPOS_CONFIGURACION` todavía no tiene las claves (el test de “14 campos” recibe
   11 y los casos nuevos devuelven “Campo desconocido”).
   - Renombrar `"declara los 11 campos esperados"` a `"declara los 14 campos esperados"` y exigir el
     orden final: `..., enfriamientoOfertaDias, segundosEjecucionSerie, minutosVencimientoReserva,
     minutosInactividadSesion`.
   - `"acepta segundosEjecucionSerie en los bordes 1 y 3600"` → `{ ok: true, cambios: { segundosEjecucionSerie: 1 } }`
     y `{ ok: true, cambios: { segundosEjecucionSerie: 3600 } }`.
   - `"rechaza segundosEjecucionSerie 0"` → `{ ok: false, message: "segundosEjecucionSerie debe estar entre 1 y 3600" }`.
   - `"rechaza segundosEjecucionSerie 3601"` → el mismo mensaje.
   - `"rechaza segundosEjecucionSerie 60.5"` → `{ ok: false, message: "segundosEjecucionSerie debe ser un número entero" }`.
   - `"acepta minutosVencimientoReserva 0 y 1440"` → `0` (vencimiento inmediato) y `1440` son válidos.
   - `"rechaza minutosVencimientoReserva -1 y 1441"` → `{ ok: false, message: "minutosVencimientoReserva debe estar entre 0 y 1440" }`.
   - `"rechaza minutosVencimientoReserva NaN, Infinity y string"` → `{ ok: false, message: "minutosVencimientoReserva debe ser un número" }`
     para `NaN`, `Infinity` y `"15"`.
   - `"acepta minutosInactividadSesion 1 y 1440"` → `{ ok: true, cambios: { minutosInactividadSesion: 1 } }`
     y `{ ok: true, cambios: { minutosInactividadSesion: 1440 } }`.
   - `"rechaza minutosInactividadSesion 0, -1 y 1441"` → `{ ok: false, message: "minutosInactividadSesion debe estar entre 1 y 1440" }`.
   - `"rechaza minutosInactividadSesion 30.5, NaN, Infinity y string"` → `{ ok: false, message: "minutosInactividadSesion debe ser un número entero" }`
     para `30.5` y `{ ok: false, message: "minutosInactividadSesion debe ser un número" }` para `NaN`,
     `Infinity` y `"30"`.
2. - [ ] **GREEN — configuración de dominio.** Agregar al final de `CAMPOS_CONFIGURACION`:
   `segundosEjecucionSerie: { tipo: "entero", min: 1, max: 3600 }`,
   `minutosVencimientoReserva: { tipo: "entero", min: 0, max: 1440 }` y
   `minutosInactividadSesion: { tipo: "entero", min: 1, max: 1440 }` (design §10). No se agregan
   mensajes nuevos: el validador existente ya produce los textos exactos.
3. - [ ] **RED — lector único.** En `src/lib/configuracion.test.ts`, actualizar el test de defaults y
   agregar los casos de los tres campos; ejecutar `npm test -- src/lib/configuracion.test.ts`. Debe
   fallar porque la interfaz y los defaults no incluyen los campos (TypeScript y valores `undefined`).
   - `"sin fila devuelve los valores por defecto de siempre"` → el objeto esperado suma
     `segundosEjecucionSerie: 60`, `minutosVencimientoReserva: 15` y `minutosInactividadSesion: 30`.
   - `"con fila devuelve sus valores y convierte el porcentaje Decimal a number"` → agregar al fixture
     `segundosEjecucionSerie: 90`, `minutosVencimientoReserva: 30` y `minutosInactividadSesion: 45`; el
     `toEqual` esperado incluye `90`, `30` y `45` (sin este ajuste, el nuevo default haría fallar el
     test existente).
   - `"normaliza por campo los tres parámetros del motor"` → fila con `segundosEjecucionSerie: 90`,
     `minutosVencimientoReserva: 30` y `minutosInactividadSesion: 45`; el resultado devuelve `90`, `30`
     y `45`.
   - `"si faltan los tres parámetros del motor, usa 60, 15 y 30"` → fila sin esos campos; resultado
     `60`, `15` y `30`.
   - `"un cambio de los tres parámetros del motor deja antes/despues de los tres"` →
     `actualizarConfiguracion({ segundosEjecucionSerie: 90, minutosVencimientoReserva: 30,
     minutosInactividadSesion: 45 }, "admin-1")` escribe un `RegistroDeAuditoria` con
     `segundosEjecucionSerie: { antes: 60, despues: 90 }`,
     `minutosVencimientoReserva: { antes: 15, despues: 30 }` y
     `minutosInactividadSesion: { antes: 30, despues: 45 }` en la misma transacción.
4. - [ ] **GREEN — lector único.** En `src/lib/configuracion.ts`: agregar los tres campos a `Configuracion`,
   `CONFIGURACION_POR_DEFECTO` (`60`, `15`, `30`) y `normalizarFila`
   (`fila?.segundosEjecucionSerie ?? d.segundosEjecucionSerie`, idem para los otros dos).
   `actualizarConfiguracion` no cambia: recorre `Object.keys(CONFIGURACION_POR_DEFECTO)` y ya audita los
   campos nuevos.
5. - [ ] **RED — panel.** En `src/app/configuracion/page.test.tsx`, actualizar `configBase` con
   `segundosEjecucionSerie: 60`, `minutosVencimientoReserva: 15` y `minutosInactividadSesion: 30`;
   renombrar `"renderiza los 11 campos una vez cargada"` a `"renderiza los 14 campos una vez cargada"`;
   ampliar `"agrupa los campos con sus títulos"` para exigir “Motor de espera”; agregar
   `"valida en el cliente segundosEjecucionSerie = 0"` (muestra el rango y no llama a la API),
   `"valida en el cliente minutosInactividadSesion = 0"` y
   `"guarda minutosInactividadSesion = 45 y notifica el éxito"` (payload
   `{ minutosInactividadSesion: 45 }`). Ejecutar
   `npm test -- src/app/configuracion/page.test.tsx`. Debe fallar porque el grupo y las etiquetas no
   existen.
6. - [ ] **GREEN — panel.** Agregar a `GRUPOS`
   `{ titulo: "Motor de espera", campos: ["segundosEjecucionSerie", "minutosVencimientoReserva",
   "minutosInactividadSesion"] }`; a `ETIQUETAS` `"Duración de la serie (segundos)"`,
   `"Vencimiento de la reserva (minutos)"` e `"Inactividad de sesión (minutos)"`; a `aFormulario`
   `String(config.segundosEjecucionSerie)`, `String(config.minutosVencimientoReserva)` y
   `String(config.minutosInactividadSesion)`. El render, la validación cliente y `handleApiError` se
   reutilizan (design §10).
7. - [ ] **RED — esquema y migraciones.** Escribir
   `tests/integration/configuracion-asignacion.integration.test.ts` y ejecutar
   `npm run test:integration`. Debe fallar por la razón correcta: la tabla
   `"AsignacionDeEjercicio"` y las columnas `"segundosEjecucionSerie"`/`"minutosVencimientoReserva"`/
   `"minutosInactividadSesion"` todavía no existen (`relation does not exist` / `column does not exist`).
   - `"aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"` → en
     `information_schema.tables` existe `AsignacionDeEjercicio`; `pg_indexes` tiene exactamente los
     índices `AsignacionDeEjercicio_socioId_estado_venceEn_idx`,
     `AsignacionDeEjercicio_maquinaId_estado_creadaEn_idx`,
     `AsignacionDeEjercicio_sesionId_idx` y `AsignacionDeEjercicio_ejercicioId_idx`;
     `pg_constraint` tiene las cuatro FKs con `CASCADE`, `CASCADE`, `SET NULL` y `SET NULL`.
   - `"ConfiguracionDelSistema recibe 60/15/30 y conserva el resto de la fila"` → limpiar la tabla al
     inicio del test (`deleteMany`), crear una fila completa con `capacidadMaxima: 120`,
     `antiPassbackMinutos: 45`, `periodoGracia: 0`, `diasInactividad: 15` y
     `descuentoReactivacion: 0` (los campos obligatorios sin default) vía Prisma después de migrar;
     `getConfiguracion()` devuelve `120`, `45`, `60`, `15` y `30`, y el resto de los defaults.
   - `"la migración de la tabla es aditiva y no tiene DROP ni ALTER ejecutables"` → leer el archivo SQL,
     quitar las líneas de comentario y exigir 1 `CREATE TABLE`, 4 `CREATE INDEX` y 0 `DROP`/`ALTER`.
   - `"la migración de configuración es aditiva y documenta el rollback"` → el SQL contiene
     `ADD COLUMN "segundosEjecucionSerie" ... NOT NULL DEFAULT 60`,
     `ADD COLUMN "minutosVencimientoReserva" ... NOT NULL DEFAULT 15` y
     `ADD COLUMN "minutosInactividadSesion" ... NOT NULL DEFAULT 30`; al pie, comentarios con
     `DROP COLUMN IF EXISTS` para las tres.
8. - [ ] **GREEN — esquema y migraciones.** Agregar al `prisma/schema.prisma` el enum y el modelo exactos
   de design §2, más las relaciones inversas. Crear las dos carpetas de migración con el SQL textual de
   design §3. Ejecutar `npx prisma generate` (no es una migración) y `npx prisma validate`.
9. - [ ] **REFACTOR / cierre.** Sin extracciones nuevas. Revisar que ningún archivo de `src/` fuera de
   `src/lib/configuracion.ts` mencione `ConfiguracionDelSistema` (guardián de lector único) y que no se
   haya tocado `motor-espera.ts` ni `prisma/seed.ts`.

**Implementación mínima**: design §2 (modelo Prisma exacto), §3 (SQL de las dos migraciones y
verificación Docker), §10 (configuración y panel). No se agrega `actualizadaEn`, no se agrega `origen` y
no se crea índice único parcial. `src/app/api/configuracion/route.ts` **no cambia**:
`validarCambiosConfiguracion` y el mapeo de errores ya cubren los campos nuevos; la auditoría la escribe
`actualizarConfiguracion`. El caso de borrado en cascada del ejercicio aterriza en T-056c, no acá.

**Verificación**:
```bash
npx prisma generate
npx prisma validate
npm test -- src/domains/configuracion/configuracion.test.ts src/lib/configuracion.test.ts src/app/configuracion/page.test.tsx
npm run test:integration
npx tsc --noEmit
npx eslint src/domains/configuracion/configuracion.ts src/lib/configuracion.ts src/app/configuracion/page.tsx src/domains/configuracion/configuracion.test.ts src/lib/configuracion.test.ts src/app/configuracion/page.test.tsx tests/integration/configuracion-asignacion.integration.test.ts
npx prisma migrate diff --from-url "postgresql://arnold:arnold@127.0.0.1:5433/arnold_test" --to-schema-datamodel prisma/schema.prisma --exit-code
git diff --shortstat
```

`migrate diff` debe salir 0 con “No difference detected”. Si apareciera el índice de expresión
preexistente `Maquina_nombre_ubicacion_key`, primero se captura la misma salida en la rama base y se
exige que la salida posterior sea idéntica (sin líneas nuevas), según design §3.

**Punto de control (CP1)**: `npm run test:integration` verde con el archivo nuevo; `prisma validate` sin
errores; `migrate diff` sin diferencias nuevas; `git diff --shortstat` ≤400;
`src/lib/configuracion.guard.test.ts` y `src/domains/dominios-puros.guard.test.ts` verdes; ningún test
existente de configuración fue eliminado (solo se actualizaron los conteos de 11 → 14 campos).

**Smoke (CP1)**:
```bash
# 1) La suite de integración aplica las migraciones desde cero.
npm run test:integration -- --keep

# 2) La tabla y sus constraints existen en el Postgres de Docker.
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c '\d "AsignacionDeEjercicio"'
# Esperado: columnas id, socioId, ejercicioId, maquinaId, sesionId, estado, esperaSegundos,
# ahorroSegundos, creadaEn, venceEn; 4 índices; FKs a Socio (CASCADE), Ejercicio (CASCADE),
# Maquina (SET NULL) y SesionDeEntrenamiento (SET NULL); enum EstadoAsignacion con 4 valores.

# 3) Las tres columnas existen con su tipo/default, y si hay fila conserva el resto.
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c \
  "select column_name, data_type, column_default, is_nullable from information_schema.columns where table_name = 'ConfiguracionDelSistema' and column_name in ('segundosEjecucionSerie', 'minutosVencimientoReserva', 'minutosInactividadSesion') order by column_name;"
# Esperado: 3 filas, data_type = integer, column_default = 60 / 15 / 30, is_nullable = NO.
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c \
  'select "capacidadMaxima", "antiPassbackMinutos", "segundosEjecucionSerie", "minutosVencimientoReserva", "minutosInactividadSesion" from "ConfiguracionDelSistema" order by "updatedAt" desc limit 1;'
# Esperado si hay fila: capacidadMaxima y antiPassbackMinutos con los valores previos,
# segundosEjecucionSerie = 60, minutosVencimientoReserva = 15 y minutosInactividadSesion = 30. Si no
# hay fila, la consulta no devuelve registros; la existencia de las columnas ya se probó arriba.

# 4) La migración de la tabla no tiene DROP/ALTER ejecutables (solo comentarios de rollback).
grep -v '^--' prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql | grep -cE 'DROP|ALTER'
# Esperado: 0
grep -v '^--' prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql | grep -c 'CREATE TABLE'
# Esperado: 1

# 5) Prueba manual de fila existente (una vez, design §3): aplicar hasta la migración anterior,
# insertar una fila, aplicar 20261026120500 con migrate deploy y comprobar 60/15/30 conservando el resto.
```

**Rollback**: revertir el commit. Si la migración ya se aplicó a una base real y se quiere revertir la
funcionalidad, ejecutar el SQL comentado al pie de cada migración:
`ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "minutosInactividadSesion";`,
`... DROP COLUMN IF EXISTS "minutosVencimientoReserva";` y
`... DROP COLUMN IF EXISTS "segundosEjecucionSerie";`, y luego
`DROP TABLE IF EXISTS "AsignacionDeEjercicio";` + `DROP TYPE IF EXISTS "EstadoAsignacion";`. El borrado
de la tabla pierde reservas; es aceptable al revertir la etapa. Nunca borrar columnas de otras tablas.
No usar `prisma migrate dev` para revertir.

### T-056b · Repositorio: puerto, DTO y lecturas base (CP2a)

**Objetivo**: crear `src/domains/asignacion/asignacion-repositorio.ts` con los tipos del puerto, los DTO
de dominio, la carga diferida de Prisma y las lecturas deterministas base: rutina activa, candidatos,
sesión `EN_CURSO`, series de trabajo, ejercicios pendientes, máquinas del catálogo, configuración,
sugerencia vigente, última asignación, `tieneRutinaActiva` (con guarda de capacidad D-103),
`resolverSocioPorUsuario` y `existeSocio`. No implementa todavía ocupantes, cola ni escrituras (T-056c).

**Archivos**:
- `src/domains/asignacion/asignacion-repositorio.ts` (nuevo).
- `src/domains/asignacion/asignacion-repositorio.test.ts` (nuevo).
- `src/domains/asignacion/motor-espera.ts` (read-only; solo se importan sus tipos).
- `src/lib/configuracion.ts` (read-only; se consumen `getConfiguracion` y `ConfiguracionReader`).

**TDD paso a paso**:

1. - [ ] **RED — contrato del puerto y DTO.** Escribir el primer bloque de
   `src/domains/asignacion/asignacion-repositorio.test.ts` con un cliente Prisma falso y ejecutar
   `npm test -- src/domains/asignacion/asignacion-repositorio.test.ts`. Debe fallar porque
   `AsignacionRepository` no existe. Los primeros casos fijan las lecturas base:
   - `"sin rutina activa devuelve null y no consulta candidatos"` →
     `leerEntradaMotor({ socioId: "socio-1", ahora: AHORA, minutosInactividadSesion: 30, excluirEjercicioIds: [] })` devuelve `null`;
     `ejercicioMaquina.findMany` no fue llamado.
   - `"lee la rutina activa ordenada por orden e id"` → `rutinaAsignada.findFirst` recibe
     `{ where: { socioId: "socio-1", activa: true }, orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }], select: ... }`
     y el DTO devuelve `E1` (orden 1, 2 series, descanso 90) y `E2` (orden 2, 1 serie, descanso 60).
   - `"mapea candidatos por ejercicio en orden estable"` → filas `E2/M1`, `E1/M2`, `E1/M1`;
     `E1.candidatos = ["M1", "M2"]`, `E2.candidatos = ["M1"]`; la consulta usa
     `orderBy: [{ ejercicioId: "asc" }, { maquinaId: "asc" }]`.
2. - [ ] **GREEN — tipo y esqueleto.** Crear el archivo con los tipos exactos de design §6
   (`EjercicioDeRutinaLeido`, `RutinaActivaLeida`, `EntradaLeida`, `SugerenciaVigenteLeida`,
   `UltimaAsignacionLeida`, `NuevaReserva`, `LecturaEntrada`, `AsignacionTx`, `AsignacionPort`,
   `AsignacionDb`), la clase `AsignacionRepository`, el cliente inyectable y
   `await import("@/lib/db")` como default. Solo `import type` de `@prisma/client`; ningún import
   estático de `@/lib/db` (design §1 y guardián de dominios puros). En este slice la clase implementa
   solo las lecturas base y **no** declara `implements AsignacionPort` (declararía métodos aún
   inexistentes y no compilaría); usa una interfaz base `AsignacionLecturasBase`. T-056c agrega las
   escrituras, `enTransaccionBloqueada` y recién ahí declara `implements AsignacionPort`.
3. - [ ] **RED — pendientes y series de trabajo.** Agregar los casos y ejecutar; deben fallar porque la
   lógica de pendientes todavía no existe.
   - `"sin sesión en curso todos los ejercicios están pendientes"` → `[E1, E2]`.
   - `"con sesión en curso descuenta solo series de trabajo dentro de la prescripción"` → E1 con
     2 series prescritas y registros `CALENTAMIENTO` (`numeroSerie: null`), `DROP_SET`
     (`numeroSerie: null`) y `NORMAL` con `numeroSerie: 1`; E2 pendiente → `[E2]`.
   - `"excluye el ejercicio actual y los excluidos explícitos"` → sesión `EN_CURSO` con
     `ejercicioActualId: "E1"`, `excluirEjercicioIds: ["E2"]` → `ejercicios` de la entrada `[]`.
   - `"una serie fuera de 1..prescripcion.series no descuenta"` → prescripción 2 con registros
     `NORMAL` 1, 2 y 3 → E1 sigue pendiente.
   - `"los registros con tipo NORMAL sin numeroSerie no cuentan"` → `numeroSerie: null` no descuenta.
4. - [ ] **GREEN — pendientes.** Implementar la sesión `EN_CURSO` (design §6 pasos 3–4) y el conteo
   `seriesHechas` con `tipo IN ("NORMAL", "HASTA_EL_FALLO")` y
   `1 <= numeroSerie <= prescripcion.series`. Los pendientes se ordenan por `orden asc, id asc` y se
   filtran por `excluirEjercicioIds ∪ {sesion.ejercicioActualId}` (design §6 paso 5).
5. - [ ] **RED — máquinas, configuración y sugerencia.** Agregar los casos y ejecutar; deben fallar por
   lecturas ausentes.
   - `"incluye solo máquinas candidatas existentes en el catálogo"` → unión `M1, M2, M9`; el catálogo
     devuelve `M1` y `M2`; la entrada tiene exactamente `M1` y `M2` con su `estado` leído.
   - `"usa segundosEjecucionSerie de la configuración, no un literal"` → configuración 90 →
     `entrada.parametros.segundosEjecucionSerie === 90`.
   - `"lee la sugerencia vigente más reciente y descarta vencidas"` → dos filas, una con
     `venceEn: 09:59:59` y otra con `venceEn: 10:15`; `ahora = 10:00`; devuelve la segunda con
     `ejercicioNombre` y `maquinaNombre` resueltos; la consulta usa `estado: "RESERVADA"`,
     `venceEn: { gt: ahora }`, `maquinaId: { not: null }`,
     `orderBy: [{ creadaEn: "desc" }, { id: "desc" }]`, `take: 2`.
   - `"si hay dos sugerencias vigentes devuelve la primera y loguea la anomalía"` → `take: 2` devuelve
     dos; el resultado es la primera y `console.error` fue llamado con `[ASIGNACION][anomalia]`.
   - `"sin sugerencia vigente devuelve null"`.
   - `"lee la última asignación por creadaEn desc"` → devuelve
     `{ estado: "CANCELADA", creadaEn: 09:00 }`.
   - `"las lecturas son repetibles y no llaman al motor"` → dos llamadas con el mismo `ahora` producen
     `toEqual`; no se invoca `calcularEspera`; no hay `Date.now`/`new Date()` en el archivo (se valida
     con `grep` en la verificación).
6. - [ ] **GREEN — lecturas restantes.** Implementar las máquinas (design §6 paso 6), la configuración
   (`getConfiguracion` sobre el cliente o `tx`, design §6 paso 9), la sugerencia vigente (paso 10), la
   última asignación y los DTO con nombres. Registrar la anomalía de dos sugerencias con
   `console.error("[ASIGNACION][anomalia]", { socioId, tipo: "sugerencias-multiples" })`.
7. - [ ] **RED — guarda de capacidad y puente usuario→socio.** Agregar los casos y ejecutar; deben
   fallar porque la guarda no existe.
   - `"tieneRutinaActiva devuelve false sin capability y no abre transacción"` → cliente falso sin
     `asignacionDeEjercicio`; resultado `false`; `$transaction` no fue llamado (D-103).
   - `"tieneRutinaActiva consulta la rutina activa con capability"` → cliente con
     `asignacionDeEjercicio.findFirst`; `rutinaAsignada.findFirst` devuelve una fila → `true`.
   - `"resolverSocioPorUsuario devuelve el socio del usuario o null"` → `socio.findUnique` con
     `where: { usuarioId: "usuario-1" }`, `select: { id: true }`; devuelve `"socio-1"` o `null`.
   - `"existeSocio distingue existente de inexistente"`.
8. - [ ] **GREEN — guarda y puente.** `tieneRutinaActiva` comprueba primero
   `asignacionDeEjercicio.findFirst` (design §6 paso 0); si no está, devuelve `false` sin lanzar y sin
   abrir transacción. Implementar `resolverSocioPorUsuario` y `existeSocio` sobre `socio.findUnique`.
9. - [ ] **REFACTOR / cierre.** Extraer un helper solo si el archivo supera ≈300 líneas; no es el caso.
   Verificar que no haya `any`, `@ts-ignore` ni un import estático de `@/lib/db`; que el archivo no
   mencione `ConfiguracionDelSistema`; y que `motor-espera.ts` no figure en el diff.

**Implementación mínima**: design §6 (tipos del puerto y pasos 0–6, 9–10). No se implementan ocupantes,
cola, vencimiento de cola ni escrituras: son T-056c. No se agrega caché ni estado global.

**Verificación**:
```bash
npm test -- src/domains/asignacion/asignacion-repositorio.test.ts
npm test -- src/domains/dominios-puros.guard.test.ts src/lib/configuracion.guard.test.ts
npx tsc --noEmit
npx eslint src/domains/asignacion/asignacion-repositorio.ts src/domains/asignacion/asignacion-repositorio.test.ts
grep -c '^import .*@/lib/db' src/domains/asignacion/asignacion-repositorio.ts   # → 0 (solo await import)
grep -c 'ConfiguracionDelSistema' src/domains/asignacion/asignacion-repositorio.ts  # → 0
grep -c 'Date\.now\|new Date()' src/domains/asignacion/asignacion-repositorio.ts    # → 0
git diff --shortstat
```

**Punto de control (CP2a)**: el test del repositorio verde con los casos de rutina, candidatos,
pendientes, máquinas, configuración, sugerencia y guarda D-103; guardianes de dominios puros y lector
único verdes; `tsc` y `eslint` limpios en los archivos nuevos; 0 `any`; `git diff --shortstat` ≤400.

**Smoke (CP2a)**: no hay base ni pantalla que mirar. La evidencia es la salida de
`npm test -- src/domains/asignacion/asignacion-repositorio.test.ts` con todos los casos verdes y los
guardianes verdes. El smoke con base real es el CP2b (T-056c).

**Rollback**: revertir el commit. Desaparecen `asignacion-repositorio.ts` y su test; ningún otro archivo
los importa todavía (la orquestación llega en T-056d). La tabla y las columnas de T-056a quedan sin uso.

### T-056c · Entrada del motor, ocupantes, cola, P-67, vencimiento, escrituras y lock (CP2b)

**Objetivo**: completar `leerEntradaMotor` con los ocupantes derivados y frescos, la cola de terceros
(design §6 pasos 7–8), la exclusión P-67, el vencimiento perezoso y las lecturas de sugerencia; y
completar el repositorio con las escrituras transaccionales y el advisory lock global
(`enTransaccionBloqueada`), de modo que T-056d tenga el puerto completo. Al cerrar la tarea, la suite de
integración prueba la tabla, las FKs (incluido el borrado en cascada del ejercicio), la ocupación con
corte de inactividad, la cola, P-67, el vencimiento y la atomicidad.

**Archivos**:
- `src/domains/asignacion/asignacion-repositorio.ts` (modificado).
- `src/domains/asignacion/asignacion-repositorio.test.ts` (modificado).
- `tests/integration/asignacion-persistencia.integration.test.ts` (nuevo).
- `src/domains/asignacion/motor-espera.ts` (read-only).

**TDD paso a paso**:

1. - [ ] **RED — ocupantes.** Agregar el bloque `describe("ocupantes")` y ejecutar
   `npm test -- src/domains/asignacion/asignacion-repositorio.test.ts`. Debe fallar porque la entrada
   todavía no deriva ocupantes.
   - `"una candidata única sin fila deriva ocupante"` → sesión `EN_CURSO` de otro socio con
     `ejercicioActualId: "E1"`, E1 con una única candidata `M1`, prescripción 3 y un `NORMAL` con
     `numeroSerie: 1` → `M1.ocupante = { seriesRestantes: 2, descanso: 90 }`.
   - `"varias candidatas sin fila no aportan ocupante"` → E1 con `M1` y `M2` → ambos `ocupante: null`.
   - `"una fila EN_CURSO con la máquina y ejercicio actuales fija el ocupante"` → la máquina sale de la
     fila `EN_CURSO`, no de las candidatas; `seriesRestantes` se calcula con la rutina de esa sesión.
   - `"más de una fila EN_CURSO usa la más reciente y loguea"` → dos filas para la misma sesión; gana la
     de `creadaEn` mayor; `console.error("[ASIGNACION][anomalia]", { tipo: "ejecuciones-multiples" })`.
   - `"seriesRestantes ignora CALENTAMIENTO y DROP_SET"` → prescripción 3, registros `CALENTAMIENTO`,
     `NORMAL` 1 y `DROP_SET` → `2`.
   - `"ocupante con 0 restantes no ocupa"` → tres `NORMAL` (1, 2, 3) con prescripción 3 → no aparece.
   - `"numeroSerie fuera de 1..series no descuenta"` → prescripción 2, `NORMAL` 1, 2, 3 → `0` → no
     aparece.
   - `"el descanso del ocupante sale de su EjercicioEnRutina"` → ocupante con descanso 90 y consultante
     con descanso 30 → `M1.ocupante.descanso === 90`.
   - `"sesión con actividad de 31 min no ocupa con ventana 30"` → último registro hace 31 minutos,
     `minutosInactividadSesion: 30`, `ahora` fijo → `M1.ocupante === null`.
   - `"sesión con actividad de 29 min ocupa con ventana 30"` → último registro hace 29 minutos → ocupante
     con `seriesRestantes` normal.
   - `"sin registros usa horaInicio fresca"` y `"sin registros usa horaInicio vieja"` → `horaInicio` hace
     10 minutos ocupa; hace 31 minutos no ocupa.
   - `"la sesión vieja no aporta si hay una fresca"` → dos sesiones sobre `M1`, una sin actividad
     reciente y otra fresca → solo la fresca es ocupante.
   - `"fila EN_CURSO con actividad de 31 min no ocupa"` y `"fila EN_CURSO con actividad de 29 min ocupa"`
     → actividad derivada del último registro de su `sesionId`.
   - `"fila EN_CURSO sin registros usa creadaEn"` → `creadaEn` hace 10 minutos ocupa; hace 31 no.
   - `"actividad exactamente en el corte cuenta"` → último registro exactamente hace 30 minutos con
     ventana 30 → ocupante (`>=`).
2. - [ ] **GREEN — ocupantes.** Implementar el paso 7 de design §6: sesiones `EN_CURSO` de otros socios,
   fila `EN_CURSO` por sesión, derivación por candidata única cuando no hay fila, prescripción desde
   `sesion.rutinaAsignada.rutina` (D-101), `seriesRestantes` con el filtro de trabajo y exclusión si es
   `< 1` (D-87). Aplicar la vigencia D-105 a ambas fuentes: actividad = último `RegistroDeProgreso` o
   `horaInicio`/`creadaEn`; corte = `ahora − minutosInactividadSesion × 60 000 ms`; comparación `>=`.
   No se escribe `Maquina.estado` y no se lee el reloj.
3. - [ ] **RED — cola, vencimiento y P-67.** Agregar los bloques `describe("cola")` y
   `describe("P-67")` y ejecutar; deben fallar porque la cola no existe.
   - `"cola ordenada por creadaEn e id"` → R1 (09:00), R2 (09:05), R3 (09:05 con id mayor); el orden es
     R1, R2, R3; cada miembro aporta sus `series` y su `descanso`.
   - `"reserva vencida no aporta a la cola"` → fila con `venceEn: 09:59:59`, `ahora: 10:00` → ausente.
   - `"reserva no resoluble a rutina activa no aporta y loguea"` → el socio de la reserva no tiene
     rutina activa; ausente; `console.error("[ASIGNACION][anomalia]", { tipo: "reserva-sin-rutina" })`.
   - `"P-67: la propia reserva no es ocupante ni cola"` → el socio consultante tiene una `RESERVADA`
     sobre `M1`; `M1` no lo tiene como ocupante y su reserva no está en la cola. Si se quita
     `socioId: { not: socioActual }`, este test falla (dejar el comentario en el test).
   - `"P-67: la propia ejecución EN_CURSO no ocupa"` → el socio consultante tiene una fila `EN_CURSO`
     sobre `M1`; `M1.ocupante` no es él.
   - `"venceEn == ahora está vencida; 1 s antes vigente"` → `leerSugerenciaVigente` devuelve `null` con
     `ahora: 10:00:00` y la fila con `venceEn: 10:00:00`; con `ahora: 09:59:59` la devuelve.
   - `"la sugerencia vigente no recalcula espera ni ahorro"` → la fila guarda `120/60`; aunque cambie
     el estado de otra máquina, la lectura sigue devolviendo `120/60`.
4. - [ ] **GREEN — cola y vencimiento.** Implementar el paso 8 de design §6: `RESERVADA` no vencidas de
   otros socios sobre las máquinas candidatas, `orderBy creadaEn asc, id asc`, prescripción resuelta en
   la rutina activa del miembro (D-101 para ocupantes; rutina activa para la cola) y exclusión P-67 en
   todas las consultas de ocupantes y cola. Una fila no resoluble no aporta y se loguea. El vencimiento
   es una condición de lectura (`venceEn > ahora`); la fila vencida conserva `estado = RESERVADA`.
5. - [ ] **RED — escrituras y lock.** Agregar el bloque `describe("escrituras")` y ejecutar; debe fallar
   porque los métodos no existen.
   - `"cancelarReservasActivas filtra RESERVADA no vencida y devuelve count"` → `updateMany` con
     `where: { socioId: "socio-1", estado: "RESERVADA", venceEn: { gt: AHORA } }`,
     `data: { estado: "CANCELADA" }`; devuelve `1`.
   - `"crearReserva escribe snapshot y venceEn exactos"` → `create` recibe
     `{ socioId: "socio-1", ejercicioId: "E1", maquinaId: "M1", esperaSegundos: 120,
     ahorroSegundos: 60, creadaEn: AHORA, venceEn: 10:15 }`; devuelve `{ id: "a-1" }`. No envía
     `sesionId` (nulo hasta `EN_CURSO`).
   - `"consumirReserva usa updateMany con guard de estado y vencimiento"` → `where` con `id`,
     `estado: "RESERVADA"`, `venceEn: { gt: AHORA }`; `data` con `estado: "EN_CURSO"` y `sesionId`;
     `count: 1` → `true`, `count: 0` → `false`.
   - `"cancelarReserva usa updateMany con guard"` → misma guarda; `data: { estado: "CANCELADA" }`;
     `count: 0` → `false`.
   - `"completarEjecucion solo toca EN_CURSO"` → `where: { sesionId, ejercicioId, estado: "EN_CURSO" }`,
     `data: { estado: "COMPLETADA" }`.
   - `"completarEjecucionesDeSesion completa todas las EN_CURSO"` → `where: { sesionId, estado: "EN_CURSO" }`.
   - `"crearEjecucionEnCurso escribe 0/0, sesionId y venceEn = ahora"` → `create` con
     `estado: "EN_CURSO"`, `maquinaId` (`"M1"` o `null`), `esperaSegundos: 0`, `ahorroSegundos: 0`,
     `creadaEn: AHORA`, `venceEn: AHORA`. `venceEn = ahora` porque la columna es NOT NULL y el
     vencimiento solo aplica a `RESERVADA`; se documenta en una línea de comentario.
   - `"updateMany con guard no toca una fila COMPLETADA"` → el `where` de `consumirReserva` incluye
     `estado: "RESERVADA"`; con una fila `COMPLETADA`, `count = 0` y no se escribe (AC-404).
   - `"enTransaccionBloqueada toma pg_advisory_xact_lock con $queryRaw antes de la función"` → el
     cliente falso registra `$queryRaw` con el template que contiene `pg_advisory_xact_lock` y el valor
     `880000001`; el callback recibe un `AsignacionTx`; `$executeRaw` no se usa.
   - `"enTransaccionBloqueada pasa maxWait 1000 y timeout 2000"`.
   - `"enTransaccionBloqueada propaga el error"` → el callback lanza; la promesa rechaza; no se
     silencia.
6. - [ ] **GREEN — escrituras y lock.** Implementar las escrituras con `updateMany` guardado, el create
   de la reserva y de la ejecución, y `enTransaccionBloqueada` con `$transaction` interactivo,
   `maxWait: 1000`, `timeout: 2000` y `$queryRaw` con la sentencia
   `SELECT pg_advisory_xact_lock(${CLAVE_LOCK_INSTALACION}::bigint)` (design §5 y §6). **No**
   `$executeRaw`: el engine de Prisma rechaza consultas que devuelven filas.
7. - [ ] **RED — integración de persistencia.** Escribir
   `tests/integration/asignacion-persistencia.integration.test.ts` y ejecutar
   `npm run test:integration`. Debe fallar por la razón correcta: la lógica de ocupación/cola/escritura
   todavía no existe (o la tabla no está, si se corre antes de T-056a).
   - `"persiste RESERVADA con snapshot y no cambia Maquina.estado"` → `M1` `DISPONIBLE` antes y después;
     la fila guarda `120/60`, `creadaEn` y `venceEn` exactos.
   - `"una sola reserva activa por socio tras cancelar y crear"` → R1 `CANCELADA`, R2 `RESERVADA`.
   - `"consumirReserva fija sesionId y estado EN_CURSO"`.
   - `"completarEjecucion no toca una fila ya COMPLETADA"` → `count = 0`; la fila sigue `COMPLETADA`.
   - `"vencimiento perezoso: una fila venceEn <= ahora no es sugerencia vigente y sigue RESERVADA"`.
   - `"P-67: dos socios con reservas sobre M1 no se ven entre sí como cola propia"` → al leer la entrada
     del socio A, su propia reserva no aparece en la cola ni como ocupante; la de B sí aparece.
   - `"ocupante real con calentamiento y drop set"` → sesión y registros reales; `seriesRestantes = 2`.
   - `"sesión EN_CURSO vieja no ocupa y la fresca sí"` → `horaInicio`/último registro a 31 y 29 minutos
     con `minutosInactividadSesion = 30`; la vieja se ignora y la espera sale solo de la fresca.
   - `"fila EN_CURSO sin registros usa creadaEn y respeta el corte"` → `creadaEn` a 10 y 31 minutos; solo
     la fresca ocupa.
   - `"borrar ejercicio sin progreso ni rutina elimina sus asignaciones"` → un ejercicio con una
     `AsignacionDeEjercicio` y sin `RegistroDeProgreso` ni `EjercicioEnRutina`; `prisma.ejercicio.delete`
     elimina sus asignaciones y el ejercicio sin P2003 (AC-416, D-106).
   - `"reserva de otro socio sin rutina activa no aporta cola"` → la rutina se desactiva; la fila no
     aparece; se registra la anomalía.
   - `"cola ordenada por creadaEn, id en la base real"`.
   - Fixtures: crear las filas mínimas (`Usuario`, `Socio`, `Ejercicio`, `Maquina`, `EjercicioMaquina`,
     `Rutina`, `RutinaAsignada`, `SesionDeEntrenamiento`) con emails/DNI únicos y limpiar en orden
     inverso de FK. No se agrega un seed global.
8. - [ ] **GREEN — integración.** Ajustar lo mínimo para que la suite real pase. No se agregan seeds ni
   fixtures globales: cada test crea y limpia sus filas, siguiendo el patrón de
   `tests/integration/ejercicio.integration.test.ts`.
9. - [ ] **REFACTOR / cierre.** Extraer helpers de consulta solo si el archivo supera ≈350 líneas; no se
   duplican filtros P-67 ni el conteo de series. Verificar 0 `any`, 0 import estático de `@/lib/db`,
   0 `Maquina.estado = "OCUPADA"` y que `motor-espera.ts` no figure en el diff.

**Implementación mínima**: design §5 (lock) y §6 pasos 7–8 más las firmas de escritura de `AsignacionTx`.
La prescripción del ocupante sale de la rutina de su sesión (D-101); la de la cola, de la rutina activa
del miembro. La vigencia se aplica con D-105 a sesiones y filas `EN_CURSO`; la FK `ejercicioId` es
`CASCADE` (D-106) y su borrado se prueba en la integración. El vencimiento no reescribe filas. No se
implementa limpieza batch (P-69).

**Verificación**:
```bash
npm test -- src/domains/asignacion/asignacion-repositorio.test.ts
npm run test:integration
npx tsc --noEmit
npx eslint src/domains/asignacion/asignacion-repositorio.ts src/domains/asignacion/asignacion-repositorio.test.ts tests/integration/asignacion-persistencia.integration.test.ts
grep -c '\$executeRaw' src/domains/asignacion/asignacion-repositorio.ts   # → 0
grep -c 'OCUPADA' src/domains/asignacion/asignacion-repositorio.ts        # → 0
git diff --shortstat
```

**Punto de control (CP2b)**: unit del repositorio verde con ocupantes frescos, cola, P-67, vencimiento y
escrituras; `npm run test:integration` verde con el archivo de persistencia, incluido el borrado en
cascada del ejercicio; `tsc`/`eslint` limpios; `git diff --shortstat` ≤400 (si no, aplicar
T-056c1/T-056c2 ya declarado).

**Smoke (CP2b)**:
```bash
npm run test:integration -- --keep
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c '\d "AsignacionDeEjercicio"'
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c \
  'select estado, "esperaSegundos", "ahorroSegundos", "creadaEn", "venceEn" from "AsignacionDeEjercicio" order by "creadaEn" desc limit 5;'
# Esperado: filas con 0/0 (ejecuciones por orden de rutina) o con la instantánea del motor (reservas);
# ninguna fila con estado VENCIDA (no existe en el enum); Maquina.estado sin OCUPADA.
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c 'select estado, count(*) from "Maquina" group by 1;'
# Esperado: ningún grupo OCUPADA agregado por esta suite.
```
La suite de integración es la prueba principal; los `select` son evidencia visual y pueden no encontrar
filas si los tests limpiaron sus datos.

**Rollback**: revertir el commit. La tabla y las columnas quedan; el código viejo no las lee. El
repositorio vuelve a T-056b y la orquestación todavía no existe (llega en T-056d).

### T-056d · Orquestación: lock, transacción, cálculo, reserva, fallback, timeout, decisión y concurrencia (CP3) — ✅ **completo**

> Estado: T-056d1a (camino feliz), T-056d1b (fallback, inválido, errores y timeout), T-056d2a
> (`decidirSugerencia` y `reservaVigente`), T-056d2b (`calcularSinReservar`, `calcularEnCheckIn` y
> pasarelas) y T-056d3 (concurrencia contra Postgres) están implementados y verdes. La prueba de
> concurrencia vive en `asignacion-orquestacion.integration.test.ts`; el archivo de CP2
> (`asignacion-concurrencia.integration.test.ts`) cubre el lock y su liberación, sin duplicarse.

**Objetivo**: crear `src/domains/asignacion/orquestacion.ts` con `calcularYReservar`,
`calcularSinReservar`, `decidirSugerencia`, `reservaVigente`, `calcularEnCheckIn`,
`resolverSocioDeUsuario`, `existeSocio` y la pasarela `tieneRutinaActiva` que necesita la API para
AC-481. El servicio usa el puerto completo de T-056c, contiene todos los errores y timeouts, nunca llama
a `Date.now()` y no importa Prisma. La prueba de concurrencia corre contra Docker.

**Archivos**:
- `src/domains/asignacion/orquestacion.ts` (nuevo).
- `src/domains/asignacion/orquestacion.test.ts` (nuevo).
- `tests/integration/asignacion-orquestacion.integration.test.ts` (nuevo; el de lock de CP2 es `asignacion-concurrencia.integration.test.ts`).
- `src/domains/asignacion/asignacion-repositorio.ts` (read-only desde este slice; se consume su puerto).
- `src/domains/asignacion/motor-espera.ts` (read-only).

**TDD paso a paso**:

1. - [ ] **RED — cálculo y persistencia.** Escribir los primeros casos de `orquestacion.test.ts` con un
   puerto falso que registra llamadas y el motor real inyectado; ejecutar
   `npm test -- src/domains/asignacion/orquestacion.test.ts`. Debe fallar porque `calcularYReservar` no
   existe.
   - `"calcula y persiste la instantánea exacta del motor"` → motor `exito` con
     `recomendado = { ejercicioId: "E2", maquinaId: "M2", espera: 120 }`, `ahorro: 60`; configuración
     `minutosVencimientoReserva: 15` y `minutosInactividadSesion: 30`; `ahora = 2026-10-25T10:00:00Z` →
     `crearReserva` recibe
     `esperaSegundos: 120`, `ahorroSegundos: 60`, `creadaEn: 10:00`, `venceEn: 10:15`; el resultado es
     `{ tipo: "reservada", ejercicioId: "E2", maquinaId: "M2", esperaSegundos: 120,
     ahorroSegundos: 60, venceEn: 10:15 }`.
   - `"cancela la reserva anterior antes de crear la nueva en la misma transacción"` → el registro de
     llamadas demuestra `cancelarReservasActivas` antes de `crearReserva`, ambas dentro de
     `enTransaccionBloqueada`; `enTransaccionBloqueada` recibe `{ maxWait: 1000, timeout: 2000 }`.
   - `"usa el ahora inyectado para creadaEn y venceEn"` → con `ahora = 10:00` y 30 minutos,
     `creadaEn = 10:00` y `venceEn = 10:30`.
   - `"pasa ahora y minutosInactividadSesion al plan de lectura"` → con `minutosInactividadSesion: 30`,
     `leerEntradaMotor` recibe `ahora` y `30`; el repositorio no lee el reloj.
   - `"defaults 60/15/30 cuando la configuración no tiene fila"`.
2. - [ ] **GREEN — cálculo y persistencia.** Implementar la forma exacta de design §7: gate
   `tieneRutinaActiva`, `enTransaccionBloqueada`, lectura de configuración, `leerEntradaMotor` con
   `minutosInactividadSesion` inyectado, motor inyectado, validación de pertenencia de la recomendación a
   la rutina y a las candidatas, cálculo de `venceEn`, cancelación y `crearReserva`. `conTimeout` con
   `TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS` (2000 + 250).
3. - [ ] **RED — fallback, inválido y errores.** Agregar los casos y ejecutar; deben fallar porque esas
   ramas no existen.
   - `"sin rutina activa no abre transacción ni invoca el motor"` → `tieneRutinaActiva` false;
     `enTransaccionBloqueada` no llamado; motor no llamado; resultado
     `{ tipo: "fallback", motivo: "SIN_RUTINA" }`.
   - `"sin_opciones cancela la anterior y no crea fila, sin error"` → resultado
     `{ tipo: "fallback", motivo: "SIN_OPCIONES" }`; `cancelarReservasActivas` llamado; `crearReserva`
     no; `console.error` no llamado.
   - `"vacio cancela la anterior y no crea fila"` → `{ tipo: "fallback", motivo: "VACIO" }`.
   - `"maquinaId null cancela la anterior y no crea fila"` → `{ tipo: "fallback", motivo: "SIN_MAQUINA" }`.
   - `"invalido no cancela ni crea y loguea contexto"` → `{ tipo: "contenido", motivo: "INVALIDO" }`;
     `console.error` con `socioId`, `momento` y `errores`; `cancelarReservasActivas`/`crearReserva` no
     llamados.
   - `"recomendación fuera de la rutina se trata como invalido"` → el motor devuelve `E9/M9` que no
     pertenece a la rutina; `INVALIDO`; sin escrituras.
   - `"la máquina recomendada debe ser candidata del ejercicio"` → `E1/M9` no candidata → `INVALIDO`.
   - `"un error del repositorio se contiene como ERROR y no propaga"` → `enTransaccionBloqueada` rechaza
     → `{ tipo: "contenido", motivo: "ERROR" }`; no lanza.
   - `"timeout devuelve contenido TIMEOUT y no lanza"` → el trabajo nunca resuelve; con timers falsos se
     avanzan 2250 ms → `{ tipo: "contenido", motivo: "TIMEOUT" }`; `console.error` de timeout.
   - `"segundosEjecucionSerie = 0 se contiene como invalido"` → `leerConfiguracion` devuelve
     `segundosEjecucionSerie: 0`; el motor real devuelve `invalido`; resultado
     `{ tipo: "contenido", motivo: "INVALIDO" }`; no se cancela ni se crea ninguna fila.
4. - [ ] **GREEN — fallback e inválido.** Implementar el orden de ramas de design §7:
   `SIN_RUTINA` → `invalido` → `sin_opciones`/`vacio` → `maquinaId null` → validación de pertenencia →
   cancelar + crear. `invalido` y `ERROR` no escriben. El fallback cancela la activa anterior y no crea.
5. - [ ] **RED — decisión, lectura informativa y pasarelas.** Agregar los casos y ejecutar; deben fallar
   porque las funciones no existen.
   - `"ACEPTAR no escribe y es idempotente"` → `decidirSugerencia` con reserva vigente devuelve
     `{ tipo: "aceptada", reserva }`; `cancelarReserva` no llamado; dos llamadas devuelven el mismo
     `id` y `venceEn`.
   - `"ESPERAR cancela la reserva vigente"` → `cancelarReserva` devuelve `true`; resultado
     `{ tipo: "esperada" }`.
   - `"ESPERAR sobre una reserva que venció entre lectura y escritura devuelve YA_NO_VIGENTE"` →
     `cancelarReserva` devuelve `false`; resultado `{ tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" }`.
   - `"sin sugerencia y sin historial devuelve NUNCA_EXISTIO"`.
   - `"sin sugerencia con última RESERVADA devuelve YA_NO_VIGENTE"` → `leerUltimaAsignacion` con
     `estado: "RESERVADA"`, `creadaEn: 09:00`; `ahora: 10:00`; resultado `YA_NO_VIGENTE`.
   - `"sin sugerencia con CANCELADA dentro de la ventana devuelve YA_NO_VIGENTE"` → `creadaEn: 10:00`,
     `ahora: 10:10`, `minutosVencimientoReserva: 15`.
   - `"sin sugerencia con CANCELADA fuera de la ventana devuelve NUNCA_EXISTIO"` → `creadaEn: 09:00`,
     `ahora: 10:00`, `minutosVencimientoReserva: 15`.
   - `"calcularSinReservar devuelve el siguiente con nombre y no escribe"` → motor `exito` con
     `siguienteEnOrden = { ejercicioId: "E2", maquinaId: "M2", espera: 60 }`; devuelve
     `{ ejercicioId: "E2", ejercicioNombre: "Sentadilla", maquinaId: "M2", esperaSegundos: 60 }`; no
     llama a `crearReserva`/`cancelarReservasActivas`.
   - `"calcularSinReservar degrada a null ante invalido o error"`.
   - `"calcularEnCheckIn no lanza si el motor falla"` → motor o puerto que lanza; la función resuelve
     `void` y loguea; no se propaga la excepción.
   - `"tieneRutinaActiva delega en el puerto"` → devuelve lo mismo que `repositorio.tieneRutinaActiva`.
   - `"resolverSocioDeUsuario y existeSocio delegan en el puerto"`.
6. - [ ] **GREEN — decisión y pasarelas.** Implementar design §7: `decidirSugerencia` bajo el mismo
   lock, `ACEPTAR` sin escritura, `ESPERAR` con `updateMany` guardado, regla 404/409 de D-102;
   `calcularSinReservar` sin lock y sin escritura; `calcularEnCheckIn` con `try/catch`; las pasarelas
   `tieneRutinaActiva`, `resolverSocioDeUsuario` y `existeSocio`. Esta última es la adición mínima que
   exige AC-481 en la API (design §11 la nombra pero §7 no la lista); se documenta con una línea.
7. - [ ] **RED — concurrencia en Docker.** Escribir
   `tests/integration/asignacion-concurrencia.integration.test.ts` y ejecutar
   `npm run test:integration`. Debe fallar si el lock no está o si la cancelación/inserción no es
   atómica.
   - `"dos check-in concurrentes sobre M1 crean una reserva por socio y una espera > 0"` → dos socios
     con rutina activa y una única máquina `M1` candidata; `Promise.all` de dos `calcularYReservar` con
     el mismo `ahora`; exactamente dos `RESERVADA` sobre `M1`, una por socio; ningún socio con dos
     activas; exactamente una respuesta con `esperaSegundos > 0`; el orden leído coincide con
     `orderBy(creadaEn asc, id asc)`.
   - `"dos recálculos del mismo socio dejan una sola activa"` → una `RESERVADA`; la otra `CANCELADA`.
   - `"cancelar y lanzar revierte la cancelación"` → dentro de `enTransaccionBloqueada` se cancela y se
     lanza; la reserva anterior sigue `RESERVADA` y no hay fila nueva.
   - Fixtures: dos `Usuario`/`Socio` con email/DNI únicos, dos `RutinaAsignada` activas sobre la misma
     `Maquina M1`, con un ejercicio candidato cada una. Limpiar en orden inverso de FK; no se agrega un
     seed global.
8. - [ ] **GREEN — concurrencia.** Ajustar el uso de `enTransaccionBloqueada` y el `ahora` compartido.
   La transacción debe abarcar lectura, cálculo, cancelación y escritura (design §5). No se usa
   `$executeRaw`; el lock va con `$queryRaw` (T-056c).
9. - [ ] **REFACTOR / cierre.** Verificar que `orquestacion.ts` no importe Prisma ni `@/lib/db`; que no
   use `Date.now()`/`new Date()`; que no escriba `Maquina.estado`; que `motor-espera.ts` no figure en el
   diff; y que `TIMEOUT_CALCULO_MS = 2000` y `MARGEN_RESPUESTA_MS = 250` sean constantes exportadas.

**Implementación mínima**: design §7 completo (formas exactas de `calcularYReservar`, `conTimeout`,
`decidirSugerencia`, `calcularSinReservar`) y §5 para la concurrencia. No se agrega un servicio
`recalcularTrasSesion`: el adaptador de sesión (T-056g) llama a `calcularYReservar` con
`momento: "INICIO_RUTINA"` o `"POST_EJERCICIO"`. No se implementa `after()` (D-100).

**Verificación**:
```bash
npm test -- src/domains/asignacion/orquestacion.test.ts
npm run test:integration
npx tsc --noEmit
npx eslint src/domains/asignacion/orquestacion.ts src/domains/asignacion/orquestacion.test.ts tests/integration/asignacion-concurrencia.integration.test.ts
grep -c '@prisma/client\|@/lib/db' src/domains/asignacion/orquestacion.ts   # → 0
grep -c 'Date\.now\|new Date()' src/domains/asignacion/orquestacion.ts      # → 0
git diff --shortstat
```

**Punto de control (CP3)**: unit de orquestación verde con cálculo, fallback, inválido, timeout,
decisión y pasarelas; la prueba de concurrencia verde contra Docker; `tsc`/`eslint` limpios;
`git diff --shortstat` ≤400 (si no, aplicar T-056d1/T-056d2).

**Smoke (CP3)**:
```bash
npm run test:integration -- --keep
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c \
  'select "socioId", count(*) filter (where estado = ''RESERVADA'' and "venceEn" > now()) as activas from "AsignacionDeEjercicio" group by 1;'
# Esperado: como máximo 1 activa por socio.
docker exec -it arnold-test-db psql -U arnold -d arnold_test -c \
  'select count(*) from "AsignacionDeEjercicio" where estado = ''RESERVADA'' and "maquinaId" = ''M1'';'
# Esperado en la prueba de dos socios: 2 (una por socio).
```
La evidencia principal es la salida de la suite de concurrencia: dos reservas sobre `M1`, una por
socio, y una sola con `esperaSegundos > 0`.

**Rollback**: revertir el commit. `orquestacion.ts` y su suite desaparecen; el repositorio de T-056c
queda sin llamante y la tabla permanece. El check-in y la sesión todavía no lo usan (T-056g).

### T-056e · Handlers HTTP de sugerencia y decisión (CP4a)

> **Partición**: **e1** (GET, pasos 1–4) ✅ **completo** — `handleObtenerSugerencia` con 13 tests.
> **e2** (POST, pasos 5–7) ✅ **completo** — `handleDecidirSugerencia` con 17 tests, incluidas las tres
> formas de D-109. Los tests se separaron por verbo (`asignaciones.test.ts` y
> `asignaciones.post.test.ts`) para no pasar el tope de un archivo.

**Objetivo**: crear `src/api/asignaciones.ts` con `handleObtenerSugerencia` y
`handleDecidirSugerencia`, los DTO y la regla fina de propiedad/rol, usando la orquestación y el mapeo de
errores compartido. No conoce `NextRequest`; no importa Prisma; no escribe en el `GET`.

**Archivos**:
- `src/api/asignaciones.ts` (nuevo).
- `src/api/asignaciones.test.ts` (nuevo).
- `src/domains/asignacion/orquestacion.ts` (read-only; se mockea en el test).
- `src/lib/route-error-mapper.ts` (read-only en este slice; las dos ramas llegan en T-056f).

**TDD paso a paso**:

1. - [ ] **RED — GET propio y sin rutina.** Escribir el primer bloque de `src/api/asignaciones.test.ts`
   con `jest.mock("@/domains/asignacion/orquestacion")` y ejecutar
   `npm test -- src/api/asignaciones.test.ts`. Debe fallar porque el handler no existe.
   - `"socio con sugerencia vigente recibe 200 con la fila y el siguiente"` → `resolverSocioDeUsuario`
     devuelve `"socio-1"`; `tieneRutinaActiva` true; `reservaVigente` devuelve
     `{ id: "a-1", ejercicioId: "E1", ejercicioNombre: "Press banca", maquinaId: "M1",
     maquinaNombre: "Banco 1", esperaSegundos: 120, ahorroSegundos: 60, creadaEn: 10:00,
     venceEn: 10:15 }`; `calcularSinReservar` devuelve `{ ejercicioId: "E2", ejercicioNombre:
     "Sentadilla", maquinaId: "M2", esperaSegundos: 60 }`; `ahora = 10:05` → status 200 y body
     `{ socioId: "socio-1", sugerencia: { asignacionId: "a-1", ejercicioId: "E1", ...,
     creadaEn: "2026-10-25T10:00:00.000Z", venceEn: "2026-10-25T10:15:00.000Z" },
     siguienteEnOrden: { ... }, calculadoEn: "2026-10-25T10:05:00.000Z" }`.
   - `"socio sin sugerencia vigente recibe 200 con sugerencia null y siguiente"` → `reservaVigente`
     devuelve `null`; `calcularSinReservar` devuelve `E2`; status 200, `sugerencia: null`.
   - `"socio sin rutina activa recibe 200 con sugerencia null y siguiente null aunque exista una fila RESERVADA"` →
     `tieneRutinaActiva` false; `reservaVigente` no llamado; ambos campos `null`.
   - `"el GET no escribe"` → el mock de orquestación no recibe llamadas de escritura; se repite dos
     veces y el body es igual.
2. - [ ] **GREEN — GET.** Implementar `handleObtenerSugerencia` con `resolverSocioDeUsuario` para
   SOCIO, `existeSocio` para ADMIN/INSTRUCTOR, `tieneRutinaActiva`, `reservaVigente` y
   `calcularSinReservar`; `calculadoEn = ahora.toISOString()`; DTO con `toISOString()` y `null`
   explícito (design §11).
3. - [ ] **RED — propiedad, roles y errores del GET.** Agregar los casos y ejecutar; deben fallar porque
   la validación no existe.
   - `"SOCIO con socioId en la query recibe 403 aunque sea el propio"` → `socioIdQuery: "socio-1"` →
     status 403, `code: "FORBIDDEN"`, mensaje `"No tiene permiso para realizar esta acción"`; no se
     llama al servicio.
   - `"SOCIO inexistente recibe 404 Socio no encontrado"` → `resolverSocioDeUsuario` devuelve `null`.
   - `"ADMIN sin socioId recibe 400 VALIDATION_ERROR"` y `"ADMIN con socioId vacío recibe 400"`.
   - `"ADMIN con socio inexistente recibe 404 NOT_FOUND"` → `existeSocio` false.
   - `"ADMIN consulta a un socio existente y recibe 200"`.
   - `"INSTRUCTOR consulta a un socio existente y recibe 200"`.
   - `"si calcularSinReservar falla, responde 200 con siguiente null y loguea"`.
   - `"un error inesperado del servicio devuelve 500 SERVER_ERROR"` → `reservaVigente` rechaza; body
     `{ code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" }`.
4. - [ ] **GREEN — propiedad y errores.** Implementar la regla exacta de design §11: SOCIO deriva el
   socio de la sesión y prohíbe `socioId` (aunque sea el propio); ADMIN/INSTRUCTOR exigen `socioId` y
   verifican existencia; `calcularSinReservar` se degrada a `null` con log; los errores usan
   `mapErrorToResponse`.
5. - [ ] **RED — POST.** Agregar los casos y ejecutar; deben fallar porque el handler no existe.
   - `"ACEPTAR devuelve 200 con la misma reserva y el mismo venceEn"` → `decidirSugerencia` devuelve
     `{ tipo: "aceptada", reserva }`; `calcularSinReservar` devuelve `E2`; body
     `{ accion: "ACEPTAR", sugerencia: { ... mismo id y venceEn },
     siguienteEnOrden: { ejercicioId: "E2", ejercicioNombre: "Sentadilla", maquinaId: "M2",
     esperaSegundos: 60 } }`.
   - `"ACEPTAR repetido es idempotente"` → dos llamadas con el mismo resultado; `decidirSugerencia`
     llamado dos veces; no hay `id` nuevo.
   - `"ESPERAR devuelve 200 con sugerencia null"` → `{ tipo: "esperada" }`.
   - `"sin sugerencia nunca existió devuelve 404 SIN_SUGERENCIA"` → `NUNCA_EXISTIO`; body
     `{ code: "SIN_SUGERENCIA", message: "No hay una sugerencia vigente" }`.
   - `"sugerencia vencida devuelve 409 SIN_SUGERENCIA_VIGENTE"` → `YA_NO_VIGENTE`; body
     `{ code: "SIN_SUGERENCIA_VIGENTE", message: "La sugerencia ya no está vigente; vuelva a consultar" }`.
   - `"body con maquinaId devuelve 400 VALIDATION_ERROR"`, `"body con socioId devuelve 400"`,
     `"body con accion ELEGIR devuelve 400"`, `"body no objeto devuelve 400"` y
     `"body con accion ausente devuelve 400"`.
   - `"rol distinto de SOCIO recibe 403 FORBIDDEN"`.
   - `"el socio sale de la sesión; el body no puede elegir socio"`.
   - `"un fallo de persistencia devuelve 500 SERVER_ERROR sin detalles"` cubre **tres** formas de
    entrada, todas → 500 con mensaje genérico y sin exponer detalles internos (D-109):
    (a) `decidirSugerencia` resuelve `{ tipo: "contenido", motivo: "ERROR" }`;
    (b) `decidirSugerencia` rechaza con un mensaje interno;
    (c) `decidirSugerencia` resuelve `{ tipo: "contenido", motivo: "TIMEOUT" }`.
   - `"siguienteEnOrden se calcula después de la decisión y se degrada a null si falla"`.
   - `"la respuesta no expone estado, sesionId ni datos internos"` → `sugerencia` no tiene `estado` ni
     `sesionId`; los timestamps son ISO 8601 y los ausentes son `null` explícito.
6. - [ ] **GREEN — POST.** Implementar el body estricto (solo `accion`, exactamente `"ACEPTAR"` o
   `"ESPERAR"`), el socio desde la sesión, la delegación en `decidirSugerencia` y el mapeo 404/409
   (D-102). El handler mapea `contenido` (ERROR/TIMEOUT) a 500 y **no** lo confunde con 404/409
   (D-109). El fallo de `calcularSinReservar` no rompe el 200.
7. - [ ] **REFACTOR / cierre.** Verificar que `src/api/asignaciones.ts` no importe Prisma, no use `any`,
   no exponga `estado`/`sesionId` y que los DTO tengan timestamps ISO 8601.

**Implementación mínima**: design §11 (firmas, matriz de permisos, regla fina, contrato de respuesta y
tabla de errores). No se agregan endpoints, ni UI, ni un campo para elegir máquina. El handler no conoce
`NextRequest`.

**Verificación**:
```bash
npm test -- src/api/asignaciones.test.ts
npx tsc --noEmit
npx eslint src/api/asignaciones.ts src/api/asignaciones.test.ts
grep -c '@prisma/client\|@/lib/db' src/api/asignaciones.ts   # → 0
git diff --shortstat
```

**Punto de control (CP4a)**: test de handlers verde con GET/POST, propiedad, roles, 404/409 y
degradación; `tsc`/`eslint` limpios; sin Prisma en la capa API; `git diff --shortstat` ≤400.

**Smoke (CP4a)**: no hay ruta todavía; la evidencia es `npm test -- src/api/asignaciones.test.ts` con
los 200/400/403/404/409/500 y los DTO exactos. El smoke HTTP es el CP4b/CP4c.

**Rollback**: revertir el commit. El handler y su test desaparecen; ninguna ruta lo importa todavía. La
orquestación y el repositorio quedan intactos.

### T-056f · Rutas `/api/asignaciones/*`, matriz RBAC y error mapper (CP4b) — ✅ **completo**

> **Partición**: **f1** ✅ matriz (SOCIO GET+POST, INSTRUCTOR GET, ADMINISTRADOR GET explícito que
> recorta el comodín, RECEPCIONISTA sin entrada) + `SIN_SUGERENCIA` (404) y
> `SIN_SUGERENCIA_VIGENTE` (409) en el mapper. **f2** ✅ rutas `sugerencia` (GET) y `decidir` (POST)
> con 401/403, `readJsonBody` y propagación literal del status/body. Consistencia matriz↔handlers verde
> sin `EXCEPCIONES` nuevas.

**Objetivo**: exponer los dos handlers como rutas de Next con sesión, parseo y envelope HTTP; agregar la
entrada `/api/asignaciones` a la matriz de permisos con la forma exacta de D-99; y agregar al
`route-error-mapper` las ramas `SIN_SUGERENCIA` (404) y `SIN_SUGERENCIA_VIGENTE` (409). El test de
consistencia matriz/handlers debe seguir verde sin excepciones nuevas.

**Archivos**:
- `src/app/api/asignaciones/sugerencia/route.ts` (nuevo).
- `src/app/api/asignaciones/decidir/route.ts` (nuevo).
- `src/app/api/asignaciones/sugerencia/route.test.ts` (nuevo).
- `src/app/api/asignaciones/decidir/route.test.ts` (nuevo).
- `src/lib/authorization.ts` (modificado).
- `src/lib/authorization.test.ts` (modificado).
- `src/lib/route-error-mapper.ts` (modificado).
- `src/lib/route-error-mapper.test.ts` (modificado).
- `src/api/asignaciones.ts` (read-only; se mockea en los tests de ruta).
- `src/lib/authorization-consistency.test.ts` (read-only; debe seguir verde).

**TDD paso a paso**:

1. - [ ] **RED — ruta de sugerencia.** Escribir `src/app/api/asignaciones/sugerencia/route.test.ts` con
   `/** @jest-environment node */`, `jest.unmock("next/server")`, `jest.mock("@/lib/auth")` y
   `jest.mock("@/api/asignaciones")`, siguiendo el patrón de `src/app/api/configuracion/route.test.ts`;
   ejecutar `npm test -- src/app/api/asignaciones/sugerencia/route.test.ts`. Debe fallar porque la ruta
   no existe.
   - `"sin sesión devuelve 401"` → request sin `Authorization`; body
     `{ code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" }`.
   - `"RECEPCIONISTA recibe 403"` → `extractUserFromRequest` devuelve rol `RECEPCIONISTA`; body
     `{ code: "FORBIDDEN", ... }`.
   - `"SOCIO delega con su usuario y el ahora del servidor"` → `handleObtenerSugerencia` recibe
     `actor: { usuarioId: "usuario-1", rol: "SOCIO" }`, `socioIdQuery: null` y un `Date`; devuelve
     `{ status: 200, body: ... }` y la ruta responde 200 con ese body.
   - `"ADMIN delega con el socioId de la query"` → `socioIdQuery: "socio-2"`.
   - `"una query sin socioId llega como null"`.
   - `"un handler que devuelve 404/409/500 se propaga tal cual"` → el status y el body no se reescriben.
2. - [ ] **GREEN — ruta de sugerencia.** Implementar `GET` con
   `const ALLOWED_ROLES = ["SOCIO", "ADMINISTRADOR", "INSTRUCTOR"];`, `extractUserFromRequest` → 401,
   rol fuera → 403, `const ahora = new Date()`, parseo de `socioId` con `new URL(request.url).searchParams`
   (ausente → `null`) y `NextResponse.json(body, { status })` (design §11).
3. - [ ] **RED — ruta de decisión.** Escribir `src/app/api/asignaciones/decidir/route.test.ts` con el
   mismo patrón `node`/`jest.unmock("next/server")` y `jest.mock("@/api/asignaciones")`; ejecutar; debe
   fallar porque la ruta no existe.
   - `"sin sesión devuelve 401"`.
   - `"ADMIN recibe 403"`, `"INSTRUCTOR recibe 403"` y `"RECEPCIONISTA recibe 403"`.
   - `"un JSON malformado devuelve 400"` → `readJsonBody` responde 400 estable.
   - `"SOCIO delega el body y el ahora del servidor"` → `handleDecidirSugerencia` recibe
     `actor: { usuarioId: "usuario-1", rol: "SOCIO" }`, `body` y un `Date`; responde con el status/body
     del handler.
   - `"el handler devuelve 400/403/404/409/500 tal cual"`.
4. - [ ] **GREEN — ruta de decisión.** Implementar `POST` con
   `const ALLOWED_ROLES = ["SOCIO"];`, 401/403, `readJsonBody`, `const ahora = new Date()` y
   `NextResponse.json(body, { status })`. El handler no conoce `NextRequest`.
5. - [ ] **RED — matriz de permisos.** En `src/lib/authorization.test.ts`, agregar los casos y ejecutar
   `npm test -- src/lib/authorization.test.ts`; deben fallar porque la matriz no tiene
   `/api/asignaciones`.
   - `"SOCIO tiene GET y POST en /api/asignaciones"` → `hasRouteAccess("SOCIO", "/api/asignaciones/sugerencia", "GET").allowed === true`
     y `hasRouteAccess("SOCIO", "/api/asignaciones/decidir", "POST").allowed === true`.
   - `"ADMINISTRADOR e INSTRUCTOR solo tienen GET"` → GET `true`; POST `false`.
   - `"RECEPCIONISTA no tiene acceso"` → GET y POST `false`.
   - `"la entrada explícita de ADMINISTRADOR recorta el comodín para POST"` → POST `false`; GET `true`;
     `basePath === "/api/asignaciones"`.
   - `"la entrada de SOCIO no habilita otros métodos"` → PUT/PATCH/DELETE `false`.
6. - [ ] **GREEN — matriz.** Agregar a `ROLE_PERMISSIONS`:
   `SOCIO.paths["/api/asignaciones"] = ["GET", "POST"]`;
   `INSTRUCTOR.paths["/api/asignaciones"] = ["GET"]`;
   `ADMINISTRADOR.paths["/api/asignaciones"] = ["GET"]` (entrada explícita que recorta el comodín para
   POST); `RECEPCIONISTA` sin entrada. `matchBasePath` ya elige el prefijo más largo.
7. - [ ] **RED — error mapper.** En `src/lib/route-error-mapper.test.ts`, agregar los casos y ejecutar
   `npm test -- src/lib/route-error-mapper.test.ts`; deben fallar porque el mapper no conoce los dos
   códigos.
   - `"mapea SIN_SUGERENCIA a 404 con mensaje en español"` → error con `code: "SIN_SUGERENCIA"` y
     mensaje `"No hay una sugerencia vigente"`; `{ status: 404, code: "SIN_SUGERENCIA" }`.
   - `"mapea el prefijo SIN_SUGERENCIA sin code"` → `new Error("SIN_SUGERENCIA: No hay una sugerencia vigente")`
     → 404 con el mismo código.
   - `"mapea SIN_SUGERENCIA_VIGENTE a 409 con mensaje en español"` → 409 y
     `"La sugerencia ya no está vigente; vuelva a consultar"`.
   - `"no filtra el detalle interno en el 500"` → un error inesperado conserva
     `"No se pudo procesar la solicitud"`.
8. - [ ] **GREEN — error mapper.** Agregar dos ramas explícitas al bloque de `code` y los dos códigos a
   la regex de prefijos, con los mensajes en español de design §11. No se cambian los códigos
   existentes.
9. - [ ] **Guardia — consistencia.** Ejecutar
   `npm test -- src/lib/authorization-consistency.test.ts`. Debe quedar verde sin agregar excepciones:
   SOCIO/INSTRUCTOR/RECEPCIONISTA están alineados entre matriz y `ALLOWED_ROLES`; ADMINISTRADOR se
   saltea por el comodín en el guardián.
10. - [ ] **REFACTOR / cierre.** Verificar que las rutas no importen Prisma, que los `ALLOWED_ROLES`
    sean legibles por el guardián (literales de roles conocidos) y que no haya `any`.

**Implementación mínima**: design §11 (rutas, matriz exacta y contrato de errores) y D-99. No se agrega
un endpoint para elegir máquina ni un rol nuevo. `GET` es solo lectura; `POST` solo SOCIO.

**Verificación**:
```bash
npm test -- src/app/api/asignaciones src/lib/authorization.test.ts src/lib/route-error-mapper.test.ts src/lib/authorization-consistency.test.ts
npx tsc --noEmit
npx eslint src/app/api/asignaciones/sugerencia/route.ts src/app/api/asignaciones/decidir/route.ts src/app/api/asignaciones/sugerencia/route.test.ts src/app/api/asignaciones/decidir/route.test.ts src/lib/authorization.ts src/lib/authorization.test.ts src/lib/route-error-mapper.ts src/lib/route-error-mapper.test.ts
git diff --shortstat
```

**Punto de control (CP4b)**: tests de rutas, matriz, error mapper y consistencia verdes; `tsc`/`eslint`
limpios; `git diff --shortstat` ≤400; ningún `EXCEPCIONES` nuevo en el guardián de consistencia.

**Smoke (CP4b)**:
```bash
# Con `npm run dev` y un token de cada rol del seed:
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/asignaciones/sugerencia
# Esperado: 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN_RECEPCION" \
  http://localhost:3000/api/asignaciones/sugerencia
# Esperado: 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN_SOCIO" \
  'http://localhost:3000/api/asignaciones/sugerencia?socioId=x'
# Esperado: 403 (el SOCIO no puede enviar socioId)
curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  'http://localhost:3000/api/asignaciones/sugerencia?socioId=no-existe'
# Esperado: 404 {"code":"NOT_FOUND","message":"Socio no encontrado"}
```

**Rollback**: revertir el commit. Las rutas desaparecen; la matriz y el mapper vuelven al estado previo;
el handler de T-056e queda sin ruta. No hay cambios de datos.

### T-056g · Gancho de check-in y adaptador de sesión (CP4c) — ✅ **completo**

> **Partición**: **g1** ✅ gancho best-effort en `evaluarYRegistrarAcceso` (10 tests). **g2** ✅
> adaptador `integracion-asignaciones.ts` + `iniciarSesion` (9 tests). **g2b** ✅ consumo de la reserva
> dentro de la transacción del inicio. **g3a** ✅ `registrarSerie` (6 tests: consume la reserva, avanza
> por orden, completa la ejecución, calentamiento sin efectos, D-103). **g3b** ✅ `finalizarSesion`
> (3 tests: cierra sesión y ejecuciones en una transacción, idempotente, D-103). Flujo real contra
> Postgres en `sesion-asignaciones.integration.test.ts` (3 casos).

**Objetivo**: disparar el cálculo best-effort desde `evaluarYRegistrarAcceso` después de la transacción
de asistencia, y conectar la sesión con las asignaciones mediante
`src/domains/sesion/integracion-asignaciones.ts` y ediciones puntuales en `sesion-de-entrenamiento.ts`.
Sin asignaciones o sin los modelos nuevos, el comportamiento debe ser exactamente el actual (D-103), y
los tests existentes de acceso y sesión deben quedar verdes sin ediciones.

**Archivos**:
- `src/api/acceso.ts` (modificado): gancho después del `$transaction` de `Asistencia` + `AuditoriaAcceso`.
- `src/api/acceso-asignacion.test.ts` (nuevo; `src/api/acceso.test.ts` no se edita).
- `src/domains/sesion/integracion-asignaciones.ts` (nuevo): `esClienteConAsignaciones`, lectura de
  reserva, consumo, completado y creación de ejecución `EN_CURSO`.
- `src/domains/sesion/sesion-de-entrenamiento.ts` (modificado): `iniciarSesion`, `registrarSerie` y
  `finalizarSesion`.
- `src/domains/sesion/sesion-asignaciones.test.ts` (nuevo).
- `src/domains/sesion/sesion-de-entrenamiento.test.ts` (read-only; debe seguir verde sin ediciones).
- `src/api/acceso.test.ts` (read-only; debe seguir verde sin ediciones).
- `src/domains/asignacion/orquestacion.ts` (read-only; se mockea en los tests).

**TDD paso a paso**:

1. - [ ] **RED — gancho permitido.** Escribir `src/api/acceso-asignacion.test.ts` con
   `jest.mock("@/domains/asignacion/orquestacion")` y el Prisma en memoria de `acceso.test.ts`; ejecutar
   `npm test -- src/api/acceso-asignacion.test.ts`. Debe fallar porque `evaluarYRegistrarAcceso` no
   dispara el cálculo.
   - `"un check-in permitido dispara el cálculo una vez con el mismo ahora"` → `calcularEnCheckIn`
     recibe `{ socioId: "socio-1", ahora }` exactamente una vez; `ahora = 2026-10-25T10:00:00Z`.
   - `"el gancho usa el mismo ahora de la asistencia"` → `asistencia.create` recibió
     `fechaHora: ahora` y `calcularEnCheckIn` recibió ese mismo objeto/fecha; no se llama a
     `Date.now()`/`new Date()` en el gancho.
   - `"evaluarYRegistrarAcceso dispara el cálculo una sola vez"` → se llama a
     `evaluarYRegistrarAcceso` directamente; el mock se invoca una vez. Las rutas no agregan una
     segunda llamada; el test de `handleCheckIn` existente sigue verde.
   - `"el gancho no agrega campos a CheckInResultado"` → el resultado es `toEqual` al de un check-in
     sin cálculo (mismo `resultado`, `motivo`, `socio` y `estadoCuota`).
2. - [ ] **GREEN — gancho.** Insertar en `evaluarYRegistrarAcceso`, después del `$transaction` y antes
   del `return`, `if (permitido) { await dispararCalculoDeAsignacion({ socioId: socio.id, ahora }); }`
   con `import("@/domains/asignacion/orquestacion")` dinámico y `try/catch` que loguea
   `console.error("[ASIGNACION][check-in]", { socioId, tipo: "error-no-contenido", error })`
   (design §8). No se cambia la firma, `CheckInResultado`, `decidirAcceso`, `estadoCuotaSocio` ni la
   ventana anti-passback.
3. - [ ] **RED — best-effort y denegado.** Agregar los casos y ejecutar; deben fallar si el gancho deja
   escapar errores.
   - `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"` →
     `calcularEnCheckIn` rechaza; `asistencia.create` y `auditoriaAcceso.create` llamados una vez; el
     resultado es idéntico; el error se loguea.
   - `"si la persistencia falla, no queda reserva parcial y la respuesta no cambia"`.
   - `"un check-in denegado no dispara y no toca la reserva"` → decisión `DENEGADO`;
     `calcularEnCheckIn` no llamado; la reserva mockeada sigue intacta.
   - `"un check-in denegado por anti-passback no dispara"`.
   - `"el log no incluye datos sensibles"` → `console.error` recibe `socioId` y `tipo`; no incluye DNI ni
     PIN.
   - `"registra exactamente una Asistencia y una AuditoriaAcceso por intento"`.
4. - [ ] **GREEN — best-effort.** El `try/catch` externo del gancho captura el import y el servicio; el
   servicio ya contiene sus errores. No se revierte la asistencia. El cálculo usa el mismo `ahora`.
5. - [ ] **RED — adaptador de sesión y D-103.** Escribir `src/domains/sesion/sesion-asignaciones.test.ts`
   con un Prisma falso que incluye `asignacionDeEjercicio`, `ejercicioMaquina` y los modelos existentes;
   ejecutar `npm test -- src/domains/sesion/sesion-asignaciones.test.ts`. Debe fallar porque el
   adaptador no existe y la sesión no consume reservas.
   - `"iniciar sesión consume la reserva y fija ejercicioActualId"` → reserva `E2/M2` vigente; la sesión
     se crea con `ejercicioActualId: "E2"`, `serieActual: 1`; la fila pasa a `EN_CURSO` con `sesionId`;
     no se crea una segunda fila.
   - `"iniciar sesión sin reserva crea una fila EN_CURSO para el primer ejercicio con máquina única"` →
     `E1` con una candidata `M1`; `create` con `estado: "EN_CURSO"`, `sesionId`, `maquinaId: "M1"`,
     `esperaSegundos: 0`, `ahorroSegundos: 0`, `creadaEn: ahora`, `venceEn: ahora`.
   - `"iniciar sesión sin reserva y con varias candidatas crea la fila con maquinaId null"` → dos
     candidatas → `maquinaId: null`.
   - `"iniciar sesión con reserva vencida no la consume y usa el orden de rutina"` → `updateMany`
     devuelve `count: 0`; `ejercicioActualId = "E1"`; la reserva no se toca.
   - `"iniciar sesión con reserva cuyo ejercicio no pertenece a la rutina no la consume"`.
   - `"después de iniciar se recalcula sin romper el inicio si falla"` → se mockea
     `@/domains/asignacion/orquestacion` para que `calcularYReservar` rechace; la sesión se crea igual;
     se loguea.
6. - [ ] **GREEN — inicio de sesión.** Crear `esClienteConAsignaciones(db)` exactamente como design §9;
   leer la reserva vigente antes de la transacción; dentro de la transacción, fijar
   `ejercicioActualId = reserva?.ejercicioId ?? primero?.ejercicioId ?? null` y
   `serieActual = primero || reserva ? 1 : null`; consumir la reserva solo si su ejercicio pertenece a
   la rutina de la sesión y el guard devuelve `count === 1`; si no, usar `primero.ejercicioId`; si no hay
   reserva y el modelo está disponible, crear la fila `EN_CURSO` del primer ejercicio (`maquinaId` única
   o `null`). Después de la transacción, recalcular con `calcularYReservar` best-effort con
   `excluirEjercicioIds: []` y `momento: "INICIO_RUTINA"`.
7. - [ ] **RED — avance y fin de sesión.** Agregar los casos y ejecutar; deben fallar porque la sesión
   todavía no consume ni completa.
   - `"registrar la última serie consume la reserva del siguiente y lo fija"` → sesión en `E1` serie 2;
     reserva `E2`; al registrar la serie 2, la sesión queda `ejercicioActualId: "E2"`, `serieActual: 1`;
     la reserva pasa a `EN_CURSO`; la fila de `E1` pasa a `COMPLETADA`; no se crea otra fila para `E2`.
   - `"registrar la última serie sin reserva avanza por orden de rutina y crea la fila EN_CURSO"` →
     siguiente `E2` con una candidata `M2` → `create` con `EN_CURSO`, `M2`, `0/0`.
   - `"registrar la última serie de la última deja serieActual null y no crea fila"`.
   - `"un calentamiento no consume reserva ni recalcula"` → el `return` temprano actual se conserva; no
     se llama al adaptador ni a la orquestación.
   - `"finalizar sesión completa las EN_CURSO restantes"` → `updateMany` con `sesionId`,
     `estado: "EN_CURSO"` → `COMPLETADA`; la sesión se actualiza en la misma transacción.
   - `"finalizar sesión ya finalizada no toca asignaciones"`.
   - `"fallback sin asignaciones conserva firmas y resultados"` → cliente sin
     `asignacionDeEjercicio`/`ejercicioMaquina`: `iniciarSesion`, `registrarSerie` y `finalizarSesion` se
     comportan exactamente como hoy.
   - `"una fila EN_CURSO y una RESERVADA coexisten"` → tras avanzar, dos filas con estados distintos.
8. - [ ] **GREEN — avance y fin.** En `registrarSerie`, dentro de la transacción y cuando
   `numeroSerie >= actual.series`, leer y consumir la reserva vigente (si pertenece a la rutina) antes de
   fijar el siguiente; usar la reserva como siguiente o el orden de rutina; completar la ejecución
   terminada con `completarEjecucion`; crear la fila `EN_CURSO` del siguiente si vino por orden de
   rutina; después de la transacción, recalcular con `excluirEjercicioIds: [input.ejercicioId]` y
   `momento: "POST_EJERCICIO"`. En `finalizarSesion`, envolver la actualización y
   `completarEjecucionesDeSesion` en una transacción; si no hay modelos, mantener el camino actual.
9. - [ ] **REFACTOR / cierre.** Verificar que `esClienteConAsignaciones` sea la única guarda de
   capacidad; que `integracion-asignaciones.ts` no importe `@/lib/db` de forma estática; que
   `sesion-de-entrenamiento.ts` conserve todas las validaciones y el guard optimista; que
   `acceso.test.ts` y `sesion-de-entrenamiento.test.ts` no figuren en `git diff --name-only`; y que
   `motor-espera.ts` no figure en el diff.

**Implementación mínima**: design §8 (gancho, best-effort, por qué no `after`) y §9 (guarda D-103,
inicio, avance, fin, fallback). No se implementa una pantalla del socio ni la reasignación por
instructor. No se toca la firma pública de `evaluarYRegistrarAcceso` ni `CheckInResultado`.

**Verificación**:
```bash
npm test -- src/api/acceso-asignacion.test.ts src/domains/sesion/sesion-asignaciones.test.ts
npm test -- src/domains/sesion/sesion-de-entrenamiento.test.ts src/api/acceso.test.ts
npm test
npm run test:integration
npx tsc --noEmit
npx eslint src/api/acceso.ts src/api/acceso-asignacion.test.ts src/domains/sesion/integracion-asignaciones.ts src/domains/sesion/sesion-de-entrenamiento.ts src/domains/sesion/sesion-asignaciones.test.ts
git diff --name-only   # no debe incluir src/domains/asignacion/motor-espera.ts ni sus tests
git diff --shortstat
```

**Punto de control (CP4c)**: tests nuevos de gancho y sesión verdes; `sesion-de-entrenamiento.test.ts` y
`acceso.test.ts` verdes **sin ediciones**; `npm test` completo verde; `npm run test:integration` verde;
`tsc`/`eslint` limpios; `git diff --shortstat` ≤400 (si no, aplicar T-056g1/T-056g2).

**Smoke (CP4c)**:
```bash
# 0) Obtener $TOKEN_RECEPCION, $TOKEN_SOCIO y $TOKEN_ADMIN con POST /api/auth/login usando las
#    credenciales impresas por `npm run seed`. Usar el mismo socio con rutina activa en todos los pasos.

# 1) Con `npm run dev` y un socio del seed con rutina activa, hacer check-in por recepción.
curl -s -X POST http://localhost:3000/api/acceso/check-in \
  -H "Authorization: Bearer $TOKEN_RECEPCION" -H 'Content-Type: application/json' \
  -d '{"dni":"<DNI_DEL_SEED>","pin":"<PIN_DEL_SEED>"}'
# Esperado: 200 con el mismo CheckInResultado de siempre.

# 2) Ver la reserva creada y que la máquina no cambió a OCUPADA.
psql "$DATABASE_URL" -c \
  'select id, "socioId", "ejercicioId", "maquinaId", estado, "esperaSegundos", "ahorroSegundos", "creadaEn", "venceEn" from "AsignacionDeEjercicio" order by "creadaEn" desc limit 1;'
# Esperado: una RESERVADA, venceEn = creadaEn + 15 min (o el valor configurado).
psql "$DATABASE_URL" -c "select id, estado from \"Maquina\" where id = '<MAQUINA_RESERVADA>';"
# Esperado: el estado previo (DISPONIBLE/OCUPADA heredado), nunca escrito por esta integración.

# 3) Como SOCIO, leer la sugerencia, aceptar y esperar.
curl -s -H "Authorization: Bearer $TOKEN_SOCIO" http://localhost:3000/api/asignaciones/sugerencia
curl -s -X POST -H "Authorization: Bearer $TOKEN_SOCIO" -H 'Content-Type: application/json' \
  -d '{"accion":"ACEPTAR"}' http://localhost:3000/api/asignaciones/decidir
# Esperado: 200 con la misma reserva y el mismo venceEn.
curl -s -X POST -H "Authorization: Bearer $TOKEN_SOCIO" -H 'Content-Type: application/json' \
  -d '{"accion":"ESPERAR"}' http://localhost:3000/api/asignaciones/decidir
# Esperado: 200 con sugerencia null; la fila pasa a CANCELADA.

# 4) Iniciar sesión y avanzar; la reserva se consume y luego se completa.
# (Usar los endpoints existentes de /api/sesiones con el mismo socio.)
psql "$DATABASE_URL" -c \
  'select id, estado, "sesionId", "ejercicioId", "maquinaId" from "AsignacionDeEjercicio" order by "creadaEn" desc limit 3;'
# Esperado: EN_CURSO con sesionId al iniciar; COMPLETADA al registrar la última serie; una nueva
# RESERVADA para el siguiente si el motor la produce.
```

**Rollback**: revertir el commit. El gancho y el adaptador desaparecen; `evaluarYRegistrarAcceso`,
`iniciarSesion`, `registrarSerie` y `finalizarSesion` vuelven al comportamiento actual. La tabla, las
columnas y los endpoints de lectura/decisión pueden quedarse; el código viejo no los usa.

## Puertas de CP

### Puerta del CP1 (T-056a)

**Ejecutar**:
```bash
npx prisma validate
npm run test:integration
npm test -- src/domains/configuracion/configuracion.test.ts src/lib/configuracion.test.ts src/app/configuracion/page.test.tsx
npx tsc --noEmit
npx prisma migrate diff --from-url "postgresql://arnold:arnold@127.0.0.1:5433/arnold_test" --to-schema-datamodel prisma/schema.prisma --exit-code
```
**Resultado observable esperado**: `prisma validate` sin errores; `npm run test:integration` verde (aplica
las dos migraciones desde cero); los tests de configuración/panel verdes con 14 campos; `tsc` sin errores;
`migrate diff` sale 0 con “No difference detected” (o la misma salida base si aparece el índice de
expresión preexistente). En Docker, `\d "AsignacionDeEjercicio"` muestra la tabla, 4 índices y 4 FKs;
`ConfiguracionDelSistema` muestra `segundosEjecucionSerie = 60`, `minutosVencimientoReserva = 15` y
`minutosInactividadSesion = 30`.

**No debe ser cierto**:
- La migración de la tabla tiene `DROP` o `ALTER` ejecutables (solo se permiten en comentarios de
  rollback).
- Se tocó una tabla/columna existente más allá del `ADD COLUMN` aditivo de configuración.
- Se agregó un seed o un dato de ejemplo.
- Se modificó `src/domains/asignacion/motor-espera.ts` o sus tests.
- Se eliminó o relajó un test existente de configuración (solo se actualizaron los conteos 11 → 14).

### Puerta del CP2 (T-056b + T-056c)

**Ejecutar**:
```bash
npm test -- src/domains/asignacion/asignacion-repositorio.test.ts
npm run test:integration
npm test -- src/domains/dominios-puros.guard.test.ts src/lib/configuracion.guard.test.ts
npx tsc --noEmit
```
**Resultado observable esperado**: el repositorio lee rutina, candidatos, sesión, pendientes, máquinas,
configuración, sugerencia vigente y última asignación; deriva ocupantes frescos (D-105) y cola; excluye al
propio socio (P-67); ignora vencidas; escribe la reserva/ejecución con guardas y toma el advisory lock con
`$queryRaw`; la integración prueba la tabla, las FKs (incluida la cascada del ejercicio), la ocupación con
corte de inactividad, la cola, el vencimiento y la atomicidad. `tsc` y los guardianes verdes.

**No debe ser cierto**:
- `Maquina.estado = OCUPADA` se escribe en cualquier camino.
- Una reserva vencida aporta a la cola o se devuelve como sugerencia vigente.
- La cola incluye las filas del propio socio.
- El repositorio tiene un import estático de `@/lib/db`, menciona `ConfiguracionDelSistema` o usa `any`.
- `enTransaccionBloqueada` usa `$executeRaw` en lugar de `$queryRaw`.
- Las lecturas llaman a `Date.now()` o a `new Date()`.

### Puerta del CP3 (T-056d)

**Ejecutar**:
```bash
npm test -- src/domains/asignacion/orquestacion.test.ts
npm run test:integration
npx tsc --noEmit
```
**Resultado observable esperado**: la orquestación persiste la instantánea exacta (`esperaSegundos`,
`ahorroSegundos`, `creadaEn`, `venceEn`), cancela la anterior y crea la nueva en la misma transacción,
pasa `ahora` y `minutosInactividadSesion` al plan de lectura, aplica fallback silencioso en
`sin_opciones`/`vacio`/`maquinaId null`, contiene `invalido`/`ERROR`/`TIMEOUT` sin lanzar, decide
`ACEPTAR`/`ESPERAR` con D-102 y la prueba de concurrencia deja como máximo una `RESERVADA` no vencida por
socio.

**No debe ser cierto**:
- Un `invalido`, `ERROR` o `TIMEOUT` cancela o crea reservas.
- Un fallback silencioso se loguea como error de servidor.
- Dos recálculos concurrentes del mismo socio dejan dos `RESERVADA` activas.
- La prueba de concurrencia corre contra el pooler de Supabase en lugar de Docker.
- Se usa `after()` de Next o `Date.now()`.

### Puerta del CP4 (T-056e + T-056f + T-056g)

**Ejecutar**:
```bash
npm test -- src/api/asignaciones.test.ts src/app/api/asignaciones src/lib/authorization.test.ts src/lib/route-error-mapper.test.ts src/lib/authorization-consistency.test.ts src/api/acceso-asignacion.test.ts src/domains/sesion/sesion-asignaciones.test.ts
npm test
npm run test:integration
npx tsc --noEmit
```
**Resultado observable esperado**: `GET /api/asignaciones/sugerencia` devuelve 200 con la fila o `null` y
`siguienteEnOrden`; `POST /api/asignaciones/decidir` acepta solo `accion` y devuelve
200/400/403/404/409/500 según el contrato; la matriz permite SOCIO GET+POST, ADMIN/INSTRUCTOR GET y
niega RECEPCIONISTA; el check-in permitido dispara el cálculo best-effort sin cambiar la asistencia ni la
respuesta; la sesión consume la reserva y completa las ejecuciones; las suites existentes de acceso y
sesión quedan verdes **sin ediciones**; `npm test` y la integración completos verdes.

**No debe ser cierto**:
- Un `GET` crea o modifica una fila.
- ADMIN o INSTRUCTOR pueden hacer `POST`.
- Un SOCIO puede enviar `socioId` o elegir `maquinaId`.
- El gancho crea una segunda `Asistencia` o `AuditoriaAcceso`.
- El check-in o el inicio de sesión fallan porque el motor lanzó, persistió mal o expiró.
- Se modificó `src/domains/asignacion/motor-espera.ts`, sus tests o los tests existentes de
  sesión/acceso.
- Se agregó UI fuera del grupo “Motor de espera” de `/configuracion`.

## dependencies

| Task | Debe aterrizar después de | Motivo |
|---|---|---|
| T-056a | — | Crea el esquema, las migraciones y la configuración; todo lo demás depende de la tabla/columnas |
| T-056b | T-056a | El repositorio necesita el enum/modelo y `Configuracion.segundosEjecucionSerie` |
| T-056c | T-056b | Completa la entrada y las escrituras sobre las lecturas base |
| T-056d | T-056c | La orquestación consume el puerto completo (incluido el lock) |
| T-056e | T-056d | Los handlers usan la orquestación y sus DTO |
| T-056f | T-056e | Las rutas delegan en los handlers; la matriz y el mapper completan el contrato |
| T-056g | T-056f | El gancho de check-in usa la orquestación; el adaptador de sesión usa el repositorio ya probado |

Dependencias externas: Docker disponible para `npm run test:integration`; `DATABASE_URL` directa para el
smoke manual; ninguna dependencia npm nueva.

## acceptance_tests

Cada AC de las cinco specs queda cubierto por al menos una tarea y una prueba concreta. Los nombres de
prueba remiten a los archivos indicados en cada tarea; cuando un AC se prueba en más de un nivel, se
listan las pruebas principales.

| AC | Requisito (resumen) | Task | Prueba(s) |
|---|---|---|---|
| **AC-401** | Tabla con `socioId`, `ejercicioId`, `maquinaId`, `sesionId`, `estado`, fechas, espera y ahorro | T-056a | `"aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"` |
| **AC-402** | Snapshots `>= 0`, escritos al crear y nunca recalculados | T-056c, T-056d | `"crearReserva escribe snapshot y venceEn exactos"`, `"la sugerencia vigente no recalcula espera ni ahorro"`, `"calcula y persiste la instantánea exacta del motor"` |
| **AC-403** | Enum de 4 valores; `VENCIDA` derivada, no persistida | T-056a, T-056c | `"aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"`, `"vencimiento perezoso: una fila venceEn <= ahora no es sugerencia vigente y sigue RESERVADA"` |
| **AC-404** | Transiciones permitidas; terminales; transición inválida no escribe | T-056c | `"updateMany con guard no toca una fila COMPLETADA"`, `"consumirReserva usa updateMany con guard de estado y vencimiento"`, `"completarEjecucion solo toca EN_CURSO"` |
| **AC-405** | Una `RESERVADA` no vencida por socio; `EN_CURSO` coexiste | T-056c, T-056d, T-056g | `"una sola reserva activa por socio tras cancelar y crear"`, `"cancelar la reserva anterior antes de crear la nueva en la misma transacción"`, `"una fila EN_CURSO y una RESERVADA coexisten"` |
| **AC-406** | Vencimiento perezoso, inclusivo, sin reescritura y con reloj inyectado | T-056c | `"venceEn == ahora está vencida; 1 s antes vigente"`, `"reserva vencida no aporta a la cola"` |
| **AC-407** | Ocupante por fila `EN_CURSO` o por candidata única; `seriesRestantes` y descanso | T-056c | `"una fila EN_CURSO con la máquina y ejercicio actuales fija el ocupante"`, `"una candidata única sin fila deriva ocupante"`, `"el descanso del ocupante sale de su EjercicioEnRutina"` |
| **AC-408** | Calentamiento/drop set no descuentan; rango 1..series; `< 1` excluye | T-056c | `"seriesRestantes ignora CALENTAMIENTO y DROP_SET"`, `"ocupante con 0 restantes no ocupa"`, `"numeroSerie fuera de 1..series no descuenta"` |
| **AC-409** | Cola de `RESERVADA` no vencidas de terceros, ordenada, con series y descanso | T-056c | `"cola ordenada por creadaEn e id"`, `"reserva no resoluble a rutina activa no aporta y loguea"` |
| **AC-410** | Exclusión P-67 del propio socio, con test dedicado | T-056c | `"P-67: la propia reserva no es ocupante ni cola"`, `"P-67: la propia ejecución EN_CURSO no ocupa"` |
| **AC-411** | Lecturas deterministas, sin motor ni reloj propio | T-056b, T-056c | `"las lecturas son repetibles y no llaman al motor"`, `"la sugerencia vigente no recalcula espera ni ahorro"` |
| **AC-412** | Transacción con `pg_advisory_xact_lock` global; una activa por socio; orden de cola; Docker | T-056c, T-056d | `"enTransaccionBloqueada toma pg_advisory_xact_lock con $queryRaw antes de la función"`, `"dos check-in concurrentes sobre M1 crean una reserva por socio y una espera > 0"`, `"dos recálculos del mismo socio dejan una sola activa"` |
| **AC-413** | Migración aditiva, 0 `DROP`/`ALTER`, rollback comentado, aplica en Docker | T-056a | `"la migración de la tabla es aditiva y no tiene DROP ni ALTER ejecutables"`, `"aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"` |
| **AC-414** | Ningún camino escribe `Maquina.estado = OCUPADA` | T-056c | `"persiste RESERVADA con snapshot y no cambia Maquina.estado"` |
| **AC-415** | Ocupación vigente: actividad dentro de `minutosInactividadSesion`, `>=`, reloj inyectado | T-056c, T-056d | `"sesión con actividad de 31 min no ocupa con ventana 30"`, `"sesión con actividad de 29 min ocupa con ventana 30"`, `"sin registros usa horaInicio fresca"`, `"sin registros usa horaInicio vieja"`, `"la sesión vieja no aporta si hay una fresca"`, `"fila EN_CURSO con actividad de 31 min no ocupa"`, `"fila EN_CURSO con actividad de 29 min ocupa"`, `"fila EN_CURSO sin registros usa creadaEn"`, `"actividad exactamente en el corte cuenta"`, `"pasa ahora y minutosInactividadSesion al plan de lectura"` |
| **AC-416** | FK `ejercicioId` `ON DELETE CASCADE`; borrado de ejercicio sin uso elimina asignaciones | T-056a, T-056c | `"aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"` (FK `CASCADE`), `"borrar ejercicio sin progreso ni rutina elimina sus asignaciones"` |
| **AC-441** | `EntradaMotor` completa y determinista, sin máquinas no candidatas ni filas propias | T-056b, T-056c | `"lee la rutina activa ordenada por orden e id"`, `"mapea candidatos por ejercicio en orden estable"`, `"incluye solo máquinas candidatas existentes en el catálogo"`, `"usa segundosEjecucionSerie de la configuración, no un literal"` |
| **AC-442** | Cálculo en check-in permitido, inicio de rutina y después de cada ejercicio | T-056g | `"un check-in permitido dispara el cálculo una vez con el mismo ahora"`, `"iniciar sesión consume la reserva y fija ejercicioActualId"`, `"registrar la última serie consume la reserva del siguiente y lo fija"` |
| **AC-443** | `exito` con máquina persiste; sin máquina/`sin_opciones`/`vacio` no crean y cancelan | T-056d | `"calcula y persiste la instantánea exacta del motor"`, `"sin_opciones cancela la anterior y no crea fila, sin error"`, `"vacio cancela la anterior y no crea fila"` |
| **AC-444** | `ACEPTAR` idempotente; `ESPERAR` cancela; sin tercera opción | T-056d, T-056e | `"ACEPTAR no escribe y es idempotente"`, `"ESPERAR cancela la reserva vigente"`, `"body con maquinaId devuelve 400 VALIDATION_ERROR"` |
| **AC-445** | Fallback silencioso, cancela la anterior, no lanza | T-056d | `"sin_opciones cancela la anterior y no crea fila, sin error"`, `"vacio cancela la anterior y no crea fila"`, `"maquinaId null cancela la anterior y no crea fila"` |
| **AC-446** | `invalido` logueado como error, sin propagar ni escribir | T-056d | `"invalido no cancela ni crea y loguea contexto"`, `"recomendación fuera de la rutina se trata como invalido"` |
| **AC-447** | `ahora` inyectado; sin `Date.now()`/`new Date()` | T-056d | `"usa el ahora inyectado para creadaEn y venceEn"` + `grep -c 'Date.now' ...` → 0 y `grep -c 'new Date()' ...` → 0 |
| **AC-448** | Best-effort: asistencia intacta ante fallo del motor/persistencia/timeout | T-056d, T-056g | `"timeout devuelve contenido TIMEOUT y no lanza"`, `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"`, `"si la persistencia falla, no queda reserva parcial y la respuesta no cambia"` |
| **AC-449** | La sesión consume la reserva; sin reserva se comporta como hoy; tests existentes verdes | T-056g | `"iniciar sesión consume la reserva y fija ejercicioActualId"`, `"fallback sin asignaciones conserva firmas y resultados"` |
| **AC-450** | Cada ejercicio tiene fila `EN_CURSO`; al completar/finalizar pasa a `COMPLETADA` | T-056g | `"iniciar sesión sin reserva crea una fila EN_CURSO para el primer ejercicio con máquina única"`, `"finalizar sesión completa las EN_CURSO restantes"`, `"registrar la última serie consume la reserva del siguiente y lo fija"` |
| **AC-451** | Motor puro sin cambios; guardián verde | T-056d | `"ningún archivo de src/domains importa @/lib/db de forma estática"` + `git diff --name-only` sin `motor-espera.ts` |
| **AC-452** | Configuración 60/15/30 y `invalido` contenido | T-056d | `"defaults 60/15/30 cuando la configuración no tiene fila"`, `"segundosEjecucionSerie = 0 se contiene como invalido"` |
| **AC-453** | Anti-passback: dentro no calcula ni cancela; fuera recalcula y reemplaza | T-056g, T-056d | `"un check-in denegado por anti-passback no dispara"`, `"cancela la reserva anterior antes de crear la nueva en la misma transacción"` |
| **AC-454** | Espera acotada de 2 s; sin transacción abierta ni lock retenido | T-056d, T-056g | `"timeout devuelve contenido TIMEOUT y no lanza"`, `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"` |
| **AC-455** | `ahora` y `minutosInactividadSesion` (default 30) llegan al plan de lectura; el repositorio no lee el reloj | T-056d | `"pasa ahora y minutosInactividadSesion al plan de lectura"`, `"sesión con actividad de 29 min ocupa con ventana 30"` |
| **AC-481** | `GET` 200 con fila o null, siguiente y `calculadoEn`; sin rutina ambos null; no escribe | T-056e, T-056f | `"socio con sugerencia vigente recibe 200 con la fila y el siguiente"`, `"socio sin rutina activa recibe 200 con sugerencia null y siguiente null aunque exista una fila RESERVADA"`, `"el GET no escribe"` |
| **AC-482** | `POST` solo `accion`; `ACEPTAR` idempotente; `ESPERAR` cancela; transaccional | T-056d, T-056e | `"ACEPTAR devuelve 200 con la misma reserva y el mismo venceEn"`, `"ESPERAR devuelve 200 con sugerencia null"` |
| **AC-483** | Matriz `/api/asignaciones`; SOCIO GET+POST, ADMIN/INSTRUCTOR GET, RECEPCIONISTA 403 | T-056f | `"SOCIO tiene GET y POST en /api/asignaciones"`, `"ADMINISTRADOR e INSTRUCTOR solo tienen GET"`, `"RECEPCIONISTA no tiene acceso"`, `"la matriz no le da a ningún rol un método que el handler rechaza"` |
| **AC-484** | Errores con `code`/`message` en español y status correctos | T-056e, T-056f | `"un error inesperado del servicio devuelve 500 SERVER_ERROR"`, `"mapea SIN_SUGERENCIA a 404 con mensaje en español"`, `"mapea SIN_SUGERENCIA_VIGENTE a 409 con mensaje en español"` |
| **AC-485** | JSON estable, ISO 8601, enteros y null explícito; sin campos internos | T-056e | `"la respuesta no expone estado, sesionId ni datos internos"`, `"socio con sugerencia vigente recibe 200 con la fila y el siguiente"` |
| **AC-486** | La misma fila que GET devuelve es la que POST decide y la sesión consume | T-056d, T-056e | `"ACEPTAR devuelve 200 con la misma reserva y el mismo venceEn"`, `"ACEPTAR no escribe y es idempotente"` |
| **AC-487** | SOCIO no envía `socioId`; ADMIN/INSTRUCTOR lo exigen; ninguno puede POST | T-056e, T-056f | `"SOCIO con socioId en la query recibe 403 aunque sea el propio"`, `"ADMIN sin socioId recibe 400 VALIDATION_ERROR"`, `"ADMIN con socio inexistente recibe 404 NOT_FOUND"`, `"ADMIN recibe 403"` (POST) |
| **AC-488** | Sin `ejercicioId`/`maquinaId` ni elección libre; campo desconocido 400 | T-056e | `"body con maquinaId devuelve 400 VALIDATION_ERROR"`, `"body con socioId devuelve 400"`, `"body con accion ELEGIR devuelve 400"` |
| **AC-489** | `invalido`/fallo/timeout de `siguienteEnOrden` degrada a null y 200 | T-056e | `"si calcularSinReservar falla, responde 200 con siguiente null y loguea"`, `"siguienteEnOrden se calcula después de la decisión y se degrada a null si falla"` |
| **AC-490** | GET solo lectura; POST sobre vencida 409 sin reescribir | T-056e | `"el GET no escribe"`, `"sugerencia vencida devuelve 409 SIN_SUGERENCIA_VIGENTE"` |
| **AC-501** | Tres campos en `Configuracion`, defaults y lector único | T-056a | `"declara los 14 campos esperados"`, `"sin fila devuelve los valores por defecto de siempre"`, `"normaliza por campo los tres parámetros del motor"` |
| **AC-502** | Defaults por campo, sin segundo lector ni lectura directa | T-056a | `"si faltan los tres parámetros del motor, usa 60, 15 y 30"`, `"solo src/lib/configuracion.ts menciona configuracionDelSistema"` (guardián) |
| **AC-503** | `PUT` valida rangos; 0 inválido para segundos e inactividad; NaN/Infinity/no entero 400 | T-056a | `"rechaza segundosEjecucionSerie 0"`, `"rechaza segundosEjecucionSerie 3601"`, `"rechaza segundosEjecucionSerie 60.5"`, `"rechaza minutosVencimientoReserva -1 y 1441"`, `"rechaza minutosVencimientoReserva NaN, Infinity y string"`, `"rechaza minutosInactividadSesion 0, -1 y 1441"`, `"rechaza minutosInactividadSesion 30.5, NaN, Infinity y string"` |
| **AC-504** | Migración aditiva `ADD COLUMN NOT NULL DEFAULT`; fila existente 60/15/30; Docker | T-056a | `"la migración de configuración es aditiva y documenta el rollback"`, `"ConfiguracionDelSistema recibe 60/15/30 y conserva el resto de la fila"` |
| **AC-505** | Panel “Motor de espera”, unidades/rangos, validación cliente y `handleApiError` | T-056a | `"renderiza los 14 campos una vez cargada"`, `"agrupa los campos con sus títulos"`, `"valida en el cliente segundosEjecucionSerie = 0"`, `"valida en el cliente minutosInactividadSesion = 0"`, `"muestra el error del servidor si falla el guardado"` |
| **AC-506** | Auditoría `MODIFICACION` con `antes`/`despues` en la misma transacción; sin cambios no audita | T-056a | `"un cambio de los tres parámetros del motor deja antes/despues de los tres"`, `"un cambio que no cambia nada no escribe auditoría ni update"` |
| **AC-507** | `segundosEjecucionSerie` al motor; `minutosVencimientoReserva` fija `venceEn`; `minutosInactividadSesion` al plan de lectura | T-056b, T-056d | `"usa segundosEjecucionSerie de la configuración, no un literal"`, `"usa el ahora inyectado para creadaEn y venceEn"`, `"pasa ahora y minutosInactividadSesion al plan de lectura"` |
| **AC-508** | Los demás parámetros y la pantalla quedan igual; solo se agrega el grupo | T-056a | `"agrupa los campos con sus títulos"`, `"renderiza los 14 campos una vez cargada"` + suites existentes verdes |
| **AC-509** | `npm test`, integración, `tsc` y `eslint` verdes sin errores nuevos | T-056g | Puerta de CP4: `npm test`, `npm run test:integration`, `npx tsc --noEmit`, `npx eslint <archivos>` |
| **AC-510** | `minutosInactividadSesion` default 30, rango 1–1440, en la misma migración y con mensajes en español; 0/negativo/NaN rechazados | T-056a | `"acepta minutosInactividadSesion 1 y 1440"`, `"rechaza minutosInactividadSesion 0, -1 y 1441"`, `"rechaza minutosInactividadSesion 30.5, NaN, Infinity y string"`, `"ConfiguracionDelSistema recibe 60/15/30 y conserva el resto de la fila"` |
| **AC-521** | Gancho único en `evaluarYRegistrarAcceso`; cubre recepción y puerta; sin duplicado en rutas | T-056g | `"un check-in permitido dispara el cálculo una vez con el mismo ahora"`, `"evaluarYRegistrarAcceso dispara el cálculo una sola vez"` |
| **AC-522** | Asistencia confirmada antes del cálculo; un fallo no la revierte ni cambia su auditoría | T-056g | `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"`, `"registra exactamente una Asistencia y una AuditoriaAcceso por intento"` |
| **AC-523** | Motor que lanza, `invalido`, fallo de persistencia y timeout se capturan y loguean | T-056g | `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"`, `"si la persistencia falla, no queda reserva parcial y la respuesta no cambia"` |
| **AC-524** | Solo accesos no denegados y socios con rutina activa; denegado no calcula ni cancela | T-056g, T-056d | `"un check-in denegado no dispara y no toca la reserva"`, `"sin rutina activa no abre transacción ni invoca el motor"` |
| **AC-525** | Anti-passback dentro no calcula ni cancela; fuera recalcula y reemplaza | T-056g | `"un check-in denegado por anti-passback no dispara"`, `"un check-in permitido dispara el cálculo una vez con el mismo ahora"` |
| **AC-526** | Mismo `ahora` que la asistencia; sin `Date.now()`/`new Date()` | T-056g | `"el gancho usa el mismo ahora de la asistencia"` + `grep` sin `Date.now`/`new Date()` en el gancho |
| **AC-527** | Sin `Asistencia`/`AuditoriaAcceso` adicionales | T-056g | `"registra exactamente una Asistencia y una AuditoriaAcceso por intento"`, `"un check-in denegado no dispara y no toca la reserva"` |
| **AC-528** | Fallos logueados con socio, momento y tipo, sin datos sensibles | T-056g | `"el log no incluye datos sensibles"`, `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"` |
| **AC-529** | Espera acotada; al agotarse la respuesta no cambia y no queda transacción/lock | T-056g, T-056d | `"timeout devuelve contenido TIMEOUT y no lanza"`, `"si el motor lanza, la asistencia queda registrada y la respuesta no cambia"` |
| **AC-530** | Sin cambios de contrato en `evaluarYRegistrarAcceso`, `CheckInResultado`, `decidirAcceso`, cuota y anti-passback; suites verdes sin ediciones | T-056g | `"fallback sin asignaciones conserva firmas y resultados"`, `"un check-in denegado no dispara y no toca la reserva"` + `git diff --name-only` sin `acceso.test.ts` ni `sesion-de-entrenamiento.test.ts` |

**Cobertura**: 61 AC (16 + 15 + 10 + 10 + 10). Todos quedan mapeados a una tarea y al menos una prueba o
verificación concreta. No hay AC sin ubicar.

## Riesgos de implementación

1. **Advisory lock con `$queryRaw`, nunca `$executeRaw`.** `pg_advisory_xact_lock` devuelve una columna
   `void`; la ruta “execute” del engine de Prisma rechaza consultas que devuelven filas
   (`Execute returned results`). El lock va como sentencia de nivel superior, con tagged template y
   `::bigint`, y la prueba de concurrencia de CP3 es la puerta. Si se cambia a `$executeRaw`, el test
   `"enTransaccionBloqueada toma pg_advisory_xact_lock con $queryRaw..."` debe fallar.
2. **Dependencia del daemon de Docker para la prueba de integración.** `npm run test:integration`
   levanta `postgres:17-alpine` en `127.0.0.1:5433`. Si el daemon no está disponible, CP1/CP2/CP3/CP4 no
   se pueden declarar cerrados. La prueba de concurrencia **no** se puede sustituir por el pooler de
   Supabase (`connection_limit=1` serializa y oculta la carrera).
3. **Vencimiento perezoso.** Una fila `RESERVADA` vencida no se reescribe: se ignora en todas las
   lecturas. El test de límite (`venceEn == ahora` vencida, un segundo antes vigente) y el de cola son
   obligatorios. La tabla puede crecer hasta P-69 (limpieza batch, fuera de alcance).
4. **`seriesRestantes` y los conjuntos de calentamiento/drop set.** El filtro debe ser
   `tipo IN ('NORMAL','HASTA_EL_FALLO')` y `numeroSerie BETWEEN 1 AND prescripcion.series`.
   `CALENTAMIENTO` y `DROP_SET` llevan `numeroSerie: null` y no descuentan; un `numeroSerie` fuera de
   rango tampoco. Un error acá subestima la espera y no se ve con fixtures donde todo vale 90; por eso
   hay aserciones específicas con 3 series y con un `numeroSerie: 3` sobre prescripción 2.
5. **Limitación declarada: sesiones con cero o varias máquinas candidatas y sin fila `EN_CURSO`.** Esa
   sesión no identifica una máquina y no aporta ocupante. La orquestación crea la fila al iniciar cada
   ejercicio cuando la máquina es determinable; el caso ambiguo queda documentado y no se “adivina”.
   No se agrega una columna `origen` en esta etapa.
6. **Guarda de capacidad D-103.** Los tests existentes de acceso y sesión mockean Prisma sin
   `asignacionDeEjercicio`/`ejercicioMaquina`. El adaptador y `tieneRutinaActiva` deben ser no-op/false
   sin esos modelos, para que `$transaction` siga llamándose una sola vez en `acceso.test.ts` y las
   suites de sesión queden verdes sin ediciones. Si se quita la guarda, esos tests fallan.
7. **Pasarela `tieneRutinaActiva` exportada por la orquestación.** Design §11 la exige para AC-481
   (“sin rutina activa → `sugerencia: null` aunque exista una fila obsoleta”), pero §7 no la lista entre
   las firmas. Se agrega como pasarela de una línea sobre el puerto; no cambia el contrato del motor ni
   de la tabla. Si el revisor prefiere otra ubicación, el único cambio es el import del handler.
8. **`venceEn` en filas `EN_CURSO` creadas por orden de rutina.** La columna es `NOT NULL` y el
   vencimiento solo aplica a `RESERVADA`; esas filas se escriben con `venceEn = ahora` y snapshot `0/0`.
   Es una decisión de implementación menor, documentada en una línea de comentario; no se agrega una
   columna nueva. La simulación de tesis (P-62) debe distinguir estas filas por origen operativo.
9. **Lint preexistente P-57.** `src/app/home-socio/page.tsx:129` falla por `react-hooks/purity` y es
   anterior a esta change. El gate de lint se limita a los archivos tocados por cada slice; no se
   ejecuta `npx eslint .` ni se corrige P-57 acá.
10. **Orden de la cola con `ahora` distintos.** La garantía dura es que la segunda transacción ve la
    primera; el orden es `creadaEn, id`. El test de concurrencia usa el mismo `ahora`. En producción el
    reloj del servidor y el lock hacen la diferencia despreciable; no se promete un orden global entre
    relojes distintos.
11. **El repositorio también se modifica en T-056c, no en T-056d.** La tabla de archivos de design §14
    asigna `asignacion-repositorio.ts` a S2/S3; por eso las escrituras y `enTransaccionBloqueada`
    aterrizan en T-056c y T-056d queda como orquestación pura. Esto mantiene el corte por capa y evita
    que CP3 mezcle repositorio y servicio. Si se prefiere otro corte, T-056c1/T-056c2 ya está declarado.
12. **Timeout y lock liberado.** El `timeout` de la transacción de Prisma (2000 ms) aborta y libera el
    advisory lock; la carrera externa (2250 ms) solo protege la respuesta. El test con timers falsos
    verifica que no se propaga la excepción. No se deja una transacción abierta.

## Fuera de alcance

- Pantalla del socio, componentes visuales de sugerencia y panel del instructor (Etapa 5).
- Reasignación o cancelación por instructor y salida de emergencia del flujo obligatorio (P-61).
- `EN_CURSO → CANCELADA` por instructor: no se implementa.
- Simulación comparativa para la tesis (P-62).
- Documentación de la limitación “solo espera” (P-63): es un apartado del informe, no código.
- Limpieza batch de reservas abandonadas (P-69).
- `after()` + `waitUntil` de Next/Vercel (P-28); esta etapa usa espera acotada.
- Seed de ejercicios/máquinas/rutinas, datos de ejemplo o fixtures globales.
- Cambios a `EstadoMaquina`, `Maquina`, `SesionDeEntrenamiento` (más allá de las ediciones de T-056g),
  `RegistroDeProgreso`, `motor-espera.ts`, `home-interno.ts`, Home_Socio o Home_Interno.
- Índice único parcial para “una reserva activa por socio”: se enforcea con lock + cancelar/insertar.
- UI o endpoint para elegir máquina o ejercicio libremente.
- Registro de tareas/estado del proyecto en `openspec/sdd-tasks-tdd.md`, `PROJECT-STATUS.md` u otros
  documentos de cierre: fase `sdd-archive`.

## Pendientes

| ID | Estado en esta etapa | Razón |
|---|---|---|
| **P-61** | **Sigue abierto** | Reasignación por instructor y salida de emergencia; Etapa 5. |
| **P-62** | **Sigue abierto** | Simulación comparativa de tesis; requiere la pantalla del socio (Etapa 5). |
| **P-63** | **Sigue abierto** | Limitación “solo espera” para el informe de tesis; no es código. |
| **P-64** | **Se cierra aquí** | Cálculo best-effort en check-in: gancho en `evaluarYRegistrarAcceso` con `try/catch` y log (T-056g). |
| **P-65** | **Se cierra aquí** | Reserva con vencimiento configurable: `venceEn` + `minutosVencimientoReserva` (T-056a/T-056d). |
| **P-66** | **Se cierra aquí** | Evaluación de `after`: se decide `await` acotado; la verificación de `waitUntil` en Vercel sigue en P-28. |
| **P-67** | **Se cierra aquí** | Exclusión del propio socio en ocupantes y cola, con test dedicado (T-056c). |
| **P-68** | **Se cierra aquí** | Prueba de concurrencia con advisory lock contra Docker (T-056d). |
| **P-69** | **Sigue abierto** | Limpieza batch de reservas abandonadas; el vencimiento perezoso alcanza para operar. |
| **P-70** | **Se cierra aquí** | `ejercicioActualId` refleja la reserva consumida; test dedicado (T-056g). |
| **P-71** | **Se abre aquí** | Latencia del check-in: peor caso ≈2,25 s por `TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS` como constantes únicas; revisar con mediciones reales en Etapa 5/despliegue y reconsiderar `after()` si P-28 (`waitUntil`) se verifica. Severidad Media. |

Se abre P-71; P-28 sigue abierto por infraestructura de despliegue, no por esta change.

## Numeración

| Rango | Uso en este change | Último registrado | Colisión |
|---|---|---|---|
| T-056a – T-056g | Siete slices verticales (CP1, CP2a, CP2b, CP3, CP4a, CP4b, CP4c) | T-055d | Ninguna |
| D-88 – D-92 | Decisiones vinculantes de Fernando (cinco) | D-87 | Ninguna |
| D-93 – D-109 | Decisiones propuestas por la IA y adoptadas en el diseño (diecisiete) | D-92 | Ninguna |
| P-68 – P-71 | Cuatro pendientes de la etapa: P-68 y P-70 se cierran; P-69 sigue abierto y P-71 se abre | P-67 | Ninguna |

Verificado el 2026-10-26 contra `openspec/decisions.md` (última decisión D-87; último pendiente P-67) y
`openspec/changes/archive/2026-10-25-motor-espera/tasks.md` (última tarea T-055d). No se reutiliza
ningún identificador. Los IDs T-056c1/T-056c2, T-056d1/T-056d2 y T-056g1/T-056g2 son cortes de
contingencia, no tareas nuevas del plan base.
