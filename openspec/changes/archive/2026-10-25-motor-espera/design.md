# Design: motor-espera (Etapa 3 — Motor de espera y sugerencia)

> Campos requeridos por `openspec/config.yaml` para la fase `design` (`approach`, `architecture`, `implementation_plan`): `approach` → «Enfoque técnico»; `architecture` → «Decisiones de arquitectura» + «Flujo de datos» + «Interfaces y contratos»; `implementation_plan` → «Plan de slices» + «Plan de pruebas TDD».

## 1. Contexto y restricciones

El motor es un **dominio puro**: recibe todo su contexto por parámetros (estado del gimnasio, ejercicios pendientes, duración de serie) y no lee base de datos, no consulta reloj, no usa aleatoriedad ni hace I/O. Se invocará en al menos **tres momentos** — check-in provisional, inicio de rutina y posterior a cada ejercicio — y por eso no puede fallar ni bloquear ninguno de esos flujos (P-64: el cálculo en check-in es best-effort). Ser puro garantiza que la misma entrada produzca la misma salida (re-ejecutable, determinista) y que la integración de las Etapas 4 y 5 no arrastre dependencias de infraestructura al navegador.

**Guardián**: `src/domains/dominios-puros.guard.test.ts` recorre `src/domains/**/*.{ts,tsx}` (excluye `*.test.*`) y falla ante cualquier `import … from "@/lib/db"` estático. El nuevo módulo no importa nada (ni `@prisma/client` ni repositorios), de modo que el guardián sigue verde. El archivo de test queda fuera del escaneo pero importa el módulo con normalidad.

## 2. Ubicación y archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `src/domains/asignacion/motor-espera.ts` | Crear | Tipos + predicado + función pública `calcularEspera`. Único archivo del módulo. |
| `src/domains/asignacion/motor-espera.test.ts` | Crear | Suite con los 23 escenarios del spec (13 y 14 desglosados en subcasos). |

**Un solo archivo es suficiente.** El módulo completo (tipos + predicado + comparador + clasificación de motivo + validación + `calcularEspera`) ronda las 180 líneas con comentarios; muy por debajo del umbral de ~300 que justificaría separar `tipos.ts` y `calculos.ts`. Es la solución más pequeña que resuelve el problema completo (ponytail). Los tipos viven en el mismo módulo y se exportan, igual que `maquina.ts`.

**Nombrado de la API pública** (español, camelCase, consistente con el repo):

- Función principal: `calcularEspera(input: EntradaMotor): ResultadoMotor`.
- Predicado: `esMaquinaUsable(estado: EstadoMaquina): boolean`.
- Tipos: `EstadoMaquina`, `MotivoBloqueo`, `EjercicioPendiente`, `Ocupante`, `ColaMiembro`, `MaquinaEnGimnasio`, `ParametrosMotor`, `EntradaMotor`, `Bloqueado`, `Sugerencia`, `ResultadoMotor`.

**Nada más se toca.** Sin cambios a `home-interno.ts`, `maquina.ts`, el guardián, `schema.prisma`, API, UI, seed ni middleware. El módulo no importa `home-interno.ts` (tensión `OCUPADA` resuelta en §3 y §9).

## 3. Firma pública y tipos completos

```ts
// src/domains/asignacion/motor-espera.ts (dominio puro, sin imports)

/** Unión literal propia equivalente a Prisma.EstadoMaquina. No se importa de @prisma/client. */
export type EstadoMaquina =
  | "DISPONIBLE"
  | "OCUPADA"
  | "FUERA_DE_SERVICIO"
  | "INACTIVA";

/** Códigos de bloqueo emitidos. `SIN_MAQUINAS_ASOCIADAS` NO está: es código muerto (ver D-77). */
export type MotivoBloqueo =
  | "TODAS_FUERA_DE_SERVICIO"
  | "TODAS_INACTIVAS"
  | "SIN_MAQUINA_USABLE";

export interface EjercicioPendiente {
  id: string;
  orden: number;
  series: number;
  descanso: number; // segundos
  candidatos: string[]; // Maquina.id
}

export interface Ocupante {
  seriesRestantes: number;
  descanso: number; // segundos (propio del actor)
}

export interface ColaMiembro {
  series: number;
  descanso: number; // segundos (propio del actor)
}

export interface MaquinaEnGimnasio {
  id: string;
  estado: EstadoMaquina;
  ocupante: Ocupante | null;
  cola: ColaMiembro[];
}

export interface ParametrosMotor {
  segundosEjecucionSerie: number;
}

export interface EntradaMotor {
  ejercicios: EjercicioPendiente[];
  maquinas: MaquinaEnGimnasio[];
  parametros: ParametrosMotor;
}

export interface Bloqueado {
  ejercicioId: string;
  motivo: MotivoBloqueo;
}

export interface Sugerencia {
  ejercicioId: string;
  espera: number; // segundos
  maquinaId: string | null; // null solo si el ejercicio no tiene candidatas
}

export type ResultadoMotor =
  | { tipo: "invalido"; errores: string[] }
  | {
      tipo: "exito";
      recomendado: Sugerencia;
      siguienteEnOrden: Sugerencia;
      ahorro: number;
      bloqueados: Bloqueado[];
    }
  | { tipo: "sin_opciones"; bloqueados: Bloqueado[] }
  | { tipo: "vacio" };

export function esMaquinaUsable(estado: EstadoMaquina): boolean;

export function calcularEspera(input: EntradaMotor): ResultadoMotor;
```

### Puntos abiertos resueltos

1. **Resultado de validación vs. tipo de resultado — unificados en UNA unión discriminada.** La variante `invalido` lleva `errores: string[]`. Por qué: la spec prohíbe cálculo parcial ante entrada inválida y prohíbe excepciones; una única unión mantiene la función **total** (nunca lanza) y evita el problema de "dos retornos" donde el caller tendría que discriminar entre un `ValidationResult` y un `ResultadoMotor`. Es la opción preferida.

2. **Exportar el predicado: sí.** `esMaquinaUsable` es una función exportada de una línea, más un test dedicado (escenarios 13a–13d). Por qué: la spec exige un test dedicado que aserccione los cuatro estados (AC-302); para testearlo directamente hay que exportarlo. Es un costo mínimo y documenta la doble lectura de `OCUPADA`.

3. **`SIN_MAQUINAS_ASOCIADAS` es código muerto — se elimina del union emitido.** La semántica de la spec ya establece que los candidatos vacíos no se bloquean (espera 0), y el vocabulario del spec quedó en tres códigos. Como ese código jamás se emite, se registra como **desvío de spec** (ver D-77) y no se conserva un código inalcanzable. El union emitido queda en tres códigos: `TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`, `SIN_MAQUINA_USABLE`.

4. **Candidato ausente en `maquinas`:** se trata como **no usable** (nunca lanza). Por qué: es la regla total y determinista más simple; un id colgante equivale a "no hay máquina usable para ese candidato". No contribuye estado a la clasificación del motivo (ver §4).

5. **Ids duplicados / entradas duplicadas:** cada entrada del array `ejercicios` es independiente y conserva su posición (índice) como segundo nivel de desempate. Dos entradas con el mismo `id` son tratadas como dos ejercicios distintos por su posición; el fallback por `id` solo aplicaría si dos entradas compartieran posición, lo que un array no permite (defensivo).

## 4. Algoritmo paso a paso (pseudocódigo)

```
calcularEspera(entrada):
  errores = validar(entrada)                     // series>=1, descanso>=0, segundosEjecucionSerie>0
  si errores.length > 0 → { tipo: "invalido", errores }
  // La validación va ANTES del control de lista vacía: lista vacía + parámetros inválidos → `invalido`.

  si entrada.ejercicios está vacío → { tipo: "vacio" }

  maquinasPorId = Map(maquinas.map(m => [m.id, m]))   // índice por id

  evaluados = []
  para cada (posicion, ejercicio) en entrada.ejercicios:
    candidatas = ejercicio.candidatos
        .map(id => maquinasPorId.get(id))
        .filter(m => m !== undefined)            // id ausente → descartado (no usable, no throw)
    usables = candidatas.filter(m => esMaquinaUsable(m.estado))

    si ejercicio.candidatos está vacío:
      espera = 0                                 // no bloqueado, nunca espera
      maquinaId = null                           // no hay máquina que elegir
    si no, si usables.length > 0:
      elegida = argmin(usables.map((m, i) => ({ m, posicion: i, espera: esperaDeMaquina(m, segundosEjecucionSerie) })),
                       clave = compararCandidata)          // menor espera → primera en candidatos → id
      espera = elegida.espera
      maquinaId = elegida.m.id
    si no:
      motivo = clasificarMotivo(estados de candidatas)   // ver regla abajo
      bloqueado = { ejercicioId, motivo }

  bloqueados = evaluados con bloqueado, en orden de entrada
  libres = evaluados sin bloqueado (con su espera y su maquinaId)

  si libres está vacío → { tipo: "sin_opciones", bloqueados }

  siguienteEnOrden = argmin(libres, clave = compararPorOrdenPosicionId)       // menor orden → posición → id
  recomendado      = argmin(libres, clave = espera asc; empate → compararPorOrdenPosicionId)

  ahorro = siguienteEnOrden.espera - recomendado.espera      // >= 0 por construcción

  → { tipo: "exito",
      recomendado:      { ejercicioId, espera, maquinaId },
      siguienteEnOrden: { ejercicioId, espera, maquinaId },
      ahorro, bloqueados }
```

**Selección de máquina dentro de un ejercicio** (el `posicion` es el índice en `ejercicio.candidatos`, preservado por `map` + `filter`):

```
compararCandidata(a, b):
  si a.espera   !== b.espera   → a.espera - b.espera            // 1) menor espera
  si a.posicion !== b.posicion → a.posicion - b.posicion        // 2) primera en `candidatos`
  → a.m.id < b.m.id ? -1 : a.m.id > b.m.id ? 1 : 0              // 3) id ascendente (defensivo)
```

Este comparador elige la máquina **dentro** de un ejercicio y no se confunde con `compararPorOrdenPosicionId`, que elige **entre** ejercicios. Un ejercicio sin candidatas no pasa por aquí: `maquinaId` queda `null` por la rama de lista vacía.

**Regla de clasificación del motivo** (determinista, sobre las candidatas **presentes** no usables):

```
clasificarMotivo(estados):
  tieneFDS     = estados contiene "FUERA_DE_SERVICIO"
  tieneInactiva = estados contiene "INACTIVA"
  si tieneFDS y tieneInactiva → "SIN_MAQUINA_USABLE"      // mezcla
  si tieneFDS               → "TODAS_FUERA_DE_SERVICIO"
  si tieneInactiva          → "TODAS_INACTIVAS"
  si no                     → "SIN_MAQUINA_USABLE"        // candidatos no vacíos pero todas las ids ausentes
```

**Comparator canónico único** (reutilizado por ambas selecciones):

```
compararPorOrdenPosicionId(a, b):
  si a.orden   !== b.orden     → a.orden - b.orden
  si a.posicion !== b.posicion → a.posicion - b.posicion
  → a.id < b.id ? -1 : a.id > b.id ? 1 : 0        // id ascendente, lexicográfico

compararParaRecomendado(a, b):
  si a.espera !== b.espera → a.espera - b.espera
  → compararPorOrdenPosicionId(a, b)              // el MISMO criterio de desempate
```

`siguienteEnOrden` usa `compararPorOrdenPosicionId` directamente (su clave primaria es `orden`); `recomendado` usa `compararParaRecomendado` (clave primaria `espera`), que en el empate delega en el mismo comparator. Ambos comparten el criterio de desempate `orden → posición → id`.

## 5. Fórmulas

Duración de un ocupante (conservadora):

```
tiempoOcupante = seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso
```

Duración de un miembro en cola:

```
tiempoMiembro = series × segundosEjecucionSerie + (series − 1) × descanso
```

Espera de una máquina: `0` si no tiene ocupante ni cola; si tiene ocupante, `tiempoOcupante + Σ tiempoMiembro` (ocupante más la suma de la cola, en orden de encolado). El `descanso` de cada fórmula es el **del actor** (ocupante o miembro de cola), no el del ejercicio pendiente que se está evaluando (D-82).

**Justificación de la aproximación conservadora**: se asume que el ocupante está **al inicio** de su serie actual. El ocupante real puede llevar parte de la serie ya ejecutada, por lo que la espera real será **menor o igual** a la calculada (`real ≤ calculada`). Sobre-estimar es seguro para la recomendación: el motor nunca promete menos espera de la que habrá. Si el ocupante está en su última serie (`seriesRestantes = 1`), el término `(seriesRestantes − 1) × descanso` se anula y libera sin descanso posterior.

**Micro-ejemplo** (segundosEjecucionSerie = 60, descanso = 90):

- Ocupante con `seriesRestantes = 2`: `2 × 60 + (2 − 1) × 90 = 120 + 90 = 210`.
- Cola `[series 1, 2, 3]`: `60 + 210 + 360 = 630`; espera de la máquina = `210 + 630 = 840`.
- Dos unidades "Banco plano", una ocupada (`seriesRestantes = 3` → `3×60 + 2×90 = 360`) y una libre (`0`): espera del ejercicio = `min(360, 0) = 0`.

## 6. Decisiones registradas (D-75+)

### Decisiones de Fernando (vinculantes)

- **D-75 · Predicado propio del motor.** Contexto: `OCUPADA` tiene dos lecturas en el proyecto (`home-interno` la trata como no disponible; el motor, como usable si es legada). Decisión: el motor define `esMaquinaUsable` (DISPONIBLE y OCUPADA usables; FUERA_DE_SERVICIO e INACTIVA no) y **no** reutiliza el filtro de `home-interno.ts`. Por qué: la ocupación real proviene del `ocupante` de la entrada, no del estado persistido. Se exporta para el test dedicado (13a–13d).

- **D-76 · Unidades = filas de `Maquina`.** Contexto: el esquema no tiene campo `unidades`/`cantidad`. Decisión: cada unidad física es una fila distinta; el motor trabaja con candidatos por `Maquina.id` y trata dos unidades del mismo tipo como candidatos independientes. Por qué: refleja el modelo de datos real (verificado en explore) y el escenario 4 lo asercciona.

- **D-77 · Motivos de bloqueo como códigos.** Contexto: dos estilos de "motivo" conviven (código en `oferta-reactivacion.ts`, texto en `progresion-ejercicio.ts`). Decisión: literal union tipada (`MotivoBloqueo`), sin texto legible; el mapeo a mensajes queda en Etapa 4. Los tests aserccionan contra el código. **Desvío de spec registrado**: `SIN_MAQUINAS_ASOCIADAS` se elimina del union emitido porque jamás se emite (candidatos vacíos → espera 0, no bloqueo); mantener un código inalcanzable contradice la regla de no conservar código muerto. El vocabulario del spec quedó en los mismos tres códigos.

- **D-78 · Desempate determinista en tres niveles.** Contexto: `orden` tiene `@default(0)`, lo que genera empates frecuentes. Decisión: (a) menor `orden`, (b) posición en la lista de entrada, (c) `id` ascendente. Por qué: garantiza determinismo total. Se implementa como **un único comparador** `compararPorOrdenPosicionId` reutilizado por "recomendado" (como desempate tras espera) y por "siguiente en orden" (como clave primaria), cumpliendo el requisito de "mismo criterio para ambos".

- **D-79 · Validación de entrada en dominio.** Contexto: defensa en profundidad; el motor no confía en la base ni en capas superiores. Decisión: `series ≥ 1`, `descanso ≥ 0`, `segundosEjecucionSerie > 0`, sin excepción, sin cálculo parcial. Por qué: mismo patrón que `maquina.ts`; la variante `invalido` del union lo materializa (D-81).

### Propuestas de la IA

- **D-80 · Ubicación y forma del módulo.** Decisión: `src/domains/asignacion/motor-espera.ts` como archivo único (tipos + función + predicado), cero imports de infraestructura. Por qué: dominio pequeño y cohesivo; el guardián queda verde sin excepciones nuevas.

- **D-81 · Resultado como unión discriminada única con `invalido`.** Decisión: `ResultadoMotor = invalido{errores} | exito | sin_opciones | vacio`. Por qué: función total, sin flags sueltos, sin excepción, sin cálculo parcial (ver punto 1 de §3).

- **D-82 · `descanso` per-actor.** Contexto: la spec refina `Ocupante` y `ColaMiembro` para llevar su propio `descanso` (a diferencia de explore/proposal, que solo llevaban `series`/`seriesRestantes`). Decisión: el ocupante y cada miembro de cola llevan `descanso` propio; la fórmula usa el del actor, no el del ejercicio pendiente. Por qué: cada actor está haciendo un ejercicio distinto con su propia prescripción; el `descanso` del ejercicio pendiente se valida pero **no** participa del cálculo de espera.

- **D-83 · Candidato ausente en `maquinas`.** Decisión: un id de candidato que no está en `maquinas` se trata como no usable (no throw) y **no aporta estado** a la clasificación del motivo. Por qué: regla total y determinista ante ids colgantes; si todos los candidatos están ausentes, el motivo es `SIN_MAQUINA_USABLE` (fallback). La regla y sus dos consecuencias (`[idAusente, INACTIVA]` → `TODAS_INACTIVAS`; todos ausentes → `SIN_MAQUINA_USABLE`) quedaron reflejadas en el spec, sección "Bloqueo y códigos de motivo", para no dejarlo como comportamiento implícito.

- **D-84 · `Sugerencia.maquinaId`.** Contexto: la recomendación decía qué ejercicio hacer y cuánto esperar, pero no en qué máquina reservar. Decisión: `Sugerencia` lleva `maquinaId: string | null` con la unidad elegida del ejercicio. Por qué: la Etapa 4 reserva un lugar en la cola de esa máquina y la Etapa 5 le indica al socio a qué máquina caminar. `maquinaId` es `null` solo cuando el ejercicio no tiene candidatas (`candidatos = []`); si hay candidatas, siempre es el `id` de una unidad usable.

- **D-85 · Desempate de máquina.** Decisión: entre las candidatas usables del mismo ejercicio se elige (1) menor espera, (2) en empate la que aparece primero en `candidatos`, (3) en empate `id` ascendente (defensivo). Por qué: determinista y estable frente a cambios de orden de entrada que controla el llamador; no depende del orden de iteración de un `Map` ni del orden de la lista de máquinas del gimnasio.

- **D-86 · Se valida también el `descanso` de ocupante y de cada miembro de cola.** Contexto: la corrección de implementación de T-055a detectó que `normalizarDescanso` en `src/api/rutinas.ts` **no recorta negativos** (`Number.isFinite(-5)` es `true`), así que un `descanso` negativo puede llegar a la base y, desde ahí, al motor. Decisión: además de `series`/`descanso` del ejercicio pendiente y `segundosEjecucionSerie`, se valida `descanso >= 0` del ocupante y de cada miembro de la cola; `series` y `seriesRestantes` de los actores **no** se validan (la spec no lo pide). Por qué: un `descanso` negativo produciría una espera menor que la real y rompería la garantía conservadora de §5. Es la única validación agregada respecto de la spec, y se registra aquí en lugar de dejarla implícita.

## 7. Plan de pruebas TDD

Estructura del archivo `motor-espera.test.ts` (descripciones en español, estilo del repo):

```
describe("calcularEspera", () => {
  describe("esMaquinaUsable", ...)                       // 13a–13d
  describe("validación de entrada", ...)                 // 14a–14c
  describe("espera de un ejercicio", ...)                // 1, 2, 3, 4, 6, 16, 20, 21, 22
  describe("bloqueo y códigos de motivo", ...)           // 5, 15, 17, 23
  describe("selección del recomendado y del siguiente", ...) // 8, 9, 10, 11
  describe("forma del resultado", ...)                   // 7, 18
  describe("determinismo y re-ejecución", ...)           // 12, 19
})
```

Los valores numéricos se copian **idénticos** del spec (no se recalculan). Verificación de aritmética del spec realizada: **sin errores** — 210 (esc. 2), 840 (esc. 3), 360/0 (esc. 4), 210 (esc. 6), 360/60→300 (esc. 11), 210/210/210 (esc. 9), 0/0→`M1` (esc. 20), 210/0→`M2` (esc. 21), `null` (esc. 22); el esc. 23 no lleva aritmética, solo clasificación. Todos consistentes.

| Escenario | Test (nombre `it`) | Valor esperado |
|---|---|---|
| 1 | "devuelve espera 0 y ahorro 0 en gimnasio vacío" | espera 0, ahorro 0, recomendado = siguiente |
| 2 | "calcula la espera de un ocupante (fórmula conservadora)" | espera 210 |
| 3 | "suma ocupante y cola de tres miembros" | espera 840 |
| 4 | "elige la unidad libre entre dos unidades del mismo tipo" | espera 0 |
| 5 | "bloquea con TODAS_FUERA_DE_SERVICIO una única candidata FDS" | `TODAS_FUERA_DE_SERVICIO`, excluido |
| 6 | "trata candidatos vacíos como espera 0 sin bloqueo" | espera 0, ahorro 210 (**fixture: `E1.orden = 2`, `E2.orden = 1`**; con `E1.orden = 1` el siguiente en orden sería `E1` y el ahorro 0) |
| 7 | "devuelve sin_opciones cuando todos están bloqueados" | `sin_opciones`, no throw |
| 8 | "desempata por menor orden ante esperas iguales" | recomendado = orden 1 |
| 9 | "desempata por posición (y luego id) con orden = 0" | recomendado = posición 0 |
| 10 | "ahorro 0 cuando recomendado y siguiente coinciden" | ahorro 0 |
| 11 | "calcula ahorro positivo" | ahorro 300 |
| 12 | "acepta la rutina completa con series = 1 (check-in)" | `exito`, sin error |
| 13a–13d | "clasifica DISPONIBLE/OCUPADA/FUERA_DE_SERVICIO/INACTIVA" | usable/usable/no/no |
| 14a–14c | "rechaza series=0 / descanso<0 / segundosEjecucionSerie=0" | `invalido` con error |
| 15 | "bloquea con TODAS_INACTIVAS una única candidata INACTIVA" | `TODAS_INACTIVAS` |
| 16 | "OCUPADA heredada sin ocupante es usable y espera 0" | espera 0 |
| 17 | "mezcla FDS + INACTIVA bloquea con SIN_MAQUINA_USABLE" | `SIN_MAQUINA_USABLE` |
| 18 | "devuelve vacio sin ejercicios pendientes" | `vacio` |
| 19 | "mismo input produce el mismo output" | salidas idénticas |
| 20 | "elige la primera candidata cuando las esperas empatan" | espera 0, `maquinaId = M1` |
| 21 | "elige la candidata de menor espera" | espera 0, `maquinaId = M2` |
| 22 | "devuelve maquinaId null para candidatas vacías" | espera 0, `maquinaId = null` |
| 23 | "no cuenta los ids ausentes en la clasificación del motivo" | `TODAS_INACTIVAS` y `SIN_MAQUINA_USABLE` |

**Orden RED → GREEN** (cada paso escribe el test que falla y luego implementa lo mínimo para pasarlo):

1. `esMaquinaUsable` (13a–13d) → implementar el predicado.
2. Validación (14a–14c) → implementar `validar` + variante `invalido`.
3. Gimnasio vacío (1) → implementar el esqueleto `vacio`/`exito` + selección trivial.
4. Fórmulas de ocupante y cola (2, 3) → implementar `esperaDeMaquina`.
5. Candidatos (4, 6, 16) y selección de máquina (20, 21, 22) → mínimo sobre usables + `maquinaId` + candidatos vacíos + `OCUPADA` legada.
6. Bloqueo y motivos (5, 15, 17, 23) → clasificación de motivo (incluido el `id` colgante) + `bloqueados`/`sin_opciones`.
7. Selección y desempate (8, 9, 10, 11) → comparator + `recomendado`/`siguienteEnOrden`/`ahorro`.
8. Forma del resultado y determinismo (7, 18, 12, 19) → cierre de la unión y re-ejecución.

## 8. Plan de slices

El cambio es un módulo puro pequeño + un archivo de test + el cierre documental. El total estimado (~822 líneas autoradas) **excede las 400**, por lo que se divide en tres slices verticales (tres commits; sin PRs, flujo del proyecto). Cada slice entrega producción y pruebas propias y deja la suite verde; el reparto definitivo vive en `tasks.md`.

| # | Slice | Archivos | LOC est. | Veredicto |
|---|-------|----------|----------|-----------|
| 1 (T-055a) | Módulo + tests de núcleo (predicado, validación, fórmulas, candidatos, espera, `maquinaId` mínimo) | `motor-espera.ts` (nuevo, ~157) + `motor-espera.test.ts` (nuevo, ~225) | ~382 | ≤400 ✅ |
| 2 (T-055b) | Selección de máquina, bloqueo con motivos, `id` colgante, comparador canónico, ahorro y determinismo + protocolo de mutación | `motor-espera.ts` (modificar, ~80) + `motor-espera.test.ts` (ampliación, ~250) | ~330 | ≤400 ✅ |
| 3 (T-055c) | Cierre documental: D-75–D-86 y P-61–P-67 en `decisions.md`; verificación del spec | `openspec/decisions.md` (modificar), `openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md` (verificar) | ~110 | ≤400 ✅ |

- **Slice 1** implementa el módulo completo (la función es total: devuelve la unión entera) junto con los escenarios 1, 2, 3, 4, 6, 13a–13d, 14a–14c, 16, 17 y la guardia de orden. El tipo `Sugerencia` ya lleva `maquinaId` y el minimizador ingenuo devuelve la máquina que gana el mínimo (primer empate a favor del primero); el desempate explícito llega en el slice 2.
- **Slice 2** añade la selección explícita de máquina (escenarios 20, 21, 22), el bloqueo y los motivos (5, 15, 17, 23), el `id` colgante, `sin_opciones` (7), el comparador canónico y la selección/ahorro (8, 9, 10, 11, 12, 18, 19). Los escenarios 9, 10, 11, 12 y 19 son **guardias**: se esperan verdes con la implementación mínima del slice 1 y, antes de cerrar el slice, se ejecuta el **protocolo de mutación** de `tasks.md` (romper una hipótesis por vez, ver rojo, restaurar y ver verde de nuevo).
- **Slice 3** no toca código: registra las decisiones D-75–D-86 y los pendientes P-61–P-67 en `decisions.md`, y verifica que el spec ya refleja la eliminación de `SIN_MAQUINAS_ASOCIADAS` (aplicada en esta corrección, no diferida).

**Presupuesto**: total ~822 LOC repartido en tres commits, cada uno ≤400. Slice más grande ~382 (18 líneas de margen). Riesgo de presupuesto: **bajo**. No hay chaining de PRs (el flujo del proyecto no usa PRs; un slice = un commit).

## 9. Riesgos y mitigaciones

| Riesgo | Evaluación | Mitigación |
|---|---|---|
| **Tensión `OCUPADA` (doble lectura)** | Media. `home-interno.ts` trata `OCUPADA` como no disponible; el motor la trata como usable si es legada. | Predicado propio `esMaquinaUsable` sin importar `home-interno.ts` (D-75); test 16 documenta la lectura del motor. |
| **Aproximación conservadora sobre-estima la espera** | Baja (intencional). `real ≤ calculada`. | Documentado en §5; es seguro para la recomendación (nunca promete menos espera). |
| **`orden = 0` por defecto genera empates frecuentes** | Alta (esperada). | Desempate de tres niveles (orden → posición → id); escenario 9 lo verifica. |
| **`series`/`seriesRestantes` de ocupante y cola no validados** | Baja. La spec no lo pide y la Etapa 4 los deriva de sesiones reales (`serieActual` entre 1 y las series del ejercicio). | No se agrega validación no pedida (ponytail). El `descanso` de los actores **sí** se valida (D-86), porque un negativo sí es alcanzable desde `src/api/rutinas.ts` y rompería la garantía conservadora. |
| **`descanso` del ejercicio pendiente no participa del cálculo** | Informativa. | El `descanso` del pendiente se valida (defensa en profundidad) pero la espera depende del `descanso` del actor (D-82). Documentado para evitar que el implementador use el `descanso` equivocado. |
| **Rendimiento O(Ejercicios × Máquinas × Cola)** | Bajo para volúmenes de check-in. | Fuera de alcance ahora; la función es pura y separable para optimizar en Etapa 5 (P-62). |

## 10. Trazabilidad

| Requirement / AC | Sección del diseño | Test(s) |
|---|---|---|
| Entrada desacoplada y dominio puro (AC-301) | §1, §2, §3 | 12, 19 (+ guardián) |
| Predicado de máquina usable (AC-302) | §3 (D-75), §4 | 13a–13d, 16 |
| Espera del ocupante (AC-303) | §5 | 2 |
| Duración de un miembro en cola (AC-304) | §5 | 3 |
| Espera por máquina y por ejercicio (AC-305) | §4, §5 | 1, 4, 6, 20, 21, 22 |
| Validación de entrada (AC-306) | §3 (D-79, D-81), §4 | 14a–14c |
| Bloqueo y códigos de motivo (AC-307) | §3 (D-77), §4 | 5, 15, 17, 23, (6) |
| Selección del recomendado (AC-308) | §4 (D-78) | 8, 9 |
| Siguiente en orden (AC-309) | §4 (D-78) | 10, 9 |
| Ahorro (AC-310) | §4 | 10, 11 |
| Forma del resultado (AC-311) | §3 (D-81) | 7, 18, 1 |
| Determinismo y re-ejecubilidad (AC-312) | §1, §4 | 19 |
| Limitación declarada solo-espera (AC-313) | §1, §9 | — (no funcional, P-63) |
| Selección de máquina `maquinaId` (AC-314) | §3 (D-84, D-85), §4 | 20, 21, 22 |

## 11. Numeración

- Decisiones registradas en este diseño: **D-75 a D-86** (última previa: D-74).
- Tareas: se reservan **T-055+** para la fase `sdd-tasks` (no se crean aquí).
- Pendientes: **P-61…P-66** ya reservados en `proposal.md` para etapas posteriores, y **P-67** registrado en `decisions.md` (precondición de integración de la Etapa 4); este diseño no los reabre ni los renumera.

## Plan de rollback

Adición pura: eliminar la carpeta `src/domains/asignacion/`. Ninguna otra parte del sistema la referencia (Etapas 4/5 aún no existen). Cero riesgo de pérdida de datos.

## Preguntas abiertas

- Ninguna que bloquee. El único punto documentado como desvío de spec (`SIN_MAQUINAS_ASOCIADAS` eliminado) se resuelve aquí con D-77 y se sincroniza en la fase `sdd-archive`.
