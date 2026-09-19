# Home_Socio Portal Specification

## Purpose

Personal workout tracking, routine progress, and membership status for the Socio role, structured as three rows: Fila1 (Progress + Aforo), Fila2 (Tarjeta_Rutina + Tarjeta_Detalle), Fila3 (Racha Semanal + Membresía).

## Requirements

### Requirement: Socio-Only Portal Access

The system **MUST** render Home_Socio only for users with role Socio (RN-06). Full role-gating mechanics are defined in `openspec/specs/rbac-middleware/spec.md`.

#### Scenario: Socio role loads portal

- GIVEN an authenticated user with role Socio
- WHEN the user navigates to the member home route
- THEN the system renders Home_Socio with all three rows

#### Scenario: Staff role redirected away

- GIVEN an authenticated user with role Administrador, Instructor, or Recepcionista
- WHEN the user navigates to the member home route
- THEN the system redirects to Home_Interno

### Requirement: ProgresoSection Summary

The system **MUST** show the Socio's last workout summary, a strength progression chart over the last 4 weeks, and the last 3–5 exercises with best weight/reps, sourced from RegistroDeProgreso.

#### Scenario: Progress renders from RegistroDeProgreso history

- GIVEN the Socio has RegistroDeProgreso entries in the last 4 weeks
- WHEN ProgresoSection renders
- THEN it shows the most recent SesionDeEntrenamiento's routine name and completion %, plus a chart of carga over time

#### Scenario: No training history yet

- GIVEN the Socio has zero RegistroDeProgreso entries
- WHEN ProgresoSection renders
- THEN it shows an empty state instead of an empty chart, and "Registrar sesión" remains available

### Requirement: AforoCard Live Occupancy

The system **MUST** show the same live occupancy gauge logic as Home_Interno's Row_Hoy Aforo, plus a best-time-to-train recommendation text.

#### Scenario: Aforo reflects live count

- GIVEN N active Asistencia records exist for today
- WHEN AforoCard renders
- THEN it shows "N% / capacidadMaxima miembros" using the same calculation as Home_Interno

### Requirement: Tarjeta_Rutina Active Routine Display (RN-04)

The system **MUST** render the Socio's single active Rutina (RN-04: a Socio can only have one active routine at a time) with its exercise sequence, a progress indicator ("Ejercicio N de M"), and session control buttons.

#### Scenario: Active routine renders exercise sequence

- GIVEN the Socio has exactly one Rutina with an active assignment
- WHEN Tarjeta_Rutina renders
- THEN it shows the routine name, thumbnail cards for each EjercicioEnRutina in order, and highlights the current exercise

#### Scenario: No active routine assigned

- GIVEN the Socio has zero active Rutina assignments
- WHEN Tarjeta_Rutina renders
- THEN it shows an empty state (e.g., "Sin rutina asignada") instead of the exercise sequence, and Tarjeta_Detalle also shows an empty state

#### Scenario: Session control buttons reflect session state

- GIVEN a SesionDeEntrenamiento has not started
- WHEN Tarjeta_Rutina renders
- THEN it shows "Iniciar sesión" only
- GIVEN a SesionDeEntrenamiento is in progress
- WHEN Tarjeta_Rutina renders
- THEN it shows "Siguiente ejercicio" and "Finalizar sesión" instead of "Iniciar sesión"

### Requirement: Tarjeta_Detalle Current Exercise Display

The system **MUST** render the current exercise's full detail structure exactly as specified: uppercase label "EJERCICIO ACTUAL", icon circle, exercise name, muscle group, a 3-column stats grid (Series×Reps, Descanso, Objetivo), description text, and a machine-availability footer.

#### Scenario: Tarjeta_Detalle renders full structure for current exercise

- GIVEN the current EjercicioEnRutina has `series=3`, `repeticiones=10`, `descanso=120` (seconds), and its Ejercicio has `nombre`, `grupoMuscular`, `descripcion`
- WHEN Tarjeta_Detalle renders
- THEN it shows label "EJERCICIO ACTUAL", the exercise name, muscle group, stats "3×10" / "2 min" / target weight, and the description text

#### Scenario: Machine footer reflects RN-05 availability

- GIVEN the exercise's associated Máquina has `estado = Ocupada`
- WHEN Tarjeta_Detalle renders the footer
- THEN it shows an availability message (e.g., "Libre en ~5 min") derived from machine status, excluding Fuera de Servicio/Inactiva machines from being reported as available (RN-05)

#### Scenario: Click exercise name opens detail modal

- GIVEN Tarjeta_Detalle is visible
- WHEN the user clicks the exercise name
- THEN the system opens a modal with full description, form variations, and machine alternatives

### Requirement: RachaSemanal Weekly Streak

The system **MUST** show a weekly streak counter, a 7-day (Mon–Sun) visual indicator of attendance, a goal-vs-actual comparison, and the last visit timestamp. Additionally, the system **MUST** display a summary widget of the last 4 weeks showing the total attendance count and a calendar-like grid of dots (one per week) representing attendance for each of those 4 weeks.

#### Scenario: Streak reflects this week's Asistencia records

- GIVEN the Socio has Asistencia records on Mon, Wed, Fri this week
- WHEN RachaSemanal renders
- THEN it shows "3 días esta semana" and fills Mon/Wed/Fri circles, leaving others empty

#### Scenario: Last 4 weeks summary renders attendance grid

- GIVEN the Socio has Asistencia records across the past 4 weeks
- WHEN RachaSemanal renders the "Últimas 4 semanas" widget
- THEN it displays the total number of attendances (e.g., "12 sesiones en 4 semanas") and a 4-row grid where each row represents one week, with filled dots for weeks containing at least one attendance and empty dots for weeks with none

### Requirement: MembresiCard Status Display

The system **MUST** show the Socio's current membership plan name, expiration countdown, renewal date, and a status badge, with a "Renovar ahora" action when expiring soon.

#### Scenario: Membership expiring within warning window

- GIVEN the Socio's Membresía has `fecha_vencimiento` within 7 days
- WHEN MembresiCard renders
- THEN the expiration text uses status-warning styling and "Renovar ahora" button is visible

#### Scenario: Membership in good standing

- GIVEN the Socio's Membresía is active with more than 7 days remaining
- WHEN MembresiCard renders
- THEN status badge shows "Al día" and "Renovar ahora" is not shown

## Business Rules Mapping

| Rule | Applies to |
|------|-----------|
| RN-04 (single active routine) | Tarjeta_Rutina / Tarjeta_Detalle data source |
| RN-05 (equipment availability) | Tarjeta_Detalle machine footer |
| RN-06 (role-based access) | Portal route gating (xref: rbac-middleware spec) |

## Acceptance Criteria

- **AC-001**: Home_Socio renders only for role Socio; all other roles are redirected before any row renders.
- **AC-002**: Tarjeta_Rutina sources exactly one active Rutina per Socio (RN-04); if the data layer ever returns more than one active assignment, the system MUST treat it as a data integrity error and surface the first by assignment date, logging the anomaly.
- **AC-003**: Tarjeta_Detalle's stats grid always shows Series×Reps and Descanso from the current EjercicioEnRutina; Objetivo (target weight) uses the highlighted brand-fill styling.
- **AC-004**: Tarjeta_Detalle's machine-availability footer never reports a Fuera de Servicio or Inactiva machine as "available" (RN-05).
- **AC-005**: AforoCard and Home_Interno's Aforo use the identical calculation (same capacidadMaxima and active Asistencia count).
- **AC-006**: RachaSemanal's 7-circle indicator maps to calendar Mon–Sun of the current week, not a rolling 7-day window.
- **AC-007**: MembresiCard shows "Renovar ahora" if and only if days remaining ≤ 7.

## Edge Cases

- **No active routine**: Tarjeta_Rutina and Tarjeta_Detalle both show empty states; "Registrar sesión" and session buttons are hidden.
- **No progress history**: ProgresoSection shows empty state; chart is not rendered with zero-length data.
- **Descanso displayed in seconds only in data, min:sec in UI**: `descanso=125` MUST render as "2:05" or "2 min" per the design's literal example, not raw seconds.
- **Membership expired (not just expiring)**: Status badge shows "Vencida" (not "Al día"), and "Renovar ahora" is shown regardless of the 7-day threshold.
- **Concurrent session state changes**: If "Finalizar sesión" is clicked while a stale exercise index is cached client-side, the system MUST re-fetch current exercise state before submitting, to avoid recording completion against the wrong exercise.

## Data Scenarios

| Input | Expected Output |
|-------|-----------------|
| EjercicioEnRutina: series=3, repeticiones=10, descanso=120 | Stats grid: "3×10", "2 min" |
| Máquina estado=Disponible for current exercise | Footer: no wait message, machine ready |
| Máquina estado=Ocupada, estimated free in 5 min | Footer: "Libre en ~5 min" |
| Membresía fecha_vencimiento in 15 days | "Vence en 15 días", badge "Al día" |
| Membresía fecha_vencimiento in 3 days | "Vence en 3 días" (status-warning), "Renovar ahora" visible |

## Error Handling

| Scenario | Code | Message | Recovery |
|----------|------|---------|----------|
| No active Rutina found | NO_ACTIVE_ROUTINE | Sin rutina asignada | Show empty state, allow browsing catalog (out of scope) |
| Multiple active Rutina found (RN-04 violation) | ROUTINE_INTEGRITY_ERROR | Se detectó más de una rutina activa | Use earliest assignment, log for admin review |
| Máquina lookup failure | MACHINE_STATUS_UNAVAILABLE | Estado de máquina no disponible | Hide footer wait message, show neutral "Consultar en recepción" |
