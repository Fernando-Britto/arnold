# Endurecer el test del harness (hallazgos de la revisión 4R)

**Estado**: cerrado
**Rama**: `dev`
**TDD**: activo — runner jest (`npm test`)

## Objetivo

Arreglar los 6 hallazgos advisory que la revisión 4R del commit `4a2e2b2` dejó sobre
`tests/test-integration-script.test.ts`. La clausura los declaró trabajo aparte; Fernando pidió
arreglarlos.

## Checklist

- [x] **H1** · `R3-env-hermeticity` (WARNING) — el env del hijo hereda `process.env`: fijar
      explícitamente todas las variables `FAKE_*` en cada corrida
- [x] **H2** · `R3-no-subprocess-timeout` (WARNING) — `timeout` en `spawnSync` + fallo claro si expira
- [x] **H3** · `R2-002` — una sola fuente para el nombre de la base; el spec negativo derivado de una
      plantilla, no de un `.replace()` que puede volverse no-op silencioso
- [x] **H4** · `R2-001` + `R3-readiness-retry-unproved` — ejercitar de verdad el knob de readiness con
      un test que pruebe el **reintento** del gate
- [x] **H5** · `R3-afterall-masks-setup` — no llamar `fs.rmSync` con un `tmpDir` que puede ser `undefined`

## Criterios de aceptación

1. `npm test` verde, **0 `todo`**, 0 ruido de consola.
2. Se mantiene: un test **falla** si le sacan `-h 127.0.0.1 -p 5432` al gate (P-37).
3. Se mantiene: un test **falla** si revierten la validación de `--keep` (P-38).
4. Nuevo: un test prueba el **reintento** — el gate falla N veces y después responde; el script
   espera y termina bien.
5. Hermeticidad: con `FAKE_PG_FAIL_TIMES` y `FAKE_DOCKER_EXISTS` **seteadas en el shell padre**, el
   resultado de los tests **no cambia**.

## Restricciones

- **No** se modifica `scripts/test-integration.mjs`.
- El test sigue sin requerir Docker ni red.
- Los falsos no imprimen nada salvo lo que el script captura (cero ruido).

## Ruta por tarea

| Tarea | Ruta | Trigger |
|---|---|---|
| H1–H5 | **delegada** — un writer | Reescribir un archivo no trivial con diseño sin resolver (fake con estado) |

## Progreso

**2026-10-14 — cerrado.** Ruta: **delegada** (un writer; trigger: reescribir un archivo no trivial con
diseño sin resolver — el fake con estado).

Los 6 hallazgos, arreglados:

| Hallazgo | Qué se hizo |
|---|---|
| H1 `R3-env-hermeticity` | `correr()` fija **todas** las `FAKE_*` que los falsos leen. Nada se hereda del shell |
| H2 `R3-no-subprocess-timeout` | `timeout: 20_000` en `spawnSync`; si expira, el fallo dice que fue el timeout, no una aserción confusa |
| H3 `R2-002` | `BASE_PRUEBA` como fuente única + `specContenedor(base)`. El `.replace()` que podía volverse no-op silencioso ya no existe |
| H4 `R2-001` + retry | La rama `exec` del falso ahora es **con estado** (contador en el tmp por corrida). Test nuevo: falla 2 veces y después responde → el gate reintenta y el script termina bien |
| H5 `R3-afterall-masks-setup` | `afterAll` guardado con `if (tmpDir)` |

Extra: un test que **prueba la hermeticidad** envenenando el `process.env` padre y verificando que el
resultado no cambia.

Evidencia observada (re-corrida por el orquestador):

| Chequeo | Resultado |
|---|---|
| `npm test` | **163 suites / 2044 tests / 0 `todo` / 0 fallas** (6 tests en el archivo, antes 4) |
| `npm test 2>&1 \| grep -cE "^ *console\.(log\|error\|warn)$"` | **0** |
| `FAKE_PG_FAIL_TIMES=99 FAKE_DOCKER_EXISTS=1 npx jest tests/test-integration-script.test.ts` | **6/6 pasan** — el entorno padre no influye |
| `npx tsc --noEmit` | limpio |
| `npx eslint tests/test-integration-script.test.ts` | limpio |
| `git diff --exit-code scripts/test-integration.mjs` | vacío — el script quedó intacto |

**Prueba de mutación (P-37 sigue mordiendo)**: sacándole `-h 127.0.0.1 -p 5432` al gate, **2 tests
fallan** (el de P-37 y el nuevo de reintento); restaurado byte-idéntico a HEAD.
