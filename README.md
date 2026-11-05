# Arnold

Sistema de gestión para un gimnasio: socios, membresías, rutinas, ejercicios, pagos y control de acceso
(recepción con DNI + PIN, puerta y huella). Incluye el portal del socio con seguimiento de su rutina y un
tema claro/oscuro por dispositivo. Trabajo final desarrollado con Spec-Driven Development (SDD) en modo
Strict TDD.

**Stack**: Next.js 16 (Turbopack) · React 19 · TypeScript · Prisma 6 + PostgreSQL · Jest + Testing Library.

> Este Next.js tiene cambios respecto de versiones anteriores (por ejemplo `proxy.ts` reemplaza a `middleware.ts` y
> `params` es asíncrono). Ver `AGENTS.md` y la documentación en `node_modules/next/dist/docs/`.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npx prisma generate
npx prisma migrate deploy   # aplica las migraciones a la base
npm run dev                 # http://localhost:3000
```

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (en desarrollo, la conexión directa de Supabase) |
| `JWT_SECRET` | Firma de la cookie de sesión. **Obligatoria en producción** |
| `TRUST_PROXY_HEADERS` | Opcional. `true` solo si hay un proxy propio y confiable delante (fuera de Vercel); ver `.env.example` |
| `SEED_PASSWORD` | Opcional. Contraseña de los usuarios del seed; tiene un valor por defecto en `prisma/seed.ts` |
| `ASIGNACION_TIMEOUT_CALCULO_MS` | Opcional. Tope del cálculo de asignación, en milisegundos; entero entre 500 y 30000, 2000 por defecto. Contra una base remota conviene subirlo (p. ej. 15000–20000): si no, el check-in no crea reserva |
| `ARNOLD_TEST_DATABASE_URL` | Opcional. Base de los tests de integración; por defecto `postgresql://arnold:arnold@127.0.0.1:5433/arnold_test` (ver `tests/integration/setup-env.ts`) |

**Datos de desarrollo** (opcional, solo para probar): `npm run seed` carga 5 usuarios (Administrador, Instructor,
Recepcionista y 2 Socios, todos `@arnold.test`), membresías, ejercicios, rutinas, máquinas y datos de asistencia, progreso,
pagos y cuotas. Se puede correr las veces que haga falta (no duplica) y se niega a correr con `NODE_ENV=production`.
La contraseña por defecto es `Arnold2026!`; se cambia con `SEED_PASSWORD` en el `.env`. El seed **no** asocia
ejercicios a máquinas: sin ese paso el motor de asignación devuelve `sin_opciones` (ver más abajo).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Todos los tests (usan Prisma simulado: no tocan la base de datos) |
| `npm test -- <ruta>` | Tests de una carpeta o archivo |
| `npm run test:integration` | Suite de integración: levanta un Postgres efímero en un contenedor Docker, aplica las migraciones y lo baja. **Requiere Docker** (`--keep` deja el contenedor vivo) |
| `npm run seed` | Datos de desarrollo (ver arriba) |
| `npx prisma generate && npx tsc --noEmit` | Chequeo de tipos (hace falta generar antes el cliente de Prisma) |
| `npm run lint` | ESLint. Hoy da **0 errores** y deja warnings preexistentes (ver `PROJECT-STATUS.md`) |
| `npm run build` | Build de producción |
| `npm run catalogo:generar -- <dataset>` | Regenera `prisma/data/ejercicios-es.json` desde el dataset de ejercicios (D-70); solo lee y escribe un archivo |
| `npm run media:convertir -- <dataset>` | Convierte los GIF de ejercicios a mp4 + miniatura en `public/ejercicios/` (D-70); requiere ffmpeg, repetible |
| `npm run catalogo:importar [-- --dry-run]` | Importa los 1.324 ejercicios a la base (D-70); repetible, no toca ejercicios cargados a mano |
| `npm run db:latency` | Diagnóstico (solo lee): latencia de la base, paralelismo del pool y costo de una conexión nueva (D-35) |
| `npm run bench:home-interno` | Diagnóstico (solo lee): mide el armado de Home_Interno y la verificación de sesión fuera de Next (D-35) |

El **CI** (`.github/workflows/ci.yml`) corre en cada push y pull request: chequeo de tipos, lint y tests
unitarios. La suite de integración queda afuera a propósito porque necesita Docker y un Postgres efímero.

## Roles

`ADMINISTRADOR` (todo, con excepciones explícitas) · `INSTRUCTOR` (ejercicios, rutinas y asignación de
rutinas; lectura de socios y de la sugerencia) · `RECEPCIONISTA` (clientes, pagos, cierres y check-in) ·
`SOCIO` (su propio portal y sus sesiones). La matriz exacta está en `PROJECT-STATUS.md` y en
`src/lib/authorization.ts`.

## Asignación dinámica de ejercicios

Al registrar la asistencia, Arnold calcula **qué ejercicio de la rutina del socio tiene menos espera**,
sumando el descanso y el tiempo estimado de ejecución de quienes ocupan cada máquina. Guarda una reserva
provisional que vence (15 minutos por defecto, configurable en `/configuracion`); el socio la ve y decide
**ACEPTAR** o **ESPERAR**. Al iniciar la sesión la reserva se consume y, al terminar cada ejercicio, el
cálculo se repite.

- `GET /api/asignaciones/sugerencia` — SOCIO (sobre lo propio), ADMINISTRADOR e INSTRUCTOR (con `socioId`).
- `POST /api/asignaciones/decidir` — solo SOCIO, sobre lo propio.
- El Administrador registra las máquinas y las asocia a ejercicios desde `/maquinas` (fila expandida →
  "Asignar ejercicios"). Sin asociaciones, no hay candidatas y el motor no sugiere nada.
- El cálculo es **best-effort**: si falla, tarda o expira, la asistencia y la sesión siguen exactamente
  igual. El motor no modifica el estado de las máquinas (`DISPONIBLE`/`OCUPADA` se derivan).
- Limitación declarada (D-108): un socio con una sesión abierta sin fila `EN_CURSO` solo ocupa una máquina
  si el ejercicio tiene una única candidata; con varias, el motor puede **subestimar** la espera.

Specs y decisiones: [`openspec/specs/asignacion-orquestacion/spec.md`](openspec/specs/asignacion-orquestacion/spec.md)
y [`openspec/decisions.md`](openspec/decisions.md) (D-88 a D-111, sin D-107).

## Estructura

```
src/app/          Páginas y rutas de API (App Router) + src/proxy.ts (sesión y permisos)
src/domains/      Reglas de negocio puras y repositorios
src/api/          Handlers de servidor y funciones de cliente
src/components/   Componentes por área
src/lib/          Auth, base de datos, permisos, hora del gimnasio
tests/            Tests de rutas, fixtures y factories de datos de prueba (tests/factories)
prisma/           Schema, migraciones, seed y scripts del catálogo (prisma/data/)
public/ejercicios/  Media del catálogo (mp4 + miniaturas)
firmware/         Sketch del lector de acceso ESP32 (ver firmware/README.md)
openspec/         Specs, plan de tareas, decisiones y maquetas
odd/tasks/        Registro de trabajo de cada feature (tareas, decisiones y verificación)
scripts/          Utilidades de desarrollo (por ejemplo, el orquestador de la suite de integración)
```

## Documentación del proyecto

- **Estado actual y pendientes**: [`PROJECT-STATUS.md`](PROJECT-STATUS.md)
- **Plan de tareas**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md)
- **Decisiones, defectos corregidos y lecciones**: [`openspec/decisions.md`](openspec/decisions.md)
- **Specs por capacidad**: [`openspec/specs/`](openspec/specs/)
- **Changes archivados**: [`openspec/changes/archive/`](openspec/changes/archive/)
- **Firmware del lector**: [`firmware/README.md`](firmware/README.md)

## Licencias y atribuciones

- El catálogo de ejercicios sale de [`exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset)
  (MIT): textos y datos. Ver [`prisma/data/NOTICE.md`](prisma/data/NOTICE.md).
- La media de `public/ejercicios/` es **© Gym visual** y tiene sus propios términos: se muestra con
  atribución visible y a 180×180 (D-70 y P-50 en `openspec/decisions.md`). El repositorio es público y se
  decidió mantener la media con su atribución; riesgo aceptado el 2026-11-05, a revisar si el titular objeta.

## Flujo de trabajo

Cada etapa grande se hace en una rama `feat/*` que sale de `dev`; al cerrarla se mergea a `dev` y, cuando la
verificación está cerrada, `dev` pasa a `main` · tests primero (rojo → verde) · PR de ≤400 líneas ·
`npm test` en verde antes de mergear · commits con Conventional Commits y la referencia `(T-xxx, D-xx)`
(tarea y decisión, D-41). El desarrollo se hace con SDD sobre gentle-ai/OpenCode.
