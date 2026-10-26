# Archive Report — motor-espera

- **Change**: `motor-espera` (Etapa 3 de "asignación dinámica de ejercicios")
- **Close date**: 2026-10-25
- **Artifact store**: openspec
- **Archived to**: `openspec/changes/archive/2026-10-25-motor-espera/`
- **Branch**: `feat/motor-espera`

## Qué se entregó

- **Motor de dominio puro** en `src/domains/asignacion/motor-espera.ts`: sin imports de `@/lib/db`,
  `@prisma/client` ni repositorios; recibe todo por parámetros y es determinista y re-ejecutable.
- **API pública**: `calcularEspera(input)`, `esMaquinaUsable(estado)` y la unión discriminada
  `ResultadoMotor` (`invalido` con `errores`, `exito` con `recomendado`/`siguienteEnOrden`/`ahorro`/
  `bloqueados`, `sin_opciones` con `bloqueados`, `vacio`). Tipos de entrada desacoplados de Prisma
  (`EjercicioPendiente`, `MaquinaEnGimnasio`, `Ocupante`, `ColaMiembro`, `ParametrosMotor`, `EntradaMotor`).
- **Fórmulas**:
  - Ocupante: `seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso`.
  - Miembro en cola: `series × segundosEjecucionSerie + (series − 1) × descanso`.
  - Espera de la máquina: ocupante + suma de la cola; `0` sin ocupante ni cola.
  - `descanso` por actor (D-82); la aproximación del ocupante es conservadora (`real ≤ calculada`).
- **Selección**: recomendado por menor espera; siguiente en orden por menor `orden`; desempate único
  `orden → posición → id` (D-78); máquina elegida por menor espera → primera en `candidatos` → `id`
  ascendente (D-85); `ahorro = espera(siguienteEnOrden) − espera(recomendado)`, nunca negativo.
- **Motivos de bloqueo** como códigos: `TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`, `SIN_MAQUINA_USABLE`
  (D-77); los candidatos vacíos no bloquean y devuelven `maquinaId: null`.
- **`Sugerencia.maquinaId`** con la unidad elegida (D-84).
- **Validación estricta** (D-79, D-87): `Number.isFinite` antes de los rangos sobre `orden`, `series`,
  `descanso`, `seriesRestantes` y `segundosEjecucionSerie`; `series ≥ 1`, `descanso ≥ 0`,
  `segundosEjecucionSerie > 0`, `seriesRestantes ≥ 1` y `series ≥ 1` en la cola; una única
  `duracionDeEjercicio` para ocupante y cola.
- **Deliberadamente fuera**: base de datos, API, UI, migración, persistencia de ocupación, `/configuracion`,
  integración con check-in/sesión/pantalla (Etapa 4) y simulación para la tesis (P-62).

## Evidencia verificada (estado final)

- `npx jest src/domains/asignacion`: **36 tests** en verde — 21 núcleo + 9 bloqueo + 6 selección.
  (Re-ejecutado por el agente durante el cierre.)
- `npx tsc --noEmit`: limpio. (Re-ejecutado por el agente.)
- `npx eslint src/domains/asignacion`: limpio. (Re-ejecutado por el agente.)
- `npm test`: **246 suites / 3538 tests** en verde. **(Lo observó el orquestador; el agente no volvió a
  correr la suite completa en este cierre.)**
- `npm run build`: limpio, compilado en **11,8 s**, **49 páginas**. **(Lo observó el orquestador; el agente
  no volvió a correr el build.)**
- `npx eslint .` sigue reportando solo el error preexistente P-57 en `src/app/home-socio/page.tsx:129`
  (`react-hooks/purity`); este cambio no agrega errores de lint. **(No re-ejecutado por el agente.)**
- `src/domains/asignacion/` suma **1095 líneas**: `motor-espera.ts` 321, `motor-espera.nucleo.test.ts` 389,
  `motor-espera.bloqueo.test.ts` 224, `motor-espera.seleccion.test.ts` 161.

## Specs sincronizadas

| Dominio | Acción | Detalles |
|---------|--------|----------|
| `motor-espera-asignacion` | **Creada** | Spec de capacidad nueva promovido byte a byte a `openspec/specs/motor-espera-asignacion/spec.md` (567 líneas). |

El spec promovido conserva **13 requirements**, los **26 escenarios** numerados (1–26, con subcasos 13a–13d y
14a–14c) y los criterios **AC-301…AC-314**, incluida la validación agregada de los escenarios 24–26. No se
agregó encabezado de delta: es la spec final de la capacidad. La copia se hizo con `cp` y se verificó con
`diff -r` (salida vacía).

## Decisiones y pendientes

- **Decisiones registradas**: **D-75…D-87** (trece entradas en `openspec/decisions.md` §1). D-75…D-79 son de
  Fernando; D-80…D-86 propuestas de la IA aprobadas; D-87 es el ajuste de validación pedido por la revisión
  externa. También se registró en §6 el desvío de `SIN_MAQUINAS_ASOCIADAS` (D-77).
- **Pendientes registrados**: **P-61…P-67** en §3. P-61, P-64, P-65 y P-66 son de Etapa 4; P-62 es posterior a
  la Etapa 5; P-63 es del informe de tesis; **P-67 ya existía** antes de este cierre (precondición de
  integración) y no se duplicó.

## Estado de las tareas

- **T-055a** — Núcleo del motor. ✅
- **T-055b** — Bloqueo y selección. ✅
- **T-055c** — Validación estricta posterior a la revisión externa. ✅
- **T-055d** — Cierre documental. ✅

Las cuatro tareas están completas en el registro. **El agente no hizo commits, pushes ni abrió PRs** durante
este cierre; los slices de código ya estaban pusheados por Fernando en `feat/motor-espera`.

## Riesgos y límites

- **Criterio solo-espera**: la recomendación minimiza la espera y no incorpora orden fisiológico (P-63).
- **Aproximación conservadora del ocupante**: se asume que está al inicio de su serie actual; la espera real
  puede ser menor, nunca mayor que la calculada.
- **Precondiciones de Etapa 4**: el cálculo en check-in debe ser best-effort (P-64); la reserva provisional
  necesita vencimiento (P-65); y quien arma la entrada debe excluir de las colas la reserva del propio socio
  (P-67) o el socio se espera a sí mismo.

## Qué NO se verificó

- Navegador y hardware: la etapa no tiene interfaz ni dispositivo.
- Suite de integración: no aplica, no hay base de datos ni migración en esta etapa.
- El agente no re-ejecutó `npm test` completo ni `npm run build`; esos números provienen de la verificación
  del orquestador al cerrar. Sí re-ejecutó la suite enfocada, `tsc` y el lint del módulo.
