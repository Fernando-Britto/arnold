# Configuración del Sistema Specification

## Purpose

Que el Administrador vea y cambie los parámetros del gimnasio desde la aplicación, con un único lugar de lectura y un registro de cada cambio (D-54).
Hoy la tabla `ConfiguracionDelSistema` se lee y se escribe desde un único punto (`src/lib/configuracion.ts`), y un test guardián impide que otro archivo la toque.

Estado: **implementado** (T-043a a T-043c, D-54; T-056a, parámetros del motor de espera). El lector único, la API y la pantalla están en `dev` y verificados.

## Requirements

### Requirement: Lector único

Todo el código que necesite un parámetro **MUST** obtenerlo de una sola función (`getConfiguracion()`), que devuelve **todos** los campos con su valor
por defecto cuando no existe la fila. Si hubiera más de una fila, **MUST** usarse siempre la más reciente (`updatedAt` descendente).

Valores por defecto: `capacidadMaxima` 0 · `periodoGracia` 0 · `diasInactividad` 15 · `ventanaAforoMinutos` 90 · `diaLimitePago` 10 ·
`diaCorteAltaTardia` 20 · `antiPassbackMinutos` 60 · `descuentoReactivacion` 0 · `ofertaReactivacionActiva` `false` · `diasSinAsistirParaOferta` 30 ·
`enfriamientoOfertaDias` 180 · `segundosEjecucionSerie` 60 · `minutosVencimientoReserva` 15 · `minutosInactividadSesion` 30. Los tres campos de la oferta (`ofertaReactivacionActiva`, `diasSinAsistirParaOferta`, `enfriamientoOfertaDias`) el lector ya los devuelve (T-043a), pero la fila los trae recién cuando T-045b agrega las columnas: hasta entonces valen su valor por defecto y la oferta queda apagada. Los tres parámetros del motor (`segundosEjecucionSerie`, `minutosVencimientoReserva`, `minutosInactividadSesion`) siguen la misma regla: el lector los devuelve siempre y la migración aditiva los materializa en la fila.

(Previously: el lector devolvía once parámetros; ahora devuelve catorce, con los tres del motor de espera.)

#### Scenario: Sin fila de configuración

- GIVEN la tabla está vacía
- WHEN cualquier parte del sistema pide la configuración
- THEN recibe los valores por defecto y el comportamiento no cambia respecto de hoy
- AND recibe `segundosEjecucionSerie = 60`, `minutosVencimientoReserva = 15` y `minutosInactividadSesion = 30`

#### Scenario: Dos filas

- GIVEN hay dos filas con distinto `updatedAt`
- WHEN dos partes distintas del sistema leen la configuración
- THEN ambas reciben la misma fila: la más reciente
- AND ambas reciben los tres parámetros del motor

### Requirement: API de configuración

`GET /api/configuracion` y `PUT /api/configuracion` **MUST** estar permitidos **solo al Administrador**, con su entrada en la matriz de permisos y su
test de consistencia. Instructor, Recepcionista y Socio **MUST** recibir `403`; sin sesión, `401`.

`PUT` **MUST** actualizar solo los campos enviados y crear la fila si no existe. Cada campo **MUST** validarse:

| Campo | Tipo | Rango |
|---|---|---|
| `capacidadMaxima` | entero | 1–10.000 |
| `periodoGracia` | entero | 0–30 |
| `diasInactividad` | entero | 1–365 |
| `ventanaAforoMinutos` | entero | 5–720 |
| `diaLimitePago`, `diaCorteAltaTardia` | entero | 1–31 |
| `antiPassbackMinutos` | entero | 0–720 |
| `descuentoReactivacion` | decimal | 1–50 |
| `ofertaReactivacionActiva` | booleano | — |
| `diasSinAsistirParaOferta` | entero | 7–365 |
| `enfriamientoOfertaDias` | entero | 0–730 |
| `segundosEjecucionSerie` | entero | 1–3600 |
| `minutosVencimientoReserva` | entero | 0–1440 |
| `minutosInactividadSesion` | entero | 1–1440 |

Los rangos son una propuesta de Claude (D-54) y se pueden ajustar sin cambiar el diseño. `minutosInactividadSesion = 0` se rechaza porque haría que toda sesión quedara inactiva al instante.

(Previously: la tabla de validación terminaba en `enfriamientoOfertaDias`; ahora incluye los tres parámetros del motor.)

#### Scenario: Valor fuera de rango

- GIVEN el Administrador envía `descuentoReactivacion = 80`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Recepcionista

- GIVEN la sesión es de un Recepcionista
- WHEN pide `PUT /api/configuracion`
- THEN responde `403`

#### Scenario: Segundos de serie en cero

- GIVEN el Administrador envía `segundosEjecucionSerie = 0`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Minutos de reserva negativos

- GIVEN el Administrador envía `minutosVencimientoReserva = -1`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Valor no entero o no finito

- GIVEN el Administrador envía `segundosEjecucionSerie = 60.5`, `NaN` o `Infinity`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Inactividad de sesión en cero

- GIVEN el Administrador envía `minutosInactividadSesion = 0`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Inactividad de sesión negativa

- GIVEN el Administrador envía `minutosInactividadSesion = -1`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Inactividad de sesión no finita

- GIVEN el Administrador envía `minutosInactividadSesion = NaN` o `Infinity`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Límite superior del rango

- GIVEN el Administrador envía `segundosEjecucionSerie = 3601`, `minutosVencimientoReserva = 1441` o `minutosInactividadSesion = 1441`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

### Requirement: Auditoría de cambios

Cada `PUT` que cambie al menos un valor **MUST** escribir un `RegistroDeAuditoria` (`tipoOperacion = MODIFICACION`) con el responsable y, en `detalles`
(JSON), el valor anterior y el nuevo de cada campo cambiado, **en la misma transacción** que la actualización. Un `PUT` que no cambia nada no escribe
registro. Los tres parámetros del motor **MUST** seguir exactamente la misma regla.

(Previously: la auditoría no nombraba los parámetros del motor; ahora los incluye explícitamente.)

#### Scenario: Cambio del descuento

- GIVEN `descuentoReactivacion` vale 10
- WHEN el Administrador lo cambia a 25
- THEN queda un registro `MODIFICACION` con `descuentoReactivacion: { antes: 10, despues: 25 }`

#### Scenario: Cambio de los parámetros del motor

- GIVEN `segundosEjecucionSerie = 60`, `minutosVencimientoReserva = 15` y `minutosInactividadSesion = 30`
- WHEN el Administrador los cambia a 90, 30 y 45
- THEN queda un registro `MODIFICACION` con `segundosEjecucionSerie: { antes: 60, despues: 90 }`, `minutosVencimientoReserva: { antes: 15, despues: 30 }` y `minutosInactividadSesion: { antes: 30, despues: 45 }`
- AND el registro se escribe en la misma transacción que el cambio

#### Scenario: PUT sin cambios no audita

- GIVEN una configuración con `segundosEjecucionSerie = 60`
- WHEN el Administrador envía `segundosEjecucionSerie = 60`
- THEN no se escribe ningún `RegistroDeAuditoria`

### Requirement: Pantalla `/configuracion`

La pantalla **MUST** mostrar todos los parámetros agrupados (Acceso, Cuotas, Aforo, Oferta de reactivación, Motor de espera), validar en el cliente los mismos rangos,
mostrar los errores del servidor con `handleApiError` y avisar con una notificación al guardar (D-39). Solo la abre el Administrador.

El grupo **Motor de espera** **MUST** mostrar `segundosEjecucionSerie`, `minutosVencimientoReserva` y `minutosInactividadSesion` con sus defaults, unidades (segundos y minutos) y los mismos rangos del servidor. La pantalla **MUST** seguir siendo visualmente idéntica salvo por el grupo nuevo.

(Previously: la pantalla agrupaba Acceso, Cuotas, Aforo y Oferta de reactivación; ahora agrega el grupo Motor de espera.)

#### Scenario: El panel muestra los tres parámetros

- GIVEN el Administrador abre `/configuracion`
- WHEN se renderiza el panel
- THEN ve el grupo "Motor de espera" con `segundosEjecucionSerie`, `minutosVencimientoReserva` y `minutosInactividadSesion`
- AND ve sus valores actuales y sus rangos

#### Scenario: Validación en el cliente

- GIVEN el Administrador escribe `segundosEjecucionSerie = 0` en el panel
- WHEN intenta guardar
- THEN el cliente muestra el error de rango antes de enviar
- AND no se envía un valor inválido al servidor

#### Scenario: Validación en el cliente de la inactividad

- GIVEN el Administrador escribe `minutosInactividadSesion = 0` en el panel
- WHEN intenta guardar
- THEN el cliente muestra el error de rango antes de enviar
- AND no se envía un valor inválido al servidor

#### Scenario: Error del servidor

- GIVEN el servidor rechaza un valor por una regla que el cliente no pudo validar
- WHEN el panel recibe la respuesta
- THEN muestra el error con `handleApiError`
- AND no confirma el guardado exitoso

### Requirement: Parámetros del motor de espera

`ConfiguracionDelSistema` **MUST** incorporar tres campos nuevos, todos enteros, con default y rango validados:

| Campo | Tipo | Default | Rango | Unidad | Semántica |
|---|---|---|---|---|---|
| `segundosEjecucionSerie` | entero | 60 | 1–3600 | segundos | Duración estimada de una serie para el cálculo de espera del motor. |
| `minutosVencimientoReserva` | entero | 15 | 0–1440 | minutos | Vigencia de una reserva desde su creación. `0` significa vencimiento inmediato (la reserva nace vencida y se ignora). |
| `minutosInactividadSesion` | entero | 30 | 1–1440 | minutos | Ventana de actividad para que una sesión o fila `EN_CURSO` cuente como ocupante. |

Los rangos son una propuesta de esta spec, ajustable sin cambiar el diseño, igual que los rangos de D-54. `segundosEjecucionSerie` **MUST NOT** aceptar `0` porque el motor exige `> 0`; `minutosVencimientoReserva` sí acepta `0` porque el vencimiento inmediato es una configuración válida (equivale a desactivar la reserva). `minutosInactividadSesion` **MUST NOT** aceptar `0`: haría que toda sesión quedara inactiva al instante y no tiene uso operativo; por eso el rango propuesto empieza en 1 minuto.

Los tres campos **MUST** formar parte de la interfaz `Configuracion`, de `CONFIGURACION_POR_DEFECTO` y del lector único. Un valor ausente en una fila o la ausencia de fila **MUST** resolverse con el default, sin romper ninguna lectura existente.

#### Scenario: Defaults cuando no hay fila

- GIVEN una base sin fila de `ConfiguracionDelSistema`
- WHEN se lee la configuración
- THEN `segundosEjecucionSerie = 60`, `minutosVencimientoReserva = 15` y `minutosInactividadSesion = 30`
- AND el resto de los parámetros conserva sus defaults actuales

#### Scenario: Fila existente después de la migración

- GIVEN una fila creada antes de esta change
- WHEN se aplica la migración aditiva y se lee la configuración
- THEN la fila devuelve `segundosEjecucionSerie = 60`, `minutosVencimientoReserva = 15` y `minutosInactividadSesion = 30`
- AND ningún otro campo cambia de valor

#### Scenario: Cambio parcial de un solo campo

- GIVEN una configuración con los tres valores por defecto
- WHEN el Administrador envía solo `segundosEjecucionSerie = 90`
- THEN el campo cambia a 90
- AND `minutosVencimientoReserva` sigue en 15 y `minutosInactividadSesion` en 30

### Requirement: Migración aditiva de los parámetros

La migración **MUST** agregar las tres columnas como `NOT NULL DEFAULT` sobre `ConfiguracionDelSistema`, en el mismo `ALTER TABLE` aditivo. **MUST NOT** eliminar ni modificar columnas existentes, **MUST NOT** tocar filas de otras tablas y **MUST** incluir el SQL de rollback como comentario al pie (`ALTER TABLE ... DROP COLUMN IF EXISTS ...`).

La migración **MUST** verificar contra PostgreSQL en Docker (D-53) antes de aplicarse en Supabase: las filas existentes reciben los defaults y la lectura sigue funcionando. No se agregan seeds.

#### Scenario: Migración sin pérdida de datos

- GIVEN una base con una fila de configuración y datos existentes
- WHEN se aplica la migración
- THEN las tres columnas existen con `NOT NULL DEFAULT 60`, `NOT NULL DEFAULT 15` y `NOT NULL DEFAULT 30`
- AND la fila existente conserva todos sus valores anteriores
- AND el SQL no contiene `DROP`/`ALTER` destructivos sobre otras columnas

#### Scenario: Rollback documentado

- GIVEN la migración aplicada
- WHEN se ejecuta el rollback comentado
- THEN las tres columnas desaparecen
- AND la fila y el resto de las columnas siguen intactas

### Requirement: Consumo de los parámetros por la orquestación

`segundosEjecucionSerie` **MUST** ser el valor que la orquestación pasa al motor en `parametros.segundosEjecucionSerie`; **MUST NOT** hardcodearse en la orquestación. `minutosVencimientoReserva` **MUST** determinar el `venceEn` de las reservas nuevas. `minutosInactividadSesion` **MUST** ser la ventana que la orquestación pasa al plan de lectura de ocupantes; **MUST NOT** hardcodearse.

Un cambio de `minutosVencimientoReserva` **MUST** afectar solo a las reservas creadas después del cambio; las reservas existentes conservan su `venceEn` original. Un cambio de `segundosEjecucionSerie` **MUST** afectar los cálculos siguientes, no los ya persistidos. Un cambio de `minutosInactividadSesion` **MUST** afectar las lecturas de ocupación siguientes, sin reescribir filas.

#### Scenario: La reserva nueva usa el valor configurado

- GIVEN `minutosVencimientoReserva = 30`
- WHEN se crea una reserva
- THEN su `venceEn` es `creadaEn + 30 minutos`

#### Scenario: El cambio no reescribe reservas existentes

- GIVEN una reserva creada con `minutosVencimientoReserva = 15`
- WHEN el Administrador lo cambia a 30
- THEN la reserva existente conserva `venceEn = creadaEn + 15 minutos`
- AND la siguiente reserva usa 30 minutos

#### Scenario: La duración de serie llega al motor

- GIVEN `segundosEjecucionSerie = 90`
- WHEN la orquestación construye `EntradaMotor`
- THEN `parametros.segundosEjecucionSerie = 90`

#### Scenario: La ventana de inactividad llega al plan de lectura

- GIVEN `minutosInactividadSesion = 30`
- WHEN la orquestación construye la lectura de ocupantes
- THEN el plan de lectura recibe `minutosInactividadSesion = 30`

## Fuera de alcance

- La gestión de **máquinas** (parte de la T-043 sugerida en D-42) y el alta de usuarios internos (T-042), que siguen sin confirmar.
