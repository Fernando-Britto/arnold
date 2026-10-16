# Arnold — Estado del proyecto

**Actualizado**: 2026-10-16 · **Plan**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md) ·
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
- **Máquina de Fernando (2026-10-16)**: `npm test -- --maxWorkers=4` → `Test Suites: 191 passed` · `Tests: 2410 passed, 2410 total`.
  Con los workers por defecto (Jest usa `cores-1`) tres suites del kiosco (`kiosco-acceso`, `kiosco-acceso-override`, `kiosco-puerta`) fallan
  **de forma intermitente por contención**; pasan aisladas y no dependen del código nuevo (FX-18).
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

Estado: **todas las tareas de código de la ampliación están hechas** (T-032…T-041) y **las migraciones están aplicadas** (`sesion_en_curso_y_dispositivo` y `add_huella_socio`; `npx prisma migrate status`: 15 migraciones, esquema al día). Falta probar en dev y, la huella, con el hardware real.

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

## Cambios recientes (2026-10-07 al 2026-10-16)

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
- **`npm test` es flaky por contención (no es una regresión, 2026-10-16)**: con los workers por defecto (Jest usa `cores-1`) fallan de forma
  intermitente los suites del kiosco (`kiosco-acceso`, `kiosco-acceso-override`, `kiosco-puerta`). Pasan aislados, no dependen del código nuevo y el
  repo ya lo documenta (FX-18). Con `npm test -- --maxWorkers=4` la suite da **191 suites / 2410 tests en verde**. En CI los runners tienen 2–4 cores,
  así que el paralelismo es menor.
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
