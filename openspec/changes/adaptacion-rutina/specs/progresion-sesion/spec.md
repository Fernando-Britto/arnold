# Delta for progresion-sesion

## Purpose

La sugerencia de carga que la sesión muestra hoy (D-59) pasa a salir del motor de adaptación micro (S1). El
slice S2 amplía la lectura de sesión para que el motor vea las repeticiones realizadas y el RIR por serie, y
cablea el motor en `seguimientoDeEjercicios` sin cambiar el contrato que consumen la pantalla de ejecución, el
resumen de fin de sesión y la tarjeta Progreso del Home.

Esta capacidad **no tenía spec**: D-59 se implementó sin delta en `openspec/specs/`, así que se crea como
capacidad nueva en lugar de un `MODIFIED` sobre un heading inexistente.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `progresion-sesion` (nueva) |
| Change | `adaptacion-rutina` |
| Dependencias | `adaptacion-motor` (S1), `progresion-ejercicio.ts` (D-59/D-61), `historial-ejercicio.ts`, `sesion-de-entrenamiento.ts` |
| Numeración AC | `AC-600…AC-607`. No colisiona: el rango usado en este change llega a AC-599 |

## Requirements

### Requirement: La sugerencia de la sesión sale del motor de adaptación

`seguimientoDeEjercicios` (`src/domains/sesion/sesion-de-entrenamiento.ts:891-929`) **MUST** obtener la
sugerencia de cada ejercicio del motor de adaptación micro (S1). **MUST NOT** mantener un criterio propio en
paralelo ni duplicar la regla ACSM.

#### Scenario: Una repetición de sobra produce una subida porcentual

- GIVEN un historial donde la última sesión del ejercicio hizo una repetición por encima del objetivo
- WHEN la sesión pide la sugerencia
- THEN la sugerencia es `subir` con una carga calculada por el motor (porcentaje y grilla), no un `+2,5 kg` fijo

#### Scenario: Sin historial no se inventa una sugerencia

- GIVEN un ejercicio sin registros de progreso
- WHEN la sesión pide la sugerencia
- THEN no hay sugerencia para ese ejercicio, igual que hoy (D-59)

### Requirement: La lectura de sesión expone repeticiones y RIR por serie

`leerSesion` y `SesionLeida` (`progresion-ejercicio.ts:38-43,64-78`) **MUST** exponer las repeticiones
realizadas y el RIR de la última serie de trabajo, no solo `{ carga, cumplida }`. El calentamiento y el drop set
**MUST NOT** aportar RIR ni repeticiones al criterio (D-64, D-69).

#### Scenario: La lectura trae las repeticiones de cada serie de trabajo

- GIVEN un ejercicio con series de trabajo de 10, 8 y 8 repeticiones contra un objetivo de 8
- WHEN la lectura de sesión evalúa
- THEN expone las tres repeticiones realizadas y la serie que cuenta para la carga

#### Scenario: El RIR de la última serie de trabajo es el que se expone

- GIVEN un ejercicio con RIR 3, 2 y 1 en tres series de trabajo
- WHEN la lectura de sesión evalúa
- THEN el RIR expuesto para el motor es 1 (última serie de trabajo)

#### Scenario: Calentamiento y drop set no aportan RIR

- GIVEN un ejercicio con un calentamiento y un drop set con RIR cargado
- WHEN la lectura de sesión evalúa
- THEN ninguno de los dos aporta repeticiones ni RIR al criterio

### Requirement: El contrato visible no se rompe

La respuesta de `GET /api/sesiones?enCurso=1` y `POST /api/sesiones` **MUST** conservar las claves
`sugerencias` y `ultimasVeces`, y cada sugerencia **MUST** conservar la forma `{ tipo, carga, motivo }`. La
integración **MUST NOT** agregar campos obligatorios nuevos al contrato.

#### Scenario: El payload conserva sus claves

- GIVEN una sesión con ejercicios con historial
- WHEN el cliente pide la sesión
- THEN la respuesta tiene `sugerencias` y `ultimasVeces`, y cada sugerencia tiene `tipo`, `carga` y `motivo`

#### Scenario: Un consumidor viejo sigue funcionando

- GIVEN la pantalla de ejecución, que lee `sugerencias[id].tipo`, `.carga` y `.motivo`
- WHEN la sugerencia viene del motor nuevo
- THEN la pantalla renderiza sin cambios de código

### Requirement: El motivo menciona la regla aplicada

Cada sugerencia **MUST** incluir un `motivo` legible que mencione la regla aplicada: repeticiones de sobra
(ACSM), desplazamiento por RIR cuando corresponda, o el piso de un paso cuando supera el tope del porcentaje.

#### Scenario: El motivo de una subida por ACSM

- GIVEN una subida habilitada por una repetición de sobra
- WHEN la sesión muestra la sugerencia
- THEN el motivo menciona las repeticiones de sobra y el porcentaje aplicado

#### Scenario: El motivo declara el piso de un paso

- GIVEN una carga de 20 kg con paso 2,5 y un 2 % elegido (0,4 kg)
- WHEN la sugerencia sube un paso (22,5 kg, 12,5 %)
- THEN el motivo declara que el piso de un paso prevaleció sobre el tope del 10 %

### Requirement: La descarga reactiva de D-59 queda intacta

La integración **MUST** conservar la descarga reactiva: tres fallos seguidos a la misma carga descargan un
10 % ajustado a la grilla, dos no, y un acierto corta la racha. **MUST NOT** cambiar ese comportamiento.

#### Scenario: Tres fallos descargan como hoy

- GIVEN tres sesiones consecutivas que no alcanzaron el objetivo a la misma carga
- WHEN la sesión pide la sugerencia
- THEN la sugerencia es `descargar` con el mismo cálculo de D-59

#### Scenario: La regresión no altera la racha

- GIVEN dos fallos seguidos y luego un acierto a la misma carga
- WHEN la sesión pide la sugerencia
- THEN la racha se corta y no hay descarga

### Requirement: Producción pasa meta y nivel nulos

La integración **MUST** pasar `meta = null` y `nivel = null` al motor, porque en este change no se persisten.
Con `meta = null` el motor **MUST** aplicar solo ACSM y **MUST NOT** leer el RIR, aunque el historial lo tenga.

#### Scenario: Con meta nula el RIR no cambia la decisión

- GIVEN un historial con una tendencia de RIR alta y `meta = null`
- WHEN la sesión pide la sugerencia
- THEN la decisión sale solo de la regla ACSM y el RIR no la desplaza

#### Scenario: Con nivel nulo se usa el default

- GIVEN `nivel = null`
- WHEN el motor evalúa
- THEN usa `BASICO` para rangos y frecuencia, sin cambiar el cálculo de carga

### Requirement: Los consumidores conservan el motivo del motor

La tarjeta Progreso del Home (`src/api/home-socio-data.ts:327`) y el resumen de fin de sesión
(`src/domains/sesion/resumen-sesion.ts:107`) **MUST** seguir mostrando el `motivo` de la sugerencia que devuelve
el motor, sin exigir campos nuevos.

#### Scenario: El Home muestra el motivo nuevo

- GIVEN una sugerencia con el motivo del motor nuevo
- WHEN la tarjeta Progreso del Home renderiza
- THEN muestra ese `motivo` tal cual, sin cambio de contrato

#### Scenario: El resumen muestra el motivo nuevo

- GIVEN una sesión cerrada con una sugerencia del motor
- WHEN el resumen de fin de sesión renderiza
- THEN muestra el mismo `motivo` que la sesión

## Acceptance Criteria

- **AC-600**: `seguimientoDeEjercicios` obtiene la sugerencia del motor de S1 y no mantiene un criterio paralelo.
- **AC-601**: `leerSesion`/`SesionLeida` exponen repeticiones realizadas y el RIR de la última serie de trabajo.
- **AC-602**: Calentamiento y drop set no aportan repeticiones ni RIR al criterio.
- **AC-603**: `GET/POST /api/sesiones` conservan `sugerencias`/`ultimasVeces` y la forma `{ tipo, carga, motivo }`.
- **AC-604**: El `motivo` menciona la regla aplicada (sobra ACSM, desplazamiento por RIR o piso de un paso).
- **AC-605**: La descarga reactiva de D-59 se comporta igual que antes (3 fallos descargan, 2 no, un acierto corta la racha).
- **AC-606**: La integración pasa `meta = null` y `nivel = null`; con meta nula el RIR no cambia la decisión.
- **AC-607**: La tarjeta Progreso del Home y el resumen muestran el `motivo` del motor sin campos nuevos.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| La sugerencia sale del motor | subida porcentual, sin historial | AC-600 |
| La lectura expone repeticiones y RIR | repeticiones, RIR última serie, calentamiento/drop | AC-601, AC-602 |
| El contrato visible no se rompe | payload, consumidor viejo | AC-603 |
| El motivo menciona la regla | ACSM, piso de un paso | AC-604 |
| Descarga reactiva intacta | 3 fallos, racha | AC-605 |
| Producción pasa meta y nivel nulos | meta nula, nivel nulo | AC-606 |
| Consumidores conservan el motivo | Home, resumen | AC-607 |

## Contrato de datos

| Dato | Origen | Uso |
|---|---|---|
| `Sugerencia { tipo, carga, motivo }` | motor de S1 vía `seguimientoDeEjercicios` | contrato visible de la sesión (sin cambios) |
| `SesionLeida { carga, cumplida, repeticionesRealizadas, rirUltimaSerie }` | ampliación interna de `progresion-ejercicio.ts` | entrada del motor |
| `meta`, `nivel` | integración: `null` en producción | condicionales del motor |

## Fuera de alcance

- Propuestas, aprobación y persistencia de meta/nivel (`adaptacion-plan`, D-143).
- Cambios en la pantalla de ejecución o en el Home más allá de mostrar el nuevo `motivo`.
- Estancamiento y `cambiar-repeticiones`.

## Preguntas abiertas para Fernando

1. **Formato del motivo para el socio.** ¿El texto del motor se muestra tal cual, o se reformula para el socio?
   Opciones: (a) tal cual, (b) una frase amigable derivada de `tipo`, (c) ambos.
2. **Alcance de la lectura ampliada.** ¿`SesionLeida` expone el RIR solo de la última serie de trabajo, o el de
   todas las series? Opciones: (a) solo la última (D-137), (b) todas, y el motor elige.
3. **¿La tarjeta del Home muestra el `tipo`** (subir/mantener/descargar) además del motivo? Opciones: (a) solo el
   motivo (como hoy), (b) motivo + indicador de tipo.
