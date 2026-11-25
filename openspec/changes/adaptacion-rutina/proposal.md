# Propuesta: adaptacion-rutina (micro — progresión automática por ejercicio)

## Resumen

El motor actual (D-59) sugiere carga por ejercicio mirando solo si la última sesión cumplió las repeticiones
objetivo. No conoce la meta del socio, su nivel, su RIR ni el paso del tiempo: no hay progresión más allá de
"subir 2,5 kg cuando se cumplen las reps". Esta change agrega un **motor de adaptación micro** que decide,
por ejercicio, si la carga sube, se mantiene, se descarga o cambia el rango de repeticiones, usando el
historial completo (repeticiones realizadas, RIR como señal blanda y regla ACSM) y entregando una
**propuesta** que el instructor aprueba antes de tocar la rutina del socio.

El alcance es **solo micro** (D-136), en tres slices: **S1** motor puro probado con historiales sintéticos;
**S2** persistencia (copia por socio perezosa + `planActualizadoAt` + propuesta con estado, D-134/D-135);
**S3** aprobación del instructor y vista del socio. Meso y macro quedan fuera de este change.

## Problema

- **La progresión es lineal y ciega**: `sugerirProximaCarga` (`src/domains/sesion/progresion-ejercicio.ts:108-178`)
  solo mira si la última sesión cumplió las reps objetivo. No lee RIR, no distingue fuerza de hipertrofia y no
  aplica la regla ACSM (subir 2–10 % cuando hay 1–2 reps de sobra).
- **No hay plan por socio**: `Rutina` es plantilla compartida (`prisma/schema.prisma:360-377`); adaptar la
  rutina de un socio tocaría la plantilla que muchos comparten.
- **`planDesde` depende de `updatedAt`** (D-59, D-61): cualquier edición de la fila (incluso descanso u
  orden) podía reiniciar el juicio; D-61 lo acotó a series/reps, pero `updatedAt` sigue siendo semánticamente
  ambiguo para el motor.
- **No hay registro de propuesta**: D-134 define "el sistema propone, el instructor aprueba", pero no existe
  el registro con estado que lo materialice.
- **El RIR se guarda pero no se lee**: `RegistroDeProgreso.rir` existe (`prisma/schema.prisma:521`) y viaja
  por el historial, pero `progresion-ejercicio.ts` no lo menciona (Bloque 1 del `explore.md`).
- **La evidencia disponible no se traduce a parámetros**: ACSM 2009, Robinson 2024, Halperin 2022 y Bell 2023
  dan direcciones claras (regla de progresión condicional, RIR distinto por objetivo, desfase global del RIR,
  reducción de volumen en descarga), pero hoy ningún parámetro del motor los refleja.

## Objetivo

1. Un motor de adaptación **micro** que, por ejercicio y a partir del historial, decida si la carga sube, se
   mantiene, se descarga o cambia el rango de repeticiones, aplicando la regla ACSM y usando el RIR como
   señal blanda cuando la meta lo justifique.
2. Una **propuesta** con estado (`PENDIENTE | APROBADA | RECHAZADA`) que el instructor revisa y aprueba antes
   de modificar la rutina del socio (D-134).
3. **Aislamiento del plan del socio**: copia por socio perezosa (D-135) y `planActualizadoAt` como fuente
   única de `planDesde`.
4. Todo umbral numérico es un **parámetro configurable candidato** (`RIR_DESFASE_GLOBAL`,
   `REPS_SOBRANTES_PARA_SUBIR`, `INCREMENTO_PCT_MIN`, `INCREMENTO_PCT_MAX`, `RIR_OBJETIVO_FUERZA`,
   `RIR_OBJETIVO_HIPERTROFIA`, `ESTANCAMIENTO_VENTANA_SESIONES`, etc.), nunca una constante derivada de la
   evidencia (ver `research.md`).

## Alcance

### In Scope (solo micro)

1. **S1 — Motor puro** (sin base, sin UI): funciones puras que consumen historiales sintéticos y producen
   `SugerenciaAdaptacion` por ejercicio (subir carga, cambiar reps, descargar, mantener), con tests contra
   casos ACSM, RIR blando y detección de estancamiento configurable.
2. **S2 — Persistencia**: copia perezosa de `Rutina` por socio, **una** migración aditiva (`planActualizadoAt`,
   `Socio.metaDeEntrenamiento` y `Socio.nivel`), tabla de `PropuestaAdaptacion` con estado, y servicio que
   dispara propuestas contra el motor de S1.
3. **S3 — Aprobación y vista**: endpoint del instructor para listar/aprobar/rechazar propuestas; carga y
   edición de la meta y el nivel del socio; y vista del socio que muestra la rutina vigente con el motivo de la
   última adaptación aprobada.

### Out of Scope

- **Meso** (volumen por músculo, estancamiento muscular, fatiga semanal): será change posterior.
- **Macro** (transición entre fases fuerza/hipertrofia/descarga por meta): fuera de este change.
- **Días disponibles y lesiones**: no se modelan en este change. El motor los recibe como parámetros
  opcionales, pero no hay dato que los alimente (ver R7).
- **Descarga por calendario**: solo la reactiva (como hoy, D-59) entra en S1; la descarga por calendario queda
   para la capa macro.
- **Asignación sugerencia UI, sugerencia de rutina al alta**: siguen como están.

## Capacidades afectadas

### New Capabilities

- `adaptacion-motor`: motor puro de adaptación micro por ejercicio (S1). Funciones puras que consumen
  historial y producen sugerencias de adaptación con motivo. Incluye parámetros configurables y detección de
  estancamiento.
- `adaptacion-propuesta`: registro de propuestas con estado (D-134) y copia por socio perezosa (D-135).
  Incluye migración de `planActualizadoAt` en `EjercicioEnRutina`.
- `adaptacion-aprobacion`: flujo de revisión del instructor y vista del socio (S3).

### Modified Capabilities

- `rutinas-crud`: el handler de update debe respetar `planActualizadoAt` (solo series/reps lo mueven) y la
  asignación debe tolerar una `Rutina` propia del socio sin romper la lectura de `RutinaAsignada.rutina`.
- `home-socio-portal`: la tarjeta Progreso consume la nueva `SugerenciaAdaptacion` en lugar de (o como
  extensión de) la `Sugerencia` actual.
- `motor-espera-asignacion` / `asignacion-sugerencia-ui`: sin cambios de contrato, pero leen la rutina que
  puede ser copia del socio tras la primera adaptación.

## Enfoque por slice

### S1 — Motor puro (sin base, sin UI)

- Entrada: `HistorialEjercicioAdaptacion` sintético (series con carga, reps realizadas, RIR, tipo) y
  prescripción actual (series, reps objetivo).
- Salida: `SugerenciaAdaptacion { tipo, carga, repeticiones, motivo, parametrosUsados }`.
- Criterio primario: **decisión (a), resuelta en D-137** (ACSM + RIR blando sobre ventana).
  La implementación deja el criterio como punto de extensión (inyección de estrategia).
- RIR: señal blanda, leída en la última serie del ejercicio (`RIR_SERIE_DE_LECTURA`), con desfase global
  opcional (`RIR_DESFASE_GLOBAL`). No se usa como gatillo de una sola sesión; se evalúa sobre
  `RIR_VENTANA_TENDENCIA`. El RIR entra al motor **solo cuando la meta lo justifique** (D-138).
- Sin meta ni nivel cargados, el motor aplica los defaults de S2 (`META_POR_DEFECTO` = solo ACSM,
  `NIVEL_POR_DEFECTO` = `BASICO`).
- Estancamiento: ventana configurable `ESTANCAMIENTO_VENTANA_SESIONES` (default 3), ingeniería, no derivada
  de evidencia (research §3.9).
- Descarga reactiva: se mantiene la lógica de D-59 (3 fallos seguidos → −10 % ajustado a grilla), con el
  factor parametrizado (`DELOAD_REDUCCION_VOLUMEN_PCT`).
- Población objetivo y exclusiones (research §3.13): **declaradas como límite del motor**, no como
  validación. El motor documenta que no aplica a menores de 18, mayores de 60–65 sin evaluación, embarazo,
  lesión no rehabilitada ni condición cardiovascular no controlada. `POBLACION_EDAD_MIN`,
  `POBLACION_EDAD_MAX` y `POBLACION_REQUIERE_NIVEL_EXPLICITO` quedan como parámetros de configuración, no
  como filtros en este change (no hay datos de lesiones ni edad en `Socio`).
- Validación: tests con historiales sintéticos que cubran ACSM (1–2 reps de sobra → subida 2–10 %), RIR
  ruidoso (Halperin), estancamiento configurable, descarga reactiva y motivos legibles.

### S2 — Persistencia

- **Una** migración aditiva: `planActualizadoAt DateTime?` en `EjercicioEnRutina` (backfill desde `updatedAt`),
  `Socio.metaDeEntrenamiento` (enum nuevo Fuerza / Hipertrofia / Definición) y `Socio.nivel` (reusa el enum
  existente `NivelDeDificultad`, hoy solo en `Rutina`: `prisma/schema.prisma:315` y `:325-329`).
- **Valores por defecto cuando faltan datos**: `metaDeEntrenamiento = null` → el motor aplica **solo ACSM**, sin
  modulación por RIR (el condicional de D-138 queda apagado). `nivel = null` → se trata como `BASICO` para rangos
  de repeticiones y frecuencia, y **no** cambia el cálculo de carga (que es un % de la carga actual). Los dos
  defaults son parámetros (`META_POR_DEFECTO`, `NIVEL_POR_DEFECTO`) y se documentan en el contrato del motor.
- Copia perezosa de rutina: la primera adaptación que se apruebe clona `Rutina` + `EjercicioEnRutina` para
  ese socio y reasigna `RutinaAsignada`. Hasta entonces el socio sigue en la plantilla compartida.
- Tabla `PropuestaAdaptacion`: `{ id, socioId, rutinaId, estado (PENDIENTE | APROBADA | RECHAZADA),
  creadoPor (sistema), aprobadoPor?, contenido (JSON con cambios por ejercicio), motivo, createdAt,
  resueltoAt }`.
- Servicio de disparo: tras cada sesión cerrada, el sistema evalúa el motor de S1 para los ejercicios con
  historial y, si hay algo que proponer, crea una `PropuestaAdaptacion` en estado `PENDIENTE`. Idempotente:
  no duplica propuestas pendientes para el mismo socio.

### S3 — Aprobación y vista

- Endpoint del instructor: `GET /api/propuestas-adaptacion` (lista pendientes), `POST
  /api/propuestas-adaptacion/[id]/aprobar` y `…/rechazar`. Solo INSTRUCTOR y ADMINISTRADOR.
- **Carga de meta y nivel**: se integra en la edición de cliente existente (`PUT /api/clientes/[id]`,
  `src/app/api/clientes/[id]/route.ts`; UI en `cliente-form.tsx` / `clientes/page.tsx`). **Depende de R8**: si el
  trabajo paralelo de alta con huella no está integrado en `dev`, se usa un endpoint separado
  (`PATCH /api/socios/[id]/entrenamiento` + pantalla propia) y no se tocan esos archivos.
- Al aprobar: se aplica la copia perezosa si todavía no existe, se escriben los cambios en los
  `EjercicioEnRutina` de la copia y se actualiza `planActualizadoAt` solo en los ejercicios que cambiaron
  series o reps.
- Vista del socio: la rutina que ya ve hoy, con una línea adicional por ejercicio adaptado que muestra el
  motivo de la última aprobación. La decisión (c.4), resuelta en D-139, fija este nivel de detalle.

## Decisiones del proposal (resueltas 2026-11-18)

Fernando resolvió las seis el 2026-11-18: (a) → **D-137**, (b) → **D-138**, (c.1–c.4) → **D-139**. Las tablas de
opciones quedan como registro del porqué.

### (a) Criterio primario de progresión en S1 → **D-137**

Reabre parcialmente D-59, que descartó la doble progresión por repeticiones enteras fijas.

**Resuelta: opción C** — regla ACSM como criterio primario y RIR blando sobre ventana (D-137).

| Opción | Qué evalúa | Ventaja | Costo |
|---|---|---|---|
| **A. Repeticiones realizadas contra objetivo** (regla ACSM) | Si el socio hizo 1–2 reps por encima de las pedidas, sube 2–10 % (`INCREMENTO_PCT_MIN`/`MAX`) | Alineado con ACSM 2009 (abstract leído); el motor actual solo tiene `cumplida: boolean` y habría que extender `leerSesion` a `{ carga, repsRealizadas, objetivo }` | Requiere cambiar el tipo interno; la subida es un % de la carga actual (no un fijo de 2,5 kg), lo que obliga a decidir si el 2,5 kg actual es el "caso particular" o se reemplaza |
| **B. RIR de la última serie como sustituto** | RIR ≤ `RIR_OBJETIVO_*` → subir; RIR alto → mantener | No exige que el socio pase el objetivo de reps; funciona en cargas donde "cumplir reps" es poco discriminatorio | El RIR es ruidoso (Halperin 2022: subestimación media 0,95 reps, I² 97,9 %, el nivel no influye) y Robinson 2024 muestra que el RIR aporta poco para fuerza; usarlo como criterio primario universal es defenderlo más de lo que la evidencia banca |
| **C. Combinación** | ACSM como criterio primario; RIR como señal de ajuste (freno o acelerador blando) dentro de la ventana `RIR_VENTANA_TENDENCIA` | Aprovecha lo mejor de los dos; el RIR deja de ser gatillo de una sesión y pasa a ser tendencia | Complejidad mayor en el motor y en los tests; necesita que la decisión (b) defina bien cuándo el RIR entra |

**Recomendación**: **C**, con ACSM como columna vertebral y el RIR como ajuste blando sobre una ventana,
activado solo para metas de hipertrofia/definición. La decisión (b) define el encendido del RIR.

### (b) La meta como parámetro del motor y cuándo se usa el RIR → **D-138**

Robinson 2024 (abstract leído) separa el efecto por objetivo: el RIR pesa en hipertrofia y no en fuerza.
Para una meta tipo "mejorar press banca" (fuerza), el RIR aporta poco.

**Resuelta: opción A** — meta como parámetro; RIR condicional apagable; persistencia de la meta en S2 (D-138).

| Opción | Cómo entra la meta | Cuándo se usa el RIR |
|---|---|---|
| **A. Meta como enum, RIR condicional** | Enum nuevo en `Socio` (opción B de la decisión pendiente 4 del `explore.md`). El motor recibe la meta y, si es hipertrofia/definición, lee RIR; si es fuerza, lo ignora | Condicionado por la meta |
| **B. Meta como parámetro opcional, RIR siempre blando** | El motor acepta `meta?: string` y trata el RIR como blanda en todos los casos, con peso menor en fuerza | Siempre, atenuado por meta |
| **C. Sin meta en S1, RIR como señal blanda universal** | El motor de S1 no recibe meta; el RIR entra como señal blanda en todos los ejercicios, con la ventana como atenuante | Siempre, sin distinción |

**Recomendación**: **A**, pero depende de la decisión pendiente 4 del `explore.md` (metas del MVP). Si
Fernando prefiere dejar la meta para S3, **C** mantiene S1 acotado y posterga el condicional.

### (c) Recomendaciones provisionales 4 a 7 del `explore.md` → **D-139**

**Resueltas: (c.1) B, (c.2) A, (c.3) A, (c.4) B** (D-139).

#### (c.1) Metas soportadas en el MVP (decisión pendiente 4 del explore)

| Opción | Valores | Ventaja |
|---|---|---|
| A | Las de `OBJETIVOS_PRINCIPALES` (`rutina.ts:15-21`) | Reusa enum |
| **B** | Sublista acotada: Fuerza, Hipertrofia, Definición | Mapea directo a fase; "Definición" no está en `OBJETIVOS_PRINCIPALES` |
| C | Texto libre | Máxima flexibilidad, pero imposible de mapear a lógica |

**Recomendación**: **B**. Un enum nuevo en `Socio` con 2–3 valores para mapear a fase sin texto libre.

#### (c.2) Cómo se infiere el nivel (decisión pendiente 5 del explore)

| Opción | Procedencia |
|---|---|
| **A** | El instructor lo carga (dato explícito, reusa `NivelDeDificultad`) |
| B | Inferido de `fechaAlta` + historial |
| C | Se pregunta al socio |

**Recomendación**: **A**. Dato explícito; dejar B como mejora futura. El nivel condiciona el incremento
(`INCREMENTO_KG_POR_NIVEL`).

#### (c.3) Descarga: ¿reactiva o calendario? (decisión pendiente 6 del explore)

| Opción | Comportamiento |
|---|---|
| **A** | Reactiva (como hoy, D-59: 3 fallos seguidos → −10 %) |
| B | Calendario (cada `DELOAD_CALENDARIO_SEMANAS`) |
| C | Ambas |

**Recomendación**: **A** para este change (solo micro). La descarga por calendario queda para el change de
macro, donde hay contexto de fase. Bell 2023 da definición pero no números; Coleman 2024 (único ECA leído)
prueba cese total de una semana, no descarga con volumen reducido.

#### (c.4) Qué ve el socio (decisión pendiente 7 del explore)

| Opción | Qué se muestra |
|---|---|
| A | Solo la sugerencia de carga (como hoy) |
| **B** | La rutina de la semana y el motivo de la última adaptación aprobada |
| C | Fase + historial de cambios |

**Recomendación**: **B**. El motivo ya existe (`Sugerencia.motivo`, `progresion-ejercicio.ts:52`); mostrar la
rutina adaptada da transparencia sin exponer el motor. El historial de fases queda para macro.

### Pendientes antes del spec (sin resolver)

Fernando no las resolvió todavía. No se numeran D-xxx; se numerarán cuando se decidan.

#### (d) Propuesta `PENDIENTE` que quedó obsoleta

Si ya hay una propuesta pendiente y una sesión nueva cambia el diagnóstico, la regla idempotente actual deja viva
la propuesta vieja.

| Opción | Qué hace | Ventaja | Costo |
|---|---|---|---|
| A. Mantenerla | Se ignora el diagnóstico nuevo hasta que el instructor resuelva la vieja | Cero trabajo | El instructor puede aprobar un diagnóstico desactualizado |
| **B. Recalcular y reemplazar** | La nueva pasa a `PENDIENTE`; la vieja queda en estado `REEMPLAZADA` con puntero a la nueva | Nunca se aprueba un diagnóstico viejo; conserva traza de ambas | Estado nuevo y una regla de reemplazo en el servicio |
| C. Caducarla | Estado `VENCIDA` por antigüedad (SLA) y crear una nueva | Limpia la pila | Necesita un job o cálculo perezoso; no cubre el cambio inmediato de diagnóstico |

**Recomendación**: **B**. La propuesta vieja deja de ser accionable en el mismo momento en que el diagnóstico
cambia, sin perder historial.

#### (e) Redondeo del incremento: ¿el 2,5 kg es la grilla o la regla?

| Opción | Qué es el 2,5 kg | Qué pasa cuando el 2 % es menor que un paso |
|---|---|---|
| A. La regla | Incremento fijo por sesión (como hoy) | No aplica: siempre sube 2,5 kg |
| **B. La grilla** | Paso de peso; la regla es el % ACSM (2–10 %) redondeado al paso más cercano, con **mínimo un paso** | El mínimo de un paso lo cubre: sube 2,5 kg |
| C. Sin grilla | % puro sobre la carga actual (cargas arbitrarias) | Sube el 2 % exacto, aunque no sea un peso cargable en la práctica |

**Recomendación**: **B**. El porcentaje manda y la grilla lo hace cargable. Parámetro `REDONDEO_INCREMENTO`
(`cercano` | `abajo`) para elegir el criterio de redondeo; con `abajo`, nunca se baja de un paso. El paso de grilla
queda como parámetro (`PASO_GRILLA_KG`, default 2,5) y no como constante del motor.

#### (f) Granularidad de la aprobación

| Opción | Qué aprueba el instructor | Ventaja | Costo |
|---|---|---|---|
| A. Todo o nada | La propuesta entera | Simple de modelar y de operar | Un solo cambio malo obliga a rechazar los buenos |
| **B. Por ejercicio** | Cada cambio de ejercicio, con "aprobar todo" como atajo | Rechaza lo dudoso y conserva lo bueno | Más UI y el modelo de S2 necesita estado por ítem (tabla de ítems o JSON con estado) |

**Recomendación**: **B**, con atajo "aprobar todo". Afecta el modelo de `PropuestaAdaptacion` en S2 (hoy planteado
como `contenido` JSON con estado único): si se elige B, la migración debe incluir el estado por ítem.

## Criterios de éxito verificables

### S1 (motor puro — historiales sintéticos, sin base)

- `npm test -- progresion-adaptacion` pasa con los casos ACSM: 1–2 reps de sobra → subida entre
  `INCREMENTO_PCT_MIN` y `INCREMENTO_PCT_MAX` de la carga actual.
- Test que verifica que 3 fallos seguidos a la misma carga → descarga `DELOAD_REDUCCION_VOLUMEN_PCT`
  ajustada a grilla, con motivo legible.
- Test que verifica que la tendencia de RIR sobre `RIR_VENTANA_TENDENCIA` sesiones modifica la sugerencia
  solo cuando el criterio (decisión (b)) lo habilita; con meta de fuerza, el RIR no cambia la decisión.
- Test que verifica que el desfase `RIR_DESFASE_GLOBAL` (default ~+1) se aplica a la última serie y es
  desactivable.
- Test que verifica que `ESTANCAMIENTO_VENTANA_SESIONES` es configurable y que, por debajo del umbral, no se
  dispara propuesta de cambio de rango.
- Test de límite de población: el motor no valida edad ni lesiones (es límite declarado), pero documenta en
  su JSDoc las exclusiones del research §3.13.
- `npx tsc --noEmit` y `npm run lint` verdes en los archivos nuevos.

### S2 (persistencia)

- **Prerrequisito (R2)**: base de desarrollo aislada creada, o `dev` alineada con `feat/adaptacion-rutina`, antes
  de ejecutar cualquier migración. Sin eso, S2 no empieza.
- Sobre esa base/precondición, `npx prisma migrate deploy` aplica la migración aditiva: `planActualizadoAt` existe
  en `EjercicioEnRutina` con backfill desde `updatedAt`, y `Socio.metaDeEntrenamiento` / `Socio.nivel` existen y
  son nullable.
- Test de defaults: con `meta = null` el motor aplica solo ACSM (sin RIR); con `nivel = null` usa `BASICO` y no
  cambia el cálculo de carga.
- Test de copia perezosa: primera adaptación clona `Rutina` + `EjercicioEnRutina` y reasigna
  `RutinaAsignada`; segunda adaptación trabaja sobre la copia sin volver a clonar.
- Test de propuesta idempotente: dos sesiones cerradas seguidas sin aprobación intermedia generan **una**
  sola `PropuestaAdaptacion` pendiente por socio.
- Test de `planActualizadoAt`: aprobar propuesta mueve `planActualizadoAt` solo en los ejercicios que
  cambiaron series/reps; los que solo cambiaron descanso/orden no lo mueven (hereda la semántica de D-61).

### S3 (aprobación y vista)

- `GET /api/propuestas-adaptacion` con rol SOCIO o RECEPCIONISTA devuelve `403`; INSTRUCTOR y ADMINISTRADOR
  ven solo las de sus socios a cargo.
- `POST …/aprobar` en `PENDIENTE` → `200` y la rutina del socio queda con los cambios aplicados; en
  `APROBADA`/`RECHAZADA` → `409`.
- `POST …/rechazar` deja la propuesta en `RECHAZADA` con `aprobadoPor` y `resueltoAt`, sin tocar la rutina.
- Vista del socio muestra el motivo de la última adaptación aprobada por ejercicio (decisión (c.4)).
- Smoke manual (Fernando): instructor lista pendientes, aprueba una, verifica en SQL la copia y los
  `planActualizadoAt` movidos; socio ve el motivo en su rutina.

### Transversales

- `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` siguen verdes tras cada slice.
- Ninguna migración de este change corre antes de alinear `dev` con `feat/adaptacion-rutina`, o corre en
  base aparte (ver Riesgo R2).

## Riesgos y mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|
| **R1 · `planDesde`/`updatedAt`**: `updatedAt` se mueve con cualquier edición de la fila y no distingue qué cambió; el motor podría reiniciar el juicio con ediciones cosméticas. | El socio ve "mantené" cuando correspondía "subí". | Media | `planActualizadoAt` explícito (D-135) como única fuente de `planDesde`; migración aditiva con backfill desde `updatedAt`; el handler de update solo lo mueve cuando cambian series o reps (hereda la semántica de D-61). |
| **R2 · Base Supabase compartida**: hay trabajo paralelo (auth, migraciones en `src/`) corriendo en la misma base y la rama `dev` puede no estar alineada con `feat/adaptacion-rutina` al momento de migrar. | Migración nueva choca contra el schema que otro cambio está mutando; `migrate deploy` falla o deja la base inconsistente. | Alta | **Ninguna migración de este change corre hasta alinear `dev` con esta rama**, o corre en una base de desarrollo aparte. Los slices S1 (sin base) y parte de S2 (tests con Prisma mockeado) no dependen de esto; S3 y el handler real sí. El plan de reversión contempla que la migración sea reversible con `migrate reset` en la base aislada. |
| **R3 · RIR autoinformado ruidoso**: Halperin 2022 (abstract leído) reporta subestimación media de 0,95 reps, I² = 97,9 %, y el nivel **no influye**; usar el RIR como criterio puntual de una sesión produce decisiones inestables. | Subas o mantencas indebidas por ruido de una sola serie. | Alta | El RIR entra como señal blanda sobre `RIR_VENTANA_TENDENCIA` sesiones, leída en la última serie (`RIR_SERIE_DE_LECTURA`), con desfase global opcional (`RIR_DESFASE_GLOBAL`). Nunca es gatillo único. La decisión (b) acota aún más: para fuerza, el RIR no cambia la decisión (Robinson 2024). |
| **R4 · Copia perezosa desincronizada**: si el instructor edita la plantilla compartida después de que un socio ya tiene copia, el socio no ve los cambios de la plantilla. | Rutina del socio desactualizada respecto de la plantilla. | Media | Documentar en el spec que la copia se vuelve independiente al aprobarse la primera propuesta; el instructor que quiera propagar cambios de plantilla debe reasignar la rutina al socio (flujo ya existente de `asignarRutina`). |
| **R5 · Propuestas huérfanas**: si el instructor nunca aprueba ni rechaza, la pila de `PENDIENTE` crece y el socio no progresa. | Estancamiento operativo. | Media | Listado del instructor ordena por antigüedad y marca las de más de `PROPUESTA_SLA_DIAS` (parámetro); no hay aprobación automática en este change. |
| **R6 · Tests de S1 con historiales sintéticos que pasan sin el criterio correcto**: la suite no distingue entre "subir por ACSM" y "subir por reps cumplidas" si los casos no están bien armados. | Falsa confianza en el motor. | Media | Casos sintéticos obligatorios: (i) reps cumplidas sin sobra → mantener; (ii) 1 rep de sobra → subir al mínimo del 2 %; (iii) 3 reps de sobra → subir al máximo del 10 %; (iv) RIR alto sostenido con meta hipertrofia → frenar; (v) RIR alto con meta fuerza → ignorar. Mutación: invertir el criterio debe hacer fallar al menos (ii) y (iii). |
| **R7 · Población fuera de la evidencia**: Pelland 2026, Coleman 2024 y Robinson 2024 estudian adultos sanos jóvenes; el motor se aplica sin filtro a cualquier socio. | Recomendación inadecuada para menores, embarazadas, lesiones. | Baja | Límite declarado (no validación) en la documentación del motor: research §3.13. `POBLACION_EDAD_MIN`, `POBLACION_EDAD_MAX` y `POBLACION_REQUIERE_NIVEL_EXPLICITO` quedan como parámetros; la validación real queda para cuando existan datos de lesiones y edad en `Socio`. |
| **R8 · Choque con el trabajo paralelo (alta con huella)**: `src/components/cliente-crud/cliente-form.tsx` y `src/app/clientes/page.tsx` están modificados por trabajo paralelo de Fernando. | S3 no puede integrar la carga de meta/nivel en el formulario sin conflicto ni commitear trabajo ajeno. | Alta | Ese trabajo debe estar integrado en `dev` antes de tocar esos archivos. Si no lo está, S3 usa un endpoint/pantalla separada (`PATCH /api/socios/[id]/entrenamiento`) y **no** modifica el formulario de clientes. |

## Dependencias

- **Motor existente**: `src/domains/sesion/progresion-ejercicio.ts` (D-59, D-61) y
  `src/domains/sesion/historial-ejercicio.ts` (agrupar sesiones, leer RIR).
- **Schema**: `Rutina`, `EjercicioEnRutina`, `RutinaAsignada`, `RegistroDeProgreso`, `Socio`,
  `Rutina.nivelDeDificultad` (enum reutilizable), `ReglaDeProgresion` (LINEAL, el incremento).
- **Asignación**: `asignarRutina` (`src/domains/rutina/asignar-rutina.ts:64-105`) — la copia perezosa lo
  reutiliza tras clonar.
- **Matriz de roles**: `src/lib/authorization.ts` y `matrix-consistency.test.ts` para los endpoints de S3.
- **Evidencia**: `openspec/changes/adaptacion-rutina/research.md` con los 10 DOIs verificados y la tabla de
  parámetros candidatos.
- **Alineación de ramas / base aislada (prerrequisito de S2)**: antes de correr migraciones hay que **alinear
  `dev` con `feat/adaptacion-rutina` o crear una base de desarrollo aislada**. Es una tarea previa de S2, no un
  supuesto: sin ella, `prisma migrate deploy` puede ver migraciones aplicadas que faltan localmente y ofrecer
  `reset` (R2).

## Plan de reversión

Tres commits independientes, uno por slice:

- **Revertir S3**: devuelve la UI del instructor y del socio al estado anterior; la API de propuestas sigue
  pero nadie la consume.
- **Revertir S2**: deja el motor de S1 sin llamantes reales (solo tests). La migración de
  `planActualizadoAt` es aditiva y reversibles con `migrate reset` en la base aislada (R2). Si ya se había
  copiado alguna rutina, las copias quedan como rutinas huérfanas — el instructor puede reasignar la
  plantilla con el flujo existente.
- **Revertir S1**: no deja rastros (no hay migraciones ni cambios de esquema en este slice).

Los datos creados por una propuesta son filas de `PropuestaAdaptacion` (borrables) y, tras aprobación,
copias de `Rutina` + `EjercicioEnRutina` con `planActualizadoAt` — reversibles con reasignación de
plantilla.

## Decisiones fuera de este change (quedan para meso/macro)

- Volumen semanal por músculo (`VOLUMEN_OBJETIVO_SEMANAL_POR_MUSCULO_Y_NIVEL`).
- Transición entre fases (`DURACION_FASE_SEMANAS`).
- Descarga por calendario (`DELOAD_CALENDARIO_SEMANAS`).
- Meta de "definir" como fase con progresión propia (`FASE_DEFINICION_VOLUMEN_FACTOR`,
  `FASE_DEFINICION_INTENSIDAD_FACTOR`).
