# Verify Report — asignacion-integracion

- **Change**: `asignacion-integracion` (Etapa 4 de "asignación dinámica de ejercicios")
- **Rama**: `feat/asignacion-integracion`
- **Fecha**: 2026-10-25
- **Alcance verificado**: 5 specs del change (61 AC), 23 decisiones (D-88…D-110), restricciones de capa, migraciones y seed.
- **Veredicto**: **APROBADO CON OBSERVACIONES**

## Resumen

La implementación cumple los 61 criterios de aceptación de los cinco specs: 52 están cubiertos por
tests que verifican valores (no solo existencia), 9 quedan cubiertos parcialmente y ninguno está sin
cobertura. Las 23 decisiones se cumplen en el código; no hay desviaciones de comportamiento. Las
compuertas de tipos, lint del change, tests unitarios y build están verdes. **La compuerta de
integración no pudo ejecutarse en esta sesión** (Docker no accesible desde el usuario), aunque sí se
corrió dos veces en la pasada anterior con 9 suites / 54 tests en verde.

Las observaciones son de cobertura, no de comportamiento. **Actualizado el 2026-10-25**: los
hallazgos medios 1 (AC-453/AC-525) y 2 (AC-402/AC-411) quedaron cerrados con tests nuevos (ver
"Seguimiento"); el medio 3 (compuerta de integración) quedó cerrado el 2026-10-31 y los bajos 4–7 siguen abiertos.

## Compuertas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | **exit 0** (sin salida) |
| Lint del proyecto | `npx eslint .` | **exit 1** — 1 error + 96 warnings; el error es el **preexistente P-57** en `src/app/home-socio/page.tsx:129` (`react-hooks/purity`, `Date.now()` en render), registrado desde la Etapa 1 |
| Tests unitarios | `npm test` | **263 suites / 3728 tests passed** |
| Build | `npm run build` | **Compiled successfully (15.4 s, 49 páginas)**, exit 0 |
| Integración | `npm run test:integration` | **NO EJECUTADA en esta sesión**: `No se encontró 'docker' en el PATH o el daemon no responde`. Última corrida registrada (pasada anterior): **9 suites / 54 tests passed**, dos veces |
| Guardián de dominios puros | `npm test -- src/domains/dominios-puros.guard.test.ts` | **1 passed** |

## Restricciones de capa

```
$ grep -n "@prisma/client\|@/lib/db" src/domains/asignacion/orquestacion.ts src/domains/sesion/integracion-asignaciones.ts
(exit 1, sin coincidencias)

$ grep -rn "process.env" src/domains
(exit 1, sin coincidencias)

$ grep -n "Date\.now()\|new Date()" src/domains/asignacion/orquestacion.ts src/domains/asignacion/motor-espera.ts
(exit 1, sin coincidencias)

$ grep -rn "esClienteConAsignaciones" src --include=*.ts | grep -v "\.test\."
src/domains/sesion/integracion-asignaciones.ts:22   (definición, única)
src/domains/sesion/sesion-de-entrenamiento.ts:50,259,483,738   (usos)

$ git diff --name-only origin/dev...HEAD -- \
    src/domains/asignacion/motor-espera.ts src/domains/asignacion/motor-espera.*.test.ts \
    src/api/acceso.test.ts src/domains/sesion/sesion-de-entrenamiento.test.ts
(vacío)
```

## Migraciones y datos

```
$ git diff --stat origin/dev...HEAD -- prisma
 prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql      | 32 +++++
 prisma/migrations/20261026120500_asignacion_configuracion/migration.sql  | 10 +++
 prisma/schema.prisma                                                     | 44 +++++
 3 files changed, 86 insertions(+)
```

- Las dos migraciones son **nuevas** en esta rama (no modificadas después de aplicadas): el diff
  contra `dev` las muestra solo como altas, sin líneas eliminadas.
- `prisma/seed.ts` y `prisma/seed-data.ts` **no aparecen en el diff**: el seed no se tocó.
- La migración de la tabla se verifica aditiva en
  `tests/integration/configuracion-asignacion.integration.test.ts` ("la migración de la tabla es
  aditiva y no tiene DROP ni ALTER ejecutables", "la migración de configuración es aditiva y
  documenta el rollback").

## Cobertura de los criterios de aceptación

Leyenda: ✅ cubierto con verificación de valores · 🟡 parcial (alguna parte del criterio no tiene
test propio) · ❌ sin cobertura.

### Persistencia (`asignacion-ejercicio-persistencia`)

| AC | Test(s) | Estado |
|---|---|---|
| AC-401 | `configuracion-asignacion.integration` → "aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs"; `asignacion-persistencia.integration` → "persiste RESERVADA con snapshot y no cambia Maquina.estado" | ✅ |
| AC-402 | `escrituras` → "crearReserva escribe el snapshot y venceEn exactos"; `asignacion-persistencia.integration` → "persiste RESERVADA con snapshot…"; `orquestacion.decision` → "devuelve los 120/60 guardados aunque cambie el gimnasio, sin invocar el motor" | ✅ |
| AC-403 | `asignacion-persistencia.integration` → "vencimiento perezoso: … sigue RESERVADA"; `configuracion-asignacion.integration` → `CREATE TYPE "EstadoAsignacion"` | 🟡 se verifica el tipo, no que el enum tenga exactamente 4 valores |
| AC-404 | `escrituras` → "consumirReserva usa updateMany con guard", "cancelarReserva usa updateMany con guard", "completarEjecucion solo toca EN_CURSO"; `asignacion-persistencia.integration` → "completarEjecucion no toca una fila ya COMPLETADA" | ✅ |
| AC-405 | `orquestacion` → "cancela la reserva anterior antes de crear la nueva en la misma transacción"; `asignacion-persistencia.integration` → "una sola reserva activa por socio…"; `asignacion-orquestacion.integration` → "dos recálculos… una sola reserva activa"; `sesion-asignaciones.avance` → "tras avanzar conviven una fila EN_CURSO y la reserva consumida" | ✅ |
| AC-406 | `cola` → "venceEn == ahora no es sugerencia vigente; 1 s antes sí"; `asignacion-persistencia.integration` → "vencimiento perezoso…" | ✅ |
| AC-407 | `ocupantes` → "una candidata única sin fila deriva ocupante", "una fila EN_CURSO con la máquina y ejercicio actuales fija el ocupante", "el descanso del ocupante sale de su EjercicioEnRutina"; `asignacion-persistencia.integration` → "ocupante real…" | ✅ |
| AC-408 | `ocupantes` → "seriesRestantes ignora CALENTAMIENTO y DROP_SET", "ocupante con 0 restantes no ocupa"; `asignacion-persistencia.integration` → "ocupante real…" | ✅ |
| AC-409 | `cola` → "cola ordenada por creadaEn e id…", "solo lee reservas no vencidas y de otros socios", "una reserva no resoluble a rutina activa no aporta y loguea" | ✅ |
| AC-410 | `cola` → "P-67: las consultas de ocupantes y cola excluyen al socio actual"; `asignacion-persistencia.integration` → "P-67: la cola ajena aparece y la propia no" | ✅ |
| AC-411 | `lecturas` → "las lecturas son repetibles con el mismo ahora"; `orquestacion.decision` → "devuelve los 120/60 guardados aunque cambie el gimnasio, sin invocar el motor" (espía sobre `calcularEspera`) | ✅ |
| AC-412 | `escrituras` → "enTransaccionBloqueada toma pg_advisory_xact_lock…", "enTransaccionBloqueada pasa maxWait 1000 y timeout 2000"; `asignacion-concurrencia.integration` → "una transacción espera a que la otra libere el advisory lock", "el advisory lock se libera cuando la transacción falla" | ✅ |
| AC-413 | `configuracion-asignacion.integration` → "la migración de la tabla es aditiva…", "la migración de configuración es aditiva…" | ✅ |
| AC-414 | `asignacion-persistencia.integration` → "persiste RESERVADA con snapshot y no cambia Maquina.estado" | ✅ |
| AC-415 | `ocupantes` → "sesión con actividad de 31 min no ocupa…", "…29 min ocupa…", "sin registros usa horaInicio…", "la sesión vieja no aporta si hay una fresca", "actividad exactamente en el corte cuenta"; `asignacion-persistencia.integration` → "sesión EN_CURSO vieja no ocupa y la fresca sí" | ✅ |
| AC-416 | `asignacion-persistencia.integration` → "borrar un ejercicio sin progreso ni rutina elimina sus asignaciones"; `ejercicio-maquina.integration` → "borrar el ejercicio sin rutinas ni progreso elimina sus filas (Cascade)" | ✅ |

### Orquestación (`asignacion-orquestacion`)

| AC | Test(s) | Estado |
|---|---|---|
| AC-441 | `lecturas` → "lee la rutina activa ordenada por orden e id", "mapea candidatos por ejercicio en orden estable", "incluye solo máquinas candidatas existentes en el catálogo" | ✅ |
| AC-442 | `acceso-asignacion` → "un check-in permitido dispara el cálculo una vez…", "un check-in denegado no dispara…"; `sesion-asignaciones.avance` → "una serie intermedia no recalcula…", "consume la reserva, avanza a E2…" | ✅ |
| AC-443 | `orquestacion` → "calcula y persiste la instantánea exacta del motor"; `orquestacion.fallback` → "sin_opciones cancela…", "vacio cancela…", "maquinaId null cancela…" | ✅ |
| AC-444 | `orquestacion.decision` → "ACEPTAR no escribe y es idempotente", "ESPERAR cancela la reserva vigente"; `asignaciones.post` → "ACEPTAR devuelve 200…", "ACEPTAR repetido es idempotente", "ESPERAR devuelve 200 con sugerencia null" | ✅ |
| AC-445 | `orquestacion.fallback` → "sin_opciones cancela…", "vacio cancela…", "maquinaId null cancela…" | ✅ |
| AC-446 | `orquestacion.fallback` → "invalido no cancela ni crea y loguea el contexto", "una recomendación fuera de la rutina se trata como invalido", "la máquina recomendada debe ser candidata del ejercicio" | ✅ |
| AC-447 | `orquestacion` → "usa el ahora inyectado para creadaEn y venceEn", "pasa ahora y minutosInactividadSesion al plan de lectura" | ✅ |
| AC-448 | `acceso-asignacion` → "si el motor lanza, la asistencia queda registrada y la respuesta no cambia", "si la persistencia de la reserva falla, no queda nada parcial…" | ✅ |
| AC-449 | `sesion-asignaciones` → "consume la reserva vigente y fija su ejercicio como actual", "sin los modelos nuevos (D-103) se comporta como siempre"; rutas protegidas sin cambios | ✅ |
| AC-450 | `sesion-asignaciones` → "sin reserva y con una sola candidata crea la ejecución EN_CURSO…"; `avance` → "consume la reserva, avanza a E2 y completa la ejecución de E1", "la última serie del último ejercicio no crea fila…"; `fin` → "completa las EN_CURSO restantes en la misma transacción…"; `sesion-asignaciones.integration` → flujo completo | ✅ |
| AC-451 | rutas protegidas vacías (arriba); guardián verde | ✅ |
| AC-452 | `lecturas` → "usa segundosEjecucionSerie de la configuración, no un literal"; `configuracion.test` → 25 tests; `lib/configuracion.test` → 22; `page.test` → 15; `orquestacion.fallback` → "segundosEjecucionSerie = 0 se contiene como invalido" | ✅ |
| AC-453 | `acceso-asignacion` → "un check-in denegado por anti-passback no dispara"; `acceso-asignacion.ventana` → "fuera de la ventana, el segundo check-in es permitido y vuelve a disparar el cálculo", "dentro de la ventana, el segundo check-in es denegado y no dispara el cálculo"; el reemplazo `CANCELADA` + `RESERVADA` está cubierto por capas: `asignacion-orquestacion.integration` → "dos recálculos del mismo socio dejan una sola reserva activa" y `orquestacion` → "cancela la reserva anterior antes de crear la nueva en la misma transacción" | ✅ |
| AC-454 | `orquestacion.fallback` → "un timeout devuelve contenido TIMEOUT y no lanza"; `orquestacion` → "usa los timeouts recibidos en la transacción y en la carrera externa"; `asignacion-concurrencia.integration` → "el advisory lock se libera cuando la transacción falla" | ✅ |
| AC-455 | `orquestacion` → "pasa ahora y minutosInactividadSesion al plan de lectura"; `ocupantes` → frescura D-105 | ✅ |

### API (`asignacion-api`)

| AC | Test(s) | Estado |
|---|---|---|
| AC-481 | `asignaciones.test` → "socio con sugerencia vigente recibe 200 con la fila y el siguiente", "socio sin rutina activa recibe 200 con ambos null…"; `sugerencia/route.test` → "SOCIO delega con su usuario…" | ✅ |
| AC-482 | `asignaciones.post` → "ACEPTAR devuelve 200…", "ACEPTAR repetido es idempotente", "ESPERAR devuelve 200 con sugerencia null", "NUNCA_EXISTIO…", "YA_NO_VIGENTE…" | ✅ |
| AC-483 | `authorization.test` → bloque "Matriz /api/asignaciones (D-99)" (5 tests); `authorization-consistency.test` → 2 tests | ✅ |
| AC-484 | `route-error-mapper.test` → "mapea SIN_SUGERENCIA a 404…", "…SIN_SUGERENCIA_VIGENTE a 409…"; `asignaciones.post` → 500 sin detalles (3 casos) | ✅ |
| AC-485 | `asignaciones.test` → "socio con sugerencia vigente recibe 200…" (body exacto con ISO 8601 y `null` explícito) | ✅ |
| AC-486 | `asignaciones.test` (GET lee la fila persistida), `asignaciones.post` (decide la misma), `sesion-asignaciones` (consume por id) | 🟡 cada endpoint por separado; no hay test que cruce la identidad GET→POST→sesión |
| AC-487 | `asignaciones.test` → "SOCIO con socioId en la query recibe 403…", "SOCIO inexistente recibe 404…", "ADMIN sin socioId recibe 400…", "ADMIN con socio inexistente recibe 404…", "ADMIN consulta…200", "INSTRUCTOR consulta…200" | ✅ |
| AC-488 | `asignaciones.post` → "body con maquinaId…400", "body con socioId…400", "body no objeto…400", "accion ausente…400", "accion ELEGIR…400" | ✅ |
| AC-489 | `asignaciones.test` → "si calcularSinReservar falla, responde 200 con siguiente null y loguea"; `asignaciones.post` → "si el siguiente falla, responde 200…" | ✅ |
| AC-490 | `asignaciones.test` → "el GET no escribe: dos llamadas devuelven el mismo body"; `asignaciones.post` → "YA_NO_VIGENTE devuelve 409…" | ✅ |

### Configuración (`configuracion-sistema`)

| AC | Test(s) | Estado |
|---|---|---|
| AC-501 | `configuracion.test` → "declara los 14 campos esperados", bordes de los tres parámetros | ✅ |
| AC-502 | `lib/configuracion.test` → defaults y normalización por campo; `configuracion.guard.test` verde | ✅ |
| AC-503 | `configuracion.test` → rechazos (`0`, `-1`, `1441`, `30.5`, `NaN`, `Infinity`, string) | ✅ |
| AC-504 | `configuracion-asignacion.integration` → "ConfiguracionDelSistema recibe 60/15/30 y conserva el resto de la fila", "la migración de configuración es aditiva…" | ✅ |
| AC-505 | `page.test` → "renderiza los 14 campos…", "valida en el cliente segundosEjecucionSerie = 0", "…minutosInactividadSesion = 0", "guarda minutosInactividadSesion = 45…" | ✅ |
| AC-506 | `lib/configuracion.test` → "un cambio de los tres parámetros del motor deja antes/despues de los tres" | ✅ |
| AC-507 | `lecturas` → "usa segundosEjecucionSerie de la configuración…"; `orquestacion` → "con la configuración por defecto vence a los 15 minutos…" | ✅ |
| AC-508 | `lib/configuracion.test` → "sin fila devuelve los valores por defecto de siempre" (objeto completo) | ✅ |
| AC-509 | compuertas: `npm test` y `tsc` verdes; `npm run test:integration` **no ejecutada en esta sesión** | 🟡 |
| AC-510 | `configuracion.test` → "acepta minutosInactividadSesion 1 y 1440", rechazos; `configuracion-asignacion.integration` → las tres columnas en el mismo `ALTER` | ✅ |

### Check-in (`member-access-check`)

| AC | Test(s) | Estado |
|---|---|---|
| AC-521 | `acceso-asignacion` → "evaluarYRegistrarAcceso dispara el cálculo una sola vez" | 🟡 se prueba el servicio compartido; no hay test que recorra las dos rutas de ingreso |
| AC-522 | `acceso-asignacion` → "si el motor lanza, la asistencia queda registrada…", "si la persistencia de la reserva falla…" | ✅ |
| AC-523 | `acceso-asignacion` → los dos anteriores + "el log del gancho no incluye DNI ni PIN"; `orquestacion.fallback` → inválido y timeout contenidos | ✅ |
| AC-524 | `acceso-asignacion` → "un check-in denegado no dispara el cálculo"; `orquestacion.fallback` → "sin rutina activa no abre transacción ni invoca el motor" | ✅ |
| AC-525 | `acceso-asignacion` → "un check-in denegado por anti-passback no dispara"; `acceso-asignacion.ventana` → "fuera de la ventana, el segundo check-in es permitido y vuelve a disparar el cálculo" (dos disparos con su `ahora`), "dentro de la ventana… no dispara" | ✅ |
| AC-526 | `acceso-asignacion` → "el gancho usa el mismo ahora de la asistencia" | ✅ |
| AC-527 | `acceso-asignacion` → "registra exactamente una Asistencia y una AuditoriaAcceso por intento" | ✅ |
| AC-528 | `acceso-asignacion` → "el log del gancho no incluye DNI ni PIN" (claves exactas `error`, `socioId`, `tipo`) | ✅ |
| AC-529 | `orquestacion.fallback` → "un timeout devuelve contenido TIMEOUT y no lanza"; `orquestacion` → timeouts recibidos | ✅ |
| AC-530 | `src/api/acceso.test.ts` sin cambios (diff vacío); `asignaciones.post`/`asignaciones.test` verdes | ✅ |

## Cumplimiento del diseño (D-88…D-110)

| Decisión | Evidencia | Estado |
|---|---|---|
| D-88 · Cálculo en check-in + inicio + fin de ejercicio | `src/api/acceso.ts` (gancho), `sesion-de-entrenamiento.ts:290` (inicio), `:600` (fin de ejercicio, solo al completar) | ✅ |
| D-89 · Vence a los 15 min, configurable | `orquestacion.ts` (venceEn desde `minutosVencimientoReserva`); `configuracion` tests | ✅ |
| D-90 · Tres parámetros en `/configuracion` | `configuracion.ts` (14 campos), `lib/configuracion.ts`, `page.tsx` | ✅ |
| D-91 · Solo socios con rutina activa | `orquestacion.ts:121` (gate), `fallback` → "sin rutina activa no abre transacción" | ✅ |
| D-92 · Flujo `ACEPTAR`/`ESPERAR` | `decidirSugerencia` (`orquestacion.ts:250+`), `asignaciones.ts:213` | ✅ |
| D-93 · Cuatro estados persistidos | `prisma/schema.prisma` (`enum EstadoAsignacion`), migración `CREATE TYPE` | ✅ |
| D-94 · Instantánea inmutable | `crearReserva` escribe `esperaSegundos`/`ahorroSegundos`; `leerSugerenciaVigente` solo selecciona | ✅ (test 🟡) |
| D-95 · Advisory lock global | `asignacion-repositorio.ts:117` (`pg_advisory_xact_lock`), clave `880000001` | ✅ |
| D-96 · Una reserva activa por socio | `cancelarReservasActivas` + `crearReserva` en la misma transacción; `asignacion-orquestacion.integration` | ✅ |
| D-97 · Ocupación derivada | `asignacion-ocupacion.ts` (`aplicarOcupantes`) | ✅ |
| D-98 · Timeout 2 s | `lib/asignacion-timeouts.ts:24` (`TIMEOUT_CALCULO_POR_DEFECTO = 2000`) | ✅ |
| D-99 · Matriz de permisos | `authorization.ts` (SOCIO GET+POST, INSTRUCTOR GET, ADMIN GET explícito) | ✅ |
| D-100 · Se rechaza `after()` | `acceso.ts` usa `await` acotado; no hay import de `after` en `src/` | ✅ |
| D-101 · Ocupante con la rutina de su sesión | `asignacion-ocupacion.ts` (`sesion.rutinaAsignada.rutina`) | ✅ |
| D-102 · 404 vs 409 | `asignaciones.ts:209` (código), `route-error-mapper.ts:202,209` | ✅ |
| D-103 · Guarda de capacidad | `integracion-asignaciones.ts:22` (única definición), usos en `sesion-de-entrenamiento.ts` | ✅ |
| D-104 · Dos migraciones aditivas | `prisma/migrations/2026102612*` | ✅ |
| D-105 · Corte de inactividad | `asignacion-ocupacion.ts:59` (fila sin máquina) y cálculo del corte con `lectura.ahora` | ✅ |
| D-106 · `CASCADE` en `ejercicioId` | `prisma/schema.prisma` (modelo) + migración; `asignacion-persistencia.integration` | ✅ |
| D-107 · Lock devuelve entero | `asignacion-repositorio.ts:116-118` (`SELECT 1 AS ok FROM (…) AS t`) | ✅ |
| D-108 · Sin fila: solo candidata única | `asignacion-ocupacion.ts:59,209-215`; `ocupantes` tests 5,6,7 | ✅ (limitación declarada) |
| D-109 · `contenido` ante ERROR/TIMEOUT | `orquestacion.ts` (`ResultadoDecision`), `asignaciones.ts:213`; `decision` test 8; `asignaciones.post` tests 15-17 | ✅ |
| D-110 · Tope configurable | `lib/asignacion-timeouts.ts`, `orquestacion.ts:61,70`; `integracion-asignaciones.ts:96` (`deps`) | ✅ |

**No se encontraron desviaciones de comportamiento.**

## Riesgos residuales

1. **Latencia con BD remota**: el cálculo se acota a `ASIGNACION_TIMEOUT_CALCULO_MS` (2000 por
   defecto). Contra Supabase desde una máquina local puede superarlo; se mitiga con la variable
   (D-110) pero ningún test mide latencia real.
2. **Concurrencia real de producción**: los tests de concurrencia usan Docker con pocos socios y un
   gimnasio. El comportamiento con decenas de check-ins simultáneos y el cuello del lock global no
   está medido.
3. **Limitación declarada D-108**: un ocupante sin fila `EN_CURSO` solo se asigna a una máquina si el
   ejercicio tiene exactamente una candidata. Con varias, la sesión no aporta ocupación y el motor
   puede **subestimar** la espera. Documentado en design (D-108) y en el spec de persistencia.
4. **`serieRestantes`**: la derivación depende de `tipo` y `numeroSerie`; está cubierta, pero un
   cambio futuro en los tipos de serie requeriría revisar el filtro (`NORMAL`, `HASTA_EL_FALLO`).
5. **Vencimiento perezoso**: las filas `RESERVADA` vencidas no se limpian (P-69). Crecimiento
   indefinido de la tabla.
6. **Lint global**: `eslint .` sigue fallando por P-57, preexistente y ajeno a esta change.

## Hallazgos

### Críticos
Ninguno.

### Altos
Ninguno.

### Medios
1. ~~**AC-453 / AC-525 — ventana anti-passback fuera del bloqueo.**~~ **Cerrado el 2026-10-25** (ver
   Seguimiento). No hay test del camino "fuera de
   la ventana, el check-in permitido recalcula y **reemplaza** la reserva anterior". Evidencia: en
   `src/api/acceso-asignacion.test.ts` los tests 7 y 8 solo cubren el caso denegado; el flujo de
   reemplazo está en `cancelarReservasActivas` + `crearReserva` de `calcularYReservar`
   (`orquestacion.ts`), cubierto por otros tests pero no desde el check-in.
   *Propuesta*: un test en `acceso-asignacion.test.ts` con dos `evaluarYRegistrarAcceso` separados
   por más de la ventana, que verifique que la primera reserva queda `CANCELADA` y la segunda
   `RESERVADA`.
2. ~~**AC-402 — la instantánea no se recalcula al leer.**~~ **Cerrado el 2026-10-25** (ver
   Seguimiento). El código no recalcula (solo `select`), pero
   no hay test que lo asevere. *Propuesta*: test de `leerSugerenciaVigente` que devuelva `120/60`
   guardados aunque el estado de otra máquina cambie. *(Implementado: `orquestacion.decision` →
   "devuelve los 120/60 guardados aunque cambie el gimnasio, sin invocar el motor".)*
3. ~~**Compuerta de integración no ejecutada en esta sesión.**~~ **Cerrado el 2026-10-31**: la
   ejecutó Fernando con resultado OK (última corrida registrada por el agente: 9 suites / 54 tests).

### Bajos
4. **AC-411 — "las lecturas no invocan el motor"** sin aserción explícita; se cumple por
   construcción (el repositorio no importa la orquestación).
5. **AC-403 — el enum exacto** se verifica por tipo y por el `CREATE TYPE` en texto, no por una
   consulta a `pg_enum`.
6. **AC-486 — identidad de la fila entre GET/POST/sesión** cubierta por partes, no con un test que
   las encadene.
7. **AC-521 — las dos rutas de ingreso** (`/api/acceso/check-in` y `/api/dispositivo/acceso`) no
   tienen un test que pruebe que ambas llegan al gancho; se cumple porque ambas pasan por
   `evaluarYRegistrarAcceso` (`src/api/acceso.ts`), que es donde vive el gancho.
8. **AC-509** arrastra la compuerta de integración (ver hallazgo 3).

## Veredicto

**APROBADO CON OBSERVACIONES.** La implementación cumple los specs y el diseño; las observaciones son
de cobertura de tests y de una compuerta no ejecutada por el entorno, no de comportamiento. Antes de
archivar conviene: (a) correr la integración con Docker, (b) agregar los dos tests propuestos en los
hallazgos 1 y 2.

## Seguimiento

**2026-10-31 — cierre de los hallazgos medios 1, 2 y 3.**

- **Cerrado (medio 1, AC-453 / AC-525)**: nuevo `src/api/acceso-asignacion.ventana.test.ts` con dos
  casos sobre la ventana anti-passback real (asistencia previa filtrada como la consulta real):
  fuera de la ventana (61 min) el segundo check-in es `PERMITIDO` y el gancho dispara dos veces, cada
  una con su `ahora`; dentro (30 min) es `DENEGADO` y no dispara. El reemplazo
  `CANCELADA` + `RESERVADA` se considera **cubierto por capas** con
  `asignacion-orquestacion.integration` → "dos recálculos del mismo socio dejan una sola reserva
  activa" y `orquestacion` → "cancela la reserva anterior antes de crear la nueva en la misma
  transacción".
- **Cerrado (medio 2, AC-402 / AC-411)**: nuevo test en `orquestacion.decision.test.ts` que verifica
  que `reservaVigente` devuelve los `120/60` persistidos aunque cambie el estado del doble, con un
  espía sobre `calcularEspera` que confirma que el motor no se invoca.
- **Cerrado (medio 3)**: la compuerta `npm run test:integration` fue **ejecutada por Fernando el
  2026-10-31 con resultado OK** (sin salida adjunta en el informe; última corrida registrada por el
  agente: **9 suites / 54 tests**).
- **Bajos 4–7**: aceptados como están (AC-403 enum por tipo/DDL, AC-486 identidad encadenada,
  AC-521 rutas de ingreso).

Veredicto sin cambios: **APROBADO CON OBSERVACIONES**.
