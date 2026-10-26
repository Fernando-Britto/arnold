# Motor de espera (T-055a..T-055d, D-75..D-87)

## Objetivo

Cerrar la **Etapa 3** de "asignación dinámica de ejercicios": un motor de dominio puro que, dado el estado
del gimnasio en un instante y la rutina pendiente de un socio, calcule cuánto espera cada ejercicio, cuál
conviene hacer ahora (menor espera), cuál toca según el orden de la rutina y cuánto ahorra la recomendación
frente a seguir ese orden. No incluye la integración con check-in, sesión ni pantalla: eso es Etapa 4.

## Alcance

- `src/domains/asignacion/motor-espera.ts` — tipos, `esMaquinaUsable`, validación, fórmulas y
  `calcularEspera`.
- `src/domains/asignacion/motor-espera.nucleo.test.ts` — predicado, validación y fórmulas (21 tests).
- `src/domains/asignacion/motor-espera.bloqueo.test.ts` — motivos y `sin_opciones` (9 tests).
- `src/domains/asignacion/motor-espera.seleccion.test.ts` — selección, desempate y ahorro (6 tests).
- `openspec/specs/motor-espera-asignacion/spec.md` — capacidad promovida.
- `openspec/decisions.md`, `openspec/sdd-tasks-tdd.md`, `PROJECT-STATUS.md` y este archivo (cierre).

Sin base de datos, sin API, sin UI y sin migración.

## Decisiones clave

- **D-75** — Predicado propio de máquina usable: `DISPONIBLE` y `OCUPADA` son usables; no reutiliza el
  filtro de `home-interno.ts`.
- **D-76** — Cada unidad física es una fila de `Maquina`; dos unidades del mismo tipo son candidatas
  independientes.
- **D-77** — Los motivos de bloqueo son códigos (`TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`,
  `SIN_MAQUINA_USABLE`); `SIN_MAQUINAS_ASOCIADAS` se eliminó por ser código muerto.
- **D-78** — Desempate determinista en tres niveles: `orden` → posición en la entrada → `id`.
- **D-79** — Validación en el dominio, sin excepciones ni cálculo parcial, antes del control de lista vacía.
- **D-80** — Un solo archivo de módulo, sin imports de infraestructura.
- **D-81** — `ResultadoMotor` es una unión discriminada única con la variante `invalido`.
- **D-82** — `descanso` por actor: el del ocupante y el de cada miembro de la cola mandan en la fórmula.
- **D-83** — Un candidato ausente en `maquinas` no es usable, no lanza y no aporta estado a la clasificación.
- **D-84** — `Sugerencia.maquinaId` indica la unidad elegida o `null` si no hay candidatas.
- **D-85** — Desempate de máquina: menor espera → primera posición en `candidatos` → `id` ascendente.
- **D-86** — Se valida también el `descanso` del ocupante y de cada miembro de la cola.
- **D-87** — Validación numérica estricta: `Number.isFinite` antes de los rangos, `seriesRestantes ≥ 1`,
  `series ≥ 1` en la cola y una única `duracionDeEjercicio` para ocupante y cola.

## Tareas

1. **T-055a** — Núcleo del motor: tipos, predicado, validación, fórmulas, espera por ejercicio y `maquinaId`
   mínimo. ✅
2. **T-055b** — Bloqueo y selección: motivos, `sin_opciones`, comparador canónico, elección de máquina,
   ahorro y determinismo. ✅
3. **T-055c** — Ajuste de validación posterior a la revisión externa: `Number.isFinite`, límites de series y
   `duracionDeEjercicio` única. ✅
4. **T-055d** — Cierre documental: decisiones, pendientes, registro de tareas, spec promovido y archivo del
   change. ✅

## Verificación observada

- `npx jest src/domains/asignacion`: **36 tests** en verde (21 núcleo + 9 bloqueo + 6 selección).
- `npm test`: **246 suites / 3538 tests** en verde.
- `npx tsc --noEmit`: limpio.
- `npx eslint src/domains/asignacion`: limpio.
- `npm run build`: limpio (compiló en 11,8 s, 49 páginas).
- `npx eslint .` sigue mostrando solo el error preexistente P-57 (`src/app/home-socio/page.tsx:129`); esta
  etapa no suma errores.

Nada de esto se probó en navegador ni con hardware: la etapa no tiene UI. La suite de integración no aplica.

## Límites declarados

- **Criterio solo-espera**: la recomendación minimiza la espera; no incorpora orden fisiológico ni prioriza
  grupos musculares (P-63, documentado para el informe de tesis).
- **Aproximación conservadora**: se asume que el ocupante está al inicio de su serie actual, así que la
  espera real será menor o igual a la calculada. Nunca se promete menos espera de la que habrá.
- **Sin persistencia**: el motor recibe ocupantes y colas por parámetro; no lee ni escribe la base.

## Siguiente: Etapa 4

La Etapa 4 integra el motor con el check-in, la sesión y las pantallas. Antes de hacerlo debe cumplir:

- **P-67 (precondición)**: al armar la entrada del motor, excluir de las colas la reserva del propio socio
  en cada recálculo (check-in → inicio de rutina → después de cada ejercicio), con test obligatorio; si no,
  el socio se espera a sí mismo.
- **P-61**: salida de emergencia del flujo obligatorio (máquina rota o socio lesionado → reasignación por
  instructor).
- **P-64**: el cálculo en check-in debe ser best-effort y nunca bloquear el registro de asistencia.
- **P-65**: reserva provisional con vencimiento configurable (propuesta: 15 minutos sin iniciar rutina).
- **P-66**: evaluar la API de Next 16 para trabajo posterior a la respuesta, leyendo la documentación
  instalada antes de proponerla.

Quedan fuera de la Etapa 4 la simulación comparativa para la tesis (P-62) y la redacción de la limitación
"solo espera" (P-63), que pertenecen al trabajo de tesis posterior.
