# Home_Interno Dashboard Specification

## Purpose

Real-time operational overview for staff roles (Administrador, Instructor, Recepcionista) rendering five dashboard zones: Row_Acciones, Row_Hoy, Row_Operacion, Row_Gestion, Col_Actividad.

## Requirements

### Requirement: Staff-Only Dashboard Access

The system **MUST** render Home_Interno only for authenticated users with role Administrador, Instructor, or Recepcionista (RN-06). Full role-gating mechanics are defined in `openspec/specs/rbac-middleware/spec.md` — this requirement covers routing only.

#### Scenario: Staff role loads dashboard

- GIVEN an authenticated user with role Instructor
- WHEN the user navigates to `/home` (or equivalent internal route)
- THEN the system renders Home_Interno with all five zones

#### Scenario: Socio role redirected away

- GIVEN an authenticated user with role Socio
- WHEN the user navigates to the internal dashboard route
- THEN the system redirects to Home_Socio (`/home/socio` or equivalent)

### Requirement: Row_Acciones Quick Actions

The system **MUST** render exactly 4 quick-action buttons with the literal labels: "Nuevo Socio", "Registrar Pago", "Asignar Rutina", "Control Acceso". This zone displays no visible zone title.

#### Scenario: Buttons render with literal labels

- GIVEN Home_Interno has loaded
- WHEN Row_Acciones renders
- THEN it shows 4 equal-width buttons labeled exactly "Nuevo Socio", "Registrar Pago", "Asignar Rutina", "Control Acceso"
- AND no zone title text appears above them

#### Scenario: Nuevo Socio navigates to Clientes create form

- GIVEN Row_Acciones is visible
- WHEN the user clicks "Nuevo Socio"
- THEN the system navigates to the Clientes CRUD screen with the create form pre-focused (empty FormPanel)

#### Scenario: Control Acceso navigates to manual check-in flow

- GIVEN Row_Acciones is visible
- WHEN the user clicks "Control Acceso"
- THEN the system navigates to the manual access flow described in `openspec/specs/manual-override-authorization/spec.md`

### Requirement: Row_Hoy Real-Time Aggregation

The system **MUST** aggregate and display three columns: Alertas (860px), Aforo (438px), Caja (438px), refreshed from live data — not cached snapshots older than the page session.

#### Scenario: Alertas lists vencimiento within grace period window

- GIVEN a Socio's Cuota `fechaVencimiento` is within 24h, or already past due but inside `ConfiguracionDelSistema.periodoGracia` (RN-02)
- WHEN Row_Hoy renders Alertas
- THEN the system includes a "Vencimiento" item for that Socio with icon, text, and timestamp

#### Scenario: Aforo gauge reflects live occupancy

- GIVEN N Asistencia records exist for today with no matching checkout beyond `ConfiguracionDelSistema.ventanaAforoMinutos`
- WHEN Row_Hoy renders Aforo
- THEN the system shows `N / capacidadMaxima` and a percentage, using `capacidadMaxima` from ConfiguracionDelSistema

#### Scenario: Caja totals sum today's confirmed payments

- GIVEN Pago records exist for today with `estado = Confirmado`, split by `metodoPago`
- WHEN Row_Hoy renders Caja
- THEN the system shows Efectivo total, Transferencia total, and a combined Total
- AND "Cierre de Caja" button opens the close-out flow (creates CierreDeCaja on confirm)

### Requirement: Row_Operacion Status Cards

The system **MUST** render 3 cards: "Estado de equipos", "Personal en turno", "Socios inactivos", each with a header, a main metric, and a footer status, and each clickable to a filtered detail view.

#### Scenario: Estado de equipos excludes out-of-service machines from availability %

- GIVEN Máquina records with `estado` in Disponible, Ocupada, Fuera de Servicio, Inactiva (RN-05)
- WHEN Row_Operacion computes the equipment metric
- THEN "Fuera de Servicio" and "Inactiva" machines are excluded from the numerator of the availability percentage
- AND the footer shows the count of machines currently in maintenance ("Fuera de Servicio")

#### Scenario: Socios inactivos uses configured inactivity threshold

- GIVEN `ConfiguracionDelSistema.diasInactividad` defines the inactivity window
- WHEN Row_Operacion computes "Socios inactivos"
- THEN it counts Socios whose last Asistencia is older than `diasInactividad` days
- AND the footer text reflects that threshold (e.g., "Sin visita > {diasInactividad} días")

#### Scenario: Card click navigates to detail list

- GIVEN any Row_Operacion card is visible
- WHEN the user clicks the card
- THEN the system navigates to the corresponding filtered list (machine list, staff roster, or inactive members list)

### Requirement: Row_Gestion Management Counters

The system **MUST** render 4 counter cards — Rutinas, Ejercicios, Clientes, Membresías — each showing a live `COUNT(*)` and navigating to the matching CRUD list on click.

#### Scenario: Counter reflects live entity count

- GIVEN the Rutina table has R rows
- WHEN Row_Gestion renders the Rutinas card
- THEN it shows R as the metric (24px bold)

#### Scenario: Counter card navigates to CRUD list

- GIVEN Row_Gestion is visible
- WHEN the user clicks the Clientes card
- THEN the system navigates to the Clientes CRUD ListPanel

### Requirement: Col_Actividad Recent Activity Feed

The system **MUST** show a scrollable timeline of the last 24h of actions in the format "Nombre · Acción · Hace X", with the zone title "Últimos movimientos". **Only the following event types populate this feed**:
- Pagos registrados (cobros)
- Altas de nuevos socios
- Bajas/cancelaciones de socios
- Anulación de pago
- Asignación de nueva rutina

Gym check-ins and ingreso events are explicitly excluded as they are too frequent and offer no additional signal beyond the Aforo card.

#### Scenario: Activity item renders with correct format for payment

- GIVEN a Pago was registered for member "Ana López" at 10:15
- WHEN Col_Actividad renders
- THEN it shows an item reading "Ana López · Pago de membresía Pro · Hace 15 min"

#### Scenario: Activity item renders for new member signup

- GIVEN a new Socio "Carlos Mendez" was created at 14:45
- WHEN Col_Actividad renders
- THEN it shows "Carlos Mendez · Alta de nuevo socio · Hace 2 horas"

#### Scenario: Gym check-ins and ingreso events excluded

- GIVEN multiple Asistencia check-ins occurred today
- WHEN Col_Actividad renders
- THEN no check-in or ingreso events appear in the feed, only the specified payment/member event types

#### Scenario: Empty activity state

- GIVEN no qualifying actions occurred in the last 24h
- WHEN Col_Actividad renders
- THEN it shows an empty-state message instead of an empty list

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-02 (grace period) | Alertas vencimiento calculation |
| RN-03 (manual override) | Control Acceso button target (xref: manual-override-authorization spec) |
| RN-05 (equipment availability) | Estado de equipos card |
| RN-06 (role-based access) | Dashboard route gating (xref: rbac-middleware spec) |

## Acceptance Criteria

- **AC-001**: Row_Acciones renders exactly 4 buttons with literal labels "Nuevo Socio", "Registrar Pago", "Asignar Rutina", "Control Acceso", no zone title.
- **AC-002**: Row_Hoy Alertas includes vencimiento items only within the configured grace period window (RN-02).
- **AC-003**: Aforo percentage = `(active Asistencia count / capacidadMaxima) * 100`, rounded to nearest integer.
- **AC-004**: Caja totals equal the sum of `Pago.monto` for today where `estado = Confirmado`, grouped by `metodoPago`.
- **AC-005**: Estado de equipos excludes Fuera de Servicio and Inactiva machines from the numerator, per RN-05.
- **AC-006**: Row_Gestion counters equal `COUNT(*)` of their respective tables at render time (no cached stale count beyond page session).
- **AC-007**: Col_Actividad shows at most the most recent 24h of activity, oldest-first or newest-first consistently, with an explicit empty state.
- **AC-008**: Socio-role users are redirected away from Home_Interno before any zone renders.

## Edge Cases

- **Zero alerts**: Alertas column shows an empty-state message, not a blank area.
- **Aforo over 100%**: If Asistencia count exceeds capacidadMaxima (e.g., due to manual overrides), the gauge caps display at 100% but the raw count text still shows the true number.
- **No staff on shift**: Personal en turno shows "0" with footer "Sin personal registrado", not a crash or blank card.
- **Negative or missing ConfiguracionDelSistema values**: If `capacidadMaxima`, `periodoGracia`, or `diasInactividad` are null/unset, the system MUST fall back to documented defaults (periodoGracia = 0) and MUST NOT divide by zero for Aforo.
- **Concurrent Cierre de Caja**: If two staff attempt "Cierre de Caja" simultaneously, only one CierreDeCaja record is created; the second attempt is rejected with a conflict message.

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| capacidadMaxima=100, active Asistencia=87 | Aforo shows "87 / 100 miembros", gauge at 87% |
| 2 Máquina with estado=Fuera de Servicio, 20 total | Estado de equipos shows 90% ("18/20"), footer "2 en mantenimiento" |
| diasInactividad=15, 42 Socios with lastAsistencia > 15 days | Socios inactivos card shows "42", footer "Sin visita > 15 días" |
| Pago today: 3 Efectivo ($50 each), 2 Transferencia ($100 each) | Caja shows Efectivo $150.00, Transferencia $200.00, Total $350.00 |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| ConfiguracionDelSistema missing | CONFIG_NOT_FOUND | Configuración del sistema no encontrada | Apply documented defaults, log warning |
| Aggregation query timeout | AGGREGATION_TIMEOUT | No se pudo cargar el resumen operativo | Show cached last-known values with staleness indicator |
| Cierre de Caja conflict | CASH_CLOSE_CONFLICT | Ya existe un cierre de caja para hoy | Refresh Caja totals, disable button |
