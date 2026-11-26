# Delta for rutinas-crud

## Purpose

Ajustar el CRUD de rutinas a la copia por socio y a `planActualizadoAt` (D-135): el guardado de una rutina
debe mover `planActualizadoAt` solo cuando cambian series o repeticiones (hereda la semántica de D-61), y el
CRUD debe tolerar una `Rutina` propia del socio (la copia perezosa) sin romper la lectura de
`RutinaAsignada.rutina` ni el guard de borrado.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `rutinas-crud` (modificada) |
| Change | `adaptacion-rutina` |
| Dependencias | `adaptacion-propuesta` (migración de `planActualizadoAt`), `asignar-rutina`, D-59/D-61 |
| Numeración AC | `AC-TBD` (numeración sin reservar). No colisiona: el rango usado llega a AC-585 |

## MODIFIED Requirements

### Requirement: Ejercicios de la Rutina Subsection Management

The system **MUST** allow adding Ejercicio rows to the Rutina via the "Catálogo" button (multi-select modal),
and editing `series`, `repeticiones`, `descanso` (seconds) inline per row, with row deletion. Al guardar la
rutina, el handler **MUST** mover `planActualizadoAt` de cada `EjercicioEnRutina` **solo** cuando cambian sus
`series` o `repeticiones`; si solo cambió `descanso` u `orden`, `planActualizadoAt` **MUST NOT** moverse.

#### Scenario: Add exercises from catalog

- GIVEN the "Catálogo" modal is open showing all Ejercicio records
- WHEN the user multi-selects 3 exercises and confirms
- THEN the subtable adds 3 rows with EJERCICIO name populated and SER./REPS./DESCANSO defaulted to editable spinner inputs

#### Scenario: Edit series/reps/descanso inline

- GIVEN a subtable row exists for "Press Militar"
- WHEN the user sets SER.=4, REPS.=8, DESCANSO=90 (seconds)
- THEN the row reflects the new values, displaying DESCANSO as min:sec (e.g., "1:30")

#### Scenario: Cambiar series o repeticiones mueve `planActualizadoAt`

- GIVEN una rutina guardada y un ejercicio cuya fila cambia de `repeticiones` de 8 a 10
- WHEN se guarda la rutina
- THEN `planActualizadoAt` de ese ejercicio se actualiza a la fecha del guardado
- AND los ejercicios sin cambios de series/repeticiones conservan su `planActualizadoAt`

#### Scenario: Cambiar solo descanso u orden no mueve `planActualizadoAt`

- GIVEN una rutina guardada y un ejercicio al que solo se le cambia `descanso` o `orden`
- WHEN se guarda la rutina
- THEN `planActualizadoAt` de ese ejercicio **no** cambia

#### Scenario: Remove exercise from routine

- GIVEN a subtable row exists
- WHEN the user clicks the row's delete action
- THEN the EjercicioEnRutina row is removed from the Rutina (not the underlying Ejercicio)

#### Scenario: Search filters catalog before adding

- GIVEN the "Buscar ejercicio..." field is present in the subsection
- WHEN the user types "sentad"
- THEN the catalog search results (or inline suggestions) filter to matching Ejercicio names

## ADDED Requirements

### Requirement: Rutina propia del socio en el CRUD

Una `Rutina` que sea copia perezosa de un socio (D-135) **MUST** comportarse en el CRUD como cualquier otra
`Rutina`: aparece en el listado, se puede leer y editar, y el guard de borrado RN-04 **MUST** aplicar (no se
puede borrar mientras esté asignada activamente). El CRUD **MUST NOT** romper la lectura de
`RutinaAsignada.rutina` al apuntar a la copia.

#### Scenario: La copia aparece en el listado

- GIVEN un socio con rutina propia (copia) tras su primera aprobación
- WHEN el instructor abre el CRUD de rutinas
- THEN la copia aparece como una `Rutina` más, sin romper el listado de plantillas

#### Scenario: El guard de borrado aplica a la copia

- GIVEN una `Rutina` que es copia activa de un socio (RN-04)
- WHEN el instructor intenta borrarla
- THEN el borrado se rechaza por asignación activa, igual que una plantilla asignada

#### Scenario: La lectura de `RutinaAsignada.rutina` no se rompe

- GIVEN una `RutinaAsignada` que apunta a una copia por socio
- WHEN se lee `RutinaAsignada.rutina`
- THEN devuelve la copia (con sus `EjercicioEnRutina`) sin error ni cambios de contrato

## Acceptance Criteria

- **AC-TBD**: Guardar una rutina mueve `planActualizadoAt` solo en los `EjercicioEnRutina` cuyas `series` o `repeticiones` cambiaron.
- **AC-TBD**: Editar solo `descanso` u `orden` no mueve `planActualizadoAt`.
- **AC-TBD**: Una `Rutina` copia por socio aparece en el listado y el guard de borrado RN-04 aplica (no borrable si asignada).
- **AC-TBD**: Leer `RutinaAsignada.rutina` apuntando a una copia por socio devuelve la copia sin romper el CRUD ni la asignación.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Ejercicios de la Rutina Subsection Management (modificado) | catalog, inline, series/reps mueve, descanso/orden no mueve, remove, search | AC-TBD, AC-TBD |
| Rutina propia del socio en el CRUD (nuevo) | listado, guard de borrado, lectura | AC-TBD, AC-TBD |

## Fuera de alcance

- El flujo de asignación en sí (sigue fuera de este spec, como ya se aclara en la spec principal).
- Distinción visual entre plantilla y copia en el listado (no se decide acá).
- Propagación de cambios de plantilla a copias existentes.

## Preguntas abiertas para Fernando

1. **Distinción plantilla vs. copia en el listado.** ¿El ListPanel debe marcar visualmente qué rutinas son
   copias de un socio? Opciones: (a) sin distinción (la copia es una rutina más), (b) una etiqueta "propia del
   socio", (c) ocultar las copias del CRUD de plantillas.
2. **Edición de una copia desde el CRUD.** Si el instructor edita una copia por socio directamente desde el
   CRUD (no vía aprobación), ¿debe mover `planActualizadoAt` igual que en una plantilla? Opciones: (a) sí,
   misma semántica de series/reps, (b) no permitir editar copias desde el CRUD.
