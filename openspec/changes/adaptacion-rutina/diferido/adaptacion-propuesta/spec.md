# Delta for adaptacion-propuesta

## Purpose

Persistencia del registro de propuestas de adaptación (slice S2): tabla `PropuestaAdaptacion` con estado
(D-134), copia por socio perezosa de la rutina (D-135), columna explícita `planActualizadoAt` en
`EjercicioEnRutina`, defaults de meta/nivel y ciclo de vida de la propuesta (reemplazo y enfriamiento, D-140).

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `adaptacion-propuesta` (nueva) |
| Change | `adaptacion-rutina` |
| Dependencias | `adaptacion-motor` (S1), `rutinas-crud` (migración de `planActualizadoAt`), `asignar-rutina` (copia perezosa), schema Prisma (`Rutina`, `EjercicioEnRutina`, `RutinaAsignada`, `Socio`) |
| Numeración AC | `AC-TBD` (numeración sin reservar). No colisiona: el rango usado llega a AC-585 |

## Requirements

### Requirement: Estado de la propuesta

La propuesta **MUST** tener exactamente uno de los estados `PENDIENTE | APROBADA | RECHAZADA | REEMPLAZADA`.
El estado **MUST** vivir en la propuesta, **MUST NOT** vivir en el ítem de contenido (D-142).

#### Scenario: Estados válidos

- GIVEN una propuesta creada por el sistema
- WHEN se crea
- THEN nace en `PENDIENTE` y puede transicionar a `APROBADA`, `RECHAZADA` o `REEMPLAZADA`

#### Scenario: El estado no vive en el ítem

- GIVEN una propuesta con varios ítems de ejercicio
- WHEN se consulta un ítem
- THEN el ítem no tiene estado propio; el estado es solo de la propuesta

### Requirement: Contenido como ítems por ejercicio con id estable

El contenido de la propuesta **MUST** guardarse como lista de ítems por ejercicio, cada ítem con un `id`
estable (no dependiente de posición). La aprobación es **todo-o-nada** sobre la propuesta entera (D-142).

#### Scenario: Ítems con id estable

- GIVEN una propuesta con 3 ejercicios adaptados
- WHEN se guarda
- THEN cada ítem persiste con un `id` estable que no cambia al reordenar ni al recalcular

#### Scenario: Aprobación todo-o-nada

- GIVEN una propuesta con un ítem correcto y otro dudoso
- WHEN se aprueba
- THEN se aplica la propuesta entera o nada; no hay aprobación parcial por ítem

### Requirement: Copia por socio perezosa

La primera adaptación que se aprueba **MUST** clonar `Rutina` + `EjercicioEnRutina` en una rutina propia del
socio y reasignar `RutinaAsignada`. Hasta ese momento, el socio **MUST** seguir apuntando a la plantilla
compartida. Una segunda adaptación **MUST** trabajar sobre la copia existente, sin volver a clonar.

#### Scenario: Primera aprobación clona

- GIVEN un socio sin copia, asignado a la plantilla compartida
- WHEN se aprueba su primera propuesta
- THEN se clona la rutina y sus ejercicios, y `RutinaAsignada` apunta a la copia

#### Scenario: Segunda aprobación no clona

- GIVEN un socio que ya tiene copia propia
- WHEN se aprueba otra propuesta
- THEN los cambios se escriben sobre la copia existente, sin crear una rutina nueva

#### Scenario: Socio sin adaptación sigue en la plantilla

- GIVEN un socio sin propuestas aprobadas
- WHEN se lee su rutina
- THEN sigue apuntando a la plantilla compartida

### Requirement: `planActualizadoAt` como fuente de `planDesde`

`EjercicioEnRutina` **MUST** ganar una columna `planActualizadoAt` (nullable, backfill desde `updatedAt`) como
fuente única de `planDesde`. El motor **MUST** leer `planActualizadoAt` y **MUST NOT** usar `updatedAt` para
decidir el corte del juicio. La migración **MUST** ser aditiva y agregar, en la misma migración,
`Socio.metaDeEntrenamiento` (enum Fuerza / Hipertrofia / Definición) y `Socio.nivel` (reusa `NivelDeDificultad`),
ambas nullable.

#### Scenario: Backfill desde `updatedAt`

- GIVEN una fila de `EjercicioEnRutina` existente con `updatedAt` fijado
- WHEN la migración corre
- THEN `planActualizadoAt` queda poblado con el valor de `updatedAt`

#### Scenario: El motor lee `planActualizadoAt`

- GIVEN un `planActualizadoAt` explícito distinto de `updatedAt`
- WHEN el motor calcula `planDesde`
- THEN usa `planActualizadoAt`, ignorando `updatedAt`

#### Scenario: Migración única y aditiva

- GIVEN el schema previo
- WHEN se aplica la migración de S2
- THEN agrega `planActualizadoAt`, `Socio.metaDeEntrenamiento` y `Socio.nivel` en una única migración aditiva

### Requirement: Defaults de meta y nivel

Con `Socio.metaDeEntrenamiento = null`, el sistema **MUST** tratar la meta como `META_POR_DEFECTO` (solo ACSM,
sin RIR). Con `Socio.nivel = null`, el sistema **MUST** tratarlo como `NIVEL_POR_DEFECTO` (`BASICO`) para
rangos y frecuencia, y **MUST NOT** cambiar el cálculo de carga (que es un % de la carga actual).

#### Scenario: Meta nula aplica solo ACSM

- GIVEN un socio con `metaDeEntrenamiento = null`
- WHEN el motor evalúa
- THEN aplica solo ACSM, sin modulación por RIR

#### Scenario: Nivel nulo usa BASICO sin tocar la carga

- GIVEN un socio con `nivel = null`
- WHEN el motor evalúa
- THEN usa `BASICO` para rangos de repeticiones y frecuencia
- AND el cálculo de carga no cambia por el nivel

### Requirement: Recálculo tras sesión cerrada

Tras cada sesión cerrada, el sistema **MUST** recalcular el motor para los ejercicios con historial. Si el
contenido propuesto cambia respecto de una `PENDIENTE` existente, la `PENDIENTE` **MUST** pasar a `REEMPLAZADA`
**conservando la fila**, y se **MUST** crear la nueva `PENDIENTE`.

#### Scenario: Contenido igual no duplica

- GIVEN una `PENDIENTE` y una sesión cerrada que produce el mismo contenido
- WHEN el servicio recalcula
- THEN no se crea una segunda pendiente; queda una sola

#### Scenario: Contenido distinto reemplaza

- GIVEN una `PENDIENTE` y una sesión nueva que cambia el diagnóstico
- WHEN el servicio recalcula
- THEN la anterior pasa a `REEMPLAZADA` (fila conservada, puntero a la nueva)
- AND la nueva nace `PENDIENTE`

### Requirement: Enfriamiento tras rechazo

Tras un rechazo, el motor **MUST NOT** volver a proponer el mismo contenido hasta pasar
`ENFRIAMIENTO_RECHAZO_SESIONES` sesiones contadas desde el rechazo.

#### Scenario: No repropone dentro del enfriamiento

- GIVEN una propuesta rechazada y menos de `ENFRIAMIENTO_RECHAZO_SESIONES` sesiones cerradas desde el rechazo
- WHEN el motor recalcula
- THEN no crea una nueva propuesta con el mismo contenido

#### Scenario: Vuelve a proponer tras el enfriamiento

- GIVEN una propuesta rechazada y ya pasadas `ENFRIAMIENTO_RECHAZO_SESIONES` sesiones
- WHEN el motor recalcula y el contenido sigue siendo válido
- THEN puede crearse una nueva `PENDIENTE` con ese contenido

## Acceptance Criteria

- **AC-TBD**: El estado vive en la propuesta (`PENDIENTE | APROBADA | RECHAZADA | REEMPLAZADA`), nunca en el ítem.
- **AC-TBD**: El contenido se guarda como ítems por ejercicio con `id` estable; la aprobación es todo-o-nada.
- **AC-TBD**: La primera aprobación clona `Rutina` + `EjercicioEnRutina` y reasigna `RutinaAsignada`; la segunda trabaja sobre la copia sin clonar.
- **AC-TBD**: `planActualizadoAt` existe con backfill desde `updatedAt` y es la única fuente de `planDesde`; el motor no usa `updatedAt`.
- **AC-TBD**: La migración es única y aditiva: agrega `planActualizadoAt`, `Socio.metaDeEntrenamiento` y `Socio.nivel` (ambas nullable).
- **AC-TBD**: `meta = null` → solo ACSM (sin RIR); `nivel = null` → `BASICO` sin cambiar el cálculo de carga.
- **AC-TBD**: Dos sesiones cerradas sin cambio de diagnóstico generan una sola `PENDIENTE`.
- **AC-TBD**: Si el diagnóstico cambia, la `PENDIENTE` pasa a `REEMPLAZADA` conservando la fila y se crea la nueva.
- **AC-TBD**: Tras un rechazo, no se repropone el mismo contenido hasta `ENFRIAMIENTO_RECHAZO_SESIONES` sesiones.
- **AC-TBD**: La copia perezosa no duplica plantillas de socios sin adaptación; la plantilla compartida sigue leyéndose por `RutinaAsignada.rutina`.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Estado de la propuesta | estados válidos, estado no en el ítem | AC-TBD |
| Contenido como ítems con id estable | id estable, todo-o-nada | AC-TBD |
| Copia por socio perezosa | primera clona, segunda no clona, sin adaptación plantilla | AC-TBD, AC-TBD |
| `planActualizadoAt` como fuente de `planDesde` | backfill, motor lee planActualizadoAt, migración única | AC-TBD, AC-TBD |
| Defaults de meta y nivel | meta nula, nivel nulo | AC-TBD |
| Recálculo tras sesión cerrada | igual no duplica, distinto reemplaza | AC-TBD, AC-TBD |
| Enfriamiento tras rechazo | dentro, tras el enfriamiento | AC-TBD |

## Contrato de datos

| Dato | Origen | Uso |
|---|---|---|
| `PropuestaAdaptacion { id, socioId, rutinaId, estado, creadoPor, aprobadoPor?, contenido, motivo, createdAt, resueltoAt, reemplazadaPorId? }` | tabla nueva | registro con estado |
| `contenido` (ítems con id estable) | salida de `adaptacion-motor` | qué cambia, por ejercicio |
| `EjercicioEnRutina.planActualizadoAt` | migración aditiva | fuente de `planDesde` |
| `Socio.metaDeEntrenamiento` / `Socio.nivel` | migración aditiva | condicionales del motor |

## Fuera de alcance

- Aprobación automática (el estado la habilita como configuración futura, no se implementa acá).
- Caducidad por SLA (`PROPUESTA_SLA_DIAS`): solo marca visual en el listado, sin job.
- Propagación de cambios de plantilla a socios que ya tienen copia (flujo existente de `asignarRutina`).
- Aprobación parcial por ítem (los ids estables la habilitan a futuro, no se implementa).

## Preguntas abiertas para Fernando

1. **`ENFRIAMIENTO_RECHAZO_SESIONES` sin default.** D-140 la define pero no fija cuántas sesiones. Opciones:
   (a) 2 sesiones, (b) 3 sesiones (coherente con estancamiento), (c) 5 sesiones.
2. **`PROPUESTA_SLA_DIAS` (R5).** El listado del instructor marca propuestas con más de N días pendientes.
   ¿Cuál es el default? Opciones: (a) 7 días, (b) 14 días, (c) no marcar en este change.
3. **`contenido` como JSON o tabla de ítems.** El spec fija "lista de ítems con id estable" pero no el medio
   físico. Opciones: (a) columna JSON en `PropuestaAdaptacion` (ids generados por el servicio), (b) tabla
   `PropuestaAdaptacionItem` (habilita la aprobación parcial más limpia, más cara en S2).
4. **Backfill de `planActualizadoAt` cuando `updatedAt` es nulo o ambiguo.** ¿Qué valor toma la columna para
   filas sin `updatedAt` fiable? Opciones: (a) `null` (sin corte: se juzga todo el historial), (b) fecha de
   migración, (c) `createdAt` del `EjercicioEnRutina`.
