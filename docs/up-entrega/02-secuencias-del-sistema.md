# 2) Diagramas de secuencia del sistema (SSD)

> **Fuente de verdad**: `arnold/src/app/api/**/route.ts` (validación de entrada y códigos HTTP) y
> `arnold/src/api/*.ts` + `arnold/src/domains/*` (reglas y errores de dominio).
> **Fecha de extracción**: 2026-11-16.
> **Convención**: dos participantes. El actor y **Sistema** como caja negra. No se muestran capas
> internas (proxy, handler, repositorio, Prisma): todos son "Sistema".
> Cada respuesta de error indica **código HTTP + `code` + motivo real** tomado del código.
> Si una regla no existe en el código, se indica **NO IMPLEMENTADO** en lugar de suponerla.

Los errores transversales **401 `UNAUTHORIZED`** y **403 `FORBIDDEN`** los puede devolver cualquier
operación autenticada: el `401` cuando falta el token de sesión y el `403` cuando el rol no tiene el
permiso (matriz en `src/lib/authorization.ts`, chequeo repetido en cada handler). Se listan sólo
donde agregan información; se omiten del dibujo para no repetirlos nueve veces.

---

## 1. Iniciar sesión

Fuente: `src/app/api/auth/login/route.ts`, `src/api/auth.ts`, `src/lib/refresh-token.ts`,
rate limit del proxy (`src/proxy.ts` + `src/lib/rateLimit.ts`).

```mermaid
sequenceDiagram
    actor U as Usuario
    participant S as Sistema

    U->>S: POST /api/auth/login { email, password }
    alt más de 8 intentos por minuto desde la misma IP
        S-->>U: 429 RATE_LIMITED "Demasiados intentos"
    else email o password faltantes o vacíos
        S-->>U: 400 VALIDATION_ERROR "Email y contraseña son obligatorios"
    else credenciales inválidas
        S-->>U: 401 AUTH_INVALID "Email o contraseña incorrectos" + AuditoriaAcceso LOGIN/DENY
    else contraseña válida pero usuario no ACTIVO
        S-->>U: 403 AUTH_DISABLED "Cuenta deshabilitada. Contactá al administrador."
    else credenciales válidas
        S-->>U: 200 { success: true, role } + Set-Cookie authToken (24 h) y authRefresh (30 días)
        Note over S: crea AuditoriaAcceso LOGIN/ALLOW y, best-effort, un RefreshToken con hash
    end
```

---

## 2. Registrar pago

Fuente: `src/app/api/pagos/route.ts`, `src/api/pagos.ts`, `src/domains/pago/registrar-pago.ts`.

```mermaid
sequenceDiagram
    actor R as Recepcionista
    participant S as Sistema

    R->>S: POST /api/pagos { socioId, metodoPago, montoEsperado? }
    alt sin sesión o rol distinto de ADMINISTRADOR/RECEPCIONISTA
        S-->>R: 401 UNAUTHORIZED / 403 FORBIDDEN
    else JSON inválido, socioId vacío o metodoPago fuera del enum
        S-->>R: 400 VALIDATION_ERROR
    else el socio no existe
        S-->>R: 404 NOT_FOUND "Socio no encontrado"
    else el socio no tiene membresía asignada
        S-->>R: 400 VALIDATION_ERROR "El socio no tiene una membresía asignada"
    else ya existe una cuota con la misma fechaVencimiento
        S-->>R: 409 PAYMENT_ALREADY_REGISTERED
    else el monto calculado difiere del montoEsperado enviado
        S-->>R: 409 AMOUNT_CHANGED
    else dos cobros concurrentes del mismo socio (P2034)
        S-->>R: 409 PAYMENT_CONFLICT
    else cobro válido
        S-->>R: 201 { pago, cuota, plan, estadoCuota, montoLista, descuentoPct }
        Note over S: en una transacción Serializable crea Cuota y Pago CONFIRMADO,<br/>asocia Pago.cuotaId y audita ALTA (best-effort)
    end
```

---

## 3. Check-in por DNI y PIN

Fuente: `src/app/api/acceso/check-in/route.ts`, `src/api/acceso.ts`
(`handleCheckIn` y `evaluarYRegistrarAcceso`).

```mermaid
sequenceDiagram
    actor R as Recepcionista
    participant S as Sistema

    R->>S: POST /api/acceso/check-in { dni, pin }
    alt rol distinto de ADMINISTRADOR/RECEPCIONISTA
        S-->>R: 401 UNAUTHORIZED / 403 FORBIDDEN
    else cuerpo inválido, o falta dni o pin
        S-->>R: 400 VALIDATION_ERROR / VALIDATION_REQUIRED "Se requieren el DNI y el PIN"
    else 20 o más intentos de identidad fallidos en el minuto (misma IP)
        S-->>R: 429 RATE_LIMITED "Demasiados intentos. Probá de nuevo en un minuto."
    else DNI inexistente, socio sin PIN o PIN incorrecto
        S-->>R: 200 { resultado: "DENEGADO", motivo: "DNI o PIN incorrectos" }
        Note over S: NO crea Asistencia. Audita CHECK_IN/DENY y suma 1 al límite por IP
    else identidad válida
        S-->>R: 200 { resultado, motivo?, socio { id, nombre, membresia }, estadoCuota }
        Note over S: crea Asistencia (PERMITIDO o DENEGADO) + AuditoriaAcceso en una transacción.<br/>Si fue PERMITIDO, dispara el cálculo de asignación best-effort
    end
```

> `resultado` puede ser `PERMITIDO`, `PERMITIDO_CON_AVISO` (cuota pendiente) o `DENEGADO`
> (cuota vencida, cuenta inactiva/bloqueada o anti-passback).

---

## 4. Asignar rutina

Fuente: `src/app/api/rutinas-asignadas/route.ts`, `src/domains/rutina/asignar-rutina.ts`.

```mermaid
sequenceDiagram
    actor I as Instructor
    participant S as Sistema

    I->>S: POST /api/rutinas-asignadas { socioId, rutinaId }
    alt rol distinto de ADMINISTRADOR/INSTRUCTOR
        S-->>I: 401 UNAUTHORIZED / 403 FORBIDDEN
    else cuerpo inválido o falta socioId/rutinaId
        S-->>I: 400 VALIDATION_ERROR
    else el socio no existe, o la rutina no existe
        S-->>I: 404 NOT_FOUND "Socio no encontrado" / "Rutina no encontrada"
    else el socio está inactivo o dado de baja
        S-->>I: 400 VALIDATION_SOCIO_INACTIVO
    else otra asignación concurrente ganó la carrera (P2034)
        S-->>I: 409 ASIGNACION_CONFLICTO
    else válido
        S-->>I: 201 { success: true, message, rutinaAsignada }
        Note over S: transacción Serializable: desactiva las RutinaAsignada activas del socio<br/>y crea una nueva con activa = true. Audita ALTA (best-effort)
    end
```

---

## 5. Iniciar sesión de entrenamiento

Fuente: `src/app/api/sesiones/route.ts`, `src/domains/sesion/sesion-de-entrenamiento.ts`
(`iniciarSesion`).

```mermaid
sequenceDiagram
    actor So as Socio
    participant S as Sistema

    So->>S: POST /api/sesiones { rutinaAsignadaId, socioId? }
    alt sin sesión, o rol distinto de SOCIO/ADMINISTRADOR
        S-->>So: 401 UNAUTHORIZED / 403 FORBIDDEN
    else falta rutinaAsignadaId, o el staff no manda socioId
        S-->>So: 400 VALIDATION_REQUIRED
    else un SOCIO manda el socioId de otro
        S-->>So: 403 FORBIDDEN
    else el socio no existe, o la rutina asignada no existe
        S-->>So: 404 NOT_FOUND "Socio no encontrado" / "Rutina asignada no encontrada"
    else la rutina asignada no está activa o no es del socio
        S-->>So: 400 VALIDATION_ERROR
    else válido
        S-->>So: 201 { sesion, ejercicios, ultimasVeces, sugerencias, records }
        Note over S: transacción: pasa a ABANDONADA (con horaFin) toda sesión EN_CURSO previa<br/>y crea la nueva EN_CURSO en el primer ejercicio (serieActual = 1)
    end
```

---

## 6. Registrar serie

Fuente: `src/app/api/sesiones/[id]/series/route.ts`, `src/domains/sesion/sesion-de-entrenamiento.ts`
(`registrarSerie`).

```mermaid
sequenceDiagram
    actor So as Socio
    participant S as Sistema

    So->>S: POST /api/sesiones/{id}/series { ejercicioId, carga, repeticiones, rir?, tipo?, drops? }
    alt rol distinto de SOCIO/ADMINISTRADOR, o la sesión es de otro socio
        S-->>So: 401 UNAUTHORIZED / 403 FORBIDDEN
    else faltan ejercicioId/carga/repeticiones, o rir/tipo inválidos
        S-->>So: 400 VALIDATION_REQUIRED / VALIDATION_ERROR
    else drops inválidos (más de 5, sin carga/repeticiones, o en un calentamiento)
        S-->>So: 400 VALIDATION_ERROR
    else tipo = DROP_SET enviado como serie propia
        S-->>So: 400 VALIDATION_ERROR "El drop set se agrega a una serie, no se registra solo"
    else la sesión no existe
        S-->>So: 404 NOT_FOUND
    else la sesión no está EN_CURSO, no tiene ejercicio en curso,<br/>o el ejercicio no es el actual
        S-->>So: 400 VALIDATION_ERROR
    else otro registro concurrente ya avanzó la sesión (guarda optimista)
        S-->>So: 400 VALIDATION_ERROR "La sesión fue modificada por un registro concurrente"
    else válido
        S-->>So: 201 { registro, sesion, drops }
        Note over S: transacción: crea RegistroDeProgreso y avanza serieActual/ejercicioActualId.<br/>El calentamiento se guarda con numeroSerie null y NO mueve la sesión.<br/>Los drop sets cuelgan de la serie. Al completar un ejercicio recalcula la asignación
    end
```

---

## 7. Finalizar sesión

Fuente: `src/app/api/sesiones/[id]/route.ts`, `src/domains/sesion/sesion-de-entrenamiento.ts`
(`finalizarSesion`).

```mermaid
sequenceDiagram
    actor So as Socio
    participant S as Sistema

    So->>S: PUT /api/sesiones/{id}
    alt rol distinto de SOCIO/ADMINISTRADOR, o la sesión es de otro socio
        S-->>So: 401 UNAUTHORIZED / 403 FORBIDDEN
    else la sesión no existe
        S-->>So: 404 NOT_FOUND
    else la sesión ya no está EN_CURSO
        S-->>So: 200 { sesion } (idempotente: no cambia nada)
    else en curso
        S-->>So: 200 { sesion }
        Note over S: setea horaFin y estado COMPLETADA (si serieActual quedó null)<br/>o INCOMPLETA. En la misma transacción completa sus ejecuciones EN_CURSO
    end
```

---

## 8. Sugerencia y decisión de asignación dinámica

Fuente: `src/app/api/asignaciones/sugerencia/route.ts`,
`src/app/api/asignaciones/decidir/route.ts`, `src/api/asignaciones.ts`,
`src/domains/asignacion/orquestacion.ts`.

> **Importante**: la fila `RESERVADA` **no la crea** el `GET` ni el `ACEPTAR`. La crea el cálculo
> (`calcularYReservar`), que se dispara en el check-in y en los eventos de sesión
> (`src/domains/asignacion/orquestacion.ts:101` y `:339`). El comentario del código es explícito:
> "ACEPTAR no escribe" (`orquestacion.ts:242`).

```mermaid
sequenceDiagram
    actor So as Socio
    participant S as Sistema

    So->>S: GET /api/asignaciones/sugerencia
    alt rol distinto de SOCIO/ADMINISTRADOR/INSTRUCTOR
        S-->>So: 401 UNAUTHORIZED / 403 FORBIDDEN
    else un SOCIO manda socioId
        S-->>So: 403 FORBIDDEN
    else el staff no manda socioId
        S-->>So: 400 VALIDATION_ERROR "socioId es obligatorio"
    else el socio no existe
        S-->>So: 404 NOT_FOUND "Socio no encontrado"
    else sin rutina activa
        S-->>So: 200 { socioId, sugerencia: null, siguienteEnOrden, calculadoEn }
    else con reserva vigente
        S-->>So: 200 { socioId, sugerencia, siguienteEnOrden, calculadoEn }
    end

    So->>S: POST /api/asignaciones/decidir { accion: ACEPTAR o ESPERAR }
    alt accion ausente o fuera del dominio
        S-->>So: 400 VALIDATION_ERROR
    else rol distinto de SOCIO
        S-->>So: 403 FORBIDDEN
    else el socio no existe
        S-->>So: 404 NOT_FOUND
    else no hay sugerencia (nunca existió)
        S-->>So: 404 SIN_SUGERENCIA
    else la sugerencia venció o ya se decidió
        S-->>So: 409 SIN_SUGERENCIA_VIGENTE
    else el motor falla o supera el timeout
        S-->>So: 500 SERVER_ERROR
    else ACEPTAR (la reserva ya existía)
        S-->>So: 200 { accion: "ACEPTAR", sugerencia, siguienteEnOrden }
    else ESPERAR
        S-->>So: 200 { accion: "ESPERAR", sugerencia: null, siguienteEnOrden }
        Note over S: cancela la reserva vigente (update guardado por estado y venceEn)
    end
```

---

## 9. Registrar cierre de caja

Fuente: `src/app/api/cierres/route.ts`, `src/api/cierres.ts`, `src/domains/cierre/cierre-de-caja.ts`.

```mermaid
sequenceDiagram
    actor R as Recepcionista
    participant S as Sistema

    R->>S: POST /api/cierres { desde?, hasta? }
    alt rol distinto de ADMINISTRADOR/RECEPCIONISTA
        S-->>R: 401 UNAUTHORIZED / 403 FORBIDDEN
    else JSON inválido o fecha no parseable
        S-->>R: 400 VALIDATION_ERROR "El rango de fechas es inválido"
    else el usuario no tiene Empleado asociado
        S-->>R: 400 VALIDATION_ERROR "El usuario no tiene un empleado asociado"
    else ya existe un cierre creado dentro del rango pedido
        S-->>R: 409 CASH_CLOSE_CONFLICT
    else otro cierre concurrente tomó los mismos pagos (P2034 o conteo distinto)
        S-->>R: 409 CASH_CLOSE_CONFLICT
    else válido
        S-->>R: 201 { id, totalRecaudado, totalEfectivo, totalTransferencia, totalTarjeta, cantidadOperaciones, pagos }
        Note over S: transacción Serializable: toma los Pago CONFIRMADO sin cierre con fechaPago ≤ hasta,<br/>crea CierreDeCaja con los totales y les asigna cierreDeCajaId. Audita ALTA (best-effort)
    end
```

> Sin `desde`/`hasta`, el rango por defecto es desde el inicio del día del gimnasio hasta "ahora"
> (`rangoPorDefecto` en `src/api/cierres.ts`). El cierre **no** acota inferiormente los pagos
> (`fechaPago ≤ hasta`): recoge también pagos viejos que quedaron sin cierre (CC-4).

---

## Cobertura y límites

| Caso de uso pedido | Diagrama | ¿Existe en el código? |
|---|---|---|
| Iniciar sesión | 1 | Sí |
| Registrar pago | 2 | Sí |
| Check-in por DNI y PIN | 3 | Sí |
| Asignar rutina | 4 | Sí |
| Iniciar sesión de entrenamiento | 5 | Sí |
| Registrar serie | 6 | Sí |
| Finalizar sesión | 7 | Sí |
| Sugerencia y decisión de asignación | 8 | Sí |
| Registrar cierre de caja | 9 | Sí |
| Notificaciones al socio | — | **NO IMPLEMENTADO**: no hay endpoint ni modelo |
| Recuperación de contraseña | — | **NO IMPLEMENTADO**: no hay flujo ni tabla |
