# Configuración del Sistema Specification

## Purpose

Que el Administrador vea y cambie los parámetros del gimnasio desde la aplicación, con un único lugar de lectura y un registro de cada cambio (D-54).
Hoy la tabla `ConfiguracionDelSistema` solo la escribe el seed (`npm run seed`) y se lee desde 6 lugares con criterios distintos.

Estado: **diseño aprobado, sin código** (T-043a a T-043c).

## Requirements

### Requirement: Lector único

Todo el código que necesite un parámetro **MUST** obtenerlo de una sola función (`getConfiguracion()`), que devuelve **todos** los campos con su valor
por defecto cuando no existe la fila. Si hubiera más de una fila, **MUST** usarse siempre la más reciente (`updatedAt` descendente).

Valores por defecto: `capacidadMaxima` 0 · `periodoGracia` 0 · `diasInactividad` 15 · `ventanaAforoMinutos` 90 · `diaLimitePago` 10 ·
`diaCorteAltaTardia` 20 · `antiPassbackMinutos` 60 · `descuentoReactivacion` 0 · `ofertaReactivacionActiva` `false` · `diasSinAsistirParaOferta` 30 ·
`enfriamientoOfertaDias` 180. Los tres últimos (`ofertaReactivacionActiva`, `diasSinAsistirParaOferta`, `enfriamientoOfertaDias`) el lector ya los devuelve (T-043a), pero la fila los trae recién cuando T-045b agrega las columnas: hasta entonces valen su valor por defecto y la oferta queda apagada.

#### Scenario: Sin fila de configuración

- GIVEN la tabla está vacía
- WHEN cualquier parte del sistema pide la configuración
- THEN recibe los valores por defecto y el comportamiento no cambia respecto de hoy

#### Scenario: Dos filas

- GIVEN hay dos filas con distinto `updatedAt`
- WHEN dos partes distintas del sistema leen la configuración
- THEN ambas reciben la misma fila: la más reciente

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

Los rangos son una propuesta de Claude (D-54) y se pueden ajustar sin cambiar el diseño.

#### Scenario: Valor fuera de rango

- GIVEN el Administrador envía `descuentoReactivacion = 80`
- WHEN se procesa el `PUT`
- THEN responde `400` con un mensaje en español y no cambia nada

#### Scenario: Recepcionista

- GIVEN la sesión es de un Recepcionista
- WHEN pide `PUT /api/configuracion`
- THEN responde `403`

### Requirement: Auditoría de cambios

Cada `PUT` que cambie al menos un valor **MUST** escribir un `RegistroDeAuditoria` (`tipoOperacion = MODIFICACION`) con el responsable y, en `detalles`
(JSON), el valor anterior y el nuevo de cada campo cambiado, **en la misma transacción** que la actualización. Un `PUT` que no cambia nada no escribe
registro.

#### Scenario: Cambio del descuento

- GIVEN `descuentoReactivacion` vale 10
- WHEN el Administrador lo cambia a 25
- THEN queda un registro `MODIFICACION` con `descuentoReactivacion: { antes: 10, despues: 25 }`

### Requirement: Pantalla `/configuracion`

La pantalla **MUST** mostrar todos los parámetros agrupados (Acceso, Cuotas, Aforo, Oferta de reactivación), validar en el cliente los mismos rangos,
mostrar los errores del servidor con `handleApiError` y avisar con una notificación al guardar (D-39). Solo la abre el Administrador.

## Fuera de alcance

- La gestión de **máquinas** (parte de la T-043 sugerida en D-42) y el alta de usuarios internos (T-042), que siguen sin confirmar.
