# 6) Diagramas de interacción por capas

> **Fuente**: `arnold/src/` leído en la fecha 2026-11-16. Los nombres de funciones y archivos son
> literales. Las transacciones, aislamientos, locks y llamadas best-effort están marcados con `Note`.
> **Capas**: UI → `route.ts` → handler de aplicación (`src/api`) → dominio (`src/domains`) → acceso a
> datos (`prisma` / `src/lib`) → base de datos. Cuando una capa no existe, se dice.

---

## 1. Iniciar sesión

```mermaid
sequenceDiagram
    actor U as Usuario
    participant UI as LoginPage
    participant R as route.ts<br/>api/auth/login
    participant H as handleLoginRequest<br/>src/api/auth.ts
    participant L as lib (auth, audit, refresh-token)
    participant DB as PostgreSQL

    U->>UI: submit {email, password}
    UI->>R: POST /api/auth/login
    R->>R: request.json() (si falla, body = null)
    R->>H: handleLoginRequest(body, getRequestContext)
    H->>H: valida tipos y no vacíos
    H->>DB: prisma.usuario.findFirst(email insensitive, deletedAt null)
    DB-->>H: Usuario o null
    H->>L: comparePassword(password, hash o dummyHash)
    alt credenciales inválidas
        H->>L: recordAccessAttempt(LOGIN, DENY, AUTH_INVALID)
        H-->>R: 401 AUTH_INVALID
    else estado distinto de ACTIVO
        H->>L: recordAccessAttempt(LOGIN, DENY, AUTH_DISABLED)
        H-->>R: 403 AUTH_DISABLED
    else válido
        H->>L: createJWT(usuario.id, 24 h)
        Note over H,DB: best-effort: si falla, el login continúa
        H->>DB: issueRefreshToken(usuario.id) → INSERT RefreshToken
        H->>DB: recordAccessAttempt(LOGIN, ALLOW) → INSERT AuditoriaAcceso
        H-->>R: 200 {success, role} + token + refreshToken
    end
    R-->>UI: Set-Cookie authToken / authRefresh
    UI->>UI: navigateTo(postLoginRoute(from, role))
```

**Sin dominio**: la ruta no tiene `src/domains`; toda la lógica vive en `src/api/auth.ts`. Las
escrituras de auditoría y refresh **no comparten transacción** con nada.

---

## 2. Registrar pago

```mermaid
sequenceDiagram
    actor Rcp as Recepcionista
    participant UI as PagoForm
    participant R as route.ts<br/>api/pagos
    participant H as handleRegistrarPagoRequest<br/>→ handleRegistrarPago
    participant D as registrarPago<br/>domain/pago
    participant P as dominio puro<br/>cuota + oferta
    participant DB as PostgreSQL

    Rcp->>UI: "Confirmar pago"
    UI->>R: POST /api/pagos {socioId, metodoPago, montoEsperado}
    R->>R: extractUserFromRequest → rol ∈ {ADMIN, RECEP}
    R->>R: readJsonBody → valida socioId no vacío
    R->>H: handleRegistrarPagoRequest(body)
    H->>D: registrarPago(input)
    D->>D: valida socioId y metodoPago
    D->>DB: findUnique Socio + membresiaAsignada
    D->>DB: findFirst última Cuota + getConfiguracion
    D->>P: estadoCuotaSocio(...) y planDePago(...)
    Note over D,DB: $transaction(isolationLevel: "Serializable")
    D->>DB: findFirst Cuota con misma fechaVencimiento
    alt ya existe
        D-->>H: PAYMENT_ALREADY_REGISTERED (409)
    else
        D->>DB: evaluarOfertaDeSocio(tx, ...) — lee Pagos/Asistencias
        D->>P: aplicarOferta({monto, evaluacion})
        alt montoEsperado distinto
            D-->>H: AMOUNT_CHANGED (409), rollback
        else
            D->>DB: create Cuota
            D->>DB: create Pago CONFIRMADO (cuotaId, socioId)
            DB-->>D: commit
        end
    end
    Note over R,DB: best-effort fuera de la transacción
    R->>DB: registrarOperacion(ALTA, {pagoId, socioId})
    R-->>UI: 201 {pago, cuota, plan, estadoCuota, montoLista, descuentoPct}
    UI->>UI: notify("Pago registrado: …")
```

Un `P2034` de la transacción se traduce a `PAYMENT_CONFLICT` (`registrar-pago.ts:239-242`).

---

## 3. Registrar ingreso por DNI y PIN

```mermaid
sequenceDiagram
    actor Rcp as Recepcionista
    participant UI as KioscoAcceso
    participant R as route.ts<br/>api/acceso/check-in
    participant H as handleCheckIn<br/>src/api/acceso.ts
    participant D as evaluarYRegistrarAcceso
    participant P as decidirAcceso (puro)
    participant O as dispararCalculoDeAsignacion
    participant DB as PostgreSQL

    Rcp->>UI: DNI + PIN
    UI->>R: POST /api/acceso/check-in {dni, pin}
    R->>R: rol ∈ {ADMIN, RECEP} y dni/pin presentes
    R->>H: handleCheckIn({dni, pin, ip, userAgent})
    H->>DB: isRateLimited(ip, "acceso:check-in", 20)
    alt límite alcanzado
        H-->>R: RATE_LIMITED → 429
    end
    H->>DB: findUnique Socio por normalizeDNI(dni)
    H->>H: comparePassword(pin, socio.pinHash)
    alt identidad inválida
        H->>DB: recordRateLimitHit + create AuditoriaAcceso(CHECK_IN, DENY)
        Note over H,DB: NO crea Asistencia
        H-->>R: 200 {resultado: DENEGADO}
    else identidad válida
        H->>D: evaluarYRegistrarAcceso(prisma, socio, {metodo: DNI_PIN})
        D->>DB: findFirst última Cuota + getConfiguracion
        D->>DB: findFirst Asistencia PERMITIDO desde ventana anti-passback
        D->>P: decidirAcceso({estadoCuota, estadoCuenta, antiPassback, …})
        Note over D,DB: $transaction: Asistencia + AuditoriaAcceso juntas
        D->>DB: create Asistencia
        D->>DB: create AuditoriaAcceso(CHECK_IN, ALLOW/DENY)
        alt permitido
            D->>O: dispararCalculoDeAsignacion (best-effort)
            O->>O: calcularEnCheckIn → calcularYReservar
        end
        D-->>H: CheckInResultado
        H-->>R: 200 {resultado, motivo?, socio, estadoCuota}
    end
    R-->>UI: body → PanelResultado
```

---

## 4. Asignar rutina

```mermaid
sequenceDiagram
    actor I as Instructor
    participant UI as AsignarRutinaModal
    participant R as route.ts<br/>api/rutinas-asignadas
    participant H as handleAsignarRutinaRequest<br/>→ handleAsignarRutina
    participant D as asignarRutina<br/>domain/rutina
    participant DB as PostgreSQL

    I->>UI: DNI → "Buscar" → fetchSocioPorDni
    I->>UI: elige rutina → "Asignar"
    UI->>R: POST /api/rutinas-asignadas {socioId, rutinaId}
    R->>R: rol ∈ {ADMIN, INSTRUCTOR}
    Note over R: NO valida forma del body (request.json y sigue)
    R->>H: handleAsignarRutinaRequest(body)
    H->>D: asignarRutina(input)
    D->>DB: findUnique Socio (con usuario.estado/deletedAt)
    alt no existe
        D-->>H: EntidadNoEncontradaError("Socio") → 404
    else inactive/baja
        D-->>H: SocioInactivoError → 400 VALIDATION_SOCIO_INACTIVO
    end
    D->>DB: findUnique Rutina
    alt no existe
        D-->>H: EntidadNoEncontradaError("Rutina") → 404
    end
    Note over D,DB: $transaction(isolationLevel: "Serializable")
    D->>DB: updateMany RutinaAsignada {activa: false} del socio
    D->>DB: create RutinaAsignada {activa: true}
    alt choque P2034
        D-->>H: AsignacionConflictoError → 409
    end
    Note over R,DB: best-effort
    R->>DB: registrarOperacion(ALTA, {socioId, rutinaId})
    R-->>UI: 201 {success, message: "Rutina asignada", rutinaAsignada}
    UI->>UI: notify("Rutina asignada a …")
```

---

## 5. Iniciar sesión de entrenamiento

```mermaid
sequenceDiagram
    actor So as Socio
    participant UI as EjecucionRutina
    participant C as src/api/sesiones.ts<br/>(cliente)
    participant R as route.ts<br/>api/sesiones
    participant H as handleIniciarSesion
    participant D as iniciarSesion<br/>domain/sesion
    participant DB as PostgreSQL

    So->>UI: "Empezar entrenamiento"
    UI->>C: fetchSesionEnCurso() → GET /api/sesiones?enCurso=1
    alt no hay sesión
        UI->>C: iniciarSesionDeEntrenamiento({rutinaAsignadaId})
        C->>R: POST /api/sesiones
        R->>R: rol ∈ {SOCIO, ADMIN}; resuelve socioId propio
        R->>H: handleIniciarSesion({socioId, rutinaAsignadaId})
        H->>D: iniciarSesion(input)
        D->>DB: findUnique Socio
        D->>DB: findUnique RutinaAsignada (rutina + ejercicios ordenados)
        D->>DB: leerReservaVigenteParaSesion (AsignacionDeEjercicio)
        Note over D,DB: $transaction
        D->>DB: updateMany SesionDeEntrenamiento EN_CURSO → ABANDONADA (horaFin)
        D->>DB: create SesionDeEntrenamiento EN_CURSO (ejercicioActualId, serieActual 1)
        alt hay reserva de la rutina
            D->>DB: consumirReservaParaSesion → AsignacionDeEjercicio EN_CURSO + sesionId
        else sin reserva
            D->>DB: crearEjecucionParaSesion (máquina única candidata)
        end
        D-->>H: SesionIniciada
        H-->>R: 201 {sesion, ejercicios, ultimasVeces, sugerencias, records}
        R-->>UI: detalle
    end
```

---

## 6. Registrar serie

```mermaid
sequenceDiagram
    actor So as Socio
    participant UI as EjecucionRutina
    participant C as src/api/sesiones.ts<br/>(cliente)
    participant R as route.ts<br/>sesiones/[id]/series
    participant H as handleRegistrarSerie
    participant D as registrarSerie<br/>domain/sesion
    participant S as recalcularTrasSesion
    participant DB as PostgreSQL

    So->>UI: "Serie hecha"
    UI->>C: registrarSerieDeEntrenamiento(sesionId, {ejercicioId, carga, repeticiones, rir, tipo, drops})
    C->>R: POST /api/sesiones/{id}/series
    R->>R: rol ∈ {SOCIO, ADMIN}; valida campos, rir, tipo
    R->>H: handleRegistrarSerie(body)
    H->>D: registrarSerie(input)
    D->>D: valida carga, repeticiones, rir, tipo, drops
    Note over D,DB: $transaction
    D->>DB: findUnique SesionDeEntrenamiento (+ rutina y ejercicios)
    alt sesión no EN_CURSO / ejercicio no actual
        D-->>H: 400 VALIDATION_ERROR
    end
    alt tipo = CALENTAMIENTO
        D->>DB: create RegistroDeProgreso (numeroSerie null)
        Note over D: no mueve la sesión
    else serie normal
        D->>DB: updateMany sesión (guarda optimista por serieActual/ejercicioActualId)
        D->>DB: create RegistroDeProgreso
        D->>DB: create RegistroDeProgreso por cada drop (tipo DROP_SET)
        alt completa el ejercicio
            D->>DB: completarEjecucionParaSesion
            D->>DB: consumirReservaParaSesion o crearEjecucionParaSesion
        end
    end
    DB-->>D: commit
    alt completó ejercicio
        D->>S: recalcularTrasSesion(POST_EJERCICIO) — best-effort
        S->>S: calcularYReservar
    end
    D-->>H: {registro, sesion, drops}
    H-->>R: 201
    R-->>UI: actualiza serie, descanso y encabezado
```

---

## 7. Finalizar sesión

```mermaid
sequenceDiagram
    actor So as Socio
    participant UI as EjecucionRutina
    participant C as src/api/sesiones.ts<br/>(cliente)
    participant R as route.ts<br/>sesiones/[id]
    participant H as handleFinalizarSesion
    participant D as finalizarSesion<br/>domain/sesion
    participant DB as PostgreSQL

    So->>UI: última serie registrada
    UI->>C: finalizarSesionDeEntrenamiento(sesionId)
    C->>R: PUT /api/sesiones/{id}
    R->>R: rol ∈ {SOCIO, ADMIN}
    R->>H: handleFinalizarSesion({sesionId})
    H->>D: finalizarSesion(input)
    D->>DB: findUnique SesionDeEntrenamiento
    alt no existe
        D-->>H: NOT_FOUND → 404
    else ya no está EN_CURSO
        D-->>H: devuelve la sesión sin cambios (200)
    else EN_CURSO
        Note over D,DB: $transaction
        D->>DB: update SesionDeEntrenamiento {horaFin, COMPLETADA o INCOMPLETA}
        D->>DB: completarEjecucionesDeSesion (AsignacionDeEjercicio EN_CURSO → COMPLETADA)
    end
    H-->>R: 200 {sesion}
    UI->>C: fetchResumenDeSesion(sesionId) → GET /resumen (puede fallar sin romper)
```

---

## 8. Sugerencia de asignación dinámica

```mermaid
sequenceDiagram
    actor So as Socio
    participant UI as useSugerenciaAsignacion
    participant C as asignaciones-cliente.ts
    participant R as route.ts<br/>asignaciones/sugerencia
    participant H as handleObtenerSugerencia
    participant O as orquestacion<br/>reservaVigente / calcularSinReservar
    participant REP as asignacion-repositorio
    participant DB as PostgreSQL

    So->>UI: abre la home / vuelve a la pestaña
    UI->>C: fetchSugerencia(AbortSignal)
    C->>R: GET /api/asignaciones/sugerencia
    R->>R: rol ∈ {SOCIO, ADMIN, INSTRUCTOR}
    R->>H: handleObtenerSugerencia({actor, socioIdQuery, ahora})
    H->>H: resuelve socioId (socio propio o staff con ?socioId)
    H->>DB: tieneRutinaActiva(socioId)
    alt sin rutina
        H-->>R: 200 {sugerencia: null, siguienteEnOrden: null}
    else con rutina
        H->>O: reservaVigente({socioId, ahora})
        O->>REP: leerSugerenciaVigente
        REP->>DB: findFirst AsignacionDeEjercicio RESERVADA vigente
        H->>O: siguienteSeguro → calcularSinReservar
        O->>REP: leerConfiguracion / leerEntradaMotor
        REP->>DB: ConfiguracionDelSistema + rutina + ocupación
        O->>O: motor-espera.calcularEspera (puro)
        O-->>H: siguienteEnOrden o null
        H-->>R: 200 {socioId, sugerencia, siguienteEnOrden, calculadoEn}
    end
    R-->>UI: DTO
    UI->>UI: estado lista / sin_datos / error
```

**Lectura pura**: no crea ni reserva. La reserva la crea `calcularYReservar`, disparado por el
check-in y por los eventos de sesión (`orquestacion.ts:101`, `:339`).

---

## 9. Decisión de asignación dinámica

```mermaid
sequenceDiagram
    actor So as Socio
    participant UI as useSugerenciaAsignacion
    participant C as asignaciones-cliente.ts
    participant R as route.ts<br/>asignaciones/decidir
    participant H as handleDecidirSugerencia
    participant D as decidirSugerencia<br/>orquestacion.ts
    participant REP as enTransaccionBloqueada
    participant DB as PostgreSQL

    So->>UI: "Ir ahora" o "Esperar"
    UI->>C: decidirSugerencia("ACEPTAR" o "ESPERAR")
    C->>R: POST /api/asignaciones/decidir {accion}
    R->>R: rol = SOCIO
    R->>H: handleDecidirSugerencia({actor, body, ahora})
    H->>H: leerAccion(body) → si falta, 400
    H->>D: decidirSugerencia({socioId, accion, ahora}, {timeouts})
    D->>REP: enTransaccionBloqueada(fn, {maxWait, timeout})
    REP->>DB: BEGIN
    REP->>DB: SELECT pg_advisory_xact_lock(CLAVE_LOCK_INSTALACION)
    D->>DB: leerSugerenciaVigente(socioId, ahora)
    alt sin vigente
        D->>D: sinSugerencia(...) → NUNCA_EXISTIO o YA_NO_VIGENTE
    else ACEPTAR
        Note over D: no escribe; devuelve la reserva vigente
    else ESPERAR
        D->>DB: cancelarReserva(id, ahora) — update guardado por estado y venceEn
    end
    REP->>DB: COMMIT
    alt timeout
        D-->>H: {tipo: "contenido", motivo: "TIMEOUT"}
    end
    H-->>R: 200, 404 SIN_SUGERENCIA, 409 SIN_SUGERENCIA_VIGENTE o 500
    R-->>UI: DTO
    UI->>C: reconsulta la sugerencia
```

---

## 10. Registrar cierre de caja

```mermaid
sequenceDiagram
    actor Rcp as Recepcionista
    participant UI as CierresPage
    participant C as src/api/cierres.ts<br/>(cliente)
    participant R as route.ts<br/>api/cierres
    participant H as handleCerrarCajaRequest<br/>→ handleCerrarCaja
    participant D as cerrarCaja<br/>domain/cierre
    participant DB as PostgreSQL

    UI->>C: fetchPreviewCierre() → GET /api/cierres?preview=1
    Rcp->>UI: "Confirmar cierre" (rango previsualizado)
    UI->>C: createCierre({desde, hasta})
    C->>R: POST /api/cierres
    R->>R: rol ∈ {ADMIN, RECEP}; parsea JSON y fechas
    R->>H: handleCerrarCajaRequest(user.id, desde, hasta)
    H->>D: resolverEmpleadoId(usuarioId)
    D->>DB: findUnique Empleado por usuarioId
    H->>D: cerrarCaja({responsableId, desde, hasta})
    Note over D,DB: $transaction(isolationLevel: "Serializable")
    D->>DB: findFirst CierreDeCaja con createdAt en [desde, hasta]
    alt ya existe
        D-->>H: CASH_CLOSE_CONFLICT → 409
    end
    D->>DB: findMany Pago CONFIRMADO, cierreDeCajaId null, fechaPago ≤ hasta
    D->>D: calcularTotales(pagos) (puro)
    D->>DB: create CierreDeCaja (totales + responsableId)
    D->>DB: updateMany Pago {cierreDeCajaId}
    alt count ≠ pagos.length
        D-->>H: CASH_CLOSE_CONFLICT (rollback total)
    end
    Note over R,DB: best-effort
    R->>DB: registrarOperacion(ALTA, {cierreId})
    R-->>UI: 201 {…totales, pagos}
    UI->>UI: notify("Cierre registrado: …") y recarga
```

---

## Resumen de transacciones y locks

| Operación | Transacción | Aislamiento | Lock | Best-effort |
|---|---|---|---|---|
| Login | No | — | — | Refresh token y auditoría |
| Registrar pago | Sí | `Serializable` | — | `registrarOperacion(ALTA)` |
| Check-in | Sí (Asistencia + auditoría) | Por defecto | — | Cálculo de asignación |
| Asignar rutina | Sí | `Serializable` | — | `registrarOperacion(ALTA)` |
| Iniciar entrenamiento | Sí | Por defecto | — | — |
| Registrar serie | Sí | Por defecto | Guarda optimista (`updateMany` por estado) | Recálculo al completar ejercicio |
| Finalizar sesión | Sí (si hay asignaciones) | Por defecto | — | — |
| Sugerencia | No (lectura) | — | — | — |
| Decisión | Sí | Por defecto | `pg_advisory_xact_lock` | — |
| Cierre de caja | Sí | `Serializable` | — | `registrarOperacion(ALTA)` |
