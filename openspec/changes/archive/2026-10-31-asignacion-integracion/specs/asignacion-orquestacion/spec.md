# Asignación — Orquestación Specification

## Purpose

Conectar el motor puro de espera con la operación real: construir `EntradaMotor` desde la base, invocarlo en los tres momentos que fija la etapa (check-in, inicio de rutina y después de cada ejercicio), persistir la reserva ganadora, aplicar la decisión obligatoria `ACEPTAR` / `ESPERAR`, resolver el fallback al orden de rutina y contener los fallos para que nunca rompan el check-in ni la sesión.

Esta capability es la única que conoce a la vez el motor, la persistencia y la sesión. El motor de Etapa 3 se consume **tal cual**: no se modifica su código, sus tipos ni su contrato.

Estado: **especificado** — Etapa 4, previo al diseño. No modifica código.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `asignacion-orquestacion` |
| Change | `asignacion-integracion` (Etapa 4) |
| Dependencias | `asignacion-ejercicio-persistencia`, `motor-espera-asignacion` (Etapa 3), `configuracion-sistema` (D-54), `SesionDeEntrenamiento` (D-44), `RutinaAsignada.activa` (RN-04) |
| Consumidores | `member-access-check` (gancho de check-in), `asignacion-api` (lectura y decisión), Etapa 5 (pantalla del socio) |
| Numeración AC | `AC-441…AC-455`. No colisiona con los rangos usados (`AC-001…`, `AC-201…`, `AC-301…`, `AC-401…`) |

## Relación con `motor-espera-asignacion`

Esta change **NO** incluye un delta de `motor-espera-asignacion` y **NO** crea un archivo de spec para esa capability. El módulo puro `src/domains/asignacion/motor-espera.ts` **MUST NOT** modificarse: se consume como una caja negra que recibe `EntradaMotor` y devuelve `ResultadoMotor`. Los únicos cambios son los llamantes, la persistencia y la sesión.

La integración se apoya en estas propiedades ya especificadas del motor: resultado discriminado (`exito | sin_opciones | vacio | invalido`), `maquinaId` en la sugerencia, `ahorro >= 0`, determinismo, validación estructurada sin excepciones y códigos de bloqueo tipados. El motor sigue sin leer base de datos, sin consultar el reloj y sin hacer I/O.

## Requirements

### Requirement: Construcción de `EntradaMotor` desde la base

La orquestación **MUST** construir una `EntradaMotor` completa y determinista a partir de las lecturas de `asignacion-ejercicio-persistencia`, sin modificar el motor:

- **Ejercicios pendientes**: los de la rutina activa del socio (RN-04) que aún no completaron sus series de trabajo prescritas en la sesión en curso; en el check-in, todos los de la rutina activa. Cada uno con `id`, `orden`, `series` y `descanso` de `EjercicioEnRutina`, y `candidatos` con los `maquinaId` de `EjercicioMaquina`. Orden: `orden` ascendente, luego `id` ascendente. En el inicio de rutina y después de cada ejercicio, la orquestación **MUST** excluir de esta lista el ejercicio actual de la sesión (el que se está por comenzar o se acaba de completar); el repositorio devuelve todos los no completados y la orquestación aplica esa exclusión.
- **Máquinas**: las que aparecen en la unión de candidatos de los ejercicios pendientes y existen en el catálogo. Cada una con `id`, `estado` leído de `Maquina.estado`, `ocupante` derivado y `cola` derivada. Una máquina referenciada que no existe se deja fuera; el motor ya define que un `id` colgante no lanza y no aporta estado.
- **Parámetros**: `segundosEjecucionSerie` (default 60) y `minutosInactividadSesion` (default 30) desde `getConfiguracion()`. La orquestación **MUST NOT** hardcodearlos y **MUST** pasar `minutosInactividadSesion` al plan de lectura de ocupantes.
- **Reloj**: `ahora` recibido como parámetro para filtrar reservas vencidas, fijar `venceEn` y calcular el corte de inactividad (`ahora − minutosInactividadSesion × 60 000 ms`). El repositorio **MUST NOT** leer el reloj.

La orquestación **MUST NOT** agregar ejercicios bloqueados, ejercicios de otra rutina ni máquinas que no sean candidatas de un ejercicio pendiente. La `EntradaMotor` **MUST NOT** incluir las filas del propio socio como ocupante ni en cola (P-67).

#### Scenario: Entrada con ejercicios, candidatos, ocupante y cola

- GIVEN un socio con rutina activa `E1` (orden 1, 2 series, descanso 90) y `E2` (orden 2, 1 serie, descanso 60), con `E1` candidato a `M1` y `E2` candidato a `M1` y `M2`
- AND `M1` tiene un ocupante con 2 series restantes y un miembro en cola, y `M2` está libre
- WHEN se construye la entrada
- THEN `ejercicios` contiene `E1` y `E2` con sus candidatos
- AND `maquinas` contiene `M1` y `M2` con estado, ocupante y cola
- AND `parametros.segundosEjecucionSerie` es el valor configurado

#### Scenario: Sin rutina activa no se construye entrada

- GIVEN un socio sin rutina activa
- WHEN se intenta calcular
- THEN la lista de pendientes es vacía y no se invoca el motor
- AND no se crea ni se cancela ninguna reserva

#### Scenario: Las máquinas no candidatas no entran

- GIVEN una máquina `M9` que no es candidata de ningún ejercicio pendiente
- WHEN se construye la entrada
- THEN `M9` no aparece en `maquinas`

#### Scenario: La ventana de inactividad viaja al plan de lectura

- GIVEN `minutosInactividadSesion = 30` y `ahora = 2026-10-25T10:00:00Z`
- WHEN la orquestación construye la entrada
- THEN la lectura de ocupantes recibe `ahora` y `minutosInactividadSesion = 30`
- AND el repositorio calcula el corte como `ahora − 30 minutos` sin leer el reloj

### Requirement: Tres momentos de cálculo

El cálculo **MUST** dispararse en exactamente estos tres momentos, con el mismo servicio de orquestación:

1. **Check-in**: después de que la asistencia quedó registrada, solo si el acceso fue permitido y el socio tiene rutina activa. Es best-effort (ver requisito de best-effort).
2. **Inicio de rutina**: al crear la sesión, después de consumir la reserva aceptada del primer ejercicio (si existe), para calcular los ejercicios restantes.
3. **Después de cada ejercicio**: al completarse la última serie de trabajo del ejercicio en curso, antes de seleccionar el siguiente.

En los tres momentos, el cálculo opera sobre los ejercicios **pendientes** en ese instante. En el inicio y después de cada ejercicio, el ejercicio que se está por comenzar o se acaba de completar no forma parte de la recomendación: la recomendación es para el siguiente ejercicio.

Un check-in denegado (cuota, cuenta, anti-passback) **MUST NOT** disparar el cálculo. Un socio sin rutina activa **MUST NOT** disparar el cálculo. No hay otros momentos: ni un job periódico, ni un GET de la API que persista, ni un evento de máquina.

#### Scenario: Check-in permitido con rutina activa dispara el cálculo

- GIVEN un socio con rutina activa y un check-in cuyo resultado no es `DENEGADO`
- WHEN se registra la asistencia
- THEN se ejecuta el cálculo una vez y se persiste la reserva si corresponde

#### Scenario: Check-in denegado no dispara el cálculo

- GIVEN un socio con cuota vencida o dentro de la ventana anti-passback
- WHEN el check-in resulta `DENEGADO`
- THEN no se ejecuta el cálculo
- AND no se cancela ni se modifica ninguna reserva existente

#### Scenario: Inicio de rutina calcula para los restantes

- GIVEN un socio con una reserva aceptada para el primer ejercicio
- WHEN inicia la sesión
- THEN consume la reserva como ejercicio actual
- AND el cálculo se ejecuta para los ejercicios restantes

#### Scenario: Después de un ejercicio se recalcula

- GIVEN una sesión en curso que completó la última serie de `E1`
- WHEN se registra la serie final
- THEN `E1` se marca `COMPLETADA` y el cálculo se ejecuta para los ejercicios restantes

### Requirement: Persistencia de la reserva ganadora

Si el resultado del motor es `exito` y su `recomendado.maquinaId` no es nulo, la orquestación **MUST** persistir una fila `RESERVADA` con:

- `socioId`, `ejercicioId = recomendado.ejercicioId`, `maquinaId = recomendado.maquinaId`.
- `esperaSegundos = recomendado.espera`.
- `ahorroSegundos = resultado.ahorro`.
- `creadaEn = ahora`, `venceEn = ahora + minutosVencimientoReserva × 60 000 ms`.
- `sesionId = null`.

La persistencia **MUST** ocurrir en la misma transacción y bajo el mismo advisory lock que el cálculo (ver `asignacion-ejercicio-persistencia`). Antes de crear la nueva reserva, la orquestación **MUST** cancelar la reserva activa anterior del socio en esa transacción. Si no hay una recomendación persistible (`sin_opciones`, `vacio` o `maquinaId = null`), **MUST NOT** crear una fila y **MUST** cancelar la reserva activa anterior.

La orquestación **MUST NOT** persistir una reserva si el socio no tiene rutina activa, si el ejercicio recomendado no pertenece a la rutina activa o si la máquina recomendada no está entre sus candidatas. Esas condiciones son entrada inválida para el motor y se tratan como fallo contenido (ver `invalido`).

#### Scenario: Reserva persistida con la recomendación

- GIVEN un resultado `exito` con `recomendado = { ejercicioId: E2, maquinaId: M2, espera: 180 }` y `ahorro = 60`
- WHEN la orquestación persiste
- THEN existe una fila `RESERVADA` para `E2` en `M2` con `esperaSegundos = 180` y `ahorroSegundos = 60`

#### Scenario: Recomendación sin máquina no reserva

- GIVEN un resultado `exito` cuyo `recomendado.maquinaId` es `null`
- WHEN la orquestación procesa el resultado
- THEN no se crea una fila `RESERVADA`
- AND la reserva activa anterior, si existía, pasa a `CANCELADA`
- AND el flujo sigue el orden de rutina

#### Scenario: La reserva anterior se cancela en la misma transacción

- GIVEN un socio con una reserva activa previa
- WHEN se persiste una nueva recomendación
- THEN la anterior pasa a `CANCELADA` y la nueva a `RESERVADA` en la misma transacción
- AND si la transacción falla, la anterior sigue `RESERVADA`

### Requirement: Decisión obligatoria `ACEPTAR` / `ESPERAR`

El socio solo puede **ACEPTAR** la recomendación vigente o **ESPERAR** el siguiente ejercicio en orden de rutina. **MUST NOT** existir una tercera opción, una elección libre de máquina ni un endpoint que permita reservar una máquina arbitraria.

- **ACEPTAR**: no cambia el estado de la reserva (la fila ya nace utilizable). Es idempotente: repetir la acción sobre la misma reserva vigente devuelve el mismo resultado y no crea otra fila.
- **ESPERAR**: pasa la reserva vigente a `CANCELADA` y el socio sigue el orden de rutina. No se crea una reserva alternativa en el mismo acto.

La decisión no cambia el ejercicio que el socio ya está ejecutando. Si no hay sugerencia vigente, la acción se rechaza según el contrato de `asignacion-api`.

#### Scenario: Aceptar mantiene la reserva

- GIVEN una reserva `RESERVADA` vigente del socio
- WHEN el socio acepta
- THEN la reserva sigue `RESERVADA` y con el mismo `venceEn`
- AND no se crea una segunda fila
- AND aceptar de nuevo produce el mismo resultado

#### Scenario: Esperar cancela y sigue el orden de rutina

- GIVEN una reserva `RESERVADA` vigente del socio
- WHEN el socio espera
- THEN la reserva pasa a `CANCELADA`
- AND el socio no tiene una reserva activa
- AND el siguiente ejercicio se rige por el orden de rutina

#### Scenario: No hay elección libre de máquina

- GIVEN una reserva vigente para `E1` en `M1`
- WHEN el socio intenta aceptar `E1` en `M2`
- THEN la petición no tiene un campo para elegir máquina y no se modifica la reserva

### Requirement: Fallback silencioso al orden de rutina

Si el motor devuelve `sin_opciones` o `vacio`, o si la recomendación no tiene máquina, la orquestación **MUST** aplicar un fallback silencioso: cancelar la reserva activa anterior (si existe), no crear una nueva y dejar que la sesión siga el orden de rutina como hoy. El fallback **MUST NOT** lanzar una excepción, **MUST NOT** bloquear el check-in ni la sesión y **MUST NOT** registrarse como error de servidor; a lo sumo, un log informativo.

`sin_opciones` significa que todos los ejercicios pendientes están bloqueados; `vacio` significa que no hay pendientes. En ambos casos el socio no recibe sugerencia.

#### Scenario: Fallback por `sin_opciones`

- GIVEN un resultado `sin_opciones` porque todas las máquinas candidatas están fuera de servicio
- WHEN la orquestación procesa el resultado
- THEN no se crea una reserva
- AND la reserva anterior, si existía, se cancela
- AND el flujo continúa por orden de rutina sin error

#### Scenario: Fallback por `vacio`

- GIVEN un socio sin ejercicios pendientes
- WHEN la orquestación calcula
- THEN el resultado es `vacio` y no se crea una reserva
- AND no se lanza ninguna excepción

### Requirement: Tratamiento de `invalido`

Cuando el motor devuelve `invalido`, la orquestación **MUST** tratarlo como un error de servidor: registrarlo en el log con contexto suficiente (socio, momento del cálculo y validación fallida) y **MUST NOT** propagar la excepción al check-in, a la sesión ni a la API. **MUST NOT** crear, cancelar ni modificar reservas ante un `invalido`; se conserva el estado anterior.

`invalido` indica un defecto en quien armó la `EntradaMotor` o un parámetro de configuración inválido (por ejemplo, `segundosEjecucionSerie = 0`), no una condición de negocio. Por eso se loguea como error y no se confunde con el fallback.

#### Scenario: `invalido` se loguea y no rompe el check-in

- GIVEN un motor que devuelve `invalido` por una entrada mal formada
- WHEN la orquestación procesa el resultado durante el check-in
- THEN se registra un error de servidor
- AND el check-in responde exactamente como sin el cálculo
- AND no se modifica ninguna reserva

#### Scenario: `invalido` no cancela la reserva vigente

- GIVEN un socio con una reserva `RESERVADA` vigente
- WHEN el recálculo devuelve `invalido`
- THEN la reserva sigue `RESERVADA`
- AND no se crea una nueva

### Requirement: Reloj inyectado

Todas las funciones de orquestación **MUST** recibir `ahora` como parámetro obligatorio. **MUST NOT** llamar a `Date.now()` ni a `new Date()` para decidir vencimientos, `creadaEn` o `venceEn`. En el check-in, `ahora` **MUST** ser el mismo instante que usó `evaluarYRegistrarAcceso` para la asistencia; en la API, el servidor lo provee; en los tests, se inyecta un valor fijo.

#### Scenario: El vencimiento depende del reloj inyectado

- GIVEN un cálculo con `ahora = 2026-10-25T10:00:00Z` y `minutosVencimientoReserva = 15`
- WHEN se persiste la reserva
- THEN `creadaEn = 2026-10-25T10:00:00Z` y `venceEn = 2026-10-25T10:15:00Z`
- AND una consulta con el mismo `ahora` la considera vigente

#### Scenario: Un test no depende del reloj real

- GIVEN dos ejecuciones del servicio con el mismo estado y el mismo `ahora`
- WHEN se comparan los resultados
- THEN son idénticos, sin depender de la hora del sistema

### Requirement: Best-effort en el check-in

El cálculo del check-in **MUST** ejecutarse después de que la transacción de `Asistencia` + `AuditoriaAcceso` haya confirmado. La asistencia **MUST NOT** depender del cálculo: si el motor lanza, devuelve `invalido`, la persistencia falla o se agota el tiempo, la asistencia queda registrada y la respuesta del check-in es exactamente la misma que sin el cálculo.

La orquestación **MUST** contener los fallos con un `try/catch` en el límite del servicio y **MUST NOT** propagarlos hacia arriba. Si la persistencia falla, la transacción de la reserva se revierte y no queda estado parcial. **MUST NOT** revertir ni modificar la asistencia ya confirmada.

#### Scenario: Falla del motor después de la asistencia

- GIVEN un check-in permitido cuya asistencia ya se confirmó
- WHEN el motor lanza una excepción
- THEN la asistencia sigue registrada
- AND el check-in devuelve el mismo resultado que sin cálculo
- AND el error se registra en el servidor

#### Scenario: Falla de persistencia de la reserva

- GIVEN un cálculo exitoso y una transacción de reserva que falla
- WHEN se intenta persistir
- THEN la transacción se revierte y no queda una reserva parcial
- AND la asistencia y la respuesta del check-in no cambian
- AND el error se registra en el servidor

#### Scenario: Falla de persistencia no cancela la reserva anterior

- GIVEN un socio con una reserva vigente y un recálculo que intenta reemplazarla
- WHEN la transacción de persistencia falla
- THEN la reserva anterior sigue `RESERVADA`
- AND no se crea una nueva

### Requirement: Espera acotada del cálculo

El cálculo del check-in **MUST** tener un tiempo máximo de espera interno y acotado (valor inicial propuesto: 2 segundos; el diseño fija la constante). Si se agota, la orquestación **MUST** abandonar el cálculo, registrar el timeout y responder el check-in como si no hubiera cálculo. **MUST NOT** dejar una transacción abierta, una reserva a medio escribir ni un lock retenido.

El uso de `after` de Next queda fuera de alcance hasta verificar `waitUntil` en Vercel (P-28); esta etapa usa una espera acotada y testeable.

#### Scenario: Timeout del cálculo

- GIVEN un motor o una consulta que tarda más que el límite configurado
- WHEN el check-in espera el cálculo
- THEN el cálculo se abandona al agotarse el límite
- AND la respuesta del check-in es la misma que sin cálculo
- AND no queda una reserva parcial ni un lock tomado

### Requirement: Integración con la sesión

Al iniciar la sesión, si existe una reserva `RESERVADA` vigente del socio, la orquestación **MUST** consumirla: la fila pasa a `EN_CURSO`, se fija `sesionId` y `ejercicioActualId` de la sesión es el ejercicio de la reserva. Si no existe, la sesión **MUST** comportarse exactamente como hoy: `ejercicioActualId` sigue el orden de rutina y la selección del siguiente ejercicio no cambia.

Después de completar un ejercicio, la orquestación **MUST** marcar la fila `EN_CURSO` como `COMPLETADA` y recalcular. Si el recálculo deja una reserva `RESERVADA` para el siguiente ejercicio, la sesión **MUST** usarla como siguiente ejercicio cuando avance; si no hay reserva, **MUST** seguir el orden de rutina. La reserva no se consume hasta que el ejercicio se convierte en el actual.

El camino sin asignaciones **MUST** preservar las firmas, los resultados y los efectos actuales de `iniciarSesion`, `registrarSerie` y `finalizarSesion`. Los tests existentes de sesión **MUST** seguir verdes sin cambios.

#### Scenario: La sesión sigue la reserva aceptada

- GIVEN un socio con una reserva `RESERVADA` vigente para `E2` en `M2`
- WHEN inicia la sesión y el ejercicio actual se determina
- THEN `ejercicioActualId = E2`
- AND la fila pasa a `EN_CURSO` con `sesionId`

#### Scenario: Sin reserva, el orden de rutina no cambia

- GIVEN un socio sin asignaciones ni reservas
- WHEN inicia la sesión y registra series
- THEN `ejercicioActualId` y `serieActual` se comportan exactamente como antes
- AND los tests existentes de sesión pasan sin modificaciones

#### Scenario: La reserva del siguiente ejercicio se consume al avanzar

- GIVEN una sesión que completó `E1` y tiene una reserva vigente para `E2`
- WHEN la sesión avanza al siguiente ejercicio
- THEN `ejercicioActualId = E2` y la reserva pasa a `EN_CURSO`
- AND si la reserva venció, el avance sigue el orden de rutina

### Requirement: Registro de ejecución `EN_CURSO`

La orquestación **MUST** garantizar que cada ejercicio que el socio comienza en la sesión tenga una fila `EN_CURSO` asociada a la sesión. Si el ejercicio proviene de una reserva, se actualiza esa fila. Si proviene del orden de rutina sin reserva, se crea una fila `EN_CURSO`; la máquina es la que el sistema conozca para ese ejercicio (la reserva consumida o, si el ejercicio tiene una única máquina candidata, esa máquina). Si no hay una máquina determinable, la fila se crea con `maquinaId` nulo y no aporta ocupación.

Al completarse la última serie de trabajo prescrita del ejercicio, la fila `EN_CURSO` **MUST** pasar a `COMPLETADA`. Al finalizar la sesión, las filas `EN_CURSO` restantes **MUST** pasar a `COMPLETADA` (no a `CANCELADA`): el socio terminó la sesión, no la abandonó.

Esta fila es la que permite derivar la ocupación de la máquina (ver `asignacion-ejercicio-persistencia`). Sin ella, una sesión en curso no identifica qué máquina ocupa.

#### Scenario: Ejercicio aceptado se registra como ejecución

- GIVEN una reserva aceptada para `E1` en `M1`
- WHEN el socio comienza `E1`
- THEN la fila pasa a `EN_CURSO` con `sesionId` y `maquinaId = M1`

#### Scenario: Ejercicio por orden de rutina con máquina única

- GIVEN un socio sin reserva que comienza `E1`, y `E1` tiene una única máquina candidata `M1`
- WHEN se registra la ejecución
- THEN se crea una fila `EN_CURSO` para `E1` en `M1`

#### Scenario: Ejercicio sin máquina determinable

- GIVEN un socio sin reserva que comienza un ejercicio con varias máquinas candidatas y sin cálculo que elija una
- WHEN se registra la ejecución
- THEN la fila `EN_CURSO` se crea con `maquinaId` nulo
- AND no aporta ocupación a ninguna máquina

#### Scenario: Fin de sesión completa las ejecuciones

- GIVEN una sesión con una fila `EN_CURSO`
- WHEN el socio finaliza la sesión
- THEN la fila pasa a `COMPLETADA`

### Requirement: Parámetros de configuración

La orquestación **MUST** leer `segundosEjecucionSerie`, `minutosVencimientoReserva` y `minutosInactividadSesion` desde el lector único de configuración y **MUST NOT** hardcodear sus valores. Si la fila de configuración no existe, usa los defaults 60, 15 y 30. Si un valor es inválido para el motor, el resultado es `invalido` y se aplica el tratamiento de `invalido` (log, sin cambios).

Un cambio de `minutosVencimientoReserva` **MUST** afectar solo a las reservas creadas después del cambio; las existentes conservan su `venceEn`. Un cambio de `segundosEjecucionSerie` **MUST** afectar los cálculos siguientes. Un cambio de `minutosInactividadSesion` **MUST** afectar las lecturas de ocupación siguientes, sin reescribir ninguna fila.

#### Scenario: Defaults cuando no hay configuración

- GIVEN una base sin fila de configuración
- WHEN se calcula
- THEN el motor recibe `segundosEjecucionSerie = 60`, la reserva vence a los 15 minutos y la ocupación usa `minutosInactividadSesion = 30`

#### Scenario: Configuración inválida se contiene

- GIVEN una configuración con `segundosEjecucionSerie = 0`
- WHEN se calcula
- THEN el motor devuelve `invalido`, se loguea el error y no se modifica ninguna reserva

### Requirement: Doble check-in y anti-passback

Dentro de la ventana de anti-passback, el segundo check-in sigue siendo `DENEGADO` por la regla de acceso existente: **MUST NOT** disparar el cálculo y **MUST NOT** cancelar la reserva vigente (el socio ya está dentro y puede estar usándola). Fuera de la ventana, un nuevo check-in permitido **MUST** disparar un recálculo que cancele la reserva activa anterior y cree la nueva según el resultado, en una sola transacción.

#### Scenario: Segundo check-in dentro de la ventana

- GIVEN un socio con una reserva vigente que vuelve a hacer check-in dentro de la ventana anti-passback
- WHEN el acceso resulta `DENEGADO`
- THEN no se ejecuta el cálculo
- AND la reserva vigente no se cancela ni se modifica

#### Scenario: Segundo check-in después de la ventana

- GIVEN un socio con una reserva vigente que hace check-in después de la ventana anti-passback
- WHEN el acceso es permitido y el cálculo produce una nueva recomendación
- THEN la reserva anterior pasa a `CANCELADA`
- AND se crea la nueva `RESERVADA` en la misma transacción

### Requirement: El motor no se modifica

La orquestación **MUST** consumir `calcularEspera` y sus tipos sin cambios. **MUST NOT** editar `src/domains/asignacion/motor-espera.ts`, sus tests, sus tipos públicos ni el guardián de dominios puros. Cualquier necesidad de cambio en el motor se documenta como pendiente para otra etapa, no se resuelve acá.

#### Scenario: El guardián de dominios puros sigue verde

- GIVEN la implementación de la orquestación
- WHEN corre el guardián de dominios puros
- THEN el motor no importa Prisma, base de datos ni repositorios
- AND el archivo del motor no registra cambios

## Escenarios

| # | Nombre | Qué demuestra | Resultado esperado |
|---|---|---|---|
| 1 | Entrada completa | Construcción de `EntradaMotor` con candidatos, ocupante y cola | Entrada válida |
| 2 | Sin rutina activa | No se calcula | Sin reserva |
| 3 | Máquinas no candidatas | La entrada no incluye ruido | `M9` fuera |
| 4 | Check-in permitido | Disparo en check-in | Cálculo y reserva |
| 5 | Check-in denegado | No se dispara | Sin cálculo |
| 6 | Inicio de rutina | Cálculo para los restantes | Reserva del siguiente |
| 7 | Fin de ejercicio | Recalculo tras completar | `COMPLETADA` + nueva reserva |
| 8 | Reserva persistida | Snapshot de espera y ahorro | `RESERVADA` con valores |
| 9 | Sin máquina | No se reserva | Fallback |
| 10 | Cancelación atómica | Reemplazo de reserva | Anterior `CANCELADA` |
| 11 | Aceptar | Decisión idempotente | Misma reserva |
| 12 | Esperar | Cancelación y orden de rutina | `CANCELADA` |
| 13 | Sin elección libre | Flujo obligatorio | No hay campo de máquina |
| 14 | `sin_opciones` | Fallback silencioso | Sin reserva; sin error |
| 15 | `vacio` | Fallback silencioso | Sin reserva; sin error |
| 16 | `invalido` en check-in | Error contenido | Log; respuesta igual |
| 17 | `invalido` con reserva | No destruye estado | Reserva intacta |
| 18 | Reloj inyectado | Determinismo temporal | `creadaEn`/`venceEn` exactos |
| 19 | Falla del motor | Best-effort | Asistencia registrada |
| 20 | Falla de persistencia | Best-effort y atomicidad | Sin residuo |
| 21 | Timeout | Espera acotada | Respuesta igual |
| 22 | Sesión con reserva | `ejercicioActualId` sigue la reserva | `E2` actual |
| 23 | Sesión sin reserva | Retrocompatibilidad | Tests actuales verdes |
| 24 | Consumo al avanzar | La reserva se usa como siguiente | `EN_CURSO` |
| 25 | Ejecución `EN_CURSO` | Ocupación derivable | Fila con `sesionId` |
| 26 | Fin de sesión | Cierre de ejecuciones | `COMPLETADA` |
| 27 | Defaults de configuración | 60/15 | Valores por defecto |
| 28 | Configuración inválida | `invalido` contenido | Log; sin cambios |
| 29 | Doble check-in dentro de ventana | No cancela reserva | Reserva intacta |
| 30 | Doble check-in fuera de ventana | Recalcula y reemplaza | Anterior `CANCELADA` |
| 31 | Motor intacto | Sin delta ni edición | Guardián verde |
| 32 | Ventana de inactividad | Parámetro inyectado al plan de lectura | `ahora` y `minutosInactividadSesion` propagados |

## Acceptance Criteria

- **AC-441**: La orquestación construye `EntradaMotor` con ejercicios pendientes, candidatos de `EjercicioMaquina`, máquinas del catálogo con estado, ocupante y cola derivados, `segundosEjecucionSerie` de configuración y `ahora` inyectado; no incluye máquinas no candidatas ni filas propias.
- **AC-442**: El cálculo se dispara exactamente en check-in permitido con rutina activa, inicio de rutina y después de cada ejercicio; no se dispara en check-in denegado ni sin rutina activa.
- **AC-443**: Un resultado `exito` con `maquinaId` no nulo persiste una `RESERVADA` con `esperaSegundos`, `ahorroSegundos`, `creadaEn` y `venceEn`; `sin_opciones`, `vacio` o `maquinaId` nulo no crean fila y cancelan la anterior.
- **AC-444**: `ACEPTAR` es idempotente y no cambia la reserva; `ESPERAR` la cancela y sigue el orden de rutina; no existe una tercera opción ni elección libre de máquina.
- **AC-445**: `sin_opciones`, `vacio` y `maquinaId` nulo aplican fallback silencioso, cancelan la reserva anterior y no lanzan excepción.
- **AC-446**: `invalido` se registra como error de servidor, no se propaga y no crea, cancela ni modifica reservas.
- **AC-447**: Todas las decisiones temporales usan `ahora` inyectado; no se usa `Date.now()` ni `new Date()` para vencimientos o creación.
- **AC-448**: El check-in es best-effort: la asistencia ya confirmada no se revierte; fallo del motor, `invalido` o fallo de persistencia dejan la respuesta del check-in igual y no dejan reserva parcial.
- **AC-449**: La sesión consume la reserva vigente como `ejercicioActualId`; sin reserva se comporta exactamente como hoy y los tests existentes de sesión quedan verdes sin cambios.
- **AC-450**: Cada ejercicio iniciado tiene una fila `EN_CURSO` asociada a la sesión; al completar la última serie o finalizar la sesión pasa a `COMPLETADA`.
- **AC-451**: El motor puro y sus tipos no se modifican; no existe delta de `motor-espera-asignacion`; el guardián de dominios puros sigue verde.
- **AC-452**: `segundosEjecucionSerie`, `minutosVencimientoReserva` y `minutosInactividadSesion` se leen del lector único con defaults 60/15/30; una configuración inválida se contiene como `invalido`.
- **AC-453**: Dentro de la ventana anti-passback el check-in denegado no calcula ni cancela; fuera de la ventana el check-in permitido recalcula y reemplaza la reserva en una transacción.
- **AC-454**: El cálculo del check-in tiene una espera máxima acotada (2 s iniciales); al agotarse no deja transacción abierta, reserva parcial ni lock retenido.
- **AC-455**: La orquestación pasa `ahora` y `minutosInactividadSesion` (default 30) al plan de lectura de ocupantes; el repositorio calcula el corte desde esos valores y no lee el reloj.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Construcción de `EntradaMotor` | 1, 2, 3, 32 | AC-441, AC-455 |
| Tres momentos de cálculo | 4, 5, 6, 7 | AC-442 |
| Persistencia de la reserva ganadora | 8, 9, 10 | AC-443 |
| Decisión `ACEPTAR` / `ESPERAR` | 11, 12, 13 | AC-444 |
| Fallback silencioso | 14, 15 | AC-445 |
| Tratamiento de `invalido` | 16, 17 | AC-446 |
| Reloj inyectado | 18 | AC-447 |
| Best-effort en el check-in | 19, 20 | AC-448 |
| Integración con la sesión | 22, 23, 24 | AC-449 |
| Registro de ejecución `EN_CURSO` | 25, 26 | AC-450 |
| El motor no se modifica | 31 | AC-451 |
| Parámetros de configuración | 27, 28 | AC-452 |
| Doble check-in y anti-passback | 29, 30 | AC-453 |
| Espera acotada | 21 | AC-454 |

## Fuera de alcance

- Modificar el motor puro `motor-espera.ts` o su spec; esta change **no** tiene delta de `motor-espera-asignacion`.
- La pantalla del socio, la reasignación por instructor y la salida de emergencia del flujo obligatorio (Etapa 5, P-61).
- La simulación comparativa de la tesis (P-62).
- La limpieza batch de reservas abandonadas (P-69).
- El uso de `after` + `waitUntil` de Next/Vercel (P-28); esta etapa usa espera acotada.
- La definición de DDL, nombres de columnas y tipos TypeScript (fase de diseño).
- Cambios a `EstadoMaquina`, `home-interno.ts`, `Home_Socio` o `Home_Interno`.

## Contrato de datos

Nota semántica; el diseño fija tipos y firmas.

| Entrada / salida | Semántica |
|---|---|
| `ejercicios[]` | Ejercicios pendientes con `id`, `orden`, `series`, `descanso` y `candidatos` (`maquinaId[]`). |
| `maquinas[]` | Máquinas candidatas con `id`, `estado`, `ocupante` (`seriesRestantes`, `descanso`) o `null`, y `cola` (`series`, `descanso`). |
| `parametros.segundosEjecucionSerie` | Duración de una serie en segundos, desde configuración. |
| `minutosInactividadSesion` | Ventana de actividad para que una sesión o fila `EN_CURSO` cuente como ocupante; desde configuración, default 30. |
| `ahora` | Reloj inyectado para vencimiento, creación y corte de inactividad. |
| Resultado del motor | `exito` (`recomendado`, `siguienteEnOrden`, `ahorro`, `bloqueados`), `sin_opciones`, `vacio` o `invalido`. |
| Reserva persistida | `socioId`, `ejercicioId`, `maquinaId`, `estado`, `creadaEn`, `venceEn`, `esperaSegundos`, `ahorroSegundos`, `sesionId`. |
| Decisión | `ACEPTAR` (idempotente) o `ESPERAR` (cancela y sigue rutina). |

## Numeración

- Decisiones: **D-88+** (última registrada D-87).
- Tareas: **T-056+** (última registrada T-055d).
- Pendientes: **P-68+**; esta change cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70 y P-71.
