# Delta for reasignacion-instructor

## Purpose

Cerrar P-61: darle al instructor una salida cuando la realidad cambia a mitad de entrenamiento. El instructor
ve las sesiones abiertas y **cambia la máquina** de una ejecución `EN_CURSO` (o le asigna máquina a una fila
que no la tiene), sin tocar la sesión del socio ni su ejercicio.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `reasignacion-instructor` (nueva) |
| Change | `reasignacion-instructor` (P-61) |
| Dependencias | `asignacion-ejercicio-persistencia` (transición `EN_CURSO → CANCELADA`), `asignacion-orquestacion` (lock global), `rbac-middleware` (matriz), `member-access-check` (D-105 para ocupación) |
| Numeración AC | `AC-571…AC-585`. No colisiona: el rango usado llega a AC-566 |

## Requirements

### Requirement: Panel de sesiones en curso

`Home_Interno` **MUST** mostrar una sección "Sesiones en curso" solo para **INSTRUCTOR** y **ADMINISTRADOR**.
RECEPCIONISTA y SOCIO **MUST NOT** verla ni poder consultar el endpoint que la alimenta.

La sección **MUST** listar, por cada sesión `EN_CURSO`, el nombre del socio, el ejercicio actual y la máquina
actual (o "sin máquina asignada"), ordenadas por hora de inicio ascendente (la más vieja primero).

#### Scenario: El instructor ve quién está entrenando

- GIVEN dos socios con sesión `EN_CURSO`
- WHEN el INSTRUCTOR abre `Home_Interno`
- THEN ve dos filas con socio, ejercicio y máquina actual
- AND la sesión más antigua aparece primero

#### Scenario: Recepción no ve el panel

- GIVEN una sesión de RECEPCIONISTA
- WHEN abre `Home_Interno`
- THEN la sección "Sesiones en curso" no se renderiza
- AND `GET /api/reasignaciones` le responde `403`

#### Scenario: Sin sesiones abiertas

- GIVEN ninguna sesión `EN_CURSO`
- WHEN el instructor abre el panel
- THEN ve el estado vacío "No hay sesiones en curso" y no hay acciones

### Requirement: Lectura de sesiones abiertas

`GET /api/reasignaciones` **MUST** devolver solo sesiones con `estadoDeFinalizacion = EN_CURSO`, con:
`sesionId`, `socioId`, `socioNombre`, `horaInicio`, `ejercicioId`, `ejercicioNombre`, `maquinaId`,
`maquinaNombre`, `asignacionId` y `candidatos` (las máquinas del ejercicio con su `estado`).

`asignacionId` y `maquinaId` **MUST** ser `null` cuando la sesión no tiene fila `EN_CURSO` asociada (el socio
está en un ejercicio sin ejecución registrada). `candidatos` **MUST** listar únicamente máquinas de
`EjercicioMaquina` para ese ejercicio.

La lectura **MUST NOT** escribir nada y **MUST NOT** incluir sesiones finalizadas.

#### Scenario: Sesión con fila EN_CURSO

- GIVEN un socio entrenando el ejercicio E1 en la máquina M1
- WHEN el instructor consulta el endpoint
- THEN la fila trae `ejercicioId = E1`, `maquinaId = M1` y un `asignacionId`

#### Scenario: Sesión sin fila EN_CURSO

- GIVEN un socio en una sesión `EN_CURSO` cuyo ejercicio no tiene fila de ejecución
- WHEN el instructor consulta
- THEN la fila trae `asignacionId = null` y `maquinaId = null`
- AND `candidatos` sigue listando las máquinas del ejercicio

#### Scenario: Sesiones finalizadas

- GIVEN una sesión `FINALIZADA`
- WHEN se consulta el endpoint
- THEN esa sesión no aparece

### Requirement: Reasignación de máquina

`POST /api/reasignaciones` con body estricto `{ asignacionId, maquinaId }` **MUST**:

1. cancelar la fila `EN_CURSO` indicada (transición guardada `EN_CURSO → CANCELADA`), y
2. crear una fila `EN_CURSO` nueva para el **mismo** `sesionId` y el **mismo** `ejercicioId`, con la máquina
   destino,

en **una sola transacción**. Si la fila destino no se puede crear, la cancelación **MUST** revertirse.

La operación **MUST NOT** modificar `SesionDeEntrenamiento` (`ejercicioActualId`, `serieActual`,
`horaInicio`), ni los `RegistroDeProgreso` ya escritos.

#### Scenario: Cambio de máquina en el mismo ejercicio

- GIVEN un socio con una fila `EN_CURSO` para E1 en M1 y dos series registradas
- WHEN el instructor reasigna a M2
- THEN la fila de M1 queda `CANCELADA`
- AND existe una fila `EN_CURSO` para E1 en M2 con el mismo `sesionId`
- AND la sesión conserva `ejercicioActualId = E1` y sus dos registros

#### Scenario: Fila sin máquina

- GIVEN una fila `EN_CURSO` de E1 con `maquinaId = null`
- WHEN el instructor la reasigna a M2
- THEN la fila sin máquina queda `CANCELADA`
- AND se crea la fila `EN_CURSO` de E1 en M2

#### Scenario: Fallo al crear la fila nueva

- GIVEN un error de persistencia al crear la fila nueva
- WHEN se procesa la reasignación
- THEN la fila original **no** queda cancelada
- AND la respuesta es un error del servidor

### Requirement: Destino válido

La máquina destino **MUST** cumplir las tres condiciones, evaluadas dentro de la transacción:

1. es candidata del ejercicio (`EjercicioMaquina`);
2. está `DISPONIBLE`;
3. está libre: ningún **otro** socio la ocupa según la lógica de ocupación vigente (fila `EN_CURSO` con esa
   máquina, o sesión sin fila cuya única candidata es esa máquina — D-108), aplicando el corte de inactividad
   de D-105.

Si falla cualquiera, la respuesta **MUST** ser `409` con un mensaje en español que diga cuál falló, y
**MUST NOT** cambiarse nada.

#### Scenario: Máquina no candidata

- GIVEN M9 no está en `EjercicioMaquina` para E1
- WHEN se intenta reasignar a M9
- THEN responde `409` "Esa máquina no es una opción para este ejercicio"
- AND la fila original sigue `EN_CURSO`

#### Scenario: Máquina fuera de servicio

- GIVEN M2 con `estado = FUERA_DE_SERVICIO`
- WHEN se intenta reasignar a M2
- THEN responde `409` con el motivo de disponibilidad

#### Scenario: Máquina ocupada por otro socio

- GIVEN M2 ocupada por otro socio con actividad dentro del corte
- WHEN se intenta reasignar a M2
- THEN responde `409` "Esa máquina está ocupada"
- AND no se cancela la fila original

#### Scenario: El socio dejó la máquina hace más de la ventana

- GIVEN M2 con una fila `EN_CURSO` de otro socio sin actividad dentro de `minutosInactividadSesion`
- WHEN se intenta reasignar a M2
- THEN la reasignación se acepta

### Requirement: Concurrencia con el socio

La operación **MUST** ejecutarse dentro de `enTransaccionBloqueada` (el mismo lock global de
`calcularYReservar`) y la cancelación **MUST** usar un guard por `id + sesionId + estado = EN_CURSO`.

Si el socio completó el ejercicio entre la lectura del panel y la confirmación, el guard devuelve `0` y la
respuesta **MUST** ser `409` ("El socio ya terminó ese ejercicio"), sin reescribir nada.

#### Scenario: El socio terminó primero

- GIVEN un socio que completa la última serie de E1 antes de que el instructor confirme
- WHEN llega la reasignación
- THEN responde `409` y la fila queda `COMPLETADA`
- AND no se crea ninguna fila nueva

#### Scenario: Dos instructores a la vez

- GIVEN dos reasignaciones simultáneas sobre la misma fila
- WHEN ambas se procesan
- THEN solo una gana
- AND la otra recibe `409`

### Requirement: Auditoría en la transacción

Cada reasignación **MUST** escribir un `RegistroDeAuditoria` (`tipoOperacion = MODIFICACION`) **dentro de la
misma transacción**, con `responsableId` = el usuario instructor/administrador y, en `detalles`, `socioId`,
`ejercicioId`, `asignacionOrigenId`, `maquinaOrigenId` (o `null`) y `maquinaDestinoId`.

**MUST NOT** existir una reasignación sin registro ni un registro sin reasignación: si la auditoría falla, la
transacción se revierte y la respuesta es un error del servidor.

#### Scenario: Rastro completo

- GIVEN una reasignación exitosa de M1 (o `null`) a M2
- WHEN se consulta `RegistroDeAuditoria`
- THEN hay un registro `MODIFICACION` con el responsable, el socio, el ejercicio y ambas máquinas

#### Scenario: Auditoría imposible

- GIVEN un fallo al escribir la auditoría
- WHEN se procesa la reasignación
- THEN no se cancela ni se crea ninguna fila
- AND la respuesta es un error del servidor

### Requirement: Autorización

`POST /api/reasignaciones` **MUST** permitir solo a INSTRUCTOR y ADMINISTRADOR. SOCIO y
RECEPCIONISTA **MUST** recibir `403`; sin sesión, `401`. La matriz (`src/lib/authorization.ts`) **MUST**
reflejarlo y el test de consistencia matriz ↔ handler **MUST** pasar.

El `POST` de `/api/asignaciones` que ya existe para el SOCIO (`decidir`) **MUST** seguir rechazando a
cualquier rol que no sea SOCIO: el permiso de prefijo no reemplaza la regla fina del handler.

#### Scenario: Instructor autorizado

- GIVEN una sesión de INSTRUCTOR
- WHEN reasigna
- THEN la operación se procesa

#### Scenario: Socio y recepción rechazados

- GIVEN una sesión de SOCIO o de RECEPCIONISTA
- WHEN llama al endpoint de reasignación
- THEN responde `403`
- AND no cambia ninguna fila

### Requirement: Sin migraciones ni cambios al motor

La change **MUST NOT** agregar migraciones, columnas ni modelos, ni modificar `motor-espera.ts` ni la lógica
de cálculo. La fila `CANCELADA` conserva sus datos de medición y la fila nueva nace como cualquier
`crearEjecucionEnCurso`.

#### Scenario: Esquema intacto

- GIVEN el change aplicado
- WHEN se corre `npx prisma migrate status`
- THEN no hay migraciones nuevas
- AND `git diff` no toca `prisma/schema.prisma` ni `prisma/migrations/`

## Acceptance Criteria

- **AC-571**: `Home_Interno` muestra "Sesiones en curso" solo con rol INSTRUCTOR o ADMINISTRADOR; RECEPCIONISTA y SOCIO no la ven y el endpoint les responde 403.
- **AC-572**: `GET /api/reasignaciones` devuelve sesiones `EN_CURSO` con socio, ejercicio, máquina, `asignacionId` y `candidatos`, ordenadas por hora de inicio ascendente.
- **AC-573**: El `GET` no devuelve sesiones finalizadas y no escribe nada.
- **AC-574**: Reasignar cancela la fila `EN_CURSO` y crea otra `EN_CURSO` del mismo `sesionId` y `ejercicioId` con la máquina destino, en una transacción.
- **AC-575**: Una fila `EN_CURSO` con `maquinaId = null` puede recibir máquina (cancela la nula y crea la nueva).
- **AC-576**: Un destino que no es candidata del ejercicio devuelve 409 y no cambia nada.
- **AC-577**: Un destino no `DISPONIBLE` devuelve 409 y no cambia nada.
- **AC-578**: Un destino ocupado por otro socio vigente devuelve 409 y no cambia nada.
- **AC-579**: Si el socio terminó el ejercicio antes de la confirmación, el guard da 0 y la respuesta es 409 con la fila en `COMPLETADA`.
- **AC-580**: Cada reasignación escribe `RegistroDeAuditoria` `MODIFICACION` con responsable, socio, ejercicio, origen y destino, dentro de la transacción; sin auditoría no hay reasignación.
- **AC-581**: La operación corre bajo el lock global (`enTransaccionBloqueada`) y un test de integración contra Postgres lo demuestra; quitar el lock debe hacerlo fallar.
- **AC-582**: El body es estricto: solo `{ asignacionId, maquinaId }`; cualquier otro campo o un id inválido devuelve 400.
- **AC-583**: Matriz y handlers coinciden: INSTRUCTOR y ADMINISTRADOR pueden reasignar; SOCIO y RECEPCIONISTA 403; sin sesión 401; `decidir` sigue siendo exclusivo del SOCIO.
- **AC-584**: La sesión del socio no cambia (`ejercicioActualId`, `serieActual`, `horaInicio`) y sus `RegistroDeProgreso` quedan intactos.
- **AC-585**: Sin migraciones ni cambios en `prisma/schema.prisma`, `prisma/migrations/` ni `motor-espera.ts`; `npm test`, `tsc`, `lint` y `build` en verde.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Panel de sesiones en curso | ve, recepción no, vacío | AC-571 |
| Lectura de sesiones abiertas | con fila, sin fila, finalizadas | AC-572, AC-573 |
| Reasignación de máquina | cambio, sin máquina, fallo | AC-574, AC-575, AC-584 |
| Destino válido | no candidata, fuera de servicio, ocupada, inactiva | AC-576, AC-577, AC-578 |
| Concurrencia | socio terminó, dos instructores | AC-579, AC-581 |
| Auditoría | rastro, imposible | AC-580 |
| Autorización | instructor, socio/recepción | AC-583, AC-582 |
| Sin migraciones | esquema intacto | AC-585 |

## Fuera de alcance

- Saltar el ejercicio durante la sesión (**P-72**).
- Avisar al socio en su pantalla y recalcular reservas ajenas (D-131).
- Abrir `/clientes` al INSTRUCTOR o cambiar RN-06.
- Finalizar la sesión desde el panel.
- Historial de reasignaciones más allá de `RegistroDeAuditoria`.

## Contrato de datos

| Dato | Origen | Uso |
|---|---|---|
| `sesionId`, `socioNombre`, `horaInicio` | `SesionDeEntrenamiento` + `Socio.usuario.nombre` | fila del panel |
| `ejercicioId`, `ejercicioNombre` | `sesion.ejercicioActualId` + `rutinaAsignada.rutina.ejercicios` | fin del panel |
| `asignacionId`, `maquinaId`, `maquinaNombre` | fila `EN_CURSO` de la sesión | estado actual |
| `candidatos[].id/nombre/estado` | `EjercicioMaquina` + `Maquina` | selector |
| `{ asignacionId, maquinaId }` | body del `POST` | únicos campos aceptados |

## Numeración

- Decisiones: **D-125…D-131** (registradas en la propuesta).
- Tareas: **T-058+** (última registrada T-057e).
- Pendientes: **P-72** (saltar el ejercicio), registrado en `openspec/decisions.md`.
