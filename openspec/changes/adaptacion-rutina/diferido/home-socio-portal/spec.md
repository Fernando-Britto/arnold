# Delta for home-socio-portal

## Purpose

Extender la vista del socio para que vea, además de su rutina vigente, el **motivo de la última adaptación
aprobada** por ejercicio (D-139, decisión c.4). La tarjeta de rutina muestra una línea de motivo por ejercicio
adaptado, proveniente de la propuesta `APROBADA` más reciente.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `home-socio-portal` (modificada) |
| Change | `adaptacion-rutina` |
| Dependencias | `adaptacion-propuesta` (S2), `adaptacion-aprobacion` (S3), `adaptacion-motor` (motivo) |
| Numeración AC | `AC-TBD` (numeración sin reservar). No colisiona: el rango usado llega a AC-585 |

## MODIFIED Requirements

### Requirement: Tarjeta_Rutina Active Routine Display (RN-04)

The system **MUST** render the Socio's single active Rutina (RN-04: a Socio can only have one active routine at
a time) with its exercise sequence, a progress indicator ("Ejercicio N de M"), and session control buttons.
Además, por cada ejercicio que haya sido adaptado, la secuencia **MUST** mostrar una línea con el motivo de la
última adaptación aprobada para ese ejercicio.

#### Scenario: Active routine renders exercise sequence

- GIVEN the Socio has exactly one Rutina with an active assignment
- WHEN Tarjeta_Rutina renders
- THEN it shows the routine name, thumbnail cards for each EjercicioEnRutina in order, and highlights the current exercise

#### Scenario: Ejercicio adaptado muestra su motivo

- GIVEN un ejercicio cuya última propuesta aprobada subió la carga por repeticiones de sobra
- WHEN Tarjeta_Rutina renderiza la secuencia
- THEN la tarjeta de ese ejercicio muestra una línea con el motivo de esa aprobación

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

## ADDED Requirements

### Requirement: Motivo de la última adaptación aprobada

La vista del socio **MUST** mostrar el motivo de la **última propuesta `APROBADA`** por ejercicio adaptado. Si
no existe propuesta aprobada para un ejercicio, **MUST NOT** mostrarse ninguna línea. El motivo que se muestra
**MUST** ser el de la propuesta `APROBADA` más reciente; una `PENDIENTE` o `RECHAZADA` **MUST NOT** mostrarse.

#### Scenario: Se muestra el motivo de la última aprobación

- GIVEN un socio con una propuesta `APROBADA` reciente para el ejercicio "Press Banca"
- WHEN la vista del socio renderiza
- THEN muestra el motivo de esa aprobación junto al ejercicio

#### Scenario: Sin aprobación no hay línea

- GIVEN un socio sin ninguna propuesta `APROBADA`
- WHEN la vista del socio renderiza
- THEN no se muestra ninguna línea de motivo

#### Scenario: Solo ejercicios adaptados muestran línea

- GIVEN una rutina con un ejercicio adaptado y otro sin adaptación
- WHEN la vista renderiza
- THEN solo el ejercicio adaptado muestra la línea de motivo

#### Scenario: Pendiente o rechazada no se muestran

- GIVEN una propuesta `PENDIENTE` o `RECHAZADA` para un ejercicio, sin `APROBADA` posterior
- WHEN la vista renderiza
- THEN no se muestra ese motivo (no es una aprobación)

## Acceptance Criteria

- **AC-TBD**: Tarjeta_Rutina muestra, por ejercicio adaptado, una línea con el motivo de la última aprobación.
- **AC-TBD**: Sin propuesta aprobada para un ejercicio, no se muestra ninguna línea de motivo.
- **AC-TBD**: Solo los ejercicios con un cambio aprobado muestran la línea; los no adaptados no.
- **AC-TBD**: El motivo mostrado es el de la propuesta `APROBADA` más reciente; `PENDIENTE` y `RECHAZADA` no se muestran.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Tarjeta_Rutina Active Routine Display (RN-04) (modificado) | secuencia, motivo, sin rutina, controles | AC-TBD |
| Motivo de la última adaptación aprobada (nuevo) | aprobación, sin aprobación, solo adaptados, pendiente/rechazada | AC-TBD, AC-TBD, AC-TBD |

## Fuera de alcance

- Historial de fases o de cambios (queda para la capa macro).
- Exponer el motor o sus parámetros al socio.
- Cambiar el contrato `GET /api/home-socio` más allá de agregar el motivo por ejercicio.

## Preguntas abiertas para Fernando

1. **Formato de la línea de motivo.** ¿Texto corto idéntico al `motivo` del motor, o una redacción orientada al
   socio? Opciones: (a) el `motivo` tal cual lo emite el motor, (b) una frase amigable derivada del `tipo`
   (subir/mantener/descargar/cambiar), (c) ambos (motivo técnico corto + frase amigable).
2. **Dónde vive el dato en el payload.** ¿El motivo viaja en `GET /api/home-socio` dentro de cada ejercicio de
   la rutina, o en un campo separado? Opciones: (a) anidado en cada ejercicio, (b) un mapa `motivos: { ejercicioId: motivo }`.
