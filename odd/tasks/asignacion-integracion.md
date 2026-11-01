# Asignación — Integración del motor de espera (T-056a..T-056g, D-88..D-110)

## Objetivo

Cerrar la **Etapa 4** de "asignación dinámica de ejercicios": conectar el motor puro de espera (Etapa 3)
con la base, el check-in, la sesión y la configuración. El motor se consume **tal cual**. Quedan fuera la
pantalla del socio, la reasignación por instructor (P-61) y la simulación comparativa (P-62).

## Alcance

- `prisma/schema.prisma` (`AsignacionDeEjercicio` + enum de cuatro estados) y dos migraciones escritas a
  mano: `20261026120000_asignacion_ejercicio` y `20261026120500_asignacion_configuracion`.
- `src/domains/configuracion/configuracion.ts`, `src/lib/configuracion.ts` y `src/app/configuracion/page.tsx`
  (tres parámetros nuevos + grupo "Motor de espera").
- `src/domains/asignacion/asignacion-*` (puerto, lecturas, ocupación, escrituras y composición) y
  `orquestacion-*` (cálculo y decisión).
- `src/api/asignaciones.ts`, `src/app/api/asignaciones/{sugerencia,decidir}/route.ts`,
  `src/lib/authorization.ts` y `src/lib/route-error-mapper.ts`.
- `src/api/acceso.ts` (gancho), `src/domains/sesion/integracion-asignaciones.ts` y
  `src/domains/sesion/sesion-de-entrenamiento.ts`.
- `tests/integration/asignacion-*` y `configuracion-asignacion.integration.test.ts`.
- Los cinco specs del change; `openspec/decisions.md`, `PROJECT-STATUS.md` y este archivo (cierre).

Sin pantallas nuevas, sin seed y sin cambios a `motor-espera.ts`.

## Decisiones clave

- **De Fernando (D-88..D-92)**: disparo del cálculo en tres momentos (check-in, inicio de rutina y al
  completar cada ejercicio); reserva con vencimiento configurable (15 min); tres parámetros nuevos en
  `/configuracion`; solo socios con rutina activa; flujo `ACEPTAR`/`ESPERAR` obligatorio.
- **Propuestas de la IA adoptadas (D-93..D-110)**: tabla propia con cuatro estados; instantánea inmutable
  (`esperaSegundos`/`ahorroSegundos`); advisory lock global; una reserva activa por socio; ocupación
  derivada de sesiones y filas `EN_CURSO`; timeout de 2 s; matriz de permisos explícita; rechazo de
  `after()` (P-66); ocupante con la rutina de su sesión; 404 `SIN_SUGERENCIA` vs 409
  `SIN_SUGERENCIA_VIGENTE`; guarda de capacidad; dos migraciones separadas; corte de inactividad;
  `CASCADE` en `ejercicioId`; lock que devuelve un entero; límite multi-máquina de D-108; `contenido`
  mapeado a 500; tope de cálculo configurable por entorno.

## Tareas

1. **T-056a — Esquema, migraciones, configuración y panel (CP1)**. ✅ Partida en **a1** (schema + dos
   migraciones + test de integración) y **a2** (dominio de configuración + lector único + panel): la
   medición dio 428 líneas frente a ≈240 estimadas. FK `socio`/`ejercicio` con `CASCADE`,
   `maquina`/`sesion` con `SET NULL`; `segundosEjecucionSerie` 60 (1–3600), `minutosVencimientoReserva`
   15 (0–1440), `minutosInactividadSesion` 30 (1–1440).
2. **T-056b — Repositorio: puerto, DTO y lecturas base (CP2a)**. ✅
3. **T-056c — Entrada del motor, ocupantes, cola, P-67, vencimiento, escrituras y lock (CP2b)**. ✅ El
   repositorio se partió por responsabilidad en cinco archivos; `seriesRestantes` filtra `CALENTAMIENTO`
   y `DROP_SET`; las escrituras usan guard y `enTransaccionBloqueada` con `pg_advisory_xact_lock`.
4. **T-056d — Orquestación (CP3)**. ✅ Cinco commits: d1a (camino feliz), d1b (fallback/`invalido`/errores),
   d2a (decisión), d2b (consultas y pasarelas) y d3 (concurrencia en Postgres). ≈1.350 líneas frente a
   ≈1.100 recalculadas.
5. **T-056e — Handlers HTTP (CP4a)**. ✅ e1: `handleObtenerSugerencia` (GET, 13 tests). e2:
   `handleDecidirSugerencia` (POST, 17 tests), body estricto y regla fina por rol y propiedad.
6. **T-056f — Rutas, matriz RBAC y mapper (CP4b)**. ✅ f1 (rutas + `SIN_SUGERENCIA`/`SIN_SUGERENCIA_VIGENTE`
   en el mapper) y f2 (matriz `/api/asignaciones` con ADMINISTRADOR explícito que recorta el comodín).
7. **T-056g — Check-in y sesión (CP4c)**. ✅ g1 (gancho best-effort en `evaluarYRegistrarAcceso`), g2
   (adaptador `integracion-asignaciones.ts` con la guarda D-103), g2b (consumo de la reserva dentro de la
   transacción), g3a (`registrarSerie` consume/avanza solo al completar el ejercicio y recalcula
   `POST_EJERCICIO`) y g3b (`finalizarSesion` cierra sesión y ejecuciones en una transacción).
   CP4 se entregó en nueve commits entre e1, e2, f1, f2, g1, g2, g2b, g3a y g3b.

## Verificación observada

- `npx tsc --noEmit`: limpio.
- `npm test`: **264 suites / 3731 tests** en verde (el `verify-report` registró 263 / 3728 en su corrida).
- `npm run build`: compilado en **11,2 s / 49 páginas**.
- Suite de integración: **9 suites / 54 tests**, ejecutada por Fernando el 2026-10-31 con resultado OK.
- `npx eslint .`: solo el error preexistente **P-57** (`src/app/home-socio/page.tsx:129`, `react-hooks/purity`).
- Guardián de dominios puros: verde. Las migraciones se verificaron aditivas (sin `DROP`/`ALTER`
  destructivos) desde el test de integración.
- Cobertura de los 61 AC de los cinco specs: 56 cubiertos con verificación de valores, 5 parciales
  aceptados como bajos (AC-403, AC-486, AC-521, AC-509 y el enum por tipo/DDL), 0 sin cobertura.

## Límites declarados

- **D-108**: un ocupante sin fila `EN_CURSO` solo ocupa una máquina si el ejercicio tiene exactamente una
  candidata; con varias, el motor puede **subestimar** la espera.
- **Vencimiento perezoso**: las `RESERVADA` vencidas se ignoran al leer pero no se limpian (P-69);
  la tabla crece.
- **Concurrencia medida con pocos socios** en Docker; el cuello del lock global y la latencia real contra
  Supabase no están medidos (P-71).
- **Sin UI en esta etapa**: nada se probó en navegador; los smokes de CP4b y CP4c quedaron escritos en el
  `tasks.md` archivado para correrlos con `npm run dev`.

## Lecciones

- **Un test de lock que pasa sin el lock no prueba nada**: los de concurrencia se validan comentando la
  sentencia y verificando que fallan.
- **`expect.anything()` no prueba que un argumento llegue al lugar correcto**: el cableado de timeouts de
  D-110 estaba mal y lo detectó el smoke manual, no los tests.
- **Los tests con Prisma falso no ejecutan el SQL real**: en CP2 el doble escondió que
  `pg_advisory_xact_lock` devuelve `void`; cada adaptador que escribe necesita un flujo contra Postgres.
- **El smoke manual encontró lo que los tests no veían**: `registrarSerie` recalculaba en cada serie en vez
  de al completar el ejercicio, y el tope de 2 s no alcanzaba contra una base remota.

## Pendientes

- **P-61** reasignación por instructor (Etapa 5). **P-62** simulación comparativa de la tesis.
  **P-63** redacción de la limitación "solo espera". **P-69** limpieza batch de `RESERVADA` vencidas.
  **P-71** latencia del check-in (mitigada por D-110, falta medir con carga real).
- **P-57** sigue siendo el único error de ESLint del proyecto, ajeno a esta etapa.
- Cerrados en esta etapa: **P-64**, **P-65**, **P-66**, **P-67**, **P-68** y **P-70**.

## Próximo paso: Etapa 5

La Etapa 5 agrega la pantalla del socio y la reasignación por instructor (P-61). Antes de usar el flujo
contra una base remota hay que ajustar `ASIGNACION_TIMEOUT_CALCULO_MS` (D-110, default 2000 ms) y asociar
máquinas a los ejercicios desde `/maquinas`: el seed no crea `EjercicioMaquina`, así que sin ese paso el
motor devuelve `sin_opciones` y el check-in no deja reserva.
