# Delta for seed-asignacion-demo

## Purpose

Que un entorno recién sembrado permita ver y usar la sugerencia de asignación sin pasar a mano por
`/maquinas`. Hoy el seed crea máquinas (`prisma/seed-data.ts:158-165`) pero nunca filas
`EjercicioMaquina`, así que el motor devuelve `sin_opciones` y la tarjeta de `asignacion-sugerencia-ui`
siempre diría "sin sugerencia".

Estado: **especificado**. Solo datos de desarrollo; no toca el esquema ni la aplicación.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `seed-asignacion-demo` (nueva) |
| Change | `asignacion-ui` (S0, D-117) |
| Dependencias | `runSeed` (`prisma/seed-data.ts`), modelo `EjercicioMaquina` (`prisma/schema.prisma`), `tests/prisma-seed.test.ts` |
| Numeración AC | `AC-561…AC-566`. No colisiona con ningún rango existente |

## ADDED Requirements

### Requirement: Asociaciones de demostración

`runSeed` **MUST** dejar cada ejercicio de la rutina "Torso B" (`prisma/seed-data.ts:106-116`) asociado al
menos a una máquina con `estado = DISPONIBLE` de las que siembra `MAQUINAS`
(`prisma/seed-data.ts:158-165`). Las parejas exactas quedan fijadas en el diseño.

El seed **MUST NOT** crear máquinas, ejercicios ni rutinas nuevas para esto: reutiliza las que ya siembra.
Las máquinas `FUERA_DE_SERVICIO` **MUST NOT** recibir asociaciones.

Después de S0, `GET /api/asignaciones/sugerencia` para el socio del seed con "Torso B" activa **MUST**
poder devolver una sugerencia con máquina (deja de ser `sin_opciones`).

#### Scenario: Base recién sembrada

- GIVEN una base vacía
- WHEN se corre `npm run seed`
- THEN existen filas `EjercicioMaquina` para los cinco ejercicios de "Torso B"
- AND ninguna apunta a "Bicicleta fija" (está `FUERA_DE_SERVICIO`)
- AND la cantidad de máquinas y de ejercicios es la de siempre

#### Scenario: La pantalla funciona sin pasos manuales

- GIVEN una base recién sembrada y un check-in del socio 1
- WHEN el socio abre `/home-socio`
- THEN la tarjeta de asignación puede mostrar un ejercicio y una máquina (no cae en `sinSugerencia` por falta de asociaciones)

### Requirement: Idempotencia

Correr el seed dos o más veces **MUST NOT** duplicar asociaciones. La implementación **MUST** apoyarse en la
unicidad `@@unique([maquinaId, ejercicioId])` de `EjercicioMaquina` (o en una verificación previa equivalente).

#### Scenario: Doble ejecución

- GIVEN un entorno ya sembrado
- WHEN se vuelve a correr `npm run seed`
- THEN el número de filas `EjercicioMaquina` no cambia
- AND el seed termina sin error

### Requirement: Compatibilidad con el seed simulado

`tests/prisma-seed.test.ts` usa un Prisma falso que hoy no implementa `findMany` (devuelve un objeto, no un
arreglo). S0 **MUST** extender ese doble para que el seed siga siendo testeable sin base y **MUST NOT** romper
las aserciones existentes, incluida la de `maquina.createMany` (`tests/prisma-seed.test.ts:78`) y la de
"no re-crea" sobre la lista de modelos (`tests/prisma-seed.test.ts:67-68`).

#### Scenario: Suite del seed

- GIVEN el cambio de S0
- WHEN se corre `npm test -- tests/prisma-seed.test.ts`
- THEN todas las pruebas existentes pasan
- AND se agrega al menos una prueba que verifica las asociaciones y la idempotencia

### Requirement: Documentación

Si el seed cambia lo que un desarrollador ve al arrancar, la documentación **MUST** reflejarlo en una línea:
`README.md` (sección de datos de desarrollo) y, si corresponde, la entrada de la etapa en
`PROJECT-STATUS.md`. **MUST NOT** inventar cifras nuevas.

#### Scenario: README al día

- GIVEN el cierre de S0
- WHEN se lee `README.md`
- THEN ya no dice que el seed deja el motor sin asociaciones

## Acceptance Criteria (Delta)

- **AC-561**: `runSeed` crea filas `EjercicioMaquina` para los cinco ejercicios de "Torso B", todas contra máquinas `DISPONIBLE`.
- **AC-562**: Ninguna asociación apunta a una máquina `FUERA_DE_SERVICIO`.
- **AC-563**: Correr el seed dos veces no duplica asociaciones y no lanza.
- **AC-564**: `runSeed` no crea máquinas, ejercicios ni rutinas nuevas para lograr las asociaciones.
- **AC-565**: `tests/prisma-seed.test.ts` pasa completo con el doble extendido y agrega cobertura de asociaciones e idempotencia.
- **AC-566**: Un entorno recién sembrado, con check-in del socio 1, permite que la tarjeta muestre una sugerencia con máquina (smoke manual).

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Asociaciones de demostración | base recién sembrada, pantalla sin pasos manuales | AC-561, AC-562, AC-564, AC-566 |
| Idempotencia | doble ejecución | AC-563 |
| Compatibilidad con el seed simulado | suite del seed | AC-565 |
| Documentación | README al día | AC-566 |

## Fuera de alcance

- Sembrar sesiones, reservas o asistencias del día para la demo (el smoke hace el check-in real).
- Cambiar el esquema o agregar migraciones.
- Sembrar asociaciones para rutinas que no sean "Torso B".
