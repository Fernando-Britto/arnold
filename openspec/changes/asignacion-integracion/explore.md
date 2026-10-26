# Exploración: asignacion-integracion (Etapa 4 — Integración del motor de espera)

## Contexto y objetivo

Esta etapa conecta el motor puro de espera (`src/domains/asignacion/motor-espera.ts`, Etapa 3) con la realidad del sistema: persistencia, check-in, sesión de entrenamiento y configuración. La Etapa 1 (CRUD de máquinas, D-73) y la Etapa 2 (M2M ejercicio-máquina, D-74) construyeron el catálogo y la relación que alimentan los candidatos del motor. La Etapa 3 definió el contrato puro del motor: `EntradaMotor { ejercicios, maquinas, parametros }` y `ResultadoMotor`. La Etapa 4 lo haceusable. La Etapa 5 (fuera de alcance) construye la pantalla del socio y la reasignación del instructor.

**Objetivo**: que un socio con rutina activa, al hacer check-in, reciba una sugerencia de ejercicio+máquina que reserve un lugar en cola; que esa sugerencia persista, venza, y se recalcule al iniciar rutina y tras cada ejercicio; y que dos parámetros nuevos (`segundosEjecucionSerie`, `minutosVencimientoReserva`) se configuren desde `/configuracion`. Sin pantalla, sin reasignación de instructor.

---

## Estado actual del código

### Motor (dominio puro, sin I/O)

- `src/domains/asignacion/motor-espera.ts:258` — `calcularEspera(entrada: EntradaMotor): ResultadoMotor`
- Tipos públicos: `EntradaMotor`, `EjercicioPendiente`, `MaquinaEnGimnasio`, `Ocupante`, `ColaMiembro`, `ParametrosMotor`, `Sugerencia`, `ResultadoMotor` (unión discriminada: `invalido | exito | sin_opciones | vacio`).
- Parámetro inyectado: `parametros.segundosEjecucionSerie` (motor nunca lo hardcodea; el spec dice 60).
- `maquinaId` en `Sugerencia` (D-84): la unidad elegida para reservar.
- `descanso` es **per-actor** (D-82): el del ocupante y el de cada miembro de cola, no el del ejercicio pendiente.

### Check-in: dos rutas, UN servicio compartido

- `src/api/acceso.ts:164` — `evaluarYRegistrarAcceso(prisma, socio, { ip, userAgent, metodo, ahora })`.
  - Calcula `estadoCuotaSocio` + anti-passback, decide con `decidirAcceso`, y persiste **en una `$transaction`** `Asistencia` + `AuditoriaAcceso` (líneas 198-220).
  - Este es el **punto único** al que llaman ambas rutas. NO hay lógica de decisión duplicada.
- `src/app/api/acceso/check-in/route.ts:20` — `handleCheckInRequest` (recepción, rol ADMIN/RECEPCIONISTA).
- `src/app/api/dispositivo/acceso/route.ts:28` — `POST` (puerta, autenticación de dispositivo).
- `src/api/acceso.ts:239` — `handleCheckIn(input)` — verifica DNI+PIN y delega en `evaluarYRegistrarAcceso`.

**Hallazgo crítico**: el punto de anclaje del cálculo es `evaluarYRegistrarAcceso`. Después de su `$transaction` (línea 220) y antes del `return` (línea 222), el `CheckInResultado` ya incluye `socio.id` — justo lo necesario para alimentar el motor. El gancho (hook) debe vivir **aquí**, no en las rutas, ni duplicarse para huella.

### Sesión de entrenamiento

- `src/domains/sesion/sesion-de-entrenamiento.ts` — `iniciarSesion`, `registrarSerie`, `finalizarSesion`, `detalleSesionEnCurso`.
- `ejercicioActualId` y `serieActual` en `SesionDeEntrenamiento` (D-44): definen el ejercicio y la serie en curso.
- `registroDeProgreso.numeroSerie` (1-based) con `tipo` (D-64): `CALENTAMIENTO` y `DROP_SET` llevan `numeroSerie: null` y **no avanzan la sesión**.
- El "ejercicio siguiente" hoy se deriva del orden de `EjercicioEnRutina` dentro de la `RutinaAsignada`. Con asignación obligatoria vendrá de la sugerencia aceptada.

### Rutina asignada (RN-04)

- `RutinaAsignada.activa: Boolean @default(true)` con índice `@@index([socioId, activa])` (`schema.prisma:365,372`).
- `src/domains/rutina/asignar-rutina.ts:85-98` — `asignarRutina` desactiva las previas en una transacción `Serializable` y crea la nueva con `activa = true`.
- Consulta de la activa: `prisma.rutinaAsignada.findFirst({ where: { socioId, activa: true } })` — patrón existente en `src/api/home-socio-data.ts:108` y `src/api/home-socio-secciones-data.ts:57`.

### Configuración (patrón D-54)

- `src/lib/configuracion.ts` — `getConfiguracion(db?)` lee la fila más reciente (`orderBy: updatedAt desc`) con defaults por campo.
- `src/domains/configuracion/configuracion.ts:9` — `CAMPOS_CONFIGURACION` define tipo y rango; `validarCambiosConfiguracion` pura.
- `src/api/configuracion.ts` / `/api/configuracion` — `PUT` con auditoría en `RegistroDeAuditoria`.
- `ConfiguracionDelSistema` es efectivamente una **fila única** (sin restricción única en schema; el código asume la más reciente).

### Máquinas y estado OCUPADA

- `schema.prisma:403-408` — `EstadoMaquina { DISPONIBLE, OCUPADA, FUERA_DE_SERVICIO, INACTIVA }`.
- `src/domains/maquina/maquina.ts:78` y `src/api/maquinas.ts:80,131` — escribir `estado = "OCUPADA"` se rechaza con `ESTADO_NO_ASIGNABLE` (400).
- **Ningún código de producción escribe `Maquina.estado = OCUPADA`**. La decisión de D-73 (confirmada en diseño de Etapa 1) es que `OCUPADA` es estado derivado de sesiones EN_CURSO, nunca persistido. Esto es coherente con el alcance de Etapa 4.

---

## Estado real de los datos que el motor necesita

| Entrada del motor | ¿Existe hoy? | Fuente | Falta |
|---|---|---|---|
| `ejercicios[].id, orden, series, descanso` | Sí | `RutinaAsignada` → `Rutina.ejercicios` (`EjercicioEnRutina.{id, orden, series, descanso}`) | — |
| `ejercicios[].candidatos: string[]` (maquinaId) | Sí | `EjercicioMaquina.maquinaId` (Etapa 2, D-74) | — |
| `maquinas[].id, estado` | Sí | `Maquina.{id, estado}` | — |
| `maquinas[].ocupante: { seriesRestantes, descanso }` | Parcial | `SesionDeEntrenamiento` EN_CURSO con `ejercicioActualId` + `serieActual`. Los registros de progreso del serie actual permiten derivar series restantes (`EjercicioEnRutina.series - seriesDeTrabajoRegistradas`). `descanso` = `EjercicioEnRutina.descanso` del ejercicio que el ocupante está haciendo. Hay que filtrar `tipo <> CALENTAMIENTO` (D-64) y excluir `DROP_SET` (D-69) del conteo. | Construir la consulta |
| `maquinas[].cola: ColaMiembro[]` | **No** | No existe tabla de reservas/asignaciones | **Nueva tabla** (diseño debe definirla) |
| `cola[].descanso` | Parcial | Cada miembro en cola lleva su propio `descanso` (D-82). Presupone que sabemos qué ejercicio va a hacer ese miembro. | Definir cómo se asocia |
| `parametros.segundosEjecucionSerie` | **No** | No existe columna | **Nueva columna** + default 60 |
| `minutosVencimientoReserva` | **No** | No existe columna | **Nueva columna** + default 15 |
| `ahora` (reloj) | Sí | Inyectado por el llamante (patrón existente en `CheckInInput.ahora`, `IniciarSesionInput.ahora`) | — |

### Series restantes: trampa de drop sets y calentamientos

- `RegistroDeProgreso.numeroSerie` es `null` para `CALENTAMIENTO` y `DROP_SET` (`sesion-de-entrenamiento.ts:448,521`).
- El conteo de series hechas para el ocupante debe filtrar `SOLO_SERIES_DE_TRABAJO` (`tipo <> CALENTAMIENTO`) y **excluir DROP_SET** (que no ocupa serie de la rutina, D-69).
- `seriesRestantes = prescripcion.series - count(registros where tipo in (NORMAL, HASTA_EL_FALLO) AND numeroSerie <= prescripcion.series)`.
- El motor exige `seriesRestantes >= 1` (D-87). Quien arma la entrada debe garantizarlo: si el socio ya terminó, no viene como ocupante.

---

## Contradicciones con el alcance

**(a) ¿Check-in tiene un único punto compartido?** — **SÍ, verificado.** `evaluarYRegistrarAcceso` en `src/api/acceso.ts:164` es el único camino después de la identidad. La ruta de dispositivo (`/api/dispositivo/acceso`) también lo llama indirectamente. No hay divergencia en la decisión de acceso. El gancho del motor va aquí, no en las rutas.

**(b) ¿`RutinaAsignada` tiene noción de "activa"?** — **SÍ, verificado.** `activa: Boolean @default(true)` con índice compuesto (`schema.prisma:365,372`). RN-04 se enforcea en aplicación (sin partial unique index, según D-73 y `asignar-rutina.ts:85-98`). Consulta patrón: `findFirst({ where: { socioId, activa: true } })`.

**(c) ¿`RegistroDeProgreso` permite derivar series restantes confiablemente?** — **SÍ, con salvedades.** `numeroSerie` (1-based, solo NORMAL/HASTA_EL_FALLO) más `tipo` (D-64, D-69). Calentamientos y drop sets llevan `numeroSerie: null` y no avanzan la sesión. La derivación requiere filtrar por tipo y descontar drop sets. Es confiable si el filtro es correcto. Trampa: los registros pre-D-64 no tienen `tipo` (default `NORMAL` en schema, `RegistroDeProgreso.tipo @default NORMAL`), así que se comportan como series de trabajo correctas.

**(d) ¿`ConfiguracionDelSistema` es singleton?** — **SÍ, de hecho.** No hay restricción única, pero `getConfiguracion` toma `orderBy updatedAt desc, take 1 implícito`. Las dos columnas nuevas (`segundosEjecucionSerie`, `minutosVencimientoReserva`) se agregan como `NOT NULL DEFAULT` aditivas, igual que `oferta_reactivacion` en T-045b.

**(e) ¿La lógica de "ejercicio siguiente" de la sesión es pura y testeable?** — **Parcialmente.** La lógica vive en `sesion-de-entrenamiento.ts` mezclada con Prisma (import diferido, `prisma.$transaction`). No es un módulo puro. Los tests existentes mockean Prisma. Con asignación obligatoria, el "siguiente" viene de la sugerencia aceptada — hay que inyectarla sin romper los tests actuales (que asumen orden de rutina).

**(f) ¿Algo ya escribe `Maquina.estado = OCUPADA`?** — **NO.** Verificado por grep: solo el validador de maquina (`maquina.ts:78`, `api/maquinas.ts:80`) la **rechaza**. Ningún código la escribe. Coherente con el alcance.

**(g) ¿El motor puede alimentarse sin cambiarlo?** — **SÍ.** `EntradaMotor` recibe exactamente los datos que el sistema puede producir. `MaquinaEnGimnasio.estado` viene de `Maquina.estado` (sin escribir OCUPADA). `ocupante` derivado de sesiones. `cola` de la nueva tabla. El motor no necesita ningún cambio. **No se toca `motor-espera.ts`.**

---

## Riesgos y trampas técnicas

1. **Concurrencia en la reserva**: dos check-in simultáneos pueden elegir la misma máquina. `pg_advisory_xact_lock(hashtext('maquina:' || maquinaId))` dentro de la transacción de reserva serializa sin bloquear lectura. Alternativa: uniqueness parcial sobre `(maquinaId)` en estado RESERVADA — pero eso impone "una sola reserva activa por máquina", que es justo lo que no queremos (la cola permite varias). El advisory lock a nivel de gimnasio (`hashtext('gym:' || gimnasioId)`) sería innecesariamente global. **Recomendación**: advisory lock por máquina dentro de la transacción. Probar contra Docker Postgres (D-53) con dos check-in concurrentes.

2. **Transacciones con Prisma**: `evaluarYRegistrarAcceso` ya envuelve Asistencia+AuditoriaAcceso en `$transaction`. La reserva del motor podría ser una **transacción separada** (no anidada) para no mantener la fila de Asistencia bloqueada durante el cálculo del motor. Si el motor falla, la asistencia ya se registró (best-effort).

3. **Lazy expiry (sin cron)**: las reservas vencidas se ignoran al construir la cola (`WHERE estado = 'RESERVADA' AND vencimiento > :ahora`). El `ahora` se inyecta como argumento del servicio. Riesgo: una reserva "vencida" que nunca se limpa crece indefinidamente. **Mitigación**: el cálculo de cola las filtra; una limpieza batch periódica queda como P futuro.

4. **Doble check-in del mismo socio**: anti-passback ya lo resuelve (`src/api/acceso.ts:181-185`). El motor se invoca solo en check-ins `PERMITIDOS` (después de `evaluarYRegistrarAcceso`). Si el socio ya tiene una reserva activa y vuelve a check-in (ventana anti-passback), se decide si recalcular o mantener.

5. **Interacción con anti-passback**: el cálculo de sugerencia ocurre **después** de que `Asistencia` se persistió. Si el motor lanza, la asistencia ya está registrada → best-effort se cumple solo si el cálculo es un paso posterior que no hace throw hacia arriba. El catch en `evaluarYRegistrarAcceso` (o el wrapper del motor) debe registrar el error y responder igual.

6. **Inyección de `ahora`**: `CheckInInput.ahora` existe (`src/api/acceso.ts:114`). El constructor de entrada del motor debe recibir `ahora` como parámetro (no `Date.now()`), igual que el resto del sistema.

7. **Parámetros de configuración**: `segundosEjecucionSerie` debe ser `> 0` (motor lo valida, línea 163). `minutosVencimientoReserva` debe ser `>= 0`. Validación en `CAMPOS_CONFIGURACION` (rango entero) más migración `NOT NULL DEFAULT`.

---

## Opciones evaluadas

### 1. Tabla de asignaciones/reservas

| Opción | Forma | Pros | Contras | Recomendación |
|---|---|---|---|---|
| A. `AsignacionDeEjercicio` | `socioId, sesionId (NULL hasta iniciar), ejercicioId, maquinaId (NULL), estado, creadaEn, venceEn` | Una fila por reserva; estado explícito (`RESERVADA, EN_CURSO, COMPLETADA, VENCIDA, CANCELADA`); la cola se deriva filtrando. | Requiere migración; nombre por definir. | **A** |
| B. Reutilizar `SesionDeEntrenamiento` | Usar `ejercicioActualId` como "la reserva" | Sin migración | Mezcla semántica: la reserva es pre-sesión; la sesión empieza después. Rompe el modelo de sesión actual. | Descartada |

**Recomendación A**: tabla nueva con máquina de estados. Permite que la reserva exista antes de la sesión, venza independientemente, y no contamine `SesionDeEntrenamiento`.

### 2. Estrategia de bloqueo

| Opción | Mecanismo | Pros | Contras |
|---|---|---|---|
| A. Advisory lock por máquina | `pg_advisory_xact_lock(hashtext('maquina:' \|\| id))` | No bloquea lecturas; solo serializa reservas de la misma máquina | Requiere ejecutar SQL crudo (`$executeRaw`) en Prisma |
| B. Unique parcial | `WHERE estado = 'RESERVADA'` | Sin SQL crudo | Limita a UNA reserva por máquina (rompe cola) |
| C. Optimistic (updateMany con guard) | `updateMany where id AND estado=RESERVADA... count===0 → retry` | Sin lock extra | Bajo contención puede necesitar retries |

**Recomendación A** (advisory lock por máquina). La cola permite múltiples RESERVADAS, pero la **misma** reserva se escribe una vez. El lock evita que dos procesos lean "libre" y escriban simultáneamente en la misma máquina.

### 3. ¿Dónde vive el gancho de check-in?

| Opción | Lugar | Pros | Contras |
|---|---|---|---|
| A. Dentro de `evaluarYRegistrarAcceso`, después de la `$transaction` de Asistencia | Punto único, cubre recepción + huella | La asistencia ya persistió (best-effort garantizado) | Acopla motor al servicio de acceso |
| B. En las rutas, envolviendo `handleCheckInRequest` | Separación de capas | Habría que duplicar para la ruta de dispositivo | **Descartada** (duplica) |

**Recomendación A**: dentro de `evaluarYRegistrarAcceso` o en un wrapper que ambas rutas llamen **después** de la transacción de asistencia. Así el cálculo no bloquea la respuesta y la asistencia nunca se ve afectada por un fallo del motor.

### 4. `after` vs `await`

- **`after(() => { ... })`** de `next/server`: estable desde Next 15.1.0. Se ejecuta después de enviar la respuesta. Puede usar `cookies/headers` dentro del callback **si se llama desde Route Handlers** (doc: `after.md`, línea 66). En serverless (Vercel) requiere `waitUntil` (doc: línea 250).
- **`await` bloqueante**: responde solo después del cálculo.

**Recomendación**: evaluar `after` **solo si** Vercel provee `waitUntil` (no confirmado para esta app). Riesgo: serverless sin `waitUntil` mata la invocación al enviar la respuesta (P-28: despliegue en Vercel pendiente de prueba). **Alternativa más segura**: un **await acotado** con timeout interno. Si el motor falla o excede el timeout, se registra el error y se responde igual. No bloquea la respuesta porque el cálculo es rápido (dominio puro + consultas acotadas). El await en el servicio (no en la ruta) permite testear. **Recomendación**: await con timeout, no `after`, hasta que `waitUntil` en Vercel se verifique (P-28 abierto).

### 5. Integración con sesión

| Opción | Estrategia |
|---|---|
| A | Al iniciar sesión, recalcular desde las asignaciones existentes (si hay reserva válida, esa es la primera). |
| B | `ejercicioActualId` de la sesión se ignora para la sugerencia; el motor decide siempre desde la tabla de asignaciones. |

**Recomendación A**: la sesión **consume** la reserva (pasa a EN_CURSO). El motor se recalcula tras cada `registrarSerie` y al `iniciarSesion`. Si el socio no tiene asignaciones, la sesión funciona exactamente como hoy (orden de rutina, D-44, D-48).

### 6. Endpoints de sugerencia

- `GET /api/asignaciones/sugerencia?socioId=` → sugerencia actual (recomendado + siguiente en orden).
- `POST /api/asignaciones/decidir` con `{ accion: "ACEPTAR" | "ESPERAR" }` → confirma o pasa.
- Permisos: SOCIO sobre sus propias; ADMIN/INSTRUCTOR lectura.

---

## ¿Qué NO se puede probar en esta etapa?

- `after` en serverless (requiere Vercel con `waitUntil` — P-28 pendiente).
- Concurrencia real de reservas contra Supabase (pooler con `connection_limit=1`). **Sí se puede** con Docker Postgres (D-53) usando `scripts/test-integration.mjs` y `pg_advisory_xact_lock`.
- Comportamiento del motor bajo carga (P-62, posterior a Etapa 5).
- Integración con la pantalla del socio (Etapa 5).
- Reasignación por instructor (P-61, Etapa 5).

---

## Escenarios candidatos (spec)

| # | Nombre | Qué prueba |
|---|---|---|
| S-01 | Check-in con rutina activa genera reserva | Cálculo dispara al registrar asistencia; persiste RESERVADA |
| S-02 | Check-in sin rutina activa = sin sugerencia | Comportamiento idéntico a hoy |
| S-03 | Exclusión P-67 | Al recalcular, las asignaciones del propio socio no cuentan en colas/ocupantes |
| S-04 | Vencimiento perezoso (lazy expiry) | Reserva expirada se ignora al construir cola; `ahora` inyectado |
| S-05 | Best-effort con falla del motor | Motor lanza → asistencia se registró; respuesta 200 |
| S-06 | Best-effort con falla de DB | Transacción de acceso falla → error mapeado, no 500 crudo |
| S-07 | Fallback `sin_opciones` | Todos bloqueados → miembro sigue orden de rutina |
| S-08 | Fallback `vacio` | Sin ejercicios pendientes → sin sugerencia |
| S-09 | ACCEPT vs ESPERAR | Aceptar reserva máquina; esperar mantiene cola |
| S-10 | Sesión sin asignaciones | `ejercicioActualId` actualiza normalmente; tests existentes verdes |
| S-11 | Concurrente: dos socios misma máquina | Advisory lock serializa; una reserva gana, la otra espera |
| S-12 | Configuración nuevos parámetros | `segundosEjecucionSerie=60`, `minutosVencimientoReserva=15` defaults |
| S-13 | `segundosEjecucionSerie=0` rechazado | Validación en dominio de configuración |
| S-14 | Exclusión de calentamiento/ocupante | Drop sets y calentamientos no cuentan para seriesRestantes |

---

## Pendientes

| # | Estado | Razón |
|---|---|---|
| P-61 | Sigue abierto | Reasignación por instructor → Etapa 5 |
| P-62 | Sigue abierto | Simulación comparativa → post Etapa 5 |
| P-63 | Sigue abierto | Documentación "solo-espera" → informe tesis |
| P-64 | **Se cierra** | Cálculo best-effort en check-in |
| P-65 | **Se cierra** | Reserva con vencimiento configurable |
| P-66 | **Se cierra** | Evaluación de `after` (conclusión: await hasta verificar Vercel) |
| P-67 | **Se cierra** | Exclusión del propio socio en recálculo + test |
| **P-68** | Nuevo | Concurrencia de reservas misma máquina: estrategia de lock + prueba Docker |
| **P-69** | Nuevo | Vencimiento de reservas dejadas (reserva creada, socio no inició sesión): lazy expiry + query determinista |
| **P-70** | Nuevo | Sesión tras asignación: `ejercicioActualId` debe reflejar el ejercicio aceptado, no el orden de rutina (para el primer ejercicio cuando hay reserva) |

---

## Numeración

- Última decisión registrada: **D-87** (`decisions.md:1440`).
- Última tarea: **T-055d** (cierre documental de motor-espera, design.md:323).
- Último pendiente: **P-67** (`decisions.md:1539`).
- Esta etapa: **D-88+**, **T-056+**, **P-68+**.

---

## Recomendación para propose/design

1. **Crear tabla `AsignacionDeEjercicio`** con estados `RESERVADA | EN_CURSO | COMPLETADA | VENCIDA | CANCELADA`, `socioId`, `sesionId` (NULL hasta iniciar), `ejercicioId`, `maquinaId`, `creadaEn`, `venceEn`. Índices: `(socioId, estado)`, `(maquinaId, estado)`. Migración aditiva.

2. **Gancho en `evaluarYRegistrarAcceso`** (`src/api/acceso.ts:164`), después de la `$transaction` de asistencia. Con timeout interno y catch que registra error. Construye `EntradaMotor` desde la reserva existente + ocupantes (sesiones EN_CURSO) + cola (RESERVADAS no vencidas del resto de los socios).

3. **Dos columnas en `ConfiguracionDelSistema`**: `segundosEjecucionSerie INT NOT NULL DEFAULT 60`, `minutosVencimientoReserva INT NOT NULL DEFAULT 15`. Agregar a `CONFIGURACION_POR_DEFECTO`, `CAMPOS_CONFIGURACION`, `Configuracion` interface, validación (entero > 0 y entero >= 0).

4. **Recálculo en sesión**: al `iniciarSesion` y tras cada `registrarSerie`, invocar el motor. Si hay asignación aceptada para el siguiente ejercicio, usarla; si no, fallback al orden de rutina (comportamiento actual).

5. **P-67 con test obligatorio**: fixture donde el socio tiene una reserva en máquina M1; al recalcular para ese mismo socio, M1 NO aparece como ocupada ni en cola propia.

6. **P-68 con test en Docker**: dos reservas concurrentes sobre la misma máquina con `pg_advisory_xact_lock`; verificar que no hay doble reserva activa.

7. **Usar await con timeout**, no `after`, hasta verificar `waitUntil` en Vercel (P-28).

**Trade-offs clave**:
- Advisory lock vs optimistic: el lock es más predecible bajo contención pero requiere SQL crudo. El optimistic es más limpio Prisma pero necesita retry. Dado que la concurrencia real es baja (pocos socios en misma máquina), cualquiera funciona; el lock se prefiere para evitar retries en tests.
- Tabla nueva vs extender sesión: la tabla nueva separa limpiamente la reserva (pre-sesión) de la sesión. Es más código pero no contamina el modelo de sesión existente.
- `after` vs await: `after` es más elegante pero arriesgado en serverless no verificado. El await con timeout es seguro y testeable hoy.
