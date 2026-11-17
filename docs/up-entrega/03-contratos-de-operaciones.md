# 3) Contratos de operaciones

> **Fuente de verdad**: `arnold/src/app/api/**/route.ts` (entrada, validación y códigos HTTP),
> `arnold/src/api/*.ts` (handlers de aplicación) y `arnold/src/domains/**` (reglas y transacciones).
> **Fecha de extracción**: 2026-11-16.
> **Nivel**: contratos de **operaciones del sistema** (los mensajes de los SSD). Describen qué
> cambia en el sistema, no cómo se implementa.
> **Postcondiciones**: dicen qué instancias se crean o eliminan, qué asociaciones se forman y qué
> atributos cambian, tal como lo hace el código **dentro de la transacción**. Si algo no se escribe,
> se dice explícitamente.
> **Sin invención**: toda excepción listada existe en el código con ese `code` y ese status.

---

## C-01 · `iniciarSesionDeUsuario(email, password)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `iniciarSesionDeUsuario(email: string, password: string)`. Transporte: `POST /api/auth/login` con body `{ email, password }`. |
| **Responsabilidades** | Verificar credenciales contra `Usuario` (email sin distinguir mayúsculas, `deletedAt = null`), verificar que la cuenta esté `ACTIVO`, emitir el JWT de sesión y, de forma aditiva, el refresh token; registrar el intento. |
| **Tipo** | Operación de **escritura de auditoría** con emisión de credenciales (no modifica el `Usuario`). |
| **Referencias cruzadas** | CU-AUT-01 · IniciarSesionConCredenciales. Relacionadas: CU-AUT-04 (registro de intentos), CU-AUT-03 (rate limit), CU-AUT-05 (refresh). |
| **Notas** | El rate limit (**8 intentos por minuto por IP**) lo aplica el proxy, no el handler. El hash de comparación se ejecuta también cuando el usuario no existe (hash falso) para no filtrar por tiempo de respuesta. El estado de la cuenta se evalúa **después** de validar la contraseña, para no revelar si el email existe. |
| **Excepciones** | `429 RATE_LIMITED` (más de 8 por minuto) · `400 VALIDATION_ERROR` (email o password ausentes/vacíos) · `401 AUTH_INVALID` (usuario inexistente o contraseña incorrecta) · `403 AUTH_DISABLED` (usuario `INACTIVO`/`BLOQUEADO`). |
| **Salida** | `200 { success: true, role }` + `Set-Cookie authToken` (24 h, HttpOnly, SameSite=strict) y `authRefresh` (30 días) si se pudo emitir. |
| **Precondiciones** | Existe un `Usuario` con ese email y `deletedAt = null` con contraseña válida y `estado = ACTIVO`. No se requiere sesión previa. |
| **Postcondiciones** | **Crea 1 `AuditoriaAcceso`** (`accion = LOGIN`, `resultado = DENY` con `motivo = AUTH_INVALID`/`AUTH_DISABLED` si falló; `ALLOW` si entró) con `usuarioId` (o `null` si el email no existe), `ipAddress`, `userAgent` y `timestamp`. En el éxito **crea 1 `RefreshToken`** (`usuarioId`, `tokenHash` bcrypt del token opaco, `expiresAt` a 30 días), best-effort: si falla, el login igual responde 200. **No crea ni elimina** otros registros y **no modifica** atributos de `Usuario`. El JWT y las cookies no se persisten en la base. Si la respuesta es 400, no se escribe nada. |

---

## C-02 · `registrarPago(socioId, metodoPago, montoEsperado?)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `registrarPago(socioId: string, metodoPago: "EFECTIVO" \| "TRANSFERENCIA" \| "TARJETA", montoEsperado?: number)`. Transporte: `POST /api/pagos`. |
| **Responsabilidades** | Calcular el plan de cobro (alta con prorrateo, alta completa o renovación), evaluar y aplicar la oferta de reactivación, verificar el anti doble-cobro, y crear la `Cuota` y el `Pago`. |
| **Tipo** | Operación de **escritura** (transacción `Serializable`). |
| **Referencias cruzadas** | CU-PAG-01 · RegistrarPago. Relacionadas: CU-PAG-03 (cálculo del plan y estado), CU-OFE-03 (pago con descuento), CU-OFE-04 (monto esperado). |
| **Notas** | El monto **nunca** viene del cliente: sale de `planDePago` y de `aplicarOferta`. `montoEsperado` es sólo un control optimista. La evaluación de la oferta corre **dentro** de la transacción para que dos cobros simultáneos no usen el mismo descuento dos veces. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {ADMINISTRADOR, RECEPCIONISTA}) · `400 VALIDATION_ERROR` (socioId vacío, método inválido, socio sin membresía asignada, JSON inválido) · `404 NOT_FOUND` (socio) · `409 PAYMENT_ALREADY_REGISTERED` (ya hay una cuota con esa `fechaVencimiento`) · `409 AMOUNT_CHANGED` (el monto calculado difiere de `montoEsperado`) · `409 PAYMENT_CONFLICT` (choque de serialización `P2034`). |
| **Salida** | `201 { pago, cuota, plan, estadoCuota, montoLista, descuentoPct }`. |
| **Precondiciones** | Sesión con rol Administrador o Recepcionista. El `Socio` existe y tiene `membresiaAsignada`. No existe una `Cuota` del socio con la `fechaVencimiento` que se va a crear. |
| **Postcondiciones** | **Crea 1 `Cuota`** (`socioId`, `membresiaId` = la membresía asignada, `fechaInicio` = `plan.cubreDesde`, `fechaVencimiento` = `plan.cubreHasta`, `estado = VIGENTE` por default) y **crea 1 `Pago`** (`monto`, `montoLista`, `descuentoPct`, `metodoPago`, `socioId`, `cuotaId`, `estado = CONFIRMADO`, `fechaPago`). **Forma las asociaciones** `Pago → Cuota` y `Pago → Socio`. **No elimina ni modifica** filas existentes. Fuera de la transacción y best-effort, **crea 1 `RegistroDeAuditoria`** (`ALTA`, `detalles = { pagoId, socioId }`). El `estadoCuotaSocio` que devuelve se **calcula**, no se persiste. |

---

## C-03 · `registrarIngresoPorDniYPin(dni, pin)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `registrarIngresoPorDniYPin(dni: string, pin: string)`. Transporte: `POST /api/acceso/check-in`. |
| **Responsabilidades** | Identificar al socio por DNI normalizado y PIN, decidir el acceso (cuota, cuenta, anti-passback), registrar el ingreso y su auditoría en una transacción, y disparar el cálculo de asignación si el ingreso fue permitido. |
| **Tipo** | Operación de **escritura** (transacción simple) + disparo best-effort de otra operación. |
| **Referencias cruzadas** | CU-ACC-01 · RegistrarIngresoPorDniYPin. Relacionadas: CU-ACC-03 (decisión de acceso), CU-ASIG-01 (cálculo disparado). |
| **Notas** | Un DNI o PIN incorrecto **no** devuelve 401: devuelve 200 con `resultado = DENEGADO` y un mensaje genérico, y **no crea `Asistencia`**. Ese caso consume 1 intento del límite por IP (20/min). Un check-in con identidad válida, permitido o denegado por regla, **no** consume el límite. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {ADMINISTRADOR, RECEPCIONISTA}) · `400 VALIDATION_ERROR`/`VALIDATION_REQUIRED` (cuerpo inválido o falta dni/pin) · `429 RATE_LIMITED` (20 intentos fallidos en el minuto desde la misma IP). |
| **Salida** | `200 { resultado: "PERMITIDO" \| "PERMITIDO_CON_AVISO" \| "DENEGADO", motivo?, socio: { id, nombre, membresia }, estadoCuota }`. |
| **Precondiciones** | Sesión con rol Administrador o Recepcionista. Existe un `Socio` con ese `dni` (normalizado a dígitos) y `pinHash` que valida contra el PIN. No hay otro ingreso `PERMITIDO` del mismo socio dentro de la ventana de anti-passback. |
| **Postcondiciones** | **Identidad inválida**: crea 1 `AuditoriaAcceso` (`CHECK_IN`, `DENY`, `motivo = "DNI o PIN incorrectos"`, IP, user-agent, timestamp) y 1 fila de `RateLimitLog`; **no crea `Asistencia`**. **Identidad válida**: en una transacción **crea 1 `Asistencia`** (`socioId`, `fechaHora = ahora`, `estado = PERMITIDO`/`DENEGADO`, `razon` = motivo si denegó, `metodo = DNI_PIN`, `autorizadoExcepcionalmente = false`) y **crea 1 `AuditoriaAcceso`** (`CHECK_IN`, `ALLOW`/`DENY`, `motivo`, IP, user-agent, `timestamp`). **No elimina ni modifica** otras filas. Si el resultado es permitido, fuera de la transacción dispara el cálculo de asignación (operación C-08): puede **cancelar** reservas activas y **crear** una `AsignacionDeEjercicio` `RESERVADA`. |

---

## C-04 · `asignarRutina(socioId, rutinaId)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `asignarRutina(socioId: string, rutinaId: string)`. Transporte: `POST /api/rutinas-asignadas`. |
| **Responsabilidades** | Verificar socio activo y rutina existente, desactivar la asignación previa y crear la nueva, garantizando RN-04 (una sola activa por socio). |
| **Tipo** | Operación de **escritura** (transacción `Serializable`). |
| **Referencias cruzadas** | CU-ASG-01 · AsignarRutinaASocio. Relacionada: CU-ASG-02 (consulta de asignaciones). |
| **Notas** | RN-04 **no** tiene índice único parcial: se garantiza por transacción. Dos asignaciones concurrentes se serializan y la que pierde recibe `ASIGNACION_CONFLICTO`. La auditoría se escribe fuera de la transacción y es best-effort. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {ADMINISTRADOR, INSTRUCTOR}) · `400 VALIDATION_ERROR` (cuerpo inválido, falta socioId/rutinaId) · `400 VALIDATION_SOCIO_INACTIVO` (socio `INACTIVO`, `BLOQUEADO` o con `deletedAt`) · `404 NOT_FOUND` (socio o rutina; el mensaje distingue cuál) · `409 ASIGNACION_CONFLICTO` (`P2034`). |
| **Salida** | `201 { success: true, message, rutinaAsignada }`. |
| **Precondiciones** | Sesión con rol Administrador o Instructor. El `Socio` existe y está activo. La `Rutina` existe. |
| **Postcondiciones** | **Modifica todas las `RutinaAsignada` del socio con `activa = true`** poniéndolas en `activa = false` (`updateMany`). **Crea 1 `RutinaAsignada`** (`socioId`, `rutinaId`, `activa = true`, `fechaAsignacion = now`). **Forma la asociación** `RutinaAsignada → Socio` y `RutinaAsignada → Rutina`. **No elimina** ninguna fila. Fuera de la transacción, best-effort, **crea 1 `RegistroDeAuditoria`** (`ALTA`, `detalles = { socioId, rutinaId }`). |

---

## C-05 · `iniciarSesionDeEntrenamiento(rutinaAsignadaId, socioId?)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `iniciarSesionDeEntrenamiento(rutinaAsignadaId: string, socioId?: string)`. Transporte: `POST /api/sesiones`. El `socioId` es obligatorio para staff y prohibido para otro socio (el socio sólo puede iniciar la propia). |
| **Responsabilidades** | Abandonar la sesión anterior si había una `EN_CURSO`, crear la nueva sesión en el ejercicio inicial (respetando la reserva vigente si corresponde) y devolver el detalle de la primera serie. |
| **Tipo** | Operación de **escritura** (transacción). |
| **Referencias cruzadas** | CU-SES-01 · IniciarSesionDeEntrenamiento. Relacionadas: CU-SES-02 (retomar), CU-ASIG-01 (reserva consumida). |
| **Notas** | El ejercicio inicial es el de la reserva vigente **si pertenece a la rutina**; si no, el primero por `orden`. Sin índice único parcial no se puede impedir al 100 % que dos inicios concurrentes sin sesión previa creen dos `EN_CURSO`; la transacción cubre el caso secuencial. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {SOCIO, ADMINISTRADOR}, o un socio pidiendo el `socioId` de otro) · `400 VALIDATION_REQUIRED` (falta `rutinaAsignadaId`, o staff sin `socioId`) · `400 VALIDATION_ERROR` (la rutina asignada no está activa o no pertenece al socio) · `404 NOT_FOUND` (socio o rutina asignada). |
| **Salida** | `201 { sesion, ejercicios, ultimasVeces, sugerencias, records }`. |
| **Precondiciones** | La `RutinaAsignada` existe, tiene `activa = true` y pertenece al socio. El socio existe. |
| **Postcondiciones** | **Modifica toda `SesionDeEntrenamiento` del socio en `EN_CURSO`** pasándola a `estadoDeFinalizacion = ABANDONADA` con `horaFin = ahora`. **Crea 1 `SesionDeEntrenamiento`** (`socioId`, `rutinaAsignadaId`, `estadoDeFinalizacion = EN_CURSO`, `horaInicio = ahora`, `ejercicioActualId` = el ejercicio inicial, `serieActual = 1`, o ambos `null` si la rutina no tiene ejercicios). Si había reserva de la rutina y se pudo consumir, **modifica 1 `AsignacionDeEjercicio`** a `estado = EN_CURSO` y le setea `sesionId`; si no, y hay primer ejercicio, **crea 1 `AsignacionDeEjercicio`** `EN_CURSO` con `maquinaId` = la única candidata (o `null`) y `venceEn = ahora`. **No elimina** filas. |

---

## C-06 · `registrarSerie(sesionId, ejercicioId, carga, repeticiones, rir?, tipo?, drops?)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `registrarSerie(sesionId, ejercicioId, carga: number, repeticiones: number, rir?: number, tipo?: "NORMAL" \| "CALENTAMIENTO" \| "HASTA_EL_FALLO", drops?: { carga, repeticiones }[])`. Transporte: `POST /api/sesiones/[id]/series`. `tipo = DROP_SET` se **rechaza** como serie propia. |
| **Responsabilidades** | Validar la serie, avanzar la sesión con guarda optimista, persistir la serie (y sus drop sets), y al completar un ejercicio consumir la reserva o pasar al siguiente ejercicio de la rutina. |
| **Tipo** | Operación de **escritura** (transacción) + recálculo best-effort posterior. |
| **Referencias cruzadas** | CU-SES-03 · RegistrarSerie. Relacionadas: CU-SES-06 (calentamiento y drop set), CU-PRO-02 (descanso), CU-ASIG-01. |
| **Notas** | El calentamiento se guarda **sin `numeroSerie`** y **no mueve la sesión**. El drop set **cuelga** de la serie: se guarda como `RegistroDeProgreso` con `tipo = DROP_SET`, sin `numeroSerie` y sin `rir`, con fecha 1 ms después del anterior. El recálculo de asignación se dispara **sólo al completar un ejercicio**, no en cada serie. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {SOCIO, ADMINISTRADOR}, o sesión de otro socio) · `400 VALIDATION_REQUIRED` (falta ejercicioId/carga/repeticiones) · `400 VALIDATION_ERROR` (carga < 0 o no finita, repeticiones no entero ≥ 1, `rir` no numérico, `tipo` inválido, `drops` inválidos o en calentamiento, más de 5 drops, sesión no `EN_CURSO`, sesión sin ejercicio en curso, ejercicio distinto al actual, o guarda optimista con `count = 0`) · `404 NOT_FOUND` (sesión). |
| **Salida** | `201 { registro, sesion, drops }`. |
| **Precondiciones** | La sesión existe y está `EN_CURSO` con `ejercicioActualId` y `serieActual` no nulos. El `ejercicioId` es el ejercicio actual y pertenece a la rutina de la sesión. |
| **Postcondiciones** | **Crea 1 `RegistroDeProgreso`** (`socioId` de la sesión, `ejercicioId`, `carga`, `repeticiones`, `rir`, `numeroSerie`, `tipo`, `sesionId`, `fecha`). **Crea N `RegistroDeProgreso`** adicionales con `tipo = DROP_SET`, `numeroSerie = null`, `rir = null` y fecha desplazada 1 ms por índice. **Modifica la `SesionDeEntrenamiento`**: `serieActual + 1` o, si era la última serie del ejercicio, `ejercicioActualId` y `serieActual` según la reserva consumida o el siguiente por `orden` (o `null`/`null` si no queda ninguno); la escritura es un `updateMany` guardado por el estado leído. Si completó el ejercicio, **modifica su `AsignacionDeEjercicio`** `EN_CURSO` a `COMPLETADA`; si consumió reserva, **modifica** esa fila a `EN_CURSO` con `sesionId`; si pasó al siguiente por orden, **crea 1 `AsignacionDeEjercicio`** `EN_CURSO`. En calentamiento **no** modifica la sesión. **No elimina** filas. Fuera de la transacción, al completar un ejercicio, dispara el recálculo (C-08). |

---

## C-07 · `finalizarSesionDeEntrenamiento(sesionId)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `finalizarSesionDeEntrenamiento(sesionId: string)`. Transporte: `PUT /api/sesiones/[id]`, sin body. |
| **Responsabilidades** | Cerrar la sesión con su estado final y completar sus ejecuciones en curso. |
| **Tipo** | Operación de **escritura** (transacción) e **idempotente**. |
| **Referencias cruzadas** | CU-SES-04 · FinalizarSesion. Relacionada: CU-SES-05 (resumen posterior). |
| **Notas** | Si la sesión ya no está `EN_CURSO`, devuelve la sesión sin cambios (no es error). El estado final depende de si quedó un ejercicio en curso: `serieActual === null` ⇒ `COMPLETADA`, si no ⇒ `INCOMPLETA`. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {SOCIO, ADMINISTRADOR}, o sesión de otro socio) · `404 NOT_FOUND` (sesión). |
| **Salida** | `200 { sesion }`. |
| **Precondiciones** | La sesión existe. El actor puede operar sobre ella (el socio, sólo la propia; el administrador, cualquiera). |
| **Postcondiciones** | Si estaba `EN_CURSO`: **modifica la `SesionDeEntrenamiento`** con `horaFin` y `estadoDeFinalizacion = COMPLETADA` o `INCOMPLETA`, y en la misma transacción **modifica sus `AsignacionDeEjercicio` en `EN_CURSO`** a `COMPLETADA`. Si no estaba `EN_CURSO`: **no cambia nada**. **No crea ni elimina** filas. |

---

## C-08 · `obtenerSugerenciaDeAsignacion(socioId?)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `obtenerSugerenciaDeAsignacion(socioId?: string)`. Transporte: `GET /api/asignaciones/sugerencia`. El socio no manda `socioId`; el staff lo debe mandar. |
| **Responsabilidades** | Devolver la reserva vigente del socio (si existe) y el siguiente ejercicio en orden, sin crear ni reservar nada. |
| **Tipo** | Operación de **lectura** (sin efectos). |
| **Referencias cruzadas** | CU-ASIG-01 · Calcular (la lectura que consume la UI) y CU-HSO-04 · VerLaSugerenciaDeAsignación. |
| **Notas** | **Esta operación no crea la reserva.** La crea `calcularYReservar`, disparado por el check-in y por los eventos de sesión (`src/domains/asignacion/orquestacion.ts:101`, `:339`). Sin rutina activa devuelve `sugerencia: null` con 200, no un error. Si el motor falla, `siguienteEnOrden` degrada a `null`. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol no permitido, o un socio mandando `socioId`) · `400 VALIDATION_ERROR` (staff sin `socioId`) · `404 NOT_FOUND` (socio inexistente). |
| **Salida** | `200 { socioId, sugerencia: { … } \| null, siguienteEnOrden: { … } \| null, calculadoEn }`. |
| **Precondiciones** | Sesión con rol Socio, Administrador o Instructor. El socio existe. |
| **Postcondiciones** | **Ninguna instancia se crea, modifica ni elimina.** La operación sólo lee `Socio`, `RutinaAsignada` activa, `AsignacionDeEjercicio` vigente y la configuración. |

---

## C-09 · `decidirSugerencia(accion)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `decidirSugerencia(accion: "ACEPTAR" \| "ESPERAR")`. Transporte: `POST /api/asignaciones/decidir`, body `{ accion }`. |
| **Responsabilidades** | Aplicar la decisión obligatoria del socio sobre la sugerencia vigente, bajo el mismo lock que el cálculo. |
| **Tipo** | Operación de **escritura condicional**: `ACEPTAR` no escribe; `ESPERAR` cancela. |
| **Referencias cruzadas** | CU-ASIG-02 · AceptarSugerencia · CU-ASIG-03 · EsperarSugerencia. |
| **Notas** | El comentario del código es explícito: *"ACEPTAR no escribe"* (`orquestacion.ts:242`). La reserva ya existe; aceptar la confirma devolviéndola. `ESPERAR` usa un update **guardado** por `estado = RESERVADA` y `venceEn > ahora`, así una reserva vencida entre la lectura y la escritura no se cancela por error. |
| **Excepciones** | `400 VALIDATION_ERROR` (acción ausente o fuera del dominio) · `403 FORBIDDEN` (rol ≠ SOCIO) · `404 NOT_FOUND` (socio) · `404 SIN_SUGERENCIA` (nunca existió una sugerencia) · `409 SIN_SUGERENCIA_VIGENTE` (venció o ya se decidió) · `500 SERVER_ERROR` (el motor devolvió `contenido` por `ERROR` o `TIMEOUT`). |
| **Salida** | `200 { accion, sugerencia: { … } \| null, siguienteEnOrden }`. |
| **Precondiciones** | Sesión con rol Socio. Existe una `AsignacionDeEjercicio` `RESERVADA` del socio con `venceEn > ahora`. |
| **Postcondiciones** | **`ACEPTAR`**: **no crea, no modifica y no elimina** ninguna fila; devuelve la reserva vigente tal como está. **`ESPERAR`**: **modifica 1 `AsignacionDeEjercicio`** (`estado = CANCELADA`) si y sólo si sigue `RESERVADA` y sin vencer; si el update no afecta filas, no escribe y responde `409 SIN_SUGERENCIA_VIGENTE`. **No crea ni elimina** filas en ningún caso. |

---

## C-10 · `registrarCierreDeCaja(desde?, hasta?)`

| Campo | Contenido |
|---|---|
| **Nombre y parámetros** | `registrarCierreDeCaja(desde?: Date, hasta?: Date)`. Transporte: `POST /api/cierres`, body opcional `{ desde?, hasta? }`. Sin fechas: desde el inicio del día del gimnasio hasta ahora. |
| **Responsabilidades** | Reunir los pagos confirmados todavía sin cierre, totalizarlos por método y persistir el cierre, asignando esos pagos al cierre. |
| **Tipo** | Operación de **escritura** (transacción `Serializable`). |
| **Referencias cruzadas** | CU-CIE-02 · CerrarCaja. Relacionada: CU-CIE-01 (previsualización, misma selección de pagos). |
| **Notas** | El cierre **no** acota inferiormente los pagos: toma todo `CONFIRMADO` con `cierreDeCajaId = null` y `fechaPago ≤ hasta`, incluidos pagos viejos que quedaron sin cerrar (CC-4). El guard de duplicado mira `CierreDeCaja.createdAt` dentro de `[desde, hasta]`. La columna `observaciones` existe en el modelo pero **esta operación no la escribe**. |
| **Excepciones** | `401 UNAUTHORIZED` · `403 FORBIDDEN` (rol ∉ {ADMINISTRADOR, RECEPCIONISTA}) · `400 VALIDATION_ERROR` (JSON inválido, rango de fechas inválido, o el usuario no tiene `Empleado` asociado) · `409 CASH_CLOSE_CONFLICT` (ya hay un cierre creado en el rango, o los pagos fueron tomados por otro cierre concurrente, `P2034` o conteo distinto). |
| **Salida** | `201 { id, totalRecaudado, totalEfectivo, totalTransferencia, totalTarjeta, cantidadOperaciones, pagos }`. |
| **Precondiciones** | Sesión con rol Administrador o Recepcionista. El `Usuario` tiene `Empleado` asociado. No existe otro `CierreDeCaja` con `createdAt` en `[desde, hasta]`. |
| **Postcondiciones** | **Crea 1 `CierreDeCaja`** (`responsableId` = el `Empleado` del usuario, `totalRecaudado`, `totalEfectivo`, `totalTransferencia`, `totalTarjeta`, `cantidadOperaciones`). **Modifica todos los `Pago` seleccionados** seteando `cierreDeCajaId`, lo que **forma la asociación** `Pago → CierreDeCaja`; si el `updateMany` afecta menos filas que las leídas, lanza y la transacción hace rollback completo (no queda cierre ni asociaciones). **No elimina** filas. Fuera de la transacción, best-effort, **crea 1 `RegistroDeAuditoria`** (`ALTA`, `detalles = { cierreId }`). |

---

## Resumen de operaciones

| # | Operación | Tipo | Transacción | Crea | Modifica | Elimina |
|---|---|---|---|---|---|---|
| C-01 | iniciarSesionDeUsuario | escritura de auditoría | — | `AuditoriaAcceso`, `RefreshToken` | — | — |
| C-02 | registrarPago | escritura | Serializable | `Cuota`, `Pago` | — | — |
| C-03 | registrarIngresoPorDniYPin | escritura | sí | `Asistencia`, `AuditoriaAcceso` | — | — |
| C-04 | asignarRutina | escritura | Serializable | `RutinaAsignada` | `RutinaAsignada` (activa=false) | — |
| C-05 | iniciarSesionDeEntrenamiento | escritura | sí | `SesionDeEntrenamiento`, (ejecución) | `SesionDeEntrenamiento` (ABANDONADA), `AsignacionDeEjercicio` | — |
| C-06 | registrarSerie | escritura | sí | `RegistroDeProgreso` (1 + drops), (ejecución) | `SesionDeEntrenamiento`, `AsignacionDeEjercicio` | — |
| C-07 | finalizarSesionDeEntrenamiento | escritura idempotente | sí | — | `SesionDeEntrenamiento`, `AsignacionDeEjercicio` | — |
| C-08 | obtenerSugerenciaDeAsignacion | lectura | — | — | — | — |
| C-09 | decidirSugerencia | escritura condicional | sí | — | `AsignacionDeEjercicio` (sólo ESPERAR) | — |
| C-10 | registrarCierreDeCaja | escritura | Serializable | `CierreDeCaja` | `Pago` (cierreDeCajaId) | — |

> Ninguna de las diez operaciones **elimina** filas. Las bajas del sistema (socio, ejercicio,
> rutina, máquina) están en otras operaciones que no forman parte de estos SSD.
