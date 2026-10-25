# Motor de Espera y Asignación Specification

## Purpose

Calcular, para cada ejercicio pendiente de la rutina de un socio, cuánto debe esperar hasta que haya una máquina usable, y recomendar cuál hacer ahora. Es un **motor de dominio puro**: recibe todo por parámetros (estado del gimnasio, ejercicios pendientes, duración de serie) y no lee base de datos, no consulta el reloj, no usa aleatoriedad y no hace I/O. Es la base sobre la que se construyen las Etapas 4 (integración con check-in y sesión) y 5 (pantalla del socio y simulación para la tesis).

La recomendación usa un criterio de **solo-espera** (menor tiempo de espera); no incorpora orden fisiológico. Esta limitación es declarada y se documenta para el informe de tesis (P-63).

Estado: **especificado** — especificación de dominio puro para la Etapa 3. Pendiente de diseño e implementación (T-055+). No toca código ni datos.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `motor-espera-asignacion` |
| Change | `motor-espera` (Etapa 3 — Motor de espera y sugerencia) |
| Dependencias | D-73 (`maquinas-crud`: catálogo y `EstadoMaquina`), D-74 (`maquina-ejercicio-assignment`: relación ejercicio↔máquina) |
| Relación con etapas | Consume los conceptos de Etapas 1 y 2 como **entrada desacoplada** (no importa Prisma ni repositorios). Es la base de Etapa 4 (check-in/sesión) y Etapa 5 (pantalla del socio, simulación comparativa) |
| Numeración AC | `AC-301+`. Los rangos `AC-001…AC-015` (specs tempranas) y `AC-201…AC-217` (`maquina-ejercicio-assignment`) ya están usados; este rango no colisiona |

## Requirements

### Requirement: Entrada desacoplada y dominio puro

El motor **MUST** recibir todo su contexto por parámetros y **MUST NOT** importar `@/lib/db`, `@prisma/client`, repositorios ni ningún otro módulo que implique persistencia o I/O. **MUST NOT** usar `Date.now()`, aleatoriedad ni estado global mutable. La entrada se modela con tipos propios, desacoplados del esquema Prisma:

- **Ejercicio pendiente**: `(id, orden, series, descanso, candidatos)`, donde `candidatos` es la lista de `Maquina.id` que el ejercicio puede usar.
- **Máquina en el gimnasio**: `(id, estado, ocupante | null, cola)`, donde `estado` es una unión literal propia equivalente a `EstadoMaquina` (`DISPONIBLE | OCUPADA | FUERA_DE_SERVICIO | INACTIVA`).
- **Ocupante**: `(seriesRestantes, descanso)` — el ejercicio que usa la máquina ahora.
- **Miembro en cola**: `(series, descanso)` — alguien que espera la máquina antes que el socio.
- **Parámetros**: `segundosEjecucionSerie` — duración de una serie en segundos, **recibida como parámetro** (los callers pasan 60; el motor nunca la hardcodea).

El `id` del candidato es el `id` de la fila `Maquina` (cada unidad física es una fila distinta); **no existe** un campo `unidades` ni un concepto agregado.

#### Scenario: Rutina completa en el momento de check-in

- GIVEN un socio recién registrado cuya rutina completa se pasa como lista de ejercicios pendientes, todos con `series = 1` y `descanso = 90`
- WHEN se invoca el motor con `segundosEjecucionSerie = 60` y dos máquinas: `M1` disponible sin ocupante y `M2` con un ocupante con `seriesRestantes = 1`
- THEN el motor acepta la entrada (no hay error de validación) y produce un resultado de éxito, no una excepción

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- Ejercicio `E1` (orden 1, series 1, descanso 90, candidatos `[M1]`):
  - `M1` no tiene ocupante ni cola → espera de `M1` = **0**
  - Espera de `E1` = 0
- Ejercicio `E2` (orden 2, series 1, descanso 90, candidatos `[M2]`):
  - `M2` ocupante con `seriesRestantes = 1`: ejecución `1 × 60 = 60`, descansos `(1 − 1) × 90 = 0` → **60**
  - Espera de `E2` = 60
- Recomendado = `E1` (0) · Siguiente en orden = `E1` · Ahorro = 0 − 0 = **0**
- `series = 1` es válido (≥ 1): la entrada de check-in no dispara validación

#### Scenario: Mismo input produce el mismo output

- GIVEN la misma entrada de "ahorro positivo" (escenario 11) invocada dos veces
- WHEN el motor se ejecuta en ambas
- THEN produce exactamente el mismo resultado (mismo recomendado, misma espera, mismo ahorro), porque no consulta reloj ni usa aleatoriedad

### Requirement: Predicado de máquina usable

El motor **MUST** definir su propio predicado de máquina usable y **MUST NOT** reutilizar el filtro de disponibilidad de `home-interno.ts`. Una máquina es **usable** si su `estado` es `DISPONIBLE` o `OCUPADA`; **no es usable** si es `FUERA_DE_SERVICIO` o `INACTIVA`.

El valor persistido `OCUPADA` tiene **dos lecturas** que conviven en el proyecto y el motor **SHOULD** documentarlas:

1. **Lectura de `home-interno`**: `OCUPADA` significa "en uso por otra sesión" y se trata como no disponible.
2. **Lectura del motor**: la ocupación real proviene de las sesiones activas (el `ocupante` de la entrada), no del estado persistido. Una fila `OCUPADA` **legada** (estado previo, sin ocupante real en la entrada) es usable.

El motor usa la segunda lectura; por eso define su propio predicado y no comparte helper con `home-interno`. Un test dedicado **MUST** asercionar el predicado para los cuatro estados.

#### Scenario: Estado DISPONIBLE

- GIVEN una máquina con `estado = DISPONIBLE`
- WHEN se evalúa el predicado de máquina usable
- THEN la máquina es usable

#### Scenario: Estado OCUPADA

- GIVEN una máquina con `estado = OCUPADA`
- WHEN se evalúa el predicado de máquina usable
- THEN la máquina es usable

#### Scenario: Estado FUERA_DE_SERVICIO

- GIVEN una máquina con `estado = FUERA_DE_SERVICIO`
- WHEN se evalúa el predicado de máquina usable
- THEN la máquina no es usable

#### Scenario: Estado INACTIVA

- GIVEN una máquina con `estado = INACTIVA`
- WHEN se evalúa el predicado de máquina usable
- THEN la máquina no es usable

#### Scenario: OCUPADA heredada sin ocupante real

- GIVEN un ejercicio con una única máquina candidata `M1` cuyo `estado = OCUPADA` pero con `ocupante = null` y `cola = []` (fila legada, sin ocupación real en la entrada)
- WHEN se calcula la espera
- THEN `M1` es usable y su espera es 0 (no hay ocupante ni cola): el ejercicio no espera

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- Predicado: `OCUPADA` → usable.
- `M1` no tiene ocupante ni cola → espera de `M1` = **0**
- Espera del ejercicio = **0**

### Requirement: Espera del ocupante (fórmula conservadora)

El tiempo restante de un ocupante **MUST** calcularse como:

```
seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso
```

La fórmula asume que el ocupante está **al inicio** de su serie actual. Es **conservadora**: sobre-estima la espera real, porque el ocupante puede llevar parte de la serie actual ya ejecutada. La espera real **MUST** ser menor o igual que la calculada (`real ≤ calculada`). Sobre-estimar es seguro para la recomendación: el motor nunca promete menos espera de la que habrá. Si el ocupante está en su última serie (`seriesRestantes = 1`), libera sin descanso posterior (el término `(seriesRestantes − 1) × descanso` se anula).

#### Scenario: Un ocupante en la misma máquina

- GIVEN un ejercicio `E1` cuya única máquina `M1` tiene un ocupante con `seriesRestantes = 2`
- WHEN se calcula la espera con `segundosEjecucionSerie = 60` y `descanso = 90`
- THEN la espera de `E1` es 210 segundos

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- Ocupante de `M1`: `seriesRestantes = 2`
  - Ejecución: `2 × 60 = 120`
  - Descansos: `(2 − 1) × 90 = 1 × 90 = 90`
  - Tiempo del ocupante = `120 + 90 =` **210**
- Espera de `E1` = min sobre candidatos = **210**

### Requirement: Duración de un miembro en cola

La duración de un miembro en cola **MUST** calcularse como:

```
series × segundosEjecucionSerie + (series − 1) × descanso
```

donde `series` y `descanso` son los del ejercicio que ese miembro va a realizar. La espera total de una máquina es la suma del tiempo del ocupante (si lo hay) más la duración de cada miembro en cola, en el orden en que están encolados.

#### Scenario: Cola de tres miembros

- GIVEN un ejercicio `E1` cuya única máquina `M1` tiene un ocupante con `seriesRestantes = 2` y una cola de tres miembros con `series = [1, 2, 3]`
- WHEN se calcula la espera con `segundosEjecucionSerie = 60` y `descanso = 90`
- THEN la espera de `E1` es 840 segundos

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- Ocupante de `M1`: `seriesRestantes = 2`
  - `2 × 60 = 120` · `(2 − 1) × 90 = 90` · total ocupante = **210**
- Miembro 1 (`series = 1`): `1 × 60 + (1 − 1) × 90 = 60 + 0 =` **60**
- Miembro 2 (`series = 2`): `2 × 60 + (2 − 1) × 90 = 120 + 90 =` **210**
- Miembro 3 (`series = 3`): `3 × 60 + (3 − 1) × 90 = 180 + 180 =` **360**
- Suma de la cola = `60 + 210 + 360 =` **630**
- Espera de `M1` = `210 + 630 =` **840**
- Espera de `E1` = **840**

### Requirement: Espera por máquina y por ejercicio

La espera de un ejercicio **MUST** ser el **mínimo**, sobre sus máquinas candidatas usables, del tiempo hasta que esa máquina se libere (tiempo del ocupante más la suma de la cola). Una máquina sin ocupante y sin cola tiene espera 0. Un ejercicio con **lista de candidatos vacía** **MUST** tener espera 0 y nunca espera (no es un bloqueo).

**Selección de la máquina (`maquinaId`)**: cuando el ejercicio tiene al menos una candidata usable, su sugerencia **MUST** exponer en `maquinaId` el `id` de la máquina elegida. La elección entre las candidatas usables del **mismo ejercicio** **MUST** seguir este orden: (1) **menor espera**; (2) en empate, la que aparece **primero** en `candidatos`; (3) en empate, `id` ascendente (defensivo: la posición en la lista ya es única en una entrada bien formada). Un ejercicio con `candidatos` vacío **MUST** exponer `maquinaId = null`. Importa porque la Etapa 4 reserva un lugar en la cola de esa máquina y la Etapa 5 le indica al socio a qué máquina caminar.

#### Scenario: Gimnasio vacío

- GIVEN un único ejercicio `E1` con una máquina `M1` disponible, sin ocupante y sin cola
- WHEN se calcula la espera
- THEN la espera es 0, el recomendado coincide con el siguiente en orden (el único ejercicio) y el ahorro es 0

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `M1` sin ocupante ni cola → espera = **0**
- Espera de `E1` = **0**
- Recomendado = `E1` · Siguiente en orden = `E1` · Ahorro = `0 − 0 =` **0**

#### Scenario: Dos unidades de la misma máquina

- GIVEN un ejercicio `E1` con dos candidatos `M1` y `M2` del mismo tipo ("Banco plano"), donde `M1` está ocupada (ocupante con `seriesRestantes = 3`) y `M2` está disponible sin ocupante
- WHEN se calcula la espera
- THEN la espera es 0: el motor trata cada unidad como candidato independiente por `Maquina.id` y gana la que se libera primero

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `M1` (ocupante `seriesRestantes = 3`): `3 × 60 = 180` · `(3 − 1) × 90 = 180` · total = **360**
- `M2` (disponible, sin ocupante ni cola): **0**
- Espera de `E1` = `min(360, 0) =` **0** → gana la unidad libre

#### Scenario: Dos unidades con la misma espera

- GIVEN un ejercicio `E1` con `candidatos = [M1, M2]`, ambas `DISPONIBLE`, sin ocupante ni cola
- WHEN se calcula la espera y se elige la máquina
- THEN la espera es 0 y `maquinaId = M1`, porque el empate se resuelve por la primera posición en `candidatos`

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `M1`: `DISPONIBLE`, sin ocupante ni cola → espera de `M1` = **0**
- `M2`: `DISPONIBLE`, sin ocupante ni cola → espera de `M2` = **0**
- Espera de `E1` = `min(0, 0) =` **0**
- Empate de espera → desempate por posición en `candidatos`: `M1` está en la posición 0 y `M2` en la 1 → `maquinaId =` **`M1`**
- El tercer nivel (`id` ascendente) no se aplica: las posiciones ya son distintas (defensivo)

#### Scenario: Dos unidades con esperas distintas

- GIVEN un ejercicio `E1` con `candidatos = [M1, M2]`, donde `M1` tiene un ocupante con `seriesRestantes = 2` y `M2` está libre
- WHEN se calcula la espera y se elige la máquina
- THEN la espera es 0 y `maquinaId = M2`, porque `M2` es la de menor espera

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `M1` (ocupante `seriesRestantes = 2`): `2 × 60 = 120` · `(2 − 1) × 90 = 90` · total = **210**
- `M2` (libre, sin ocupante ni cola): **0**
- Espera de `E1` = `min(210, 0) =` **0** → la menor espera es `M2`; `maquinaId =` **`M2`**
- No hay empate: el desempate por posición no se evalúa

#### Scenario: Ejercicio sin máquinas

- GIVEN un ejercicio `E1` (orden 2) con `candidatos = []` y un ejercicio `E2` (orden 1) cuya única máquina tiene un ocupante con `seriesRestantes = 2`
- WHEN se calcula la espera y se elige la máquina
- THEN `E1` tiene espera 0, no está bloqueado, es el recomendado y su `maquinaId` es `null`

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1` (orden 2, `candidatos = []`): no hay máquina que elegir → espera = **0** y `maquinaId =` **`null`**; no bloqueado
- `E2` (orden 1): ocupante `seriesRestantes = 2` → `2 × 60 = 120` · `(2 − 1) × 90 = 90` → **210**; `maquinaId =` **`M2`**
- Recomendado = `E1` (0, `maquinaId = null`) · Siguiente en orden = `E2` (210, `maquinaId = M2`)
- Ahorro = `210 − 0 =` **210**

#### Scenario: Ejercicio sin máquina asociada

- GIVEN un ejercicio `E1` (orden 2) con lista de candidatos vacía y un ejercicio `E2` (orden 1) cuya única máquina tiene un ocupante con `seriesRestantes = 2`
- WHEN se calcula la espera
- THEN `E1` tiene espera 0, **no** está bloqueado y es el recomendado; el ahorro es 210 segundos

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1` (orden 2, candidatos vacíos): espera = **0**, no bloqueado
- Nota de fixture: `E1.orden = 2` es necesario para que el siguiente en orden sea `E2`; con `E1.orden = 1` habría empate y el desempate por posición elegiría `E1`, con ahorro 0
- `E2` (orden 1): ocupante `seriesRestantes = 2` → `2 × 60 = 120` · `(2 − 1) × 90 = 90` → **210**
- Recomendado = `E1` (0) · Siguiente en orden = `E2` (orden 1) · Ahorro = `210 − 0 =` **210**

### Requirement: Validación de entrada

El motor **MUST** validar su entrada antes de calcular, con el mismo patrón que `src/domains/maquina/` (sin lanzar excepciones; devuelve un resultado de validación estructurado): `series ≥ 1`, `descanso ≥ 0`, `segundosEjecucionSerie > 0`. Una entrada inválida **MUST NOT** producir un cálculo parcial: se devuelve el error de validación y no se continúa. La validación es defensa en profundidad: el motor no confía en la base de datos ni en capas superiores.

**Orden de los controles**: la validación ocurre **antes** de comprobar si hay ejercicios pendientes. Una entrada con lista vacía y parámetros inválidos devuelve error de validación, no el resultado `vacío`.

#### Scenario: series = 0

- GIVEN un ejercicio pendiente con `series = 0`
- WHEN se invoca el motor
- THEN se devuelve un error de validación de dominio (no una excepción) y no se calcula nada

#### Scenario: descanso negativo

- GIVEN un ejercicio pendiente con `descanso < 0`
- WHEN se invoca el motor
- THEN se devuelve un error de validación de dominio y no se calcula nada

#### Scenario: segundosEjecucionSerie = 0

- GIVEN una invocación con `segundosEjecucionSerie = 0`
- WHEN se invoca el motor
- THEN se devuelve un error de validación de dominio y no se calcula nada

### Requirement: Bloqueo y códigos de motivo

Un ejercicio pendiente sin ninguna máquina usable **MUST** quedar **bloqueado**: se excluye de la recomendación y se reporta con un **código de motivo** (unión literal tipada, sin texto legible para el usuario; el mapeo a mensajes queda en la Etapa 4). Los tests **MUST** asercionar contra el código, no contra texto.

El vocabulario de códigos es:

| Código | Cuándo se emite | Resultado |
|---|---|---|
| `TODAS_FUERA_DE_SERVICIO` | Tiene ≥1 candidata y **todas** están en `FUERA_DE_SERVICIO` | Bloqueado; excluido de la recomendación |
| `TODAS_INACTIVAS` | Tiene ≥1 candidata y **todas** están en `INACTIVA` | Bloqueado; excluido |
| `SIN_MAQUINA_USABLE` | Tiene ≥1 candidata, ninguna usable, y las no usables son una **mezcla** de `FUERA_DE_SERVICIO` e `INACTIVA` (al menos una de cada) | Bloqueado; excluido |

**Ejercicio sin máquinas candidatas**: un ejercicio con lista de candidatos vacía tiene espera 0, **no** se bloquea y sigue siendo candidato a la recomendación; su sugerencia lleva `maquinaId = null`. No existe un código de bloqueo para este caso: el vocabulario emitido es exactamente los tres códigos de la tabla.

**Regla determinista para el caso mixto**: se inspecciona el conjunto de estados de las candidatas. Si todas son `FUERA_DE_SERVICIO` → `TODAS_FUERA_DE_SERVICIO`; si todas son `INACTIVA` → `TODAS_INACTIVAS`; si hay al menos una de cada (y ninguna usable) → `SIN_MAQUINA_USABLE`. La regla depende solo de los estados de las candidatas, por lo que es determinista.

**Candidata con `id` ausente en la lista de máquinas**: un `id` de candidata que no aparece en `maquinas` se trata como **no usable** y **no aporta estado** a la clasificación del motivo (la clasificación solo mira las candidatas presentes en `maquinas`). Consecuencias deterministas:

- `[id ausente, INACTIVA]` → `TODAS_INACTIVAS` (el `id` ausente no cuenta como estado).
- Candidatos no vacíos pero **todos** los `id` ausentes → `SIN_MAQUINA_USABLE` (fallback, porque no hay ningún estado de candidata que inspeccionar).

El motor nunca lanza por un `id` colgante: esa situación es un supuesto de entrada mal formada que degrada a "sin máquina usable".

#### Scenario: Única candidata fuera de servicio

- GIVEN un ejercicio `E1` (orden 1) cuya única candidata `M1` está `FUERA_DE_SERVICIO`, y un ejercicio `E2` (orden 2) con una candidata disponible
- WHEN se calcula
- THEN `E1` queda bloqueado con `TODAS_FUERA_DE_SERVICIO` y se excluye; el resultado es de éxito con `E2` como recomendado

**Razonamiento paso a paso**:

- `M1`: `FUERA_DE_SERVICIO` → no usable → `E1` no tiene candidata usable → bloqueado `TODAS_FUERA_DE_SERVICIO`
- `E2`: candidata disponible, sin ocupante → espera **0**
- Recomendado = `E2` · Siguiente en orden = `E2` · Ahorro = `0 − 0 =` **0** · Bloqueados = `[E1 → TODAS_FUERA_DE_SERVICIO]`

#### Scenario: Única candidata inactiva

- GIVEN un ejercicio `E1` (orden 1) cuya única candidata `M1` está `INACTIVA`, y un ejercicio `E2` (orden 2) con una candidata disponible
- WHEN se calcula
- THEN `E1` queda bloqueado con `TODAS_INACTIVAS`; el resultado es de éxito con `E2` como recomendado

**Razonamiento paso a paso**:

- `M1`: `INACTIVA` → no usable → `E1` bloqueado `TODAS_INACTIVAS`
- `E2`: candidata disponible → espera **0**
- Bloqueados = `[E1 → TODAS_INACTIVAS]`

#### Scenario: Mezcla de fuera de servicio e inactiva

- GIVEN un ejercicio `E1` (orden 1) con candidatas `[M1, M2]` donde `M1` está `FUERA_DE_SERVICIO` y `M2` está `INACTIVA`, y un ejercicio `E2` (orden 2) con una candidata disponible
- WHEN se calcula
- THEN `E1` queda bloqueado con `SIN_MAQUINA_USABLE` (caso mixto)

**Razonamiento paso a paso**:

- `M1`: `FUERA_DE_SERVICIO` (no usable) · `M2`: `INACTIVA` (no usable) · hay al menos una de cada y ninguna usable → `SIN_MAQUINA_USABLE`
- Bloqueados = `[E1 → SIN_MAQUINA_USABLE]`

#### Scenario: Candidata con id ausente en la lista de máquinas

- GIVEN `E1` con `candidatos = [MX (ausente), M2 (INACTIVA)]`, `E2` con `candidatos = [MY (ausente), MZ (ausente)]`, y `E3` con una máquina usable
- WHEN se calcula
- THEN `E1` queda bloqueado con `TODAS_INACTIVAS`, `E2` con `SIN_MAQUINA_USABLE`, y el resultado es de éxito con `E3` como recomendado

**Razonamiento paso a paso**:

- `E1`: `MX` no está en `maquinas` → se descarta, no es usable y **no aporta estado**; `M2` es `INACTIVA` → no usable. El único estado inspeccionable es `INACTIVA` → `TODAS_INACTIVAS`
- `E2`: `MY` y `MZ` no están en `maquinas` → se descartan y no aportan estado. No queda ningún estado inspeccionable → fallback `SIN_MAQUINA_USABLE`
- `E3`: máquina usable disponible, sin ocupante → espera **0**, `maquinaId` = esa máquina
- Resultado = éxito · Recomendado = `E3` · Siguiente en orden = `E3` · Ahorro = `0 − 0 =` **0** · Bloqueados = `[E1 → TODAS_INACTIVAS, E2 → SIN_MAQUINA_USABLE]` (en orden de entrada)
- Ningún `id` colgante lanza excepción

### Requirement: Selección del recomendado

El recomendado **MUST** ser el ejercicio no bloqueado con **menor espera**. Ante empate de espera, se aplica el orden de desempate canónico: (a) menor `orden` de rutina, (b) posición en la lista de entrada, (c) `id` ascendente.

#### Scenario: Empate de esperas

- GIVEN `E1` (orden 2) con espera 210 y `E2` (orden 1) con espera 210
- WHEN se selecciona el recomendado
- THEN gana `E2` por menor `orden`

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1`: `M1` ocupante `seriesRestantes = 2` → `2 × 60 = 120` · `(2 − 1) × 90 = 90` → **210**
- `E2`: `M2` ocupante `seriesRestantes = 2` → **210**
- Empate en espera (210) → desempate por `orden`: `E2` (1) < `E1` (2) → recomendado = `E2`
- Siguiente en orden = `E2` (orden 1) · Ahorro = `210 − 210 =` **0**

#### Scenario: Todos con orden = 0

- GIVEN tres ejercicios, todos con `orden = 0` y espera 210 cada uno, en posiciones de entrada `[0, 1, 2]`
- WHEN se selecciona el recomendado y el siguiente en orden
- THEN gana el de menor posición en la lista de entrada (el de la posición 0); el `id` queda como fallback final

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1` (posición 0): `M1` ocupante `seriesRestantes = 2` → **210**
- `E2` (posición 1): `M2` ocupante `seriesRestantes = 2` → **210**
- `E3` (posición 2): `M3` ocupante `seriesRestantes = 2` → **210**
- Recomendado: empate en espera (210) y en `orden` (0) → desempate por posición → `E1` (posición 0)
- Siguiente en orden: empate en `orden` (0) → desempate por posición → `E1`
- Ahorro = `210 − 210 =` **0**
- Nota: la posición es única por elemento en una lista, por lo que el fallback por `id` es defensivo (solo aplicaría si dos entradas compartieran posición, lo que la entrada bien formada no permite)

### Requirement: Siguiente en orden (baseline)

El resultado **MUST** incluir el **siguiente en orden de rutina** como línea base: el ejercicio no bloqueado con **menor `orden`**, con desempate por posición en la lista de entrada y luego por `id`. Este es el ejercicio que el socio haría si siguiera la rutina sin reordenar.

#### Scenario: Recomendado coincide con el siguiente en orden

- GIVEN `E1` (orden 1) con espera 0 y `E2` (orden 2) con espera 360
- WHEN se calcula
- THEN el recomendado y el siguiente en orden son ambos `E1`: no hay elección real y el ahorro es 0

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1` (orden 1): `M1` disponible sin ocupante → **0**
- `E2` (orden 2): `M2` ocupante `seriesRestantes = 3` → `3 × 60 = 180` · `(3 − 1) × 90 = 180` → **360**
- Recomendado = `E1` (0) · Siguiente en orden = `E1` (orden 1) · coinciden → Ahorro = **0**

### Requirement: Ahorro

El resultado **MUST** incluir el ahorro: `espera(siguienteEnOrden) − espera(recomendado)`. Si el recomendado coincide con el siguiente en orden, no hay elección real y el ahorro es 0. El ahorro **MUST** ser ≥ 0: el recomendado nunca tiene más espera que el siguiente en orden.

#### Scenario: Ahorro positivo

- GIVEN `E1` (orden 1) con espera 360 y `E2` (orden 2) con espera 60
- WHEN se calcula
- THEN el recomendado es `E2`, el siguiente en orden es `E1` y el ahorro es 300 segundos

**Cálculo paso a paso** (segundosEjecucionSerie = 60, descanso = 90):

- `E1` (orden 1): `M1` ocupante `seriesRestantes = 3` → `3 × 60 = 180` · `(3 − 1) × 90 = 180` → **360**
- `E2` (orden 2): `M2` ocupante `seriesRestantes = 1` → `1 × 60 = 60` · `(1 − 1) × 90 = 0` → **60**
- Recomendado = `E2` (60) · Siguiente en orden = `E1` (360)
- Ahorro = `360 − 60 =` **300**

### Requirement: Forma del resultado

El motor **MUST** producir un resultado con tres variantes, a nivel semántico (la firma TypeScript final la define la fase de diseño):

- **éxito**: lleva `recomendado` (`{ ejercicioId, espera, maquinaId }`), `siguienteEnOrden` (`{ ejercicioId, espera, maquinaId }`), `ahorro` (número ≥ 0) y `bloqueados` (lista de `{ ejercicioId, motivo }`, posiblemente vacía). `maquinaId` es `null` solo cuando el ejercicio no tiene candidatas.
- **sin_opciones**: todos los ejercicios pendientes están bloqueados; lleva la lista de `bloqueados` y **MUST NOT** lanzar una excepción.
- **vacío**: no hay ejercicios pendientes; resultado vacío explícito.

#### Scenario: Todos bloqueados

- GIVEN `E1` con única candidata `FUERA_DE_SERVICIO` y `E2` con única candidata `INACTIVA` (sin ningún ejercicio no bloqueado)
- WHEN se calcula
- THEN el resultado es `sin_opciones` con `bloqueados = [E1 → TODAS_FUERA_DE_SERVICIO, E2 → TODAS_INACTIVAS]`, y no se lanza excepción

**Razonamiento paso a paso**:

- `E1`: `FUERA_DE_SERVICIO` → no usable → bloqueado
- `E2`: `INACTIVA` → no usable → bloqueado
- Todos los pendientes bloqueados → resultado `sin_opciones`

#### Scenario: Sin ejercicios pendientes

- GIVEN una invocación con lista de ejercicios pendientes vacía
- WHEN se calcula
- THEN el resultado es `vacío` (sin recomendado ni ahorro)

### Requirement: Determinismo y re-ejecubilidad

El motor **MUST** ser re-ejecutable: la misma entrada **MUST** producir la misma salida. No consulta reloj, no usa aleatoriedad, no depende de orden de iteración no determinista (todas las comparaciones de desempate usan claves totales: `orden`, posición, `id`). Esta propiedad es necesaria porque el motor se invoca en al menos tres momentos (check-in, inicio de rutina, tras cada ejercicio) y **MUST NOT** fallar ni bloquear ninguno de esos flujos (ver P-64).

### Requirement: Limitación declarada (solo espera)

El criterio de recomendación es **solo-espera**: menor tiempo de espera, sin incorporar orden fisiológico ni la calidad del estímulo. Esta limitación **SHOULD** documentarse como no funcional y referenciar P-63. No se resuelve en esta iniciativa; la simulación comparativa (P-62) y la salida de emergencia (P-61) quedan fuera de este motor.

## Escenarios

| # | Nombre | Qué demuestra | Valores esperados |
|---|---|---|---|
| 1 | Gimnasio vacío | Espera 0 cuando no hay ocupante ni cola; recomendado = siguiente | espera 0, ahorro 0 |
| 2 | Un ocupante en la misma máquina | Fórmula del ocupante | espera 210 |
| 3 | Cola de tres miembros | Fórmula del miembro en cola y suma | espera 840 |
| 4 | Dos unidades de la misma máquina | Candidatos independientes por `Maquina.id`; gana la libre | espera 0 |
| 5 | Única candidata fuera de servicio | Bloqueo con código | `TODAS_FUERA_DE_SERVICIO` |
| 6 | Sin máquina asociada | Candidatos vacíos → espera 0, no bloqueado | espera 0, ahorro 210 |
| 7 | Todos bloqueados | Resultado `sin_opciones` sin excepción | `sin_opciones` |
| 8 | Empate de esperas | Desempate por menor `orden` | recomendado = orden 1 |
| 9 | Todos con `orden = 0` | Desempate por posición, luego `id` | recomendado = posición 0 |
| 10 | Recomendado = siguiente en orden | Sin elección real | ahorro 0 |
| 11 | Ahorro positivo | `espera(siguiente) − espera(recomendado)` | ahorro 300 |
| 12 | Check-in con rutina completa (`series = 1`) | Acepta la forma de entrada de check-in | sin error de validación |
| 13a | Predicado: `DISPONIBLE` | Estado usable | usable |
| 13b | Predicado: `OCUPADA` | Estado usable (doble lectura) | usable |
| 13c | Predicado: `FUERA_DE_SERVICIO` | Estado no usable | no usable |
| 13d | Predicado: `INACTIVA` | Estado no usable | no usable |
| 14a | Validación: `series = 0` | Límite inferior de `series` | error de validación |
| 14b | Validación: `descanso < 0` | Límite inferior de `descanso` | error de validación |
| 14c | Validación: `segundosEjecucionSerie = 0` | Límite inferior de duración de serie | error de validación |
| 15 | Única candidata inactiva | Bloqueo con código | `TODAS_INACTIVAS` |
| 16 | `OCUPADA` heredada sin ocupante real | Usable, espera 0 (lectura del motor) | espera 0 |
| 17 | Mezcla fuera de servicio + inactiva | Código mixto determinista | `SIN_MAQUINA_USABLE` |
| 18 | Sin ejercicios pendientes | Resultado `vacío` | `vacío` |
| 19 | Mismo input dos veces | Determinismo / re-ejecubilidad | salidas idénticas |
| 20 | Dos unidades con la misma espera | Desempate de máquina por primera posición en `candidatos` | espera 0, `maquinaId = M1` |
| 21 | Dos unidades con esperas distintas | Selección de máquina por menor espera | espera 0, `maquinaId = M2` |
| 22 | Ejercicio sin máquinas (`candidatos = []`) | Espera 0, no bloqueo y `maquinaId = null` | espera 0, `maquinaId = null` |
| 23 | Candidata con `id` ausente | El `id` colgante no aporta estado a la clasificación | `TODAS_INACTIVAS` y `SIN_MAQUINA_USABLE` |

## Acceptance Criteria

- **AC-301**: Existe un módulo de dominio puro para el motor, sin imports de `@/lib/db`, `@prisma/client` ni repositorios; el guardián `dominios-puros.guard.test.ts` sigue verde.
- **AC-302**: El predicado de máquina usable clasifica `DISPONIBLE` y `OCUPADA` como usables, y `FUERA_DE_SERVICIO` e `INACTIVA` como no usables, y no reutiliza el filtro de `home-interno.ts`.
- **AC-303**: La espera del ocupante es `seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso` (conservadora: `real ≤ calculada`).
- **AC-304**: La duración de un miembro en cola es `series × segundosEjecucionSerie + (series − 1) × descanso`, y la espera de una máquina suma ocupante + cola.
- **AC-305**: La espera de un ejercicio es el mínimo sobre sus candidatas usables; candidatos vacíos → espera 0 sin bloqueo.
- **AC-306**: La validación rechaza `series = 0`, `descanso < 0` y `segundosEjecucionSerie = 0` con un resultado de validación estructurado, sin excepción ni cálculo parcial.
- **AC-307**: Un ejercicio sin máquina usable queda bloqueado con un código de la unión (`TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`, `SIN_MAQUINA_USABLE`), excluido de la recomendación; la lista vacía no bloquea y un `id` de candidata ausente en `maquinas` no lanza ni aporta estado a la clasificación.
- **AC-308**: El recomendado es el ejercicio no bloqueado de menor espera, con desempate `orden → posición → id`.
- **AC-309**: El resultado incluye el siguiente en orden (menor `orden` no bloqueado, desempate `posición → id`).
- **AC-310**: El ahorro es `espera(siguienteEnOrden) − espera(recomendado)` y es ≥ 0; vale 0 cuando coinciden.
- **AC-311**: El resultado tiene tres variantes: éxito (`recomendado`, `siguienteEnOrden`, `ahorro`, `bloqueados`), `sin_opciones` (todos bloqueados, sin throw) y `vacío` (sin pendientes).
- **AC-312**: El motor es determinista: la misma entrada produce la misma salida, sin reloj ni aleatoriedad.
- **AC-313**: La limitación "solo-espera" está documentada y referenciada a P-63.
- **AC-314**: Cada sugerencia expone `maquinaId`: la candidata usable elegida del ejercicio (menor espera; en empate, la primera en `candidatos`; en empate, `id` ascendente) o `null` cuando `candidatos` está vacío.

## Trazabilidad

| Requirement | Escenarios |
|---|---|
| Entrada desacoplada y dominio puro | 12, 19 |
| Predicado de máquina usable | 13a, 13b, 13c, 13d, 16 |
| Espera del ocupante (fórmula conservadora) | 2 |
| Duración de un miembro en cola | 3 |
| Espera por máquina y por ejercicio | 1, 4, 6, 20, 21, 22 |
| Selección de máquina (`maquinaId`, AC-314) | 20, 21, 22 |
| Validación de entrada | 14a, 14b, 14c |
| Bloqueo y códigos de motivo | 5, 15, 17, 23, (6 como no-bloqueo) |
| Selección del recomendado | 8, 9 |
| Siguiente en orden (baseline) | 10, 9 |
| Ahorro | 10, 11 |
| Forma del resultado | 7, 18, 1 |
| Determinismo y re-ejecubilidad | 19 |
| Limitación declarada (solo espera) | — (no funcional, P-63) |

## Fuera de alcance

- Integración con check-in, sesión de entrenamiento, `Home_Socio` o pantalla del socio (Etapas 4 y 5).
- Persistencia del estado de ocupación (sesiones activas, ocupantes y colas reales): el motor solo los recibe por parámetro.
- Reserva provisional con expiración (P-65), cálculo best-effort en check-in (P-64), salida de emergencia del flujo obligatorio (P-61).
- La reserva de la sugerencia en la cola de la máquina y la exclusión de la reserva del propio socio al recalcular (check-in → inicio de rutina → tras cada ejercicio): Etapa 4 (P-67).
- Parámetro `/configuracion`: `segundosEjecucionSerie` se parameteriza por inyección, no se expone.
- Simulación comparativa para la tesis (P-62).
- Cambios a `EstadoMaquina`, `Maquina`, `EjercicioEnRutina`, `EjercicioMaquina`, `SesionDeEntrenamiento`, el guardián de dominios puros ni el filtro de `home-interno.ts`.
- El motor **no** reordena fisiológicamente ni prioriza grupos musculares: su criterio es solo-espera (P-63).

## Numeración

- Decisiones: **D-75+** (última registrada D-74).
- Tareas: **T-055+** (última registrada T-054r).
- Pendientes **P-61…P-67** pertenecen a etapas posteriores (ver `proposal.md` y `openspec/decisions.md`); esta etapa no los implementa. P-67 exige que la Etapa 4 excluya de las colas la reserva del propio socio al recalcular.
