# Arnold — Estado del proyecto

**Actualizado**: 2026-10-08 · **Plan**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md) ·
**Decisiones y defectos**: [`openspec/decisions.md`](openspec/decisions.md) · **Modo**: Strict TDD

Sistema de gestión para un gimnasio. Stack: Next.js 16.2 (Turbopack), React 19, Prisma 6 sobre PostgreSQL, Jest.

## Resumen

- Hechos: los 4 CRUD (Ejercicios, Rutinas, Clientes, Membresías), Home_Socio, **Home_Interno completo (interfaz y API de
  datos)**, y la autenticación (login, logout, proxy con permisos por rol).
- Pendiente del plan: **T-023b** (utilidades de UI) y **T-024** (fixtures y factories).
- Lo más urgente no es construir más: es **verificar** lo hecho (ver [Antes de seguir](#antes-de-seguir)).

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
| T-027 ➕ | Revocación de tokens en el logout (el refresh queda para P-20) | ✅ verificado contra la base (P-06, D-34) |
| T-030 ➕ | Home_Interno: consultas planas en una sola ronda + `Server-Timing` | ✅ medido contra la base: ~0,4 s fuera de Next (P-07, D-35) |
| T-020 | Home_Interno: componentes base | ✅ |
| T-021a | Home_Interno Parte 1 (acciones, hoy, operación) | ✅ 934 LOC (estimado 250) |
| T-021b | Home_Interno Parte 2 (gestión, actividad) | ✅ 336 LOC (estimado 150) |
| T-021c ➕ | `GET /api/home-interno` | ✅ 505 LOC |
| T-026a/b/c ➕ | Login/logout, página `/login`, proxy + RBAC | ✅ (de Fernando) |
| T-023b | Utilidades de UI | ⏳ → `PR-009-D` |
| T-024 | Fixtures y factories | ⏳ |

➕ = agregada durante la ejecución, no estaba en el plan. El detalle de por qué T-021 pasó de 400 a 1.806 LOC y se
partió en 7 PRs está en `decisions.md` (D-01).

## Qué se verificó y qué no

**Verificado con evidencia**
- Logs de `next dev` de Fernando: login `200`; `/home-interno` y `GET /api/home-interno` `200`; Clientes carga para
  Administrador y Recepcionista; `GET /api/membresias/activas` `200`.
- Tests en la máquina de Fernando (2026-10-08, `npm test`): **86 de 86 suites; 1.151 de 1.152 tests pasan** (1 `todo`).
  Corrección: ese `timeout` de FX-16 nunca estuvo en el repo; la corrida pasó por rapidez. Ver FX-16 y FX-18 en `decisions.md`.
- `npx prisma generate && npx tsc --noEmit` en la máquina de Fernando (2026-10-08): sin errores (cierra P-01).
- Auditoría de accesos (2026-10-08, consulta a `AuditoriaAcceso` en Supabase): hay filas `LOGIN/DENY` (`AUTH_INVALID`, con `usuarioId`
  del usuario apuntado o vacío si el email no existe), `LOGIN/ALLOW` y `ACCESS_DENIED/DENY` con `motivo` `GET /clientes` (P-15, D-32).
- Límite de intentos de login (2026-10-08, `curl` contra `npm run dev`): 8 intentos con `401` y el 9.º y 10.º con `429`;
  la pantalla `/login` muestra "Demasiados intentos" solo con el `429` (P-16, D-33).
- Revocación de tokens (2026-10-09, `curl` contra `npm run dev`, con la migración aplicada): con dos tokens distintos de Socio, `GET /api/clientes`
  respondía `403` (sesión válida sin permiso); tras `POST /api/auth/logout` con ese mismo token, el mismo pedido respondió `401 TOKEN_INVALID`
  (P-06, D-34). Se probó el endpoint con `curl`; el botón "Cerrar sesión" del Socio (FX-19) no se probó aparte.
- Los nombres de modelo, campo, relación y enum usados por `/api/home-interno` existen en `schema.prisma` (41 de 41).

**No verificado**
- Que los números de Home_Interno coincidan con los datos reales (turnos, franjas y "activo" son supuestos).
- Que la edición de clientes funcione de punta a punta contra la base real. FX-09 y su corrección FX-13/FX-14 (transacción
  y mapeo del enum de cuota) pasaron tests con Prisma simulado, pero **no se probaron contra la base** (P-21).

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
2. **Aplicar las migraciones pendientes** (`npx prisma migrate deploy` y `npx prisma generate`) antes de las pruebas 3 y 6:
   `20261008190000_add_estado_cuota_inactiva_bloqueada` (Inactivo guarda `INACTIVA` y Bloqueado `BLOQUEADA`, D-27, FX-17) y
   `20261008230000_add_token_revocation` (D-34).
3. **Editar un cliente** como Administrador y como Recepcionista: cambiar a la vez nombre, email, teléfono y membresía,
   y también el estado de cuenta (Inactivo/Bloqueado); guardar, recargar y confirmar que se persistió (FX-13, FX-14).
4. **Revisar los clientes que se intentaron editar mientras el error estaba abierto**: cada intento fallido guardó
   igual el nuevo nombre y email del usuario (FX-09).
5. Abrir Home_Interno con datos reales y comparar Aforo, Caja, Personal en turno y Socios inactivos (P-02).
6. ~~**Cerrar sesión** y probar que el token queda inútil~~ → hecho el 2026-10-09 con `curl` (P-06). Pasos usados: iniciá sesión, copiá la cookie `authToken` (herramientas del
   navegador → Application/Storage), cerrá sesión con el botón de la barra superior (Socio y personal; FX-19), y repetí un
   pedido a la API con esa cookie (por ejemplo con `curl`): tiene que responder `401` `TOKEN_INVALID` (P-06, D-34).
7. ~~**Medir Home_Interno**~~ → hecho el 2026-10-09 (P-07, D-35): `datos` 0,55–1,55 s, `proxy.ts` 0,6–1,9 s, total 1,2–4,2 s; el contenido
   coincide con el seed. No mejoró de forma evidente (no hay un "antes" comparable); ver D-35.
8. ~~**Medir la base**~~ → hecho el 2026-10-09 (`npm run db:latency`): consulta ≈ 212 ms, 14 a la vez ≈ 203 ms (el pool paraleliza bien), conexión nueva ≈ 2,2 s.
9. ~~**Medir fuera de Next**~~ → hecho el 2026-10-09 (`npm run bench:home-interno`): armado ≈ 405 ms, sesión ≈ 207 ms, primera corrida (en frío) ≈ 2,1 s.
10. *(opcional)* **Confirmar con el build de producción**: `npm run build`, `npm run start` y repetir el `curl` a `/api/home-interno` (P-07, D-35): el proxy
    debería quedar cerca de 0,2 s y `datos` cerca de 0,4 s.

## Pendientes principales

Lista completa con severidad en [`decisions.md` §3](openspec/decisions.md#3-pendientes-abiertos).

| # | Pendiente | Severidad |
|---|---|---|
| P-01 | ~~`tsc` local~~ → resuelto (2026-10-08, sin errores) | Baja |
| P-02 | Contrastar Home_Interno con datos reales | Alta |
| P-03 | ~~Clientes se cae entero si falla el desplegable de membresías~~ → resuelto (D-31) | Baja |
| P-04 | ~~`ClienteRepository.create()` no es atómico~~ → resuelto (D-31) | Baja |
| P-05 | ~~`/api/home-socio` no existe~~ → resuelto (T-028); falta probarlo con un socio real | Baja |
| P-06 | ~~Sin revocación de tokens~~ → resuelto y verificado (T-027, D-34) | Baja |
| P-07 | ~~Home_Interno tarda 2–4 s en desarrollo~~ → cerrado (D-35): fuera de Next el armado tarda ~0,4 s y la sesión ~0,2 s; el resto es del servidor de desarrollo. Pendiente aparte: evaluar el pooler de Supabase para el despliegue | Baja |
| P-08 | ~~No hay script de seed de usuarios~~ → resuelto (`npm run seed`, D-30); falta correrlo contra la base | Baja |
| P-15 | ~~Accesos denegados sin registrar en `AuditoriaAcceso`~~ → resuelto y verificado (T-029, D-32) | Baja |
| P-16 | ~~Rate limit del login: fuera de Vercel todos comparten la IP `unknown`~~ → resuelto y verificado (D-33, opt-in `TRUST_PROXY_HEADERS`) | Baja |
| P-20 | Refresh token con rotación (la revocación ya está, D-34) | Media |
| P-21 | Probar la edición de clientes contra la base (con la migración de D-27 aplicada) | Alta |
| P-22 | Reescribir el spec `authentication-login` | Media |
| P-25 | Tests de integración del repositorio de Ejercicio contra una base de pruebas (FX-16 lo pasó a Prisma simulado) | Baja |
| P-24 | Completar los estados de `EstadoCuota` (por alcance solo `INACTIVA` y `BLOQUEADA`, D-27) | Baja |

## Cambios recientes (2026-10-07)

- **Clientes**: editar nombre/email y membresía en una sola transacción, sin `any` (FX-13, D-26); mapeo de estado de
  cuota alineado con el enum de Prisma (FX-14, D-27). Actualización 2026-10-08: Inactivo y Bloqueado tienen valores propios
  en el enum (`INACTIVA`, `BLOQUEADA`; FX-17) y requieren aplicar una migración.
- **Rutinas**: campos numéricos vacíos ya no quedan en `NaN` (FX-15, D-28).
- **Tests**: `ejercicio.test.ts` usa Prisma simulado y ya no escribe en la base (FX-16); `waitFor` espera 5 s en toda la suite (FX-18).
- **Documentación unificada**: `decisions.md` incorpora el registro del segundo desarrollador (D-17…D-25, FX-11/12,
  P-15…P-20, §6 desvíos de specs, §7 concordancia ADR); `rbac-middleware` reescrito y `authentication-login` con aviso
  de revisión.

## Supuestos que la spec no define

Corregirlos es un cambio de una línea cada uno (detalle en `decisions.md` §4; incluye que el DNI sigue siendo editable, supuesto 12):
turnos Mañana 06–14 / Tarde 14–22 / Noche 22–06 · franjas de aforo de 2 h entre 06 y 22 · `diasInactividad = 15` ·
"baja de socio" = usuario socio con `deletedAt` en las últimas 24 h · "activo" = entrada dentro de `ventanaAforoMinutos`.

## Calidad

- Los archivos de cada PR de esta etapa están sin errores nuevos de lint. El repositorio arrastra **115 errores y 41
  warnings en 52 archivos** (deuda preexistente): el ítem "`npm run lint` limpio" del checklist TDD se interpreta
  como "sin errores nuevos en lo tocado" (D-14).
- Tamaño de PR: todos ≤400 LOC (el mayor, 389).

## Documentación

| Archivo | Para qué |
|---|---|
| `openspec/sdd-tasks-tdd.md` | Plan de tareas, estado por tarea, cambios de alcance |
| `openspec/decisions.md` | Decisiones (D-xx), defectos corregidos (FX-xx), pendientes (P-xx), lecciones |
| `openspec/specs/*/spec.md` | Specs de cada área |
| `openspec/*.svg`, `*.png` | Maquetas |
| `README.md` | Cómo instalar y correr el proyecto |
