# Exploration: motor-espera (Etapa 3 — Motor de espera y sugerencia)

## Contexto y objetivo

Etapa 3 de la iniciativa "asignación dinámica de ejercicios". Construye un **motor de dominio puro** que, dado el estado del gimnasio en un instante, calcula cuánto debe esperar cada ejercicio pendiente de la rutina de un socio y recomienda cuál hacer ahora. Esta etapa es **sólo lógica de dominio + tests**: sin DB, sin API, sin pantallas, sin migraciones. La integración con check-in, sesión y pantalla queda para las Etapas 4 y 5.

Encadenamiento con etapas previas:

- **Etapa 1** (`maquinas-crud`, D-73): catálogo de máquinas con `EstadoMaquina`, validación pura, `puedeEliminar`.
- **Etapa 2** (`maquina-ejercicios`, D-74): relación M2M `EjercicioMaquina` (máquinas por ejercicio), validación pura de asignación, repositorio.

El motor de la Etapa 3 consume como **entrada** los conceptos modelados en 1 y 2 (máquinas, estados, asociaciones ejercicio-máquina), pero **no los importa** desde Prisma ni desde repositorios: recibe todo por parámetros, manteniéndose puro y re-ejecutable.

## Estado actual del código

### Modelo de datos relevante (prisma/schema.prisma)

- `EjercicioEnRutina` (líneas 333–352): tiene `series Int`, `repeticiones Int`, `descanso Int // segundos`, `orden Int @default(0)`. Clave única `@@unique([rutinaId, ejercicioId])`. **Verificado: coincide con el modelo del usuario.**
- `EstadoMaquina` (líneas 403–408): `DISPONIBLE | OCUPADA | FUERA_DE_SERVICIO | INACTIVA`. **Verificado: coincide exactamente con lo declarado.**
- `EjercicioMaquina` (líneas 414–425): tabla explícita M2M con `@@unique([maquinaId, ejercicioId])`, `onDelete: Cascade` en ambos lados, índices secundarios en ambas FK. **Verificado: permite múltiples máquinas por ejercicio** (un ejercicio se asocia a N máquinas distintas).
- `SesionDeEntrenamiento` (líneas 462–485): guarda `ejercicioActualId String?` y `serieActual Int?`. **Verificado: coincide.**
- `Maquina` (líneas 381–395): `estado EstadoMaquina`, sin campo de "unidades" ni "cantidad" — cada unidad física es una fila distinta de `Maquina`.

### Dominio de máquina (src/domains/maquina/maquina.ts)

- `ESTADOS_ASIGNABLES = ["DISPONIBLE", "FUERA_DE_SERVICIO", "INACTIVA"]` (líneas 5–9): **excluye `OCUPADA`**. `validateMaquina` rechaza `OCUPADA` con "El estado OCUPADA no puede asignarse desde este panel" (líneas 78–79). Coincide con la regla del usuario: `OCUPADA` es estado derivado de sesiones, no asignable desde CRUD.
- `puedeEliminar(_maquina, { ejerciciosAsociados })` (líneas 172–183): retorna `{ permitido: boolean; motivo: string | null }`. **Patrón de motivo existente** para diseño.
- `validarAsignacionPrevia` / `validarAsignacionEjercicios`: funciones puras con `ReadonlySet` inyectado (D-74). Plantilla a copiar para la validación del motor.
- Tipo de error: `ResultadoAsignacion = { ok: true; ... } | { ok: false; code: ErrorAsignacion; message: string }`. **Patrón de unión discriminada** existente.

### Sesión (src/domains/sesion/sesion-de-entrenamiento.ts)

- Orden de ejercicios: `mapearEjercicios` ordena por `orden` ascendente (línea 163).
- Avance al siguiente ejercicio en `registrarSerie` (líneas 460–471): al completar las series del ejercicio actual, pasa al siguiente `ejercicios[idxActual + 1]` (por `orden`). **Verificado: el "siguiente en orden de la rutina" ya está implementado aquí.**
- `descanso` se usa como segundos entre series (comentario línea 12: "El cronómetro de descanso se calcula fuera de acá"). **Verificado: `descanso` es por ejercicio-en-rutina (entre series), coincide.**

### Otros dominios puros existentes (patrones a replicar)

- `src/domains/sesion/progreso-sesion.ts`: funciones puras `contarProgreso`, `porcentajeDeProgreso`, `formatearTranscurrido`. Modelo de dominio puro con tipos propios.
- `src/domains/home-socio/descanso.ts`: `calcularDescanso(inicio, descansoSegundos, ahora)` y `formatearDescanso`. **Pura, sin reloj propio** (`ahora` inyectable).
- `src/domains/sesion/progresion-ejercicio.ts`: retorna `{ carga, motivo: string }`. **El `motivo` en este dominio es texto legible para el usuario** (no código).
- `src/domains/pago/oferta-reactivacion.ts`: retorna `{ elegible: false; motivo: MotivoNoElegible }` donde `motivo` es un **código** ("OFERTA_APAGADA", "CUOTA_NO_VENCIDA", etc.). **Dos estilos de motivo conviven en el proyecto** (código vs. texto).
- `src/domains/rutina/rutina.ts`: validación pura con `{ valid, errors }` tipo `ValidationResult`.

### Restricción de dominio puro

- `src/domains/dominios-puros.guard.test.ts` (51 líneas): prohíbe cualquier `import ... from "@/lib/db"` **estático** en archivos no-test de `src/domains`. El motor y todos sus tipos deben vivir sin importar `@/lib/db`, `@prisma/client`, ni repositorios. **Obligatorio.**

### Módulo objetivo

- `src/domains/asignacion/` **no existe aún**. Se crea en esta etapa.

## Verificación de las premisas del usuario (contradicciones)

| Premisa | Evidencia | ¿Contradicción? |
|---------|-----------|-----------------|
| `EjercicioEnRutina` tiene `series`, `descanso`, `orden` | schema.prisma:339–342 (`series Int`, `descanso Int // segundos`, `orden Int @default(0)`) | **No coincide → SÍ coincide.** Verificado. |
| `EstadoMaquina` es exactamente `DISPONIBLE \| OCUPADA \| FUERA_DE_SERVICIO \| INACTIVA` | schema.prisma:403–408 | **No coincide → SÍ coincide.** Verificado. |
| `EjercicioMaquina` permite múltiples máquinas por ejercicio | schema.prisma:414–425 (M2M con @@unique([maquinaId, ejercicioId])) | **No coincide → SÍ coincide.** Verificado. |
| Varios candidatos pueden ser unidades de la "misma máquina" | schema.prisma NO tiene campo `unidades`/`cantidad` en `Maquina`; cada unidad física es una fila distinta. | **Tensión, no contradicción.** El motor ve "varias máquinas con mismo tipo/nombre" como candidatos distintos; el empate se resuelve por cuál se libera primero. Diseño debe documentar que la identidad del candidato es `Maquina.id`, no el tipo de equipamiento. |
| `sesion-de-entrenamiento.ts` guarda `ejercicioActualId`/`serieActual` y calcula el siguiente ejercicio | schema.prisma:473–475 (campos), `registrarSerie` líneas 460–471 (avance), `mapearEjercicios` línea 163 (por `orden`) | **No coincide → SÍ coincide.** Verificado. |
| `descanso` es por serie (entre series de un ejercicio) | schema.prisma:341 (`descanso Int // segundos` en `EjercicioEnRutina`), uso en `sesion-de-entrenamiento.ts` | **No coincide → SÍ coincide.** Verificado. |

**Hallazgo adicional relevante:**

- `src/domains/home-interno/home-interno.ts:34` filtra máquinas disponibles como `m.estado !== "FUERA_DE_SERVICIO" && m.estado !== "INACTIVA"` — es decir, trata `OCUPADA` como **no disponible**. Esto contradice la regla del motor que trata una fila `OCUPADA` heredada como `DISPONIBLE`. **Diseño debe resolver esta tensión**: el motor ve `OCUPADA` legada como usable (la ocupación real proviene de sesiones activas, no del estado persistido), mientras `home-interno` la trata como ocupada. Son dos semánticas distintas del mismo valor persistido; el motor NO debe reutilizar el filtro de `home-interno`.

## Tensiones y decisiones abiertas para diseño

1. **Nombre y ubicación del módulo**: `src/domains/asignacion/` (lo más alineado con "asignación dinámica") vs. `src/domains/motor-espera/` vs. `src/domains/espera/`. Impacta en el nombre público de la función principal y el vocabulario de los tipos. Diseño debe elegir y justificar.

2. **Forma de entrada/salida**:
   - Opción A: una única función pura `calcularEspera(gimnasio, rutina, params) → Resultado`.
   - Opción B: descomposición en funciones pequeñas (`calcularOcupante`, `calcularCola`, `calcularEsperaEjercicio`, `seleccionarRecomendado`).
   - El resultado incluye: ejercicio recomendado, siguiente-en-orden, tiempos de espera de ambos, ahorro, y lista de ejercicios bloqueados con su motivo. Debe definirse si es un único objeto o una unión discriminada (`sinOpciones` | `vacio` | `resultado`).

3. **Representación de miembros provisionales vs. reales sin filtrar persistencia**: el motor no conoce "sesión" ni "check-in". Para los momentos (a) check-in y (b) inicio de rutina, el socio aún no tiene sesión: el motor debe aceptar la lista completa de ejercicios con `series = 1` (o la serie en curso real) más el estado de gimnasio. Diseño debe definir un tipo de entrada que represente "un ejecutante pendiente" (id, ejercicio, series restantes, máquinas candidatas) sin acoplarlo a `SesionDeEntrenamiento`.

4. **Vocabulario de `motivo` para ejercicios bloqueados**: dos estilos conviven en el proyecto:
   - **Código**: `oferta-reactivacion.ts` usa `"OFERTA_APAGADA"`, `"CUOTA_NO_VENCIDA"` (constantes).
   - **Texto**: `progresion-ejercicio.ts` usa `"Hiciste todas las repeticiones la última vez: +2.5 kg."`.
   - `puedeEliminar` (maquina.ts) usa texto: `"3 ejercicios usan esta máquina"`.
   - Diseño debe elegir y documentar el vocabulario de motivos de bloqueo (`SIN_MAQUINAS_ASOCIADAS`, `TODAS_FUERA_DE_SERVICIO`, etc.) y su estilo.

5. **`sinOpciones` como flag o como unión discriminada**: si todos los ejercidos pendientes están bloqueados, el motor no debe fallar. Opciones: campo `sinOpciones: boolean` en el resultado, o tipo `ResultadoMotor = { tipo: "sin_opciones"; motivos } | { tipo: "exito"; ... } | { tipo: "vacio" }`. La segunda es más type-safe.

6. **Criterio de desempate por `orden` de rutina**: definido por Fernando (empate en espera → menor `orden`). `EjercicioEnRutina.orden` es `@default(0)`, por lo que ejercicios sin orden explícito empatan en 0. Diseño debe documentar el comportamiento cuando varios ejercicios tienen el mismo `orden` (¿desempate estable por id?).

7. **Re-ejecubilidad / determinismo**: el motor no usa reloj. Todos los tiempos se pasan como números (segundos). La "ocupación restante" del ocupante actual se calcula con la fórmula aproximada dada por el usuario (asume que está al inicio de su serie actual). Esto es intencionalmente **conservador** (sobre-estima la espera real). Diseño debe documentar por qué: el ocupante real puede haber avanzado dentro de su serie, por lo que la espera real será menor o igual al cálculo; sobre-estimar es seguro para la recomendación (nunca promete menos espera de la que realmente habrá).

8. **La aproximación del ocupante**: fórmula `seriesRestantes × segundosEjecucionSerie + (seriesRestantes − 1) × descanso`. Si el ocupante terminó su última serie, libera sin descanso posterior. Diseño debe dejar claro que la serie actual YA está en curso (el descaso posterior a la serie actual está incluido solo si hay series restantes después de la actual).

## Riesgos y contradicciones con el alcance

1. **`OCUPADA` tiene dos significados en el proyecto**: `home-interno` la trata como no-usable; el motor trata `OCUPADA` legada como usable (la ocupación real viene de sesiones). **Riesgo**: confusión si se comparten helpers. Mitigación: el motor define su propio predicado `esMaquinaUsable(estado)` y NO reutiliza el filtro de `home-interno`. Documentar la diferencia.

2. **Unidades de la misma máquina**: el esquema no tiene campo de cantidad. "Varias unidades" = varias filas `Maquina` con mismo tipo/nombre. Si el gimnasio tiene 3 bancos planos, son 3 filas. El motor los trata como candidatos independientes. **Riesgo**: el usuario espera un concepto explícito de "unidad". Mitigación: documentar que la granularidad del motor es `Maquina.id` y que el gimnasio modela cada unidad física como una fila distinta (convención a validar con Fernando en diseño).

3. **`segundosEjecucionSerie` como parámetro de entrada, no constante configurable**: hoy es 60 s fijo según la decisión del usuario. En Etapa 4 pasa a `/configuracion`. Si diseño lo parameteriza limpio (inyección), la transición a configuración es trivial. Si se hardcodea, la Etapa 4 requiere tocar el motor. **Recomendación**: parameterizar desde ahora (es el mismo esfuerzo y no viola el alcance).

4. **No hay validación de `descanso` en `EjercicioEnRutina`**: el esquema permite `descanso Int` sin restricción de mínimo. El motor debe validar `descanso >= 0`, `series >= 1`, `segundosEjecucionSerie > 0`, igual que `src/domains/maquina/`. Si llegan valores negativos, error de validación de dominio (mismo patrón `ValidationResult`).

5. **Rendimiento**: para gimnasios grandes (N máquinas, M miembros en cola), el cálculo es O(Ejercicios × Máquinas × Cola). Al ser puro y llamado en momentos puntuales (check-in, inicio, fin de ejercicio), el volumen es acotado. Si en Etapa 5 se usa para simulación masiva (tesis), performance podría importar. **Fuera de alcance ahora**, pero diseño debe mantener la función pura y separable para optimizar después.

## Escenarios de prueba propuestos

(Para numerar en fase spec. Nombre + lo que demuestra.)

1. **gimnasio vacío**: un ejercicio, una máquina disponible, sin ocupante, sin cola. Espera = 0. Recomendado = siguiente en orden = el único ejercicio. Ahorro = 0.
2. **ocupante en la misma máquina**: un ejercicio cuya única máquina tiene un ocupante con 2 series restantes. Espera = 2×60 + 1×descanso. Recomendado espera ese tiempo.
3. **cola de tres en la máquina**: ocupante actual + 3 miembros en cola. Espera = tiempo ocupante + 3 × tiempo total del ejercicio de cada miembro en cola.
4. **dos unidades de la misma máquina (mismo tipo)**: ejercicio con dos candidatos tipo "banco", uno ocupado y otro libre. El candidato libre gana (espera 0 vs. espera > 0).
5. **máquina fuera de servicio**: el único candidato del ejercicio está `FUERA_DE_SERVICIO`. Ejercicio bloqueado con motivo. Excluido de recomendación.
6. **ejercicio sin máquina asociada**: candidatos vacíos. Espera = 0, nunca espera (según alcance del usuario).
7. **todos bloqueados**: ningún ejercicio tiene máquina usable. Resultado `sinOpciones`, no falla.
8. **empate en espera**: dos ejercicios con espera idéntica. Gana el de menor `orden` de rutina.
9. **recomendado igual a siguiente en orden**: el ejercicio que menos espera es también el primero en la rutina. Ahorro = 0 (no hay elección real).
10. **ahorro positivo**: el recomendado no es el siguiente en orden (hay un salto). Ahorro = espera(siguiente_en_orden) − espera(recomendado) > 0.
11. **socio recién check-in con rutina completa**: todos los ejercicios con `series = 1` como pendientes (momento a/b). Verifica que el motor acepta la lista completa inicial.
12. **validación de entrada inválida**: `series = 0` o `descanso < 0` o `segundosEjecucionSerie <= 0`. Error de validación de dominio.

## Numeración

- Última decisión registrada: **D-74** (asignación dinámica ejercicios, M2M). Siguiente libre: **D-75+**.
- Última tarea registrada: **T-054r** (cierre documental Etapa 2). Siguiente libre: **T-055+**.
- Último pendiente registrado: **P-60** (asignación automática/sugerida por equipamiento, semilla para Etapa 3 sugerencia). Siguiente libre: **P-61+**.

Confirmado contra `openspec/decisions.md` (D-70 a D-74) y `openspec/sdd-tasks-tdd.md` (T-054r como última tarea completada).

## Pendientes a registrar

(Se registran ahora para no perderlos; su implementación se delega a la fase indicada.)

- **P-61+** — Salida de emergencia del flujo obligatorio (máquina rota / socio lesionado → reasignación por instructor). **Etapa 4.** (no es parte del motor puro)
- **P-62+** — Simulación comparativa para tesis (espera promedio vs. seguir orden de rutina, N socios, M máquinas). **Después de Etapa 5** (escenario propio)
- **P-63+** — Documentación de la limitación del criterio "solo menor espera" (no considera orden fisiológico). **Registrar en diseño y tesis** (limitación declarada)
- **P-64+** — El cálculo en check-in debe ser "best-effort" y NUNCA bloquear ni fallar el registro de asistencia. **Etapa 4** (capa API/servicio)
- **P-65+** — Reserva provisional con expiración configurable (propuesta: 15 min sin iniciar rutina libera el lugar en cola). **Etapa 4**
- **P-66+** — Evaluar API de Next 16 para trabajo post-respuesta, leyendo `node_modules/next/dist/docs` antes de proponer. **Etapa 4**

## Recomendación

Proceder a diseño con el siguiente enfoque:

1. **Módulo**: `src/domains/asignacion/` con un archivo principal `motor-espera.ts` (la función pública) y tipos en el mismo archivo o `tipos.ts`. Respetar `dominios-puros.guard.test.ts`: cero imports de `@/lib/db` o `@prisma/client` en todo el módulo.

2. **Función pública única y pura**: `calcularEspera(input: EntradaMotor) → ResultadoMotor`. Toda la inyección por parámetros (estado de gimnasio, ejercios pendientes, `segundosEjecucionSerie`). Sin reloj, sin aleatoriedad.

3. **Tipos de entrada desacoplados de Prisma**: definir `EjercicioPendiente { id, orden, series, descanso, maquinaIds: string[] }` y `MaquinaEnGimnasio { id, estado, ocupanteActual: Ocupante | null, cola: ColaMiembro[] }` — no usar tipos Prisma directamente, para mantener el desacople y la re-ejecubilidad.

4. **Unión discriminada para el resultado**: `type ResultadoMotor = { tipo: "exito"; recomendado: Sugerencia; siguienteEnOrden: Sugerencia; ahorro: number; bloqueados: Bloqueado[] } | { tipo: "sin_opciones"; bloqueados: Bloqueado[] } | { tipo: "vacio" }`. Type-safe y evita flags sueltos.

5. **Validación al entrada con el patrón existente**: `validarEntradaMotor(input): { valid: boolean; errors: string[] }` (igual firma que `validateMaquina`), y la función principal lanza `VALIDATION_ERROR` si la entrada es inválida.

6. **Vocabulario de motivos de bloqueo por código** (alineado con `oferta-reactivacion.ts`): `SIN_MAQUINAS_ASOCIADAS`, `TODAS_FUERA_DE_SERVICIO`, `TODAS_INACTIVAS`. Los mensajes para usuario se mapean en la capa API (Etapa 4), no en dominio.

7. **Parámetro `segundosEjecucionSerie`** como número inyectable (no constante hardcodeada dentro del motor), para que la transición a `/configuracion` en Etapa 4 sea trivial.

8. **Suite de tests**: un archivo `motor-espera.test.ts` con los 12 escenarios nombrados arriba, valores calculados a mano, describiendo cada escenario en español (convención de tests del proyecto: `describe`/`it` en español, ej. `describe("calcularEspera", ...)`). Cada escenario con su valor numérico exacto para citar en el informe de tesis.

**Tradeoffs**: una función monolítica simple es más fácil de razonar pero menos componible; descomponer en funciones internas (Opción B) da tests más finos y reutilización. Se recomienda **empezar con la función pública única** y extraer helpers internos sólo si la complejidad lo justifica (ponytail: la solución más pequeña que resuelve el problema completo).
