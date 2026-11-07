# Explore — asignacion-ui

- **Change**: `asignacion-ui` (Etapa 5 de "asignación dinámica de ejercicios", la parte visible)
- **Rama**: `feat/asignacion-ui` (desde `dev`) · **Fecha**: 2026-11-05
- **Estado**: exploración cerrada. Sin código. Las decisiones de §"Decisiones pendientes" son de Fernando.
- **Base**: la API de la Etapa 4 ya está en producción interna (`dev`/`main`); acá se decide **dónde y cómo se muestra**.

## Contexto

La asignación dinámica existe hoy solo como API: al registrar la asistencia se calcula el ejercicio de
la rutina con menos espera, se persiste una reserva `RESERVADA` que vence y el socio puede `ACEPTAR` o
`ESPERAR`. **Ninguna pantalla la consume**: `GET /api/asignaciones/sugerencia` y
`POST /api/asignaciones/decidir` existen con tests, pero no hay un fetcher de cliente ni un componente
que los use (`ls src/api | grep -i asig` solo devuelve el handler de servidor `src/api/asignaciones.ts`).
El socio ve su rutina y su sesión sin enterarse de que hay una sugerencia esperándolo.

## Lo que ya existe (verificable)

| Pieza | Archivo | Qué aporta |
|---|---|---|
| Contrato de lectura | `src/api/asignaciones.ts:56` | `RespuestaSugerencia { socioId, sugerencia \| null, siguienteEnOrden \| null, calculadoEn }` |
| Sugerencia | `src/api/asignaciones.ts:25` | `SugerenciaDTO { asignacionId, ejercicioId, ejercicioNombre, maquinaId, maquinaNombre \| null, esperaSegundos, ahorroSegundos, creadaEn, venceEn }` |
| Alternativa | `src/api/asignaciones.ts:37` | `SiguienteDTO { ejercicioId, ejercicioNombre, maquinaId \| null, esperaSegundos }` = el que toca por orden de rutina |
| Contrato de decisión | `src/api/asignaciones.ts:50` | `RespuestaDecision { accion, sugerencia \| null, siguienteEnOrden \| null }` |
| Rutas | `src/app/api/asignaciones/sugerencia/route.ts`, `.../decidir/route.ts` | `GET` (SOCIO/ADMIN/INSTRUCTOR) y `POST` (solo SOCIO), `ahora` en el borde |
| Errores | `src/lib/route-error-mapper.ts:202-214` | `SIN_SUGERENCIA` 404 "No hay una sugerencia vigente"; `SIN_SUGERENCIA_VIGENTE` 409 "La sugerencia ya no está vigente; vuelva a consultar" |
| Consumo al iniciar | `src/domains/sesion/sesion-de-entrenamiento.ts:260-299` | si hay reserva vigente **de la rutina**, la sesión arranca en **ese** ejercicio y la consume |
| Consumo por serie | `src/domains/sesion/sesion-de-entrenamiento.ts:547-560` | al completar un ejercicio recalcula y puede dejar una **nueva** reserva |
| Consumo atómico | `src/domains/sesion/integracion-asignaciones.ts:57` | `consumirReservaParaSesion` con guard optimista |
| Inicio del socio | `src/app/home-socio/page.tsx:88-160` | cabecera, aviso de oferta, `SesionHero` (recorrido) e historial |
| Sesión | `src/components/home-socio/ejecucion-rutina.tsx`, `encabezado-de-sesion.tsx` | ejecución serie a serie y encabezado con progreso/tiempo |
| Sin pantallas de carga | `odd/tasks/socio-sin-pantallas-de-carga.md`, `src/components/home-socio/seccion-cargando.tsx` | el marco se dibuja al instante; solo el área de datos pulsa |
| Tema | `odd/tasks/tema-claro-oscuro.md`, `src/lib/tema.ts` | tokens claro/oscuro; **no** usar colores crudos ni `dark:` |
| Cache | `src/lib/cache-cliente.ts:25,39,64` | `conCache`/`leerCache` por pestaña, TTL 60 s, invalidación explícita |

Specs: `openspec/specs/asignacion-api/spec.md` (AC-481…AC-490), `openspec/specs/asignacion-orquestacion/spec.md`
(D-102, D-108, D-110). Contrato de roles: design §11 del change archivado
`2026-10-31-asignacion-integracion`.

## Restricciones

1. **Sin pantallas de carga** (D de `socio-sin-pantallas-de-carga`): el marco y los títulos ya están; el
   pulso va solo en el área de datos y nunca ocupa la pantalla completa.
2. **Tema claro/oscuro**: solo tokens (`text-ink`, `bg-surface`, `border-border`, `text-brand`), como
   `sesion-hero.tsx` y `encabezado-de-sesion.tsx`.
3. **Roles**: el `POST` es exclusivo del SOCIO (`src/lib/authorization.ts:35`); el `GET` admite
   `socioId` para ADMIN/INSTRUCTOR (`:50`, `:80`).
4. **El cálculo es caro** (D-110): contra una base remota el cálculo del check-in supera los 2 s. Una
   consulta del `GET` también ejecuta el motor para `siguienteEnOrden` (`src/api/asignaciones.ts:80-93,149`).
   No se puede consultar en bucle.
5. **La reserva vence** (`minutosVencimientoReserva`, 15 min por defecto). Nada de cachear la sugerencia
   60 s a ciegas: se puede ofrecer "Aceptar" sobre algo vencido y comerse un 409.
6. **El motor no toca las máquinas** (`DISPONIBLE`/`OCUPADA` se derivan): la UI no debe prometer que la
   máquina queda reservada físicamente.

## Preguntas

### 1. ¿Dónde se muestra?

- **A. Tarjeta en `/home-socio`**, entre la cabecera y el `SesionHero` (`page.tsx:121-131`). Es la
  primera pantalla que abre el socio después del check-in, y la reserva nace justo ahí (gancho
  best-effort de `evaluarYRegistrarAcceso`). **Pro**: llega antes de empezar; no toca la sesión. **Contra**:
  no se ve mientras entrena.
- **B. Franja compacta dentro de `EjecucionRutina`**. **Pro**: después de completar un ejercicio se crea
  una reserva nueva (`sesion-de-entrenamiento.ts:547-560`) y ahí el socio sí está entrenando. **Contra**:
  compite con el foco de la serie; si la reserva es del ejercicio *actual*, confunde.
- **C. Ambas.**

**Recomendación: C, en dos slices.** A primero (es donde el socio decide), B después reutilizando el
mismo hook. Si hay que recortar, A sola ya cumple el objetivo del change.
*Sin sesión iniciada y recién llegado del check-in*: la reserva ya existe; el home la muestra. Si el
gancho del check-in falló (timeout), el `GET` devuelve `sugerencia: null` + `siguienteEnOrden` y la UI
cae al estado "sin sugerencia" (§3), nunca a un error.

### 2. ¿Cuándo se consulta?

- **Al montar el home** (con `leerCache` solo para evitar el pulso si hay valor, TTL ≤ 30 s). **Pro**:
  simple, una consulta. **Contra**: reserva desactualizada si el socio vuelve horas después.
- **Al volver a la pestaña** (`visibilitychange` → `document.visibilityState === "visible"`). **Pro**:
  barato y cubre el caso "dejé el celular". **Contra**: una consulta más por retorno.
- **Polling cada N segundos**. **Pro**: la espera se siente viva. **Contra**: cada llamada corre el motor
  (D-110); con 50 socios es un generador de carga. **Descartado.**
- **Después de cada serie**. Ya lo hace el backend al completar el ejercicio; la UI solo debe refrescar
  en ese evento. **Recomendación**.

**Recomendación**: consultar al montar + al volver a la pestaña + después de `ACEPTAR`/`ESPERAR` y de
completar un ejercicio. **Sin polling.** No cachear la sugerencia (por `venceEn`); como mucho memoizar
`siguienteEnOrden` en estado, no en `cache-cliente`.

### 3. Estados de la interfaz

| Estado | Cuándo | Copy propuesto (rioplatense, sin jerga) |
|---|---|---|
| Con espera 0 | `esperaSegundos === 0` | "Está libre: andá a **{maquinaNombre}**" |
| Con espera > 0 | `esperaSegundos > 0` | "Te toca en ~{ceil(espera/60)} min en **{máquina}**" + "Ir ahora" / "Esperar" |
| Sin sugerencia | `sugerencia === null` y `siguienteEnOrden !== null` | "Ahora no hay una reserva. Si seguís el orden, toca **{siguiente.ejercicioNombre}**" |
| Sin rutina / sin opciones | ambos `null` | "Todavía no tenemos una sugerencia para vos" (neutro: el contrato no distingue) |
| Vencida | `POST` → 409 `SIN_SUGERENCIA_VIGENTE` | "La reserva venció. Volvé a consultar" + refrescar |
| Error del servidor | `POST` → 500 o `GET` → ≥400 | "No pudimos calcular tu próxima máquina. Probá de nuevo" con reintento |
| Mientras se envía | `ACEPTAR`/`ESPERAR` en vuelo | botones deshabilitados, sin spinner de pantalla completa |

Accesibilidad: contenedor `role="status"` con `aria-live="polite"` para el cambio de estado, botones con
nombre explícito y el tiempo como texto (no solo color). **Ojo**: si el socio tiene rutina pero el motor
devuelve `sin_opciones` (máquinas sin asociar), el contrato responde ambos `null` igual que "sin rutina
activa" — el copy tiene que ser neutro o hay que agregar un campo (ver Riesgos R2).

### 4. Aceptar y Esperar

- **ACEPTAR** no escribe nada (`verify-report` del change archivado: "ACEPTAR no escribe y es idempotente"):
  la reserva sigue `RESERVADA` con su `venceEn` original. La UI debe confirmar visualmente y **ofrecer
  empezar/reanudar la sesión**.
- **ESPERAR** cancela la reserva (`CANCELADA`) y la respuesta trae `sugerencia: null` + `siguienteEnOrden`.
  La UI pasa al estado "sin sugerencia" y deja el botón "Volver a consultar".
- **Saltar al ejercicio sugerido**: **sí al empezar**, **no durante la sesión**. `iniciarSesion` elige el
  ejercicio inicial desde la reserva vigente **solo si pertenece a la rutina**
  (`sesion-de-entrenamiento.ts:260-267`). Con una sesión ya `EN_CURSO`, el único recálculo ocurre al
  completar un ejercicio (`:547-560`) y no hay endpoint que consuma otra reserva a mitad de sesión: la
  fila nueva queda `RESERVADA` hasta la próxima sesión. Ofrecer "andá a esta máquina ahora" a mitad de
  sesión sería mentira.
**Recomendación**: en el home, "Aceptar" → CTA "Empezar entrenamiento" (reusa `onSeguirRutina`,
`page.tsx:85`). Dentro de la sesión (si se hace B), solo **mostrar** la reserva nueva y decir "queda
reservada para la próxima", sin botón de salto.

### 5. ¿Algo del lado del personal?

El `GET` ya acepta `socioId` para ADMIN/INSTRUCTOR (`src/api/asignaciones.ts:127-141`). Una vista de solo
lectura en `/clientes` o `Home_Interno` es barata de hacer pero **cambia el alcance**: el flujo
obligatorio lo decide el socio y la reasignación por instructor es **P-61** (Etapa 5 propia).
**Recomendación: fuera de alcance.** Dejar la API como está y anotar la vista como semilla de P-61.

### 6. Pruebas

- **Jest + Testing Library** (lo que ya usa el portal): los cuatro estados de §3, el `ACEPTAR` y el
  `ESPERAR` (que se llame el endpoint con el body exacto `{ accion }`), el mapeo del 409 a "venció", el
  error 500 con reintento, la accesibilidad del contenedor live y que el marco se dibuje antes de los
  datos (mismo criterio que `secciones.test.tsx`). Con `fetch` mockeado y `leerCache` limpio.
- **Smoke manual (Fernando)**: check-in real → abrir `/home-socio` → aceptar → empezar sesión → verificar
  que arranca en el ejercicio sugerido; esperar 15 min y comprobar el 409; probar con base remota y
  `ASIGNACION_TIMEOUT_CALCULO_MS` alto.
- **No** se testea el motor ni el handler (ya cubiertos: `src/api/asignaciones.test.ts`,
  `asignaciones.post.test.ts`).

### 7. Partición en slices (≤400 líneas cada uno)

| # | Slice | Qué | Estimado |
|---|---|---|---|
| **S1** | Fetcher + hook | `src/api/asignaciones-ui.ts` (`fetchSugerencia`, `decidirSugerencia`) y un hook `useSugerencia` con estados `cargando/error/sinSugerencia/lista`, refetch por `visibilitychange`. Tests del fetcher y del hook. Sin UI. | ≈180 |
| **S2** | Tarjeta en el home | `sugerencia-card.tsx` con los estados de §3, montada en `page.tsx` entre cabecera y `SesionHero`. | ≈220 |
| **S3** | Aceptar / Esperar | acciones + invalidación del estado + CTA "Empezar entrenamiento" + manejo de 409/500. | ≈150 |
| **S4** | Eco en la sesión (opcional) | franja compacta en `EjecucionRutina` con la reserva nueva creada al completar un ejercicio, solo lectura. | ≈120 |

Orden: S1 → S2 → S3 → S4. S1 sola no cambia nada visible y deja el contrato probado.

## Riesgos

- **R1 · Costo del cálculo**: cada `GET` corre el motor para `siguienteEnOrden`. Sin polling y con una
  sola consulta por apertura, el impacto es el mismo que ya tiene el check-in (D-110). Medir en el smoke
  con base remota.
- **R2 · El contrato no distingue "sin rutina" de "sin opciones"**: ambos casos devuelven `sugerencia` y
  `siguienteEnOrden` en `null` (`src/api/asignaciones.ts:143-147`). Se resuelve con copy neutro; si
  Fernando quiere mensajes distintos, hace falta un campo nuevo en la respuesta (**cambio de backend**).
- **R3 · Reserva vencida entre pintar y tocar**: el `POST` da 409 y la UI debe recuperarse sin drama
  (refrescar y mostrar "volvé a consultar"). Es el caso normal si el socio tardó.
- **R4 · "Ir a la máquina" a mitad de sesión**: hoy no existe consumo intra-sesión (§4). Si se promete en
  la UI, es una funcionalidad nueva de backend.
- **R5 · Semilla sin asociaciones**: el seed no crea `EjercicioMaquina`; sin asociar ejercicios el motor
  devuelve `sin_opciones` y la pantalla siempre muestra "sin sugerencia". Avisar en el smoke.
- **R6 · Doble envío**: `ACEPTAR` es idempotente, pero deshabilitar el botón mientras viaja evita
  parpadeos y doble `ESPERAR`.

## Decisiones pendientes (Fernando)

1. **Alcance de ubicación**: ¿A sola o C (home + sesión)? Recomendación: S1→S3 y decidir S4 al ver S2.
2. **Copy**: ¿"Ir ahora" / "Esperar" o "Aceptar" / "Esperar"? El verbo "aceptar" es el del contrato; en
   pantalla, "Ir ahora" se entiende mejor.
3. **Mensaje de "sin sugerencia"**: ¿neutro (una sola frase) o distinguir "sin rutina" de "sin máquinas
   asociadas" agregando un campo a la respuesta (backend)?
4. **Vista del personal (P-61)**: confirmar que queda fuera de esta etapa.
5. **Refresco**: confirmar "al montar + al volver a la pestaña + tras cada acción", sin polling.

## Fuera de alcance

- Reasignación por instructor (P-61) y simulación de la tesis (P-62).
- Cambios al motor, a la orquestación o a la tabla de asignaciones.
- Rediseño del home o del rail; el tema y las secciones sin carga ya están resueltos.
