# Arnold

Sistema de gestión para un gimnasio: socios, membresías, rutinas, ejercicios, pagos y control de acceso.
Trabajo final desarrollado con Spec-Driven Development (SDD) en modo Strict TDD.

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
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de la cookie de sesión. **Obligatoria en producción** |
| `TRUST_PROXY_HEADERS` | Opcional. `true` solo si hay un proxy propio y confiable delante (fuera de Vercel); ver `.env.example` |

**Datos de desarrollo** (opcional, solo para probar): `npm run seed` carga 5 usuarios (Administrador, Instructor,
Recepcionista y 2 Socios, todos `@arnold.test`), membresías, ejercicios, rutinas, máquinas y datos de asistencia, progreso,
pagos y cuotas. Se puede correr las veces que haga falta (no duplica) y se niega a correr con `NODE_ENV=production`.
La contraseña por defecto es `Arnold2026!`; se cambia con `SEED_PASSWORD` en el `.env`. Prisma 6 avisa que
`package.json#prisma` está deprecado: es solo un aviso.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Todos los tests (`ejercicio.test.ts` necesita la base de datos) |
| `npm test -- <ruta>` | Tests de una carpeta o archivo |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npx eslint <rutas>` | Lint. El repo arrastra deuda preexistente; ver `PROJECT-STATUS.md` |
| `npm run build` | Build de producción |

## Roles

`ADMINISTRADOR` (todo) · `INSTRUCTOR` (ejercicios y rutinas) · `RECEPCIONISTA` (clientes y pagos) · `SOCIO`
(su propio portal). La matriz exacta está en `PROJECT-STATUS.md` y en `src/lib/authorization.ts`.

## Estructura

```
src/app/          Páginas y rutas de API (App Router) + src/proxy.ts (sesión y permisos)
src/domains/      Reglas de negocio puras y repositorios
src/api/          Handlers de servidor y funciones de cliente
src/components/   Componentes por área
src/lib/          Auth, base de datos, permisos, hora del gimnasio
tests/            Tests de rutas y fixtures compartidos
openspec/         Specs, plan de tareas, decisiones y maquetas
```

## Documentación del proyecto

- **Estado actual y pendientes**: [`PROJECT-STATUS.md`](PROJECT-STATUS.md)
- **Plan de tareas**: [`openspec/sdd-tasks-tdd.md`](openspec/sdd-tasks-tdd.md)
- **Decisiones, defectos corregidos y lecciones**: [`openspec/decisions.md`](openspec/decisions.md)

## Flujo de trabajo

Una rama por tarea creada desde `main` actualizado · tests primero (rojo → verde) · PR de ≤400 líneas ·
`npm test` en verde antes de mergear · commits con Conventional Commits y la referencia `(T-xxx, PR-xxx)`.
