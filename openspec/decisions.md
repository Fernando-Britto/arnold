# Registro de decisiones — ARNOLD MVP Core

**Actualizado**: 2026-10-07 · **Plan**: [`sdd-tasks-tdd.md`](./sdd-tasks-tdd.md) · **Estado actual**: [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md)

Este documento registra **por qué** el proyecto se desvió del plan original durante `sdd-apply`, qué
alternativas se descartaron y qué quedó pendiente. El plan dice *qué* se hace; acá queda el *porqué*.

> **Registro unificado.** Este archivo reúne el registro de Fernando (D-01…D-16, FX-01…FX-10, P-01…P-14, L-01…L-06) y el
> del segundo desarrollador (ADR-01…ADR-13 y su addendum), más los cambios de las ramas `fix/clientes-update-transaccion`
> y `docs/unificar-documentacion`. La tabla de [§7](#7-concordancia-con-el-registro-adr) dice dónde quedó cada ADR.
> Donde las dos fuentes **se contradicen**, no se eligió en silencio: queda anotado (ver D-07 y [§4](#4-supuestos-sin-confirmar)).

- **Origen**: quién tomó la decisión. "Fernando" = autor del proyecto. "Dev 2" = segundo desarrollador (registro ADR). "Claude" = propuesta del asistente
  (confirmada por Fernando salvo que se indique lo contrario).
- **Verificado**: lo que se comprobó con evidencia (tests, schema, documentación instalada, logs) frente a lo
  que es un supuesto. Los supuestos están marcados como tales y listados en [§4](#4-supuestos-sin-confirmar).

---

## 1. Decisiones

### D-01 · T-021 crece de 400 a 1.806 LOC y se reparte en 7 PRs
- **Contexto**: el plan estimaba T-021a (250 LOC) + T-021b (150 LOC). T-020 solo había construido
  `OperationCard` y `ActivityColumn`. Faltaban `QuickActions`, `AlertasCard`, `AforoHoyCard`, `CajaCard`, las
  derivaciones de dominio (aforo, alertas de vencimiento, personal en turno, agregación) y, más adelante, la
  API de datos. El plan nunca los asignó a ninguna tarea.
- **Decisión**: respetar el límite duro de **≤400 LOC por PR** repartiendo el trabajo en PRs encadenados, en
  vez de aflojar la regla.
- **Resultado medido** (líneas agregadas, tests incluidos):

  | PR | Contenido | LOC |
  |---|---|---|
  | PR-009-A1 | Dominio: `computeAforo`, `computeAlertasVencimiento`, `computePersonalEnTurno`, `aggregateHomeInterno` | 260 |
  | PR-009-A2 | Componentes: `QuickActions`, `AlertasCard`, `AforoHoyCard`, `CajaCard` | 309 |
  | PR-009-A3 | Contrato `src/api/home-interno.ts` + página (Filas 1–3) | 365 |
  | PR-009-B | Row_Gestion + Col_Actividad + integración (+31 de refactor de nombres) | 336 |
  | PR-009-C1 | `gym-time` (hora argentina, turno) | 54 |
  | PR-009-C2 | Armado del payload desde Prisma + test de contrato | 389 |
  | PR-009-C3 | Ruta `GET /api/home-interno` | 62 |
  | | **Total T-021 (sin correcciones)** | **1.806** (plan: 400) |

- **Consecuencia**: el pronóstico de carga del plan subestimó T-021 por un factor de ~4,5. Ver lección L-01.
- **Origen**: Claude midió el desvío al implementar A3; Fernando aplicó los parches.

### D-02 · Home_Interno: el servidor entrega hechos crudos y las reglas viven en el dominio
- **Decisión**: `GET /api/home-interno` devuelve datos crudos más `ahora` (el reloj del servidor). Toda regla de
  negocio (período de gracia, "hoy" en hora argentina, feed de 24 h, porcentajes) corre en
  `aggregateHomeInterno`, una función pura.
- **Por qué**: se prueba sin base de datos; todas las tarjetas se calculan contra el mismo instante; hay un solo
  contrato (`HomeInternoDTO`) compartido por cliente y servidor.
- **Descartado**: que la API devuelva el view-model terminado (mezcla reglas con consultas y obliga a probarlas
  contra Prisma).
- **Salvaguarda**: un test de contrato pasa el payload serializado por `fetchHomeInternoData` y
  `aggregateHomeInterno` y reproduce los números de la spec.

### D-03 · Cuando la spec y el diseño (SVG) difieren, gana la spec
- Solo se muestra la alerta **"Vencimiento"** (el diseño dibuja tres tipos: falta de pago, por vencer,
  inactividad; la spec define uno).
- Se **omite** "+12% vs ayer" en Caja: no existe fuente de datos ni criterio en la spec.
- "Cierre de Caja" es **solo el disparador**; el flujo que crea `CierreDeCaja` no existe todavía.
- Mismo criterio que se había tomado con `INGRESO` en T-020. **Origen**: Claude propuso; Fernando confirmó.

### D-04 · Valores por defecto de configuración
- La spec solo documenta `periodoGracia = 0`. Se asumió `diasInactividad = 15` (el ejemplo de la propia spec)
  y, si falta `capacidadMaxima`, se muestra **"Aforo no configurado"** en vez de inventar una capacidad.
- Falta confirmar con el negocio (ver [§4](#4-supuestos-sin-confirmar)).

### D-05 · "Hoy" se calcula en hora argentina, y Caja incluye TARJETA
- `America/Argentina/Buenos_Aires`, constante `GYM_TIME_ZONE`. Como Argentina no tiene horario de verano, el
  inicio del día usa un offset fijo de −03:00.
- `MetodoPago` tiene tres valores en el schema; `computeCajaHoy` sumaba dos. `CajaCard` muestra una línea
  "Tarjeta" para que las partes sumen el total. Ver FX-01 y FX-02.

### D-06 · Controles sin permiso: visibles pero deshabilitados, con tooltip
- **Decisión**: "Nuevo Socio", el "Ver" de Alertas, la card "Socios inactivos" y las 4 cards de Row_Gestion se
  renderizan siempre, pero quedan **deshabilitadas** con el tooltip *"Sin acceso con tu rol"* cuando
  `ROLE_GATE_MATRIX` no deja abrir el destino.
- **Por qué**: la spec exige renderizar las 4 cards (AC-001); un clic que termina en redirección es peor
  experiencia que un control inactivo con explicación.
- **Descartado**: ocultar las cards (rompe AC-001) y dejarlas clickeables (callejón sin salida).
- **Origen**: Claude propuso; Fernando confirmó ("queda el tooltip" y "mejor solucionar y no arrastrar problemas").

### D-07 · `middleware.ts` pasa a `proxy.ts` (runtime Node)
- **Evidencia** (documentación de Next 16.2.12 instalada en `node_modules`): la convención `middleware` quedó
  deprecada; sigue corriendo en runtime **Edge**, y el nuestro importaba `jsonwebtoken` y Prisma, que necesitan
  Node. `proxy.ts` corre en Node.
- **Alcance de la afirmación**: se identificó el **riesgo** leyendo la documentación y el código; el fallo en
  ejecución **no se reprodujo**. Fernando lo corrigió preventivamente en T-026c.
- **Origen**: Claude detectó; Fernando implementó.
- **Discrepancia entre fuentes**: el registro de Dev 2 (ADR-04) afirma que sí se reprodujo: con `npm run dev`,
  `POST /api/auth/login` devolvía 500 con mensajes de "edge runtime" y "crypto", sin que los tests lo detectaran
  (mockeaban todo). Fernando documentó que el fallo no se reprodujo. **No hay un log que zanje la duda**; ver
  [§4](#4-supuestos-sin-confirmar) (supuesto 6). La decisión no cambia: `proxy.ts` es la convención correcta de
  Next 16 y corre en Node.

### D-08 · Autenticación (T-026): cookie de sesión, y desvíos de la spec `authentication-login`
- **Implementado por Fernando** (revisado por Claude en `main`): login/logout, cookie `authToken` `httpOnly`,
  `SameSite=Strict` (`Secure` en producción), 24 h; JWT con `jti`; `JWT_SECRET` obligatorio en producción; hash
  simulado para igualar tiempos de respuesta con email inexistente; el estado de la cuenta se revisa **después**
  de validar la contraseña; los handlers priorizan la cookie sobre el header `Bearer`, y una cookie inválida no
  cae al `Bearer`.
- **Desvíos respecto de la spec**: (1) la cookie se llama `authToken`, no `Authorization`; (2) **no hay refresh
  token ni tabla `TokenRevocation`**: el `jti` se genera pero nada lo consulta, así que el logout solo borra la
  cookie y un token robado sigue válido hasta las 24 h.
- **Pendiente**: migración de `TokenRevocation` si se quiere revocación real (ver [§3](#3-pendientes-abiertos)).

### D-09 · RN-06 y Clientes: el Recepcionista lee solo `GET /api/membresias/activas`
- **Conflicto real entre dos specs**: RN-06 dice que Membresías es solo del Administrador; la spec de Clientes
  (AC-004) dice que el Recepcionista asigna una membresía activa desde un desplegable.
- **Decisión**: endpoint dedicado de lectura mínima (`id`, `nombre`, `precio`, `estado`; sin conteos ni datos de
  gestión), permitido a Administrador y Recepcionista. `/membresias` y `/api/membresias` siguen siendo solo de
  Administrador; los tests RN-06 verifican caso por caso lo que el Recepcionista **sigue sin poder hacer**.
- **Descartado**: (a) abrir `/api/membresias?activeOnly=true` al Recepcionista con un chequeo dentro del handler
  (afloja RN-06 y expone más datos); (b) `Promise.allSettled` en la página (el recepcionista vería la lista
  pero no podría asignar membresía).
- Las dos matrices de permisos (`authorization.ts`, `role-gating.ts`) se mantienen alineadas por
  `matrix-consistency.test.ts`.

### D-10 · `GET /api/home-interno`: supuestos que la spec no define
- Turnos (hora argentina): **Mañana 06–14, Tarde 14–22, Noche 22–06** (`src/lib/gym-time.ts`).
- Barras de aforo: franjas de **2 h entre 06 y 22** con las entradas `PERMITIDO` de hoy.
- "Activo" = una entrada `PERMITIDO` dentro de `ventanaAforoMinutos` (default 90), porque `Asistencia` **no tiene
  hora de salida**.
- "Baja de socio" = `Usuario` con rol `SOCIO` y `deletedAt` en las últimas 24 h.
- Feed: hasta 50 eventos de las últimas 24 h; un solo recorrido del padrón alimenta "cuotas por vencer" y
  "socios inactivos" (la última cuota y la última asistencia por socio).
- **Verificado**: el endpoint responde `200` contra la base de desarrollo (log de Fernando). **No verificado**: que
  los números coincidan con los datos reales, ni los turnos y franjas contra la operación del gimnasio.

### D-11 · Editar un cliente: escritura anidada atómica — **reemplazada por [D-26](#d-26--editar-un-cliente-transacción-en-vez-de-escritura-anidada)**
- `nombre` y `email` se envían como `usuario: { update: {...} }` **dentro** de `socio.update`: una sola
  sentencia, sin estado intermedio. Solo se envía lo que cambió.
- **Descartado**: dos sentencias dentro de `$transaction` (válido, pero la escritura anidada ya es atómica y no
  necesita transacción explícita).
- Se mantiene `any` en `updateData` porque el input de Prisma no admite mezclar `membresiaAsignadaId` con
  `usuario` anidado; la **guarda dirigida por `schema.prisma`** (ver L-03) cubre los nombres de campos.

### D-12 · Estrategia de verificación y sus límites
- El entorno del asistente **no puede generar el cliente de Prisma** (`binaries.prisma.sh` responde 403), así
  que no hay tipos reales ni base de datos.
- **Compensación**: stub de `@prisma/client` fuera del repo para correr Jest; tests con Prisma simulado que
  fijan qué se consulta; un script que valida cada modelo, campo, relación y valor de enum usado contra
  `schema.prisma` (41 verificaciones en `home-interno-data.ts`: 32 campos/relaciones y 9 valores de enum, todas correctas); y validación real por
  Fernando en su máquina.
- **Consecuencia**: `tsc` en el entorno del asistente reporta unos 14 errores `implicitly any` en
  `home-interno-data.ts` que son un **artefacto** (sin el cliente generado los resultados son `any`). En la
  máquina de Fernando deberían desaparecer: confirmar con `npx tsc --noEmit` (ver [§3](#3-pendientes-abiertos)).

### D-13 · Flujo de trabajo con Git
- Una rama por tarea, creada desde `main` actualizado; PR y merge. Cuando las ramas están encadenadas,
  mergear la última trae todo (historia lineal).
- El asistente entrega parches (`git format-patch`) que se aplican con `git am` sobre `main`; antes de entregar
  se verifica que apliquen en un clon limpio y que la suite pase.
- Conventional Commits con referencia `(T-xxx, PR-xxx)`; los más recientes están en español.

### D-14 · Criterio de lint del checklist TDD
- El ítem "`npm run lint` clean" **no se cumple a nivel repositorio**: hay 115 errores y 41 warnings
  preexistentes en 52 archivos. Se interpreta como **"sin errores nuevos en los archivos tocados"** hasta saldar
  la deuda. Cada PR de este trabajo lo cumplió.

### D-15 · Numeración de PRs y tareas nuevas
- `PR-009-C` estaba asignado en el plan a T-023b (utilidades). Se usó para la API de Home_Interno, así que
  **T-023b pasa a `PR-009-D`**.
- Tareas agregadas durante `apply`: **T-021c** (API de Home_Interno) y **T-026a/b/c** (autenticación, de
  Fernando). El resto de los cambios se registran como defectos (FX) y no como tareas.

### D-16 · Fixture compartido anticipa T-024
- `tests/fixtures/home-interno-data.ts` sirve a los tests de página de T-021a/b. **No reemplaza** a T-024
  (factories de Ejercicio, Rutina, Cliente, Membresía, Usuario), que sigue pendiente.

### D-17 · Política de acceso del proxy: JSON en la API, redirect en las páginas
- **Origen**: Dev 2 (ADR-05). **Contexto**: la spec `rbac-middleware` pedía redirigir sin sesión y un 403 que nombraba
  el rol requerido, lo que contradice su propia propiedad de seguridad ("no filtra requisitos de rol"). Además la UI
  hace `fetch` a `/api/*`: un redirect HTML rompe el `response.json()`.
- **Decisión**: la decisión vive en una función pura, `decideAccess` (`src/lib/access-decision.ts`), con tests;
  `src/proxy.ts` solo la aplica. Orden: autenticación → autorización → rate limit.

| Situación | `/api/*` | Página |
|---|---|---|
| Sin cookie | 401 JSON `UNAUTHENTICATED` | 307 a `/login?from=<ruta>` (la raíz va a `/login` sin `from`) |
| Token inválido/vencido o usuario no `ACTIVO` | 401 JSON `TOKEN_INVALID` | 307 a `/login?from=<ruta>` |
| Rol sin permiso | 403 JSON `FORBIDDEN`, mensaje genérico | Redirect al home del rol (`/home-socio` o `/home-interno`) |
| `/login`, `/api/auth/login`, `/api/auth/logout` | Públicas (evita bucles de redirect) | — |

- **Rate limit**: login 8 por minuto por IP (excedido → 429 `RATE_LIMITED`); resto de la API 100 por minuto por
  usuario, agrupado por ruta base; las páginas no cuentan (los prefetch no deben consumir cuota).
- **Descartado**: responder siempre con redirect (rompe el `fetch`); un 403 que nombre los roles permitidos (filtra
  información); exigir sesión válida para el logout (si la sesión venció no podría limpiar la cookie).
- **Consecuencia**: el proxy consulta la base en cada petición protegida para verificar que el usuario siga `ACTIVO`;
  es lo único que corta el acceso de alguien deshabilitado porque no hay revocación de tokens (P-06, P-11).

### D-18 · Los handlers toman la identidad de la cookie; el Bearer es solo respaldo
- **Origen**: Dev 2 (ADR-07), implementado junto con FX-07. **Contexto**: los handlers solo leían `Authorization:
  Bearer` y el navegador manda la cookie. Además el proxy valida únicamente la cookie: si el handler priorizara el
  header, podría actuar con otra identidad (p. ej. un JWT vigente de un usuario ya desactivado).
- **Decisión**: `authHeaderFromRequest` / `extractUserFromRequest` (`src/lib/auth.ts`): cookie primero, Bearer como
  respaldo, y **nunca** headers `x-user-*` (se eliminaron los que el proxy ponía en la respuesta; ningún handler los
  usaba). Una cookie inválida no cae al Bearer.
- **Descartado**: que el proxy reenvíe la identidad en `x-user-*` (falsificable si un camino se salta el proxy); que
  cada handler valide el JWT con otra fuente.

### D-19 · Sesión en el cliente: `SessionUser`, `AuthProvider` en el layout, logout real
- **Origen**: Dev 2 (ADR-09). **Contexto**: `AuthProvider` usaba el tipo `Usuario` completo (incluye el hash), no
  estaba montado en el layout (`useAuth()` lanza error sin proveedor) y `logout` era un `console.log`.
- **Decisión**: tipo `SessionUser { id, nombre, email, rol }` (nunca viaja el hash); `getSessionUser()` solo en
  servidor (valida firma, expiración, campos y rol); el layout raíz monta `AuthProvider` con `initialUser`
  (`lang="es"`, título "Arnold Gym"); `/` redirige según la sesión; `logout()` llama a `/api/auth/logout` y
  **navega a `/login` aunque falle la red** (con `catch` explícito: un `try/finally` sin `catch` dejaba un rechazo sin
  manejar). La navegación va por `navigateTo()` (envuelve `window.location.assign`) para poder mockearla; el login
  hace una carga completa para que el layout relea la cookie.

### D-20 · Tema claro forzado
- **Origen**: Dev 2 (ADR-10). `globals.css` era el del template y pasaba a fondo `#0a0a0a` con el modo oscuro del
  sistema; el diseño existe solo en claro y la pantalla salía negra. Se eliminó el bloque
  `@media (prefers-color-scheme: dark)` (`200c13b`). **Descartado**: soportar modo oscuro (no hay diseño).

### D-21 · Convenciones de prueba que salieron de T-026
- **Origen**: Dev 2 (ADR-11); refuerza L-05.
1. Los tests de rutas que verifican cookies usan `/** @jest-environment node */` y `jest.unmock('next/server')`:
   `tests/setup.ts` mockea `next/server` globalmente sin cookies.
2. Todo cambio que toque proxy, auth o rutas de API se prueba además con `npm run dev` + `curl`/navegador. Los tests
   con mocks no ven el runtime Edge, ni handlers que ignoran la cookie, ni `params` asíncrono.
3. `npx tsc --noEmit` se corre **después** de haber levantado el servidor de desarrollo: Next genera tipos en
   `.next/dev/types` y ahí aparecen errores que antes no se veían.
4. Un resumen de trabajo ("N tests nuevos", "verifica los flags de la cookie") no se acepta sin la salida real de
   tests, `tsc` y `eslint`.

### D-22 · Una sola matriz de permisos, derivada de RN-06
- **Origen**: Dev 2 (ADR-06). **Contexto**: dos fuentes que se contradecían: `ROLE_PERMISSIONS`
  (`src/lib/authorization.ts`, usada por el proxy) y `ROLE_GATE_MATRIX` (`src/middleware/role-gating.ts`, usada por
  la UI). En la práctica solo el Administrador podía usar la app: no existía `/api/clientes` para otro rol y las
  páginas no estaban definidas (FX-11).
- **Decisión**: la fuente de verdad es `authorization.ts`, con páginas y APIs según los specs de cada CRUD y de los
  homes. `ROLE_GATE_MATRIX` se mantiene alineada (la usa Home_Interno para deshabilitar controles, D-06) y dos tests
  lo garantizan: `matrix-consistency.test.ts` (ambas coinciden) y `rn06-spec.test.ts` (ambas coinciden con los specs).
- **Cambios concretos**: el **Recepcionista pierde Ejercicios** (el spec lo limita a Administrador e Instructor,
  AC-007) y **gana Clientes completo**, incluido DELETE; el **Socio pierde `GET /api/rutinas`** (su rutina llega por
  `/api/home-socio`); se agregan `/home-interno`, `/home-socio`, `/api/home-interno`, `/api/home-socio`,
  `/api/clientes` y las páginas CRUD; `GET /api/membresias/activas` tiene entrada propia por la coincidencia por
  prefijo (D-09).
- **Consecuencia**: los controles finos ("solo el Administrador aprueba un override") se siguen chequeando dentro del
  handler.

### D-23 · Reglas del login y de la cookie de sesión
- **Origen**: Dev 2 (ADR-03 y ADR-08); complementa D-08.
- **Cookie `authToken`**: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=86400`, y `Secure` solo en producción
  (para que funcione en `http://localhost`). JWT de 24 h con `jti` (queda listo para una revocación futura).
  `JWT_SECRET` se lee en tiempo de ejecución y no tiene valor por defecto en producción (FX-10). Logout borra la
  cookie (`Max-Age=0`) y es ruta pública. **Refresh token y revocación se difieren** (propuesta T-027, requiere
  migración; P-06).
- **Login**: el email se normaliza (`trim`, minúsculas) y se excluyen usuarios con `deletedAt`; se compara siempre la
  contraseña (hash falso si el usuario no existe, para igualar tiempos); el **estado de la cuenta se evalúa después de
  la contraseña** (quien no la conoce no descubre qué cuentas están bloqueadas) y cualquier estado distinto de
  `ACTIVO` devuelve `AUTH_DISABLED` (403); mensajes en español con el sobre `{ code, message, recoverable }`.
- **Los Socios también pueden iniciar sesión** (el spec original hablaba solo de personal). La respuesta es
  `{ success: true, role }` y el cliente decide el destino con `homeRouteForRole` (Socio → `/home-socio`, el resto →
  `/home-interno`); el spec original devolvía `{ redirectTo }`.
- **Consecuencia**: un token robado vale hasta 24 h aunque el usuario cierre sesión; lo mitiga la consulta a la base
  del proxy (D-17).

### D-24 · T-026 (login, sesión, proxy, RBAC) se agrega fuera del plan original
- **Origen**: Dev 2 (ADR-02). **Contexto**: el plan tenía utilidades JWT (T-023a) y un middleware de roles (T-022),
  pero ninguna tarea que emitiera una sesión ni una pantalla de login; con el home terminado a nivel UI, ninguna
  pantalla se podía usar con un login real.
- **Decisión**: T-026 en 3 PRs encadenados: PR-011-A (API de login y logout), PR-011-B (página de login, usuario de
  sesión, logout) y PR-011-C (proxy, matriz RBAC unificada, credenciales en handlers). Los arreglos al probar la app
  real fueron commits aparte. **Diferidos**: refresh y revocación (T-027), log de accesos denegados (T-029), `?from=`.
- Refuerza L-07. El reparto de T-021 en PR-009-A1…A3 / B / C1…C3 está en D-01 y D-15.

### D-25 · Alcance documentado de las pantallas de inicio
- **Origen**: Dev 2 (ADR-13). Los límites conscientes están en la cabecera de cada `page.tsx` y resumidos en el plan
  (T-019 y T-021b): botones sin destino, listas filtradas inexistentes, recuperación ante `AGGREGATION_TIMEOUT`,
  indicador "+12% vs ayer" sin fuente de datos y tipos de alerta no definidos en el spec. Home_Socio sigue contra un
  mock (P-05).

### D-26 · Editar un cliente: transacción en vez de escritura anidada
- **Origen**: Dev 2 detectó el problema al revisar el diff; Claude lo confirmó en el código y lo implementó. **Reemplaza
  a D-11.**
- **Problema**: D-11 enviaba `usuario: { update }` (campo de relación) junto con `membresiaAsignadaId` (clave suelta)
  en el mismo `data`. Prisma tipa `update` como `XOR<UpdateInput, UncheckedUpdateInput>` y no deja mezclar ambas
  formas; el `any` de `updateData` silenciaba justo el error del compilador. El caso del formulario completo
  (nombre + email + membresía) quedaba en riesgo. Nada lo detectaba: los tests usan Prisma simulado y la guarda por
  schema solo comprueba que los **nombres** existan en `Socio`.
- **Decisión**: `nombre` y `email` salen de `socio.update`; las dos escrituras van en una
  `prisma.$transaction(async (tx) => …)` (primero `tx.usuario.update`, después `tx.socio.update` con el `include`),
  tipadas con `Prisma.SocioUncheckedUpdateInput` y `Prisma.UsuarioUpdateInput`, **sin `any`**. Solo se escribe lo que
  cambió; el email se normaliza (`trim`, minúsculas) como en el login; `P2002` se traduce a
  `VALIDATION_DUPLICATE_EMAIL`.
- **Descartado**: la escritura anidada con `membresiaAsignada: { connect }` (válida, pero obliga a reescribir el
  armado del `data`); mantener `any` (esconde el error).
- **Tests**: el de atomicidad verifica una sola llamada a `$transaction`; casos nuevos para nombre + membresía sin
  la clave `usuario`, orden usuario → socio, email duplicado y propagación del error. El mock de `$transaction` de
  `src/api/clientes.test.ts` ahora le pasa al callback el Prisma simulado.
- **No verificado**: contra la base real (ver P-21).

### D-27 · `EstadoCuenta` (UI) ↔ `EstadoCuota` (Prisma): mapeo alineado con el enum
- **Origen**: Claude; lo destapó el error `ts(2322)` al quitar el `any` (D-26). El enum de Prisma es
  `AL_DIA | VENCIDA | PENDIENTE`, pero `mapEstadoCuentaToEstadoCuota` devolvía `string` y producía `"VENCIDO"` y
  `"DENEGADO"`, que **no existen**: pasar un cliente a Inactivo o Bloqueado habría fallado en ejecución (FX-14).
- **Decisión**: la función devuelve el tipo literal `"AL_DIA" | "VENCIDA" | "PENDIENTE"` y la inversa se alinea:
  Activo ↔ `AL_DIA`, Inactivo ↔ `VENCIDA`, Bloqueado ↔ `PENDIENTE`.
- **Decisión de negocio sin confirmar**: `Bloqueado → PENDIENTE` es lo más cercano que ofrece el enum, no algo que
  `clientes-crud` defina (supuesto 7 de [§4](#4-supuestos-sin-confirmar)).

### D-28 · Campos numéricos vacíos en el formulario de Rutinas
- **Origen**: Dev 2 (P-17); corregido por Claude. `parseInt("")` daba `NaN` al borrar "Frecuencia Semanal" o
  "Duración Estimada", y el `NaN` quedaba como valor del input.
- **Decisión**: el `onChange` guarda `""` si el campo está vacío y `parseInt(valor, 10)` si no; el valor se convierte
  con `Number()` al validar, así un campo vacío cae en la validación existente ("Debe estar entre 1 y 7" / "Debe ser
  mayor a 0"). Ver FX-15.

### D-29 · `GET /api/home-socio` (T-028, cierra P-05)
- **Origen**: Claude; Fernando pidió empezar por P-05.
- **Decisión**: tres piezas, cada una con su commit: reglas nuevas en `src/domains/home-socio` (`computeProgresoActual`) y
  `toGymWallClock` en `src/lib/gym-time.ts`; `src/api/home-socio-data.ts` arma el payload desde Prisma para UN socio; la ruta
  `src/app/api/home-socio/route.ts` solo autentica y delega.
- **Identidad**: sale siempre de la cookie/Bearer (`extractUserFromRequest`), nunca de la URL: un socio no puede pedir datos
  de otro. Solo rol `SOCIO` (403 para el resto, aunque el Administrador pase el proxy); 404 `SOCIO_NOT_FOUND` si el usuario
  no tiene fila en `Socio`; 500 genérico con el detalle en el log del servidor.
- **Hora del gimnasio**: las funciones de racha/semana usan `getUTC*`; para que "día" signifique día argentino, el builder les
  pasa fechas corridas -3 h (`toGymWallClock`). Sin eso, una entrada a las 22:30 contaría como el día siguiente.
- **AC-005**: el aforo reutiliza `buildAforoHoras` y la misma ventana `ventanaAforoMinutos` que Home_Interno.
- **Supuestos sin confirmar**: ver §4, puntos 8 a 11.
- **Límite conocido**: el footer de máquina de `Tarjeta_Detalle` (RN-05) no tiene datos: `Ejercicio` no se relaciona con
  `Maquina` en el schema. El payload no trae estado de máquina.

### D-30 · Script de seed de desarrollo (cierra P-08)
- **Origen**: Claude; Fernando pidió seguir con P-08 tras T-028.
- **Decisión**: `prisma/seed-data.ts` (lógica, recibe Prisma por parámetro y se prueba con un Prisma simulado en
  `tests/prisma-seed.test.ts`) y `prisma/seed.ts` (runner). Se corre con `npm run seed` (`prisma db seed`, configurado en
  `package.json#prisma.seed`, con `prisma/tsconfig.json` propio para que ts-node use CommonJS en cualquier sistema).
- **Repetible**: usuarios/empleados/socios con `upsert` por clave única; membresías, ejercicios, rutinas, máquinas,
  configuración y regla de progresión solo si faltan; asistencias, progreso, pagos, cuotas y sesiones se borran y recrean
  **solo para los 2 socios del seed** (siempre con filtro `socioId in [...]`), con fechas relativas a "ahora".
- **Seguridad**: se niega a correr con `NODE_ENV=production`; la contraseña se guarda hasheada (bcrypt, 10 rondas, como el
  login); al volver a correr, los usuarios del seed vuelven a quedar ACTIVO y con la contraseña del seed; solo muestra el
  host de `DATABASE_URL`, nunca las credenciales. Todos los emails son `@arnold.test`.
- **Datos**: socio 1 al día con rutina activa, progreso, asistencias y un pago de hoy; socio 2 con la cuota vencida y sin
  visitas recientes (dispara las alertas de Home_Interno). Capacidad 60, ventana de aforo 90 min.
- **No verificado**: no se pudo correr contra una base real (el asistente no puede generar el cliente de Prisma); lo
  cubren los tests con Prisma simulado y la corrida de Fernando.

### D-31 · Robustez del módulo Clientes (cierra P-03 y P-04)
- **Origen**: Claude; Fernando pidió seguir con lo que Claude considerara óptimo.
- **P-04**: `ClienteRepository.create()` crea `Usuario` y `Socio` dentro de un mismo `$transaction` (mismo patrón que `update()`
  y `delete()`): si el Socio falla no queda un `Usuario` huérfano. Un `P2002` (duplicado por carrera) ya no es un 500: se mapea a
  `VALIDATION_DUPLICATE_DNI` o `VALIDATION_DUPLICATE_EMAIL` (400) según el campo (`meta.target`; sin `target` se asume email).
  Antes, un email repetido en el alta daba 500 porque solo se chequeaba el DNI.
- **P-03**: `src/app/clientes/page.tsx` usa `Promise.allSettled`. Si falla solo la carga de membresías, la lista de clientes se ve,
  aparece un aviso (`role="alert"`) y el formulario queda sin poder crear/editar (ya deshabilitaba el botón sin membresías
  activas). Si fallan los clientes se muestra el error de siempre.
- **Test corregido**: `tests/api/clientes.route.test.ts` simulaba `$transaction` pasando un `tx` vacío; ahora el `tx` expone
  `usuario` y `socio`, como el cliente interactivo real.

---

## 2. Registro de defectos corregidos

| ID | Síntoma | Causa raíz | Corrección | Commit | Cómo se detectó |
|---|---|---|---|---|---|
| FX-01 | Total de Caja incorrecto con pagos con tarjeta | `computeCajaHoy` solo sumaba EFECTIVO y TRANSFERENCIA; el schema tiene TARJETA | Bucket `tarjeta` + línea en `CajaCard` | `9cd26c3` | Revisión del schema al armar T-021a |
| FX-02 | Pago de las 21:30 contado en el día siguiente | `esMismoDia` comparaba en UTC | Día calculado en `GYM_TIME_ZONE` | `9cd26c3` | Revisión del dominio de T-020 |
| FX-03 | Instructor veía controles que llevan a `/clientes` y caía en redirección | Los destinos exigen permisos que el rol no tiene | Controles deshabilitados con tooltip (D-06) | `a710f70` | Revisión de la matriz de roles |
| FX-04 | Error de lint `set-state-in-effect` en `home-socio/page.tsx` | `setLoading(true)` redundante dentro del efecto | Se quitó (el estado ya arranca en `true`) | `97fce62` | `eslint` |
| FX-05 | Riesgo: protección de la API caída en ejecución real | `middleware.ts` corre en Edge y usaba Prisma/`jsonwebtoken` | `proxy.ts` en runtime Node (D-07) | `200c13b`, `7bffe52` | Lectura de la documentación de Next 16 |
| FX-06 | Rutas dinámicas rotas en Next 16 | `params` ahora es asíncrono y se leía sincrónicamente | `await params` | `42f9ca2` | Revisión de la rama de T-026c |
| FX-07 | Con login real, las APIs respondían 401 | Los handlers solo leían `Authorization: Bearer` (el cliente lo buscaba en `localStorage`, donde nada escribe) | Cookie con prioridad sobre Bearer | `c604428`, `d986d10`, `b566741` | Lectura de las rutas |
| FX-08 | Recepcionista: Clientes vacío y "Failed to fetch membresias: Forbidden" | `Promise.all` de clientes + membresías; membresías es solo Admin (RN-06) y un 403 tiraba toda la pantalla | `GET /api/membresias/activas` (D-09) | `ebeec5d` | Logs de Fernando (`/api/clientes` 200, membresías 403) |
| FX-09 | Editar un cliente devolvía 500 con cualquier rol, y dejaba datos a medias | `update()` mandaba `nombre` y `email` (columnas de `Usuario`) a `socio.update`; además `usuario.update` corría aparte y antes | Escritura anidada atómica (D-11) + guarda por schema | ver commit `fix(clientes): editar un cliente devolvía 500…` | Logs de Fernando (`PUT /api/clientes/[id]` 500) |
| FX-10 | `JWT_SECRET` caía a una clave pública por defecto | Valor por defecto en el código | Error en producción si falta | `f8118e0` | Revisión de T-026a |
| FX-11 | Solo el Administrador podía usar la app | Dos matrices de permisos que se contradecían; faltaban páginas y `/api/clientes` | Matriz única derivada de RN-06 + tests de consistencia y de specs (D-22) | `e9db89a` | Revisión de T-026 (Dev 2) |
| FX-12 | Pantalla negra con el modo oscuro del sistema | CSS del template de Next | Se quitó el bloque `prefers-color-scheme: dark` (D-20) | `200c13b` | Prueba manual (Dev 2) |
| FX-13 | Editar un cliente cambiando nombre y membresía a la vez seguía en riesgo tras FX-09 | D-11 mezclaba `usuario` anidado con `membresiaAsignadaId`; el `any` ocultaba el error de tipos | `$transaction` con dos escrituras tipadas (D-26) | commit `fix(clientes): …transacción…` (rama `fix/clientes-update-transaccion`) | Revisión del diff por Dev 2 |
| FX-14 | Pasar un cliente a Inactivo/Bloqueado habría fallado: valores fuera del enum | `mapEstadoCuentaToEstadoCuota` devolvía `"VENCIDO"`/`"DENEGADO"`; el enum es `AL_DIA`/`VENCIDA`/`PENDIENTE` | Tipo de retorno literal y mapeo inverso alineado (D-27) | mismo commit que FX-13 | Error `ts(2322)` al quitar el `any` |
| FX-15 | Aviso de React `Received NaN for the value attribute` en el formulario de Rutinas; el campo quedaba en `NaN` al borrarlo | `parseInt("")` en el `onChange` | `""` mientras esté vacío + `Number()` al validar (D-28) | commit `fix(rutinas): evitar NaN…` | Salida de `npm test` (P-17) |
| FX-16 | `ejercicio.test.ts` fallaba por timeout de 5 s en la corrida completa | No mockea Prisma: el primer test abre la conexión real a la base y, con 77 suites en paralelo, tarda más de 5 s | `jest.setTimeout(30000)` en el `describe` (paliativo; la solución de fondo es P-19) | commit `test(ejercicio): subir timeout…` | Salida de `npm test` |

> **FX-09 / FX-13 y datos**: mientras el bug existía, cada intento fallido **sí guardaba** el nuevo nombre y email del
> usuario. Conviene revisar a mano los clientes que se intentaron editar y confirmar que nombre y email sean
> los esperados.

---

## 3. Pendientes abiertos

| # | Pendiente | Severidad | Notas |
|---|---|---|---|
| P-01 | Correr `npx tsc --noEmit` en la máquina del autor | Alta | Confirma que los `implicit any` del asistente eran un artefacto (D-12) |
| P-02 | Contrastar a mano los números de `/api/home-interno` y los turnos/franjas (D-10) | Alta | Responde 200, pero nadie comparó contra datos reales |
| P-03 | ~~La pantalla de Clientes se cae entera si falla el desplegable de membresías~~ | — | **Resuelto** en D-31 |
| P-04 | ~~`ClienteRepository.create()` no es atómico~~ | — | **Resuelto** en D-31 |
| P-05 | ~~`/api/home-socio` no existe~~ | — | **Resuelto** en T-028 / D-29. Falta probarlo con un socio real contra la base (hoy no hay seed, P-08) |
| P-06 | Sin revocación de tokens ni refresh (D-08, D-23) | Media | Requiere migración de `TokenRevocation` (propuesta T-027); el logout solo borra la cookie. Ver también P-20 |
| P-07 | Home_Interno tarda 2–4 s en desarrollo | Media | Los logs muestran 2,1–3,5 s de `application-code` y ~0,4 s por consulta simple en otros endpoints: la base parece tener latencia alta. Son 14 consultas; revisar cuántas pueden fusionarse |
| P-08 | ~~No hay script de seed de usuarios~~ | — | **Resuelto** en D-30 (`npm run seed`). Falta correrlo contra la base real |
| P-09 | El login ignora `?from=` | Baja | El proxy lo envía; la página siempre va al home del rol. Si se implementa, validar que sea una ruta relativa (riesgo de open redirect) |
| P-10 | `/api/auth/register` figura como pública pero la ruta no existe | Baja | Si se crea, nacería sin autenticación |
| P-11 | El proxy consulta la base en cada navegación de página (incluido el prefetch) | Baja | Compromiso aceptado: un usuario deshabilitado queda afuera al instante |
| P-12 | Deuda de lint: 115 errores / 41 warnings en 52 archivos | Baja | Ver D-14 |
| P-13 | T-023b (utilidades) y T-024 (factories) sin hacer | — | Según el plan |
| P-14 | Código muerto: `getAuthHeaders()` en `src/api/clientes.ts` | Baja | Lee `localStorage`, donde nada escribe; el proxy ya no lo necesita |
| P-15 | Registrar accesos denegados y fallos de autenticación en `AuditoriaAcceso` (`ACTION=DENIED`) | Media | Lo piden `rbac-middleware` y `access-audit-logging`; no está implementado (propuesta T-029) |
| P-16 | El rate limit usa `ipAddress` de `@vercel/functions` | Media | Fuera de Vercel devuelve vacío: todos comparten la clave `unknown` y el login queda en 8 intentos por minuto **en total**. Usar `x-forwarded-for` como alternativa o documentar el límite |
| P-17 | ~~Campos numéricos de Rutinas quedan en `NaN` al borrarlos~~ | — | **Resuelto** en FX-15 / D-28 |
| P-18 | Botón de salir en el nav del Socio | Baja | Solo `AdminTopNav` lo tiene |
| P-19 | Tests lentos o ruidosos: avisos `act(...)` (`ejercicios/page.test.tsx`, `cliente-form.test.tsx`), `rutina-form.test.tsx` de 15–20 s y `ejercicio.test.ts`, que usa la base real | Baja | Mockear Prisma en `ejercicio.test.ts` o moverlo a tests de integración (FX-16 es un paliativo) |
| P-20 | Refresh token con rotación | Media | La spec lo pide; hoy el JWT dura 24 h. Se resuelve junto con P-06 (propuesta T-027) |
| P-21 | Probar la edición de clientes contra la base real (nombre + membresía + estado) y confirmar `Bloqueado → PENDIENTE` | Alta | FX-13/FX-14 pasaron tests con Prisma simulado; falta `tsc` y la prueba manual (D-26, D-27) |
| P-22 | Reescribir el spec `authentication-login` con la implementación real | Media | Hoy lleva solo un aviso de revisión (cookie `authToken`, ruta `/login`, `{ success, role }`, refresh diferido); sus escenarios siguen describiendo el diseño original |
| P-23 | Aclarar si el fallo de Edge en `POST /api/auth/login` se reprodujo (D-07) | Baja | Dev 2 lo reporta como reproducido, Fernando como riesgo; falta un log |

---

## 4. Supuestos sin confirmar

Estos puntos los decidió el asistente porque ninguna spec los define. Corregirlos es un cambio de una línea.

1. Límites de turno: Mañana 06–14, Tarde 14–22, Noche 22–06 (`src/lib/gym-time.ts`).
2. Franjas de aforo de 2 h entre 06 y 22.
3. `diasInactividad = 15` por defecto.
4. "Baja de socio" = `deletedAt` de un `Usuario` SOCIO en las últimas 24 h.
5. "Activo" en el aforo = entrada dentro de `ventanaAforoMinutos` (no hay hora de salida).
6. Si el fallo de `middleware.ts` en Edge se reprodujo o solo se identificó por lectura (D-07, P-23).
7. `Bloqueado → PENDIENTE` e `Inactivo → VENCIDA` en el estado de cuota (D-27); lo define el enum, no `clientes-crud`.
8. Progreso (Home_Socio): ejercicio = el del registro más reciente de las últimas 4 semanas; un punto por día con la mayor
   carga; `deltaEsteMes` = último − primero de la ventana (`src/domains/home-socio/home-socio.ts`).
9. Próxima sesión sugerida = marca actual + `incrementoSugerido` de la primera `ReglaDeProgresion` LINEAL, o 2,5 kg si no hay.
10. Sesión en progreso = `SesionDeEntrenamiento` sin `horaFin` iniciada hoy; `indiceActual` siempre 0 (no se guarda en qué
    ejercicio va la sesión).
11. La racha mira hasta 53 semanas de asistencias PERMITIDO del socio (tope).

---

## 5. Lecciones

- **L-01 · Estimar contando lo que falta, no solo lo planificado.** T-021 se subestimó ~4,5× porque el plan no
  asignó cuatro componentes ni la derivación de datos. Antes de dar por buena una estimación, recorrer la
  maqueta (SVG) tarjeta por tarjeta y verificar que cada una tenga dueño.
- **L-02 · Una spec suele chocar con otra.** RN-06 y AC-004 eran incompatibles tal como estaban escritas. Al
  tocar permisos, cruzar siempre la spec del recurso con la de cada pantalla que lo consume.
- **L-03 · Los mocks permisivos esconden desvíos del modelo.** El bug de edición pasó porque los mocks de
  `Socio` tenían `nombre` y `email` (la forma vieja) y `objectContaining` toleraba claves de más. Solución
  general: guardas **dirigidas por `schema.prisma`** que comparan lo que se envía con el modelo real.
- **L-04 · Un ID de PR es un recurso compartido.** `PR-009-C` se asignó dos veces. Reservar el ID en el plan
  antes de usarlo en un commit.
- **L-05 · Los tests unitarios no ejecutan el proxy.** El riesgo de Edge/Node pasó todas las pruebas. Una
  verificación manual de humo (login → pantalla → API) después de tocar autenticación evita sorpresas.
- **L-06 · Los logs del autor son la mejor evidencia.** Los dos defectos de esta etapa (FX-08, FX-09) se
  encontraron leyendo los logs de `next dev`, no los tests.
- **L-07 · Una capa de utilidades no es una funcionalidad.** JWT (T-023a) y la matriz de roles (T-022) no dan un login:
  hizo falta T-026 para emitir la sesión (D-24). Al planificar, cada funcionalidad de punta a punta necesita su tarea.
- **L-08 · Los specs también se desactualizan.** El spec RBAC describía rutas que no existen. Actualizar el spec en
  el mismo PR que se desvía de él, y dejar en `decisions.md` el porqué.
- **L-09 · Un `any` que apaga al compilador esconde el error.** El `any` de D-11 silenciaba justo el aviso de Prisma,
  y al quitarlo apareció además el enum inválido (FX-14). Si un tipo molesta, investigar antes de castear.
- **L-10 · La corrida completa descubre lo que la parcial no.** Los tests de Clientes pasaban en aislado; el timeout
  de `ejercicio.test.ts` solo apareció con las 77 suites en paralelo (FX-16). Correr `npm test` completo antes del PR.
- **L-11 · Cruzar dos registros revela contradicciones.** Al unificar las dos documentaciones apareció la discrepancia
  sobre D-07 y un spec de login sin actualizar (P-22, P-23). Revisar los registros de otros desarrolladores antes de
  dar un tema por cerrado.

---

## 6. Desvíos respecto de los specs (y qué se hizo con ellos)

Origen: Dev 2.

| Tema | Spec original | Implementación | Dónde quedó documentado |
|---|---|---|---|
| Nombre de la cookie | `Authorization` | `authToken` | D-23; `authentication-login` (aviso de revisión) |
| Ruta de login | `/auth/login` | `/login` | `authentication-login`, `rbac-middleware` |
| Roles y estados | `ADMIN`, `ACTIVE/DISABLED`, `password_hash`, `role` | `ADMINISTRADOR`, `ACTIVO/INACTIVO/BLOQUEADO`, `password`, `rol` (manda el esquema Prisma) | ambos specs |
| Quién inicia sesión | Solo personal | También el Socio | D-23 |
| Respuesta del login | `{ redirectTo }` | `{ success, role }`; el cliente decide el destino | D-23, `rbac-middleware` |
| Mensajes de error | Inglés; el 403 nombraba el rol requerido | Español; mensaje genérico | D-17, `rbac-middleware` |
| Rutas de ejemplo | `/recepcion/check-in`, `/admin/*`, `/instructor/*`, `/socio/*`, `/api/audit-logs` | Las reales: `/home-interno`, `/home-socio`, `/ejercicios`, `/rutinas`, `/clientes`, `/membresias` y sus APIs | `rbac-middleware` (reescrito) |
| Redirect sin sesión | 302 | 307 (el que emite Next) | `rbac-middleware` |
| Refresh token y revocación | Requeridos | **Diferidos** (propuesta T-027) | P-06, P-20 |
| Log de accesos denegados | Requerido | **Diferido** (propuesta T-029) | P-15 |
| Estado de cuota en edición | — | Mapeo alineado con el enum de Prisma | D-27 |

---

## 7. Concordancia con el registro ADR

El segundo desarrollador numeraba sus decisiones como ADR-xx. Dónde quedó cada una:

| ADR | Tema | Ahora en |
|---|---|---|
| ADR-01 | Partir T-021 en más capas | D-01, D-15 |
| ADR-02 | T-026 fuera del plan | D-24 |
| ADR-03 | Cookie `authToken` y JWT de 24 h; refresh diferido | D-23, D-08 |
| ADR-04 | `middleware.ts` → `proxy.ts` | D-07, FX-05 (con la discrepancia anotada) |
| ADR-05 | Política de acceso del proxy | D-17 |
| ADR-06 | Una sola matriz de permisos | D-22, D-09, FX-11 |
| ADR-07 | Cookie primero, Bearer de respaldo | D-18, FX-07 |
| ADR-08 | Reglas del login | D-23 |
| ADR-09 | `SessionUser` y `AuthProvider` | D-19 |
| ADR-10 | Tema claro forzado | D-20, FX-12 |
| ADR-11 | Convenciones de testing | D-21, L-05 |
| ADR-12 | `params` es una `Promise` | FX-06 |
| ADR-13 | Alcance de las pantallas de inicio | D-25 |
