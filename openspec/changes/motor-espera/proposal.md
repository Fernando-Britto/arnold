# Proposal: motor-espera (Etapa 3 — Motor de espera y sugerencia)

## Intención

La Etapa 1 (`maquinas-crud`, D-73) entregó el catálogo de máquinas con `EstadoMaquina`. La Etapa 2 (`maquina-ejercicios`, D-74) conectó ejercicios con máquinas vía `EjercicioMaquina`. Ambas dejaron al gimnasio con datos estáticos: qué máquinas existen y qué ejercicio puede usar cada una. Pero el socio sigue sin saber **qué ejercicio hacer ahora** cuando hay máquinas disputadas, y la recepción no tiene una forma sistemática de sugerir un orden que reduzca la espera.

Esta etapa construye un **motor de dominio puro** que, dado el estado del gimnasio en un instante, calcula para cada ejercicio pendiente de la rutina del socio:

- Cuánto debe esperar hasta que haya una máquina usable.
- Cuál es la **recomendación** (menor espera; desempate por `orden` de rutina).
- Cuál es el **siguiente en orden de rutina** (baseline).
- Cuánto **ahorro** de espera aporta la recomendación vs. seguir el orden.

Sin este motor, las Etapas 4 (integración con check-in / sesión) y 5 (pantalla del socio + simulación de tesis) no tienen base sobre la cual construir: no hay forma determinista de proponer un ejercicio, ni de medir esperas, ni de justificar el flujo obligatorio. El motor debe ser **puro, barato y re-ejecutable**, porque se invocará en al menos tres momentos (check-in provisional, inicio de rutina, posterior a cada ejercicio) y no puede fallar ni bloquear ninguno de esos flujos.

Limitación declarada: el criterio es **solo-espera** (menor tiempo de espera); no incorpora orden fisiológico. Esta limitación es documentada para el informe de tesis (P-63).

## Alcance

### In Scope

1. **Módulo de dominio puro** `src/domains/asignacion/motor-espera.ts` con una función pública `calcularEspera(input) → ResultadoMotor`. Cero imports de `@/lib/db`, `@prisma/client` o repositorios. Respeta `src/domains/dominios-puros.guard.test.ts`.
2. **Tipos de entrada desacoplados de Prisma**: `EjercicioPendiente`, `MaquinaEnGimnasio`, `Ocupante`, `ColaMiembro`, `ParametrosMotor`. El motor no conoce el esquema; recibe todo por parámetros.
3. **Predicado propio de máquina usable**: función interna `esMaquinaUsable(estado)` que acepta `DISPONIBLE` y `OCUPADA`, rechaza `FUERA_DE_SERVICIO` e `INACTIVA`. NO reutiliza el filtro de `home-interno.ts` (que excluye `OCUPADA`). Test dedicado que documenta ambas lecturas del valor persistido.
4. **Fórmula de espera del ocupante**: `seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso`. Conservadora (asume ocupante al inicio de la serie actual).
5. **Fórmula de duración de un miembro en cola**: `series × segundosEjecucionSerie + (series − 1) × descanso`.
6. **Validación de entrada de dominio**: `series >= 1`, `descanso >= 0`, `segundosEjecucionSerie > 0`. Mismo patrón que `src/domains/maquina/`.
7. **Desempate determinista**: (a) menor `orden` de rutina, (b) posición en la lista de entrada, (c) `id`. Mismo criterio para "siguiente en orden" y "recomendado". Escenario dedicado con todos los ejercicios en `orden = 0`.
8. **Ejercicio bloqueado**: si no tiene máquina usable → excluido de la recomendación con un **código de motivo** (literal union, sin texto de usuario).
9. **Resultado `sinOpciones`**: si todos los pendientes están bloqueados → tipo `sin_opciones` con lista de bloqueados, no throw. Si no hay ejercicios pendientes → tipo `vacio`.
10. **Suite de tests** en `motor-espera.test.ts` con los escenarios numéricos citados en el explore, descripciones en español, valores calculados a mano para trazar al informe de tesis.
11. **`segundosEjecucionSerie` como parámetro inyectable** (no constante hardcodeada): en Etapa 4 pasa a `/configuracion`. La transición debe ser trivial.

### Out of Scope

- Integración con check-in, sesión de entrenamiento, Home_Socio o pantalla del socio (Etapas 4 y 5).
- Migraciones, endpoints REST, API routes, UI, componentes.
- Persistencia del estado de ocupación (sesiones activas, ocupantes reales, colas reales).
- Reserva provisional con vencimiento (P-65).
- Cálculo best-effort en check-in (P-64).
- Parámetro `/configuracion` (se parameteriza por inyección, no se expone).
- Salida de emergencia del flujo obligatorio (P-61).
- Simulación comparativa para la tesis (P-62).
- Cambios a `EstadoMaquina`, `Maquina`, `EjercicioEnRutina`, `EjercicioMaquina`, `SesionDeEntrenamiento`.
- Refactors del guard de dominios puros ni del filtro de `home-interno.ts`.
- Tocar Home_Interno "Estado de Equipos" (P-53) ni el drift de tipos (P-54, P-55, P-56).

## Modelo conceptual

Vocabulario mínimo del motor (no se exporta a Prisma):

| Concepto | Significado en el motor |
|---|---|
| **Ejercicio pendiente** | `(id, orden, series, descanso, candidatos: MaquinaId[])`. Proviene de la rutina del socio; en check-in puede ser la rutina completa con `series = 1`. |
| **Máquina candidata** | `Maquina.id` de una fila de `Maquina` que el ejercicio puede usar (vía `EjercicioMaquina`). Cada unidad física es una fila distinta; no hay campo `unidades`. |
| **Ocupante actual** | `(seriesRestantes)` de un ejercicio que está usando la máquina ahora. El motor no conoce quién es; solo necesita saber cuánto tarda en liberar. |
| **Miembro en cola** | `(series, ejercicio)` de alguien que espera la máquina antes que el socio. |
| **Predicado "máquina usable"** | `estado ∈ {DISPONIBLE, OCUPADA}`. Documenta la doble lectura del valor persistido: `OCUPADA` persistida puede significar "en uso por otra sesión" (lectura de `home-interno`) o "legada como estado previo, sin ocupante real ahora" (lectura del motor). El motor define su propio predicado y NO reutiliza el filtro de `home-interno.ts`. |
| **Espera** | Segundos hasta que la máquina esté libre considerando ocupante + cola. Número entero, no reloj. |
| **Bloqueado** | Ejercicio pendiente sin ninguna máquina usable. Lleva un código de motivo. |
| **Recomendación** | Ejercicio con menor espera; desempate por `orden` de rutina, posición en input, `id`. |
| **Siguiente en orden** | Ejercicio pendiente no bloqueado con menor `orden` de rutina; desempate por posición en input, `id`. |
| **Ahorro** | `espera(siguienteEnOrden) − espera(recomendado)`. Si coinciden → no hay elección real, ahorro = 0. |

## Decisiones

### Decisiones de Fernando (vinculantes)

Las siguientes tensiones del explore.md se resuelven con las respuestas del usuario. No se reabren en diseño ni en spec.

1. **OCUPADA — predicado propio del motor**. El motor define su propio predicado `esMaquinaUsable`: `DISPONIBLE` y `OCUPADA` cuentan como usables; `FUERA_DE_SERVICIO` e `INACTIVA` no. NO reutiliza el filtro de `home-interno.ts`. El spec debe documentar ambas lecturas del valor persistido e incluir un test dedicado del predicado.
2. **Unidades = filas de `Maquina`**. No existe campo `unidades` ni concepto agregado; cada unidad física es una fila distinta de `Maquina`. El motor trabaja con candidatos por `Maquina.id`. El spec debe incluir un escenario explícito con dos unidades de la "misma máquina" (mismo tipo/nombre) mostrando que el motor las trata como candidatos independientes y elige la que se libera primero.
3. **Motivos de bloqueo como códigos**. Literal union (estilo `oferta-reactivacion.ts`): `SIN_MAQUINAS_ASOCIADAS`, `TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`, etc. Sin texto legible en el dominio; el mapeo a mensajes de usuario queda en Etapa 4. Los tests asercionan contra el código, no contra el texto.
4. **Desempate determinista en tres niveles**. (a) Menor `orden` de rutina. (b) Posición en la lista de entrada. (c) `id` (string). Aplica tanto al "siguiente en orden" como al "recomendado". Se incluye un escenario dedicado donde **todos** los ejercicios tienen `orden = 0`, forzando el desempate por posición y por id.
5. **Validación de entrada en dominio**. `series >= 1`, `descanso >= 0`, `segundosEjecucionSerie > 0`. Mismo patrón que `src/domains/maquina/`. No se confía en la base de datos ni en capas superiores.

### Propuestas de la IA (no vinculantes; el spec puede refinar)

1. **Ubicación**: `src/domains/asignacion/motor-espera.ts` como archivo único con tipos internos en el mismo módulo. Si el archivo crece beyond ~300 líneas, extraer `tipos.ts` y `calculos.ts` en la misma carpeta.
2. **Forma del resultado**: unión discriminada `ResultadoMotor = { tipo: "exito"; recomendado; siguienteEnOrden; ahorro; bloqueados } | { tipo: "sin_opciones"; bloqueados } | { tipo: "vacio" }`. Type-safe, sin flags sueltos.
3. **Una sola función pública**. `calcularEspera(input)`. Descomposición en helpers internos (`calcularOcupante`, `calcularCola`, `calcularEsperaMaquina`, `seleccionarRecomendado`) solo si la complejidad lo justifica. Ponytail: la solución más pequeña que resuelve el problema completo.
4. **Validación como paso inicial de la función pública** (no función separada exportada). Retorna `ValidationResult` si falla; continúa con el cálculo si pasa.
5. **No exportar el predicado `esMaquinaUsable`** fuera del módulo, excepto si un test dedicado lo requiere. Es un detalle de implementación del motor; la semántica puede cambiar si Etapas 4/5 ajustan el modelo.
6. **`segundosEjecucionSerie` por parámetro** (no constante). En Etapa 4 pasa a `/configuracion`; la transición debe ser una línea de cambio en el caller, no en el motor.
7. **Tests con valores numéricos exactos** (no rangos): cada escenario aserciona el valor calculado a mano. Esto permite citar los números en el informe de tesis sin recalcular.

## Capabilities

### New Capabilities

- `motor-espera-asignacion`: motor de dominio puro que calcula esperas y recomienda el siguiente ejercicio para un socio dado el estado del gimnasio. Incluye predicado de máquina usable, fórmula de ocupante/cola, validación de entrada, desempate determinista, códigos de motivo de bloqueo y resultado `sinOpciones` / `vacio`. Función pública `calcularEspera` + tests con escenarios numéricos.

### Modified Capabilities

- Ninguna. Esta etapa no modifica capacidades existentes; solo consume los conceptos modelados en `maquinas-crud` y `maquina-ejercicio-assignment` como entrada desacoplada.

## Impacto en stakeholders

| Stakeholder | Impacto |
|---|---|
| **Socio** | Ninguno visible en esta etapa. La Etapa 4 usará este motor para mostrarle "hacé X ahora" en Home_Socio. |
| **Recepción / Instructor** | Ninguno visible. La Etapa 4 usará este motor para sugerir ejercicios en el panel de atención. |
| **Administrador** | Ninguno visible. No hay configuración expuesta en esta etapa; `segundosEjecucionSerie` sigue siendo 60 s como parámetro inyectado. Etapa 4 lo moverá a `/configuracion`. |
| **Tesis** | Esta etapa entrega la base medible: cada escenario de test produce un número citable (espera en segundos, ahorro en segundos). La limitación "solo-espera" (P-63) y la simulación comparativa (P-62) quedan documentadas como trabajo futuro. |

## Approach

1. **Módulo puro en `src/domains/asignacion/`**. Archivo principal `motor-espera.ts` con la función pública y los tipos. Si el archivo crece, separar `tipos.ts` y `calculos.ts`. Ningún import de `@/lib/db`, `@prisma/client` o repositorios.
2. **Tipos de entrada desacoplados**:
   ```ts
   type EjercicioPendiente = { id: string; orden: number; series: number; descanso: number; candidatos: string[] };
   type Ocupante = { seriesRestantes: number };
   type ColaMiembro = { series: number };
   type MaquinaEnGimnasio = { id: string; estado: EstadoMaquina; ocupante: Ocupante | null; cola: ColaMiembro[] };
   type ParametrosMotor = { segundosEjecucionSerie: number };
   type EntradaMotor = { ejercicios: EjercicioPendiente[]; maquinas: MaquinaEnGimnasio[]; parametros: ParametrosMotor };
   ```
   `EstadoMaquina` se modela como literal union propia del dominio (no importada de `@prisma/client`).
3. **Función pública**: `calcularEspera(input: EntradaMotor): ResultadoMotor`. Primero valida; si falla retorna `{ valid: false; errors }`. Después filtra ejercicios bloqueados (sin máquina usable → motivo). Si todos bloqueados → `sin_opciones`. Si la lista de entrada está vacía → `vacio`. Calcula espera de cada candidato (ocupante + cola), elige el mejor por máquina, y luego el recomendado y el siguiente-en-orden con el desempate determinista.
4. **Predicado de máquina usable** como función interna (no reutiliza `home-interno.ts`). Test dedicado que aserciona: `DISPONIBLE` → usable, `OCUPADA` → usable, `FUERA_DE_SERVICIO` → no, `INACTIVA` → no.
5. **Fórmulas** (documentadas en el spec con el porqué de la aproximación conservadora):
   - Ocupante: `seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso`
   - Miembro en cola: `series × segundosEjecucionSerie + (series − 1) × descanso`
   - Espera total de una máquina: si no tiene ocupante ni cola → 0; si tiene ocupante → tiempo del ocupante + suma de tiempos de miembros en cola.
6. **Validación**: `series >= 1`, `descanso >= 0`, `segundosEjecucionSerie > 0`. Retorna errores estructurados. No lanza excepciones.
7. **TDD estricto**: red → green en cada escenario. Los valores numéricos calculados a mano permiten citar en el informe de tesis sin recalcular. Descripciones en español (`describe("calcularEspera", ...)`, `it("debe ...")`).
8. **Guardián de dominio puro**: el `dominios-puros.guard.test.ts` ya existente debe seguir pasando. Si se agregan tests de imports, que el nuevo módulo también pase.

## Affected Areas

| Area | Impact | Descripción |
|---|---|---|
| `src/domains/asignacion/` | New | Módulo nuevo. `motor-espera.ts` (función pública + tipos), `motor-espera.test.ts` (suite). |
| `src/domains/dominios-puros.guard.test.ts` | Unchanged | Sigue pasando; el nuevo módulo no introduce imports prohibidos. |
| `openspec/specs/motor-espera-asignacion/spec.md` | New | Spec de la nueva capability (se escribe en la fase spec). |

Ninguna otra área se toca. No hay cambios a `maquina.ts`, `home-interno.ts`, `sesion-de-entrenamiento.ts`, schema, API, UI, seed ni middleware.

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **Confusión entre el predicado del motor y el filtro de `home-interno`** (`OCUPADA` tiene dos lecturas). | Media | El motor define su propio `esMaquinaUsable`, no importa ni llama a `home-interno.ts`. Test dedicado documenta ambas lecturas. El spec lo declara explícito. |
| **Unidades de la "misma máquina" malinterpretadas como una sola**. | Media | El spec incluye un escenario explícito con dos candidatos del mismo tipo; el motor los trata por `Maquina.id` y elige el de menor espera. |
| **Fórmula de ocupante sobre-estima la espera real** (porque asume inicio de serie). | Baja (intencional) | El spec documenta que la aproximación es conservadora: la espera real será ≤ calculada. Esto es seguro para la recomendación (nunca promete menos espera de la que habrá). |
| **`orden = 0` por defecto en ejercicios sin orden explícito** genera empates frecuentes. | Alta (esperada) | El desempate de tres niveles (posición en input, id) garantiza determinismo incluso en este caso. Escenario dedicado lo verifica. |
| **Crecimiento del archivo único** si se agregan helpers. | Baja | Ponytail: empezar con función única; extraer solo si pasa ~300 líneas. |
| **Validación duplicada con `EjercicioEnRutina`** cuando Etapa 4 construya el input. | Baja | Etapa 4 puede confiar en la validación del motor o pre-validar; el motor siempre valida su entrada (defensa en profundidad). |

## Plan de rollback

Esta etapa es **pura adición** de un módulo nuevo bajo `src/domains/asignacion/`. No toca schema, API, UI ni datos existentes.

**Rollback**: eliminar la carpeta `src/domains/asignacion/` y la spec. Ninguna otra parte del sistema la referencia (las Etapas 4/5 aún no existen). Cero riesgo de pérdida de datos ni de regresión en funcionalidad existente.

## Dependencias

- **Etapa 1 (`maquinas-crud`, D-73)**: el motor asume que `EstadoMaquina` existe con los cuatro valores. No lo importa; define su propia literal union equivalente.
- **Etapa 2 (`maquina-ejercicios`, D-74)**: el motor asume que cada ejercicio tiene una lista de máquinas candidatas (via `EjercicioMaquina`). No la consulta; la recibe por parámetro como `candidatos: string[]`.
- **Patrón de dominio puro** (`src/domains/maquina/`, `src/domains/pago/oferta-reactivacion.ts`): se copia la estructura de validación, el estilo de motivos como código y el patrón `ValidationResult`.
- **Guardián de dominios puros** (`src/domains/dominios-puros.guard.test.ts`): el nuevo módulo debe respetarlo.

## Pendientes a registrar

Los siguientes pendientes se registran en `openspec/decisions.md` con esta numeración, a partir de **P-61** (último registrado: P-60). Cada uno tiene su fase dueña; esta etapa no los implementa.

| ID | Descripción | Fase dueña |
|---|---|---|
| **P-61** | Salida de emergencia del flujo obligatorio: máquina rota durante la sesión o socio lesionado → reasignación por instructor. No es parte del motor puro; requiere estado de sesión y permisos de instructor. | Etapa 4 |
| **P-62** | Simulación comparativa para la tesis: espera promedio del motor vs. seguir orden de rutina, con N socios y M máquinas. Escenario propio posterior a la Etapa 5. | Posterior a Etapa 5 |
| **P-63** | Documentación de la limitación del criterio "solo-espera" (sin orden fisiológico) para el informe de tesis. Limitación declarada; no se resuelve en esta iniciativa. | Diseño + informe de tesis |
| **P-64** | El cálculo en check-in debe ser **best-effort**: nunca bloquea ni falla el registro de asistencia. Capa de servicio/API, no de dominio. | Etapa 4 |
| **P-65** | Reserva provisional con vencimiento configurable (propuesta: 15 minutos sin iniciar rutina libera el lugar en cola). Requiere estado de sesión y temporizador. | Etapa 4 |
| **P-66** | Evaluar la API de Next 16 para trabajo posterior a la respuesta, leyendo `node_modules/next/dist/docs` antes de proponerla. | Etapa 4 |

## Criterios de aceptación de la etapa (alto nivel)

Estos criterios serán refinados en la spec con escenarios y aserciones exactas.

- [ ] Existe `src/domains/asignacion/motor-espera.ts` con función pública `calcularEspera`.
- [ ] El módulo no importa `@/lib/db`, `@prisma/client` ni repositorios; `dominios-puros.guard.test.ts` sigue verde.
- [ ] La entrada del motor está desacoplada de Prisma: tipos propios (`EjercicioPendiente`, `MaquinaEnGimnasio`, etc.).
- [ ] `segundosEjecucionSerie` se recibe por parámetro, no está hardcodeado.
- [ ] Validación de dominio: `series >= 1`, `descanso >= 0`, `segundosEjecucionSerie > 0`. Valores inválidos → error estructurado, no excepción.
- [ ] Predicado propio de máquina usable: `DISPONIBLE` y `OCUPADA` usables; `FUERA_DE_SERVICIO` e `INACTIVAS` no. Test dedicado.
- [ ] Fórmulas de ocupante y miembro en cola implementadas según la especificación, con valores conservadores.
- [ ] Desempate determinista en tres niveles: `orden` → posición en input → `id`.
- [ ] Ejercicio sin máquina usable → bloqueado con código de motivo, excluido de la recomendación.
- [ ] Todos los ejercicios bloqueados → resultado `sin_opciones` con lista de bloqueados, no throw.
- [ ] Sin ejercicios pendientes → resultado `vacio`.
- [ ] El resultado de éxito lleva `recomendado`, `siguienteEnOrden`, `ahorro` y `bloqueados`.
- [ ] Suite de tests con los escenarios del explore.md, valores numéricos calculados a mano, descripciones en español.
- [ ] `npm test` verde, `tsc --noEmit` verde, sin nuevos errores de lint.

## Numeración

- Última decisión registrada: **D-74** (asignación dinámica de ejercicios, M2M). Esta etapa usará **D-75+** para las decisiones que se registren en diseño/spec.
- Última tarea registrada: **T-054r** (cierre documental Etapa 2). Esta etapa usará **T-055+**.
- Último pendiente registrado: **P-60** (semilla de Etapa 3). Esta etapa registra **P-61 a P-66** (ver tabla de pendientes).

Confirmado contra `openspec/decisions.md` y `openspec/sdd-tasks-tdd.md`.
