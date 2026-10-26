# Asignación de Ejercicio — Persistencia Specification

## Purpose

Materializar en la base de datos la decisión del motor de espera: una fila por (socio, ejercicio, máquina) con estado, creación y vencimiento, de la que se derivan la ocupación actual y la cola de cada máquina. Esta capability es la fuente de verdad de la reserva. No calcula esperas (eso corresponde a `asignacion-orquestacion`) ni expone HTTP (eso corresponde a `asignacion-api`).

La tabla existe para que el motor de Etapa 3 deje de ser un módulo huérfano: la sugerencia se persiste antes de que el socio inicie la rutina, vence sin job de fondo y alimenta la simulación comparativa de la tesis (P-62) con la espera y el ahorro medidos en el momento de la decisión.

Estado: **especificado** — Etapa 4, previo al diseño. No modifica código ni datos.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `asignacion-ejercicio-persistencia` |
| Change | `asignacion-integracion` (Etapa 4) |
| Dependencias | Etapa 1 (`maquinas-crud`, D-73), Etapa 2 (`maquina-ejercicio-assignment`, D-74), Etapa 3 (`motor-espera-asignacion`, D-75+), `RutinaAsignada.activa` (RN-04), `SesionDeEntrenamiento` (D-44) |
| Consumidores | `asignacion-orquestacion` (construye `EntradaMotor` y escribe la reserva), `asignacion-api` (lee la sugerencia vigente), Etapa 5 (pantalla del socio y simulación) |
| Numeración AC | `AC-401…AC-414`. No colisiona con `AC-001…AC-015`, `AC-201…AC-217` ni `AC-301…AC-314` |

## Decisiones fijadas por esta spec

### Máquina de estados: `VENCIDA` derivada, no persistida

Se adopta la opción **(b)**: `VENCIDA` **no** es un estado del enum persistido. El enum persistido tiene exactamente cuatro valores: `RESERVADA | EN_CURSO | COMPLETADA | CANCELADA`. El vencimiento es una condición derivada:

> Una reserva está vencida si `estado = RESERVADA` y `venceEn <= ahora`.

Motivo: evitar un valor de enum que ningún camino de escritura produce (inalcanzable) y una escritura en caliente que el sistema no necesita porque no tiene cron. La fila vencida se ignora en todas las lecturas y permanece con `estado = RESERVADA` hasta que la reemplace una nueva reserva o hasta una limpieza batch futura (P-69, fuera de alcance).

La lista conceptual de cinco estados del proposal se conserva como documentación: `VENCIDA` describe una condición observable, no una fila escrita.

### El registro guarda la espera y el ahorro del motor

Se acepta y se fija como requisito: la fila **DEBE** guardar `esperaSegundos` y `ahorroSegundos` como instantánea (snapshot) de lo que el motor calculó al crear la reserva. No se rechaza. Recalcularlos al leer mezclaría la medición histórica con el estado actual del gimnasio y rompería la comparación de la tesis: el dato debe representar lo que el sistema sabía cuando tomó la decisión.

### Alcance del lock: global de la instalación

El cálculo y la persistencia de la reserva **DEBEN** ejecutarse en una única transacción que toma un advisory lock de PostgreSQL con **una clave constante global de la instalación** (no una clave por máquina). Motivo: el motor elige la máquina comparando todas las candidatas y todas las colas; la máquina ganadora no se conoce antes de calcular, por lo que un lock por máquina no puede adquirirse antes de la lectura. Un lock por máquina adquirido después de calcular solo serializaría la escritura y dejaría la lectura y la instantánea de espera obsoletas. La instalación es un único gimnasio (no existe una entidad `Gimnasio` en el modelo), así que la clave global no fragmenta nada y el volumen de check-in es bajo.

## Requirements

### Requirement: Registro persistente de la asignación

Cada fila de `AsignacionDeEjercicio` representa una reserva o una ejecución de un ejercicio por un socio. **MUST** contener, a nivel semántico:

- `socioId` (obligatorio), `ejercicioId` (obligatorio).
- `maquinaId`: obligatorio cuando `estado = RESERVADA`; en `EN_CURSO`, `COMPLETADA` y `CANCELADA` puede ser nulo cuando el ejercicio no tiene máquinas candidatas y la fila no representa una reserva de máquina.
- `sesionId`: nulo hasta que la reserva se consume; obligatorio desde `EN_CURSO`.
- `estado`: uno de los cuatro valores persistidos.
- `creadaEn`, `venceEn`.
- `esperaSegundos`, `ahorroSegundos`.

`esperaSegundos` y `ahorroSegundos` **MUST** ser enteros en segundos, `>= 0`, y **MUST** ser la instantánea del resultado del motor en el momento de crear la fila: `esperaSegundos` es la espera del ejercicio recomendado y `ahorroSegundos` es el ahorro devuelto por el motor. **MUST NOT** recalcularse al leer ni al cambiar la configuración. El diseño puede agregar campos de auditoría, pero no son parte de este contrato.

`venceEn` **MUST** calcularse al crear la fila como `creadaEn + minutosVencimientoReserva × 60 000 ms` y **MUST NOT** cambiar retroactivamente si el parámetro se modifica después. Una reserva creada con `minutosVencimientoReserva = 0` nace vencida (`venceEn = creadaEn`) y se ignora en todas las lecturas.

La fila **MUST NOT** escribir `Maquina.estado = OCUPADA` en ningún momento. La ocupación es derivada (ver requisito de ocupación).

#### Scenario: Check-in con rutina activa crea una reserva con la medición del motor

- GIVEN un socio con rutina activa y una recomendación del motor con `ejercicioId = E1`, `maquinaId = M1`, `espera = 120` y `ahorro = 60`
- WHEN la orquestación persiste la reserva en el check-in con `minutosVencimientoReserva = 15`
- THEN existe una fila `RESERVADA` con `socioId`, `ejercicioId = E1`, `maquinaId = M1`, `esperaSegundos = 120`, `ahorroSegundos = 60`
- AND `venceEn` es exactamente `creadaEn + 15 minutos`
- AND `sesionId` es nulo
- AND `Maquina.estado` de `M1` no cambió a `OCUPADA`

#### Scenario: La espera y el ahorro no se recalculan al leer

- GIVEN una reserva creada con `esperaSegundos = 120` y `ahorroSegundos = 60`
- WHEN el gimnasio cambia (otra máquina se libera) y la reserva se vuelve a leer
- THEN la fila sigue devolviendo `esperaSegundos = 120` y `ahorroSegundos = 60`

#### Scenario: Ejercicio sin máquinas candidatas

- GIVEN una recomendación con `ejercicioId = E1` y `maquinaId = null` porque `E1` no tiene máquinas asociadas
- WHEN la orquestación intenta persistir la reserva
- THEN no se crea ninguna fila `RESERVADA` para esa recomendación
- AND el flujo cae al orden de rutina como en el fallback

#### Scenario: El cambio de configuración no reescribe vencimientos existentes

- GIVEN una reserva creada con `venceEn = creadaEn + 15 minutos`
- WHEN el Administrador cambia `minutosVencimientoReserva` a 30
- THEN la reserva existente conserva su `venceEn` original
- AND solo las reservas nuevas usan 30 minutos

### Requirement: Máquina de estados

El estado persistido **MUST** ser exactamente uno de `RESERVADA`, `EN_CURSO`, `COMPLETADA` o `CANCELADA`. `VENCIDA` **MUST NOT** persistirse; se deriva con la regla `estado = RESERVADA AND venceEn <= ahora`.

Las transiciones permitidas son:

| Desde | Hacia | Disparador |
|---|---|---|
| (creación) | `RESERVADA` | Cálculo en check-in, inicio de rutina o posterior a un ejercicio, con máquina ganadora |
| `RESERVADA` | `EN_CURSO` | El socio inicia el ejercicio reservado; se fija `sesionId` |
| `RESERVADA` | `CANCELADA` | El socio elige `ESPERAR`, o un recálculo reemplaza la reserva anterior |
| `EN_CURSO` | `COMPLETADA` | Se registra la última serie de trabajo prescrita del ejercicio, o se finaliza la sesión |
| `EN_CURSO` | `CANCELADA` | Solo reasignación/cancelación por instructor de Etapa 5 (P-61); **no implementada en esta change** |

`COMPLETADA` y `CANCELADA` son terminales. **MUST NOT** existir ninguna otra transición, en particular `RESERVADA → VENCIDA`. Un intento de transición no permitida **MUST NOT** escribir la fila y **DEBE** reportarse como error de dominio.

`CANCELADA` cubre tanto la decisión `ESPERAR` como el reemplazo por recálculo. La fila cancelada conserva sus datos de medición; no se borra.

#### Scenario: Transición válida de reserva a ejecución

- GIVEN una fila `RESERVADA` de un socio para `E1` en `M1`
- WHEN el socio inicia el ejercicio reservado
- THEN la fila pasa a `EN_CURSO` y `sesionId` queda fijado
- AND no se crea una segunda fila para el mismo (socio, ejercicio, sesión)

#### Scenario: Transición inválida rechazada

- GIVEN una fila `COMPLETADA`
- WHEN cualquier camino intenta pasarla a `RESERVADA` o `EN_CURSO`
- THEN la transición se rechaza como error de dominio
- AND la fila permanece `COMPLETADA`

#### Scenario: Transición a VENCIDA no existe

- GIVEN una fila `RESERVADA` cuyo `venceEn` ya pasó
- WHEN se consulta su estado
- THEN la fila sigue con `estado = RESERVADA` en la base
- AND se la considera vencida solo por la condición derivada, sin escribir `VENCIDA`

### Requirement: Una sola reserva activa por socio

Un socio **MUST NOT** tener más de una reserva activa al mismo tiempo. A los efectos de este requisito, "reserva activa" es una fila `RESERVADA` no vencida. Una fila `EN_CURSO` no es una reserva activa y puede coexistir con una `RESERVADA` (el socio está ejecutando un ejercicio y tiene reservado el siguiente).

Cada recálculo que persiste una reserva nueva **MUST** pasar a `CANCELADA` la reserva activa anterior del socio, en la misma transacción y antes de crear la nueva. Un recálculo que termina en fallback (`sin_opciones`, `vacio` o `maquinaId = null`) **MUST** cancelar la reserva activa anterior y no crear una nueva. Un fallo del motor o de persistencia **MUST NOT** cancelar ni modificar la reserva anterior (best-effort: se conserva lo que había).

#### Scenario: El recálculo cancela la reserva anterior

- GIVEN un socio con una reserva activa `R1` para `E1` en `M1`
- WHEN se recalcula y el motor recomienda `E2` en `M2`
- THEN `R1` pasa a `CANCELADA`
- AND se crea `R2` en `RESERVADA` para `E2` en `M2`
- AND el socio queda con exactamente una reserva activa

#### Scenario: Un fallo no destruye la reserva existente

- GIVEN un socio con una reserva activa `R1`
- WHEN el motor devuelve `invalido` o la persistencia falla
- THEN `R1` sigue `RESERVADA` y no vencida
- AND no se crea ni se cancela ninguna otra fila

#### Scenario: Ejecución y reserva coexisten

- GIVEN un socio con una fila `EN_CURSO` para `E1` en `M1`
- WHEN el recálculo posterior crea una reserva para `E2` en `M2`
- THEN el socio tiene una fila `EN_CURSO` y una fila `RESERVADA` a la vez
- AND no se considera una violación de "una reserva activa"

### Requirement: Vencimiento perezoso

El sistema **MUST NOT** usar un job, cron ni escritura de estado para vencer reservas. Una reserva está vencida si `estado = RESERVADA` y `venceEn <= ahora` (comparación inclusiva). `ahora` **MUST** recibirse como parámetro inyectado; el módulo **MUST NOT** llamar a `Date.now()`.

Una fila vencida **MUST** ignorarse en todas las lecturas: no es la sugerencia vigente, no es ocupante, no aporta a ninguna cola y no puede aceptarse ni esperarse. La fila **MUST NOT** reescribirse a `VENCIDA` en caliente; si más tarde se reemplaza o se cancela, pasa a `CANCELADA`.

La limpieza batch de filas abandonadas queda fuera de alcance (P-69): el tamaño de la tabla crece hasta esa limpieza, pero la operación correcta no se ve afectada.

#### Scenario: Reserva vencida ignorada con reloj inyectado

- GIVEN una reserva `RESERVADA` con `venceEn = 2026-10-25T10:00:00Z`
- WHEN se consulta la sugerencia con `ahora = 2026-10-25T10:00:00Z` o posterior
- THEN la reserva no se devuelve como vigente
- AND no aparece como ocupante ni en la cola
- AND su `estado` persistido sigue siendo `RESERVADA`

#### Scenario: Reserva aún vigente en el límite

- GIVEN una reserva `RESERVADA` con `venceEn = 2026-10-25T10:00:00Z`
- WHEN se consulta con `ahora = 2026-10-25T09:59:59Z`
- THEN la reserva se considera vigente y puede ser la sugerencia actual

### Requirement: Ocupación derivada de sesiones y ejecuciones

El ocupante de una máquina `M` **MUST** ser un socio que tiene una `SesionDeEntrenamiento` en `EN_CURSO` y, además, cumple una de estas dos condiciones:

1. **Con fila de ejecución**: tiene una fila `AsignacionDeEjercicio` en `EN_CURSO` con `maquinaId = M`, cuyo `sesionId` es esa sesión, y su `ejercicioId` coincide con el `ejercicioActualId` de la sesión. La fila es la fuente de verdad de la máquina.
2. **Sin fila de ejecución**: no tiene fila `EN_CURSO`, pero el `ejercicioActualId` de la sesión tiene exactamente una máquina candidata, que es `M`.

Con cero o varias candidatas y sin fila, la sesión no identifica una máquina y **MUST NOT** aportar ocupante (limitación declarada; la orquestación crea la fila al iniciar cada ejercicio cuando la máquina es determinable).

`seriesRestantes` **MUST** calcularse como:

```
seriesRestantes = prescripcion.series
                − count(RegistroDeProgreso
                        where sesionId = sesión
                          and ejercicioId = ejercicio
                          and tipo IN (NORMAL, HASTA_EL_FALLO)
                          and numeroSerie between 1 and prescripcion.series)
```

donde `prescripcion` es el `EjercicioEnRutina` del ejercicio en la rutina activa del ocupante. `CALENTAMIENTO` y `DROP_SET` **MUST NOT** contar nunca, aunque tengan `numeroSerie` por error. Los registros previos a D-64 sin `tipo` explícito cuentan como `NORMAL` (default del esquema).

El ocupante **MUST** incluirse solo si `seriesRestantes >= 1` (D-87). Si el cálculo da `0` o menos, el socio ya terminó y la máquina está libre: **MUST NOT** figurar como ocupante. El `descanso` del ocupante **MUST** ser el `EjercicioEnRutina.descanso` de su ejercicio.

Si por una anomalía de datos existiera más de una fila `EN_CURSO` para la misma sesión, **DEBE** usarse la de `creadaEn` más reciente y registrar la anomalía en el log del servidor.

#### Scenario: Series restantes ignoran calentamiento y drop set

- GIVEN un ocupante con prescripción de 3 series y registros: un `CALENTAMIENTO`, una serie `NORMAL` (`numeroSerie = 1`) y un `DROP_SET`
- WHEN se deriva su `seriesRestantes`
- THEN el resultado es `2` (3 − 1), porque solo cuenta la serie `NORMAL`
- AND el calentamiento y el drop set no descuentan series

#### Scenario: Ocupante con cero series restantes no ocupa

- GIVEN un socio con sesión `EN_CURSO` y tres series de trabajo registradas para una prescripción de 3 series
- WHEN se deriva la ocupación de su máquina
- THEN el socio no se incluye como ocupante
- AND la máquina queda sin ocupante aunque la sesión siga `EN_CURSO`

#### Scenario: Registros fuera del rango prescrito no descuentan

- GIVEN una prescripción de 2 series y registros `NORMAL` con `numeroSerie = 1`, `2` y `3`
- WHEN se deriva `seriesRestantes`
- THEN el resultado es `0`, porque el conteo se limita a `1..prescripcion.series`
- AND el socio no es ocupante

#### Scenario: El descanso del ocupante es el de su ejercicio

- GIVEN un ocupante ejecutando `E1` cuyo `EjercicioEnRutina.descanso` es 90
- WHEN se construye su entrada de ocupante
- THEN `descanso = 90`, independientemente del descanso del ejercicio pendiente del socio que consulta

#### Scenario: Sesión sin fila con una única máquina candidata

- GIVEN una sesión `EN_CURSO` sin fila `EN_CURSO` cuyo ejercicio actual tiene exactamente una máquina candidata `M1`
- WHEN se deriva la ocupación
- THEN `M1` tiene a ese socio como ocupante con su `seriesRestantes` y su descanso
- AND si el ejercicio tuviera dos o más candidatas, no aportaría ocupante

### Requirement: Cola derivada de reservas de terceros

La cola de una máquina `M` **MUST** ser la lista de filas `RESERVADA` no vencidas de **otros** socios sobre `M`, ordenada por `creadaEn` ascendente y, en empate, por `id` ascendente.

Cada miembro de la cola **MUST** aportar:

- `series`: las series prescritas de su ejercicio en su rutina activa (`EjercicioEnRutina.series`).
- `descanso`: el `EjercicioEnRutina.descanso` de ese mismo ejercicio (D-82), no el descanso del socio que consulta.

Una fila `RESERVADA` que no pueda resolverse a un `EjercicioEnRutina` de una rutina activa (rutina desactivada, ejercicio eliminado o inconsistencia equivalente) **MUST NOT** aportar a la cola y **DEBE** registrarse como anomalía en el log. Una fila vencida **MUST NOT** aportar. Una fila `EN_CURSO` no es cola.

#### Scenario: Orden de la cola por creación

- GIVEN tres reservas no vencidas sobre `M1` creadas en orden `R1`, `R2`, `R3` por socios distintos
- WHEN se construye la cola de `M1`
- THEN el orden es `R1`, `R2`, `R3`
- AND cada miembro aporta sus propias `series` y su propio `descanso`

#### Scenario: Reserva vencida no aporta a la cola

- GIVEN una reserva de otro socio sobre `M1` con `venceEn` anterior a `ahora`
- WHEN se construye la cola de `M1`
- THEN esa reserva no aparece en la cola

#### Scenario: Reserva sin rutina activa no aporta

- GIVEN una fila `RESERVADA` de otro socio sobre `M1` cuya rutina fue desactivada
- WHEN se construye la cola de `M1`
- THEN la fila no aporta a la cola
- AND se registra la anomalía en el servidor

### Requirement: Exclusión del propio socio (P-67)

Para el cálculo de un socio, sus propias filas **MUST NOT** aparecer como ocupante ni en ninguna cola, en ningún estado. La consulta de ocupación y la de cola **MUST** excluir explícitamente `socioId = socioActual`. Esta exclusión **MUST** tener un test dedicado: sin ella, el recálculo vería al propio socio ocupando la máquina que acaba de reservar y calcularía una espera incorrecta.

#### Scenario: La propia reserva no se ve como ocupante ni como cola

- GIVEN un socio con una reserva activa sobre `M1`
- WHEN se calcula su propia sugerencia
- THEN `M1` no lo tiene como ocupante
- AND su reserva no aparece en la cola de `M1`
- AND el test dedicado de P-67 falla si se quita la exclusión

#### Scenario: La propia ejecución tampoco ocupa

- GIVEN un socio con una fila `EN_CURSO` sobre `M1`
- WHEN se calcula su propia sugerencia
- THEN `M1` no lo tiene como ocupante para ese cálculo

### Requirement: Lecturas del repositorio

La capa de persistencia **MUST** exponer lecturas deterministas, sin invocar el motor y sin leer el reloj por su cuenta:

- **Sugerencia vigente**: la fila `RESERVADA` no vencida del socio con `creadaEn` más reciente (desempate por `id` descendente), o `null`. Si por anomalía hubiera más de una, **DEBE** devolver la más reciente y registrar la anomalía.
- **Ejercicios pendientes**: los ejercicios de la rutina activa del socio que no tienen todas sus series de trabajo prescritas registradas en la sesión en curso. Sin sesión en curso, todos los ejercicios de la rutina activa son pendientes. Sin rutina activa, la lista es vacía. Orden: `orden` ascendente, luego `id` ascendente.
- **Ocupantes**: por máquina, según el requisito de ocupación derivada.
- **Cola**: por máquina, según el requisito de cola derivada.

Todas las lecturas **MUST** aceptar `ahora` cuando el vencimiento influya y **MUST** ser repetibles para el mismo estado y el mismo `ahora`.

#### Scenario: Sugerencia vigente única

- GIVEN un socio con una sola reserva `RESERVADA` no vencida
- WHEN se lee su sugerencia vigente
- THEN se devuelve esa fila

#### Scenario: Sin sugerencia vigente

- GIVEN un socio sin reservas o con todas vencidas
- WHEN se lee su sugerencia vigente
- THEN se devuelve `null`

#### Scenario: Ejercicios pendientes tras completar uno

- GIVEN una rutina activa con `E1` (2 series) y `E2` (3 series), y una sesión en curso donde `E1` ya tiene sus 2 series de trabajo registradas
- WHEN se leen los ejercicios pendientes
- THEN solo `E2` es pendiente

### Requirement: Concurrencia y transacción de reserva

El cálculo del motor y la persistencia de la reserva **MUST** ejecutarse dentro de una única transacción de base de datos que **MUST** adquirir un advisory lock de PostgreSQL con una clave constante global de la instalación (`pg_advisory_xact_lock`), antes de leer el estado y hasta el commit. El lock **MUST** cubrir la lectura, el cálculo, la cancelación de la reserva anterior y la escritura de la nueva; **MUST NOT** limitarse al `INSERT`.

Garantías observables:

1. **Como máximo una reserva activa por socio**: dos recálculos concurrentes del mismo socio no dejan dos filas `RESERVADA` no vencidas.
2. **Orden de cola coherente con la creación**: una reserva que se crea después ve las anteriores, de modo que el orden de la cola es el orden de creación y la instantánea `esperaSegundos` incluye la cola vigente al commit.
3. **Atomicidad**: si falla cualquier paso, no queda una reserva parcial ni una cancelación sin reemplazo.

El diseño **PUEDE** agregar una restricción de unicidad parcial como defensa en profundidad, pero el advisory lock es obligatorio. La prueba **DEBE** ejecutarse contra PostgreSQL en Docker (D-53), no contra el pooler de Supabase, con dos check-in concurrentes sobre la misma máquina: se verifica que no hay doble reserva activa por socio, que una reserva queda en cola detrás de la otra y que el orden observado coincide con el orden de creación.

#### Scenario: Dos reservas concurrentes sobre la misma máquina

- GIVEN dos socios con rutina activa y una única máquina `M1` candidata para ambos
- WHEN ambos check-in se ejecutan concurrentemente contra PostgreSQL en Docker
- THEN se crean como máximo dos filas `RESERVADA` sobre `M1`, una por socio
- AND el orden de la cola coincide con el orden de creación
- AND ningún socio queda con dos reservas activas

#### Scenario: Dos recálculos concurrentes del mismo socio

- GIVEN un socio con una reserva previa que dispara dos recálculos concurrentes
- WHEN ambas transacciones compiten por el lock
- THEN una gana y crea su reserva; la otra ve el estado actualizado
- AND al final hay exactamente una reserva activa para ese socio

#### Scenario: Fallo dentro de la transacción no deja residuo

- GIVEN una transacción de reserva que ya canceló la reserva anterior y falla antes de crear la nueva
- WHEN la transacción se revierte
- THEN la reserva anterior sigue `RESERVADA`
- AND no existe una fila nueva
- AND el fallo se propaga como fallo de persistencia para el tratamiento best-effort

### Requirement: Migración aditiva

La tabla **MUST** crearse con una migración aditiva y escrita a mano: `CREATE TABLE` más los índices necesarios (al menos por `(socioId, estado, venceEn)` y `(maquinaId, estado, creadaEn)`; el diseño fija nombres y columnas exactas). La migración **MUST NOT** contener `DROP` ni `ALTER` sobre tablas existentes, **MUST NOT** tocar filas de otras tablas y **MUST** incluir el SQL de rollback como comentario al pie (`DROP TABLE IF EXISTS`).

La migración **MUST** aplicarse limpiamente sobre la base efímera de Docker del suite de integración antes de considerarse lista. No se agregan seeds ni datos de ejemplo.

#### Scenario: Migración sin destrucción

- GIVEN el archivo de migración de la tabla
- WHEN se inspecciona su SQL
- THEN contiene exactamente un `CREATE TABLE` y los `CREATE INDEX` previstos
- AND contiene 0 `DROP` y 0 `ALTER` sobre tablas existentes
- AND aplica sobre PostgreSQL en Docker sin errores

#### Scenario: Rollback documentado

- GIVEN la migración aplicada
- WHEN se ejecuta el rollback comentado al pie
- THEN la tabla `AsignacionDeEjercicio` desaparece
- AND ninguna otra tabla ni fila se modifica

### Requirement: Prohibición de escribir `OCUPADA`

Ningún camino de esta capability **MUST** escribir `Maquina.estado = OCUPADA`. El estado de la máquina se lee del catálogo y la ocupación se deriva de las ejecuciones `EN_CURSO`. Esta regla es coherente con D-73 y con el motor de Etapa 3, que ya trata `OCUPADA` como estado usable y toma la ocupación real de la entrada.

#### Scenario: Reservar no cambia el estado de la máquina

- GIVEN una máquina `M1` en estado `DISPONIBLE`
- WHEN se crea, consume o completa una reserva sobre `M1`
- THEN `Maquina.estado` sigue `DISPONIBLE`
- AND ningún test de integración observa una escritura de `OCUPADA`

## Escenarios

| # | Nombre | Qué demuestra | Resultado esperado |
|---|---|---|---|
| 1 | Check-in con rutina activa | La reserva persiste con la medición del motor | `RESERVADA` con `esperaSegundos` y `ahorroSegundos` |
| 2 | Snapshot inmutable | La espera y el ahorro no se recalculan al leer | Valores originales |
| 3 | Sin máquina candidata | No se reserva un ejercicio sin máquina | Sin fila; fallback |
| 4 | Cambio de configuración | El vencimiento no se reescribe retroactivamente | `venceEn` original |
| 5 | Transición a `EN_CURSO` | Consumo de la reserva al iniciar | `EN_CURSO` + `sesionId` |
| 6 | Transición inválida | La máquina de estados se respeta | Error de dominio; fila intacta |
| 7 | `VENCIDA` no persistida | Vencimiento derivado | `estado = RESERVADA` |
| 8 | Recálculo reemplaza reserva | Una sola reserva activa | Anterior `CANCELADA`; nueva `RESERVADA` |
| 9 | Fallo no destruye reserva | Best-effort conserva lo anterior | Reserva anterior intacta |
| 10 | Ejecución + reserva | Coexistencia válida | Una `EN_CURSO` y una `RESERVADA` |
| 11 | Vencimiento en el límite | Comparación inclusiva | Vencida en `venceEn`; vigente un segundo antes |
| 12 | Calentamiento y drop set | Filtro de series de trabajo | `seriesRestantes` correcto |
| 13 | Cero series restantes | No es ocupante (D-87) | Máquina libre |
| 14 | Series fuera de rango | Conteo limitado a la prescripción | `seriesRestantes = 0` |
| 15 | Descanso del ocupante | Descanso per-actor (D-82) | Descanso de su ejercicio |
| 16 | Orden de cola | Orden por creación | `R1`, `R2`, `R3` |
| 17 | Vencida fuera de cola | Vencimiento perezoso | No aporta |
| 18 | Reserva sin rutina activa | Cola robusta | No aporta; log |
| 19 | P-67 | Exclusión del propio socio | No es ocupante ni cola |
| 20 | Sugerencia vigente | Lectura determinista | Fila más reciente o `null` |
| 21 | Pendientes tras completar | Definición de pendiente | Solo los no completados |
| 22 | Concurrencia misma máquina | Advisory lock global (Docker) | Sin doble reserva; orden correcto |
| 23 | Concurrencia mismo socio | Lock global (Docker) | Una sola reserva activa |
| 24 | Fallo transaccional | Atomicidad | Sin residuo |
| 25 | Migración aditiva | Sin destrucción | 0 `DROP`/`ALTER`; aplica en Docker |
| 26 | Sin `OCUPADA` | Ocupación derivada | `Maquina.estado` sin cambios |
| 27 | Sesión sin fila, máquina única | Ocupación por candidata única | `M1` ocupada; con varias, sin ocupante |

## Acceptance Criteria

- **AC-401**: Existe `AsignacionDeEjercicio` con `socioId`, `ejercicioId`, `maquinaId` (obligatorio en `RESERVADA`; nullable en `EN_CURSO`/`COMPLETADA`/`CANCELADA` sin máquinas candidatas), `sesionId` (nulo hasta `EN_CURSO`), `estado`, `creadaEn`, `venceEn`, `esperaSegundos` y `ahorroSegundos`.
- **AC-402**: `esperaSegundos` y `ahorroSegundos` son enteros `>= 0`, se escriben como instantánea del motor al crear la fila y no se recalculan al leer ni al cambiar la configuración.
- **AC-403**: El enum persistido tiene exactamente `RESERVADA`, `EN_CURSO`, `COMPLETADA` y `CANCELADA`; `VENCIDA` no se persiste y el vencimiento se deriva con `estado = RESERVADA AND venceEn <= ahora`.
- **AC-404**: Solo se permiten las transiciones de la tabla; `COMPLETADA` y `CANCELADA` son terminales; `EN_CURSO → CANCELADA` no se implementa en esta change; una transición inválida no escribe.
- **AC-405**: Un socio tiene como máximo una fila `RESERVADA` no vencida; el recálculo cancela la anterior en la misma transacción; una fila `EN_CURSO` puede coexistir con una `RESERVADA`.
- **AC-406**: El vencimiento es perezoso, con reloj inyectado, comparación inclusiva y sin escritura de `VENCIDA`; `venceEn` no cambia retroactivamente; la fila vencida se ignora en todas las lecturas.
- **AC-407**: El ocupante se deriva de sesión `EN_CURSO` + fila `EN_CURSO` sobre la máquina o, sin fila, de la única máquina candidata del ejercicio; `seriesRestantes` se calcula por la fórmula y `descanso` sale del `EjercicioEnRutina`.
- **AC-408**: `CALENTAMIENTO` y `DROP_SET` no descuentan series; el conteo se limita a `numeroSerie` entre 1 y `prescripcion.series`; `seriesRestantes < 1` excluye al ocupante.
- **AC-409**: La cola son las filas `RESERVADA` no vencidas de otros socios, ordenadas por `creadaEn` y `id`, cada una con sus `series` y su `descanso`; una fila no resoluble a rutina activa no aporta y se loguea.
- **AC-410**: La exclusión P-67 impide que las filas del propio socio aparezcan como ocupante o en cola, con test dedicado.
- **AC-411**: Las lecturas de sugerencia vigente, pendientes, ocupantes y cola son deterministas, no invocan el motor y no leen el reloj por su cuenta.
- **AC-412**: Cálculo y reserva corren en una transacción con `pg_advisory_xact_lock` de clave global; se garantiza una reserva activa por socio y orden de cola por creación; la prueba corre contra PostgreSQL en Docker.
- **AC-413**: La migración es aditiva (`CREATE TABLE` + índices, 0 `DROP`/`ALTER`, rollback comentado) y aplica limpiamente en Docker.
- **AC-414**: Ningún camino escribe `Maquina.estado = OCUPADA`; la ocupación es derivada.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Registro persistente de la asignación | 1, 2, 3, 4 | AC-401, AC-402 |
| Máquina de estados | 5, 6, 7 | AC-403, AC-404 |
| Una sola reserva activa por socio | 8, 9, 10 | AC-405 |
| Vencimiento perezoso | 11, 17 | AC-406 |
| Ocupación derivada | 12, 13, 14, 15, 27 | AC-407, AC-408 |
| Cola derivada | 16, 17, 18 | AC-409 |
| Exclusión del propio socio (P-67) | 19 | AC-410 |
| Lecturas del repositorio | 20, 21 | AC-411 |
| Concurrencia y transacción | 22, 23, 24 | AC-412 |
| Migración aditiva | 25 | AC-413 |
| Prohibición de escribir `OCUPADA` | 26 | AC-414 |

## Fuera de alcance

- El cálculo de esperas y la elección de la máquina (motor de Etapa 3; no se modifica).
- La construcción de `EntradaMotor`, los tres momentos de cálculo y el best-effort del check-in (`asignacion-orquestacion`).
- Los endpoints HTTP y sus permisos (`asignacion-api`).
- La pantalla del socio, la reasignación por instructor y la salida de emergencia (Etapa 5, P-61).
- La limpieza batch de reservas abandonadas (P-69); el vencimiento perezoso es suficiente para operar.
- El job de simulación comparativa de la tesis (P-62).
- Cambios a `EstadoMaquina`, `Maquina`, `SesionDeEntrenamiento`, `RegistroDeProgreso`, `MotorEspera` o `home-interno.ts`.
- La definición final de DDL, nombres de índices y tipos TypeScript (fase de diseño).

## Contrato de datos

Nota semántica; el DDL y los tipos son responsabilidad del diseño.

| Campo | Semántica |
|---|---|
| `socioId` | Socio dueño de la reserva o ejecución. |
| `ejercicioId` | Ejercicio de la rutina activa al que se refiere la fila. |
| `maquinaId` | Máquina reservada u ocupada. Obligatorio en `RESERVADA`; nullable en `EN_CURSO`, `COMPLETADA` y `CANCELADA` cuando el ejercicio no tiene máquinas candidatas. |
| `sesionId` | Sesión que consume la reserva. Nulo hasta `EN_CURSO`. |
| `estado` | `RESERVADA | EN_CURSO | COMPLETADA | CANCELADA`. |
| `creadaEn` | Instante de creación; clave de orden de la cola. |
| `venceEn` | Instante de vencimiento; `creadaEn + minutosVencimientoReserva`. |
| `esperaSegundos` | Espera calculada por el motor para el ejercicio recomendado, en segundos, `>= 0`. |
| `ahorroSegundos` | Ahorro calculado por el motor, en segundos, `>= 0`. |

Invariantes semánticos: una `RESERVADA` por socio; `venceEn` inmutable; snapshots inmutables; `OCUPADA` nunca escrito.

## Numeración

- Decisiones: **D-88+** (última registrada D-87).
- Tareas: **T-056+** (última registrada T-055d).
- Pendientes: **P-68+**; esta change cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70. Esta spec no crea decisiones por sí misma: las decisiones de diseño se registran en la fase siguiente.
