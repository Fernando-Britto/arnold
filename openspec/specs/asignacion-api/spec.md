# Asignación — API Specification

## Purpose

Exponer la sugerencia vigente y la decisión obligatoria del socio a través de dos endpoints REST, con permisos por rol y por propiedad, y con un mapeo de errores consistente con el resto de la API. Esta capability es la superficie que consumirá la pantalla del socio en Etapa 5; en esta etapa no tiene UI.

Estado: **especificado** — Etapa 4, previo al diseño. No modifica código.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `asignacion-api` |
| Change | `asignacion-integracion` (Etapa 4) |
| Dependencias | `asignacion-orquestacion`, `asignacion-ejercicio-persistencia`, `rbac-middleware` (matriz de permisos), `route-error-mapper` |
| Consumidores | Etapa 5 (pantalla del socio); pruebas de contrato de esta etapa |
| Numeración AC | `AC-481…AC-490`. No colisiona con los rangos usados (`AC-001…`, `AC-201…`, `AC-301…`, `AC-401…`, `AC-441…`) |

## Requirements

### Requirement: `GET /api/asignaciones/sugerencia`

El endpoint **MUST** devolver la sugerencia vigente del socio y, como información complementaria, el ejercicio que le seguiría si eligiera `ESPERAR`. **MUST NOT** crear, cancelar ni modificar reservas: es una lectura.

El socio se determina así:

- **SOCIO**: se deriva de la sesión autenticada. El parámetro `socioId` **MUST NOT** aceptarse; si viene, la petición se rechaza con `403 FORBIDDEN`.
- **ADMINISTRADOR / INSTRUCTOR**: **MUST** enviar `socioId` por query. Si falta, `400 VALIDATION_ERROR`; si el socio no existe, `404 NOT_FOUND`.

La respuesta **MUST** tener esta semántica:

| Campo | Semántica |
|---|---|
| `socioId` | Socio consultado. |
| `sugerencia` | La reserva `RESERVADA` no vencida más reciente, o `null` si no hay. Incluye `asignacionId`, `ejercicioId`, `ejercicioNombre`, `maquinaId`, `maquinaNombre`, `esperaSegundos`, `ahorroSegundos`, `creadaEn` y `venceEn`. |
| `siguienteEnOrden` | El ejercicio que el socio haría si esperara: `ejercicioId`, `ejercicioNombre`, `maquinaId` (puede ser `null`), `esperaSegundos`; o `null` si no hay cálculo posible o no hay pendientes. Es informativo y no persiste nada. |
| `calculadoEn` | Instante usado como `ahora` para leer la vigencia y calcular el siguiente. |

Un socio sin rutina activa **MUST** recibir `200` con `sugerencia: null` y `siguienteEnOrden: null`; no es un error. Un socio con rutina activa pero sin reserva vigente **MUST** recibir `200` con `sugerencia: null` y, si el cálculo es posible, `siguienteEnOrden` con el ejercicio de rutina que corresponda.

Si el cálculo de `siguienteEnOrden` falla, devuelve `invalido` o supera el tiempo acotado, el endpoint **MUST** seguir respondiendo `200` con `siguienteEnOrden: null`, registrar el fallo en el servidor y **MUST NOT** fallar la lectura de la sugerencia persistida.

#### Scenario: Socio con sugerencia vigente

- GIVEN un socio autenticado con una reserva `RESERVADA` no vencida
- WHEN consulta `GET /api/asignaciones/sugerencia` sin `socioId`
- THEN recibe `200` con `sugerencia` completa y `siguienteEnOrden` si el cálculo es posible
- AND no se modifica ninguna reserva

#### Scenario: Socio sin sugerencia vigente

- GIVEN un socio con rutina activa pero sin reserva vigente
- WHEN consulta su sugerencia
- THEN recibe `200` con `sugerencia: null`
- AND `siguienteEnOrden` refleja el próximo ejercicio de rutina si el cálculo es posible

#### Scenario: Socio sin rutina activa

- GIVEN un socio autenticado sin rutina activa
- WHEN consulta su sugerencia
- THEN recibe `200` con `sugerencia: null` y `siguienteEnOrden: null`

#### Scenario: La lectura no crea reservas

- GIVEN un socio sin reserva vigente
- WHEN consulta la sugerencia repetidamente
- THEN ninguna consulta crea una fila `RESERVADA`
- AND el estado de la base no cambia

#### Scenario: El fallo del cálculo no rompe la lectura

- GIVEN una sugerencia persistida y un cálculo de `siguienteEnOrden` que devuelve `invalido`
- WHEN el socio consulta
- THEN recibe `200` con su `sugerencia` y `siguienteEnOrden: null`
- AND el error queda en el log del servidor

### Requirement: `POST /api/asignaciones/decidir`

El endpoint **MUST** aplicar la decisión obligatoria sobre la sugerencia vigente del socio. El cuerpo **MUST** ser un objeto con:

- `accion`: obligatorio, exactamente `"ACEPTAR"` o `"ESPERAR"`.

Cualquier otro campo (incluido `socioId`), un cuerpo que no sea objeto o una `accion` distinta **MUST** rechazarse con `400 VALIDATION_ERROR`. El endpoint **MUST** resolver el socio desde la sesión y **MUST** rechazar con `403 FORBIDDEN` a cualquier rol que no sea SOCIO. El endpoint **MUST NOT** aceptar `ejercicioId`, `maquinaId` ni ningún campo que permita elegir libremente el ejercicio o la máquina.

Semántica:

- **ACEPTAR**: la reserva vigente sigue `RESERVADA` y con el mismo `venceEn`. Es idempotente: repetir la acción sobre la misma reserva devuelve `200` y no crea otra fila.
- **ESPERAR**: la reserva vigente pasa a `CANCELADA` y el socio sigue el orden de rutina. Responde `200` con `sugerencia: null`.

La respuesta **MUST** incluir `accion`, `sugerencia` (la reserva resultante o `null`) y `siguienteEnOrden` (el próximo ejercicio de rutina, si se puede calcular). La operación **MUST** ser transaccional: o se aplica la decisión completa o no se aplica.

Si no existe una sugerencia vigente:

- Nunca existió una para el socio en el estado actual → `404 SIN_SUGERENCIA` con mensaje en español.
- Existió una `RESERVADA` que venció o fue cancelada entre la lectura y la decisión → `409 SIN_SUGERENCIA_VIGENTE` con mensaje en español, invitando a volver a consultar.

#### Scenario: Aceptar la sugerencia

- GIVEN un socio con una reserva vigente
- WHEN envía `{ accion: "ACEPTAR" }`
- THEN recibe `200` con la reserva todavía `RESERVADA`
- AND el `venceEn` no cambia
- AND una segunda aceptación devuelve el mismo resultado sin crear otra fila

#### Scenario: Esperar la sugerencia

- GIVEN un socio con una reserva vigente
- WHEN envía `{ accion: "ESPERAR" }`
- THEN recibe `200` con `sugerencia: null`
- AND la reserva pasa a `CANCELADA`
- AND el siguiente ejercicio sigue el orden de rutina

#### Scenario: Decisión sin sugerencia

- GIVEN un socio sin reserva vigente y sin reserva previa en el estado actual
- WHEN envía una decisión
- THEN recibe `404 SIN_SUGERENCIA`

#### Scenario: Decisión sobre una sugerencia vencida

- GIVEN un socio cuya reserva venció entre la lectura y la decisión
- WHEN envía `ACEPTAR` o `ESPERAR`
- THEN recibe `409 SIN_SUGERENCIA_VIGENTE`
- AND no se modifica la fila vencida

#### Scenario: Acción inválida

- GIVEN un cuerpo con `accion: "ELEGIR"`
- WHEN se procesa la petición
- THEN recibe `400 VALIDATION_ERROR`
- AND no se modifica ninguna reserva

#### Scenario: Intento de elegir máquina

- GIVEN un cuerpo con `accion: "ACEPTAR"` y `maquinaId: "M2"`
- WHEN se procesa la petición
- THEN recibe `400 VALIDATION_ERROR` por campo desconocido
- AND la reserva vigente no cambia

### Requirement: Permisos por rol y por propiedad

La matriz de permisos **MUST** incluir el prefijo `/api/asignaciones` con esta forma exacta:

| Rol | `GET /sugerencia` | `POST /decidir` |
|---|---|---|
| SOCIO | solo lo propio | solo lo propio |
| ADMINISTRADOR | cualquier socio | **sin acceso** |
| INSTRUCTOR | cualquier socio | **sin acceso** |
| RECEPCIONISTA | sin acceso | sin acceso |

RECEPCIONISTA **MUST** recibir `403`; sin sesión válida, `401`. ADMINISTRADOR e INSTRUCTOR son **solo lectura** en esta etapa: el flujo obligatorio lo decide el socio, no el personal (la reasignación por instructor es P-61, Etapa 5).

La regla fina de propiedad **MUST** aplicarse en el handler:

- Un SOCIO **MUST** operar solo sobre su propia sugerencia. Si envía `socioId`, **MUST** recibir `403 FORBIDDEN`, aunque el valor coincida con el suyo: el contrato no acepta el parámetro para ese rol.
- Un ADMINISTRADOR o INSTRUCTOR **MUST** enviar `socioId` en el `GET` y puede leer la sugerencia de cualquier socio existente. Si el socio no existe, `404 NOT_FOUND`.
- **Ningún** rol puede decidir (`POST`) sobre la sugerencia de otro socio: el `POST` es exclusivo del SOCIO sobre lo propio.

La matriz y el handler **MUST** quedar cubiertos por el test de consistencia existente y por tests de handler para la regla de propiedad.

#### Scenario: Matriz de permisos

- GIVEN la matriz de permisos y los handlers de `/api/asignaciones/*`
- WHEN se ejecuta el test de consistencia
- THEN SOCIO tiene `GET` y `POST`
- AND ADMINISTRADOR e INSTRUCTOR tienen solo `GET`
- AND RECEPCIONISTA no tiene acceso
- AND la matriz no otorga un método que el handler rechace

#### Scenario: SOCIO con `socioId` ajeno

- GIVEN una sesión de SOCIO y una petición con `socioId` de otro socio
- WHEN se procesa
- THEN recibe `403 FORBIDDEN`
- AND no se revela ningún dato del otro socio

#### Scenario: SOCIO con su propio `socioId`

- GIVEN una sesión de SOCIO y una petición con su propio `socioId`
- WHEN se procesa
- THEN también recibe `403 FORBIDDEN`, porque el parámetro no está permitido para ese rol

#### Scenario: ADMINISTRADOR consulta a un socio

- GIVEN una sesión de ADMINISTRADOR y un `socioId` existente
- WHEN consulta la sugerencia
- THEN recibe `200` con la sugerencia del socio

#### Scenario: ADMINISTRADOR con socio inexistente

- GIVEN una sesión de ADMINISTRADOR y un `socioId` que no existe
- WHEN consulta o decide
- THEN recibe `404 NOT_FOUND` con "Socio no encontrado"

#### Scenario: Sin sesión

- GIVEN una petición sin sesión válida
- WHEN llega a `/api/asignaciones/sugerencia` o `/api/asignaciones/decidir`
- THEN recibe `401`

#### Scenario: Rol sin permiso

- GIVEN una sesión de RECEPCIONISTA
- WHEN llega a cualquiera de los dos endpoints
- THEN recibe `403 FORBIDDEN`

### Requirement: Mapeo de errores

Los handlers **MUST** usar el mapeo de errores compartido (`route-error-mapper`) y devolver un envelope estable con `code`, `message` y el status HTTP. Los mensajes **MUST** estar en español y **MUST NOT** exponer detalles internos, stack traces ni datos de otros socios.

| Situación | Status | Código | Mensaje de referencia |
|---|---|---|---|
| Cuerpo o query inválidos | 400 | `VALIDATION_ERROR` | "La solicitud no es válida" (detalle del campo) |
| Sin sesión | 401 | — | Lo resuelve el middleware |
| Rol sin permiso o socio ajeno | 403 | `FORBIDDEN` | "No tiene permiso para realizar esta acción" |
| Socio inexistente | 404 | `NOT_FOUND` | "Socio no encontrado" |
| Sin sugerencia | 404 | `SIN_SUGERENCIA` | "No hay una sugerencia vigente" |
| Sugerencia vencida o cancelada | 409 | `SIN_SUGERENCIA_VIGENTE` | "La sugerencia ya no está vigente; vuelva a consultar" |
| Fallo inesperado | 500 | `SERVER_ERROR` | "No se pudo procesar la solicitud" |

Un `invalido` del motor en la lectura de `siguienteEnOrden` **MUST NOT** convertirse en `500`: se degrada a `siguienteEnOrden: null` y se loguea. Un fallo de persistencia en `POST` **MUST** devolver `500 SERVER_ERROR` (la decisión no se aplicó) sin exponer el error interno.

#### Scenario: Error de validación

- GIVEN un `POST` con `accion` ausente
- WHEN se procesa
- THEN recibe `400` con `code = VALIDATION_ERROR` y un mensaje en español

#### Scenario: Error inesperado

- GIVEN un fallo de base de datos al persistir la decisión
- WHEN se procesa
- THEN recibe `500` con `code = SERVER_ERROR` y un mensaje genérico
- AND el detalle real queda en el log del servidor

### Requirement: Contrato de respuesta estable

Las respuestas **MUST** ser JSON con timestamps en ISO 8601 UTC, segundos como enteros y `null` explícito para los valores ausentes. **MUST NOT** incluir campos internos de persistencia que no estén en el contrato (por ejemplo, `estado` de la fila, `sesionId` o datos de auditoría). El contrato **MUST** ser el mismo para SOCIO, ADMINISTRADOR e INSTRUCTOR; solo cambia quién puede consultarlo.

La sugerencia devuelta **MUST** ser la misma fila que la orquestación persistió y que la sesión consumirá; la API **MUST NOT** inventar una sugerencia calculada al vuelo. `siguienteEnOrden` es la única parte calculada en la lectura y se identifica como informativa.

#### Scenario: Consistencia entre lectura y decisión

- GIVEN una sugerencia devuelta por `GET`
- WHEN el socio decide sobre ella con `POST`
- THEN la decisión se aplica exactamente sobre esa fila
- AND no se crea una sugerencia distinta entre la lectura y la decisión

#### Scenario: Timestamps y nulos

- GIVEN una respuesta con `sugerencia: null`
- WHEN se inspecciona el JSON
- THEN `sugerencia` es `null` explícito
- AND los timestamps presentes están en ISO 8601 UTC

## Escenarios

| # | Nombre | Qué demuestra | Resultado esperado |
|---|---|---|---|
| 1 | Socio con sugerencia | Lectura propia | `200` con reserva |
| 2 | Socio sin sugerencia | Lectura válida sin reserva | `200` con `null` |
| 3 | Socio sin rutina | No es error | `200` con ambos `null` |
| 4 | Lectura sin escritura | GET es solo lectura | Sin filas nuevas |
| 5 | Fallo del cálculo | Degradación de `siguienteEnOrden` | `200` con `null` |
| 6 | Aceptar | Decisión idempotente | Reserva intacta |
| 7 | Esperar | Cancelación y rutina | `CANCELADA` |
| 8 | Sin sugerencia | Error de estado | `404 SIN_SUGERENCIA` |
| 9 | Sugerencia vencida | Conflicto de estado | `409 SIN_SUGERENCIA_VIGENTE` |
| 10 | Acción inválida | Validación | `400 VALIDATION_ERROR` |
| 11 | Intento de elegir máquina | Flujo obligatorio | `400 VALIDATION_ERROR` |
| 12 | Matriz de permisos | Coherencia matriz/handler | SOCIO `GET`+`POST`; ADMIN/INSTRUCTOR solo `GET`; recepción `403` |
| 13 | SOCIO con `socioId` ajeno | Propiedad | `403 FORBIDDEN` |
| 14 | SOCIO con su `socioId` | Parámetro prohibido | `403 FORBIDDEN` |
| 15 | ADMIN consulta a socio | Acceso administrativo | `200` |
| 16 | Socio inexistente | Recurso faltante | `404 NOT_FOUND` |
| 17 | Sin sesión | Autenticación | `401` |
| 18 | Recepcionista | Rol sin permiso | `403 FORBIDDEN` |
| 19 | Validación de cuerpo | Error de contrato | `400 VALIDATION_ERROR` |
| 20 | Error inesperado | Error genérico | `500 SERVER_ERROR` |
| 21 | Consistencia GET/POST | Misma fila | Decisión sobre la misma reserva |
| 22 | Timestamps y nulos | Contrato estable | ISO 8601 y `null` explícito |

## Acceptance Criteria

- **AC-481**: `GET /api/asignaciones/sugerencia` devuelve `200` con `socioId`, `sugerencia` (o `null`), `siguienteEnOrden` (o `null`) y `calculadoEn`; no crea ni modifica reservas; un socio sin rutina recibe `200` con ambos `null`.
- **AC-482**: `POST /api/asignaciones/decidir` acepta solo `accion` (`ACEPTAR`/`ESPERAR`) y `socioId` según el rol; `ACEPTAR` es idempotente; `ESPERAR` cancela; la operación es transaccional.
- **AC-483**: La matriz de permisos incluye `/api/asignaciones`: SOCIO con `GET` y `POST` sobre lo propio, ADMINISTRADOR e INSTRUCTOR con `GET` únicamente, RECEPCIONISTA con `403`; sin sesión, `401`; la consistencia matriz/handler queda probada.
- **AC-484**: Los errores usan `route-error-mapper` con `code`/`message` en español: 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`, 404 `NOT_FOUND`/`SIN_SUGERENCIA`, 409 `SIN_SUGERENCIA_VIGENTE`, 500 `SERVER_ERROR`; sin filtrar detalles internos.
- **AC-485**: Las respuestas son JSON estables, con timestamps ISO 8601 UTC, segundos enteros y `null` explícito; no exponen campos internos de persistencia.
- **AC-486**: La sugerencia devuelta por GET es la misma fila que POST decide y que la sesión consume; la API no inventa una sugerencia calculada.
- **AC-487**: Un SOCIO no puede enviar `socioId` ni operar sobre otro socio (`403`); ADMINISTRADOR/INSTRUCTOR deben enviarlo en el `GET` y reciben `404` si el socio no existe; ninguno de los dos puede `POST`.
- **AC-488**: El contrato no admite `ejercicioId`, `maquinaId` ni ningún campo de elección libre; un campo desconocido devuelve `400 VALIDATION_ERROR`.
- **AC-489**: Un fallo, `invalido` o timeout del cálculo de `siguienteEnOrden` se degrada a `null` con `200` y log, sin romper la lectura de la sugerencia.
- **AC-490**: `GET` es estrictamente de lectura; repetir la consulta no crea ni modifica filas; `POST` sobre una sugerencia vencida devuelve `409` y no reescribe la fila vencida.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| `GET /api/asignaciones/sugerencia` | 1, 2, 3, 4, 5 | AC-481, AC-489, AC-490 |
| `POST /api/asignaciones/decidir` | 6, 7, 8, 9, 10, 11 | AC-482, AC-488 |
| Permisos por rol y propiedad | 12, 13, 14, 15, 16, 17, 18 | AC-483, AC-487 |
| Mapeo de errores | 19, 20 | AC-484 |
| Contrato de respuesta estable | 21, 22 | AC-485, AC-486 |

## Fuera de alcance

- La pantalla del socio y cualquier componente visual (Etapa 5).
- La reasignación o cancelación por instructor (P-61, Etapa 5).
- Un endpoint para elegir máquina o ejercicio libremente (prohibido por el flujo obligatorio).
- La simulación comparativa de la tesis (P-62).
- La autenticación y el middleware RBAC; se consumen como están.
- La definición de tipos TypeScript y validadores concretos (fase de diseño).

## Contrato de datos

Nota semántica; el diseño fija tipos, validadores y nombres exactos.

| Elemento | Semántica |
|---|---|
| Query `socioId` | Obligatorio para ADMINISTRADOR/INSTRUCTOR; prohibido para SOCIO (se deriva de la sesión). |
| Body `accion` | `"ACEPTAR"` o `"ESPERAR"`. |
| Body `socioId` | Prohibido para todos los roles: el `POST` resuelve el socio desde la sesión. |
| `sugerencia` | Reserva `RESERVADA` vigente con `asignacionId`, `ejercicioId`, `ejercicioNombre`, `maquinaId`, `maquinaNombre`, `esperaSegundos`, `ahorroSegundos`, `creadaEn`, `venceEn`; o `null`. |
| `siguienteEnOrden` | Ejercicio informativo con `ejercicioId`, `ejercicioNombre`, `maquinaId` (nullable) y `esperaSegundos`; o `null`. |
| `calculadoEn` | Instante ISO 8601 usado como `ahora`. |
| Error | `{ code, message }` con status HTTP; mensajes en español. |

## Numeración

- Decisiones: **D-88+** (última registrada D-87).
- Tareas: **T-056+** (última registrada T-055d).
- Pendientes: **P-68+**; esta change cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70.
