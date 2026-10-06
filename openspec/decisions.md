# Registro de decisiones — ARNOLD MVP Core

**Actualizado**: 2026-10-05 · **Plan**: [`sdd-tasks-tdd.md`](./sdd-tasks-tdd.md) · **Estado actual**: [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md)

Este documento registra **por qué** el proyecto se desvió del plan original durante `sdd-apply`, qué
alternativas se descartaron y qué quedó pendiente. El plan dice *qué* se hace; acá queda el *porqué*.

- **Origen**: quién tomó la decisión. "Fernando" = autor del proyecto. "Claude" = propuesta del asistente
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

### D-11 · Editar un cliente: escritura anidada atómica
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

> **FX-09 y datos**: mientras el bug existía, cada intento fallido **sí guardaba** el nuevo nombre y email del
> usuario. Conviene revisar a mano los clientes que se intentaron editar y confirmar que nombre y email sean
> los esperados.

---

## 3. Pendientes abiertos

| # | Pendiente | Severidad | Notas |
|---|---|---|---|
| P-01 | Correr `npx tsc --noEmit` en la máquina del autor | Alta | Confirma que los `implicit any` del asistente eran un artefacto (D-12) |
| P-02 | Contrastar a mano los números de `/api/home-interno` y los turnos/franjas (D-10) | Alta | Responde 200, pero nadie comparó contra datos reales |
| P-03 | La pantalla de Clientes se cae entera si falla el desplegable de membresías | Media | `Promise.all`; usar `Promise.allSettled` con la lista visible y el desplegable deshabilitado con un aviso |
| P-04 | `ClienteRepository.create()` no es atómico | Media | Crea `Usuario` y luego `Socio`; si el segundo falla (p. ej. DNI duplicado en una carrera) queda un `Usuario` huérfano |
| P-05 | `/api/home-socio` no existe | Media | Home_Socio sigue contra datos simulados |
| P-06 | Sin revocación de tokens (D-08) | Media | Requiere migración de `TokenRevocation`; el logout solo borra la cookie |
| P-07 | Home_Interno tarda 2–4 s en desarrollo | Media | Los logs muestran 2,1–3,5 s de `application-code` y ~0,4 s por consulta simple en otros endpoints: la base parece tener latencia alta. Son 14 consultas; revisar cuántas pueden fusionarse |
| P-08 | No hay script de seed de usuarios | Media | Hoy los usuarios se crean a mano |
| P-09 | El login ignora `?from=` | Baja | El proxy lo envía; la página siempre va al home del rol. Si se implementa, validar que sea una ruta relativa (riesgo de open redirect) |
| P-10 | `/api/auth/register` figura como pública pero la ruta no existe | Baja | Si se crea, nacería sin autenticación |
| P-11 | El proxy consulta la base en cada navegación de página (incluido el prefetch) | Baja | Compromiso aceptado: un usuario deshabilitado queda afuera al instante |
| P-12 | Deuda de lint: 115 errores / 41 warnings en 52 archivos | Baja | Ver D-14 |
| P-13 | T-023b (utilidades) y T-024 (factories) sin hacer | — | Según el plan |
| P-14 | Código muerto: `getAuthHeaders()` en `src/api/clientes.ts` | Baja | Lee `localStorage`, donde nada escribe; el proxy ya no lo necesita |

---

## 4. Supuestos sin confirmar

Estos puntos los decidió el asistente porque ninguna spec los define. Corregirlos es un cambio de una línea.

1. Límites de turno: Mañana 06–14, Tarde 14–22, Noche 22–06 (`src/lib/gym-time.ts`).
2. Franjas de aforo de 2 h entre 06 y 22.
3. `diasInactividad = 15` por defecto.
4. "Baja de socio" = `deletedAt` de un `Usuario` SOCIO en las últimas 24 h.
5. "Activo" en el aforo = entrada dentro de `ventanaAforoMinutos` (no hay hora de salida).

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
