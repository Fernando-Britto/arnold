# Ruido de `npm test` — arreglar, no tapar

**Estado**: cerrado
**Rama**: `dev`
**TDD**: activo — `strict_tdd: true` en `openspec/config.yaml`, runner jest (`npm test`)

## Objetivo

`npm test` pasa (162 suites / 2038 tests) pero **imprime ruido**: avisos `act(...)`, una key de
React duplicada, logs de la app en tests que ejercitan caminos de error, y `console.log` de
scratchpad en un test. Fernando pidió arreglarlos, **no taparlos**.

## Regla de oro

Silenciar de forma global NO es la solución: esconde errores reales. Cada ruido se trata según
su causa:

| Causa | Tratamiento |
|---|---|
| Log de la app en un test que **ejercita a propósito** ese camino | `jest.spyOn(console, 'error')` **por test** + **afirmar** el mensaje. Es el patrón que el repo ya usa (`src/lib/client-ip.test.ts`, `src/api/home-socio-data.test.ts`) |
| `console.log` de scratchpad en un test | Borrarlos; las aserciones se conservan |
| Mock obsoleto (el test no cubre código que sí existe) | Completar el mock **y** afirmar el comportamiento que faltaba |
| Aviso `act(...)` | Arreglar el test (await / act). Nunca silenciar |
| Key duplicada de React | Determinar la causa raíz: si es el componente, es un **bug de producción** |

## Criterio de aceptación

`npm test` no debe imprimir **salida de consola alguna**:

```bash
npm test 2>&1 | grep -cE "^ *console\.(log|error|warn)$"   # 0
npm test 2>&1 | grep -c "not wrapped in act"                # 0
npm test 2>&1 | grep -c "same key"                          # 0
```

Y `npm test` sigue verde: 162 suites / 2038 tests (1 `todo`).

> **Corrección (2026-10-14).** El criterio original pedía `grep -c "● Console"` y estaba **mal**:
> en Jest 30.5 el reporter por defecto no emite el encabezado `● Console` para las suites que pasan.
> Verificado revirtiendo un solo archivo ruidoso: bajo la métrica real aparecieron **15** bloques
> indentados de `console.*`, y `● Console` seguía dando **0**. La métrica inútil era mía, no del
> código.

## Checklist

- [x] **T1** · `src/domains/cliente/cliente-gaps.test.ts` — borrar los ~15 `console.log` de scratchpad (conservar aserciones)
- [x] **T2** · `src/api/auth.test.ts` — el mock de `@/lib/db` solo expone `usuario.findFirst`; completarlo con `refreshToken.create` **y** afirmar que el login emite el refresh token (hoy el flujo revienta con `Cannot read properties of undefined (reading 'create')` y el error queda tapado por un `console.error`)
- [x] **T3** · `src/app/ejercicios/page.test.tsx` — 2 avisos `act(...)` + key duplicada `2` (determinar causa raíz)
- [x] **T4** · `src/components/cliente-crud/cliente-form.test.tsx` — 1 aviso `act(...)`
- [x] **T5** · Tests de rutas que ejercitan el 500: spy por test + aserción del log de `route-error-mapper`:
      `tests/api/rutinas.route.test.ts`, `tests/api/ejercicios.route.test.ts`,
      `tests/api/socios-access-override.route.test.ts`, `src/app/api/ejercicios/[id]/route.test.ts`,
      `src/app/api/membresias/activas/route.test.ts`
- [x] **T6** · `src/app/clientes/page.test.tsx` — `console.error("Form submission error: ...")` del form de clientes (spy por test + aserción)

## Fuera de alcance

- El `it.todo` de `src/components/membresia-crud/membresia-form.test.tsx:270` **no se toca**: pide un
  modal de advertencia al pasar una membresía a INACTIVA con socios asignados, y eso necesita un
  `getAssignedSocioCount` que no existe. Es una **feature**, no un arreglo de ruido.
- No se toca `src/` salvo que T3 demuestre que la key duplicada es un bug del componente.

## Verificación

```bash
npm test 2>&1 | grep -c "● Console"      # 0
npm test                                  # 162 suites / 2038 tests
npx tsc --noEmit
npx eslint <archivos tocados>
```

**Fallos de entorno conocidos**: deuda de lint preexistente (115 errores / 41 warnings en 52
archivos, D-12 / P-12). No se arregla acá; solo se exige que lo tocado quede limpio.

## Ruta por tarea

| Tarea | Ruta | Trigger |
|---|---|---|
| T1–T6 | **delegada** — un solo writer | Trigger de escritura: 2+ archivos no triviales interdependientes |

## Progreso

**2026-10-14 — cerrado.** Ruta: **delegada** (un writer para T1–T6; trigger de escritura: 2+
archivos no triviales interdependientes).

Evidencia observada (la re-corrió el orquestador, no solo el writer):

| Chequeo | Resultado |
|---|---|
| `npm test 2>&1 \| grep -cE "^ *console\.(log\|error\|warn)$"` | **0** |
| `grep -c "not wrapped in act"` | **0** |
| `grep -c "same key"` | **0** |
| `grep -c "\[AUTH\]"` / `\[SERVER_ERROR\]` | **0** / **0** |
| `npm test` | 162 suites / 2038 tests / 1 `todo` |
| `npx tsc --noEmit` | limpio |
| `npx eslint` (10 archivos tocados) | 33 problemas, **idéntico al baseline de HEAD** (28 errores / 5 warnings, deuda D-12) |

**Prueba del detector**: revirtiendo `cliente-gaps.test.ts` a su estado previo, la métrica real
detectó **15** bloques; `● Console` seguía en **0**. Así se confirmó que el criterio original era
inútil, y que el fix es real.

`src/` **no** se tocó: T3 fue artefacto del mock (el alta devolvía el id `"2"`, ya presente en la
lista → la página hace `[...prev, saved]` y React veía dos keys iguales). En producción el servidor
devuelve un id nuevo, así que el append es correcto. Determinado con evidencia, no por descarte.

No se tocó `tests/setup.ts` ni `jest.config.ts`: **cero silenciamiento global**.
