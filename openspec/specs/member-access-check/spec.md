# Member Access Check Specification

## Purpose

Verify that a member (Socio) has an active membership and valid quota payment before granting check-in access.

## Requirements

### Requirement: Membership Validation

The system **MUST** query the Membresía table and verify status before granting access.

#### Scenario: Active membership grants access

- GIVEN a Socio with Membresía where `status = Activa` and `fecha_vencimiento > today`
- WHEN Recepcionista calls GET `/api/socios/{socio_id}/check-in-status`
- THEN the system queries Membresía, checks expiration date
- AND returns `{ allowed: true, reason: "Membresía activa", warning: null }`

#### Scenario: Expired membership denies access

- GIVEN a Socio with Membresía where `fecha_vencimiento <= today` and grace_period = 0 days (RN-02)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects expiration, returns `{ allowed: false, reason: "Membresía vencida; requiere renovación" }`
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: DENY, motivo: "Expired membership" }`

#### Scenario: Grace period allows access with warning

- GIVEN a Socio with Membresía expired but within grace period (e.g., 3 days, configurable)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects grace period window, returns `{ allowed: true, reason: "En período de gracia", warning: "Grace period ends 2026-08-13" }`
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: ALLOW, motivo: "Grace period applied" }`

#### Scenario: Cancelled membership denies access

- GIVEN a Socio with Membresía where `status = Cancelada`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system returns `{ allowed: false, reason: "Membresía cancelada" }`
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)

### Requirement: Quota Payment Validation

> **Estados de pago**: los estados `Pagada`, `Pendiente` y `Vencida` de abajo se calculan según [`pagos-cuotas`](../pagos-cuotas/spec.md) (D-40):
> `AL_DIA` (≈ Pagada), `PENDIENTE` (del 1 al día límite, entra con aviso), `VENCIDA` (requiere autorización) y `SIN_CUOTA` (se trata como vencida).
> Si esta sección y `pagos-cuotas` se contradicen, vale `pagos-cuotas`.

The system **MUST** verify current month's quota payment status (RN-03) before granting access.

#### Scenario: Quota paid grants access

- GIVEN a Socio with active Membresía AND Cuota for current month `estado = Pagada`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system queries Cuota, finds payment status
- AND returns `{ allowed: true, reason: "Cuota pagada" }`

#### Scenario: Overdue quota denies access (requires override)

- GIVEN a Socio with active Membresía BUT Cuota `estado = Vencida` (overdue, due_date < today)
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system detects overdue payment, returns `{ allowed: false, reason: "Cuota vencida; requiere autorización" }`
- AND creates an Asistencia record with `estado = DENEGADO` (attempt history; consumers filter `PERMITIDO`)
- AND creates AuditoriaAcceso: `{ accion: CHECK_IN, resultado: DENY, motivo: "Overdue quota" }`

#### Scenario: Pending quota (due but not overdue yet) allows access

- GIVEN a Socio with Cuota `estado = Pendiente` and `fecha_vencimiento > today`
- WHEN GET `/api/socios/{socio_id}/check-in-status` is called
- THEN the system allows access with warning: `{ allowed: true, warning: "Quota due on 2026-08-15" }`

### Requirement: Membership + Quota Combination Logic

The system **MUST** check BOTH membership AND quota; both must be valid.

#### Scenario: Valid membership but overdue quota → DENY

- GIVEN Membresía is active but Cuota is vencida
- WHEN check-in status is queried
- THEN system returns `{ allowed: false, reason: "Cuota vencida; requiere autorización" }`

#### Scenario: Valid quota but expired membership (outside grace) → DENY

- GIVEN Cuota is pagada but Membresía is vencida (outside grace period)
- WHEN check-in status is queried
- THEN system returns `{ allowed: false, reason: "Membresía vencida" }`

#### Scenario: Both valid → ALLOW

- GIVEN both Membresía active and Cuota pagada
- WHEN check-in status is queried
- THEN system returns `{ allowed: true, reason: "Acceso permitido" }`
- AND creates Asistencia record with timestamp

### Requirement: Asistencia Record Creation

The system **MUST** create an Asistencia (attendance) record on every check-in whose **identity is
verified** (valid DNI + PIN), regardless of the business decision:

- **Allowed** check-in → `estado = PERMITIDO`.
- **Business denial** (membership/quota inactive, anti-passback, etc.) → `estado = DENEGADO`, keeping
  the attempt history. Consumers of the attendance history MUST filter `estado = PERMITIDO`.
- **Identity failure** (unknown DNI, missing/incorrect PIN) → **no** Asistencia; only AuditoriaAcceso.

`metodo` records how the identity was verified: `DNI_PIN` (reception or door keypad), `HUELLA`
(fingerprint sensor), or `MANUAL` (legacy records).

#### Scenario: Asistencia created on successful check-in

- GIVEN check-in allowed (membership + quota valid)
- WHEN GET `/api/socios/{socio_id}/check-in-status` returns allowed=true
- THEN the system creates Asistencia record: `{ socio_id, timestamp: now(), motivo: null }`
- AND returns success to Recepcionista UI

#### Scenario: Asistencia DENEGADO on business denial

- GIVEN a verified identity (DNI + PIN) whose membership/quota is invalid (or anti-passback applies)
- WHEN status is queried
- THEN the system creates an Asistencia record with `estado = DENEGADO` and `motivo = <the denial reason>`
- AND AuditoriaAcceso is logged with `resultado = DENY`

#### Scenario: No Asistencia on identity failure

- GIVEN an unknown DNI, a member without a PIN, or an incorrect PIN
- WHEN the check-in is attempted
- THEN the system does NOT create an Asistencia record (no verified identity)
- AND only AuditoriaAcceso is logged (with `resultado = DENY` and a generic reason)

### Requirement: Fingerprint Access

The system **MUST** resolve the Socio from the `huellaId` returned by the fingerprint sensor and apply
the **same business decision** as DNI + PIN: account state, calculated payment status, and anti-passback.
Only the identity step differs; the business rules do not.

The sensor compares the fingerprint locally and sends only the template ID. The system **MUST NOT**
store biometric templates (Ley 25.326): it keeps only the `Socio ↔ huellaId` relation and the informed
consent timestamp.

The fingerprint endpoint is `POST /api/dispositivo/acceso/verificar` with `{ huellaId, confianza }`,
authenticated with a `Dispositivo` token (no user session).

A `confianza` below `HUELLA_CONFIANZA_MINIMA` (50) **MUST** deny access without evaluating the quota.
An unknown `huellaId` **MUST** deny access and record an `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
**without** creating an `Asistencia`.

A verified identity **MUST** create an `Asistencia` with `metodo = HUELLA` and its `AuditoriaAcceso`.

#### Scenario: Enrolled member with valid quota is allowed

- GIVEN a Socio with an enrolled `huellaId`, an active account, and the current quota paid
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }` with a valid device token
- THEN the system returns `{ autorizado: true }`
- AND creates an `Asistencia` with `estado = PERMITIDO` and `metodo = HUELLA`
- AND creates `AuditoriaAcceso: { accion: CHECK_IN, resultado: ALLOW }`

#### Scenario: Business denial applies to fingerprint access

- GIVEN a Socio identified by `huellaId` whose account is inactive/blocked, whose quota is expired or missing, or who is inside the anti-passback window
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }`
- THEN the system returns `{ autorizado: false, motivo: <the denial reason> }`
- AND creates an `Asistencia` with `estado = DENEGADO` and `motivo = <the denial reason>`
- AND creates `AuditoriaAcceso: { accion: CHECK_IN, resultado: DENY, motivo: <the denial reason> }`

#### Scenario: Unknown fingerprint denies without Asistencia

- GIVEN a `huellaId` that does not belong to any Socio
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 80 }`
- THEN the system returns `{ autorizado: false, motivo: "Huella no reconocida" }`
- AND creates only `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
- AND does NOT create an `Asistencia`

#### Scenario: Low confidence denies without evaluating the quota

- GIVEN an enrolled `huellaId`
- WHEN `POST /api/dispositivo/acceso/verificar` receives `{ huellaId, confianza: 49 }`
- THEN the system returns `{ autorizado: false, motivo: "Confianza insuficiente" }`
- AND creates only `AuditoriaAcceso` (`CHECK_IN`/`DENY`)
- AND does NOT query the quota or create an `Asistencia`

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

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| Member not found | MEMBER_NOT_FOUND | Socio not found | Check ID |
| Expired membership | MEMBERSHIP_EXPIRED | Membresía vencida | Override or renew |
| Overdue quota | QUOTA_OVERDUE | Cuota vencida | Override or pay |
| Cancelled membership | MEMBERSHIP_CANCELLED | Membresía cancelada | Manual review |
| Database error | DB_ERROR | Unable to verify membership | Fallback to manual |

## Data Models

**Membresía** table:
```
id: uuid
socio_id: uuid (FK)
fecha_inicio: date
fecha_vencimiento: date
status: enum (Activa | Vencida | Cancelada)
created_at: timestamp
updated_at: timestamp
```

**Cuota** table:
```
id: uuid
socio_id: uuid (FK)
mes: int (1-12)
año: int
estado: enum (Pagada | Pendiente | Vencida)
fecha_vencimiento: date
monto: decimal
created_at: timestamp
updated_at: timestamp
```

**Asistencia** table:
```
id: uuid
socio_id: uuid (FK)
timestamp: timestamp
motivo: string (nullable)
created_at: timestamp
```

## Configuration

- **Grace Period** (RN-02): Configurable via env var `GRACE_PERIOD_DAYS` (default: 0)
- **Quota Due Date Logic** (RN-03): Due date = 1st of following month (e.g., June quota due 2026-07-01)

## Security Properties

- ✅ All checks logged to AuditoriaAcceso (both allowed and denied)
- ✅ Membership/quota queries use prepared statements (SQL injection safe)
- ✅ Timestamps use server time (cannot be spoofed client-side)
- ✅ No payment sensitive data exposed in responses
- ✅ Denial reasons generic (do not leak member financial status to unauthorized users)

## Known drift

This spec still describes endpoints and DTOs that **do not exist** in the implementation:
`GET /api/socios/{socio_id}/check-in-status` and the response DTOs `{ allowed, reason, warning }`
(with error codes such as `MEMBER_NOT_FOUND`, `MEMBERSHIP_EXPIRED`, `QUOTA_OVERDUE`).

The real contract is:

- `POST /api/acceso/check-in` — reception kiosk, user session.
- `POST /api/dispositivo/acceso` — door, `Dispositivo` token.
- `POST /api/dispositivo/acceso/verificar` — fingerprint, `Dispositivo` token.

The requirements above remain the normative description of the business rules; endpoint and DTO
details in the older scenarios are kept for history and should not be treated as the current API.
