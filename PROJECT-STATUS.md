# Arnold — Estado del proyecto

**Actualizado**: 2026-10-25 · **Plan**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md) ·
**Decisiones y defectos**: [`openspec/decisions.md`](openspec/decisions.md) · **Modo**: Strict TDD

Sistema de gestión para un gimnasio. Stack: Next.js 16.2 (Turbopack), React 19, Prisma 6 sobre PostgreSQL, Jest.

## Resumen

- Hechos: los 4 CRUD (Ejercicios, Rutinas, Clientes, Membresías), Home_Socio, **Home_Interno completo (interfaz y API de
  datos)**, y la autenticación (login, logout, proxy con permisos por rol).
- **Todas las tareas del plan original están hechas.** Desde el 2026-10-11 hay una etapa de ampliación (pagos → asistencia → registro de rutina), ver *Ampliación en curso*. T-023b (utilidades de UI) está conectada a las cuatro pantallas CRUD (D-39); T-024 dejó factories en `tests/factories/` que todavía no reemplazan a los mocks viejos (D-38).
- Lo hecho hasta el 2026-10-10 está **verificado** (ver *Qué se verificó y qué no*). Lo del 2026-10-11 (T-023b conectada a las pantallas, T-024) se
  probó en el entorno de Claude; en la máquina de Fernando ya corrieron `npm test`, `npx tsc --noEmit` y `npm run build` (2026-10-16, ver verificación).
- Quedan: el despliegue (P-28: `npm run build` y `npm run start` ya están verificados y el pooler de Supabase **se probó y funciona** —incluidas las transacciones interactivas—, D-35; **falta probarlo en Vercel**) y el proxy consultando
  la base en cada request (P-11, diferido por D-51). El refresh token (P-20) quedó implementado y verificado contra la base (D-57). P-24, P-25 y P-27 ya están cerrados (D-50, D-53 y `a9adb51`).

## Tareas

| Tarea | Qué | Estado |
|---|---|---|
| T-001 | Schema Prisma | ✅ |
| T-022, T-023a | Role gating y auth infra (JWT, DB, rate limit) | ✅ |
| T-002 – T-005 | Ejercicios | ✅ |
| T-025 | Override manual de acceso | ✅ |
| T-006 – T-009 | Rutinas | ✅ |
| T-010 – T-013 | Clientes | ✅ |
| T-014 – T-017 | Membresías | ✅ |
| T-018, T-019 | Home_Socio | ✅ |
| T-028 ➕ | `GET /api/home-socio` (datos reales de Home_Socio) | ✅ sin probar con un socio real (P-05, D-29) |
| T-029 ➕ | Auditoría de accesos: login y accesos denegados en `AuditoriaAcceso` | ✅ verificado contra la base (P-15, D-32) |
| T-027 ➕ | Revocación de tokens en el logout (el refresh se agregó después, D-57) | ✅ verificado contra la base (P-06, D-34) |
| T-030 ➕ | Home_Interno: consultas planas en una sola ronda + `Server-Timing` | ✅ medido contra la base: ~0,4 s fuera de Next (P-07, D-35) |
| T-020 | Home_Interno: componentes base | ✅ |
| T-021a | Home_Interno Parte 1 (acciones, hoy, operación) | ✅ 934 LOC (estimado 250) |
| T-021b | Home_Interno Parte 2 (gestión, actividad) | ✅ 336 LOC (estimado 150) |
| T-021c ➕ | `GET /api/home-interno` | ✅ 505 LOC |
| T-026a/b/c ➕ | Login/logout, página `/login`, proxy + RBAC | ✅ (de Fernando) |
| T-023b | Utilidades de UI (validación, formato, errores de API, notificaciones) | ✅ `PR-009-D`; conectada a las cuatro pantallas CRUD (D-37, D-39) |
| T-024 | Fixtures y factories (`tests/factories/`) | ✅ (D-38) |
| T-031 ➕ | Cuotas mensuales: reglas de cálculo (vence el 10, alta con prorrateo o cuota doble) | ✅ 28 tests; migración aplicada y verificada (P-29); API y pantalla hechas (T-032, T-033; D-40) |
| T-032 ➕ | `POST /api/pagos`: registrar pago (crea `Pago` + `Cuota`) | ✅ (D-40, D-46) |
| T-033 ➕ | Pantalla "Registrar Pago" (`/pagos`) + búsqueda `GET /api/socios?dni=` | ✅ ("Mis pagos" del socio → T-039) |
| T-034 ➕ | Asignar rutina: modal + `/api/rutinas-asignadas` (RN-04: una activa) | ✅ |
| T-035 ➕ | Check-in por DNI + PIN de 4 dígitos (`/acceso`) | ✅ migración aplicada (D-47) |

➕ = agregada durante la ejecución, no estaba en el plan. El detalle de por qué T-021 pasó de 400 a 1.806 LOC y se
partió en 7 PRs está en `decisions.md` (D-01).

## Qué se verificó y qué no

**Verificado con evidencia**
- **Máquina de Fernando (2026-10-16)**: `npm test` con los workers por defecto → `Test Suites: 191 passed` · `Tests: 2410 passed, 2410 total`,
  **5 corridas seguidas sin fallos** (antes de la corrección de FX-22, tres suites del kiosco fallaban de forma intermitente por contención).
  `npm run build` → exit 0 · `Compiled successfully in 9.4s` · `Finished TypeScript in 18.2s` · 45 páginas generadas · sin errores ni warnings
  (Next.js 16.2.12, Turbopack). `npx tsc --noEmit` → exit 0 (ver el gotcha de `.next/dev/types` en *Calidad*).
- **Refresh token contra la base (2026-10-16, `curl` a `npm run dev`, usuario `admin@arnold.test`)**: `POST /api/auth/login` → `200` con
  `authToken` (24 h) y `authRefresh` (30 días); `POST /api/auth/refresh` → `204` y rota (la fila vieja queda con `revokedAt` y `replacedByTokenId`
  apuntando a la nueva); reusar el refresh viejo → `401` y, tras el reuso, **toda la cadena** del usuario queda revocada (4 filas, 4 revocadas,
  0 vigentes; volver a usar la nueva también da `401`). Constantes: `SESSION_TTL_SECONDS` 24 h (`src/api/auth.ts:8`), `REFRESH_TTL_SECONDS` 30 días
  (`src/lib/refresh-token.ts:19`); cookies `authToken`/`authRefresh`. Commit `94089ca`; migración `20261014120000_refresh_token` (aplicada).
- **App de producción contra el pooler de Supabase (2026-10-16)**: se apuntó `DATABASE_URL` a la URL *pooled* (modo transaction, puerto 6543,
  `?pgbouncer=true&connection_limit=1`) tomada de la variable `DATABASE_URL_POOLER` del `.env`, se probó y se restauró el `.env`. Resultados:
  Prisma directo — query simple OK, **transacción interactiva de 2 sentencias OK** y transacción con lectura de modelo OK, así que el landmine
  esperado de pgbouncer (`$transaction(async tx => …)`) **no se dispara**. App de producción (`npm run start`) contra el pooler: `POST /api/auth/login`
  → `200`; `GET /api/home-interno` → `200` en **6,01 s** (1.ª) y **2,40 s** (2.ª), sin errores. Con la conexión directa, la misma medición dio 3,21 s
  la 1.ª y 1,33–1,71 s las siguientes: **el pooler es más lento en local** porque `connection_limit=1` serializa las consultas; su beneficio es la
  **concurrencia en serverless**, no la latencia desde un cliente único. Sigue **sin probarse en Vercel** y la latencia local no representa al despliegue.
- **Migraciones (2026-10-16)**: `npx prisma migrate status` → 15 migraciones, "Database schema is up to date!". Verificado además contra la base:
  `Socio.huellaId` (integer, nullable, único) y `Socio.huellaConsentimientoEn` (timestamp, nullable), tabla `SolicitudDeHuella` (0 filas), enums
  `AccionHuella`/`EstadoSolicitudHuella` e índice único `Socio_huellaId_key` (migración `20261016120000_add_huella_socio`, aplicada).
- Logs de `next dev` de Fernando: login `200`; `/home-interno` y `GET /api/home-interno` `200`; Clientes carga para
  Administrador y Recepcionista; `GET /api/membresias/activas` `200`.
- Tests en la máquina de Fernando (2026-10-10, `npm test`): **91 de 91 suites; 1.197 de 1.198 tests pasan** (1 `todo`). Ver FX-16 y FX-18 en
  `decisions.md` (el `timeout` de FX-16 nunca estuvo en el repo; hoy `ejercicio.test.ts` usa Prisma simulado).
- `npx prisma generate && npx tsc --noEmit` en la máquina de Fernando (2026-10-10): sin errores (cierra P-01).
- `npx prisma migrate status` (2026-10-10): 5 migraciones, el esquema de la base está al día.
- Edición de clientes contra la base (P-21) y Home_Interno contrastado con datos reales (P-02): confirmados por Fernando el 2026-10-10 ("todo ok"; este
  registro no guarda el detalle caso por caso).
- Clientes editados mientras FX-09 estaba abierto (2026-10-11): la consulta de `Usuario` y `Socio` con fechas desfasadas devolvió **0 filas**; no hay
  clientes a medias.
- Auditoría de accesos (2026-10-08, consulta a `AuditoriaAcceso` en Supabase): hay filas `LOGIN/DENY` (`AUTH_INVALID`, con `usuarioId`
  del usuario apuntado o vacío si el email no existe), `LOGIN/ALLOW` y `ACCESS_DENIED/DENY` con `motivo` `GET /clientes` (P-15, D-32).
- Límite de intentos de login (2026-10-08, `curl` contra `npm run dev`): 8 intentos con `401` y el 9.º y 10.º con `429`;
  la pantalla `/login` muestra "Demasiados intentos" solo con el `429` (P-16, D-33).
- Revocación de tokens (2026-10-09, `curl` contra `npm run dev`, con la migración aplicada): con dos tokens distintos de Socio, `GET /api/clientes`
  respondía `403` (sesión válida sin permiso); tras `POST /api/auth/logout` con ese mismo token, el mismo pedido respondió `401 TOKEN_INVALID`
  (P-06, D-34). Se probó el endpoint con `curl`; el botón "Cerrar sesión" del Socio (FX-19) no se probó aparte.
- Los nombres de modelo, campo, relación y enum usados por `/api/home-interno` existen en `schema.prisma` (41 de 41).
- T-023b, primera parte (utilidades y `NotificationProvider`): Fernando la aplicó en `dev` y confirmó "todo ok" el 2026-10-11 (este registro no guarda el
  detalle de qué probó).
- En el entorno de Claude (2026-10-11, con el cliente de Prisma generado pero **sin motor de consultas**): `npx tsc --noEmit` sin errores, y la suite
  completa con 1.306 tests pasando y ninguno fallando. Cuatro suites figuran como "failed to run" solo porque falta el motor de Prisma. Cada patch se
  aplicó en cadena sobre una copia limpia de `dev`. `npx eslint .` da 147 errores y 56 avisos, igual que el 2026-10-10: los cambios del 2026-10-11 no
  sumaron errores de lint.

**No verificado**
- **Los 4 CRUD (Clientes, Ejercicios, Rutinas, Membresías) no se abrieron en un navegador** (T-024 / D-39). `npm test` y `tsc` ya corrieron en la
  máquina de Fernando (2026-10-16), pero la verificación visual de las pantallas queda pendiente y la tiene que hacer Fernando.
- Los avisos de éxito y los mensajes de error nuevos (D-39) **en el navegador**, incluido el `NotificationProvider` montado en `layout.tsx` (D-37).
- Los supuestos de negocio de Home_Interno (turnos, franjas, "activo"; ver *Supuestos*) no están confirmados con el negocio, aunque los números
  se contrastaron con datos reales (P-02).
- `/api/home-socio` y la pantalla del Socio con un socio real del seed (P-05), incluido el botón "Cerrar sesión" del Socio (FX-19).
- El **despliegue en Vercel**: el pooler de Supabase se probó localmente y funciona (ver más arriba), pero falta verificar la aplicación desplegada (P-28, D-35).

## Roles y acceso

Lo decide el proxy con la matriz de `src/lib/authorization.ts`, alineada por test con `src/middleware/role-gating.ts`.

| Rol | Pantallas | API |
|---|---|---|
| **Administrador** | Todo | Todo |
| **Instructor** | Home_Interno, Ejercicios, Rutinas | `ejercicios`, `rutinas` (CRUD), `socios` (lectura), `sesiones` |
| **Recepcionista** | Home_Interno, Clientes | `clientes` (CRUD), `membresias/activas` (solo lectura), `socios`, `pagos`, `cierres` |
| **Socio** | Home_Socio | `home-socio`, `socios` (lectura), `pagos` (lectura), `sesiones` |

Membresías es **solo de Administrador** (RN-06). El Recepcionista únicamente lee las membresías activas para el
desplegable de Clientes (D-09). En Home_Interno, los controles cuyo destino el rol no puede abrir se muestran
deshabilitados con el tooltip "Sin acceso con tu rol" (D-06).

## Antes de seguir

1. ~~`npx tsc --noEmit` en la máquina local~~ → hecho el 2026-10-08, sin errores (P-01). El 2026-10-09 (tras D-35) dio 1 error en el mock de
   `ejercicio.test.ts` (FX-20) y ninguno en el código de la aplicación.
2. ~~**Confirmar que las migraciones están aplicadas**~~ → hecho el 2026-10-10 (5 migraciones al día) y **reconfirmado el 2026-10-16**: `npx prisma
   migrate status` informa **15 migraciones** y el esquema al día, incluidas `20261012235038_sesion_en_curso_y_dispositivo` y `20261016120000_add_huella_socio`.
3. ~~**Editar un cliente** como Administrador y como Recepcionista (nombre, email, teléfono, membresía y estado de cuenta)~~ → hecho, confirmado por
   Fernando el 2026-10-10 (P-21; FX-13, FX-14).
4. ~~**Revisar los clientes que se intentaron editar mientras el error estaba abierto**~~ → hecho el 2026-10-11: la consulta devolvió **0 filas** (FX-09). Se conserva
   como referencia. `usuario.update` corría antes y por separado, y después
   `socio.update` fallaba, así que quedaban guardados el nombre y el email nuevos pero **no** el teléfono, la membresía ni el estado. El rastro es que
   `Usuario.updatedAt` quedó posterior a `Socio.updatedAt`. Consulta (SQL Editor de Supabase; excluye los usuarios del seed):

   ```sql
   select u.nombre, u.email, s.telefono, s."estadoCuota", s."membresiaAsignadaId",
          u."updatedAt" as usuario_modificado, s."updatedAt" as socio_modificado,
          round(extract(epoch from (u."updatedAt" - s."updatedAt"))) as segundos_de_diferencia
   from "Usuario" u join "Socio" s on s."usuarioId" = u.id
   where u."updatedAt" > s."updatedAt" + interval '2 seconds' and u.email not like '%@arnold.test'
   order by u."updatedAt" desc;
   ```

   Cómo leerla: 0 filas → no hay nada que corregir. Una fila con `usuario_modificado` entre 2026-09-22 y el día en que se aplicó la corrección
   (commit del 2026-10-05) es sospechosa: abrir ese cliente en la pantalla de edición y completar teléfono, membresía y estado. El nombre y el email
   originales no se pueden recuperar de la base. Una diferencia posterior a la corrección puede venir de una edición que solo cambió nombre o email.
   Si un cliente se volvió a editar con éxito, ambos `updatedAt` se igualan y ya no deja rastro (los datos quedaron completos).
5. ~~Abrir Home_Interno con datos reales y comparar Aforo, Caja, Personal en turno y Socios inactivos~~ → hecho, confirmado por Fernando el 2026-10-10 (P-02).
6. ~~**Cerrar sesión** y probar que el token queda inútil~~ → hecho el 2026-10-09 con `curl` (P-06). Pasos usados: iniciá sesión, copiá la cookie `authToken` (herramientas del
   navegador → Application/Storage), cerrá sesión con el botón de la barra superior (Socio y personal; FX-19), y repetí un
   pedido a la API con esa cookie (por ejemplo con `curl`): tiene que responder `401` `TOKEN_INVALID` (P-06, D-34).
7. ~~**Medir Home_Interno**~~ → hecho el 2026-10-09 (P-07, D-35): `datos` 0,55–1,55 s, `proxy.ts` 0,6–1,9 s, total 1,2–4,2 s; el contenido
   coincide con el seed. No mejoró de forma evidente (no hay un "antes" comparable); ver D-35.
8. ~~**Medir la base**~~ → hecho el 2026-10-09 (`npm run db:latency`): consulta ≈ 212 ms, 14 a la vez ≈ 203 ms (el pool paraleliza bien), conexión nueva ≈ 2,2 s.
9. ~~**Medir fuera de Next**~~ → hecho el 2026-10-09 (`npm run bench:home-interno`): armado ≈ 405 ms, sesión ≈ 207 ms, primera corrida (en frío) ≈ 2,1 s.
11. **Antes del merge de `dev` a `main`**: `npm test`, `npx tsc --noEmit` y `npm run build` **ya corrieron** en la máquina de Fernando (2026-10-16). Falta
    **abrir las cuatro pantallas CRUD en un navegador** para ver un aviso de éxito (crear, editar, eliminar) y un error de la API (D-37, D-38, D-39).
10. *(opcional)* **Confirmar con el build de producción**: `npm run build` (2026-10-16, exit 0, 45 páginas) y `npm run start` ya se probaron, incluso
    apuntando `DATABASE_URL` al pooler (P-28, D-35); falta confirmarlo **en Vercel**.

## Ampliación en curso

Alcance, hallazgos y orden en D-42; forma de trabajo en D-41 (siempre en `dev`). Decisiones nuevas: **D-46** (P-31), **D-47** (acceso DNI + PIN), **D-48** (registro por serie), **D-49** (secuencia de cierre). El plan de ejecución está en `odd/tasks/ampliacion-mvp.md`.

1. **Pagos y cuotas** (D-40) — ✅ reglas (T-031), ✅ API (T-032), ✅ `/pagos` (T-033), ✅ "Mis pagos" del socio (T-039).
2. **Asignar rutina** (T-034) — ✅ modal + `/api/rutinas-asignadas`.
3. **Check-in por DNI + PIN** (T-035, D-47) — ✅ dominio, API, kiosco `/acceso`, anti-passback, rate limit. Migración de T-035 **aplicada**.
4. **Pantalla de puerta** (T-036, D-47) — ✅ `/puerta` con auth de dispositivo + modelo `Dispositivo` (token hasheado, se muestra una vez). Migración **aplicada**.
5. **Sesión de entrenamiento** (T-037, T-038, D-48) — ✅ `EN_CURSO`, registrar serie con peso/reps/**RIR**, cronómetro por hora guardada, `ultimaCarga` para precargar. Migración **aplicada**.
6. **Secciones del socio** (T-039, D-45) — ✅ Mi rutina, Mis ejercicios, Progreso, Mis pagos, Mis asistencias (ownership server-side).
7. **Cierre de caja** (T-040) — ✅ `/cierres` + totales por método.
8. **Molinete y huella** (T-041, D-49/D-56) — ✅ software: dominio, servicio, endpoints de dispositivo (`/api/dispositivo/...`), ruta de administración, panel en `/clientes` y firmware `.ino` actualizado a las rutas nuevas. La migración `20261016120000_add_huella_socio` quedó **aplicada** (verificado contra la base el 2026-10-16). **Pendiente y sin verificar**: probar con el hardware real (sensor óptico, relé); nada se probó contra el sensor.
9. **Panel de parámetros y oferta de reactivación** (T-043a–c, T-045a–d, D-54) — ✅ completa: lector único de configuración, `GET`/`PUT /api/configuracion` solo para el Administrador con auditoría, pantalla `/configuracion`, migración aplicada, cobro con descuento y vista previa, y avisos en pagos, Home_Interno y Home_Socio. La pantalla de la puerta no la muestra (D-47). **La oferta viene apagada por defecto**: el sistema cobra igual hasta que se active desde el panel.

10. **Tracking del socio** (T-046/T-047/T-048/T-049, D-58 a D-69; ideas de openGym, sin copiar código) — ✅ T-046a "última vez" por ejercicio y precarga de carga. ✅ T-046d progresión automática (D-59): motor de dominio conectado a la API y a la pantalla, con la línea del motivo y la carga sugerida. ✅ T-046b resumen al terminar la sesión (D-62): por ejercicio, lo de hoy contra la última vez (↑ ↓ =) y la próxima carga. ✅ T-046c 1RM estimado y marcas personales (D-63): línea de récord en vivo y marcas nuevas (carga y 1RM, Epley hasta 12 repeticiones) en el resumen. ✅ T-047 tipos de serie (D-64/D-69): backend y pantalla con selector (Normal, Calentamiento, Al fallo, Drop set). El calentamiento no cuenta para métricas; el drop set **no ocupa serie**, no avanza la sesión, no dispara descanso y la progresión lo ignora (P-46 resuelto). ✅ T-048 peso corporal con meta (D-65/D-66): backend (`MedicionDePeso`, meta en `Socio`, `POST /api/peso`, `DELETE /api/peso/[id]` y `PUT /api/peso/meta`) y tarjeta en una cuarta fila del Home con peso actual, variación, meta, gráfico SVG propio, formularios y lista de pesajes recientes con borrado (P-49: confirmar la cuarta fila con el diseño). ✅ T-049 encabezado de la pantalla de entrenamiento (D-67): ejercicio actual, series hechas, tiempo transcurrido y barra de progreso. ✅ Ajustes según openGym: borrar el propio pesaje (P-47, D-68) y el drop set colgado de la serie, sin ocupar una serie de la rutina (P-46, D-69). ⏳ Siguen: músculo primario y secundario con volumen por músculo y mapa corporal, el rediseño de Stats y detalles sueltos (promedio semanal del peso, balance estructural, calculadora de discos). **Migraciones `tipo_de_serie`, `peso_corporal_con_meta` y `catalogo_ejercicios` aplicadas (18/18).** ✅ La tarjeta Progreso del Home usa la sugerencia del motor (P-42, D-60).

11. **Catálogo de ejercicios** (T-050, D-70) — ✅ 1.324 ejercicios importados a la base (1.330 con el seed), con nombre/grupo/equipamiento/músculos/instrucciones en español y media optimizada (1.324 mp4 + 1.324 jpg). Backend: `datasetId`, campos del catálogo, `GET /api/ejercicios/:id`, listado liviano. UI: miniaturas, video, detalle con instrucciones, filtros por grupo/equipamiento y paginación; las tarjetas del socio muestran la animación. Atribución © Gym visual (P-50). Migración `20261019120000_catalogo_ejercicios` aplicada.

12. **Músculos por ejercicio** (T-051, D-71; idea 7 de openGym) — 🔄 Parte 1 hecha: los **47 términos de músculos del catálogo** se reducen a **18 músculos que se pueden dibujar**, con el objetivo en 1 y los secundarios en 0,4, un respaldo por grupo muscular para los ejercicios sin músculos y el cardio sin sumar. Dominio puro, **sin migración**, probado contra los 1.324 ejercicios reales. ⏳ Siguen: volumen semanal desde el historial, mapa corporal en SVG y el rediseño de Stats (pestañas Balance muscular, Fatiga y Fuerza).

13. **Modal de ejercicios de la rutina** (T-052, D-72) — ✅ preparado para el catálogo de 1.330: búsqueda sin tildes y por varias palabras (nombre, grupo, equipamiento y músculo), filtros por grupo y equipamiento, de a 50 con "Ver más ejercicios", miniaturas con la atribución de la media y lo tildado que se conserva. Cancelar y Escape dejan el modal limpio. Sin migración.

14. **CRUD de máquinas** (T-053a–T-053n, D-73) — ✅ Etapa 1 de "asignación dinámica de ejercicios": `/api/maquinas` y `/api/maquinas/[id]` más la pantalla `/maquinas`, todo ADMINISTRADOR-only, con unicidad en dos capas (índice único y pre-consulta con `unaccent`), estados asignables (solo `DISPONIBLE`, `FUERA_DE_SERVICIO` e `INACTIVA`), auditoría y seed ("Polea alta" pasa a `DISPONIBLE`). La migración `20261023120000_maquina_nombre_ubicacion_unique` quedó **aplicada** (`migrate status`: 19/19), el índice `Maquina_nombre_ubicacion_key` **verificado** con `pg_indexes` y el smoke de 15 pasos dio verde; la pantalla la probó Fernando en el navegador. **No incluye** las asociaciones Ejercicio↔Maquina ni la fila expandida: eso es Etapa 2.

15. **Asignación de ejercicios a máquinas** (T-054a–T-054r, D-74) — ✅ Etapa 2 de "asignación dinámica de ejercicios": M2M explícito `EjercicioMaquina` (único compuesto `[maquinaId, ejercicioId]`, `onDelete: Cascade` en ambos lados), `GET`/`PUT /api/maquinas/[id]/ejercicios` (reemplazo total, solo ADMINISTRADOR, auditoría `MODIFICACION` best-effort), conteo real de asociaciones en la baja de máquina (409 `DELETE_BLOCKED_EJERCICIOS`), paginación opt-in en `GET /api/ejercicios` (`limit` 1–50, defaults 20/0 solo cuando la paginación está activa), fila expandida (carga diferida, loading/vacío/error+retry) y modal accesible de asignación (búsqueda debounced sin tildes, página de 50, "Ver más" solo si la última página vino completa, selección que persiste entre páginas y búsquedas —incluidos los asignados fuera de página—, "N seleccionados", `PUT` de reemplazo total, aviso de éxito y refresco), filtro por grupo muscular y selección/quita de visibles con tope de 100, y `MAX_EJERCICIOS_POR_MAQUINA = 100` con el mensaje interpolado desde la constante. La migración `20261024120000_ejercicio_maquina` quedó **aplicada** (`migrate status`: 20/20). **No incluye** el motor de espera/sugerencia (Etapa 3).

Estado: **todas las tareas de código de la ampliación están hechas** (T-032…T-054) y **las 20 migraciones están aplicadas** (incluidas `tipo_de_serie`, `peso_corporal_con_meta`, `catalogo_ejercicios`, `maquina_nombre_ubicacion_unique` y `ejercicio_maquina`; `npx prisma migrate status`: esquema al día). El catálogo tiene **1.324 ejercicios importados** (1.330 con el seed) y **1.324 pares de media**. Falta probar el tracking y el catálogo en el navegador y, la huella, con el hardware real.

Sugeridos y sin confirmar: usuarios internos y cambio de contraseña (T-042, T-044). La configuración (T-043) quedó confirmada en D-54, sin la parte de máquinas. El refresh token (P-20) ya está hecho (D-57); el despliegue (P-28) avanzó: el pooler de Supabase **se probó y funciona en local** (incluidas las transacciones interactivas) y `npm run build`/`npm run start` están verificados; **falta probarlo en Vercel** (D-35).

## Pendientes principales

Lista completa con severidad en [`decisions.md` §3](openspec/decisions.md#3-pendientes-abiertos).

| # | Pendiente | Severidad |
|---|---|---|
| P-01 | ~~`tsc` local~~ → resuelto (2026-10-08, sin errores) | Baja |
| P-02 | ~~Contrastar Home_Interno con datos reales~~ → resuelto (2026-10-10); los supuestos de turnos y franjas siguen sin confirmar con el negocio | Baja |
| P-03 | ~~Clientes se cae entero si falla el desplegable de membresías~~ → resuelto (D-31) | Baja |
| P-04 | ~~`ClienteRepository.create()` no es atómico~~ → resuelto (D-31) | Baja |
| P-05 | ~~`/api/home-socio` no existe~~ → resuelto (T-028); falta probarlo con un socio real del seed (`socio1@arnold.test`) | Baja |
| P-06 | ~~Sin revocación de tokens~~ → resuelto y verificado (T-027, D-34) | Baja |
| P-07 | ~~Home_Interno tarda 2–4 s en desarrollo~~ → cerrado (D-35): fuera de Next el armado tarda ~0,4 s y la sesión ~0,2 s; el resto es del servidor de desarrollo. Pendiente aparte: el pooler de Supabase para el despliegue (ya probado en local: funciona; falta Vercel) | Baja |
| P-08 | ~~No hay script de seed de usuarios~~ → resuelto y verificado (`npm run seed`, D-30; Fernando lo corrió y Home_Interno coincide con el seed, D-35) | Baja |
| P-09 | ~~El login ignora `?from=`~~ → resuelto: `postLoginRoute`/`safeRedirectTarget` en `src/lib/login-redirect.ts` (rechaza `//host`, backslashes y caracteres de control); lo usa `src/app/login/page.tsx` | — |
| P-15 | ~~Accesos denegados sin registrar en `AuditoriaAcceso`~~ → resuelto y verificado (T-029, D-32) | Baja |
| P-16 | ~~Rate limit del login: fuera de Vercel todos comparten la IP `unknown`~~ → resuelto y verificado (D-33, opt-in `TRUST_PROXY_HEADERS`) | Baja |
| P-18 | ~~El nav del Socio no tiene botón de salir~~ → resuelto: `logout` de `useAuth()` cableado a `onLogoutClick` del `TopNav` (`src/components/home-socio/socio-shell.tsx`) | — |
| P-20 | ~~Refresh token con rotación~~ → **resuelto y verificado contra la base (2026-10-16)**: rotación + detección de reuso; commit `94089ca`, migración `20261014120000_refresh_token` aplicada (D-57) | — |
| P-21 | ~~Probar la edición de clientes contra la base~~ → resuelto (2026-10-10) | Baja |
| P-22 | ~~Reescribir el spec `authentication-login`~~ → resuelto (D-36) | Baja |
| P-26 | ~~`useMemo` después de `return` tempranos en Clientes~~ → resuelto (2026-10-13, `a9adb51`) | — |
| P-27 | ~~Errores de `eslint` en paneles de Membresías y `any`~~ → resuelto (2026-10-13, `a9adb51`) | — |
| P-28 | Despliegue: evaluar el pooler de Supabase con esta aplicación y confirmar `npm run build` / `npm run start` (D-35) → **casi cerrado**: `npm run build` ✅ y `npm run start` ✅ (2026-10-16, exit 0) y el **pooler ✅ probado** (funciona, incluidas las transacciones interactivas; en local es **más lento** por `connection_limit=1`, que serializa las consultas). **Falta probarlo en Vercel**, donde el comportamiento puede diferir | Media |
| P-29 | ~~Aplicar y verificar la migración `20261011120000_add_cuota_membresia_y_dias_de_pago`~~ → aplicada por Fernando (2026-10-12); SQL coincide con `schema.prisma` | — |
| P-30 | Elegir hardware de molinete y huella y confirmar lo legal de datos biométricos → **el software de la huella está implementado (T-041, D-56) y la migración `add_huella_socio` está aplicada**; falta elegir/probar el hardware real (sensor óptico, relé) y confirmar lo legal | Baja |
| P-31 | ~~Qué hace el registro de pagos con `Socio.estadoCuota`~~ → resuelto (D-46): la columna es estado de cuenta; el pago se calcula | — |
| P-32 | Confirmar con el negocio la política de cobro (pago tardío, reingreso, día de corte) | Baja |
| P-33 | Parámetros del control de acceso (anti-passback, PIN olvidado) → decidido DNI + PIN en D-47; quedan valores por defecto (anti-passback 60 min) | Baja |
| P-34 | ~~Registro de rutina por serie o por ejercicio~~ → resuelto (D-48): por serie, con RIR | — |
| P-35 | ~~`README` dice "una rama por tarea"~~ → resuelto (2026-10-13, `a9adb51`) | — |
| P-36 | ~~`.patch` sueltos en la raíz del repo~~ → **resuelto**: no quedan `.patch` (`ls *.patch` no encuentra ninguno) y `.gitignore` ya los ignora con un comentario que cita P-36 | — |
| P-24 | ~~Completar los estados de `EstadoCuota` (por alcance solo `INACTIVA` y `BLOQUEADA`, D-27)~~ → **resuelto (D-50)**: el enum queda en `AL_DIA`/`INACTIVA`/`BLOQUEADA` (estado de la cuenta) y el pago se calcula | — |
| P-25 | ~~Tests de integración del repositorio de Ejercicio contra una base de pruebas (FX-16 lo pasó a Prisma simulado)~~ → **resuelto (D-53)**: Postgres efímero en Docker + `npm run test:integration`; `npm test` sigue sin Docker | — |
| P-37 | ~~`scripts/test-integration.mjs` puede declarar "Postgres listo" durante el `initdb` (socket unix vs TCP)~~ → **resuelto**: el gate fuerza TCP; carrera reproducida (1/88 muestras) | — |
| P-38 | ~~`npm run test:integration --keep` reusa cualquier container con el nombre esperado, sin validarlo~~ → **resuelto**: valida imagen/base/puerto y recrea si no coincide | — |
| P-39 | ~~No existe un flujo para anular un pago~~ → **resuelto (2026-10-15)**: `POST /api/pagos/{id}/anular`, con motivo obligatorio, auditado y disponible para Administrador y Recepcionista. Anular deja el `Pago` en `ANULADO`, **borra la `Cuota`** (el sistema vuelve a pedir ese período) y **no devuelve la oferta**. | — |
| P-40 | ~~Confirmar con el negocio los valores de la oferta de reactivación (D-54)~~ → **resuelto (2026-10-15)**: Fernando confirmó la propuesta básica — 30 días sin asistir, 180 de enfriamiento y tope del 50 %—; son configurables desde `/configuracion`, así que el negocio los ajusta sin tocar código | — |
| P-42 | ~~La tarjeta Progreso de Home calculaba su propia "próxima sesión sugerida" (marca + incremento) y podía contradecir al motor de progresión (D-59)~~ → **resuelto (D-60)**: la tarjeta muestra la sugerencia del motor (`seguimientoDeEjercicios`), la misma de la pantalla de entrenamiento. (Se había registrado como P-41, ID que ya existía en `decisions.md`: se renumeró.) | — |
| P-43 | ~~Editar una rutina borraba y recreaba TODAS sus filas de `EjercicioEnRutina` y reiniciaba el motor de progresión (D-59) en todos sus ejercicios~~ → **resuelto (D-61)**: se guarda solo lo que cambió (diff por `ejercicioId`) y `updatedAt` pasa a significar "último cambio de series o repeticiones". Las rutinas editadas antes siguen con el `updatedAt` viejo | — |
| P-44 | Marcas personales (D-63): Arnold no distingue los ejercicios asistidos (la carga es la ayuda) y cada resumen y cada inicio de sesión leen todas las series con carga de cada ejercicio; si el historial crece mucho, guardar los mejores | Baja |
| P-45 | ~~Aplicar a la base real las migraciones `20261018120000_tipo_de_serie` (D-64) y `20261018180000_peso_corporal_con_meta` (D-65), escritas a mano~~ → **resuelto (2026-10-19)**: `npx prisma migrate deploy` aplicó las dos; `migrate status` da **17/17 al día** y `migrate diff` contra el schema, **0 diferencias**. Antes se habían verificado desde cero en un Postgres 17 efímero | — |
| P-46 | ~~Confirmar la regla del drop set en el motor (D-64)~~ → **resuelto (D-69, 2026-10-20)**: siguiendo a openGym, el drop set cuelga de la serie, no ocupa una serie de la rutina, no mueve la sesión ni tiene descanso propio y el motor lo ignora | — |
| P-47 | ~~Peso corporal (D-65): un pesaje no se puede corregir ni borrar~~ → **resuelto (D-68, 2026-10-20)**: `DELETE /api/peso/[id]` borra un pesaje propio; la tarjeta lista los 3 más recientes con un toque. La fecha sigue siendo "ahora" y el valor no se corrige: se borra y se vuelve a pesar | — |
| P-48 | ~~Peso corporal (D-65): confirmar si el instructor debe poder verlo o cargarlo~~ → **resuelto (2026-10-20)**: se mantiene **privado**, como openGym (el peso nunca se comparte con nombre). Si el negocio quiere que lo vea el instructor, que lo decida el socio con un permiso explícito | — |
| P-49 | La cuarta fila del Home (peso corporal, D-66) no estaba en el diseño original: confirmar con el diseño de Home_Socio dónde va y cómo se ve (hoy, una tarjeta de ancho completo debajo de Racha y Membresía) | Baja |
| P-50 | Catálogo de ejercicios (T-050, D-70): la media es © Gym visual (fuera de la MIT). Mostrar la atribución donde aparezca, mantener 180×180 y mencionarlo en el informe. La migración ya está aplicada y el catálogo importado | Media |
| P-51 | ~~Catálogo (T-050, D-70): las instrucciones en español del dataset están en español de España (“Túmbate”, “suelo”); se usan tal cual~~ → **resuelto (T-050g, 2026-10-21)**: se pasan a español rioplatense al generar el catálogo (voseo y vocabulario), con un conversor por reglas y tests | Baja |
| P-52 | ~~Agregar ejercicios a una rutina con el catálogo de 1.330: el modal buscaba solo por nombre, distinguía tildes y dibujaba los 1.330 de una vez~~ → **resuelto (T-052, D-72)**: búsqueda sin tildes y por palabras, filtros por grupo y equipamiento, de a 50 y miniaturas | — |
| P-53 | Máquinas (D-73): `INACTIVA` cuenta en el total de "Estado de equipos" de Home_Interno (AC-005), así que borrar máquinas baja el porcentaje. Revisar cuando cierre la feature; Home_Interno no se tocó | Baja |
| P-54 | Máquinas (D-73): `EstadoMaquina` está duplicado como uniones literales en `src/domains/home-interno/home-interno.ts` y `src/components/home-socio/tarjeta-detalle.tsx`; el código nuevo importa el tipo de Prisma. Consolidación diferida | Baja |
| P-55 | Máquinas (D-73): `POST`, `GET` (por id) y `PUT` devuelven un campo `status` dentro del JSON del recurso (`{ ...maquina, status }`), igual que Membresías; el estado HTTP debería ser la única fuente. No se corrigió en esta feature | Baja |
| P-56 | Máquinas (D-73): una actualización y un borrado simultáneos pueden chocar en un P2025 de Prisma que hoy sale como 500; mapearlo a 404/409 | Baja |
| P-57 | ESLint falla en `dev` por `Date.now()` durante el render en `src/app/home-socio/page.tsx:129` (`react-hooks/purity`); es preexistente de `f4d1ac2` y no se corrigió en esta feature | Baja |
| P-58 | El conteo `enMaquinas` en el listado de ejercicios quedó diferido (pregunta Q3 de la propuesta / open question del diseño) | Baja |
| P-59 | `MAX_EJERCICIOS_POR_MAQUINA` como parámetro en tiempo de ejecución de `/configuracion` quedó diferido; sigue siendo una constante dura | Baja |

## Cambios recientes (2026-10-07 al 2026-10-25)

- **Asignación de ejercicios a máquinas (T-054a–T-054r, D-74)**: cierre de la Etapa 2 de "asignación dinámica de ejercicios". `EjercicioMaquina` como M2M explícito (único compuesto `[maquinaId, ejercicioId]`, `onDelete: Cascade` en ambos lados), `GET`/`PUT /api/maquinas/[id]/ejercicios` (reemplazo total, solo ADMINISTRADOR, auditoría `MODIFICACION` best-effort), el conteo real de asociaciones en la baja de máquina (409 `DELETE_BLOCKED_EJERCICIOS`; 0 conserva el borrado físico) y paginación opt-in en `GET /api/ejercicios` (`limit` 1–50, defaults 20/0 solo cuando la paginación está activa). En `/maquinas`, fila expandida con carga diferida (loading/vacío/error+retry) y modal accesible de asignación (búsqueda debounced sin tildes, página de 50, "Ver más" solo si la última página vino completa, selección persistente entre páginas y búsquedas —incluidos los asignados fuera de página—, "N seleccionados", PUT de reemplazo total, aviso de éxito y refresco). `MAX_EJERCICIOS_POR_MAQUINA = 100` con el mensaje interpolado desde la constante; el orden de validación es duplicados → máximo → inexistentes, con el pre-chequeo temprano antes de `obtenerEjerciciosExistentes` y `getById` primero para que una máquina inexistente sea 404. **Verificado**: migración `20261024120000_ejercicio_maquina` **aplicada** en Supabase por Fernando el 2026-10-25 (`migrate status` 20/20) y **243 suites / 3502 tests** unitarios en verde (`npm test`). La suite de integración la corrió Fernando; la pantalla la probó en el navegador y CP3 quedó aprobado por el revisor externo. Quedan P-57 (ESLint preexistente en `dev`), P-58 (`enMaquinas` diferido), P-59 (`MAX` como parámetro de `/configuracion`, diferido) y P-60 (asignación automática/sugerida de ejercicios a máquinas, idea futura).

- **CRUD de máquinas (T-053a–T-053n, D-73)**: admin-only `/api/maquinas` + `/api/maquinas/[id]` y pantalla `/maquinas`, cierre de la Etapa 1 de "asignación dinámica de ejercicios". Unicidad en dos capas: índice único `lower(btrim(nombre)), lower(btrim(ubicacion))` (migración `20261023120000_maquina_nombre_ubicacion_unique`, **aplicada**: `migrate status` 19/19; índice `Maquina_nombre_ubicacion_key` **verificado** con `pg_indexes`) más pre-consulta del repositorio con `unaccent(lower(btrim(...)))` que devuelve `DUPLICATE_NOMBRE_UBICACION`; `P2002` se mapea al mismo código. Solo se escriben `DISPONIBLE`, `FUERA_DE_SERVICIO` e `INACTIVA`; `OCUPADA` se rechaza con 400 `ESTADO_NO_ASIGNABLE`. Auditoría con ALTA/MODIFICACION/BAJA y seed de "Polea alta" a `DISPONIBLE`. Tests: **240 suites / 3382** en verde (`npm test`); la integración dio **26/26** aparte, contra el Postgres de Docker. El smoke de 15 pasos y la pantalla los verificó Fernando (backend y pantalla aprobados). Las asociaciones Ejercicio↔Maquina y la fila expandida son Etapa 2.

- **Rutinas: el modal de ejercicios sirve para el catálogo (T-052, D-72)**: al agregar ejercicios a una rutina se busca sin distinguir tildes y por varias palabras, se filtra por grupo y equipamiento, se ve la miniatura de cada ejercicio y se muestran de a 50. Lo tildado se conserva al cambiar la búsqueda y cancelar ya no lo arrastra. Sin migración ni cambios en la API.
- **Músculos por ejercicio, parte 1 (T-051, D-71)**: `src/domains/ejercicio/musculos.ts` reduce los 47 términos de músculos del catálogo a 18 músculos dibujables, con peso 1 para el objetivo y 0,4 para cada secundario; los ejercicios sin músculos usan su grupo muscular y el cardio nunca suma. Es la base del volumen por músculo y del mapa corporal. Sin migración ni cambios en la API.
- **Catálogo de ejercicios (T-050, D-70)**: se importaron los **1.324 ejercicios** del dataset `hasaneyldrm/exercises-dataset` en español (1.330 con el seed). El schema suma `datasetId`, `equipamiento`, `musculoObjetivo`, `musculosSecundarios`, `instrucciones` y `mediaId`; la migración `20261019120000_catalogo_ejercicios` quedó aplicada y el importador es idempotente (`npm run catalogo:importar`, con `--dry-run`). La media se convirtió de GIF a **mp4 + jpg** (122,8 MB → 16,5 MB) en `public/ejercicios/` (1.324 pares), y los mp4 no pasan por el proxy. UI: miniaturas y video, panel de detalle con instrucciones, filtros por grupo/equipamiento y paginación en el listado; las tarjetas del socio muestran la animación. Atribución © Gym visual (P-50). Tests: 224 suites / 3.052; `tsc` y `build` en verde.


- **Tracking: el drop set cuelga de la serie (P-46, D-69)**: como en openGym, el drop set no es una serie nueva: se agrega a la serie que se registra ("Agregar drop set", con un 20 % menos de carga),
  viaja con ella en una sola petición, no mueve la sesión ni tiene descanso propio y la progresión lo ignora. El selector de tipo vuelve a tener tres botones. `POST /api/sesiones/[id]/series` acepta `drops`
  (hasta 5) y `DROP_SET` ya no es un tipo válido. Sin migración nueva.

- **Peso corporal: borrar el propio pesaje (P-47, D-68)**: la tarjeta lista los 3 pesajes más recientes con un botón para borrar cada uno. `DELETE /api/peso/[id]` (solo el socio, solo lo propio).
  `GET /api/home-socio` cambia `peso.puntos` por `peso.mediciones` (los pesajes con su id). Sin migración.


- **Tracking: encabezado de la pantalla de entrenamiento (T-049, D-67)**: arriba de la serie en curso se ve "Ejercicio 2 de 6", "12:34 · 7/19 series" y una barra de progreso. Todo se deriva de la
  posición de la sesión (sin contadores guardados); el calentamiento no cuenta. El reloj de la pantalla ahora corre durante toda la sesión y no solo en el descanso. Sin migración ni cambios en la API.


- **Tracking: peso corporal en el Home (T-048 parte 2, D-66)**: tarjeta "Peso corporal" en una cuarta fila del Home con el peso actual, cuánto cambió desde el pesaje anterior, la meta
  ("te faltan 1,4 kg" o "¡alcanzada!"), un gráfico de línea en SVG propio con la meta punteada y dos formularios (registrar peso y fijar, cambiar o quitar la meta). Acepta coma o punto y ataja
  el error de tipeo (20–400 kg). Suma "Pesajes recientes" con borrado de un pesaje propio y confirmación (`DELETE /api/peso/[id]`). `GET /api/home-socio` suma `peso` con `puntos` y `recientes`.
  Sin migración nueva. P-49: la cuarta fila no estaba en el diseño original.

- **Tracking: el drop set no ocupa serie (P-46 resuelto, D-64)**: el drop set ahora cuelga de la serie anterior, se guarda sin `numeroSerie`, no avanza la sesión, no dispara el descanso
  largo y la progresión lo ignora por completo. `leerSesion` ya no descuenta drops de las series de trabajo. Cambian el servidor, el motor (con sus tests) y la pantalla.


- **Tracking: peso corporal con meta, backend (T-048 parte 1, D-65)**: `MedicionDePeso` (un pesaje por fila) y, en `Socio`, la meta de peso junto con el peso desde el que se fijó, para saber si el
  objetivo era bajar o subir. `POST /api/peso` y `PUT /api/peso/meta`, solo para el socio y siempre sobre sus propios datos. Rango de 20 a 400 kg. **Migración aplicada el 2026-10-19** (P-45). Todavía sin
  tarjeta en Home (parte 2).

- **Tracking: tipos de serie, pantalla (T-047 parte 2, D-64)**: la pantalla de ejecución tiene un selector de tipo (Normal, Calentamiento, Al fallo, Drop set) que vale para una serie. El calentamiento
  no avanza la serie y se cuenta aparte; "Al fallo" pone el RIR en 0. El motor no juzga el drop set contra las repeticiones objetivo (ocupa una serie), el resumen no lo cuenta como mejora y la última
  vez y el resumen muestran "al fallo" y "drop set". Sin migración nueva (la de la parte 1 quedó aplicada el 2026-10-19).

- **Tracking: tipos de serie, backend (T-047 parte 1, D-64)**: `RegistroDeProgreso.tipo` (NORMAL, CALENTAMIENTO, HASTA_EL_FALLO, DROP_SET) con migración. Un calentamiento se
  guarda sin número de serie y sin mover la sesión, y no cuenta para la última vez, la progresión, las marcas, la carga que se precarga ni el progreso de Home. La ruta
  de series acepta `tipo` (inválido = 400). **Migración aplicada el 2026-10-19** (P-45).

- **Tracking: 1RM estimado y marcas personales (T-046c, D-63)**: mientras se elige el peso de la serie, una línea muestra el récord de repeticiones a superar con esa
  carga o más (o avisa si esa carga supera la mejor marca); al terminar la rutina, cada ejercicio anuncia si hoy se batió la marca de carga o la de 1RM estimado
  (Epley, hasta 12 repeticiones, redondeado a 0,5 kg), contra todo el historial anterior. `GET /api/sesiones?enCurso=1` y `POST /api/sesiones` suman `records`. Sin migración.

- **Tracking: resumen al terminar la sesión (T-046b, D-62)**: al terminar la rutina, la pantalla muestra una tarjeta por ejercicio con lo de hoy, la
  tendencia contra la última vez (↑ ↓ =) y la próxima carga, que sale del mismo motor que arma la sesión siguiente (anticipa incluso una descarga).
  Si el resumen falla, igual se muestra que la rutina terminó. `GET /api/sesiones/[id]/resumen`; sin migración.

- **Rutinas: guardar toca solo lo que cambió (P-43, D-61)**: editar una rutina ya no reinicia la progresión de todos sus ejercicios; solo la de los
  que cambiaron de series o repeticiones. Reordenar o cambiar descansos conserva el `updatedAt`. Sin migración (solo un comentario en el schema).

- **Tracking: el Home usa la sugerencia del motor (P-42, D-60)**: la tarjeta "Mi progreso" ya no calcula "marca + incremento": muestra lo que dice el motor para ese ejercicio (sube, mantené o bajá, con el motivo), la misma que la pantalla de entrenamiento. `GET /api/home-socio` cambia `progreso.proximaSesionSugerida` por `progreso.sugerencia`. Sin migración.

- **Tracking: progresión automática (T-046d, D-59)**: la pantalla de ejecución sugiere la carga de hoy y dice por qué (sube si la última
  vez hizo todas las repeticiones, mantiene si falló, descarga 10 % tras 3 sesiones seguidas con fallos) y la precarga. Ignora las
  sesiones anteriores a un cambio de plan de la rutina. Sin migración: se deriva de `RegistroDeProgreso`. Las respuestas de
  `GET /api/sesiones?enCurso=1` y `POST /api/sesiones` suman `sugerencias`.

- **Tracking: "última vez" por ejercicio (T-046a, D-58)**: la pantalla de ejecución muestra las series de la sesión anterior del
  ejercicio actual y precarga la carga de la serie equivalente. Sin migración: se deriva de `RegistroDeProgreso`. La API de
  `GET /api/sesiones?enCurso=1` y `POST /api/sesiones` suma el campo `ultimasVeces`.

- **Mejoras de UI (commit `03fc721`)**: `ConfirmDialog` reutilizable (`src/components/ui/confirm-dialog.tsx`, reusa `useModalA11y`, con
  variante destructiva y bloqueo durante la operación) reemplaza el `window.confirm` en Ejercicios, Rutinas, Clientes y Membresías;
  Ejercicios expone `enRutinas` (aditivo, vía `_count`) y su tabla muestra "En N rutinas" / "—", y **el borrado se bloquea desde la UI** con
  "Este ejercicio está en N rutina(s); no se puede eliminar." (el backend ya devolvía 409 `DELETE_BLOCKED_ASSIGNED`, AC-006); y `/configuracion`
  pasa a tener pestañas (Parámetros / Dispositivos) reutilizando `DispositivosPanel` (`src/components/dispositivos/dispositivos-panel.tsx`) —
  `/dispositivos` sigue existiendo y usa el mismo panel—, se quitó el ítem "Dispositivos" del `admin-top-nav` para no duplicar el link y se agregó
  `src/components/ui/tabs.tsx`.

- **Refresh token con rotación (P-20, D-57)**: `POST /api/auth/refresh` y `src/lib/refresh-token.ts`; el login emite `authRefresh` (30 días) junto con
  `authToken` (24 h), la rotación guarda `replacedByTokenId` y el reuso de un token rotado revoca toda la cadena del usuario. Verificado contra la base el 2026-10-16.

- **Oferta de reactivación completa (T-045b a T-045d, T-043b y T-043c, D-54)**: migración aplicada, panel de
  parámetros (API + pantalla) y cobro con descuento, vista previa y avisos en las tres pantallas. La oferta
  **viene apagada por defecto**: hasta que se active desde `/configuracion`, el sistema cobra exactamente igual
  que antes. Los valores por defecto (30 días, 180 de enfriamiento, tope del 50 %) quedaron confirmados por el negocio como propuesta básica (P-40 cerrado, 2026-10-15) y son configurables desde `/configuracion`.

- **Oferta de reactivación, parte pura (T-045a, D-54)**: `evaluarOferta`, `calcularDescuento` y `aplicarOferta` en `src/domains/pago/oferta-reactivacion.ts`. Todavía no se usan en
  ningún cobro ni pantalla: el cobro sigue exactamente igual hasta T-045c.

- **Lector único de configuración (T-043a, D-54)**: `getConfiguracion()` reemplaza las 6 lecturas sueltas de `ConfiguracionDelSistema`; un test guardián impide volver a
  leerla por otro camino. Sin cambio de comportamiento salvo la forma del payload de `GET /api/home-interno` cuando no hay fila (ver D-54).

- **Etapa de ampliación documentada (D-41 a D-45)**: forma de trabajo con patches, alcance y orden, control de acceso por DNI/huella y molinete, registro de la
  ejecución de rutina y secciones del socio. Son decisiones y propuestas: **todavía no hay código** más allá de T-031. Cada D-xx indica qué decidió Fernando y qué
  propuso Claude sin confirmar; los puntos abiertos son P-30 a P-36.

- **Cuotas mensuales (T-031, D-40)**: el mes se paga del 1 al 10; las altas pagan prorrateo hasta el día 20 y, después, una cuota completa que cubre dos
  períodos. Funciones puras en `src/domains/pago/cuota.ts`, spec `pagos-cuotas`, `ConfiguracionDelSistema.diaLimitePago` / `diaCorteAltaTardia` y
  `Cuota.membresiaId`. La migración quedó aplicada (P-29).

- **Utilidades de UI (T-023b, D-37, D-39)**: validaciones compartidas (Cliente las reutiliza), formato de DNI y teléfono, `ApiError` / `handleApiError` y
  `NotificationProvider`. Conectadas a Clientes, Ejercicios, Rutinas y Membresías: avisos de éxito al crear, editar y eliminar, y mensajes de error según el
  estado HTTP (sin detalle técnico en los 5xx). Los mocks y fixtures viejos no se migraron (D-38).
- **Factories de prueba (T-024, D-38)**: `tests/factories/`, deterministas y validadas contra las reglas del dominio.
- **Hallazgos sin arreglar**: P-26 (`useMemo` de Clientes) y P-27 (lint previo en los paneles de Membresías). P-28 pasa a ser el ítem explícito del despliegue.

- **Seguridad de la sesión**: auditoría de logins y accesos denegados (T-029, D-32), límite de intentos de login con IP confiable (D-33) y revocación
  del token en el logout (T-027, D-34), con el botón "Cerrar sesión" del Socio (FX-19). Se suma el refresh token con rotación y detección de reuso (P-20, D-57).
- **Rendimiento de Home_Interno**: una sola ronda de consultas con `Server-Timing` (T-030) y scripts de diagnóstico `npm run db:latency` y
  `npm run bench:home-interno` (D-35, FX-21). P-07 cerrado: fuera de Next tarda ~0,4 s; el pooler de Supabase ya se probó en local (funciona y tolera
  las transacciones interactivas; en local es más lento por `connection_limit=1`), falta probarlo en Vercel.
- **Datos de desarrollo**: `npm run seed` repetible con usuarios por rol (D-30).
- **Spec de login** reescrito según la implementación, con trazabilidad a tests y a lo verificado contra la base (P-22, D-36).

- **Clientes**: editar nombre/email y membresía en una sola transacción, sin `any` (FX-13, D-26); mapeo de estado de
  cuota alineado con el enum de Prisma (FX-14, D-27). Actualización 2026-10-08: Inactivo y Bloqueado tienen valores propios
  en el enum (`INACTIVA`, `BLOQUEADA`; FX-17); la migración quedó aplicada.
- **Rutinas**: campos numéricos vacíos ya no quedan en `NaN` (FX-15, D-28).
- **Tests**: `ejercicio.test.ts` usa Prisma simulado y ya no escribe en la base (FX-16); `waitFor` espera 5 s en toda la suite (FX-18).
- **Documentación unificada**: `decisions.md` incorpora el registro del segundo desarrollador (D-17…D-25, FX-11/12,
  P-15…P-20, §6 desvíos de specs, §7 concordancia ADR); `rbac-middleware` reescrito y `authentication-login` reescrito
  el 2026-10-10 (D-36).

## Supuestos que la spec no define

Corregirlos es un cambio de una línea cada uno (detalle en `decisions.md` §4; incluye que el DNI sigue siendo editable, supuesto 12):
turnos Mañana 06–14 / Tarde 14–22 / Noche 22–06 · franjas de aforo de 2 h entre 06 y 22 · `diasInactividad = 15` ·
"baja de socio" = usuario socio con `deletedAt` en las últimas 24 h · "activo" = entrada dentro de `ventanaAforoMinutos` · cobro: cuotas mensuales, día
límite 10, corte de altas 20, pago tardío sin recargo (D-40, supuestos 13–15).

## Calidad

- **`npx eslint .` limpio (2026-10-16)**: 0 errores y 0 avisos en 398 archivos. La deuda preexistente (L-14) se saldó en el commit
  `7f15382` (`chore(lint): limpiar la deuda de lint y hacer que CI la exija`); el checklist TDD ya se cumple a nivel repositorio.
- Tamaño de PR: todos ≤400 LOC (el mayor, 389).
- **Flakiness del kiosco corregida (FX-22, 2026-10-16)**: con los workers por defecto (Jest usa `cores-1`) los suites del kiosco
  (`kiosco-acceso`, `kiosco-acceso-override`, `kiosco-puerta`) fallaban de forma intermitente con `Exceeded timeout of 5000 ms for a test`: el
  timeout **por test** de Jest seguía en el default, y esos tests (muchos `userEvent` secuenciales) lo superan bajo carga paralela. La causa se
  agravaba porque **cinco suites activan los fake timers dentro del cuerpo del test**, así que si el test fallaba antes de su `jest.useRealTimers()`
  los timers falsos quedaban puestos y colgaban los siguientes (cascada). Corregido en `jest.config.ts` (`testTimeout: 20000`) y `tests/setup.ts`
  (un `afterEach` que siempre restaura los timers reales). Resultado: **5 corridas seguidas con los workers por defecto, 191 suites / 2410 tests en
  verde**. FX-18 sólo había subido `asyncUtilTimeout` (que cubre `waitFor`/`findBy*`, no el timeout del test).
- **Gotcha de `tsc` (2026-10-16)**: `npx tsc --noEmit` puede fallar con `error TS1128` dentro de `.next/dev/types/validator.ts`, un archivo
  **generado por `next dev`** que `tsconfig.json` incluye (`.next/dev/types/**/*.ts`). Ese archivo queda corrupto si un `next dev` se corta a medias
  (aparecía una línea espuria que apuntaba a `./../src/app/api/dispositivos/route.ts`). **Workaround**: `rm -rf .next` y reconstruir; `next build`
  **no** genera `.next/dev/types`, así que el error no viene del código de la aplicación.

## Documentación

| Archivo | Para qué |
|---|---|
| `openspec/sdd-tasks-tdd.md` | Plan de tareas, estado por tarea, cambios de alcance |
| `openspec/decisions.md` | Decisiones (D-xx), defectos corregidos (FX-xx), pendientes (P-xx), lecciones |
| `openspec/specs/*/spec.md` | Specs de cada área (`pagos-cuotas` es la fuente de verdad de los estados de pago) |
| `openspec/*.svg`, `*.png` | Maquetas |
| `README.md` | Cómo instalar y correr el proyecto |
