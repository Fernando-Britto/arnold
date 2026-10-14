# Cierre de la revisión 4R — hallazgos del harness + `it.todo` obsoleto

**Estado**: cerrado
**Rama**: `dev`
**TDD**: activo — runner jest (`npm test`)

## Objetivo

Cerrar las dos cosas que quedaron abiertas tras la revisión 4R del commit `04ad966`.

## Hallazgo que cambia el plan (verificado, no asumido)

El `it.todo` de `src/components/membresia-crud/membresia-form.test.tsx:270` **es obsoleto**: la
feature existe y está probada en tres niveles. No hay nada que construir.

| Pieza | Dónde está |
|---|---|
| Gate de desactivación (`DEACTIVATION_WARNING`) | `src/api/membresias.ts:141-152` |
| `getAssignedSocioCount` | `src/domains/membresia/membresia.ts:325-330` |
| Mapeo del código a 400 | `src/lib/route-error-mapper.ts` |
| Aviso + botón "Entendido, desactivar de todas formas" | `src/components/membresia-crud/membresia-form-panel.tsx:47-100,110-131` |
| Test del aviso | `membresia-form-panel.test.tsx:121-164` |
| Test del camino de confirmación | `membresia-form-panel.test.tsx:266-282` |
| Tests de API y de ruta (ambos caminos) | `src/api/membresias.test.ts:190,202` · `src/app/api/membresias/[id]/route.test.ts:109,120` |

Se escribió antes de que T-016 integrara la API, y nadie lo limpió cuando la feature entró.
**Construirlo habría duplicado el modal en el form y dejado código muerto.**

## Checklist

- [x] **T1** · `tests/test-integration-script.test.ts` (nuevo) — test automatizado de
      `scripts/test-integration.mjs` con `docker` y `npx` falsos en el `PATH`
- [x] **T2** · `src/components/membresia-crud/membresia-form.test.tsx` — borrar el `it.todo`
      obsoleto y dejar dicho dónde vive la cobertura

## Criterios de aceptación

1. `npm test` queda con **0 `todo`** (hoy 1) y las suites verdes.
2. Un test **falla** si alguien le saca el `-h 127.0.0.1 -p 5432` al gate de readiness (P-37).
3. Un test **falla** si alguien revierte la validación de `--keep` a mirar sólo el nombre (P-38).
4. Cero ruido de consola nuevo: `npm test 2>&1 | grep -cE "^ *console\.(log|error|warn)$"` = 0.

## Restricciones

- **No** se modifica `scripts/test-integration.mjs`: el objetivo es probarlo tal como está.
- El test **no** puede requerir Docker ni red: los binarios se falsean en el `PATH`.
- Los falsos no deben imprimir nada por stdout/stderr salvo lo que el script captura, para no
  ensuciar la salida que acabamos de limpiar.

## Verificación

```bash
npm test 2>&1 | grep -cE "^ *console\.(log|error|warn)$"   # 0
npm test                                                    # 0 todo, todo verde
npx tsc --noEmit
npx eslint tests/test-integration-script.test.ts src/components/membresia-crud/membresia-form.test.tsx
```

## Ruta por tarea

| Tarea | Ruta | Trigger |
|---|---|---|
| T1 | **delegada** — un writer | Archivo nuevo no trivial, con iteración sobre subprocesos |
| T2 | **inline** | Un solo archivo, edición ya entendida (borrar un `it.todo` obsoleto) |

## Progreso

**2026-10-14 — cerrado.**

**T1** (delegado, un writer): `tests/test-integration-script.test.ts` corre el script real como
subproceso con `docker` y `npx` falsos en el `PATH`. No se importa ni se mockea el script: se
verifica el **argv real** que pasa, sin Docker ni red. 4 tests:
1. P-37 — la **única** invocación de `pg_isready` lleva `-h 127.0.0.1 -p 5432`.
2. El `run` crea el contenedor con `-p 127.0.0.1:5433:5432`, `POSTGRES_DB=arnold_test` y la imagen.
3. P-38 positivo — con `--keep` y un spec que coincide: no hay `run` y dice "Se reutiliza".
4. P-38 negativo — con `--keep` y `POSTGRES_DB` distinto: hay `rm` y después `run`, y avisa "no coincide".

`scripts/test-integration.mjs` quedó **intacto** (`git diff --exit-code` limpio): el objetivo era
probarlo tal cual, no adaptarlo.

**Prueba de que el test muerde**: sacándole `-h 127.0.0.1 -p 5432` al gate, el test **falla**
(`Expected substring: "-h 127.0.0.1"` / `Received: "exec arnold-test-db pg_isready -U arnold -d arnold_test"`),
y el archivo se restauró byte-idéntico a HEAD.

**T2** (inline, un archivo): el `it.todo` era **obsoleto** — verificado contra el código, no
asumido. La feature existe y está probada en panel, API y ruta. Se borró el marcador y se dejó
escrito, con nombres de test (no números de línea, que envejecen), dónde vive la cobertura.

Evidencia observada (re-corrida por el orquestador):

| Chequeo | Resultado |
|---|---|
| `npm test` | **163 suites / 2042 tests / 0 `todo` / 0 fallas** |
| `npm test 2>&1 \| grep -cE "^ *console\.(log\|error\|warn)$"` | **0** |
| `grep -c "not wrapped in act"` / `"same key"` | **0** / **0** |
| `npx tsc --noEmit` | limpio |
| `npx eslint` (archivos nuevos) | limpio |
| `grep -rn "\.todo(" src tests` | **ninguno** |

Los `todo` del repo pasaron de 1 a **0**, y el único que había describía una feature que ya existía.
