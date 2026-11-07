# Propuesta: asignacion-ui (Etapa 5 — pantalla del socio)

## Resumen

La asignación dinámica ya funciona de punta a punta en el backend: el check-in calcula y persiste una
reserva, el socio puede aceptarla o esperar por API, y la sesión la consume al iniciar
(`openspec/specs/asignacion-api/spec.md`, `src/domains/sesion/sesion-de-entrenamiento.ts:260-299`). Lo que
falta es que el socio **lo vea**. Esta change agrega una tarjeta en `/home-socio` que muestra la
sugerencia vigente (ejercicio, máquina y espera estimada), permite "Ir ahora" (`ACEPTAR`) o "Esperar"
(`ESPERAR`), explica el estado cuando no hay sugerencia y, para que la demo funcione sin pasar por
`/maquinas`, hace que el seed asocie ejercicios a máquinas.

No toca el backend, el motor ni el contrato: consume `GET /api/asignaciones/sugerencia` y
`POST /api/asignaciones/decidir` tal como están.

## Problema

El motor calcula algo que nadie ve. `src/api/asignaciones.ts` tiene el contrato completo y
`src/app/api/asignaciones/{sugerencia,decidir}/route.ts` los endpoints con sus tests, pero no existe un
fetcher de cliente ni un componente que los use: la única mención de asignaciones en el portal es el
consumo silencioso de la reserva al iniciar la sesión
(`src/domains/sesion/sesion-de-entrenamiento.ts:260-267`). Para el socio, la Etapa 4 es invisible.

Además, el seed no crea `EjercicioMaquina` (`prisma/seed-data.ts` solo siembra máquinas,
`prisma/seed-data.ts:158-165`), así que sin pasar a mano por `/maquinas` el motor devuelve
`sin_opciones` y la pantalla no tendría nada que mostrar ni siquiera en una demo.

## Objetivos medibles

1. Abrir `/home-socio` con una reserva vigente muestra el ejercicio, la máquina y la espera en **≤1
   consulta** a la API y **sin pantalla de carga** (el marco ya está en el primer render).
2. "Ir ahora" y "Esperar" llaman `POST /api/asignaciones/decidir` con el body exacto `{ accion }` y la
   pantalla refleja la respuesta sin recargar la página.
3. Los seis estados de la tarjeta (espera 0, espera > 0, sin reserva con `siguienteEnOrden`, ambos `null`,
   vencida por 409, error 500) tienen copy propio y se cubren con tests.
4. Un entorno recién sembrado permite ver una sugerencia real sin tocar `/maquinas` (S0).
5. `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` siguen en verde.

## Alcance

### In Scope

1. **S0 · Seed con asociaciones** (nuevo, por decisión D-117): el seed asocia los ejercicios de la rutina
   "Torso B" (`prisma/seed-data.ts:106-116`) a máquinas `DISPONIBLE` de `MAQUINAS`
   (`prisma/seed-data.ts:158-165`). Idempotente, sin tocar el resto del seed ni romper
   `tests/prisma-seed.test.ts`.
2. **S1 · Fetcher y hook**: `src/api/asignaciones-ui.ts` con `fetchSugerencia()` y `decidirSugerencia()`
   tipados sobre `RespuestaSugerencia`/`RespuestaDecision` (`src/api/asignaciones.ts:50,56`), y un hook
   `useSugerencia` con estados `cargando | error | sinSugerencia | lista` y refresco por
   `visibilitychange`.
3. **S2 · Tarjeta en la home**: componente con los seis estados, montado entre la cabecera y `SesionHero`
   (`src/app/home-socio/page.tsx:88-131`).
4. **S3 · Acciones**: "Ir ahora" (`ACEPTAR`) y "Esperar" (`ESPERAR`), manejo de 409/500, CTA "Empezar
   entrenamiento" que reusa `onSeguirRutina` (`src/app/home-socio/page.tsx:85`).
5. **Tokens y accesibilidad**: solo clases de token (`text-ink`, `bg-surface`, `border-border`,
   `text-brand`) como `sesion-hero.tsx`, contenedor `aria-live="polite"` y botones con nombre explícito.

### Out of Scope

- **S4 diferido**: la franja de solo lectura dentro de `EjecucionRutina`. Se decide al terminar S2
  (D-112).
- **Cambios de backend**: ni contrato, ni orquestación, ni tabla, ni motor, ni migraciones
  (`D-114`). El `GET` y el `POST` se consumen tal como están.
- **Vista de instructor/administrador** (D-115): el `GET` ya admite `socioId` para esos roles
  (`src/api/asignaciones.ts:127-141`), pero la UI del personal es P-61.
- **Reasignación por instructor** (P-61) y **simulación de la tesis** (P-62).
- **Polling** y **cache de la sugerencia** (D-116).
- **Rediseño del home**, del rail, del tema o de las secciones sin carga (ya resueltos).

## Slices

| # | Slice | Qué entrega | Estimado | Depende de |
|---|---|---|---|---|
| **S0** | Seed de asociaciones | `prisma/seed-data.ts` + `tests/prisma-seed.test.ts`; asociaciones idempotentes para "Torso B" | ≈120 | — |
| **S1** | Fetcher + hook | `src/api/asignaciones-ui.ts`, hook, tests con `fetch` mockeado | ≈180 | — |
| **S2** | Tarjeta en la home | componente + montaje en `page.tsx` + tests de los seis estados | ≈220 | S1 |
| **S3** | Acciones | "Ir ahora"/"Esperar", 409/500, CTA de inicio + tests | ≈150 | S2 |
| **S4** | Eco en la sesión (**diferido**) | franja de solo lectura en `EjecucionRutina` | ≈120 | S2, decisión de Fernando |

Total ≈670 líneas autoradas, un commit por slice en `feat/asignacion-ui` (el proyecto no usa PRs; ver
`openspec/decisions.md` D-41). Ningún slice supera 400; S2 es el más ajustado y aplica el corte declarado
"S2a tarjeta / S2b estados raros" si el diff pasa de 380.

## Criterios de éxito

- Con una reserva vigente y espera 0: la tarjeta dice que la máquina está libre y nombra la máquina.
- Con espera > 0: muestra minutos estimados (`Math.ceil(esperaSegundos / 60)`) y los dos botones.
- "Ir ahora" envía `{ accion: "ACEPTAR" }`; la reserva sigue vigente y aparece el CTA de empezar.
- "Esperar" envía `{ accion: "ESPERAR" }`; la tarjeta pasa a "sin sugerencia" con "Volver a consultar".
- Un 409 (`SIN_SUGERENCIA_VIGENTE`, `src/lib/route-error-mapper.ts:209-214`) se traduce a "La reserva
  venció" y refresca; un 500 ofrece reintento.
- Nada de la tarjeta bloquea la home: si la consulta falla, el resto de la pantalla se ve igual.
- La suite completa sigue verde y el seed permite la demo sin pasos manuales.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **R1 · El contrato no distingue "sin rutina activa" de "rutina sin máquinas asociadas"**: ambos casos devuelven `sugerencia` y `siguienteEnOrden` en `null` (`src/api/asignaciones.ts:143-147`) | Copy ambiguo | Mensaje único neutro ("Todavía no tenemos una sugerencia para vos"), decidido en D-114. Sin cambios de contrato |
| **R2 · Costo del cálculo**: cada `GET` ejecuta el motor para `siguienteEnOrden` (`src/api/asignaciones.ts:80-93,149`) | Latencia con base remota (D-110) | Sin polling; una consulta al montar y otra al volver a la pestaña (D-116). Medir en el smoke |
| **R3 · Reserva vencida entre pintar y tocar** | 409 al aceptar | Estado dedicado con "venció" y refresco; es el caso normal si el socio tardó |
| **R4 · Cachear la sugerencia** (TTL 60 s de `src/lib/cache-cliente.ts:25`) ofrecería acciones sobre una reserva muerta | 409 sistemático | No cachear la sugerencia (D-116); el hook la pide siempre |
| **R5 · El seed no crea `EjercicioMaquina`** (`prisma/seed-data.ts`) | Pantalla sin datos en demo | S0 (D-117) |
| **R6 · El Prisma simulado de `tests/prisma-seed.test.ts` no implementa `findMany`** (devuelve un objeto, no un arreglo) | S0 rompe el harness | S0 agrega el override al fake y mantiene la aserción de `maquina.createMany` (`tests/prisma-seed.test.ts:78`) |
| **R7 · Doble envío** | Dos `ESPERAR` seguidos | Botones deshabilitados mientras viaja; `ACEPTAR` es idempotente |
| **R8 · Prometer "andá a esta máquina" a mitad de sesión** | Mentira funcional: no hay consumo intra-sesión (`sesion-de-entrenamiento.ts:547-560` solo recalcula) | S4 es solo lectura y está diferido; en S0–S3 no se promete salto |

## Dependencias

- **Solo lectura del backend existente**: `GET /api/asignaciones/sugerencia` y
  `POST /api/asignaciones/decidir` con la matriz de permisos ya aplicada
  (`src/lib/authorization.ts:35,50,80`).
- Contrato y errores vigentes: `src/api/asignaciones.ts`, `src/lib/route-error-mapper.ts:202-214`.
- Portal y patrón visual existentes: `src/app/home-socio/page.tsx`, `sesion-hero.tsx`,
  `seccion-cargando.tsx`, tokens del tema.
- Suite y CI actuales: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
  (`.github/workflows/ci.yml`).

## Estrategia de pruebas

- **S0**: `tests/prisma-seed.test.ts` — las asociaciones se crean una vez, no se duplican al re-sembrar,
  solo tocan máquinas `DISPONIBLE` y no alteran los conteos existentes.
- **S1**: Jest con `fetch` mockeado — códigos 200/403/404/409/500, body exacto `{ accion }`, y que el
  hook no dispare dos consultas concurrentes.
- **S2**: Testing Library — los seis estados, que el marco se dibuje antes de los datos (mismo criterio
  que `src/components/home-socio/secciones.test.tsx`), `aria-live` y nombres accesibles.
- **S3**: acciones — que "Ir ahora" envíe `ACEPTAR` y "Esperar" envíe `ESPERAR`, que el 409 muestre
  "venció" y refresque, y que el CTA de inicio llame `onSeguirRutina`.
- **Smoke manual (Fernando)**: seed limpio → check-in → abrir `/home-socio` → aceptar → empezar sesión y
  verificar que arranca en el ejercicio sugerido; dejar vencer 15 min y comprobar el 409; probar con base
  remota y `ASIGNACION_TIMEOUT_CALCULO_MS` alto.

## Plan de reversión

Cada slice es un commit independiente en `feat/asignacion-ui`; revertir S3 deja S0–S2 funcionando en modo
lectura, y revertir S2 devuelve el home exactamente al estado actual (la tarjeta es un componente nuevo con
un único punto de montaje, `page.tsx`). S0 es reversible por separado: borrar las filas creadas por el seed
no afecta datos de negocio, y el seed vuelve a su comportamiento anterior si se revierte el archivo.

## Decisiones de Fernando (vinculantes)

### D-112 · La sugerencia se muestra en la home; el eco en la sesión queda diferido
- **Origen**: Fernando (2026-11-05).
- **Contexto**: la reserva nace en el check-in y el socio abre `/home-socio` al llegar
  (`src/app/home-socio/page.tsx:88-131`); dentro de la sesión el único recálculo ocurre al completar un
  ejercicio (`src/domains/sesion/sesion-de-entrenamiento.ts:547-560`).
- **Decisión**: esta change muestra la tarjeta en la home, entre la cabecera y `SesionHero`. La franja de
  solo lectura dentro de `EjecucionRutina` (S4) queda **diferida** y se decide al terminar S2.
- **Por qué**: el lugar donde el socio decide es antes de empezar; S4 no cambia el flujo y se puede evaluar
  con S2 en la mano.

### D-113 · Los botones dicen "Ir ahora" y "Esperar"
- **Origen**: Fernando (2026-11-05).
- **Decisión**: "Ir ahora" envía `ACEPTAR`; "Esperar" envía `ESPERAR`. El contrato no cambia
  (`src/api/asignaciones.ts:169-176` acepta solo `accion`).
- **Por qué**: "aceptar" es el verbo del contrato, pero en pantalla el socio entiende "ir ahora".

### D-114 · "Sin sugerencia" es un único mensaje neutro
- **Origen**: Fernando (2026-11-05).
- **Contexto**: el contrato devuelve ambos `null` tanto si el socio no tiene rutina activa como si el motor
  no encuentra opciones (`src/api/asignaciones.ts:143-147`).
- **Decisión**: un solo mensaje neutro. **No** se agrega un campo al contrato ni se modifica el backend.
- **Por qué**: distinguir las causas no cambia lo que el socio puede hacer y agranda el alcance.

### D-115 · La vista de instructor/administrador queda fuera de alcance
- **Origen**: Fernando (2026-11-05).
- **Contexto**: el `GET` ya acepta `socioId` para ambos roles (`src/api/asignaciones.ts:127-141`).
- **Decisión**: no se implementa en esta change; queda como semilla de **P-61**.
- **Por qué**: el flujo obligatorio lo decide el socio y la reasignación por instructor es otra etapa.

### D-116 · Refresco sin polling y sin cache
- **Origen**: Fernando (2026-11-05).
- **Decisión**: la sugerencia se consulta al montar, al volver a la pestaña
  (`visibilitychange`), y tras `ACEPTAR`, `ESPERAR` o completar un ejercicio. **Sin polling.** **No** se
  cachea en `src/lib/cache-cliente.ts`.
- **Por qué**: cada consulta ejecuta el motor (D-110) y la reserva tiene `venceEn`
  (`src/api/asignaciones.ts:25`), así que un cache de 60 s ofrecería acciones sobre algo vencido.

### D-117 · El seed asocia ejercicios de "Torso B" a máquinas disponibles
- **Origen**: Fernando (2026-11-05).
- **Contexto**: el seed siembra máquinas (`prisma/seed-data.ts:158-165`) pero nunca `EjercicioMaquina`;
  sin asociaciones el motor devuelve `sin_opciones` y la demo no muestra nada.
- **Decisión**: S0 agrega asociaciones idempotentes entre los ejercicios de "Torso B"
  (`prisma/seed-data.ts:106-116`) y máquinas `DISPONIBLE`. No toca el resto del seed ni
  `tests/prisma-seed.test.ts` más allá de lo necesario para seguir verde.
- **Por qué**: la pantalla tiene que poder probarse de punta a punta sin pasos manuales por `/maquinas`.

## Preguntas abiertas

Ninguna bloqueante. Queda para el cierre de S2 la decisión sobre S4 (D-112) y, si el diff de S2 supera 380
líneas, la aplicación del corte declarado S2a/S2b.
