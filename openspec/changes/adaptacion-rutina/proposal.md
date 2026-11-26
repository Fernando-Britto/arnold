# Propuesta: adaptacion-rutina (micro — motor de carga e integración en la sesión)

## Resumen

El motor actual (D-59) sugiere carga por ejercicio mirando solo si la última sesión cumplió las repeticiones
objetivo. No lee el RIR, no aplica la regla ACSM (subir 2–10 % cuando sobran 1–2 repeticiones) y su lectura de
sesión (`leerSesion`) reduce todo a `{ carga, cumplida }`, así que no hay con qué decidir mejor.

Este change mejora la **sugerencia automática de carga** en dos slices (D-136, redefinida por D-143): **S1** un
motor puro con la regla ACSM como criterio primario y el RIR como modulador, probado con historiales sintéticos;
**S2** la integración de ese motor en la sugerencia que ya se muestra en la sesión. **No hay persistencia, no hay
propuestas y no hay migración.** Las propuestas con estado, la aprobación, la copia por socio, `planActualizadoAt`
y la meta/nivel persistidos se aplazan al change posterior `adaptacion-plan` (D-143, P-74).

## Problema

- **La progresión es lineal y ciega**: `sugerirProximaCarga` (`src/domains/sesion/progresion-ejercicio.ts:108-178`)
  solo mira si la última sesión cumplió las reps objetivo. No lee RIR ni aplica la regla ACSM.
- **La lectura de sesión descarta el dato que hace falta**: `leerSesion` (`:64-78`) devuelve `SesionLeida`
  `{ carga, cumplida }` (`:38-43`); las repeticiones realizadas y el RIR por serie existen en el historial pero no
  llegan al criterio.
- **El RIR se guarda pero no se lee**: `RegistroDeProgreso.rir` existe (`prisma/schema.prisma:521`) y viaja por el
  historial (`historial-ejercicio.ts:19,88`), pero `progresion-ejercicio.ts` no lo menciona.
- **La evidencia no se traduce a parámetros**: ACSM 2009, Halperin 2022 y Robinson 2024 dan direcciones claras
  (regla condicional, desfase global del RIR, RIR útil en hipertrofia y no en fuerza), pero ningún parámetro del
  motor las refleja.
- **No hay dónde aterrizar una propuesta de carga**: `EjercicioEnRutina` (`prisma/schema.prisma:337-356`) tiene
  `series`, `repeticiones`, `descanso` y `orden`, **no tiene carga**. La carga se sugiere en cada sesión
  (D-59); aprobarla cada vez sería inoperable (D-143).

## Objetivo

1. Un motor **puro y determinista** que, por ejercicio y a partir del historial, decida si la carga sube, se
   mantiene o se descarga, aplicando la regla ACSM y usando el RIR como modulador cuando la meta lo justifique.
2. **Integrar** ese motor en la sugerencia de la sesión sin romper el contrato que consume el front.
3. Todo umbral numérico es un **parámetro configurable candidato** (`REPS_SOBRANTES_PARA_SUBIR`,
   `INCREMENTO_PCT_MIN`, `INCREMENTO_PCT_MAX`, `RIR_DESFASE_GLOBAL`, `RIR_SERIE_DE_LECTURA`, etc.), con su valor
   por defecto y su fuente en `research.md`. Nunca una constante derivada de la evidencia.

## Alcance

### In Scope

1. **S1 — Motor puro** (sin base, sin UI): funciones puras que consumen historiales sintéticos y producen una
   `SugerenciaAdaptacion` por ejercicio, con tests contra casos ACSM, modulación por RIR y descarga reactiva.
2. **S2 — Integración en la sugerencia de la sesión**: ampliar la lectura de sesión para exponer repeticiones
   realizadas y RIR por serie, y cablear el motor nuevo en `seguimientoDeEjercicios`. Sin base nueva, sin
   migración, sin endpoints nuevos.

### Out of Scope

- **Propuestas con estado, aprobación del instructor, copia por socio, `planActualizadoAt`, meta y nivel
  persistidos, estancamiento y `cambiar-repeticiones`**: aplazados a `adaptacion-plan` (D-143, P-74). Los
  borradores de spec quedan en `diferido/`.
- **Meso** (volumen por músculo, estancamiento muscular, fatiga semanal): change posterior.
- **Macro** (transición entre fases fuerza/hipertrofia/descarga por meta): fuera de este change.
- **Días disponibles y lesiones**: no se modelan; el motor los recibe como parámetros opcionales pero no hay dato
  que los alimente.
- **Descarga por calendario**: solo la reactiva de D-59.
- **Cambio de rangos de repeticiones**: pertenece a `adaptacion-plan`; este change propone cargas y descargas.

## Capacidades afectadas

### New Capabilities

- `adaptacion-motor`: motor puro de adaptación micro por ejercicio (S1). Funciones puras que consumen historial y
  producen sugerencias con motivo. Incluye parámetros configurables.
- `progresion-sesion`: la sugerencia de carga de la sesión (S2). **Hoy no tiene spec** en `openspec/specs/` —D-59
  se implementó sin delta—, así que se crea como capacidad nueva en lugar de un `MODIFIED`.

### Sin cambios de contrato

- `asignacion-sugerencia-ui`, `motor-espera-asignacion` y la tarjeta Progreso del Home consumen `Sugerencia`
  `{ tipo, carga, motivo }`: la forma visible no cambia. El resumen de fin de sesión (`resumen-sesion.ts:107`)
  también la consume.

## Enfoque por slice

### S1 — Motor puro (sin base, sin UI)

- Entrada: historial sintético por ejercicio (series con carga, repeticiones realizadas, RIR y tipo) y la
  prescripción actual (series y repeticiones objetivo).
- Salida: `SugerenciaAdaptacion { tipo, carga, repeticiones, motivo, parametrosUsados }`.
- **Criterio primario (D-137)**: si el socio hizo 1–2 repeticiones por encima del objetivo, sube entre
  `INCREMENTO_PCT_MIN` y `INCREMENTO_PCT_MAX`; si no, mantiene.
- **RIR (D-137)**: señal blanda sobre `RIR_VENTANA_TENDENCIA` sesiones, leída en la última serie
  (`RIR_SERIE_DE_LECTURA`), con desfase global opcional (`RIR_DESFASE_GLOBAL`). **Desplaza el porcentaje dentro
  del rango**: RIR bajo sostenido → extremo bajo; RIR alto sostenido → extremo alto. Nunca anula ni dispara una
  subida. Solo entra cuando la meta lo justifica (D-138) y es apagable.
- **Meta y nivel**: son entradas del llamante. En producción la integración pasa `meta = null` y `nivel = null`;
  con `meta = null` el motor aplica **solo ACSM** (sin RIR) y con `nivel = null` usa `BASICO` para rangos y
  frecuencia, sin cambiar el cálculo de carga. Ambos defaults son parámetros (`META_POR_DEFECTO`,
  `NIVEL_POR_DEFECTO`).
- **Incremento (D-141)**: `nueva carga = última + k × paso`, `k = max(1, redondeo(% × última / paso))`; el paso es
  el `incrementoSugerido` de la regla `LINEAL` vigente (hoy global, `prisma/schema.prisma:568`). El piso de un paso
  prevalece sobre el tope del 10 % en cargas livianas y el motivo lo declara. La garantía de grilla aplica a las
  **subidas**; la descarga de D-59 redondea a múltiplos absolutos del paso.
- **Descarga reactiva (D-59)**: se mantiene intacta (3 fallos seguidos a la misma carga → −10 % ajustado a grilla).
- **Población y exclusiones (research §3.13)**: declaradas como límite del motor en su contrato, no como
  validación en ejecución.
- Validación: tests con historiales sintéticos (casos ACSM, grilla, carga liviana, RIR, descarga, determinismo).

### S2 — Integración en la sugerencia de la sesión

- **Lectura de sesión**: `leerSesion` y `SesionLeida` (`progresion-ejercicio.ts:38-43,64-78`) pasan a exponer las
  repeticiones realizadas y el RIR de la última serie, no solo `{ carga, cumplida }`.
- **Motor**: `sugerirProximaCarga` (`:108-178`) recibe los parámetros nuevos (meta, ventana de RIR, paso) con
  defaults; sigue devolviendo la `Sugerencia` que ya conocen los consumidores.
- **Cableado**: `seguimientoDeEjercicios` (`src/domains/sesion/sesion-de-entrenamiento.ts:891-929`) y
  `registrosDeEjercicio` (`:817-857`) alimentan el motor con repeticiones y RIR por serie. La consulta ya trae
  `rir: true` (`:831`).
- **Contrato visible**: `GET /api/sesiones?enCurso=1` y `POST /api/sesiones` siguen devolviendo
  `sugerencias`/`ultimasVeces` con la misma forma; el `motivo` puede cambiar de texto pero no de campo.
- **Sin migración**: no se toca el schema. Si el trabajo paralelo modificó `sesion-de-entrenamiento.ts`, hay que
  alinearlo antes de S2 (R4).

## Decisiones vigentes y aplazadas

**Vigentes**
- **D-136** (redefinida): dos slices, S1 motor puro y S2 integración.
- **D-137**: regla ACSM como criterio primario; el RIR desplaza el porcentaje dentro del rango, nunca anula ni
  dispara una subida.
- **D-138**: la meta entra como parámetro; en producción `meta = null` (solo ACSM), sin persistencia.
- **D-141**: incremento por grilla a partir de `incrementoSugerido`.
- **D-143**: reencuadre; propuestas y aprobación van a `adaptacion-plan`.

**Aplazadas (no descartadas, D-143 → P-74)**
- D-134 (propone/aprueba), D-135 (copia por socio y `planActualizadoAt`), D-139 (metas/nivel persistidos y vista
  de aprobación; sigue vigente que el socio ve el motivo de la sugerencia), D-140 (ciclo de vida de la propuesta)
  y D-142 (aprobación todo-o-nada).

## Criterios de éxito verificables

### S1 (motor puro — historiales sintéticos, sin base)

- `npm test -- progresion-adaptacion` pasa con los casos ACSM: 1–2 reps de sobra → subida dentro de
  `[INCREMENTO_PCT_MIN, INCREMENTO_PCT_MAX]`; reps cumplidas sin sobra → mantener.
- Test de grilla (D-141): la carga propuesta es `última + k × paso`, con `k = max(1, redondeo(% × última / paso))`,
  y nunca queda fuera de la grilla del socio.
- Test de carga liviana (D-141): 20 kg con paso 2,5 y 2 % elegido → propone 22,5 kg (12,5 %, sobre el tope) y el
  motivo lo dice.
- Test de RIR (D-137): una tendencia alta sostenida desplaza el porcentaje al extremo alto; una baja, al extremo
  bajo; ninguna anula ni dispara la subida; con meta de fuerza el RIR no cambia la decisión.
- Test de descarga (D-59): 3 fallos seguidos a la misma carga → −10 % ajustado a grilla, con motivo legible.
- Test de determinismo: dos invocaciones con entradas idénticas producen la misma sugerencia.
- Test de límite de población: el motor no valida edad ni lesiones, pero documenta las exclusiones en su contrato.
- `npx tsc --noEmit` y `npm run lint` verdes en los archivos nuevos.

### S2 (integración)

- La sugerencia de la sesión sale del motor nuevo: un historial donde el socio hizo una repetición de sobra
  produce una subida porcentual, no un +2,5 kg fijo.
- Test de contrato: la respuesta de `GET /api/sesiones?enCurso=1` mantiene las claves `sugerencias` y
  `ultimasVeces` con la misma forma; solo cambia el contenido de `motivo` cuando corresponde.
- Test de lectura ampliada: `leerSesion` devuelve las repeticiones realizadas y el RIR de la última serie.
- Test de regresión (D-59): la descarga reactiva se comporta igual que antes (3 fallos → −10 %).
- `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` verdes.

## Riesgos y mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|
| **R1 · RIR autoinformado ruidoso**: Halperin 2022 reporta subestimación media de 0,95 reps, I² = 97,9 %, y el nivel **no influye**; usar el RIR puntual produce decisiones inestables. | Subidas o mantencas indebidas por ruido de una sola serie. | Alta | RIR sobre `RIR_VENTANA_TENDENCIA`, leído en la última serie, con desfase global desactivable. Nunca gatillo único; para fuerza no cambia la decisión (D-138). |
| **R2 · Tests de S1 que pasan sin el criterio correcto**: la suite no distingue "subir por ACSM" de "subir por reps cumplidas" si los casos no están bien armados. | Falsa confianza en el motor. | Media | Casos sintéticos obligatorios y mutación: invertir el criterio debe hacer fallar los casos de 1 y 3 reps de sobra. |
| **R3 · Población fuera de la evidencia**: Pelland 2026, Coleman 2024 y Robinson 2024 estudian adultos sanos jóvenes. | Recomendación inadecuada para menores, embarazadas o lesionados. | Baja | Límite declarado (no validación) en el contrato del motor: research §3.13. |
| **R4 · S2 toca `sesion-de-entrenamiento.ts`**, que tiene cambios paralelos de Fernando (asignación, auth). | Conflicto de merge o commitear trabajo ajeno. | Alta | Alinear `dev` con `feat/adaptacion-rutina` antes de S2; no tocar archivos fuera de `openspec/` mientras el proceso paralelo siga activo. |
| **R5 · Compatibilidad del contrato que consume el front**: la pantalla de ejecución, el resumen y la tarjeta del Home leen `Sugerencia`. | Romper la sesión o el Home al cambiar la forma. | Media | Mantener `{ tipo, carga, motivo }`; test de contrato sobre `GET/POST /api/sesiones`; el `motivo` es texto, no estructura. |
| **R6 · Regresión de la descarga de D-59**: el motor nuevo reemplaza parte del criterio y puede alterar la racha de fallos. | Descargas que no ocurren o que ocurren antes. | Media | Mantener la lógica de `rachaDeFallos` y `cargaDescargada`; test de regresión dedicado antes de tocar el criterio. |

## Dependencias

- **Motor existente**: `src/domains/sesion/progresion-ejercicio.ts` (D-59, D-61) y
  `src/domains/sesion/historial-ejercicio.ts` (`agruparSesiones`, `RegistroHistorico.rir`).
- **Cableado**: `src/domains/sesion/sesion-de-entrenamiento.ts` (`seguimientoDeEjercicios`,
  `registrosDeEjercicio`, `incrementoLineal`) — archivo con trabajo paralelo (R4).
- **Schema (solo lectura)**: `RegistroDeProgreso` (`rir`, `repeticiones`, `carga`, `tipo`), `EjercicioEnRutina`
  (`series`, `repeticiones`) y `ReglaDeProgresion` (`incrementoSugerido`).
- **Consumidores**: pantalla de ejecución, resumen de sesión (`resumen-sesion.ts:107`) y tarjeta Progreso del Home
  (`home-socio-data.ts:327`).
- **Evidencia**: `openspec/changes/adaptacion-rutina/research.md` (10 DOIs verificados y tabla de parámetros).

## Plan de reversión

Dos commits, uno por slice:

- **Revertir S2**: la sugerencia vuelve al criterio anterior de `progresion-ejercicio.ts`; no hay migración ni
  datos creados, así que el revert es limpio.
- **Revertir S1**: no deja rastros (sin base, sin schema, sin endpoints).

## Fuera de este change

- **`adaptacion-plan`** (P-74): propuestas con estado, aprobación, copia por socio, `planActualizadoAt`, meta y
  nivel persistidos, estancamiento y `cambiar-repeticiones`. Borradores en `diferido/`.
- **Meso**: volumen semanal por músculo (`VOLUMEN_OBJETIVO_SEMANAL_POR_MUSCULO_Y_NIVEL`).
- **Macro**: transición entre fases (`DURACION_FASE_SEMANAS`), descarga por calendario
  (`DELOAD_CALENDARIO_SEMANAS`) y "definir" como fase (`FASE_DEFINICION_*`).
