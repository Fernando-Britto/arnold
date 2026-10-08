# Arnold — Estado del proyecto

**Actualizado**: 2026-10-05 · **Plan**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md) ·
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
- Tests en la máquina de Fernando (2026-10-07, `npm test`): **76 de 77 suites; 1.079 de 1.081 tests pasan** (1 `todo`).
  El fallo fue un timeout de `ejercicio.test.ts`, que usa la base real (FX-16, P-19); se subió el timeout y falta
  confirmar la corrida completa.
- Los nombres de modelo, campo, relación y enum usados por `/api/home-interno` existen en `schema.prisma` (41 de 41).

**No verificado**
- Que los números de Home_Interno coincidan con los datos reales (turnos, franjas y "activo" son supuestos).
- Que la edición de clientes funcione de punta a punta contra la base real. FX-09 y su corrección FX-13/FX-14 (transacción
  y mapeo del enum de cuota) pasaron tests con Prisma simulado, pero **no se probaron contra la base** (P-21).
- `npx tsc --noEmit` en la máquina de Fernando (el asistente no puede generar el cliente de Prisma).

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

1. `npx tsc --noEmit` en la máquina local y confirmar que no hay errores en `home-interno-data.ts` (P-01).
2. **Editar un cliente** como Administrador y como Recepcionista: cambiar a la vez nombre, email, teléfono y membresía,
   y también el estado de cuenta (Inactivo/Bloqueado); guardar, recargar y confirmar que se persistió (FX-13, FX-14).
3. **Revisar los clientes que se intentaron editar mientras el error estaba abierto**: cada intento fallido guardó
   igual el nuevo nombre y email del usuario (FX-09).
5. Confirmar con el negocio que **Bloqueado → `PENDIENTE`** e **Inactivo → `VENCIDA`** es el mapeo deseado (D-27).
4. Abrir Home_Interno con datos reales y comparar Aforo, Caja, Personal en turno y Socios inactivos (P-02).

## Pendientes principales

Lista completa con severidad en [`decisions.md` §3](openspec/decisions.md#3-pendientes-abiertos).

| # | Pendiente | Severidad |
|---|---|---|
| P-01 | `tsc` local | Alta |
| P-02 | Contrastar Home_Interno con datos reales | Alta |
| P-03 | Clientes se cae entero si falla el desplegable de membresías (`Promise.all`) | Media |
| P-04 | `ClienteRepository.create()` no es atómico (puede quedar un `Usuario` huérfano) | Media |
| P-05 | ~~`/api/home-socio` no existe~~ → resuelto (T-028); falta probarlo con un socio real | Baja |
| P-06 | Sin revocación de tokens: el logout solo borra la cookie | Media |
| P-07 | Home_Interno tarda 2–4 s en desarrollo (base con latencia alta, 14 consultas) | Media |
| P-08 | ~~No hay script de seed de usuarios~~ → resuelto (`npm run seed`, D-30); falta correrlo contra la base | Baja |
| P-15 | Accesos denegados sin registrar en `AuditoriaAcceso` | Media |
| P-16 | Rate limit del login: fuera de Vercel todos comparten la IP `unknown` | Media |
| P-20 | Refresh token con rotación (junto con P-06) | Media |
| P-21 | Probar la edición de clientes contra la base y confirmar el mapeo de estado | Alta |
| P-22 | Reescribir el spec `authentication-login` | Media |

## Cambios recientes (2026-10-07)

- **Clientes**: editar nombre/email y membresía en una sola transacción, sin `any` (FX-13, D-26); mapeo de estado de
  cuota alineado con el enum de Prisma (FX-14, D-27).
- **Rutinas**: campos numéricos vacíos ya no quedan en `NaN` (FX-15, D-28).
- **Tests**: timeout de `ejercicio.test.ts` ampliado (FX-16).
- **Documentación unificada**: `decisions.md` incorpora el registro del segundo desarrollador (D-17…D-25, FX-11/12,
  P-15…P-20, §6 desvíos de specs, §7 concordancia ADR); `rbac-middleware` reescrito y `authentication-login` con aviso
  de revisión.

## Supuestos que la spec no define

Corregirlos es un cambio de una línea cada uno (detalle en `decisions.md` §4; incluye el mapeo `Bloqueado → PENDIENTE`, D-27):
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
