# 7) Operaciones de diseño

> **Fuente**: `arnold/src` al 2026-11-16. Firmas y líneas literales. El orden de validaciones sigue
> el recorrido real: `route.ts` → handler → dominio → datos.
> **NO IMPLEMENTADO** marca lo que el código no hace (p. ej. validar la forma de un body).

## C-01 · Iniciar sesión

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function handleLoginRequest(body: unknown, context: AuditContext = UNKNOWN_CONTEXT): Promise<LoginResult>` — `src/api/auth.ts:47` |
| **Tipo de entrada** | `body: unknown`; usa `{ email, password }` (`src/api/auth.ts:48`) |
| **Ruta** | `POST` — `src/app/api/auth/login/route.ts:6` |
| **Orden de validaciones** | 1) `request.json()`; si falla, `body = null` (`route.ts:8-9`). 2) `email`/`password` deben ser string no vacíos → `400 VALIDATION_ERROR` (`auth.ts:49-51`). 3) usuario por email `insensitive` y `deletedAt: null` (`:53-55`). 4) `comparePassword` contra hash real o dummy (`:57`). 5) `estado !== 'ACTIVO'` → `403 AUTH_DISABLED` (`:68-73`). |
| **Transacción** | **No hay**. Cada escritura (auditoría, refresh) va por separado. |
| **Tablas leídas** | `Usuario` |
| **Tablas escritas** | `AuditoriaAcceso` (siempre con intención de login), `RefreshToken` (best-effort) |
| **Errores (code)** | `VALIDATION_ERROR` 400 · `AUTH_INVALID` 401 · `AUTH_DISABLED` 403 · `RATE_LIMITED` 429 (proxy) |
| **Funciones puras** | Ninguna de `src/domains`. Usa `comparePassword`, `createJWT`, `hashPassword` de `src/lib/auth.ts` y `issueRefreshToken` de `src/lib/refresh-token.ts` |
| **Best-effort** | Emisión del refresh: si falla, log y login 200 igual (`auth.ts:84-89`); la auditoría no bloquea |

## C-02 · Registrar pago

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function registrarPago(input: RegistrarPagoInput): Promise<PagoRegistrado>` — `src/domains/pago/registrar-pago.ts:98`; envuelto por `handleRegistrarPago` (`src/api/pagos.ts:25`) y `handleRegistrarPagoRequest` (`src/app/api/pagos/route.ts:26`) |
| **Entrada** | `RegistrarPagoInput { socioId: string; metodoPago: string; fechaPago?: Date; hoy?: Date; montoEsperado?: number }` (`registrar-pago.ts:50-62`) |
| **Ruta** | `POST` — `src/app/api/pagos/route.ts:55` |
| **Orden de validaciones** | 1) `extractUserFromRequest` → `401` (`route.ts:56-63`). 2) rol ∈ {ADMINISTRADOR, RECEPCIONISTA} → `403` (`:64-70`). 3) `readJsonBody` → `400` (`:72-73`). 4) body objeto, no array, `socioId` string no vacío (`:75-84`). 5) dominio: `socioId` string no vacío (`registrar-pago.ts:99-106`). 6) `metodoPago` ∈ `METODOS_PAGO` (`:108-110`). 7) socio existe (`:114-118`). 8) socio con membresía asignada (`:120-123`). 9) dentro de la transacción: cuota con esa `fechaVencimiento` no existente (`:176-182`), oferta evaluada (`:187-199`), monto esperado coincide (`:204-206`). |
| **Transacción** | Empieza en `prisma.$transaction(async (tx) => {…}, { isolationLevel: "Serializable" })` — `registrar-pago.ts:160-230`; termina en el `return` del callback. Cubre: guard de duplicado, evaluación de oferta, `create Cuota`, `create Pago`. |
| **Tablas leídas** | `Socio` (con `membresiaAsignada`), `Cuota` (última y guard por período), `ConfiguracionDelSistema` (vía `getConfiguracion`), `Pago`, `Asistencia` (para la oferta) |
| **Tablas escritas** | `Cuota` (alta), `Pago` (alta `CONFIRMADO`), `RegistroDeAuditoria` (best-effort en el route) |
| **Errores (code)** | `VALIDATION_ERROR` 400 · `NOT_FOUND` 404 · `PAYMENT_ALREADY_REGISTERED` 409 · `AMOUNT_CHANGED` 409 · `PAYMENT_CONFLICT` 409 (`P2034`, `:239-242`) |
| **Funciones puras** | `estadoCuotaSocio`, `periodoDe`, `planDePago` (`src/domains/pago/cuota.ts`); `evaluarOferta`, `aplicarOferta` (`src/domains/pago/oferta-reactivacion.ts`) |

## C-03 · Registrar ingreso por DNI y PIN

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function handleCheckIn(input: CheckInInput): Promise<CheckInResultado>` — `src/api/acceso.ts:263`; motor compartido `evaluarYRegistrarAcceso(prisma, socio, {ip, userAgent, metodo, ahora})` — `src/api/acceso.ts:164` |
| **Entrada** | `CheckInInput { dni: string; pin: string; ip?: string; userAgent?: string; ahora?: Date }` (`acceso.ts:108-115`) |
| **Ruta** | `POST` — `src/app/api/acceso/check-in/route.ts:40` |
| **Orden de validaciones** | 1) sesión → `401` (`route.ts:41-47`). 2) rol ∈ {ADMIN, RECEP} → `403` (`:48-54`). 3) JSON → `400` (`:57-63`). 4) `dni` y `pin` no vacíos → `400 VALIDATION_REQUIRED` (`:66-72`). 5) rate limit por IP (20/min) → `429` (`acceso.ts:270-272`). 6) socio por DNI normalizado (`:279-288`). 7) PIN válido (`:290`). 8) si identidad inválida: hit de rate limit + auditoría y **retorno sin `Asistencia`** (`:294-308`). 9) sino: `evaluarYRegistrarAcceso` → cuota, config y anti-passback (`:169-191`). |
| **Transacción** | `prisma.$transaction` para `Asistencia` + `AuditoriaAcceso` — `acceso.ts:198-220`. Sin `isolationLevel` explícito (por defecto). |
| **Tablas leídas** | `Socio`, `Cuota`, `ConfiguracionDelSistema`, `Asistencia` (ventana anti-passback), `RateLimitLog` |
| **Tablas escritas** | `RateLimitLog` (solo intento fallido), `AuditoriaAcceso`, `Asistencia`, y por el gancho de asignación `AsignacionDeEjercicio` |
| **Errores (code)** | `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `VALIDATION_ERROR`/`VALIDATION_REQUIRED` 400 · `RATE_LIMITED` 429 |
| **Funciones puras** | `normalizeDNI`, `decidirAcceso`, `estadoCuotaSocio`, `periodoDe`, `diaLimiteDelMes`, `estadoCuentaDe`, `ventanaAntiPassbackMinutos` |
| **Best-effort** | `dispararCalculoDeAsignacion` solo si el resultado es distinto de `DENEGADO` (`acceso.ts:222-224`) |

## C-04 · Asignar rutina

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function asignarRutina(input: AsignarRutinaInput)` — `src/domains/rutina/asignar-rutina.ts:64` |
| **Entrada** | `AsignarRutinaInput { socioId: string; rutinaId: string }` (`:12-15`) |
| **Ruta** | `POST` — `src/app/api/rutinas-asignadas/route.ts:68` |
| **Orden de validaciones** | 1) sesión → `401` (`:69-75`). 2) rol ∈ {ADMIN, INSTRUCTOR} → `403` (`:76-82`). 3) JSON → `400` (`:85-91`). **NO IMPLEMENTADO**: no valida `socioId`/`rutinaId`. 4) dominio: socio existe → 404 (`:67-71`). 5) socio activo y no borrado → 400 (`:73-76`). 6) rutina existe → 404 (`:78-79`). |
| **Transacción** | `prisma.$transaction(async (tx) => { updateMany; create }, { isolationLevel: "Serializable" })` — `asignar-rutina.ts:85-98` |
| **Tablas leídas** | `Socio` (+ `usuario.estado/deletedAt`), `Rutina` |
| **Tablas escritas** | `RutinaAsignada` (desactiva las activas y crea la nueva), `RegistroDeAuditoria` (route, best-effort) |
| **Errores (code)** | `VALIDATION_SOCIO_INACTIVO` 400 · `NOT_FOUND` 404 · `ASIGNACION_CONFLICTO` 409 |
| **Funciones puras** | Ninguna; el dominio usa Prisma directamente (excepción permitida por el guardián: no importa `@/lib/db` estáticamente, usa `await import`) |

## C-05 · Iniciar sesión de entrenamiento

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function iniciarSesion(input: IniciarSesionInput): Promise<SesionIniciada>` — `src/domains/sesion/sesion-de-entrenamiento.ts:215` |
| **Entrada** | `IniciarSesionInput { socioId: string; rutinaAsignadaId: string; ahora?: Date; timeouts?: TimeoutsAsignacion }` (`:56-63`) |
| **Ruta** | `POST` — `src/app/api/sesiones/route.ts:76`; handler `handleIniciarSesion` (`src/api/sesiones.ts:41`) |
| **Orden de validaciones** | 1) sesión → `401` (`route.ts:77-84`). 2) rol ∈ {SOCIO, ADMIN} → `403` (`:81-85`). 3) JSON (`:87-91`). 4) `rutinaAsignadaId` presente → `400 VALIDATION_REQUIRED` (`:92-96`). 5) resolución del `socioId` (socio → propio; si manda otro → `403`; staff → obligatorio) (`:98-113`). 6) dominio: socio existe → 404 (`:217-226`). 7) asignación existe → 404 (`:228-238`). 8) `activa` → 400 (`:239-241`). 9) pertenece al socio → 400 (`:242-246`). |
| **Transacción** | `prisma.$transaction(async (tx) => {…})` — `:275-330`; abarca: abandonar la anterior, crear la sesión, consumir reserva o crear ejecución, fallback. Sin `isolationLevel` explícito. |
| **Tablas leídas** | `Socio`, `RutinaAsignada` (+ `Rutina` + `EjercicioEnRutina` + `Ejercicio`), `AsignacionDeEjercicio`, `EjercicioMaquina`, `ConfiguracionDelSistema` |
| **Tablas escritas** | `SesionDeEntrenamiento` (abandona y crea), `AsignacionDeEjercicio` (consume o crea) |
| **Errores (code)** | `NOT_FOUND` 404 · `VALIDATION_ERROR` 400 · `VALIDATION_REQUIRED` 400 · `FORBIDDEN` 403 |
| **Funciones puras/auxiliares** | `esClienteConAsignaciones` (`integracion-asignaciones.ts:22`), `leerReservaVigenteParaSesion` (`:42`), `consumirReservaParaSesion` (`:57`), `maquinaUnicaDe` (`:71`), `crearEjecucionParaSesion` (`:143`) |

## C-06 · Registrar serie

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function registrarSerie(input: RegistrarSerieInput): Promise<SerieRegistrada>` — `src/domains/sesion/sesion-de-entrenamiento.ts:460` |
| **Entrada** | `RegistrarSerieInput { sesionId; ejercicioId; carga: number; repeticiones: number; rir?: number \| null; tipo?: TipoSerie; drops?: DropDeSerie[]; ahora?: Date; timeouts?: … }` (`:65-85`) |
| **Ruta** | `POST` — `src/app/api/sesiones/[id]/series/route.ts:26`; handler `handleRegistrarSerie` (`src/api/sesiones.ts:46`) |
| **Orden de validaciones** | 1) sesión/rol (`route.ts`). 2) JSON. 3) `ejercicioId`, `carga`, `repeticiones` presentes y numéricos → `400 VALIDATION_REQUIRED` (`:70-77`). 4) `rir` no numérico → `400` (SE-5, `:81-87`). 5) `tipo` inválido → `400` (`:90-97`). 6) dominio: `carga ≥ 0` y finita (`:462-464`). 7) `repeticiones` entero ≥ 1 (`:465-467`). 8) `rir` 0–5 (`validarRir`). 9) `tipo` del dominio (`:469-472`). 10) `DROP_SET` como tipo → 400 (`:473-476`). 11) `drops` (`validarDrops`, `:477`). 12) dentro de la transacción: sesión existe, `EN_CURSO`, con ejercicio y serie, y el ejercicio es el actual (`:495-507`). 13) guarda optimista (`:592-608`). |
| **Transacción** | `prisma.$transaction(async (tx) => {…})` — `:491-651`; cubre lectura, avance guardado, `RegistroDeProgreso`, drops y consumo/creación de ejecución. |
| **Tablas leídas** | `SesionDeEntrenamiento` (+ `RutinaAsignada`, `Rutina`, `EjercicioEnRutina`), `AsignacionDeEjercicio`, `EjercicioMaquina` |
| **Tablas escritas** | `SesionDeEntrenamiento` (avance), `RegistroDeProgreso` (serie + drops), `AsignacionDeEjercicio` (completar/consumir/crear) |
| **Errores (code)** | `NOT_FOUND` 404 · `VALIDATION_ERROR` 400 · `VALIDATION_REQUIRED` 400 |
| **Funciones puras** | `validarRir`, `esTipoSerie`, `validarDrops` (local), `completarEjecucionParaSesion` (`:118`), `completarEjecucionesDeSesion` (`:131`) |
| **Best-effort** | `recalcularTrasSesion({momento: "POST_EJERCICIO"})` solo al completar un ejercicio (`:653-661`) |

## C-07 · Finalizar sesión

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function finalizarSesion(input: FinalizarSesionInput)` — `src/domains/sesion/sesion-de-entrenamiento.ts:718` |
| **Entrada** | `FinalizarSesionInput { sesionId: string; ahora?: Date }` (`:91-94`) |
| **Ruta** | `PUT` — `src/app/api/sesiones/[id]/route.ts:24`; handler `handleFinalizarSesion` (`src/api/sesiones.ts:56`) |
| **Orden de validaciones** | 1) sesión (`401`) y rol ∈ {SOCIO, ADMIN} (`403`). 2) dominio: sesión existe → `404` (`:722-726`). 3) si no está `EN_CURSO`, devuelve sin tocar (`:728-730`) — idempotente. |
| **Transacción** | Solo si hay modelos de asignación: `prisma.$transaction` (`:750-760`). Si no, un `update` suelto (`:744-746`). |
| **Tablas leídas** | `SesionDeEntrenamiento` |
| **Tablas escritas** | `SesionDeEntrenamiento` (`horaFin`, estado), `AsignacionDeEjercicio` (completar las `EN_CURSO`) |
| **Errores (code)** | `NOT_FOUND` 404 · `FORBIDDEN` 403 |
| **Funciones puras** | `completarEjecucionesDeSesion` (`integracion-asignaciones.ts:131`) |

## C-08 · Obtener sugerencia de asignación

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function handleObtenerSugerencia(solicitud: SolicitudSugerencia): Promise<ResultadoHandler<RespuestaSugerencia>>` — `src/api/asignaciones.ts:120` |
| **Entrada** | `SolicitudSugerencia { actor: ActorAsignaciones; socioIdQuery: string \| null; ahora: Date }` (`:19-23`) |
| **Ruta** | `GET` — `src/app/api/asignaciones/sugerencia/route.ts:32` |
| **Orden de validaciones** | 1) `extractUserFromRequest` → `401` (`route.ts:11-19`). 2) rol ∈ {SOCIO, ADMIN, INSTRUCTOR} → `403` (`:20-27`). 3) si es SOCIO y manda `socioId` → `403` (`asignaciones.ts:128-129`). 4) staff sin `socioId` → `400` (`:134-136`). 5) socio inexistente → `404` (`:130-131`, `:137-139`). 6) sin rutina activa → 200 con `null` (`:143-148`). |
| **Transacción** | **Ninguna**: es lectura pura (`orquestacion.ts` sin `$transaction`). |
| **Tablas leídas** | `Socio`, `RutinaAsignada`, `AsignacionDeEjercicio`, `ConfiguracionDelSistema`, `SesionDeEntrenamiento`, `EjercicioMaquina`, `Rutina`/`EjercicioEnRutina` |
| **Tablas escritas** | Ninguna |
| **Errores (code)** | `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `VALIDATION_ERROR` 400 · `NOT_FOUND` 404 |
| **Funciones puras** | `calcularEspera` (`motor-espera.ts:258`), `esMaquinaUsable` (`:65`) |
| **Notas** | `reservaVigente` (`orquestacion.ts:216`) y `calcularSinReservar` (`:297`) degradan a `null` si el motor falla; la respuesta no expone el error. |

## C-09 · Decidir sugerencia de asignación

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function handleDecidirSugerencia(solicitud: SolicitudDecision): Promise<ResultadoHandler<RespuestaDecision>>` — `src/api/asignaciones.ts:188`; dominio `decidirSugerencia(input, deps)` — `src/domains/asignacion/orquestacion.ts:246` |
| **Entrada** | `SolicitudDecision { actor; body: unknown; ahora: Date }` (`:44-48`); body `{ accion: "ACEPTAR" \| "ESPERAR" }` |
| **Ruta** | `POST` — `src/app/api/asignaciones/decidir/route.ts:33` |
| **Orden de validaciones** | 1) sesión → `401`. 2) rol ∈ {SOCIO} → `403` (`route.ts:22-29`). 3) `leerAccion(body)` → `400` (`asignaciones.ts:193-194`). 4) en dominio: lock + reserva vigente (`orquestacion.ts:253-259`). 5) sin reserva → `404 SIN_SUGERENCIA` o `409 SIN_SUGERENCIA_VIGENTE` según `NUNCA_EXISTIO`/`YA_NO_VIGENTE` (`asignaciones.ts:207-211`). 6) `contenido` (error/timeout) → `500` (`:213-215`). |
| **Transacción** | `repositorio.enTransaccionBloqueada(fn, { maxWait, timeout })` (`orquestacion.ts:253-268`) → `pg_advisory_xact_lock` dentro de la transacción (`asignacion-repositorio.ts:115-130`). |
| **Tablas leídas** | `AsignacionDeEjercicio`, `ConfiguracionDelSistema`, `Socio` |
| **Tablas escritas** | `AsignacionDeEjercicio` **solo con `ESPERAR`** (`estado = CANCELADA`); `ACEPTAR` no escribe (`orquestacion.ts:242`, `:260`) |
| **Errores (code)** | `VALIDATION_ERROR` 400 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `SIN_SUGERENCIA` 404 · `SIN_SUGERENCIA_VIGENTE` 409 · `SERVER_ERROR` 500 |
| **Funciones puras** | `sinSugerencia` (`:225`), `conTimeout` (`:270`), `cancelarReserva` (repositorio) |

## C-10 · Registrar cierre de caja

| Campo | Detalle |
|---|---|
| **Firma real** | `export async function cerrarCaja(input: CerrarCajaInput): Promise<CierreDeCajaCreado>` — `src/domains/cierre/cierre-de-caja.ts:118`; handler `handleCerrarCaja(input: CerrarCajaRequest)` — `src/api/cierres.ts:80` |
| **Entrada** | `CerrarCajaInput extends RangoDeCierre { responsableId: string; desde: Date; hasta: Date }` (`:39-44`); `CerrarCajaRequest { usuarioId: string; desde?: Date; hasta?: Date; ahora?: Date }` (`src/api/cierres.ts:21-28`) |
| **Ruta** | `POST` — `src/app/api/cierres/route.ts:88` |
| **Orden de validaciones** | 1) sesión → `401` (`:89-94`). 2) rol ∈ {ADMIN, RECEP} → `403` (`:95-101`). 3) `request.text()` y `JSON.parse` si hay cuerpo → `400` (`:103-113`). 4) `parseFecha(desde/hasta)` → `400` (`:116-123`). 5) `resolverEmpleadoId` → `400` si el usuario no tiene empleado (`cierre-de-caja.ts:181`). 6) dentro de la transacción: no existe cierre en `[desde, hasta]` (`:124-130`). |
| **Transacción** | `prisma.$transaction(async (tx) => {…}, { isolationLevel: "Serializable" })` — `cierre-de-caja.ts:122-176` |
| **Tablas leídas** | `Empleado`, `CierreDeCaja` (guard), `Pago` (pendientes) |
| **Tablas escritas** | `CierreDeCaja` (alta), `Pago` (`cierreDeCajaId`), `RegistroDeAuditoria` (route, best-effort) |
| **Errores (code)** | `VALIDATION_ERROR` 400 · `CASH_CLOSE_CONFLICT` 409 (`P2034` o conteo distinto) |
| **Funciones puras** | `calcularTotales` (`:69`), `rangoPorDefecto`/`startOfGymDay` (`src/api/cierres.ts:67-73`) |

---

## Resumen

| # | Operación | Dominio | Transacción | Aislamiento |
|---|---|---|---|---|
| C-01 | Iniciar sesión | No | No | — |
| C-02 | Registrar pago | `registrar-pago.ts` | Sí | `Serializable` |
| C-03 | Check-in | `acceso/check-in.ts` | Sí (asistencia + auditoría) | Defecto |
| C-04 | Asignar rutina | `rutina/asignar-rutina.ts` | Sí | `Serializable` |
| C-05 | Iniciar entrenamiento | `sesion/sesion-de-entrenamiento.ts` | Sí | Defecto |
| C-06 | Registrar serie | `sesion/sesion-de-entrenamiento.ts` | Sí | Defecto + guarda optimista |
| C-07 | Finalizar sesión | `sesion/sesion-de-entrenamiento.ts` | Sí (condicional) | Defecto |
| C-08 | Sugerencia | `asignacion/orquestacion.ts` | No (lectura) | — |
| C-09 | Decisión | `asignacion/orquestacion.ts` | Sí | Defecto + advisory lock |
| C-10 | Cierre de caja | `cierre/cierre-de-caja.ts` | Sí | `Serializable` |
