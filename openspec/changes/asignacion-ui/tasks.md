# Tasks: asignacion-ui (Etapa 5 — pantalla del socio)

> **Change**: `asignacion-ui` · **Rama**: `feat/asignacion-ui` · **Base**: `dev` ·
> **Almacén de artefactos**: openspec (archivos).
>
> **Entradas**: `explore.md`, `proposal.md` (D-112…D-117), `design.md` (D-118…D-121) y los dos specs del
> change (`asignacion-sugerencia-ui`, `seed-asignacion-demo`).
>
> **Numeración**: tareas **T-057a–T-057e** (última registrada: T-056g), decisiones **D-118–D-121**
> (última: D-117). Sin migraciones ni cambio de esquema.
>
> **Rebanado**: cinco slices verticales. S2 se parte en **S2a** (estados con datos) y **S2b** (estados vacíos,
> error y la regla de visibilidad en `page.tsx`) para no acercarse al tope de 400 líneas.

## Reglas de ejecución

1. **Strict TDD (rojo → verde)**: cada paso escribe primero la prueba y la corre. El rojo debe deberse a la
   razón correcta (símbolo no exportado, rama ausente, valor esperado distinto), nunca a un error de tipeo o
   de fixture. No se avanza con una prueba en rojo.
2. **Sin commits del agente**: el agente no commitea, no pushea y no abre PRs. Un slice = un commit, lo hace
   Fernando.
3. **Sin PRs** (flujo del proyecto). La revisión es por commit.
4. **Presupuesto**: ≤400 líneas autoradas (adiciones + eliminaciones, tests incluidos) por commit. Se mide con
   `git diff --shortstat` antes de pedir el commit. Si un slice se pasa, se detiene y se aplica el corte
   declarado; no se parte en silencio.
5. **Sin migraciones ni cambios de esquema.** Este change es de front más seed.
6. **NO tocar el backend de la asignación ni sus tests**: quedan prohibidos los cambios en
   `src/api/asignaciones.ts`, `src/domains/asignacion/**`, `src/app/api/asignaciones/**`,
   `src/lib/route-error-mapper.ts`, `src/app/api/sesiones/**` y sus `.test.ts`. Si una tarea parece
   necesitarlos, se detiene y se reporta.
7. **Sin `any`**: TypeScript estricto; los resultados se tipan con los DTO reales.
8. **Textos en español rioplatense**: copy de la tarjeta, `describe`/`it` y comentarios de porqué, como el
   resto del portal.
9. **El fetcher usa `import type` desde `src/api/asignaciones.ts`**: prohibido copiar los DTOs. Es lo que
   garantiza que un cambio de contrato rompa la compilación (design §2).
10. **Sin `Date.now()` ni `new Date()` durante el render** en la tarjeta ni en el hook fuera de un efecto o
    callback: `npm run lint` está en **0 errores** desde P-57 y debe seguir así en cada slice.
11. **Sin pantallas de carga nuevas** (`odd/tasks/socio-sin-pantallas-de-carga.md`) y **sin colores fijos**:
    solo tokens del tema claro/oscuro.
12. **Sin polling y sin cache de la sugerencia** (D-116/D-119).
13. **Las carreras y la visibilidad de pestaña se verifican con mutación**: quitar el `AbortController` o el
    id monotónico debe hacer fallar un test (como se hizo con el lock en el change anterior). Cada slice que
    lo requiera incluye el paso de mutar, ver el rojo, revertir y comprobar `git status` limpio.
14. **El seed sigue siendo idempotente** y no puede romper `tests/prisma-seed.test.ts` (R6).

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimado total (base) | ≈770 líneas |
| Cota superior (1,5×) | ≈1.155 líneas |
| Slice más grande (base / cota) | S1 y S2b: ≈180 / ≈270 |
| 400-line budget risk | **Bajo**: ningún slice llega a 400 ni con la cota |
| Chained PRs recommended | **No** (sin PRs: un slice = un commit) |
| Delivery strategy | ask-on-risk (rebanado ya autorizado; sin PRs) |
| Chain strategy | no aplica |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: no aplica (sin PRs: un slice = un commit)
400-line budget risk: Bajo
```

## Slices

### T-057a · S0 · Seed de asociaciones `EjercicioMaquina` (R6)

- **Objetivo**: que un entorno sembrado permita que el motor encuentre candidatas sin pasar por `/maquinas`.
- **AC**: AC-561, AC-562, AC-563, AC-564, AC-565, AC-566.
- **Archivos**: `prisma/seed-data.ts` (modificado), `tests/prisma-seed.test.ts` (modificado), `README.md`
  (una línea en "Datos de desarrollo").
- **Estimado**: 120 base · **180 cota**.
- **Pasos (RED → GREEN)**:
  1. RED: en `tests/prisma-seed.test.ts`, agregar al doble `findMany` que devuelva las `MAQUINAS` con `id`
     (hoy el proxy devuelve un objeto para cualquier método; R6). Correr
     `npm test -- tests/prisma-seed.test.ts`: debe fallar la nueva prueba de asociaciones porque el seed aún
     no llama `ejercicioMaquina.createMany`.
  2. RED: agregar la prueba de idempotencia (segunda corrida no vuelve a crear) y la de "ninguna asociación
     apunta a `Bicicleta fija` (`FUERA_DE_SERVICIO`)". Ambas fallan por ausencia de la llamada.
  3. GREEN: en `prisma/seed-data.ts`, después de crear las máquinas (`:249-251`), leerlas con
     `prisma.maquina.findMany({ where: { nombre: { in: [...] } }, select: { id, nombre } })` y crear las
     parejas del diseño §8 con `createMany({ skipDuplicates: true })`.
  4. GREEN: correr las tres pruebas; verdes. Agregar la línea del README.
  5. Mutación de idempotencia: quitar `skipDuplicates` y confirmar que la prueba de doble corrida falla;
     restaurar.
- **Verificación**: `npm test -- tests/prisma-seed.test.ts`, `npx tsc --noEmit`, `npm run lint`,
  `npm test`, `npm run build`.
- **Commit**: `feat(seed): asociar los ejercicios de Torso B a máquinas disponibles (S0, D-117)`.
- **Parada**: si el doble necesita más de un override (por ejemplo `createMany` con `skipDuplicates`), parar
  y reportar antes de tocar el harness.

### T-057b · S1 · Fetcher puro + hook

- **Objetivo**: contrato de cliente **de lectura** y estado de la tarjeta, sin UI. **No incluye `decidir`
  ni `enviando`**: se movieron a T-057e (S3) por presupuesto.
- **AC**: AC-551, AC-552.
- **Archivos**: `src/api/asignaciones-cliente.ts` (nuevo), `src/api/asignaciones-cliente.test.ts` (nuevo),
  `src/components/home-socio/use-sugerencia-asignacion.ts` (nuevo),
  `src/components/home-socio/use-sugerencia-asignacion.test.tsx` (nuevo).
- **Estimado**: ≈150 base · **≈225 cota** (medido al cerrar: 312 líneas con la S3 fuera).
- **Pasos (RED → GREEN)**:
  1. RED: `asignaciones-cliente.test.ts` — `fetchSugerencia` pega `GET /api/asignaciones/sugerencia`, deja
     las credenciales por defecto (same-origin) y propaga el `AbortSignal`; un 500 se normaliza a `ApiError`.
     Rojo: el módulo no existe.
  2. GREEN: implementar `src/api/asignaciones-cliente.ts` con `import type` de
     `src/api/asignaciones.ts` (regla 9) y `signal?: AbortSignal`.
  3. RED: `use-sugerencia-asignacion.test.tsx` — consulta al montar, no consulta en `visibilitychange` cuando
     la pestaña está oculta, sí cuando vuelve a visible, y descarta la respuesta vieja (dos `fetch`
     resueltos fuera de orden).
  4. GREEN: implementar el hook con `AbortController` + id monotónico (D-120).
  5. Mutación: quitar el id monotónico (o el `AbortController`) y confirmar que la prueba de carrera falla;
     revertir y comprobar `git status --short` limpio.
- **Verificación**: `npm test -- src/api/asignaciones-cliente.test.ts
  src/components/home-socio/use-sugerencia-asignacion.test.tsx`, `npx tsc --noEmit`, `npm run lint`,
  `npm test`, `npm run build`.
- **Commit**: `feat(asignacion-ui): cliente y hook de la sugerencia, sin polling ni cache (S1, D-119/D-120)`.
- **Parada**: si el hook necesita `Date.now()` en render para algo, parar y rediseñar (regla 10).

### T-057c · S2a · Tarjeta con los estados con datos

- **Objetivo**: presentación de `libre`, `enEspera` y `sinReserva`.
- **AC**: AC-544, AC-545, AC-555.
- **Archivos**: `src/components/home-socio/tarjeta-sugerencia.tsx` (nuevo),
  `src/components/home-socio/tarjeta-sugerencia.test.tsx` (nuevo).
- **Estimado**: 140 base · **210 cota**.
- **Pasos (RED → GREEN)**:
  1. RED: prueba de `libre`: `esperaSegundos = 0` y `maquinaNombre = "Banco plano"` → "Está libre", nombra
     "Banco plano" y el ejercicio, muestra "Ir ahora" y "Esperar".
  2. RED: prueba de `enEspera`: `esperaSegundos = 90` → "2 min" (`Math.ceil`), y `esperaSegundos = 30` →
     "menos de 1 min". Rojo por componente inexistente.
  3. RED: prueba de `sinReserva` (`sugerencia: null` + `siguienteEnOrden`): informa el ejercicio por orden y
     **no** muestra "Ir ahora" ni "Esperar".
  4. RED: prueba de accesibilidad: `aria-live="polite"`, nombre accesible del botón, y `maquinaNombre` null →
     "tu máquina".
  5. GREEN: componente de presentación puro (props), sin fetch, solo tokens.
  6. Mutación de copy: cambiar "Está libre" y confirmar que la prueba falla; revertir.
- **Verificación**: `npm test -- src/components/home-socio/tarjeta-sugerencia.test.tsx`, `npx tsc --noEmit`,
  `npm run lint`, `npm test`, `npm run build`.
- **Commit**: `feat(asignacion-ui): tarjeta de sugerencia con los estados con datos (S2a)`.
- **Parada**: si el componente pasa de 250 líneas o necesita estado propio, parar: el estado es del hook.

### T-057d · S2b · Estados vacíos, error y regla de visibilidad

- **Objetivo**: `sinSugerencia`, `vencida`, `error`, `cargando`, y montar la tarjeta en la home solo cuando
  corresponde (D-118).
- **AC**: AC-541, AC-542, AC-543, AC-546, AC-548, AC-553, AC-554.
- **Archivos**: `tarjeta-sugerencia.tsx` y su test (modificados), `sugerencia-asignacion.tsx` y su test
  (nuevos: contenedor con el hook, D-122), `use-sugerencia-asignacion.ts` (tipo: agrega `vencida`),
  `src/app/home-socio/page.tsx` y `page.test.tsx` (modificados).
- **Estimado**: 200 base · **300 cota** (medido: 7 archivos, ≈330 líneas). D-123: cada botón se dibuja solo
  si llega su callback.
- **Pasos (RED → GREEN)**:
  1. RED: pruebas de `sinSugerencia` (ambos `null` → mensaje neutro único, D-114), `error` ("No pudimos…" +
     "Reintentar") y `cargando` (`SeccionCargando` de `h-24`, sin texto de carga).
  2. RED: `page.test.tsx` — con `sesionEnProgreso: true` la tarjeta **no** aparece y `fetch` de asignaciones
     **no** se llama; con `false` y rutina activa aparece y se llama **una vez**; sin `rutinaActiva` no
     aparece ni se llama. Rojo: la página aún no monta nada.
  3. GREEN: agregar las ramas que faltan al componente y montar `<TarjetaSugerencia>` en `page.tsx` entre el aviso
     de oferta y el grid de la sesión (`page.tsx:121-125`), condicionado a `data?.rutinaActiva` y
     `!data.sesionEnProgreso`.
  4. GREEN: prueba de tema (clases de token, sin `dark:` ni hex) y de que la home sigue visible cuando la
     tarjeta está en `error`.
  5. Mutación de visibilidad: quitar la condición `!data.sesionEnProgreso` y confirmar que AC-542 falla;
     restaurar.
- **Verificación**: `npm test -- src/components/home-socio/tarjeta-sugerencia.test.tsx
  src/app/home-socio/page.test.tsx`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- **Commit**: `feat(asignacion-ui): estados vacíos y de error; la tarjeta se oculta con sesión en curso (S2b, D-118)`.
- **Parada**: si `page.tsx` necesita más de ~20 líneas de cambio, parar y reportar.

### T-057e · S3 · Acciones y refresco al cerrar la ejecución

- **Objetivo**: "Ir ahora" / "Esperar" cableados y D-121.
- **AC**: AC-547, AC-549, AC-550, AC-556.
- **Archivos**: `tarjeta-sugerencia.tsx` y su test, `asignaciones-cliente.ts` y su test,
  `use-sugerencia-asignacion.ts` y su test, `src/app/home-socio/page.tsx` y `page.test.tsx` (modificados).
- **Estimado**: ≈225 base · **≈340 cota**. **Medido**: 5 archivos, 331 líneas (150 propios + 77 heredados
  + los tests nuevos de doble toque, ESPERAR, 500, carrera y D-121).
- **Pasos (RED → GREEN)**:
  1. RED: "Ir ahora" llama `decidirSugerencia("ACEPTAR")` y "Esperar" llama `decidirSugerencia("ESPERAR")`
     (espía sobre el fetcher), con botones deshabilitados mientras viaja (doble toque no dispara dos veces).
  2. RED: tras `ACEPTAR` 200 la tarjeta muestra "Listo, te guardamos … para …" y "Empezar entrenamiento".
  3. RED: "Empezar entrenamiento" invoca `onSeguirRutina` (la misma prop que usa `SesionHero`).
  4. RED: un 409 en el `POST` produce `vencida` y dispara una consulta (AC-547).
  5. RED: en `page.test.tsx`, al cerrar `EjecucionRutina` se vuelve a pedir `fetchHomeSocioData` (D-121).
  6. GREEN: implementar `decidir()` en el hook, las acciones en el componente y el refetch al cerrar en
     `page.tsx` (≈3 líneas: `onCerrar` → `setModoEjecucion(false)` + recargar datos).
  7. Verificar AC-556: `git diff --name-only` del change no incluye backend de asignación ni sus tests.
  8. Mutación de doble envío: quitar el guard de `enviando` y confirmar que la prueba falla; restaurar.
- **Verificación**: `npm test -- src/components/home-socio/tarjeta-sugerencia.test.tsx
  src/components/home-socio/use-sugerencia-asignacion.test.tsx src/app/home-socio/page.test.tsx`,
  `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- **Commit**: `feat(asignacion-ui): aceptar y esperar desde la tarjeta; recargar el home al cerrar la ejecución (S3, D-121)`.
- **Parada**: si "Empezar entrenamiento" necesita un mecanismo distinto de `onSeguirRutina`, parar y reportar
  (regla 6: no se crea otro flujo).
- **Corte aplicado y cerrado**: D-121 se separó a **S3b** porque el slice medía 417 líneas (tope 400).
  **S3a medido**: 373 líneas, 9 archivos. **S3b medido**: ≈45 líneas en `page.tsx` + `page.test.tsx`
  (`cargarHome`, `cerrarEjecucion`, `invalidarCache(CLAVES.homeSocio)` y 4 tests).
- **Tests heredados de S1** (se escriben acá de nuevo, en TDD):
  - fetcher: "decide con POST y el body exacto { accion }" · "envía ESPERAR sin campos extra" ·
    "404 SIN_SUGERENCIA se convierte en ApiError con código" · "409 SIN_SUGERENCIA_VIGENTE se convierte en
    ApiError 409".
  - hook: "decidir ACEPTAR marca enviando y termina en aceptada" · "un 409 al decidir pasa a vencida y
    vuelve a consultar".

### S4 · Eco en la sesión — DIFERIDO

No se implementa en este change (D-112). Se decide al cerrar S3 con S2 en la mano. Requiere mostrar la
reserva nueva creada al completar un ejercicio dentro de `EjecucionRutina`, **solo lectura**.

## Matriz AC → slice → test

| AC | Slice | Test |
|---|---|---|
| AC-541 | S2b | `page.test.tsx` — "muestra la tarjeta con rutina y sin sesión en curso (una consulta)" |
| AC-542 | S2b | `page.test.tsx` — "con sesión en curso no aparece la tarjeta ni se consulta" |
| AC-543 | S2b | `page.test.tsx` — "sin rutina activa no aparece ni consulta" |
| AC-544 | S2a | `tarjeta-sugerencia.test.tsx` — "espera 0" y "espera 90 s → 2 min" / "30 s → menos de 1 min" |
| AC-545 | S2a | `tarjeta-sugerencia.test.tsx` — "sin reserva con orden de rutina" |
| AC-546 | S2b | `tarjeta-sugerencia.test.tsx` — "mensaje neutro único" |
| AC-547 | S3 | `use-sugerencia-asignacion.test.tsx` — "un 409 pasa a vencida y reconsulta" |
| AC-548 | S2b | `tarjeta-sugerencia.test.tsx` — "error con Reintentar" |
| AC-549 | S3 | `tarjeta-sugerencia.test.tsx` — "Ir ahora envía ACEPTAR", "Esperar envía ESPERAR", "doble toque" |
| AC-550 | S3 | `tarjeta-sugerencia.test.tsx` + `page.test.tsx` — "Empezar entrenamiento abre la ejecución" |
| AC-551 | S1 | `use-sugerencia-asignacion.test.tsx` — "consulta al montar", "consulta al volver a la pestaña" |
| AC-552 | S1 | `use-sugerencia-asignacion.test.tsx` — "descarta la respuesta vieja"; `asignaciones-cliente.test.ts` |
| AC-553 | S2b | `tarjeta-sugerencia.test.tsx` — "cargando sin texto, con SeccionCargando" |
| AC-554 | S2b | `tarjeta-sugerencia.test.tsx` — "solo clases de token, sin dark: ni hex" |
| AC-555 | S2a | `tarjeta-sugerencia.test.tsx` — "aria-live, nombre accesible, máquina nula" |
| AC-556 | S3 | `git diff --name-only` sin backend de asignación (verificación manual del slice) |
| AC-561 | S0 | `tests/prisma-seed.test.ts` — "asocia los cinco ejercicios de Torso B" |
| AC-562 | S0 | `tests/prisma-seed.test.ts` — "ninguna asociación a máquina fuera de servicio" |
| AC-563 | S0 | `tests/prisma-seed.test.ts` — "segunda corrida no duplica" |
| AC-564 | S0 | `tests/prisma-seed.test.ts` — "no crea máquinas/ejercicios/rutinas nuevas" |
| AC-565 | S0 | `tests/prisma-seed.test.ts` — suite completa |
| AC-566 | S0 | Smoke manual (abajo) |

**Ningún AC queda sin test.**

## Puerta del change (antes de `sdd-verify`)

```bash
npm test
npx tsc --noEmit
npm run lint          # 0 errores (los 96 warnings preexistentes pueden seguir)
npm run build
git diff --name-only   # solo src/api/asignaciones-cliente.ts, src/components/home-socio/*,
                       # src/app/home-socio/*, prisma/seed-data.ts, tests/prisma-seed.test.ts, README.md
```

## Smoke manual (Fernando)

Requisitos: base con `DATABASE_URL`, `npm run seed` corrido **después** de S0, y `npm run dev` en otra
terminal.

```bash
# 0) Evitar que el '!' de la contraseña dispare la expansión de historial de bash
set +H

# 1) Seed (idempotente; crea las asociaciones de Torso B)
npm run seed

# 2) Login de recepción (cookie jar)
curl -s -c recep.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"recepcion@arnold.test","password":"Arnold2026!"}'

# 3) Check-in del socio (DNI 30123456, PIN 1234) → debe crear la reserva
curl -s -b recep.jar -X POST http://localhost:3000/api/acceso/check-in \
  -H 'Content-Type: application/json' \
  -d '{"dni":"30123456","pin":"1234"}'

# 4) Login del socio
curl -s -c socio.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"socio@arnold.test","password":"Arnold2026!"}'

# 5) La sugerencia existe (ejercicio, máquina y espera)
curl -s -b socio.jar http://localhost:3000/api/asignaciones/sugerencia
```

**En el navegador** (misma sesión del socio): abrir `http://localhost:3000/home-socio` → la tarjeta aparece
con "Ir ahora" y "Esperar" → tocar **"Ir ahora"** → la tarjeta confirma la reserva y ofrece **"Empezar
entrenamiento"** → tocarlo → se abre la ejecución y arranca en el ejercicio sugerido.

```bash
# 6) La reserva pasó a EN_CURSO
psql "$DATABASE_URL" -c "select estado, \"ejercicioId\", \"maquinaId\" from \"AsignacionDeEjercicio\" order by \"creadaEn\" desc limit 3;"

# 7) Caso "Esperar": sin anti-passback (se apaga desde /configuracion como admin)
curl -s -c admin.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@arnold.test","password":"Arnold2026!"}'
curl -s -b admin.jar -X PUT http://localhost:3000/api/configuracion \
  -H 'Content-Type: application/json' -d '{"antiPassbackMinutos":0}'
curl -s -b recep.jar -X POST http://localhost:3000/api/acceso/check-in \
  -H 'Content-Type: application/json' -d '{"dni":"30123456","pin":"1234"}'
# → en el navegador, tocar "Esperar": la tarjeta deja de ofrecer "Ir ahora"
curl -s -b socio.jar http://localhost:3000/api/asignaciones/sugerencia   # sugerencia: null
```

**Caso crítico (D-118)**: con una sesión `EN_CURSO` (paso 6), recargar `/home-socio` → **la tarjeta no debe
aparecer** y no debe haber ningún "Ir ahora". Al terminar la sesión y volver a la home, la tarjeta se
reevalúa (D-121).

Rutina asignada, si hace falta iniciar la sesión por API:

```bash
psql "$DATABASE_URL" -tAc "select ra.id from \"RutinaAsignada\" ra
  join \"Socio\" s on s.id = ra.\"socioId\"
  join \"Usuario\" u on u.id = s.\"usuarioId\"
  where u.email = 'socio@arnold.test' and ra.activa = true;"
# con ese id:
curl -s -b socio.jar -X POST http://localhost:3000/api/sesiones \
  -H 'Content-Type: application/json' -d '{"rutinaAsignadaId":"<ID>"}'
```

## Estimaciones y cota

| Slice | Base | Cota 1,5× | Corte declarado |
|---|---|---|---|
| S0 | 120 | 180 | — |
| S1 | 180 | 270 | — |
| S2a | 140 | 210 | — |
| S2b | 180 | 270 | si pasa 380: separar la integración de `page.tsx` |
| S3 | 150 | 225 | si pasa 380: separar D-121 del resto |
| **Total** | **≈770** | **≈1.155** | |

Regla de escritura: medir con `wc -l` cada archivo nuevo apenas se crea; si un archivo va a superar ≈300
líneas, partirlo por responsabilidad antes de seguir.

## Riesgos de implementación

- **R1 · Respuesta vieja** (D-120): la prueba de mutación del paso 5 de S1 es obligatoria.
- **R2 · Fake del seed** (R6): si `findMany` no alcanza, parar en S0 y reportar; no tocar el harness más de lo
  necesario.
- **R3 · `page.tsx`**: debe seguir sin `Date.now()` en render y sin romper las pruebas existentes de la home
  (274 suites en verde hoy).
- **R4 · Latencia con base remota** (D-110): el smoke con Supabase puede superar los 2 s; subir
  `ASIGNACION_TIMEOUT_CALCULO_MS` antes de probar.
- **R5 · Seed ya corrido**: si las asociaciones ya existen, `skipDuplicates` las ignora; el smoke igual debe
  funcionar.

## Fuera de alcance

- S4 (eco en la sesión) y la vista de instructor (P-61).
- Cualquier cambio de backend, contrato, motor o esquema.
- Reasignación por instructor y simulación de la tesis (P-62).
