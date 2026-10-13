# Ampliación MVP — pagos, acceso y rutina

**Feature**: `ampliacion-mvp` · **Rama**: `dev` · **Modo**: Strict TDD (`strict_tdd: true`)
**Espejo en Engram**: `odd/ampliacion-mvp/tasks` · **Inicio**: 2026-10-12

## Objetivo

Cerrar "la parte básica" del sistema según D-42: **pagos y cuotas**, **asignar rutina**, **control de acceso al gimnasio** (DNI + PIN, huella al final) y **registro de la ejecución de la rutina** (por serie), más las **secciones del socio** y el **cierre de caja**.

## Problema

Los modelos `Pago`, `Cuota`, `Asistencia`, `SesionDeEntrenamiento`, `RegistroDeProgreso` y `CierreDeCaja` existen en el schema pero **no tienen dominio, API ni pantalla**. En Home_Interno los botones "Registrar Pago", "Control Acceso" y "Cierre de Caja" son no-ops. `/api/rutinas-asignadas` no existe: hoy un socio solo tiene rutina por el seed. El check-in no existe.

## Decisiones que rigen este trabajo

- **D-40** (pagos/cuotas): el mes se paga del 1 al 10; altas con prorrateo hasta el 20; cuota doble después.
- **D-46** (P-31): `Socio.estadoCuota` = estado de la **cuenta** (`AL_DIA`/`INACTIVA`/`BLOQUEADA`); el estado de **pago** se calcula (`estadoCuotaSocio`) y no se persiste.
- **D-47** (P-33): acceso con **DNI + PIN de 4 dígitos** (bcrypt), huella al final; kiosco de recepción + tablet de puerta con `Dispositivo`.
- **D-48** (P-34): registro **por serie** con peso, reps, **RIR** y cronómetro calculado por hora guardada.
- **D-49**: huella/molinete (T-041) al final; producción antes de hardware; refresh token cuando sobre tiempo.

## Alcance

**Dentro**: T-032 … T-040. **Fuera** (fase final / no pedido): T-041 (huella + molinete), T-042…T-044 (usuarios internos, configuración/máquinas, cambio de contraseña), reportes de recaudación/asistencia, visor de auditoría.

## Restricciones del entorno

- **La base de Supabase no es alcanzable** desde el entorno del asistente (conexión directa `P1001`). Por eso:
  - Las **migraciones las aplica Fernando** (`npx prisma migrate dev` + `npx prisma generate`).
  - Los tests corren con **Prisma simulado** (`jest.mock("@/lib/db")`); los de dominio puro corren siempre.
  - `npx prisma validate` y `npx prisma generate` sí funcionan (no tocan la DB).
- **≤400 LOC por patch/PR** (heurística de trabajo, no criterio de aceptación), Conventional Commits con `(T-xxx, D-xx)`, autor `Fernando Britto <fernando@example.com>`.

## Tareas

| ID | Tarea | Ruta | Estado |
|---|---|---|---|
| T-032 | `POST /api/pagos`: registrar pago (transacción `Pago` + `Cuota`) | delegada (escritor) | ✅ |
| T-033 | UI: "Registrar Pago" (Home_Interno) + endpoint `GET /api/socios?dni=` | delegada | ✅ (Mis pagos del socio → T-039) |
| T-034 | Asignar rutina: modal + `/api/rutinas-asignadas` | delegada | ✅ |
| T-035 | Check-in por DNI + PIN (API + pantalla de recepción `/acceso`) | delegada | ✅ |
| T-036 | Pantalla de puerta + `Dispositivo` con token (migración) | delegada | ✅ |
| T-037 | Sesión de entrenamiento: migración + API (`EN_CURSO`, `sesionId`, `numeroSerie`, `rir`) | delegada | ✅ |
| T-038 | Ejecución de rutina con cronómetro + RIR (UI) | delegada | ✅ |
| T-039 | Secciones del socio (Mi rutina, Mis ejercicios, Progreso, Mis pagos, Mis asistencias) | delegada | ✅ |
| T-040 | Cierre de caja | delegada | ✅ |

La ruta por tarea se registra al ejecutarla (trigger: dominio + handler + route + tests = 2+ archivos no triviales ⇒ escritor delegado).

## Criterios de aceptación

- Cada tarea entra con **tests escritos primero** (rojo → verde) y `npm test -- <path>` en verde.
- `npx tsc --noEmit` sin errores **nuevos**; sin errores de lint **nuevos** en lo tocado (D-14).
- Los permisos nuevos se suman a `src/lib/authorization.ts` **y** a su test de consistencia.
- Las migraciones quedan como SQL versionado; Fernando las aplica.

## Verificación

- `npm test` (suite completa) antes de cerrar cada bloque.
- `npx tsc --noEmit`.
- Smoke test manual (Fernando): registrar un pago, hacer un check-in, ejecutar una serie.

## Migraciones

Todas aplicadas: `20261012120000_add_pin_y_metodo_asistencia` (T-035) y `20261012235038_sesion_en_curso_y_dispositivo` (T-037 + T-036). La base quedó **al día (8 migraciones)**. Seed corrido: PIN de los socios de prueba = **`1234`**.

## Progreso

- **2026-10-12**: decisiones D-46…D-49 documentadas; P-29 verificado por inspección (aplicada por Fernando); rama `dev`.
- **2026-10-12** — bloque Pagos: **T-032** (`POST/GET /api/pagos`, servicio transaccional, 57 tests) y **T-033** (`/pagos`, búsqueda por DNI `GET /api/socios?dni=`, avisos). Verificado: tests verdes, `tsc` limpio.
- **2026-10-12** — bloque Rutina/Acceso: **T-034** (asignar rutina, RN-04 una activa, modal en Home_Interno) y **T-035** (check-in DNI + PIN en `/acceso`, `Socio.pinHash`, `Asistencia.metodo`, anti-passback 60 min, rate limit 20/min). Migración de T-035 aplicada por Fernando.
- **2026-10-12** — bloque Cierre/Entrenamiento/Puerta/Socio: **T-040** (cierre de caja, `/cierres`), **T-037** (sesión `EN_CURSO` + registrar serie + `ultimaCarga`), **T-038** (`/home-socio` ejecución por serie con steppers, RIR y cronómetro por hora guardada), **T-039** (5 secciones del socio, ownership server-side), **T-036** (pantalla `/puerta` con auth de dispositivo, modelo `Dispositivo`, carve-out acotado en el proxy). **Falta generar+aplicar la migración de T-036/T-037.**
- Suite completa: **1.760 tests** pasan; el único fallo es el timeout preexistente y flaky de `rutina-form.test.tsx` (pasa en aislamiento, FX-18/P-19). Pin del seed para probar el kiosco: **`1234`**.
