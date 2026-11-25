# Delta for adaptacion-aprobacion

## Purpose

Flujo de revisión del instructor y vista del socio (slice S3): endpoints para listar, aprobar y rechazar
propuestas, carga y edición de la meta y el nivel del socio, y aplicación de la propuesta aprobada sobre la
rutina del socio con reinicio del juicio de progresión.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `adaptacion-aprobacion` (nueva) |
| Change | `adaptacion-rutina` |
| Dependencias | `adaptacion-propuesta` (S2), `adaptacion-motor` (S1), `rbac-middleware` (matriz), `autorización` (`src/lib/authorization.ts`), `clientes-crud` (edición de meta/nivel, R8) |
| Numeración AC | `AC-610…AC-620`. No colisiona: el rango usado llega a AC-585 |

## Requirements

### Requirement: RBAC de la aprobación

Los endpoints de propuestas (`GET /api/propuestas-adaptacion`, `POST /api/propuestas-adaptacion/[id]/aprobar`,
`POST /api/propuestas-adaptacion/[id]/rechazar`) **MUST** admitir solo INSTRUCTOR y ADMINISTRADOR. SOCIO y
RECEPCIONISTA **MUST** recibir `403`; sin sesión, `401`. El listado **MUST** devolver solo las propuestas de los
socios a cargo del instructor.

#### Scenario: Instructor autorizado

- GIVEN una sesión de INSTRUCTOR
- WHEN consulta o resuelve una propuesta de un socio a su cargo
- THEN la operación se procesa

#### Scenario: Socio y recepción rechazados

- GIVEN una sesión de SOCIO o RECEPCIONISTA
- WHEN llama a cualquier endpoint de propuestas
- THEN responde `403` y no cambia ninguna fila

#### Scenario: Instructor solo ve sus socios a cargo

- GIVEN un instructor con socios a cargo S1 y S2, y un socio S3 a cargo de otro instructor
- WHEN lista propuestas pendientes
- THEN ve las de S1 y S2, y no las de S3

### Requirement: Aprobación todo-o-nada

Aprobar una propuesta **MUST** aplicar el contenido completo de la propuesta a la rutina del socio, sin
aprobación parcial por ítem (D-142).

#### Scenario: Se aplica la propuesta entera

- GIVEN una propuesta `PENDIENTE` con N ítems
- WHEN el instructor la aprueba
- THEN los N cambios se aplican a la rutina del socio

### Requirement: 409 en estado no pendiente

Aprobar o rechazar una propuesta que **no** está en `PENDIENTE` (esto incluye `REEMPLAZADA`, `APROBADA` y
`RECHAZADA`) **MUST** devolver `409` con un motivo en español que diga el estado actual, y **MUST NOT** cambiar
nada (D-140).

#### Scenario: Aprobar una REEMPLAZADA

- GIVEN una propuesta en `REEMPLAZADA`
- WHEN el instructor intenta aprobarla
- THEN responde `409` con el motivo y no se aplica nada

#### Scenario: Aprobar una ya APROBADA o RECHAZADA

- GIVEN una propuesta en `APROBADA` o `RECHAZADA`
- WHEN el instructor intenta resolverla de nuevo
- THEN responde `409` y no cambia el estado

### Requirement: Efecto de la aprobación sobre la rutina del socio

Al aprobar, el sistema **MUST**: (1) aplicar la copia perezosa si el socio aún no la tiene; (2) escribir los
cambios en los `EjercicioEnRutina` de la copia; (3) actualizar `planActualizadoAt` **solo** en los ejercicios
que cambiaron series o repeticiones; y (4) dejar la propuesta en `APROBADA` con `aprobadoPor` y `resueltoAt`.
El juicio de progresión **MUST** reiniciarse desde el nuevo `planActualizadoAt` de los ejercicios afectados.

#### Scenario: Aprobar aplica copia y cambios

- GIVEN una propuesta `PENDIENTE` para un socio sin copia
- WHEN se aprueba
- THEN se clona la rutina, se escriben los cambios y `RutinaAsignada` apunta a la copia
- AND la propuesta queda `APROBADA` con `aprobadoPor` y `resueltoAt`

#### Scenario: `planActualizadoAt` solo en series/reps

- GIVEN una propuesta que cambia series en el ejercicio A y solo descanso en el B
- WHEN se aprueba
- THEN `planActualizadoAt` se mueve en A y no en B

#### Scenario: El juicio se reinicia desde el cambio

- GIVEN un ejercicio cuyo `planActualizadoAt` acaba de moverse
- WHEN el motor calcula la próxima sugerencia
- THEN ignora las sesiones anteriores a ese `planActualizadoAt`

### Requirement: Rechazo sin tocar la rutina

Rechazar una propuesta **MUST** dejarla en `RECHAZADA` con `aprobadoPor` y `resueltoAt`, y **MUST NOT** tocar
la rutina del socio. Se **MUST** aplicar el enfriamiento de `adaptacion-propuesta` para no reproponer lo mismo.

#### Scenario: Rechazo deja RECHAZADA

- GIVEN una propuesta `PENDIENTE`
- WHEN el instructor la rechaza
- THEN queda `RECHAZADA` con `aprobadoPor` y `resueltoAt`, y la rutina no cambia

### Requirement: Carga y edición de meta y nivel

El sistema **MUST** permitir cargar y editar `metaDeEntrenamiento` (Fuerza / Hipertrofia / Definición) y
`nivel` (`NivelDeDificultad`) del socio. La vía primaria **MUST** ser la edición de cliente existente
(`PUT /api/clientes/[id]`). Si el formulario de clientes no está disponible por el trabajo paralelo (R8), el
sistema **MUST** usar la ruta alternativa `PATCH /api/socios/[id]/entrenamiento` (o una pantalla propia) **sin**
modificar `cliente-form.tsx` ni `clientes/page.tsx`.

#### Scenario: Edición vía cliente existente

- GIVEN un socio y la edición de cliente disponible
- WHEN el instructor guarda meta y nivel
- THEN se persisten en `Socio.metaDeEntrenamiento` y `Socio.nivel`

#### Scenario: Ruta alternativa cuando el formulario no está

- GIVEN el formulario de clientes aún no integra la alta con huella (R8)
- WHEN se carga o edita la meta/nivel
- THEN se usa `PATCH /api/socios/[id]/entrenamiento` y no se tocan los archivos del trabajo paralelo

#### Scenario: Validación de los valores

- GIVEN meta o nivel fuera de los enums admitidos
- WHEN se guarda
- THEN se rechaza con error de validación y no se persiste

## Acceptance Criteria

- **AC-610**: Los tres endpoints de propuestas admiten solo INSTRUCTOR y ADMINISTRADOR; SOCIO/RECEPCIONISTA reciben 403 y sin sesión 401.
- **AC-611**: El listado devuelve solo las propuestas de los socios a cargo del instructor.
- **AC-612**: Aprobar aplica el contenido completo (todo-o-nada); no hay aprobación parcial por ítem.
- **AC-613**: Aprobar/rechazar en `REEMPLAZADA`, `APROBADA` o `RECHAZADA` devuelve 409 con motivo y no cambia nada.
- **AC-614**: Al aprobar se aplica la copia perezosa si falta, se escriben los cambios y la propuesta queda `APROBADA` con `aprobadoPor` y `resueltoAt`.
- **AC-615**: `planActualizadoAt` se mueve solo en los ejercicios que cambiaron series o repeticiones.
- **AC-616**: Rechazar deja `RECHAZADA` con `aprobadoPor` y `resueltoAt` y no toca la rutina; aplica el enfriamiento.
- **AC-617**: La meta/nivel se cargan por `PUT /api/clientes/[id]` cuando está disponible, y por `PATCH /api/socios/[id]/entrenamiento` como ruta alternativa (R8), sin tocar los archivos del trabajo paralelo.
- **AC-618**: Meta/nivel fuera de los enums se rechazan con error de validación.
- **AC-619**: El juicio de progresión se reinicia desde el nuevo `planActualizadoAt` de los ejercicios afectados.
- **AC-620**: La matriz (`src/lib/authorization.ts`) refleja los permisos y el test de consistencia matriz ↔ handler pasa.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| RBAC de la aprobación | instructor, socio/recepción, socios a cargo | AC-610, AC-611, AC-620 |
| Aprobación todo-o-nada | propuesta entera | AC-612 |
| 409 en estado no pendiente | REEMPLAZADA, APROBADA/RECHAZADA | AC-613 |
| Efecto de la aprobación sobre la rutina | copia y cambios, planActualizadoAt, reinicio | AC-614, AC-615, AC-619 |
| Rechazo sin tocar la rutina | rechazo | AC-616 |
| Carga y edición de meta y nivel | vía cliente, ruta alternativa, validación | AC-617, AC-618 |

## Contrato de datos

| Dato | Origen | Uso |
|---|---|---|
| `GET /api/propuestas-adaptacion` | tabla `PropuestaAdaptacion` | listado de pendientes del instructor |
| `POST …/aprobar` / `…/rechazar` | body sin campos extra | resolución todo-o-nada |
| `Socio.metaDeEntrenamiento`, `Socio.nivel` | `PUT /api/clientes/[id]` o `PATCH /api/socios/[id]/entrenamiento` | parámetros del motor |
| `aprobadoPor`, `resueltoAt`, `motivo` | resolución | auditoría del flujo |

## Fuera de alcance

- Aprobación automática por SLA (`PROPUESTA_SLA_DIAS`): solo marca visual.
- Aprobación parcial por ítem.
- Propagación de cambios de plantilla a copias existentes.
- Apertura de `/clientes` a INSTRUCTOR si la matriz actual no lo permite (se usa la ruta alternativa).

## Preguntas abiertas para Fernando

1. **Resolución de R8.** ¿El trabajo paralelo de alta con huella ya está integrado en `dev`? Si sí, la vía
   primaria (`PUT /api/clientes/[id]`) se implementa; si no, queda la ruta alternativa
   (`PATCH /api/socios/[id]/entrenamiento`). Opciones: (a) integrado → vía cliente, (b) no integrado → ruta
   alternativa, (c) implementar ambas y que el cliente decida en runtime.
2. **Alcance de "socios a cargo" del instructor.** ¿Cómo se resuelve qué socios están a cargo de un instructor?
   Opciones: (a) todos los socios (gimnasio chico), (b) por una relación instructor↔socio que hoy no existe en
   el schema, (c) solo el `responsableId` si ya existe en `Socio`.
3. **`aprobadoPor` en el rechazo.** D-140 guarda `aprobadoPor` en `RECHAZADA`. ¿El campo se llama
   `aprobadoPor` o conviene `resueltoPor` (quién resolvió, apruebe o rechace)? Opciones: (a) `aprobadoPor` para
   ambos, (b) `resueltoPor` para ambos, (c) dos campos separados.
4. **Body de los endpoints.** ¿El `POST` de aprobar/rechazar acepta un body (por ejemplo `{ motivo }` para el
   rechazo) o va sin body? Opciones: (a) rechazo con `{ motivo }` obligatorio, (b) `{ motivo }` opcional,
   (c) sin body.
