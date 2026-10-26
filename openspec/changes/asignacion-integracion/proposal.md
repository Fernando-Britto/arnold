# Propuesta: asignacion-integracion (Etapa 4 — Integración del motor de espera)

## Intención

Las Etapas 1 (`maquinas-crud`, D-73), 2 (`maquina-ejercicios`, D-74) y 3 (`motor-espera`, D-75+) entregaron tres piezas inertes: catálogo de máquinas, relación M2M ejercicio↔máquina y motor de dominio puro que calcula esperas. Ninguna de esas piezas toca la base de datos de negocio ni tiene un llamante real: el motor recibe una `EntradaMotor` por parámetros y no sabe de dónde sale.

La Etapa 4 existe para **conectar el motor puro con la realidad operativa**: que un socio con rutina activa, al hacer check-in, reciba una sugerencia persistente (reserva en cola de máquina); que esa reserva venza, se recalcule al iniciar rutina y tras cada ejercicio; y que dos parámetros nuevos (`segundosEjecucionSerie`, `minutosVencimientoReserva`) se configuren desde `/configuracion`. Sin esta etapa, el motor de Etapa 3 queda como un módulo huérfano: nunca se invoca, nunca reserva nada y nunca influye en el flujo del socio.

La Etapa 5 (pantalla del socio + reasignación del instructor + simulación comparativa de tesis) **consumirá** los artefactos de esta etapa: la reserva ya existe, el cálculo ya corre, y la pantalla solo tiene que mostrar la sugerencia vigente. Si esta etapa no entrega una reserva persistente con estado y vencimiento, la Etapa 5 no tiene nada que mostrar.

## Alcance

### In Scope

1. **Persistencia de asignaciones**: tabla nueva `AsignacionDeEjercicio` con máquina de estados (`RESERVADA | EN_CURSO | COMPLETADA | VENCIDA | CANCELADA`), FKs a `Socio`, `SesionDeEntrenamiento` (nullable hasta iniciar), `Ejercicio` y `Maquina`, más timestamps de creación y vencimiento. Migración aditiva.
2. **Construcción de la entrada del motor desde la DB**: servicio que, dado un `socioId` y un reloj inyectado, arma `EntradaMotor` a partir de la rutina activa, `EjercicioMaquina`, sesiones `EN_CURSO` (ocupantes) y asignaciones `RESERVADA` no vencidas de terceros (cola).
3. **Servicio de orquestación**: invoca el motor, persiste la reserva `RESERVADA` ganadora, recalcula en tres momentos (check-in, inicio de rutina, posterior a serie) y aplica el vencimiento perezoso.
4. **Dos parámetros nuevos en `ConfiguracionDelSistema`**: `segundosEjecucionSerie INT NOT NULL DEFAULT 60` y `minutosVencimientoReserva INT NOT NULL DEFAULT 15`. Migración aditiva, default en fila existente, validación en dominio y panel existentes (D-54).
5. **Endpoints REST**: `GET /api/asignaciones/sugerencia` (lectura de sugerencia vigente) y `POST /api/asignaciones/decidir` (`ACEPTAR` / `ESPERAR`). Permisos: SOCIO sobre las propias, ADMIN/INSTRUCTOR en lectura.
6. **Gancho en check-in**: cálculo provisional disparado desde `evaluarYRegistrarAcceso` (`src/api/acceso.ts:164`), después de la transacción de asistencia, best-effort, nunca falla el check-in.
7. **Ajuste de sesión**: cuando existe una asignación `ACEPTADA` para el ejercicio en turno, `ejercicioActualId` refleja esa elección; si no hay asignación, el comportamiento es idéntico al actual (orden de rutina).

### Out of Scope

- Pantalla del socio, componentes visuales de sugerencia ni panel de instructor (Etapa 5).
- Reasignación por instructor ni salida de emergencia del flujo obligatorio (P-61, Etapa 5).
- Modificaciones al motor puro `motor-espera.ts` (se consume tal cual).
- Seed de datos de ejercicios/máquinas/rutinas más allá de los defaults ya existentes.
- Simulación comparativa para tesis (P-62, posterior a Etapa 5).
- Job de limpieza batch de reservas abandonadas (P-69: se documenta, no se implementa; el vencimiento perezoso es suficiente para la operación).
- Cambios a `EstadoMaquina`, al filtro de `home-interno.ts` ni al guardián de dominios puros.
- Verificación de `after` + `waitUntil` en Vercel (P-28, sigue abierto).
- Tocar Home_Interno, Home_Socio ni ninguna pantalla existente.

## Modelo conceptual

Vocabulario mínimo. Las decisiones formales de nombres de columnas, índices y tipos TS corresponden a la fase de diseño; aquí se fijan los conceptos.

| Concepto | Significado |
|---|---|
| **Asignación / Reserva** | Fila que materializa la decisión del motor para un (socio, ejercicio, máquina) en un instante. Tiene estado, creación y vencimiento. |
| **Estado** | `RESERVADA` (lugar en cola, pendiente de uso), `EN_CURSO` (el socio está haciendo el ejercicio), `COMPLETADA` (terminó las series), `VENCIDA` (pasaron `minutosVencimientoReserva` sin iniciar), `CANCELADA` (el socio eligió `ESPERAR` o se anuló). |
| **Ocupante** | Socio con sesión `EN_CURSO` usando una máquina ahora; su `seriesRestantes` se deriva de la prescripción menos las series de trabajo registradas (excluyendo `CALENTAMIENTO` y `DROP_SET`, D-64/D-69). |
| **Cola** | Lista ordenada de asignaciones `RESERVADA` no vencidas de **otros** socios sobre la misma máquina. El propio socio no cuenta (P-67). |
| **Sugerencia vigente** | Última asignación `RESERVADA` no vencida de un socio. Es la que el endpoint de lectura devuelve y sobre la que el socio decide `ACEPTAR` / `ESPERAR`. |
| **Decisión** | `ACEPTAR` → la reserva pasa a usarse al iniciar rutina (y luego a `EN_CURSO`). `ESPERAR` → la reserva se marca `CANCELADA` y vale el orden de rutina. |
| **Vencimiento perezoso** | La reserva no se invalida con un job; se considera vencida cuando `ahora > venceEn` al momento de consultar. No hay escritura de estado `VENCIDA` en caliente; la fila queda ahí hasta una limpieza eventual (P-69). |
| **Retroceso** | Si el motor devuelve `sin_opciones` o `vacio`, el flujo no cambia: el socio sigue el orden de rutina. Nunca se lanza ni se bloquea el check-in. |

### Máquina de estados (conceptual)

```
                 ┌──────────────┐
         crear   │              │  vence (lazy, al consultar)
check-in ───────▶│  RESERVADA   │──────────────▶ (se ignora como RESERVADA)
                 │              │
                 └──────┬───────┘
                        │
          ACEPTAR+iniciar│  ESPERAR
                         │
                 ┌───────┴────────┐
                 ▼                ▼
          ┌──────────┐     ┌───────────┐
          │ EN_CURSO │     │ CANCELADA │◀── (también: salida emergencia, Etapa 5)
          └────┬─────┘     └───────────┘
               │
       series  │ completadas
               ▼
          ┌────────────┐
          │ COMPLETADA │
          └────────────┘
```

Transiciones permitidas: `RESERVADA → {EN_CURSO, CANCELADA}`; `EN_CURSO → {COMPLETADA, CANCELADA}` (esta última solo por Etapa 5/P-61). No hay otras. El estado `VENCIDA` se deriva por consulta (`ahora > venceEn` con estado `RESERVADA`); la fila no se reescribe en caliente.

## Decisiones de Fernando (vinculantes)

Las siguientes son respuestas del usuario. No se reabren en diseño ni en spec.

1. **El cálculo se dispara en el registro de asistencia (check-in)** como reserva provisional que reserva un lugar en la cola de la máquina elegida. Se recalcula al iniciar rutina y tras cada ejercicio. *Racional*: el check-in es el único evento compartido entre recepción y puerta (ver explore); anclar ahí evita duplicar lógica.
2. **La reserva provisional vence a los 15 minutos sin iniciar rutina** y libera su lugar en cola. El valor es configurable desde `/configuracion` (`minutosVencimientoReserva`). *Racional*: sin vencimiento, un socio que hace check-in y se va bloquearía la cola indefinidamente.
3. **Dos parámetros nuevos en `/configuracion`**: `segundosEjecucionSerie` (default 60) y `minutosVencimientoReserva` (default 15). Migración aditiva con default en `ConfiguracionDelSistema`, validación en el dominio y panel existentes, siguiendo D-54. *Racional*: reutilizar el patrón probado (T-043/T-045b) en lugar de inventar uno nuevo.
4. **El cálculo solo se dispara para socios con rutina activa**. Sin rutina activa, el check-in se comporta exactamente como hoy. *Racional*: el motor necesita ejercicios pendientes; sin rutina activa no hay nada que calcular y cualquier invocación sería ruido.
5. **Flujo obligatorio de decisión**: el sistema propone; el socio solo puede `ACEPTAR` el ejercicio recomendado o `ESPERAR` (pasar al siguiente en orden de rutina). No hay tercera opción ni elección libre de máquina en esta etapa. *Racional*: el flujo obligatorio es el objeto de la tesis; permitir saltarse la sugerencia invalidaría la simulación comparativa (P-62).
6. **La reasignación por instructor queda en Etapa 5** (P-61). En esta etapa no existe ningún rol que pueda cancelar o modificar la asignación de otro socio. *Racional*: acotar el alcance; la máquina de estados contempla `CANCELADA` pero el actor "instructor" no entra hasta la siguiente etapa.

## Propuestas de la IA (no vinculantes; el spec puede refinar)

1. **Tabla `AsignacionDeEjercicio` con máquina de estados explícita**. *Racional*: separa la reserva (pre-sesión) de la sesión; permite que venza independientemente sin contaminar `SesionDeEntrenamiento`.
2. **Vencimiento perezoso con reloj inyectado**, sin jobs de fondo. *Racional*: el sistema no tiene cron; la consulta `WHERE estado = 'RESERVADA' AND venceEn > :ahora` es determinista y testeable.
3. **Ocupación y cola derivadas de asignaciones + sesiones activas**; `Maquina.estado` nunca se escribe como `OCUPADA`. *Racional*: coherente con D-73 (confirmado por grep: ningún código de producción escribe `OCUPADA`).
4. **Exclusión de las asignaciones del propio socio en la cola** (P-67), con test dedicado. *Racional*: sin exclusión, el recálculo vería al propio socio como ocupante de su máquina reservada y calcularía esperas incorrectas.
5. **Concurrencia con `pg_advisory_xact_lock` por máquina**, dentro de la transacción de reserva. Prueba de integración contra Docker Postgres (D-53). *Racional*: serializa reservas sobre la misma máquina sin bloquear lecturas; el unique parcial rompería la cola.
6. **Manejo de resultados del motor**: `invalido` = error de servidor registrado en log (no throw al check-in); `sin_opciones` / `vacio` = fallback silencioso al orden de rutina. *Racional*: el motor no lanza por diseño; `invalido` indica bug en quien arma la entrada y merece log, no interrupción.
7. **Check-in: gancho único en `evaluarYRegistrarAcceso`** (`src/api/acceso.ts:164`), después de la `$transaction` de asistencia. Best-effort: nunca falla el registro. *Racional*: es el único punto compartido entre recepción y puerta; anclar ahí evita duplicar lógica.
8. **Sesión: el siguiente ejercicio viene de la asignación aceptada cuando existe**; si no hay asignación, comportamiento idéntico al actual. *Racional*: retrocompatible con los tests existentes de sesión.
9. **API**: `GET /api/asignaciones/sugerencia?socioId=` (sugerencia actual con recomendado + siguiente) y `POST /api/asignaciones/decidir` (`{ accion: "ACEPTAR" | "ESPERAR" }`). SOCIO sobre las propias; ADMIN/INSTRUCTOR en lectura. *Racional*: superficie mínima; la pantalla del socio (Etapa 5) consumirá estos endpoints.
10. **`await` con timeout interno** en lugar de `after` de Next 16. *Racional*: `after` en serverless requiere `waitUntil` (no verificado en Vercel, P-28); el cálculo es rápido (dominio puro + consultas acotadas) y el await con timeout es testeable y seguro hoy.

## Impacto en stakeholders

| Stakeholder | Impacto |
|---|---|
| **Socio** | **Ninguno visible en esta etapa.** El socio sigue viendo la pantalla actual de Home_Socio. La reserva existe en la base y el cálculo corre en el backend, pero no hay UI que la muestre ni que pida `ACEPTAR`/`ESPERAR`. La decisión del socio queda diferida a Etapa 5; por ahora el sistema registra la reserva como si fuera aceptada por defecto (comportamiento que la Etapa 5 expondrá como elección). |
| **Recepción** | Ninguno visible. El check-in por DNI+PIN o huella sigue respondiendo lo mismo; el cálculo del motor corre en background best-effort sin alterar la respuesta. |
| **Administrador** | Dos campos nuevos en `/configuracion` (`segundosEjecucionSerie`, `minutosVencimientoReserva`) con sus defaults y validación. El panel existente los muestra; el guardián de lector único (`getConfiguracion`) los expone automáticamente. |
| **Instructor** | Ninguno. No tiene permisos de lectura ni escritura sobre asignaciones en esta etapa (eso llega en Etapa 5 con P-61). Los endpoints de sugerencia le dan lectura (para la pantalla futura), pero no hay UI que los consuma todavía. |
| **Tesis** | Esta etapa entrega los datos medibles: cada check-in deja una fila de asignación con `ejercicioId`, `maquinaId`, `espera` (calculada por el motor), `ahorro` y timestamps. La simulación comparativa (P-62) podrá ejecutarse sobre esta tabla cuando exista la pantalla del socio. La limitación "solo-espera" (P-63) sigue sin resolverse. |

**Importante**: la Etapa 4 **no cambia ninguna pantalla**. Si el socio viera hoy el Home_Socio antes y después de esta etapa, no notaría diferencia. La integración es 100% backend + dos parámetros de configuración. La visibilidad del flujo obligatorio llega en Etapa 5.

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **Concurrencia de reservas sobre la misma máquina**: dos check-in simultáneos eligen la misma máquina y generan dos reservas `RESERVADA` que creen que son el ocupante la una de la otra. | Media | `pg_advisory_xact_lock(hashtext('maquina:' \|\| id))` dentro de la transacción de reserva. Test de integración con Docker Postgres simulando dos check-in concurrentes (P-68). |
| **Tensión best-effort vs. latencia**: `await` agrega latencia al check-in; `after` necesita `waitUntil` no verificado en Vercel (P-28). | Media | `await` con timeout interno acotado (p. ej. 2 s). Si el cálculo excede el timeout, se registra error en log y se responde el check-in normalmente. La reserva queda pendiente del próximo recálculo (inicio de rutina). |
| **Reservas abandonadas** (socio hace check-in, recibe reserva, no inicia rutina y se va): la fila `RESERVADA` queda en la tabla, pero el vencimiento perezoso la ignora. Acumulación a largo plazo. | Alta | El vencimiento perezoso garantiza que la operación correcta no se afecta. La limpieza batch queda como P-69 (post-Etapa 5, cuando haya volumen real). Documentar en el spec que el tamaño de la tabla crece hasta la limpieza. |
| **Dependencia P-28 (Vercel + `waitUntil`)** no verificada: si en Etapa 5 se decide usar `after`, habrá que volver sobre esta decisión. | Baja | La propuesta de `await` con timeout es segura hoy y no bloquea Etapa 5. El cambio a `after` (si P-28 se verifica) es local al servicio de orquestación, no al motor ni a la tabla. |
| **Derivación de `seriesRestantes` con drop sets y calentamientos**: filtro incorrecto contaría series que no avanzan la sesión (D-64/D-69) y sub-estimaría la espera. | Media | La consulta filtra `tipo IN ('NORMAL', 'HASTA_EL_FALLO')` y excluye registros con `numeroSerie IS NULL`. Test dedicado con fixture que incluya calentamiento y drop set antes de la serie de trabajo. |
| **Doble check-in + anti-passback**: el socio ya tiene una reserva activa y vuelve a hacer check-in dentro de la ventana anti-passback. | Baja | El anti-passback ya bloquea el segundo check-in (`src/api/acceso.ts:181-185`). Si la ventana ya pasó y el check-in entra, el servicio de orquestación debe decidir: recalcular (reemplazando la reserva anterior, que pasa a `CANCELADA`) o mantener. El spec debe documentar la política; la recomendación es recalcular. |
| **Migración aditiva en `ConfiguracionDelSistema`**: agregar columnas `NOT NULL DEFAULT` a una tabla con filas existentes. | Baja | Prisma maneja el default correctamente en Postgres: las filas existentes reciben el default en la migración. Verificar contra Docker Postgres antes de aplicar en Supabase. |
| **Interacción con `ejercicioActualId` de sesión**: los tests actuales asumen que el siguiente ejercicio viene del orden de rutina. Si la asignación aceptada cambia ese orden, tests pueden romperse. | Media | La integración solo consulta la asignación aceptada cuando existe; si no existe (caso de todos los tests actuales), el fallback es el orden de rutina. Tests existentes deben quedar verdes sin cambios. Test nuevo dedicado para el caso con asignación aceptada. |

## Plan de rollback

Las dos migraciones son **aditivas**: `CREATE TABLE "AsignacionDeEjercicio"` y `ALTER TABLE "ConfiguracionDelSistema" ADD COLUMN`. Ninguna toca filas existentes de otras tablas ni elimina columnas.

**Reversión completa**:
1. `git revert` del merge.
2. SQL manual de rollback: `DROP TABLE IF EXISTS "AsignacionDeEjercicio";` y `ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "segundosEjecucionSerie", DROP COLUMN IF EXISTS "minutosVencimientoReserva";`. El archivo de migración debe incluir estos statements como comentarios al pie.
3. El motor puro (`motor-espera.ts`) no fue tocado, así que sigue funcionando para quien lo invoque manualmente.
4. Los endpoints `/api/asignaciones/*` desaparecen; `/configuracion` pierde dos campos pero el panel los omite gracefulmente (el guardián de lector único ya devuelve defaults por campo).

**Reversión parcial**: si solo se quiere revertir la UI/endpoint pero mantener la tabla, el `git revert` selectivo de rutas deja los datos intactos para una futura Etapa 5.

## Dependencias

- **Contrato de Etapa 3**: `calcularEspera(entrada: EntradaMotor): ResultadoMotor` no cambia. Los tipos `EntradaMotor`, `ResultadoMotor`, `EjercicioPendiente`, `MaquinaEnGimnasio`, `Ocupante`, `ColaMiembro`, `ParametrosMotor` se consumen tal cual.
- **`RutinaAsignada.activa`**: la consulta `findFirst({ where: { socioId, activa: true } })` con el índice `@@index([socioId, activa])` ya existe y se usa en `home-socio-data.ts:108`.
- **`EjercicioMaquina`**: los candidatos del motor vienen de esta relación (Etapa 2, D-74).
- **Patrón D-54 (`ConfiguracionDelSistema`)**: lector único, validación en `CAMPOS_CONFIGURACION`, API con auditoría. Las dos columnas nuevas siguen exactamente este patrón.
- **P-28 (Vercel + `waitUntil`)**: pendiente de verificación. Esta etapa no depende de ella (usa `await` con timeout), pero la decisión queda documentada para que Etapa 5 pueda reevaluar.
- **`evaluarYRegistrarAcceso`** (`src/api/acceso.ts:164`): el gancho se inserta después de la `$transaction` de asistencia, antes del return. No modifica la firma ni el contrato existente.
- **Docker Postgres (D-53)**: necesario para la prueba de concurrencia (P-68) y para verificar las migraciones antes de aplicar en Supabase.

## Capabilities

### New Capabilities

- `asignacion-ejercicio-persistencia`: tabla `AsignacionDeEjercicio` con máquina de estados (`RESERVADA | EN_CURSO | COMPLETADA | VENCIDA | CANCELADA`), migración aditiva, repositorio con lectura de sugerencia vigente, construcción de entrada del motor desde la DB (rutina activa + `EjercicioMaquina` + ocupantes derivados de sesiones + cola derivada de reservas no vencidas de terceros), exclusión del propio socio (P-67) y vencimiento perezoso.
- `asignacion-orquestacion`: servicio que invoca el motor en los tres momentos (check-in, inicio de rutina, posterior a serie), persiste la reserva, aplica el fallback `sin_opciones`/`vacio` al orden de rutina, maneja `invalido` como error de servidor logueado, y ajusta `ejercicioActualId` de sesión cuando existe asignación aceptada. Inyección de reloj, await con timeout, best-effort en check-in.
- `asignacion-api`: endpoints `GET /api/asignaciones/sugerencia` y `POST /api/asignaciones/decidir` (`ACEPTAR` / `ESPERAR`), permisos SOCIO sobre las propias y ADMIN/INSTRUCTOR en lectura, mapeo de errores vía `route-error-mapper`.

### Modified Capabilities

- `configuracion-sistema`: agrega dos columnas (`segundosEjecucionSerie INT NOT NULL DEFAULT 60`, `minutosVencimientoReserva INT NOT NULL DEFAULT 15`) al lector único, a `CAMPOS_CONFIGURACION`, a la interfaz `Configuracion`, a la validación y al panel `/configuracion`. Migración aditiva. Default en filas existentes.
- `motor-espera-asignacion`: ninguna modificación al módulo puro, pero la spec existente debe documentar que la Etapa 4 consume el motor en tres momentos y que `invalido` se trata como error de servidor logueado (no throw). Delta spec mínimo de integración.
- `member-access-check` (representado por el flujo `evaluarYRegistrarAcceso`): el gancho de cálculo se agrega después de la `$transaction` de asistencia. El spec debe documentar que el cálculo es best-effort y no altera el resultado del check-in.
- `rutinas-crud`: ningún cambio al CRUD de rutinas, pero la spec debe documentar que la "rutina activa" es el disparador del cálculo y que sin `activa = true` no hay sugerencia.

## Pendientes a registrar

| ID | Estado en esta etapa | Razón |
|---|---|---|
| **P-61** | **Sigue abierto** | Reasignación por instructor y salida de emergencia. Propia de Etapa 5 (pantalla del instructor). |
| **P-62** | **Sigue abierto** | Simulación comparativa para tesis. Requiere la pantalla del socio (Etapa 5) para producir datos con sentido. |
| **P-63** | **Sigue abierto** | Documentación de la limitación "solo-espera" para el informe de tesis. No se resuelve en código; es un apartado del documento final. |
| **P-64** | **Se cierra en esta etapa** | Cálculo best-effort en check-in: se implementa como gancho en `evaluarYRegistrarAcceso` con catch y log. |
| **P-65** | **Se cierra en esta etapa** | Reserva con vencimiento configurable: la columna `venceEn` y el parámetro `minutosVencimientoReserva` lo materializan. |
| **P-66** | **Se cierra en esta etapa** | Evaluación de `after`: se decide `await` con timeout, dejando la verificación de `waitUntil` en Vercel como P-28 (distinto alcance). |
| **P-67** | **Se cierra en esta etapa** | Exclusión del propio socio en la cola: la consulta de cola filtra `socioId <> :socioActual` y el test dedicado lo aserciona. |
| **P-68** | **Nuevo, se cierra en esta etapa** | Prueba de concurrencia con `pg_advisory_xact_lock` por máquina contra Docker Postgres. Test de integración que simula dos reservas simultáneas. |
| **P-69** | **Nuevo, sigue abierto** | Limpieza batch de reservas abandonadas. El vencimiento perezoso cubre la operación; la limpieza queda diferida a cuando haya volumen (post-Etapa 5). |
| **P-70** | **Nuevo, se cierra en esta etapa** | `ejercicioActualId` de sesión refleja la asignación aceptada cuando existe. Implementado en el servicio de orquestación con test dedicado. |

**Nota sobre P-66**: lo doy por cerrado porque la decisión técnica quedó tomada (`await` con timeout) y es suficiente para esta etapa. La verificación de `after` + `waitUntil` en Vercel no es la misma pregunta: es P-28 (infraestructura de despliegue) y no bloquea nada aquí.

## Criterios de aceptación de la etapa (alto nivel)

- [ ] Existe la tabla `AsignacionDeEjercicio` con los cinco estados documentados y FKs a `Socio`, `SesionDeEntrenamiento` (nullable), `Ejercicio` y `Maquina`.
- [ ] Migración aditiva verificada contra Docker Postgres; contiene 0 `DROP` sobre tablas existentes.
- [ ] `ConfiguracionDelSistema` tiene las dos columnas nuevas con default; `getConfiguracion()` las devuelve; el panel `/configuracion` las muestra y valida.
- [ ] El servicio de orquestación arma `EntradaMotor` desde la DB sin modificar `motor-espera.ts`.
- [ ] Check-in con rutina activa dispara el cálculo; la asistencia se registra independientemente de que el cálculo falle (best-effort).
- [ ] Check-in sin rutina activa produce exactamente el mismo comportamiento que hoy (ni un query extra al motor).
- [ ] Exclusión P-67: la cola derivada no incluye las reservas del propio socio; test dedicado.
- [ ] Vencimiento perezoso: una reserva con `venceEn < ahora` se ignora al construir la cola; test con reloj inyectado.
- [ ] Concurrencia: dos check-in simultáneos sobre la misma máquina no generan doble reserva activa; test de integración contra Docker Postgres (P-68).
- [ ] `ejercicioActualId` respeta la asignación aceptada cuando existe; tests existentes de sesión quedan verdes.
- [ ] Endpoints `GET /api/asignaciones/sugerencia` y `POST /api/asignaciones/decidir` funcionan; matriz de permisos con test de consistencia.
- [ ] `invalido` del motor se loguea como error de servidor y no altera la respuesta de check-in.
- [ ] `sin_opciones` / `vacio` derivan en fallback silencioso al orden de rutina.
- [ ] Ninguna pantalla cambia: Home_Socio, Home_Interno, `/configuracion` (salvo los dos campos nuevos) y `/maquinas` quedan visualmente idénticos.
- [ ] `npm test` + `npm run test:integration` + `tsc --noEmit` verdes, sin nuevos errores de lint.

## Numeración

- Última decisión registrada: **D-87**. Esta etapa usa **D-88+**.
- Última tarea registrada: **T-055d**. Esta etapa usa **T-056+**.
- Último pendiente registrado: **P-67**. Esta etapa cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70.

Confirmado contra `openspec/decisions.md` (última revisión) y el explore.md de esta change.
