# Delta for configuracion-sistema

## Purpose

Agregar a la configuración existente los dos parámetros que necesita la integración del motor de espera: `segundosEjecucionSerie` (duración de una serie) y `minutosVencimientoReserva` (vigencia de una reserva). El delta reutiliza el patrón D-54: lector único, validación en el dominio, API con auditoría y panel `/configuracion`. No cambia ningún otro parámetro ni crea un segundo lector.

Estado: **especificado** — Etapa 4, previo al diseño. No modifica código.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `configuracion-sistema` (delta) |
| Change | `asignacion-integracion` (Etapa 4) |
| Dependencias | Patrón D-54 (T-043a/T-043b), T-045b (columnas aditivas de la oferta) |
| Consumidores | `asignacion-orquestacion` (`segundosEjecucionSerie`, `minutosVencimientoReserva`) |
| Numeración AC | `AC-501…AC-509` (delta). No colisiona con los AC existentes de la capability |

## ADDED Requirements

### Requirement: Parámetros del motor de espera

`ConfiguracionDelSistema` **MUST** incorporar dos campos nuevos, ambos enteros, con default y rango validados:

| Campo | Tipo | Default | Rango | Unidad | Semántica |
|---|---|---|---|---|---|
| `segundosEjecucionSerie` | entero | 60 | 1–3600 | segundos | Duración estimada de una serie para el cálculo de espera del motor. |
| `minutosVencimientoReserva` | entero | 15 | 0–1440 | minutos | Vigencia de una reserva desde su creación. `0` significa vencimiento inmediato (la reserva nace vencida y se ignora). |

Los rangos son una propuesta de esta spec, ajustable sin cambiar el diseño, igual que los rangos de D-54. `segundosEjecucionSerie` **MUST NOT** aceptar `0` porque el motor exige `> 0`; `minutosVencimientoReserva` sí acepta `0` porque el vencimiento inmediato es una configuración válida (equivale a desactivar la reserva).

Los dos campos **MUST** formar parte de la interfaz `Configuracion`, de `CONFIGURACION_POR_DEFECTO` y del lector único. Un valor ausente en una fila o la ausencia de fila **MUST** resolverse con el default, sin romper ninguna lectura existente.

#### Scenario: Defaults cuando no hay fila

- GIVEN una base sin fila de `ConfiguracionDelSistema`
- WHEN se lee la configuración
- THEN `segundosEjecucionSerie = 60` y `minutosVencimientoReserva = 15`
- AND el resto de los parámetros conserva sus defaults actuales

#### Scenario: Fila existente después de la migración

- GIVEN una fila creada antes de esta change
- WHEN se aplica la migración aditiva y se lee la configuración
- THEN la fila devuelve `segundosEjecucionSerie = 60` y `minutosVencimientoReserva = 15`
- AND ningún otro campo cambia de valor

#### Scenario: Cambio parcial de un solo campo

- GIVEN una configuración con ambos valores por defecto
- WHEN el Administrador envía solo `segundosEjecucionSerie = 90`
- THEN el campo cambia a 90
- AND `minutosVencimientoReserva` sigue en 15

### Requirement: Migración aditiva de los parámetros

La migración **MUST** agregar las dos columnas como `NOT NULL DEFAULT` sobre `ConfiguracionDelSistema`, de forma aditiva. **MUST NOT** eliminar ni modificar columnas existentes, **MUST NOT** tocar filas de otras tablas y **MUST** incluir el SQL de rollback como comentario al pie (`ALTER TABLE ... DROP COLUMN IF EXISTS ...`).

La migración **MUST** verificar contra PostgreSQL en Docker (D-53) antes de aplicarse en Supabase: las filas existentes reciben el default y la lectura sigue funcionando. No se agregan seeds.

#### Scenario: Migración sin pérdida de datos

- GIVEN una base con una fila de configuración y datos existentes
- WHEN se aplica la migración
- THEN las dos columnas existen con `NOT NULL DEFAULT 60` y `NOT NULL DEFAULT 15`
- AND la fila existente conserva todos sus valores anteriores
- AND el SQL no contiene `DROP`/`ALTER` destructivos sobre otras columnas

#### Scenario: Rollback documentado

- GIVEN la migración aplicada
- WHEN se ejecuta el rollback comentado
- THEN las dos columnas desaparecen
- AND la fila y el resto de las columnas siguen intactas

### Requirement: Consumo de los parámetros por la orquestación

`segundosEjecucionSerie` **MUST** ser el valor que la orquestación pasa al motor en `parametros.segundosEjecucionSerie`; **MUST NOT** hardcodearse en la orquestación. `minutosVencimientoReserva` **MUST** determinar el `venceEn` de las reservas nuevas.

Un cambio de `minutosVencimientoReserva` **MUST** afectar solo a las reservas creadas después del cambio; las reservas existentes conservan su `venceEn` original. Un cambio de `segundosEjecucionSerie` **MUST** afectar los cálculos siguientes, no los ya persistidos.

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

## MODIFIED Requirements

### Requirement: Lector único

Todo el código que necesite un parámetro **MUST** obtenerlo de una sola función (`getConfiguracion()`), que devuelve **todos** los campos con su valor
por defecto cuando no existe la fila. Si hubiera más de una fila, **MUST** usarse siempre la más reciente (`updatedAt` descendente).

Valores por defecto: `capacidadMaxima` 0 · `periodoGracia` 0 · `diasInactividad` 15 · `ventanaAforoMinutos` 90 · `diaLimitePago` 10 ·
`diaCorteAltaTardia` 20 · `antiPassbackMinutos` 60 · `descuentoReactivacion` 0 · `ofertaReactivacionActiva` `false` · `diasSinAsistirParaOferta` 30 ·
`enfriamientoOfertaDias` 180 · `segundosEjecucionSerie` 60 · `minutosVencimientoReserva` 15. Los tres campos de la oferta (`ofertaReactivacionActiva`, `diasSinAsistirParaOferta`, `enfriamientoOfertaDias`) el lector ya los devuelve (T-043a), pero la fila los trae recién cuando T-045b agrega las columnas: hasta entonces valen su valor por defecto y la oferta queda apagada. Los dos campos del motor (`segundosEjecucionSerie`, `minutosVencimientoReserva`) siguen la misma regla: el lector los devuelve siempre y la migración aditiva los materializa en la fila.

(Previously: el lector devolvía once parámetros; ahora devuelve trece, con los dos del motor de espera.)

#### Scenario: Sin fila de configuración

- GIVEN la tabla está vacía
- WHEN cualquier parte del sistema pide la configuración
- THEN recibe los valores por defecto y el comportamiento no cambia respecto de hoy
- AND recibe `segundosEjecucionSerie = 60` y `minutosVencimientoReserva = 15`

#### Scenario: Dos filas

- GIVEN hay dos filas con distinto `updatedAt`
- WHEN dos partes distintas del sistema leen la configuración
- THEN ambas reciben la misma fila: la más reciente
- AND ambas reciben los dos parámetros del motor

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

Los rangos son una propuesta de Claude (D-54) y se pueden ajustar sin cambiar el diseño.

(Previously: la tabla de validación terminaba en `enfriamientoOfertaDias`; ahora incluye los dos parámetros del motor.)

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

#### Scenario: Límite superior del rango

- GIVEN el Administrador envía `segundosEjecucionSerie = 3601` o `minutosVencimientoReserva = 1441`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

### Requirement: Auditoría de cambios

Cada `PUT` que cambie al menos un valor **MUST** escribir un `RegistroDeAuditoria` (`tipoOperacion = MODIFICACION`) con el responsable y, en `detalles`
(JSON), el valor anterior y el nuevo de cada campo cambiado, **en la misma transacción** que la actualización. Un `PUT` que no cambia nada no escribe
registro. Los dos parámetros del motor **MUST** seguir exactamente la misma regla.

(Previously: la auditoría no nombraba los parámetros del motor; ahora los incluye explícitamente.)

#### Scenario: Cambio del descuento

- GIVEN `descuentoReactivacion` vale 10
- WHEN el Administrador lo cambia a 25
- THEN queda un registro `MODIFICACION` con `descuentoReactivacion: { antes: 10, despues: 25 }`

#### Scenario: Cambio de los parámetros del motor

- GIVEN `segundosEjecucionSerie = 60` y `minutosVencimientoReserva = 15`
- WHEN el Administrador los cambia a 90 y 30
- THEN queda un registro `MODIFICACION` con `segundosEjecucionSerie: { antes: 60, despues: 90 }` y `minutosVencimientoReserva: { antes: 15, despues: 30 }`
- AND el registro se escribe en la misma transacción que el cambio

#### Scenario: PUT sin cambios no audita

- GIVEN una configuración con `segundosEjecucionSerie = 60`
- WHEN el Administrador envía `segundosEjecucionSerie = 60`
- THEN no se escribe ningún `RegistroDeAuditoria`

### Requirement: Pantalla `/configuracion`

La pantalla **MUST** mostrar todos los parámetros agrupados (Acceso, Cuotas, Aforo, Oferta de reactivación, Motor de espera), validar en el cliente los mismos rangos,
mostrar los errores del servidor con `handleApiError` y avisar con una notificación al guardar (D-39). Solo la abre el Administrador.

El grupo **Motor de espera** **MUST** mostrar `segundosEjecucionSerie` y `minutosVencimientoReserva` con sus defaults, unidades (segundos y minutos) y los mismos rangos del servidor. La pantalla **MUST** seguir siendo visualmente idéntica salvo por el grupo nuevo.

(Previously: la pantalla agrupaba Acceso, Cuotas, Aforo y Oferta de reactivación; ahora agrega el grupo Motor de espera.)

#### Scenario: El panel muestra los dos parámetros

- GIVEN el Administrador abre `/configuracion`
- WHEN se renderiza el panel
- THEN ve el grupo "Motor de espera" con `segundosEjecucionSerie` y `minutosVencimientoReserva`
- AND ve sus valores actuales y sus rangos

#### Scenario: Validación en el cliente

- GIVEN el Administrador escribe `segundosEjecucionSerie = 0` en el panel
- WHEN intenta guardar
- THEN el cliente muestra el error de rango antes de enviar
- AND no se envía un valor inválido al servidor

#### Scenario: Error del servidor

- GIVEN el servidor rechaza un valor por una regla que el cliente no pudo validar
- WHEN el panel recibe la respuesta
- THEN muestra el error con `handleApiError`
- AND no confirma el guardado exitoso

## Escenarios

| # | Nombre | Qué demuestra | Resultado esperado |
|---|---|---|---|
| 1 | Defaults sin fila | Defaults de los dos parámetros | 60 y 15 |
| 2 | Fila existente tras migración | Defaults materializados | 60 y 15; resto intacto |
| 3 | Cambio parcial | Actualización selectiva | Solo cambia el campo enviado |
| 4 | Migración sin pérdida | Aditiva y segura | Columnas con default; datos intactos |
| 5 | Rollback | Reversión documentada | Columnas eliminadas; resto intacto |
| 6 | Reserva nueva usa el valor | Consumo del parámetro | `venceEn = creadaEn + 30 min` |
| 7 | Cambio no retroactivo | Reservas existentes | `venceEn` original |
| 8 | Duración llega al motor | Consumo del parámetro | `segundosEjecucionSerie` en la entrada |
| 9 | Lector sin fila | Defaults del lector | 60 y 15 |
| 10 | Lector con dos filas | Fila más reciente | Ambos leen la misma fila |
| 11 | Fuera de rango | Validación existente | `400` sin cambios |
| 12 | Recepcionista | Permiso | `403` |
| 13 | Segundos en cero | Límite inferior | `400` |
| 14 | Minutos negativos | Límite inferior | `400` |
| 15 | No entero o no finito | Tipo | `400` |
| 16 | Límite superior | Rango | `400` |
| 17 | Auditoría del descuento | Auditoría existente | `antes`/`despues` |
| 18 | Auditoría del motor | Nuevos campos auditados | `antes`/`despues` de ambos |
| 19 | PUT sin cambios | Sin auditoría | Sin registro |
| 20 | Panel muestra | UI | Grupo "Motor de espera" |
| 21 | Validación cliente | UI | Error antes de enviar |
| 22 | Error servidor | UI | `handleApiError` |

## Acceptance Criteria (Delta)

- **AC-501**: `ConfiguracionDelSistema` incorpora `segundosEjecucionSerie` (entero, default 60, rango 1–3600) y `minutosVencimientoReserva` (entero, default 15, rango 0–1440), en la interfaz `Configuracion`, en `CONFIGURACION_POR_DEFECTO` y en el lector único.
- **AC-502**: El lector único devuelve ambos campos con su default cuando no hay fila o falta el valor; no aparece un segundo lector ni una lectura directa de la tabla.
- **AC-503**: `PUT /api/configuracion` valida ambos campos con los rangos de la tabla; `0` es inválido para `segundosEjecucionSerie`; negativos, `NaN`, `Infinity`, no enteros y valores fuera de rango devuelven `400` sin cambiar nada.
- **AC-504**: La migración es aditiva (`ADD COLUMN ... NOT NULL DEFAULT`), las filas existentes reciben 60/15, no toca otras columnas y documenta el rollback; se verifica en Docker.
- **AC-505**: El panel `/configuracion` muestra el grupo "Motor de espera" con los dos campos, sus unidades y rangos, valida en el cliente y muestra los errores del servidor con `handleApiError`.
- **AC-506**: Cada `PUT` que cambia uno o ambos parámetros escribe un `RegistroDeAuditoria` `MODIFICACION` con `antes`/`despues` en la misma transacción; un `PUT` sin cambios no audita.
- **AC-507**: `segundosEjecucionSerie` llega a `parametros.segundosEjecucionSerie` del motor; `minutosVencimientoReserva` fija el `venceEn` de las reservas nuevas y no reescribe las existentes.
- **AC-508**: Los demás parámetros, sus rangos, la pantalla y los tests existentes quedan sin cambios; el panel solo agrega el grupo nuevo.
- **AC-509**: `npm test`, `npm run test:integration`, `tsc --noEmit` y `eslint` quedan verdes sin nuevos errores.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Parámetros del motor de espera | 1, 2, 3 | AC-501, AC-502, AC-508 |
| Migración aditiva de los parámetros | 4, 5 | AC-504, AC-509 |
| Consumo por la orquestación | 6, 7, 8 | AC-507 |
| Lector único (modificado) | 9, 10 | AC-502 |
| API de configuración (modificada) | 11, 12, 13, 14, 15, 16 | AC-503 |
| Auditoría de cambios (modificada) | 17, 18, 19 | AC-506 |
| Pantalla `/configuracion` (modificada) | 20, 21, 22 | AC-505 |

## Fuera de alcance

- Crear un lector o una pantalla nuevos; se reutilizan los existentes (D-54).
- Cambiar los rangos o el comportamiento de los parámetros ya existentes.
- Persistir o versionar la configuración por gimnasio; sigue siendo una fila única de la instalación.
- Aplicar la migración en Supabase desde esta change; la aplica el responsable del despliegue (D-41).
- La UI del socio y la simulación de la tesis (Etapa 5, P-62).

## Contrato de datos

Nota semántica; el DDL y los tipos son responsabilidad del diseño.

| Campo | Semántica |
|---|---|
| `segundosEjecucionSerie` | Entero, segundos, default 60, rango 1–3600. Entrada del motor. |
| `minutosVencimientoReserva` | Entero, minutos, default 15, rango 0–1440. Vigencia de una reserva nueva; `0` = vencimiento inmediato. |

Invariantes: ambos son `NOT NULL DEFAULT`; el lector devuelve defaults si faltan; un cambio no reescribe reservas existentes.

## Numeración

- Decisiones: **D-88+** (última registrada D-87).
- Tareas: **T-056+** (última registrada T-055d).
- Pendientes: **P-68+**; esta change cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70.
