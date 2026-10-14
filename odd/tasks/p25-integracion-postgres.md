# P-25 — Tests de integración de repositorios contra un Postgres efímero

**Estado**: cerrado
**Rama**: `dev`
**Plan**: D-52 (`openspec/decisions.md`) · **Pendiente**: P-25
**TDD**: activo — `strict_tdd: true` en `openspec/config.yaml`, runner jest (`npm test`), integración (`npm run test:integration`)

## Objetivo

Verificar contra un Postgres real lo que el Prisma simulado de FX-16 no puede: la FK
`ON DELETE RESTRICT` (P2003 real), el `mode: "insensitive"` real, el P2025 real y la
transacción de `update`. Alcance de esta tarea: el repositorio de `Ejercicio`, como
fija D-52.

## Por qué

`src/domains/ejercicio/ejercicio.test.ts` usa Prisma simulado desde FX-16. Su test de
P2003 prueba **sólo la traducción del error**: le inyecta el error a mano, así que si la
FK no existiera en la base, el test seguiría en verde. Lo mismo con `getAll`, que afirma
búsqueda insensible a mayúsculas sin que nadie la compruebe contra Postgres.

## Alcance

- **Entra**: harness Docker (Postgres efímero), config de Jest de integración, test de
  integración de `Ejercicio`, scripts npm, documentación.
- **No entra**: integración del resto de los repositorios, CI, Supabase Branching
  (descartado en D-52 por costo).

## Restricciones

1. `npm test` debe quedar **igual**: rápido, sin Docker, verde.
2. Nunca usar la base de desarrollo ni la de Supabase como base de prueba.
3. El container es efímero y su ciclo de vida es automático; `--keep` permite reusarlo
   mientras se itera.
4. Sin dependencias npm nuevas: el harness usa sólo módulos de Node.

## Checklist

- [x] **T1** · Harness: `scripts/test-integration.mjs` (levanta → espera → migra → corre →
      baja) + script `npm run test:integration`
- [x] **T2** · Config de Jest de integración + `tests/integration/setup-env.ts` (apunta
      `DATABASE_URL` a la base de prueba, con guarda de seguridad) + exclusión de
      `tests/integration/` en `jest.config.ts`
- [x] **T3** · `tests/integration/ejercicio.integration.test.ts`: P2003 real, P2025 real,
      `insensitive` real, transacción de `update` real
- [x] **T4** · Docs: D-53, P-25 cerrado en `openspec/decisions.md` y `PROJECT-STATUS.md`,
      `integration_available: true` en `openspec/config.yaml`

## Criterios de aceptación

1. `npm run test:integration` levanta el Postgres, migra, corre los tests y baja el
   container **sin pasos manuales**.
2. El test de P2003 **falla** si el ejercicio no tiene filas hijas: prueba de no vacuidad
   observada y registrada, no argumentada.
3. `npm test` sigue verde y **no requiere Docker**.
4. `npx tsc --noEmit` sin errores.

## Verificación

- `npx tsc --noEmit`
- `npm test`
- `npm run test:integration`
- `npx eslint scripts/test-integration.mjs tests/integration jest.integration.config.ts`

**Fallos de entorno conocidos**: deuda de lint preexistente (115 errores / 41 warnings en
52 archivos, D-12 / P-12). No se arregla acá; sólo se exige que los archivos nuevos estén
limpios.

## Ruta por tarea

| Tarea | Ruta | Trigger |
|---|---|---|
| T1–T4 | **delegada** — un solo writer | Trigger de escritura: 2+ archivos no triviales interdependientes |

Sin SDD: no fue pedido ni propuesto. Es implementación orgánica delegada.

## Progreso

**2026-10-14 — cerrado.**

Ruta: **delegada** (un writer para T1–T3) + **inline** para T4. T4 fue inline a propósito: son
insertos en plantillas que el orquestador ya había leído y el contenido es la decisión que él
mismo tomó; delegarlo habría exigido dictar la prosa igual. T1–T3 sí dispararon el trigger de
escritura (2+ archivos no triviales interdependientes).

Evidencia observada:

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio, exit 0 |
| `npm test` | 162 suites / 2038 tests pasan (1 `todo`), sin Docker |
| `npm run test:integration` | 12 migraciones aplicadas; 1 suite / 9 tests pasan, exit 0 |
| `npx eslint scripts/test-integration.mjs tests/integration jest.integration.config.ts` | limpio, exit 0 |

No vacuidad (lo corrió el writer y lo re-corrió el orquestador): con la fila hija sin crear,
el test de P2003 falla con `Received promise resolved instead of rejected`; con la fila hija,
pasa. Los 9 tests pasan con `EjercicioRepository` sin cambios: no se tocó `src/`.

Archivos: `scripts/test-integration.mjs`, `jest.integration.config.ts`,
`tests/integration/setup-env.ts`, `tests/integration/ejercicio.integration.test.ts`,
`jest.config.ts` (+1 línea), `package.json` (+1 script), `openspec/decisions.md` (D-53),
`openspec/config.yaml`, `PROJECT-STATUS.md`.

Pendiente fuera de alcance (no autorizado): tests de integración de los otros repositorios y CI.

