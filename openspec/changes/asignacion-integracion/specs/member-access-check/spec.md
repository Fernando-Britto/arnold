# Delta for member-access-check

## Purpose

Agregar al check-in el disparo best-effort del cálculo de asignación, sin cambiar ninguna regla de acceso: la asistencia se registra y se decide exactamente como hoy; el cálculo corre después y nunca puede hacer fallar el ingreso. El gancho vive en el único punto compartido entre recepción (DNI + PIN) y puerta/huella, no en las rutas.

Estado: **especificado** — Etapa 4, previo al diseño. No modifica código.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `member-access-check` (delta) |
| Change | `asignacion-integracion` (Etapa 4) |
| Dependencias | `evaluarYRegistrarAcceso` (`src/api/acceso.ts`), `asignacion-orquestacion`, `decidirAcceso` / `access-decision.ts` (sin cambios) |
| Consumidores | Recepción (DNI + PIN), puerta y huella (dispositivo) |
| Numeración AC | `AC-521…AC-530` (delta). No colisiona con los AC existentes de la capability |

## ADDED Requirements

### Requirement: Punto único de gancho en el check-in

El disparo del cálculo **MUST** vivir en el único punto posterior a la identidad que comparten todas las rutas de acceso: la función `evaluarYRegistrarAcceso` (o el wrapper que ambas rutas llaman en su lugar). **MUST NOT** duplicarse en `/api/acceso/check-in`, en `/api/dispositivo/acceso` ni en `/api/dispositivo/acceso/verificar`.

El gancho **MUST** ejecutarse después de que la transacción de `Asistencia` + `AuditoriaAcceso` haya confirmado y antes de devolver el resultado. **MUST NOT** cambiar la decisión de acceso, la identidad, el estado de cuenta, la cuota ni el anti-passback. Su única responsabilidad es invocar la orquestación de asignación con el socio ya identificado y el mismo `ahora` del check-in.

#### Scenario: Recepción y puerta comparten el gancho

- GIVEN un check-in permitido por DNI + PIN en recepción
- AND un check-in permitido por huella o dispositivo en la puerta
- WHEN ambos se procesan
- THEN ambos pasan por el mismo gancho de cálculo
- AND no existe una segunda implementación del gancho en las rutas

#### Scenario: El gancho no altera la decisión de acceso

- GIVEN un socio con cuota vencida
- WHEN se evalúa el acceso
- THEN la decisión sigue siendo `DENEGADO` con el mismo motivo
- AND el gancho no se ejecuta

### Requirement: La asistencia nunca falla por el cálculo

La asistencia **MUST** quedar registrada antes de que el cálculo se ejecute. Si el motor lanza, devuelve `invalido`, la persistencia de la reserva falla o se agota el tiempo de espera, la asistencia **MUST NOT** revertirse, alterarse ni complementarse, y la respuesta del check-in **MUST** ser exactamente la misma que sin el cálculo.

El gancho **MUST** contener sus propios errores (`try/catch`) y **MUST NOT** propagarlos a `evaluarYRegistrarAcceso`, a la ruta ni al cliente. Un fallo del cálculo no es un fallo del acceso.

#### Scenario: El motor lanza después de la asistencia

- GIVEN un check-in permitido cuya asistencia ya se confirmó
- WHEN el cálculo lanza una excepción
- THEN la asistencia sigue registrada con `estado = PERMITIDO`
- AND la respuesta del check-in es la misma que sin cálculo
- AND el error se registra en el servidor

#### Scenario: La persistencia de la reserva falla

- GIVEN un check-in permitido y un cálculo exitoso
- WHEN la transacción de la reserva falla
- THEN la asistencia sigue registrada
- AND no queda una reserva parcial
- AND la respuesta del check-in no cambia

#### Scenario: El cálculo excede el tiempo acotado

- GIVEN un check-in permitido y un cálculo que tarda más que el límite
- WHEN se agota la espera
- THEN la asistencia sigue registrada
- AND la respuesta del check-in no cambia
- AND no queda una transacción abierta ni un lock retenido

### Requirement: Condiciones de disparo del cálculo

El gancho **MUST** disparar el cálculo solo cuando se cumplen las dos condiciones:

1. El resultado del acceso no es `DENEGADO` (cuota, cuenta o anti-passback).
2. El socio tiene una rutina activa (RN-04).

Si falta cualquiera de las dos, el comportamiento del check-in **MUST** ser idéntico al actual y **MUST NOT** ejecutar una consulta al motor. Un check-in denegado **MUST NOT** cancelar ni modificar una reserva existente: el socio puede estar dentro del gimnasio usándola.

La verificación de la rutina activa **MUST** ser parte del flujo best-effort: si esa consulta falla, el check-in no falla; se registra el error y se responde como hoy.

#### Scenario: Socio sin rutina activa

- GIVEN un check-in permitido de un socio sin rutina activa
- WHEN se procesa
- THEN el check-in responde exactamente como hoy
- AND no se invoca el motor
- AND no se crea ni se cancela ninguna reserva

#### Scenario: Check-in denegado por cuota

- GIVEN un socio con cuota vencida y una reserva vigente
- WHEN el check-in resulta `DENEGADO`
- THEN no se ejecuta el cálculo
- AND la reserva vigente no se cancela ni se modifica

#### Scenario: Falla la consulta de rutina activa

- GIVEN un check-in permitido y una consulta de rutina activa que falla
- WHEN se procesa el gancho
- THEN la asistencia y la respuesta del check-in no cambian
- AND el error se registra en el servidor

### Requirement: Segundo check-in y anti-passback

Dentro de la ventana de anti-passback, el segundo check-in **MUST** seguir siendo `DENEGADO` por la regla de acceso existente: **MUST NOT** disparar el cálculo y **MUST NOT** cancelar la reserva vigente. Fuera de la ventana, un check-in permitido **MUST** disparar el recálculo, que reemplaza la reserva anterior según el resultado (ver `asignacion-orquestacion`).

El gancho **MUST NOT** implementar su propia ventana ni duplicar la lógica de anti-passback; consume la decisión ya tomada por `decidirAcceso`.

#### Scenario: Segundo check-in dentro de la ventana

- GIVEN un socio con una reserva vigente que vuelve a hacer check-in dentro de la ventana anti-passback
- WHEN el acceso resulta `DENEGADO`
- THEN no se ejecuta el cálculo
- AND la reserva vigente se conserva

#### Scenario: Segundo check-in fuera de la ventana

- GIVEN un socio que hace check-in después de la ventana anti-passback
- WHEN el acceso es permitido
- THEN el cálculo se ejecuta
- AND la reserva anterior se cancela si el cálculo produce una nueva

### Requirement: Reloj inyectado

El gancho **MUST** usar el mismo instante `ahora` que `evaluarYRegistrarAcceso` usó para la asistencia, el anti-passback y la auditoría. **MUST NOT** llamar a `Date.now()` ni a `new Date()` por su cuenta. En los tests, `ahora` se inyecta y el comportamiento es determinista.

#### Scenario: El cálculo usa el reloj del acceso

- GIVEN un check-in con `ahora = 2026-10-25T10:00:00Z`
- WHEN se ejecuta el gancho
- THEN la reserva usa `creadaEn = 2026-10-25T10:00:00Z`
- AND el vencimiento se calcula desde ese instante

#### Scenario: Sin reloj real en los tests

- GIVEN dos ejecuciones con el mismo estado y el mismo `ahora`
- WHEN se comparan
- THEN el resultado es idéntico

### Requirement: Sin registros duplicados ni cambios en la auditoría de acceso

El gancho **MUST NOT** crear una segunda `Asistencia`, una segunda `AuditoriaAcceso` ni un registro de acceso adicional. La asistencia y su auditoría siguen siendo exactamente una por intento con identidad verificada, como hoy. El gancho solo puede leer datos y escribir filas de `AsignacionDeEjercicio` a través de la orquestación.

#### Scenario: Un solo registro de asistencia

- GIVEN un check-in permitido con cálculo exitoso
- WHEN finaliza la petición
- THEN existe exactamente una `Asistencia` y una `AuditoriaAcceso` para ese intento
- AND el cálculo no agregó registros de acceso

#### Scenario: Un solo registro en un check-in denegado

- GIVEN un check-in denegado
- WHEN finaliza la petición
- THEN existe exactamente una `Asistencia` `DENEGADO` y una `AuditoriaAcceso` `DENY`
- AND el gancho no agregó ni quitó registros

### Requirement: Registro de fallos del gancho

Los fallos del gancho **MUST** registrarse en el log del servidor con contexto suficiente para diagnosticar (socio, momento del cálculo y tipo de fallo: motor, `invalido`, persistencia o timeout). **MUST NOT** exponerse al cliente, **MUST NOT** incluir datos sensibles y **MUST NOT** cambiar el mensaje de acceso.

#### Scenario: Log de un fallo del motor

- GIVEN un cálculo que lanza durante un check-in permitido
- WHEN el gancho captura el error
- THEN el log incluye el socio y el tipo de fallo
- AND la respuesta al cliente no menciona el cálculo ni el error interno

### Requirement: Espera acotada y respuesta del check-in

El gancho **MUST** esperar el cálculo como máximo el tiempo acotado definido por la orquestación (valor inicial: 2 segundos). Al agotarse, **MUST** abandonar la espera, registrar el timeout y devolver el control al check-in con la misma respuesta. **MUST NOT** usar `after` de Next en esta etapa: la verificación de `waitUntil` en Vercel (P-28) sigue pendiente.

#### Scenario: Timeout no cambia la respuesta

- GIVEN un check-in permitido y un cálculo que no termina dentro del límite
- WHEN se agota la espera
- THEN la respuesta del check-in es la misma que sin cálculo
- AND la asistencia sigue registrada

### Requirement: Compatibilidad con el flujo actual

El gancho **MUST NOT** modificar la firma pública de `evaluarYRegistrarAcceso`, el contrato de `CheckInResultado`, la función pura `decidirAcceso`, el cálculo de `estadoCuotaSocio` ni la ventana de anti-passback. Los tests existentes de acceso **MUST** seguir verdes sin cambios. El camino sin rutina activa **MUST** ser indistinguible del actual.

#### Scenario: Tests de acceso sin cambios

- GIVEN el suite de tests de acceso existente
- WHEN se ejecuta después de agregar el gancho
- THEN todos pasan sin modificaciones
- AND el resultado del check-in para un socio sin rutina activa es idéntico al anterior

#### Scenario: La decisión pura no cambia

- GIVEN la función `decidirAcceso`
- WHEN se ejecuta con los mismos inputs que antes
- THEN devuelve el mismo resultado
- AND no incorpora conceptos de asignación ni de motor

## Escenarios

| # | Nombre | Qué demuestra | Resultado esperado |
|---|---|---|---|
| 1 | Recepción y puerta | Punto único | Mismo gancho en ambas rutas |
| 2 | Decisión intacta | El gancho no decide acceso | `DENEGADO` igual |
| 3 | Motor lanza | Asistencia ya confirmada | Respuesta igual |
| 4 | Persistencia falla | Sin reserva parcial | Respuesta igual |
| 5 | Timeout | Espera acotada | Respuesta igual |
| 6 | Sin rutina activa | Camino idéntico a hoy | Sin cálculo |
| 7 | Check-in denegado | No cancela reserva | Reserva intacta |
| 8 | Falla consulta de rutina | Best-effort | Respuesta igual |
| 9 | Anti-passback dentro | No calcula | Reserva conservada |
| 10 | Anti-passback fuera | Recalcula | Reemplazo |
| 11 | Reloj del acceso | Mismo `ahora` | `creadaEn` exacto |
| 12 | Sin reloj real | Determinismo | Resultado idéntico |
| 13 | Un solo registro | Sin duplicados | Una asistencia y una auditoría |
| 14 | Denegado sin duplicados | Sin registros extra | Una asistencia y una auditoría |
| 15 | Log de fallo | Diagnóstico | Contexto sin datos sensibles |
| 16 | Tests actuales | Retrocompatibilidad | Suite verde |
| 17 | Decisión pura | Sin cambios | Mismo resultado |

## Acceptance Criteria (Delta)

- **AC-521**: El gancho del cálculo vive en `evaluarYRegistrarAcceso` (o el wrapper compartido) y cubre recepción DNI+PIN, puerta y huella; no hay una implementación duplicada en las rutas.
- **AC-522**: La asistencia se confirma antes del cálculo; un fallo del cálculo no la revierte, no la altera y no cambia su auditoría.
- **AC-523**: Motor que lanza, `invalido`, fallo de persistencia y timeout se capturan y loguean; la respuesta del check-in es idéntica a la de sin cálculo y no queda reserva parcial.
- **AC-524**: El cálculo solo se dispara para accesos no denegados y socios con rutina activa; un check-in denegado no calcula ni cancela reservas; sin rutina activa el camino es idéntico al actual.
- **AC-525**: Dentro de la ventana anti-passback el segundo check-in no calcula ni cancela; fuera de la ventana, el check-in permitido recalcula y reemplaza la reserva.
- **AC-526**: El gancho usa el mismo `ahora` que la asistencia y no llama a `Date.now()` ni a `new Date()`.
- **AC-527**: El gancho no crea registros adicionales de `Asistencia` ni `AuditoriaAcceso`; sigue habiendo exactamente uno por intento con identidad verificada.
- **AC-528**: Los fallos se registran en el servidor con socio, momento y tipo de fallo, sin datos sensibles ni cambios en el mensaje al cliente.
- **AC-529**: La espera del cálculo está acotada (2 s iniciales); al agotarse, la respuesta del check-in no cambia y no queda transacción abierta ni lock retenido.
- **AC-530**: `evaluarYRegistrarAcceso`, `CheckInResultado`, `decidirAcceso`, `estadoCuotaSocio` y la ventana anti-passback no cambian de contrato; los tests existentes de acceso quedan verdes sin modificaciones.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Punto único de gancho | 1, 2 | AC-521 |
| La asistencia nunca falla por el cálculo | 3, 4, 5 | AC-522, AC-523, AC-529 |
| Condiciones de disparo | 6, 7, 8 | AC-524 |
| Segundo check-in y anti-passback | 9, 10 | AC-525 |
| Reloj inyectado | 11, 12 | AC-526 |
| Sin registros duplicados | 13, 14 | AC-527 |
| Registro de fallos | 15 | AC-528 |
| Espera acotada | 5 | AC-529 |
| Compatibilidad | 16, 17 | AC-530 |

## Fuera de alcance

- Cambiar las reglas de acceso, cuota, cuenta o anti-passback.
- Crear una segunda ruta o un segundo servicio de acceso.
- La UI de recepción, puerta o huella.
- La pantalla del socio y la reasignación por instructor (Etapa 5, P-61).
- La modificación del motor de espera o de la persistencia de asignaciones.
- El uso de `after` + `waitUntil` (P-28).
- La definición de DDL, tipos y firmas (fase de diseño).

## Contrato de datos

Nota semántica; no hay cambios de esquema en esta capability.

| Elemento | Semántica |
|---|---|
| Lectura del gancho | `socio.id`, `ahora`, `metodo` del check-in; resultado de acceso ya decidido. |
| Escritura del gancho | Solo filas de `AsignacionDeEjercicio` a través de `asignacion-orquestacion`; ninguna escritura en `Asistencia` ni `AuditoriaAcceso`. |
| `Asistencia` / `AuditoriaAcceso` | Sin cambios de campos ni de cardinalidad: una por intento con identidad verificada. |
| Contrato de respuesta | `CheckInResultado` sin cambios; el cálculo no agrega ni quita campos. |

## Numeración

- Decisiones: **D-88+** (última registrada D-87).
- Tareas: **T-056+** (última registrada T-055d).
- Pendientes: **P-68+**; esta change cierra P-64, P-65, P-66, P-67 y abre P-68, P-69, P-70.
