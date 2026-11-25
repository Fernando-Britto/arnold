# Delta for adaptacion-motor

## Purpose

Motor puro de adaptación **micro** por ejercicio (slice S1). Funciones puras que consumen el historial del
ejercicio y la prescripción actual, y producen una `SugerenciaAdaptacion` por ejercicio con motivo legible.
Sin base, sin reloj propio, sin UI. La regla ACSM es el criterio primario; el RIR modula como señal blanda
solo cuando la meta lo justifica; la descarga reactiva de D-59 se conserva.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `adaptacion-motor` (nueva) |
| Change | `adaptacion-rutina` |
| Dependencias | `progresion-ejercicio` (D-59/D-61, `sugerirProximaCarga`), `historial-ejercicio` (`agruparSesiones`), `ReglaDeProgresion` (`LINEAL`, `incrementoSugerido` global) |
| Numeración AC | `AC-586…AC-599`. No colisiona: el rango usado llega a AC-585 |

## Requirements

### Requirement: Criterio primario por repeticiones de sobra (ACSM)

El motor **MUST** decidir la subida de carga por las **repeticiones realizadas contra el objetivo** de la
prescripción actual, no por un booleano `cumplida`. Cuando la última sesión juzgable del ejercicio logra entre
`REPS_SOBRANTES_PARA_SUBIR` (1) y su tope (2) repeticiones **por encima** del objetivo, el motor **MUST**
proponer una subida dentro de `[INCREMENTO_PCT_MIN, INCREMENTO_PCT_MAX]` (2 %–10 %) de la carga actual.

Lograr exactamente el objetivo (sin sobra) **MUST** dar `mantener`, igual que no cumplirlo. Tres o más
repeticiones de sobra **MUST** quedar topadas en `INCREMENTO_PCT_MAX`.

#### Scenario: Una repetición de sobra sube al mínimo

- GIVEN un ejercicio con objetivo de 8 repeticiones y la última sesión registra 9 en todas las series pedidas
- WHEN el motor evalúa la sugerencia
- THEN propone `subir` con un incremento igual a `INCREMENTO_PCT_MIN` de la carga actual
- AND el motivo menciona las repeticiones de sobra

#### Scenario: Dos repeticiones de sobra suben dentro del rango

- GIVEN un ejercicio con objetivo de 8 repeticiones y la última sesión registra 10 en todas las series
- WHEN el motor evalúa
- THEN propone `subir` con un incremento dentro de `[2 %, 10 %]`

#### Scenario: Tres o más repeticiones de sobra quedan topadas

- GIVEN un ejercicio con objetivo de 8 repeticiones y la última sesión registra 11 en todas las series
- WHEN el motor evalúa
- THEN propone `subir` topado en `INCREMENTO_PCT_MAX` (10 %)

#### Scenario: Objetivo cumplido sin sobra mantiene

- GIVEN un ejercicio cuya última sesión registra exactamente 8 repeticiones contra objetivo 8
- WHEN el motor evalúa
- THEN propone `mantener` (sin subida)

#### Scenario: Objetivo no cumplido mantiene

- GIVEN un ejercicio cuya última sesión registra 7 repeticiones contra objetivo 8
- WHEN el motor evalúa
- THEN propone `mantener` con el motivo de intentos restantes

### Requirement: RIR como señal blanda sobre ventana

El RIR **MUST NOT** ser gatillo de una sola sesión. Se evalúa como **tendencia** sobre `RIR_VENTANA_TENDENCIA`
sesiones, leído únicamente en la última serie del ejercicio (`RIR_SERIE_DE_LECTURA`). El desfase global
`RIR_DESFASE_GLOBAL` **MUST** poder aplicarse a esa lectura y ser **desactivable**.

El RIR solo **MAY** frenar o acelerar la decisión que ya tomó el criterio ACSM; nunca reemplazarla.

#### Scenario: Tendencia de RIR alto frena la subida

- GIVEN una meta de hipertrofia y una tendencia de RIR alto (socio lejos del fallo) sostenida sobre la ventana
- WHEN el motor evalúa una subida que ACSM habilitó
- THEN la subida se frena o se atenúa
- AND el motivo menciona la tendencia de RIR

#### Scenario: RIR de una sola sesión no gatilla nada

- GIVEN una única sesión con RIR atípico y las anteriores sin ese patrón
- WHEN el motor evalúa
- THEN la decisión es la del criterio ACSM, sin modulación por esa sesión aislada

#### Scenario: El RIR se lee en la última serie

- GIVEN un ejercicio con varias series, cada una con su RIR
- WHEN el motor evalúa el RIR
- THEN usa únicamente el RIR de la última serie del ejercicio

#### Scenario: Desfase global aplicable y desactivable

- GIVEN `RIR_DESFASE_GLOBAL` configurado (candidato +1)
- WHEN el motor evalúa la tendencia
- THEN la lectura se corrige con el desfase
- AND con el desfase apagado la lectura usa el valor crudo

### Requirement: La meta condiciona el RIR; sin meta solo ACSM

El motor **MUST** recibir la meta como parámetro. Con `meta = null` (o `META_POR_DEFECTO`), el motor **MUST**
aplicar **solo ACSM** y **MUST NOT** leer el RIR. Con meta `FUERZA`, el RIR **MUST NOT** cambiar la decisión.
Con meta `HIPERTROFIA` o `DEFINICION`, el RIR **MAY** modular. El condicional de RIR **MUST** ser apagable por
flag (`USAR_RIR_COMO_SENAL`).

#### Scenario: Sin meta no se lee RIR

- GIVEN `meta = null`
- WHEN el motor evalúa
- THEN decide solo por repeticiones de sobra (ACSM) y no usa el RIR

#### Scenario: Meta fuerza ignora el RIR

- GIVEN meta `FUERZA` y una tendencia de RIR que en otra meta frenaría
- WHEN el motor evalúa
- THEN la decisión no cambia por el RIR

#### Scenario: Meta hipertrofia habilita el RIR

- GIVEN meta `HIPERTROFIA`
- WHEN el motor evalúa
- THEN el RIR puede modular la decisión del criterio ACSM

#### Scenario: Flag apagado vuelve a ACSM puro

- GIVEN meta `HIPERTROFIA` y `USAR_RIR_COMO_SENAL = false`
- WHEN el motor evalúa
- THEN decide solo por ACSM, sin modular por RIR

### Requirement: Descarga reactiva intacta

La descarga reactiva de D-59 **MUST** conservarse: tres sesiones consecutivas con fallo a la misma carga
**MUST** disparar una descarga de `DELOAD_REDUCCION_VOLUMEN_PCT` (10 %) sobre la carga, ajustada a la grilla
del paso. Dos fallos seguidos **MUST NOT** descargar. Un acierto **MUST** cortar la racha.

#### Scenario: Tres fallos seguidos descargan

- GIVEN tres sesiones consecutivas sin cumplir el objetivo a la misma carga
- WHEN el motor evalúa
- THEN propone `descargar` con una carga `DELOAD_REDUCCION_VOLUMEN_PCT` menor que la actual

#### Scenario: Dos fallos no descargan

- GIVEN dos sesiones consecutivas con fallo a la misma carga
- WHEN el motor evalúa
- THEN propone `mantener`, sin descarga

#### Scenario: Un acierto corta la racha

- GIVEN dos fallos seguidos y una sesión con acierto a la misma carga
- WHEN el motor evalúa
- THEN la racha de fallos se reinicia y no hay descarga

### Requirement: Incremento por grilla del socio

La subida **MUST** respetar la grilla real del socio: `nueva carga = última + k × paso`, con
`k = max(1, redondeo(% elegido × última / paso))`, `%` dentro de `[INCREMENTO_PCT_MIN, INCREMENTO_PCT_MAX]` y
`paso` = `incrementoSugerido` de la regla `LINEAL` vigente (hoy global). El **piso de un paso** **MUST**
prevalecer sobre el tope del 10 % en cargas livianas, y el motivo **MUST** declararlo.

#### Scenario: Subida siempre en la grilla

- GIVEN última carga 50 kg, paso 2,5 y un % elegido que da `k = 2`
- WHEN el motor calcula la subida
- THEN propone `50 + 2 × 2,5 = 55 kg`, siempre múltiplo del paso desde la última carga

#### Scenario: Carga liviana, el piso prevalece sobre el tope

- GIVEN última carga 20 kg, paso 2,5 y un % elegido de 2 % (0,4 kg, menos de un paso)
- WHEN el motor calcula la subida
- THEN `k = max(1, redondeo(0,4 / 2,5)) = 1` y propone `20 + 2,5 = 22,5 kg` (12,5 %, por encima del tope)
- AND el motivo declara que el piso de un paso superó el tope porcentual

### Requirement: La descarga redondea a múltiplos absolutos

La promesa "nunca fuera de la grilla del socio" **MUST** aplicar a las **subidas**. La descarga de D-59
**MUST** redondear a múltiplos absolutos del paso y **MAY** devolver un peso armable que el socio nunca usó.

#### Scenario: La descarga puede salir de la grilla usada

- GIVEN una descarga que redondea a un múltiplo absoluto del paso que no coincide con cargas históricas
- WHEN el motor calcula la descarga
- THEN devuelve el múltiplo absoluto del paso, sin exigir que haya sido una carga previa del socio

### Requirement: Motivo textual en cada sugerencia

Toda `SugerenciaAdaptacion` **MUST** incluir un `motivo` legible que explique por qué propone ese tipo y ese
número. El motivo **MUST** ser distinto por tipo y **MUST** declarar las excepciones (piso que supera el tope,
tendencia de RIR, racha de fallos).

#### Scenario: Motivo de subida

- GIVEN una subida por repeticiones de sobra
- WHEN el motor emite la sugerencia
- THEN el motivo menciona las repeticiones de sobra y el porcentaje aplicado

#### Scenario: Motivo de mantener

- GIVEN una decisión de mantener
- WHEN el motor emite la sugerencia
- THEN el motivo dice cuántos intentos restan o por qué no hay subida

#### Scenario: Motivo de descarga

- GIVEN una descarga por racha de fallos
- WHEN el motor emite la sugerencia
- THEN el motivo menciona los fallos consecutivos y el porcentaje de descarga

### Requirement: Función pura y determinista

El motor **MUST** ser una función pura: **MUST NOT** leer base de datos, reloj, ni estado global o de módulo.
Dada la misma entrada (historial + prescripción + parámetros) **MUST** producir la misma salida.

#### Scenario: Determinismo con entradas idénticas

- GIVEN dos invocaciones con historial, prescripción y parámetros idénticos
- WHEN el motor se ejecuta dos veces
- THEN produce exactamente la misma `SugerenciaAdaptacion`

### Requirement: Estancamiento configurable

La detección de estancamiento **MUST** ser criterio de ingeniería configurable
(`ESTANCAMIENTO_VENTANA_SESIONES`, default 3). Por debajo del umbral, el motor **MUST NOT** proponer cambio de
rango de repeticiones. Alcanzado el umbral, el motor **MAY** proponer `cambiar-repeticiones`.

#### Scenario: Por debajo del umbral no propone cambio de rango

- GIVEN `ESTANCAMIENTO_VENTANA_SESIONES = 3` y solo 2 sesiones sin progreso a la misma carga
- WHEN el motor evalúa
- THEN no propone cambio de rango de repeticiones

#### Scenario: Alcanzado el umbral propone cambio de rango

- GIVEN `ESTANCAMIENTO_VENTANA_SESIONES = 3` y 3 sesiones consecutivas sin progreso a la misma carga
- WHEN el motor evalúa
- THEN propone `cambiar-repeticiones` con el nuevo rango y su motivo

### Requirement: Población como límite declarado

El motor **MUST** documentar en su contrato/JSDoc las exclusiones de `research.md` §3.13 (menores de 18,
mayores de 60–65 sin evaluación, embarazo, lesión no rehabilitada, condición cardiovascular no controlada) como
**límite de aplicabilidad**, y **MUST NOT** validar edad ni lesiones en ejecución. `POBLACION_EDAD_MIN`,
`POBLACION_EDAD_MAX` y `POBLACION_REQUIERE_NIVEL_EXPLICITO` quedan como parámetros de configuración, no como
filtros.

#### Scenario: El motor no valida población

- GIVEN un historial de un socio sin datos de edad ni lesiones
- WHEN el motor evalúa
- THEN no rechaza ni filtra por población, y el contrato declara las exclusiones

### Requirement: Umbrales como parámetros configurables candidatos

Todo umbral numérico del motor **MUST** ser un **parámetro configurable candidato** con su valor por defecto y
su fuente en `research.md`, **MUST NOT** ser una constante derivada de la evidencia. El valor por defecto
**MUST** poder sobrescribirse por configuración sin tocar el código del motor.

#### Scenario: Umbral parametrizado y sobrescribible

- GIVEN `INCREMENTO_PCT_MAX` con default 10 y fuente ACSM 2009 (§3.7)
- WHEN la configuración lo sobrescribe a 8
- THEN el motor aplica 8 como tope sin cambio de código

## Parámetros configurables candidatos

| Parámetro | Default | Fuente (`research.md`) | Tipo |
|---|---|---|---|
| `REPS_SOBRANTES_PARA_SUBIR` | 1–2 | §3.7 (ACSM 2009) | rango de sobra |
| `INCREMENTO_PCT_MIN` | 2 | §3.7 (ACSM 2009) | % |
| `INCREMENTO_PCT_MAX` | 10 | §3.7 (ACSM 2009) | % |
| `RIR_DESFASE_GLOBAL` | +1 (desactivable) | §3.6 (Halperin 2022) | reps |
| `RIR_SERIE_DE_LECTURA` | "última serie" | §3.6 (Halperin 2022) | selector |
| `RIR_VENTANA_TENDENCIA` | pendiente de Fernando | §3.2 (Robinson 2024) | sesiones |
| `RIR_OBJETIVO_FUERZA` | 2–3 | §3.2 (práctica) | RIR |
| `RIR_OBJETIVO_HIPERTROFIA` | 1–2 | §3.2 (práctica) | RIR |
| `USAR_RIR_COMO_SENAL` | true | §3.5 (Hickmott 2022) | bool |
| `DELOAD_REDUCCION_VOLUMEN_PCT` | 10 | D-59 / §3.8 (Bell 2023) | % |
| `ESTANCAMIENTO_VENTANA_SESIONES` | 3 | §3.9 (ingeniería) | sesiones |
| `META_POR_DEFECTO` | solo ACSM (null) | proposal §S2 | enum/null |
| `NIVEL_POR_DEFECTO` | `BASICO` | proposal §S2 | enum |
| `POBLACION_EDAD_MIN` | 18 | §3.13 | años |
| `POBLACION_EDAD_MAX` | 60 | §3.13 | años |
| `POBLACION_REQUIERE_NIVEL_EXPLICITO` | true | §3.13 | bool |
| `RANGO_REPS_FUERZA` | 1–6 | §3.7 (ACSM 2009) | rango |
| `RANGO_REPS_HIPERTROFIA` | 6–12 | §3.7 (ACSM 2009) | rango |

## Acceptance Criteria

- **AC-586**: La subida se dispara por 1–2 repeticiones de sobra y queda dentro de `[2 %, 10 %]`; cumplir sin sobra o no cumplir da `mantener`.
- **AC-587**: Tres o más repeticiones de sobra quedan topadas en el 10 %.
- **AC-588**: El RIR se lee solo en la última serie y nunca es gatillo de una sola sesión; se evalúa como tendencia sobre `RIR_VENTANA_TENDENCIA`.
- **AC-589**: `RIR_DESFASE_GLOBAL` se aplica a la última serie y es desactivable.
- **AC-590**: Con `meta = null` o meta `FUERZA`, el RIR no cambia la decisión; con hipertrofia/definición puede modular; el flag `USAR_RIR_COMO_SENAL` apaga el condicional.
- **AC-591**: Tres fallos seguidos a la misma carga descargan `DELOAD_REDUCCION_VOLUMEN_PCT`; dos fallos no; un acierto corta la racha.
- **AC-592**: La subida respeta `nueva carga = última + k × paso` con `k = max(1, redondeo(% × última / paso))` y `paso` = `incrementoSugerido` de la regla `LINEAL` global.
- **AC-593**: Con 20 kg y paso 2,5, el piso de un paso prevalece sobre el tope del 10 % (resultado 22,5 kg = 12,5 %) y el motivo lo declara.
- **AC-594**: La promesa de grilla aplica a las subidas; la descarga redondea a múltiplos absolutos del paso y puede dar un peso no usado.
- **AC-595**: Toda sugerencia incluye un `motivo` legible, distinto por tipo.
- **AC-596**: El motor es puro y determinista: sin base, sin reloj, misma entrada → misma salida.
- **AC-597**: `ESTANCAMIENTO_VENTANA_SESIONES` es configurable; por debajo del umbral no se propone cambio de rango.
- **AC-598**: El motor documenta las exclusiones de población (§3.13) como límite y no valida edad ni lesiones.
- **AC-599**: Todo umbral numérico es un parámetro configurable con default y fuente, sobrescribible sin tocar código.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Criterio primario por repeticiones de sobra (ACSM) | 1 sobra, 2 sobras, 3+ topadas, sin sobra, no cumplida | AC-586, AC-587 |
| RIR como señal blanda sobre ventana | tendencia frena, sesión única, última serie, desfase | AC-588, AC-589 |
| La meta condiciona el RIR | null, fuerza, hipertrofia, flag off | AC-590 |
| Descarga reactiva intacta | 3 fallos, 2 fallos, acierto corta racha | AC-591 |
| Incremento por grilla del socio | en grilla, carga liviana | AC-592, AC-593 |
| La descarga redondea a múltiplos absolutos | descarga fuera de grilla usada | AC-594 |
| Motivo textual en cada sugerencia | subir, mantener, descargar | AC-595 |
| Función pura y determinista | determinismo | AC-596 |
| Estancamiento configurable | bajo umbral, umbral alcanzado | AC-597 |
| Población como límite declarado | no valida población | AC-598 |
| Umbrales como parámetros configurables | sobrescribible | AC-599 |

## Contrato de datos

| Dato | Origen | Uso |
|---|---|---|
| `HistorialEjercicioAdaptacion` (series con `carga`, `repeticiones`, `rir`, `tipo`) | `agruparSesiones` (historial-ejercicio) | entrada del motor |
| `prescripcion { series, repeticiones }` | `EjercicioEnRutina` de la rutina activa | objetivo juzgable |
| `paso` | `ReglaDeProgresion.incrementoSugerido` (`LINEAL` global) | grilla de la subida/descarga |
| `meta`, `nivel`, parámetros | entrada explícita del llamante | condicionales del motor |
| `SugerenciaAdaptacion { tipo, carga, repeticiones, motivo, parametrosUsados }` | salida del motor | consumida por propuesta y vista |

## Fuera de alcance

- Meso (volumen por músculo, estancamiento muscular, fatiga semanal) — change posterior (D-136).
- Macro (transición entre fases) y descarga por calendario.
- Días disponibles y lesiones como datos de entrada reales (el motor los acepta como parámetro opcional, no hay dato que los alimente).
- Paso por ejercicio o por máquina (P-73).
- Validación de población en ejecución (solo límite declarado).

## Preguntas abiertas para Fernando

1. **`RIR_VENTANA_TENDENCIA` sin default numérico.** `research.md` la lista como parámetro pero no fija cuántas
   sesiones. Opciones: (a) 3 sesiones (coherente con estancamiento), (b) 5 sesiones, (c) dejar sin default y
   exigir configuración explícita antes de habilitar el RIR.
2. **Forma de la modulación del RIR.** El spec fija "frena o atenúa", pero no el mecanismo exacto. Opciones:
   (a) anular la subida (mantener) cuando el RIR sostenido es alto, (b) atenuar el porcentaje a la mitad,
   (c) solo anotar el RIR en `parametrosUsados` sin cambiar la decisión en esta iteración.
3. **`cambiar-repeticiones` y la doble progresión.** D-59 descartó la doble progresión porque `repeticiones` era
   un entero fijo. El cambio de rango por estancamiento reabre ese punto: ¿el nuevo rango reemplaza el entero
   fijo (rompiendo el contrato actual de `EjercicioEnRutina.repeticiones`) o se propone como sugerencia que el
   instructor edita a mano? Opciones: (a) sugerencia informativa sin tocar el esquema, (b) migración de
   `repeticiones` a rango (fuera del alcance de la migración única de D-135).
4. **Tipo `primera` (sin historial).** El spec no lo define explícitamente. Opciones: (a) el motor devuelve
   `null` para ejercicios sin historial (hereda D-59), (b) `primera` como tipo explícito con carga `null`.
