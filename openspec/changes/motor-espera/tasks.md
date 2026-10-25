# Tasks: motor-espera (Etapa 3 — Motor de espera y sugerencia)

> **Change**: `motor-espera` · **Rama**: `feat/motor-espera` · **Base**: `dev` · **Almacén de artefactos**: openspec (archivos).
> **Entradas**: `explore.md`, `proposal.md`, `specs/motor-espera-asignacion/spec.md`, `design.md` (secciones §3–§5, §7 y §9),
> `openspec/config.yaml` (`strict_tdd: true`, comando `npm test`) y el estilo de
> `openspec/changes/archive/2026-10-25-maquina-ejercicios/tasks.md` (estructura y columnas, no su tamaño).
>
> **Numeración**: tareas **T-055a–T-055c** (última registrada: T-054r), decisiones **D-75–D-86** (última: D-74),
> pendientes **P-61–P-67** (último: P-60). Verificado el 2026-10-25 contra `openspec/decisions.md` y
> `openspec/sdd-tasks-tdd.md`; ninguna colisión.
>
> **Rebanado**: tres slices verticales, alineados con `design.md` §8. Cada uno entrega código de producción **y** las
> pruebas que lo demuestran, deja la suite verde y es revisable por separado: un commit que solo agrega pruebas no es
> una unidad de trabajo coherente.
>
> **Ajuste 1 al reparto propuesto**: el escenario 18 (`vacio`) se adelanta a T-055a. Para que `calcularEspera` sea total
> (el spec prohíbe lanzar excepciones), el slice A necesita una rama para la lista vacía, y esa rama es exactamente
> `vacio`. Dejarlo en T-055b obligaría a escribir en A una rama incorrecta o código de producción sin prueba. El
> escenario 7 (`sin_opciones`) sigue en T-055b: es una variante distinta y sí exige rojo.
>
> **Ajuste 2, solo de documentación del paso**: cinco escenarios (9, 10, 11, 12 y 19) quedan verdes con la
> implementación mínima de T-055a, porque la selección por menor espera y el `vacio` ya existen ahí. Se escriben
> primero igual y se esperan verdes: son **guardias de aceptación** que fijan el contrato, no conductoras de código
> nuevo. El resto de T-055b (5, 7, 8, 15, 17, 23) sí exige rojo. Los escenarios de máquina 20, 21 y 22 también se
> esperan verdes en T-055b: el minimizador ingenuo de T-055a ya elige la de menor espera y, en empate, la primera;
> quedan como guardias de la regla de desempate explícita (D-85).

## Reglas de ejecución

1. **Strict TDD**: en cada paso se escribe la prueba primero y se ejecuta. El rojo debe deberse a la razón correcta
   (símbolo no exportado, función ausente o valor esperado distinto), nunca a un error de tipeo o de fixture. Después,
   la implementación mínima que pone el paso en verde. No se avanza con una prueba en rojo.
2. **Guardias de aceptación**: cuando un paso se marca como guardia, la prueba se escribe primero y se espera **verde**.
   Si falla, el defecto está en un paso anterior: la tarea se detiene y se corrige.
3. **Sin commits del agente**: el agente no commitea, no pushea, no abre PRs y no ejecuta migraciones. Cada slice lo
   commitea Fernando, un slice = un commit.
4. **Sin PRs** (flujo del proyecto) y **sin migraciones** (esta etapa no toca el esquema).
5. **Dominio puro**: sin `import` de `@/lib/db`, `@prisma/client` ni repositorios; sin `Date.now()`, aleatoriedad, I/O ni
   estado global. `npm test -- src/domains/dominios-puros.guard.test.ts` debe seguir verde.
6. **Sin `any`**, sin `@ts-ignore` ni `as` sobre tipos de Prisma. TypeScript estricto.
7. **Presupuesto**: ≤400 líneas autoradas (adiciones + eliminaciones) por slice. Se mide con `git diff --shortstat`
   antes de pedir el commit. Si un slice se pasa, se detiene y se reporta; no se parte en silencio.
8. **Idioma**: descripciones de `describe`/`it` en español, como el resto de la suite. Identificadores del dominio en
   español (`calcularEspera`, `esMaquinaUsable`), siguiendo la convención existente del proyecto.
9. **Comentarios**: una línea, solo el porqué que el código no muestra. No se citan números D ni P dentro del código,
   para que T-055c sea reversible sin dejar referencias colgadas.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines — T-055a | **≈382** (≈157 impl + ≈225 tests) |
| Estimated changed lines — T-055b | **≈330** (≈80 impl + ≈250 tests) |
| Estimated changed lines — T-055c | **≈110** (solo documentación) |
| Estimated changed lines — total | **≈822** |
| Largest single slice | ≈382 (T-055a) — por debajo de 400 |
| 400-line budget risk | **Low**: el slice más grande queda ≈18 líneas por debajo del tope y no cruza capas |
| Chained PRs recommended | **No** (no hay PRs en este flujo: un slice = un commit) |
| Suggested split | commit 3a → commit 3b → commit 3c sobre `feat/motor-espera` |
| Delivery strategy | ask-on-risk (rebanado ya autorizado; sin PRs) |
| Chain strategy | No aplica — sin PRs |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: no aplica (sin PRs: un slice = un commit en feat/motor-espera)
400-line budget risk: Low
```

No se requiere decisión previa al apply: el rebanado ya está autorizado y no se vuelve a preguntar.

### Presupuesto medido (después de implementar T-055a y T-055b)

Medición real sobre el árbol, sin commits:

| Archivo | Líneas |
|---|---|
| `src/domains/asignacion/motor-espera.ts` | 236 |
| `src/domains/asignacion/motor-espera.nucleo.test.ts` | 227 |
| `src/domains/asignacion/motor-espera.bloqueo.test.ts` | 224 |
| `src/domains/asignacion/motor-espera.seleccion.test.ts` | 161 |
| **Total** | **848** |

El plan estimaba ≈382 + ≈330 = 712. La desviación (+136) está en las pruebas, que salieron 612 líneas frente a
las ≈475 estimadas (los fixtures usan `toEqual` completos como contrato) y en la cabecera de helpers repetida en
los tres archivos.

**Consecuencia**: con la suite partida en tres archivos, el corte que respeta el tope es por archivo (236 + 161 =
397 en el primero; 227 y 224 en los otros dos). Verificar con `git diff --shortstat` antes de cada commit:

1. `motor-espera.ts` + `motor-espera.seleccion.test.ts` (236 + 161 = 397);
2. `motor-espera.nucleo.test.ts` (227);
3. `motor-espera.bloqueo.test.ts` (224).

Regla: si una unidad supera 400 líneas, se parte por comportamiento (no por archivo) y se verifica otra vez con
`--shortstat`. No se parte en silencio.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Núcleo del motor: tipos, predicado, validación, fórmulas, espera por ejercicio y `maquinaId` mínimo | commit 3a | `npm test -- src/domains/asignacion` | N/A — módulo puro sin integración; se prueba con Jest | Revertir el commit: desaparece `src/domains/asignacion/` completo y nada la importa |
| 2 | Selección de máquina, bloqueo, motivos, `id` colgante, `sin_opciones`, comparador canónico, determinismo y protocolo de mutación | commit 3b | `npm test -- src/domains/asignacion` | N/A — módulo puro | Revertir el commit: el motor vuelve a T-055a (sin bloqueo); T-055a sigue verde |
| 3 | Cierre documental: D-75–D-86, P-61–P-67 y verificación del spec | commit 3c | `npm test` (sin cambios de código) | N/A — solo documentación | Revertir el commit: `decisions.md` vuelve al estado previo; el código no cambia |

## Resumen de slices

| Task ID | Título | Archivos | LOC est. | Depende de | Verificación | Rollback |
|---|---|---|---|---|---|---|
| **T-055a** | Núcleo del motor | `src/domains/asignacion/motor-espera.ts` (nuevo), `src/domains/asignacion/motor-espera.*.test.ts` (nuevo) | ≈382 | — | `npm test -- src/domains/asignacion`; `npm test -- src/domains/dominios-puros.guard.test.ts`; `npx tsc --noEmit`; `npx eslint src/domains/asignacion` | Revertir el commit: se borra la carpeta nueva; ningún otro archivo la referencia |
| **T-055b** | Bloqueo y selección | `src/domains/asignacion/motor-espera.ts` (modificar), `src/domains/asignacion/motor-espera.*.test.ts` (modificar) | ≈330 | T-055a | Las mismas cuatro órdenes, más `npm test` completo | Revertir el commit: el motor vuelve al alcance de T-055a; no hay consumidores |
| **T-055c** | Cierre documental | `openspec/decisions.md` (modificar), `openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md` (verificar) | ≈110 | T-055a, T-055b | `npm test`; `npx tsc --noEmit`; conteos `grep` de D-75–D-86, P-61–P-67 y `SIN_MAQUINAS_ASOCIADAS` | Revertir el commit: solo documentación; no hay efecto en ejecución |

## task_breakdown

### T-055a · Núcleo del motor

**Objetivo**: crear el módulo puro con los tipos de entrada/salida, el predicado `esMaquinaUsable`, la validación de
entrada y el cálculo de espera por ejercicio (mínimo sobre candidatas presentes, con la regla de candidatos vacíos),
junto con las pruebas que lo demuestran. `Sugerencia` incluye `maquinaId` desde el tipo, y el minimizador ingenuo
devuelve el `id` de la máquina que gana el mínimo (en empate, la primera). Al cerrar la tarea `calcularEspera` responde
a `invalido`, `vacio` y `exito` para el caso de éxito. El bloqueo con motivo, `sin_opciones`, el comparador canónico y
el desempate explícito de máquina (D-85) llegan en T-055b.

**Archivos**:
- `src/domains/asignacion/motor-espera.ts` (nuevo)
- `src/domains/asignacion/motor-espera.*.test.ts` (nuevo)
- `src/domains/dominios-puros.guard.test.ts` (lectura, sin cambios)

**TDD paso a paso** — todas las pruebas van en `src/domains/asignacion/motor-espera.*.test.ts`, dentro de
`describe("calcularEspera", ...)` con sub-`describe` por bloque, según design §7.

1. - [ ] **RED** — escribir el sub-`describe("esMaquinaUsable")` con cuatro pruebas y ejecutarlo. Debe fallar porque
   `esMaquinaUsable` todavía no está exportada.
   - `"considera usable el estado DISPONIBLE"` → `esMaquinaUsable("DISPONIBLE")` es `true`.
   - `"considera usable el estado OCUPADA"` → `true` (doble lectura del valor persistido).
   - `"considera no usable el estado FUERA_DE_SERVICIO"` → `false`.
   - `"considera no usable el estado INACTIVA"` → `false`.
2. - [ ] **GREEN** — tipos completos de design §3 (`EstadoMaquina`, `MotivoBloqueo`, `EjercicioPendiente`, `Ocupante`,
   `ColaMiembro`, `MaquinaEnGimnasio`, `ParametrosMotor`, `EntradaMotor`, `Bloqueado`, `Sugerencia`, `ResultadoMotor`) y
   el predicado de una línea (design §4, D-75). El módulo no lleva ningún `import`.
3. - [ ] **RED** — sub-`describe("validación de entrada")`. Debe fallar porque `calcularEspera` aún no existe.
   - `"rechaza series = 0"` (14a) → `{ tipo: "invalido" }` con `errores.length >= 1`; ninguna otra rama del resultado.
   - `"rechaza descanso negativo"` (14b) → ídem, con el resto de la entrada válida y `descanso: -1`.
   - `"rechaza segundosEjecucionSerie = 0"` (14c) → ídem, con `parametros: { segundosEjecucionSerie: 0 }`.
4. - [ ] **GREEN** — `calcularEspera(input)` valida primero (`series >= 1`, `descanso >= 0`,
   `segundosEjecucionSerie > 0`) y devuelve `invalido` sin calcular nada (design §4, D-79 y D-81).
5. - [ ] **RED** — sub-`describe("forma del resultado y espera base")`. Debe fallar porque no hay cálculo.
   - `"devuelve espera 0 y ahorro 0 en gimnasio vacío"` (1): `E1` orden 1, `series` 1, `descanso` 90, candidatos
     `["M1"]`; `M1` `DISPONIBLE` sin ocupante ni cola; `segundosEjecucionSerie` 60 → `tipo: "exito"`,
     `recomendado = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`,
     `siguienteEnOrden = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`, `ahorro: 0`, `bloqueados: []`.
   - `"devuelve vacio sin ejercicios pendientes"` (18) → `{ tipo: "vacio" }`, sin `recomendado` ni `ahorro`.
   - Guardia de orden (spec, "Orden de los controles"): `ejercicios: []` con `segundosEjecucionSerie` 0 devuelve
     `invalido`, **no** `vacio`.
6. - [ ] **GREEN** — esqueleto: validar, luego `vacio` si `input.ejercicios.length === 0`, indexar máquinas por `id`,
   calcular la espera de cada ejercicio y armar el `exito`. El minimizador ingenuo elige la candidata de menor espera
   (primer empate a favor de la primera) y devuelve su `id` como `maquinaId`; con `candidatos = []` deja
   `maquinaId: null`. La selección mínima entre ejercicios es por menor espera con primer empate a favor del primero y
   `siguienteEnOrden` por menor `orden` con el mismo criterio; el comparador canónico y el comparador explícito de
   máquina llegan en T-055b.
7. - [ ] **RED** — sub-`describe("espera de un ejercicio")`, fórmulas. Debe fallar porque no hay fórmula de ocupante.
   - `"calcula la espera de un ocupante (fórmula conservadora)"` (2): `E1` con `M1` ocupada por
     `{ seriesRestantes: 2, descanso: 90 }` → `recomendado.espera = 210`, `siguienteEnOrden.espera = 210`,
     `maquinaId = "M1"` en ambas, `ahorro: 0`, `bloqueados: []`. **Aserción adicional D-82**: con la misma entrada pero
     `descanso: 30` en el ejercicio pendiente, la espera sigue siendo **210** (se usa el `descanso` del ocupante, no el
     del pendiente).
   - `"suma ocupante y cola de tres miembros"` (3): ocupante `{ seriesRestantes: 2, descanso: 90 }` y cola
     `[{series: 1, descanso: 90}, {series: 2, descanso: 90}, {series: 3, descanso: 90}]` → `recomendado.espera = 840`,
     `maquinaId = "M1"`.
8. - [ ] **GREEN** — `esperaDeMaquina`: tiempo del ocupante = `seriesRestantes × segundosEjecucionSerie +
   (seriesRestantes − 1) × descanso`; cada miembro de cola = `series × segundosEjecucionSerie + (series − 1) × descanso`;
   espera total = ocupante + suma de la cola, usando el `descanso` de cada actor (design §5, D-82).
9. - [ ] **RED** — sub-`describe("espera de un ejercicio")`, candidatas. Debe fallar por mínimo ausente y por candidatos
   vacíos.
   - `"elige la unidad libre entre dos unidades del mismo tipo"` (4): `E1` con candidatas `["M1", "M2"]`; `M1` con
     ocupante `{ seriesRestantes: 3, descanso: 90 }` (espera 360) y `M2` libre (espera 0) → `recomendado.espera = 0`,
     `recomendado.maquinaId = "M2"`, `siguienteEnOrden.espera = 0`, `siguienteEnOrden.maquinaId = "M2"`, `ahorro: 0`.
   - `"trata candidatos vacíos como espera 0 sin bloqueo"` (6): `E1` orden **2** con candidatos `[]` y `E2` orden **1**
     con `M2` ocupada por `{ seriesRestantes: 2, descanso: 90 }` → `recomendado = { ejercicioId: "E1", espera: 0,
     maquinaId: null }`, `siguienteEnOrden = { ejercicioId: "E2", espera: 210, maquinaId: "M2" }`, `ahorro: 210`,
     `bloqueados: []`.
   - `"trata una OCUPADA heredada sin ocupante como usable y espera 0"` (16): `M1` con `estado: "OCUPADA"`,
     `ocupante: null`, `cola: []` → `recomendado.espera = 0`, `recomendado.maquinaId = "M1"`. En este slice pasa por el
     cálculo (no hay ocupante); desde T-055b queda como guardia del cableado del predicado: si el filtro excluyera
     `OCUPADA`, esta prueba falla.
10. - [ ] **GREEN** — resolver candidatas por `id` con un `Map`; candidatos vacíos → espera 0 y `maquinaId: null` antes
    de cualquier `reduce`; espera del ejercicio = mínimo sobre las candidatas presentes, devolviendo también el `id` de
    la candidata que gana ese mínimo. El filtrado por estado usable, el comparador explícito de máquina y la
    clasificación del bloqueo se cablean en T-055b.
11. - [ ] **REFACTOR** — sin cambios de estructura. Extraer un helper solo si el archivo supera ≈300 líneas; no es el
    caso (design §2).
12. - [ ] **Punto de control** — ejecutar la verificación de abajo. El slice queda listo para commit cuando: la suite
    enfocada y la guardián están verdes, `npm test` completo está verde, `tsc` y `eslint` limpios en la carpeta nueva,
    no hay `import` en el módulo, no hay `any`, y `git diff --shortstat` da ≤400 líneas.

**Implementación mínima**: solo lo necesario para los pasos 2, 4, 6, 8 y 10. Los tipos y firmas salen literalmente de
design §3; las fórmulas y el orden del algoritmo, de design §4 y §5. No se agrega bloqueo, `sin_opciones` ni
comparador canónico. El predicado se exporta (design §3, punto 2) y se prueba como unidad; dentro de `calcularEspera`
todavía no filtra candidatas porque en este slice no hay ningún estado no usable en las pruebas: su cableado —junto
con la clasificación del motivo— es el objeto de T-055b. No es código especulativo: es una función pública
especificada y probada (D-75) que entra en uso en el slice siguiente.

**Verificación**:
```bash
npm test -- src/domains/asignacion
npm test -- src/domains/dominios-puros.guard.test.ts
npx tsc --noEmit
npx eslint src/domains/asignacion
grep -c '^import ' src/domains/asignacion/motor-espera.ts    # → 0
grep -n 'any' src/domains/asignacion/motor-espera.ts         # → sin salida
git diff --shortstat                                          # → ≤400 líneas
npm test
```

**Punto de control**: suite enfocada verde con 14 pruebas (1, 2, 3, 4, 6, 13a–13d, 14a–14c, 16, 18) más la guardia de
orden; guardián de dominios puros verde; `tsc` sin errores; `eslint src/domains/asignacion` sin errores; cero
`import` en el módulo; LOC ≤400. **Contingencia**: si el slice supera 400 líneas al escribir los fixtures, mover el
escenario 16 a T-055b (comparte los fixtures de estados) y dejar este slice en ≈367.

**Rollback**: revertir el commit. Desaparece la carpeta `src/domains/asignacion/` completa; nada más en el repositorio
la importa (las Etapas 4 y 5 todavía no existen) y la suite vuelve al estado previo sin tocar otros archivos.

### T-055b · Bloqueo y selección

**Objetivo**: completar el motor con la clasificación del motivo de bloqueo, la lista de `bloqueados`, el resultado
`sin_opciones`, el comparador canónico `orden → posición → id`, la selección explícita de máquina
(menor espera → primera en `candidatos` → `id`) y el cálculo de `recomendado`, `siguienteEnOrden` y `ahorro` con
desempate determinista. Al cerrar la tarea, los 23 escenarios del spec están cubiertos, incluidos los `id` colgantes y
la selección de `maquinaId`.

**Archivos**:
- `src/domains/asignacion/motor-espera.ts` (modificar)
- `src/domains/asignacion/motor-espera.*.test.ts` (modificar)

**TDD paso a paso**:

1. - [ ] **RED** — escribir el sub-`describe("bloqueo y códigos de motivo")` y, dentro de la forma del resultado, el
   caso de todos bloqueados. Debe fallar: hoy una candidata no usable se trata como si estuviera libre y `sin_opciones`
   no existe. Los códigos se comparan como literales, nunca contra texto legible (D-77).
   - `"bloquea con TODAS_FUERA_DE_SERVICIO una única candidata fuera de servicio"` (5): `E1` orden 1 con `["M1"]`
     `FUERA_DE_SERVICIO`; `E2` orden 2 con `["M2"]` `DISPONIBLE` → `tipo: "exito"`,
     `recomendado = { ejercicioId: "E2", espera: 0, maquinaId: "M2" }`,
     `siguienteEnOrden = { ejercicioId: "E2", espera: 0, maquinaId: "M2" }`,
     `ahorro: 0`, `bloqueados = [{ ejercicioId: "E1", motivo: "TODAS_FUERA_DE_SERVICIO" }]`.
   - `"bloquea con TODAS_INACTIVAS una única candidata inactiva"` (15) → mismo esqueleto, con `M1` `INACTIVA` y
     `bloqueados = [{ ejercicioId: "E1", motivo: "TODAS_INACTIVAS" }]`; `recomendado` = `E2` con espera 0 y
     `maquinaId: "M2"`.
   - `"bloquea con SIN_MAQUINA_USABLE cuando mezcla fuera de servicio e inactiva"` (17): `E1` con
     `["M1", "M2"]` = `FUERA_DE_SERVICIO` + `INACTIVA`; `E2` con candidata disponible →
     `bloqueados = [{ ejercicioId: "E1", motivo: "SIN_MAQUINA_USABLE" }]`.
   - `"devuelve sin_opciones cuando todos están bloqueados"` (7): `E1` con `M1` `FUERA_DE_SERVICIO` y `E2` con `M2`
     `INACTIVA` → `{ tipo: "sin_opciones", bloqueados: [{ ejercicioId: "E1", motivo: "TODAS_FUERA_DE_SERVICIO" },
     { ejercicioId: "E2", motivo: "TODAS_INACTIVAS" }] }`, sin excepción y sin `recomendado`.
   - `"clasifica candidatas con id ausente"` (23), dos aserciones sobre la misma entrada del spec: `E1` con
     `candidatos = ["MX", "M2"]` donde `MX` no está en `maquinas` y `M2` es `INACTIVA`; `E2` con
     `candidatos = ["MY", "MZ"]`, ambos ausentes; `E3` con máquina usable.
     - **Aserción 1**: `E1` → `motivo: "TODAS_INACTIVAS"` (el `id` ausente no aporta estado).
     - **Aserción 2**: `E2` → `motivo: "SIN_MAQUINA_USABLE"` (todos ausentes → fallback), sin excepción.
     - El resultado global es `exito` con `E3` como recomendado y
       `bloqueados = [{ ejercicioId: "E1", motivo: "TODAS_INACTIVAS" }, { ejercicioId: "E2", motivo: "SIN_MAQUINA_USABLE" }]`
       en orden de entrada.
2. - [ ] **GREEN** — resolver las candidatas contra el índice de máquinas; filtrar por `esMaquinaUsable`; si hay
   usables, la espera es el mínimo; si no hay usables y la lista de candidatos no estaba vacía, clasificar el motivo con
   `clasificarMotivo` (design §4), agregar el ejercicio a `bloqueados` en orden de entrada y excluirlo de la
   recomendación. Si no queda ningún ejercicio libre, devolver `sin_opciones` con la lista de `bloqueados`. El orden de
   ramas es: validación → `vacio` (lista vacía) → evaluación → `sin_opciones` → `exito`. Un `id` ausente no aporta
   estado. No se emite `SIN_MAQUINAS_ASOCIADAS` (D-77).
3. - [ ] **Guardia + REFACTOR** — selección explícita de máquina (D-85). Se escriben las tres pruebas; 20, 21 y 22 se
   esperan verdes con el minimizador ingenuo de T-055a. Después se extrae `compararCandidata` (menor espera →
   posición en `candidatos` → `id` ascendente) y el evaluador devuelve `{ maquinaId, espera }`. Si alguna
   prueba falla, el defecto está en T-055a.
   - `"elige la primera candidata cuando las esperas empatan"` (20): `E1` con `candidatos = ["M1", "M2"]`, ambas
     `DISPONIBLE` sin ocupante ni cola → `recomendado.espera = 0`, `recomendado.maquinaId = "M1"` (primera posición);
     `siguienteEnOrden.maquinaId = "M1"`; `ahorro: 0`.
   - `"elige la candidata de menor espera"` (21): `E1` con `candidatos = ["M1", "M2"]`; `M1` con ocupante
     `{ seriesRestantes: 2, descanso: 90 }` (210) y `M2` libre (0) → `recomendado.espera = 0`,
     `recomendado.maquinaId = "M2"`; `ahorro: 0`.
   - `"devuelve maquinaId null para candidatas vacías"` (22): `E1` orden 2 con `candidatos = []` y `E2` orden 1 con
     `M2` ocupada por `{ seriesRestantes: 2, descanso: 90 }` → `recomendado = { ejercicioId: "E1", espera: 0,
     maquinaId: null }`, `siguienteEnOrden = { ejercicioId: "E2", espera: 210, maquinaId: "M2" }`, `ahorro: 210`.
4. - [ ] **RED** — sub-`describe("selección del recomendado y del siguiente")`. Debe fallar en el desempate: hoy gana
   el primero de la lista por espera.
   - `"desempata por menor orden ante esperas iguales"` (8): `E1` orden 2 (posición 0) con ocupante
     `{ seriesRestantes: 2, descanso: 90 }` → 210; `E2` orden 1 (posición 1) con ocupante igual → 210 →
     `recomendado = { ejercicioId: "E2", espera: 210, maquinaId: "M2" }`,
     `siguienteEnOrden = { ejercicioId: "E2", espera: 210, maquinaId: "M2" }`, `ahorro: 0`.
5. - [ ] **GREEN** — comparador canónico único `compararPorOrdenPosicionId` (menor `orden`, luego posición en la
   entrada, luego `id` ascendente) y `compararParaRecomendado` (espera y, en empate, el mismo comparador), según
   design §4 y D-78. `siguienteEnOrden` usa el comparador canónico como clave primaria.
6. - [ ] **Guardia** — desempate por posición. Se escribe primero y se espera verde tras el paso 5; si falla, el
   comparador del paso 5 está mal.
   - `"desempata por posición con orden = 0"` (9): tres ejercicios en posiciones 0, 1 y 2, todos con `orden: 0` y
     espera 210 → `recomendado = { ejercicioId: "E1", espera: 210, maquinaId: "M1" }`,
     `siguienteEnOrden = { ejercicioId: "E1", espera: 210, maquinaId: "M1" }`, `ahorro: 0`.
7. - [ ] **Guardia** — siguiente en orden y ahorro. Se esperan verdes: la selección por menor espera y por menor
   `orden` ya existe desde T-055a.
   - `"ahorro 0 cuando recomendado y siguiente coinciden"` (10): `E1` orden 1 espera 0; `E2` orden 2 espera 360 →
     `recomendado = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`,
     `siguienteEnOrden = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`, `ahorro: 0`.
   - `"calcula ahorro positivo"` (11): `E1` orden 1 con ocupante `{ seriesRestantes: 3, descanso: 90 }` → 360;
     `E2` orden 2 con ocupante `{ seriesRestantes: 1, descanso: 90 }` → 60 →
     `recomendado = { ejercicioId: "E2", espera: 60, maquinaId: "M2" }`,
     `siguienteEnOrden = { ejercicioId: "E1", espera: 360, maquinaId: "M1" }`, `ahorro: 300`.
8. - [ ] **Guardia** — check-in con rutina completa.
   - `"acepta la rutina completa con series = 1 (check-in)"` (12): `E1` orden 1, `series` 1, `descanso` 90, `["M1"]`
     libre; `E2` orden 2, `series` 1, `descanso` 90, `["M2"]` con ocupante `{ seriesRestantes: 1, descanso: 90 }` →
     `tipo: "exito"`, `recomendado = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`,
     `siguienteEnOrden = { ejercicioId: "E1", espera: 0, maquinaId: "M1" }`, `ahorro: 0`; sin error de validación.
9. - [ ] **Guardia** — determinismo y re-ejecubilidad. Se espera verde: el motor no consulta reloj ni usa aleatoriedad.
   - `"mismo input produce el mismo output"` (19): se invoca dos veces la entrada del escenario 11 y ambos resultados
     son `toEqual` entre sí.
10. - [ ] **Mutación de los escenarios guardia** — con la suite verde, verificar que los guardias 9, 10, 11, 12 y 19
    detectan de verdad una regresión. Protocolo **por cada mutación**: (a) copiar el archivo a `/tmp`
    (`cp src/domains/asignacion/motor-espera.ts /tmp/motor-espera.ts.pre-mutacion`) y registrar su hash
    (`sha256sum`); (b) aplicar **una** mutación; (c) ejecutar la prueba específica
    (`npm test -- src/domains/asignacion -t "<nombre>"`) y capturar el **rojo**; (d) restaurar
    desde `/tmp`; (e) confirmar que el árbol quedó **byte-idéntico** (`diff -u /tmp/motor-espera.ts.pre-mutacion
    src/domains/asignacion/motor-espera.ts` sin salida y mismo `sha256sum`); (f) re-ejecutar y capturar el **verde**.
    Registrar por guardia: mutación aplicada, prueba que se puso roja, restauración verificada, verde de nuevo.

    | Guardia | Mutación (una por vez) | Prueba que debe quedar roja |
    |---|---|---|
    | 9 | invertir el nivel de posición en `compararPorOrdenPosicionId` (asc → desc) | `"desempata por posición con orden = 0"` → elige `E3` |
    | 10 | invertir la clave de `recomendado` (mayor espera en vez de menor) | `"ahorro 0 cuando recomendado y siguiente coinciden"` → recomendado `E2`, ahorro −360 |
    | 11 | intercambiar los operandos del ahorro (`recomendado.espera − siguienteEnOrden.espera`) | `"calcula ahorro positivo"` → ahorro −300 |
    | 12 | endurecer la validación a `series > 1` | `"acepta la rutina completa con series = 1 (check-in)"` → `invalido` |
    | 19 | contador mutable a nivel de módulo que altere la espera en la segunda invocación | `"mismo input produce el mismo output"` → resultados distintos |

    No se usan como mutación de este set: dejar de filtrar no usables (no afecta a 9–12 ni 19, que solo usan estados
    usables; lo detectan 5, 15, 16 y 17) ni reordenar la validación después del control de lista vacía (ninguno de
    estos guardias combina lista vacía con parámetros inválidos; lo detecta la guardia de orden de T-055a). La
    evidencia (comandos y salida observada de cada rojo y cada verde) se incluye en el reporte final.
11. - [ ] **REFACTOR** — ninguno obligatorio. Si el comparador o la clasificación quedan embebidos en el flujo
    principal y el archivo supera ≈300 líneas, extraer solo esas dos funciones privadas; no crear archivos nuevos.
12. - [ ] **Punto de control** — los 23 escenarios cubiertos, suite enfocada y completa verdes, guardián verde,
    `tsc` y `eslint` limpios, sin `any`, LOC ≤400.

**Implementación mínima**: clasificación del motivo y `bloqueados` conforme a design §4; `sin_opciones` como rama
propia; comparador canónico único reutilizado por ambas selecciones; `compararCandidata` para la máquina dentro del
ejercicio (D-85). No se agrega validación de los actores (`ocupante`/`cola`): el spec no la pide y la Etapa 4 la deriva
de sesiones reales (design §9). La rama de `candidatos = []` devuelve `maquinaId: null` sin pasar por el comparador.

**Verificación**:
```bash
npm test -- src/domains/asignacion
npm test -- src/domains/dominios-puros.guard.test.ts
npx tsc --noEmit
npx eslint src/domains/asignacion
grep -c '^import ' src/domains/asignacion/motor-espera.ts    # → 0
grep -n 'SIN_MAQUINAS_ASOCIADAS' src/domains/asignacion/motor-espera.ts   # → sin salida
git diff --shortstat                                          # → ≤400 líneas
npm test
```

**Punto de control**: los 23 escenarios del spec están cubiertos y verdes; `sin_opciones` no lanza excepción;
`bloqueados` respeta el orden de entrada; el `ahorro` nunca es negativo; `maquinaId` es `null` solo sin candidatas;
las cinco mutaciones del paso 10 se registraron con rojo observado, restauración byte-idéntica y verde posterior;
suite completa y guardián verdes; `tsc` sin errores; `eslint src/domains/asignacion` limpio; LOC ≤400.

**Rollback**: revertir el commit. El motor vuelve al alcance de T-055a (sin bloqueo, sin `sin_opciones`, sin
comparador canónico) y ese estado queda verde por sí mismo porque T-055a se commiteó con su propia suite. No hay
consumidores fuera de la carpeta.

### T-055c · Cierre documental

**Objetivo**: registrar en `openspec/decisions.md` las doce decisiones D-75–D-86 y los siete pendientes P-61–P-67, con
la distinción de origen (Fernando o propuesta de la IA), y **verificar** que el spec ya refleja las desviaciones
decididas en el diseño. No hay cambios de código.

**Archivos**:
- `openspec/decisions.md` (modificar)
- `openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md` (verificar; sin cambios esperados)

**TDD paso a paso**: esta tarea no lleva pruebas unitarias; su verificación es documental y por conteo. Se ejecuta
después de T-055b para registrar lo efectivamente implementado.

1. - [ ] **Verificación previa** — confirmar el estado del corpus: D-74 es la última decisión, `P-67` ya está registrado
   por la corrección externa (P-60 es el último previo a este change) y T-054r es la última tarea. Si algo no coincide,
   se detiene la tarea.
2. - [ ] **Registrar D-75–D-79** (decisiones de Fernando, vinculantes), en `## 1. Decisiones`, después de D-74 y antes de
   `## 2. Registro de defectos corregidos`, con el formato existente (`### D-nn · título`, `- **Origen**:` y viñetas):
   - **D-75** · Predicado propio del motor: `DISPONIBLE` y `OCUPADA` usables; `FUERA_DE_SERVICIO` e `INACTIVA` no.
     No se reutiliza el filtro de `home-interno.ts`. Origen: Fernando (respuesta vinculante de la propuesta; el
     diseño lo formaliza).
   - **D-76** · Unidades = filas de `Maquina`: cada unidad física es una fila; los candidatos son `Maquina.id`; dos
     unidades del mismo tipo son candidatas independientes. Origen: Fernando.
   - **D-77** · Motivos de bloqueo como códigos (unión literal, sin texto de usuario). Incluye el desvío:
     `SIN_MAQUINAS_ASOCIADAS` no se emite porque los candidatos vacíos no se bloquean; el union queda con
     `TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS` y `SIN_MAQUINA_USABLE`. Origen: Fernando (códigos) y propuesta de la
     IA aceptada en el diseño (eliminación del código muerto).
   - **D-78** · Desempate determinista en tres niveles `orden → posición en la entrada → id`, implementado como un
     comparador único reutilizado por "recomendado" y "siguiente en orden". Origen: Fernando.
   - **D-79** · Validación de entrada en el dominio: `series >= 1`, `descanso >= 0`, `segundosEjecucionSerie > 0`, sin
     excepción y sin cálculo parcial, y **antes** del control de lista vacía. Origen: Fernando.
3. - [ ] **Registrar D-80–D-85** (propuestas de la IA, aprobadas en el diseño), con el mismo formato:
   - **D-80** · Ubicación y forma: `src/domains/asignacion/motor-espera.ts` como archivo único (tipos + predicado +
     función), sin imports de infraestructura.
   - **D-81** · Resultado como unión discriminada única con la variante `invalido`, para que `calcularEspera` sea total.
   - **D-82** · `descanso` por actor: el ocupante y cada miembro de cola llevan su propio `descanso`; el `descanso` del
     ejercicio pendiente se valida pero no participa del cálculo de espera.
   - **D-83** · Candidato ausente en `maquinas`: no es usable, no lanza y no aporta estado a la clasificación; si todos
     los candidatos están ausentes, el motivo es `SIN_MAQUINA_USABLE`.
   - **D-84** · `Sugerencia.maquinaId`: la sugerencia lleva la unidad elegida (`string | null`) para que la Etapa 4
     reserve en esa cola y la Etapa 5 indique la máquina; es `null` solo sin candidatas.
   - **D-85** · Desempate de máquina dentro del ejercicio: menor espera → primera posición en `candidatos` → `id`
     ascendente; determinista y estable frente al orden de entrada.
   - En cada una, dejar explícito que el origen es una propuesta de la IA sin objeción registrada de Fernando, para no
     atribuirle decisiones que no tomó.
4. - [ ] **Registrar el desvío en `## 6. Desvíos respecto de los specs`** — una fila: tema "Código de motivo
   `SIN_MAQUINAS_ASOCIADAS`", spec original "listado como código de bloqueo", implementación "eliminado del union
   emitido: los candidatos vacíos no se bloquean (regla que el spec ya conserva en prosa)", documentado en "D-77; spec
   de `motor-espera-asignacion`".
5. - [ ] **Registrar P-61–P-67** en la tabla de `## 3. Pendientes abiertos`, después de P-60, con la fase dueña en la
   columna de notas:
   - **P-61** — Salida de emergencia del flujo obligatorio (máquina rota o socio lesionado → reasignación por
     instructor). Fase dueña: Etapa 4.
   - **P-62** — Simulación comparativa para la tesis (espera promedio del motor frente a seguir el orden de rutina).
     Fase dueña: posterior a la Etapa 5.
   - **P-63** — Documentación de la limitación "solo espera", sin orden fisiológico. Fase dueña: diseño e informe de
     tesis.
   - **P-64** — El cálculo en el check-in debe ser best-effort y nunca bloquear el registro de asistencia. Fase dueña:
     Etapa 4.
   - **P-65** — Reserva provisional con vencimiento configurable (propuesta: 15 minutos sin iniciar rutina).
     Fase dueña: Etapa 4.
   - **P-66** — Evaluar la API de Next 16 para trabajo posterior a la respuesta, leyendo `node_modules/next/dist/docs`
     antes de proponerla. Fase dueña: Etapa 4.
   - **P-67** — Quien arma la entrada del motor debe excluir de las colas la reserva del propio socio al recalcular
     (check-in → inicio de rutina → tras cada ejercicio), con test obligatorio; si no, el socio se espera a sí mismo.
     Severidad Media; precondición de integración, no del motor puro. Fase dueña: Etapa 4.
     **Ya está registrado por la corrección externa**: se verifica y no se duplica.
   - Marcar P-63 como la referencia de la limitación declarada, para que AC-313 sea rastreable desde el registro.
6. - [ ] **Verificar el spec** en
   `openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md`:
   - `SIN_MAQUINAS_ASOCIADAS` **ya no aparece**: la corrección externa lo quitó de la tabla de "Bloqueo y códigos de
     motivo" y dejó la regla en prosa (candidatos vacíos → espera 0, no bloqueo, `maquinaId = null`). **No se difiere
     a esta tarea** y no debe reintroducirse.
   - Verificar —sin duplicar— que ya están presentes el código `SIN_MAQUINA_USABLE`, la regla del `id` colgante y su
     escenario (23), la regla de selección de máquina (`maquinaId`, escenarios 20–22) y la nota de que la validación
     ocurre antes del control de lista vacía. Si alguna faltara, agregarla con la redacción de design §4/D-83/D-84/D-85.
   - No renumerar escenarios, AC ni requirements.
7. - [ ] **Punto de control** — verificación de abajo con los conteos esperados, `npm test` y `tsc` verdes, y
   `git diff --stat` limitado a `decisions.md` (el spec solo se verifica).
8. - [ ] **Fuera de esta tarea** — el registro de T-055a–T-055c en `openspec/sdd-tasks-tdd.md`, la actualización de
   `PROJECT-STATUS.md` y la bitácora `odd/tasks/motor-espera.md` pertenecen a la fase `sdd-archive`, no a este change.

**Implementación mínima**: no hay código. Se copia el formato de las entradas D-73/D-74 y de las filas P-57–P-60; no
se reescriben decisiones ni se renumeran pendientes.

**Verificación**:
```bash
# Estado previo (step 1): última decisión, P-67 pre-registrado y última tarea
grep -c '^### D-74 ' openspec/decisions.md                           # → 1
grep -c '^| P-67 ' openspec/decisions.md                             # → 1
grep -c 'T-054r' openspec/sdd-tasks-tdd.md                           # → ≥1
# Después del cambio
grep -c '^### D-7[5-9] \|^### D-8[0-5] ' openspec/decisions.md          # → 11
grep -c '^| P-6[1-7] ' openspec/decisions.md                          # → 7
grep -c 'SIN_MAQUINAS_ASOCIADAS' openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md   # → 0
grep -c 'SIN_MAQUINA_USABLE' openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md       # → ≥1
grep -c 'maquinaId' openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md               # → ≥1
grep -c 'P-63' openspec/changes/motor-espera/specs/motor-espera-asignacion/spec.md                    # → ≥1
git diff --stat                                                       # → solo decisions.md y este plan
npm test
npx tsc --noEmit
```

**Punto de control**: doce entradas D-75–D-86 y siete filas P-61–P-67 presentes; `SIN_MAQUINAS_ASOCIADAS` ausente del
spec (ya eliminado en la corrección externa, no diferido); `SIN_MAQUINA_USABLE`, la regla del `id` colgante, la regla
de `maquinaId` y el orden validación-antes-de-vacío presentes; suite y `tsc` verdes; ningún archivo de código
modificado.

**Rollback**: revertir el commit. `decisions.md` vuelve al estado previo y no queda ninguna referencia colgada, porque
el código no cita números D ni P (regla 9). El spec no se modifica en esta tarea, así que no hay nada que revertir
allí. Seguro: no hay efecto en ejecución.

## dependencies

| Task | Debe aterrizar después de | Motivo |
|---|---|---|
| T-055a | — | Crea el módulo y su suite desde cero |
| T-055b | T-055a | Modifica el archivo del motor y amplía la misma suite |
| T-055c | T-055a, T-055b | Registra lo efectivamente implementado y verificado |

Dependencias externas: ninguna. No hay Docker, base de datos, Prisma ni variables de entorno involucradas; todo se
verifica con Jest sobre un módulo puro.

## acceptance_tests

| AC | Cobertura | Task | Nombres de prueba (escenario) |
|---|---|---|---|
| **AC-301** | Módulo puro, sin imports prohibidos; guardián verde | T-055a | Todas las pruebas del archivo; `"ningún archivo de src/domains importa @/lib/db de forma estática"` (guardián) |
| **AC-302** | Predicado para los cuatro estados | T-055a | `"considera usable el estado DISPONIBLE"`, `"considera usable el estado OCUPADA"`, `"considera no usable el estado FUERA_DE_SERVICIO"`, `"considera no usable el estado INACTIVA"` (13a–13d) |
| **AC-303** | Fórmula del ocupante | T-055a | `"calcula la espera de un ocupante (fórmula conservadora)"` (2), con la aserción D-82 |
| **AC-304** | Fórmula de la cola y suma | T-055a | `"suma ocupante y cola de tres miembros"` (3) |
| **AC-305** | Mínimo por candidata usable; candidatos vacíos sin bloqueo | T-055a (1, 4, 6) y T-055b (20, 21, 22) | `"devuelve espera 0 y ahorro 0 en gimnasio vacío"` (1), `"elige la unidad libre entre dos unidades del mismo tipo"` (4), `"trata candidatos vacíos como espera 0 sin bloqueo"` (6), `"elige la primera candidata cuando las esperas empatan"` (20), `"elige la candidata de menor espera"` (21), `"devuelve maquinaId null para candidatas vacías"` (22) |
| **AC-306** | Validación estructurada, sin excepción ni cálculo parcial | T-055a | `"rechaza series = 0"` (14a), `"rechaza descanso negativo"` (14b), `"rechaza segundosEjecucionSerie = 0"` (14c), guardia de orden validación→vacío |
| **AC-307** | Bloqueo con código; lista vacía no bloquea; `id` colgante | T-055b (bloqueo y 23) y T-055a (no bloqueo) | `"bloquea con TODAS_FUERA_DE_SERVICIO..."` (5), `"bloquea con TODAS_INACTIVAS..."` (15), `"bloquea con SIN_MAQUINA_USABLE..."` (17), `"clasifica candidatas con id ausente"` (23, dos aserciones); `"trata candidatos vacíos como espera 0 sin bloqueo"` (6) |
| **AC-308** | Recomendado de menor espera con desempate `orden → posición → id` | T-055b | `"desempata por menor orden ante esperas iguales"` (8), `"desempata por posición con orden = 0"` (9), `"calcula ahorro positivo"` (11) |
| **AC-309** | Siguiente en orden (menor `orden`, desempate posición → id) | T-055b | `"ahorro 0 cuando recomendado y siguiente coinciden"` (10), `"desempata por posición con orden = 0"` (9), `"trata candidatos vacíos como espera 0 sin bloqueo"` (6, en T-055a) |
| **AC-310** | `ahorro = espera(siguiente) − espera(recomendado)`, nunca negativo | T-055b | `"ahorro 0 cuando recomendado y siguiente coinciden"` (10), `"calcula ahorro positivo"` (11) |
| **AC-311** | Tres variantes del resultado | T-055a (`exito`, `vacio`) y T-055b (`sin_opciones`) | `"devuelve espera 0 y ahorro 0 en gimnasio vacío"` (1), `"devuelve vacio sin ejercicios pendientes"` (18), `"devuelve sin_opciones cuando todos están bloqueados"` (7) |
| **AC-312** | Determinismo y re-ejecubilidad | T-055b | `"mismo input produce el mismo output"` (19) |
| **AC-313** | Limitación "solo espera" documentada y referida a P-63 | T-055c | Verificación documental: `P-63` presente en el spec (ya escrito) y en `decisions.md`; sin prueba de código |
| **AC-314** | `maquinaId` = candidata usable elegida (menor espera → primera en `candidatos` → `id`) o `null` sin candidatas | T-055b | `"elige la primera candidata cuando las esperas empatan"` (20), `"elige la candidata de menor espera"` (21), `"devuelve maquinaId null para candidatas vacías"` (22) |

Cobertura de escenarios: 1, 18 → T-055a; 2, 3 → T-055a; 4, 6, 16 → T-055a; 13a–13d, 14a–14c → T-055a; 5, 15, 17, 23 → T-055b;
7 → T-055b; 8, 9 → T-055b; 10, 11 → T-055b; 12 → T-055b; 19 → T-055b; 20, 21, 22 → T-055b. Todos los escenarios quedan
cubiertos y todos los AC tienen al menos una tarea y una prueba (o verificación documental, en AC-313).

## Riesgos de implementación

1. **`OCUPADA` con dos lecturas.** `home-interno.ts` la trata como no disponible; el motor la trata como usable porque
   la ocupación real viene del `ocupante` de la entrada. Consecuencia: no importar ni reutilizar ese filtro. Se cubre con
   13b y 16 (D-75).
2. **`descanso` por actor (D-82).** El `descanso` del ejercicio pendiente se valida pero **no** participa de la espera;
   mandan el del ocupante y el de cada miembro de cola. Es fácil equivocarse y, con los fixtures del spec (todo 90), el
   error no se ve. Por eso el paso 7 agrega la aserción con `descanso: 30` en el pendiente y espera 210 sin cambios.
3. **`orden = 0`.** Es el valor por defecto del esquema y produce empates frecuentes. El desempate de tres niveles debe
   ser un comparador único; el escenario 8 (paso 3 de T-055b) es el rojo que lo conduce y el escenario 9 lo fija como
   guardia.
4. **ESLint preexistente (P-57).** `src/app/home-socio/page.tsx:129` falla por `react-hooks/purity` (`Date.now()` en el
   render), es anterior a este cambio y no corresponde corregirlo aquí. El lint se limita a `src/domains/asignacion`,
   que hoy está limpio; no se ejecuta `npx eslint .` como gate de este change.
5. **Orden de ramas del resultado.** `invalido` → `vacio` → evaluación → `sin_opciones` → `exito`. Invertirlo hace que
   una entrada vacía con parámetros inválidos devuelva `vacio`; la guardia del paso 5 de T-055a lo detecta.

## Fuera de alcance

- Integración con check-in, sesión de entrenamiento, Home_Socio o pantalla del socio (Etapas 4 y 5).
- Migraciones, endpoints REST, API routes, UI, componentes y seed.
- Persistencia del estado de ocupación (sesiones activas, ocupantes y colas reales).
- Parámetro `/configuracion` para `segundosEjecucionSerie`: se inyecta por parámetro, no se expone.
- Reserva provisional con vencimiento (P-65), cálculo best-effort en check-in (P-64) y salida de emergencia (P-61).
- Simulación comparativa para la tesis (P-62).
- Cambios a `EstadoMaquina`, `Maquina`, `EjercicioEnRutina`, `EjercicioMaquina`, `SesionDeEntrenamiento`, al guardián de
  dominios puros o al filtro de `home-interno.ts`.
- P-53, P-54, P-55 y P-56 (deuda previa de máquinas) y P-57 (lint preexistente).
- Registro de tareas y estado del proyecto en `openspec/sdd-tasks-tdd.md`, `PROJECT-STATUS.md` y `odd/tasks/`: fase
  `sdd-archive`.

## Pendientes (P-61–P-67)

| ID | Pendiente | Fase dueña |
|---|---|---|
| P-61 | Salida de emergencia del flujo obligatorio: máquina rota o socio lesionado → reasignación por instructor | Etapa 4 |
| P-62 | Simulación comparativa para la tesis: espera promedio del motor frente a seguir el orden de rutina | Posterior a la Etapa 5 |
| P-63 | Documentación de la limitación "solo espera" (sin orden fisiológico) para el informe de tesis | Diseño e informe de tesis |
| P-64 | El cálculo en check-in debe ser best-effort: nunca bloquea ni falla el registro de asistencia | Etapa 4 |
| P-65 | Reserva provisional con vencimiento configurable (propuesta: 15 minutos sin iniciar rutina) | Etapa 4 |
| P-66 | Evaluar la API de Next 16 para trabajo posterior a la respuesta, leyendo la documentación instalada antes de proponerla | Etapa 4 |
| P-67 | Al armar la entrada del motor, excluir de las colas la reserva del propio socio al recalcular (check-in → inicio de rutina → tras cada ejercicio), con test obligatorio; si no, el socio se espera a sí mismo. Precondición de integración, no del motor puro | Etapa 4 |

## Numeración

| Rango | Uso en este change | Último registrado | Colisión |
|---|---|---|---|
| T-055a, T-055b, T-055c | Tres slices verticales de esta etapa | T-054r | Ninguna |
| D-75 – D-85 | Once decisiones del diseño (cinco de Fernando, seis propuestas de la IA) | D-74 | Ninguna |
| P-61 – P-67 | Siete pendientes derivados de la propuesta (P-67 ya registrado por la corrección externa) | P-60 | Ninguna |

Verificado el 2026-10-25 contra `openspec/decisions.md` (D-74 en la última entrada de §1; P-67 registrado después de
P-60 en §3) y `openspec/sdd-tasks-tdd.md` (T-054r como última tarea). No se reutiliza ningún identificador ni se
renumera nada.
