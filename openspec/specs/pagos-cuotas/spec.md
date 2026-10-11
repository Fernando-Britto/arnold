# Pagos y Cuotas Specification

## Purpose

Definir cuánto y cuándo paga un socio, y cómo se deduce de sus pagos si hoy puede entrar al gimnasio. Esta spec es la fuente de verdad de los
**estados de pago** (`AL_DIA`, `PENDIENTE`, `VENCIDA`, `SIN_CUOTA`); `member-access-check` los consume para decidir el check-in.

Alcance de esta versión: **reglas de cálculo** (`src/domains/pago/cuota.ts`, T-031). El registro del pago (API), las pantallas y el cierre de
caja son tareas siguientes (ver *Fuera de alcance*).

## Modelo

- Una cuota cubre un **tramo** `fechaInicio → fechaVencimiento`. El tramo siempre termina en el último instante (23:59:59.999, hora argentina) de un
  mes calendario.
- El **período** (`YYYY-MM`) no se guarda: se deduce de `fechaVencimiento` en hora argentina (UTC-3, sin horario de verano).
- Cada mes se paga **del 1 al día límite** (por defecto 10). `Cuota.fechaVencimiento` sigue significando "hasta cuándo está cubierto el socio", igual
  que antes: Home_Interno (alertas de vencimiento) y Home_Socio (tarjeta de membresía) no cambian.
- El estado de pago **se calcula al consultar**; no hay proceso programado que lo escriba.

Configuración (`ConfiguracionDelSistema`):

| Campo | Por defecto | Significado |
|---|---|---|
| `diaLimitePago` | 10 | Último día del mes para pagar sin estar vencido |
| `diaCorteAltaTardia` | 20 | Último día del mes (inclusive) en que un alta paga prorrateo |
| `periodoGracia` | 0 | Días extra que se suman al día límite (RN-02) |

## Requirements

### Requirement: Estado de pago del socio

El sistema **MUST** calcular el estado de pago con el último período cubierto, la fecha de hoy y la configuración.

#### Scenario: Mes actual cubierto

- GIVEN el último período cubierto es el mes actual o uno posterior (pagó por adelantado)
- WHEN se calcula el estado
- THEN es `AL_DIA`, hasta el último instante del mes

#### Scenario: Mes nuevo sin pagar, dentro del plazo

- GIVEN el último período cubierto es el mes anterior y hoy es día 1 al `diaLimitePago` (+ gracia) inclusive
- WHEN se calcula el estado
- THEN es `PENDIENTE` y el acceso se permite con aviso ("Cuota a pagar hasta el día N")

#### Scenario: Plazo vencido

- GIVEN el último período cubierto es el mes anterior y hoy pasó el `diaLimitePago` (+ gracia)
- WHEN se calcula el estado
- THEN es `VENCIDA` y el acceso requiere autorización (override manual)

#### Scenario: Más de un mes sin cobertura

- GIVEN el último período cubierto es anterior al mes pasado
- WHEN se calcula el estado
- THEN es `VENCIDA`, aunque sea el día 1

#### Scenario: Nunca pagó

- GIVEN el socio no tiene ninguna cuota
- WHEN se calcula el estado
- THEN es `SIN_CUOTA` (se trata como `VENCIDA` para el acceso)

### Requirement: Alta con prorrateo hasta el día de corte

El sistema **MUST** cobrar al alta solo los días que quedan del mes si el alta es hasta el `diaCorteAltaTardia` inclusive.

#### Scenario: Alta antes del corte

- GIVEN precio $30.000 y un alta el 16/11 (noviembre tiene 30 días)
- WHEN se calcula el pago
- THEN cobra 15/30 del precio = $15.000 (se cuenta el día del alta) y cubre hasta el 30/11
- AND el mes siguiente se paga del 1 al 10

#### Scenario: Alta el día 1

- GIVEN un alta el día 1
- WHEN se calcula el pago
- THEN cobra la cuota completa (30/30)

### Requirement: Alta después del corte cobra cuota completa por dos períodos

El sistema **MUST** cobrar una cuota completa que cubra lo que queda del mes y el mes siguiente si el alta es después del `diaCorteAltaTardia`.

#### Scenario: Alta el 30

- GIVEN precio $30.000 y un alta el 30/10
- WHEN se calcula el pago
- THEN cobra $30.000, cubre del 30/10 al 30/11
- AND el socio vuelve a pagar del 1 al 10/12

### Requirement: Renovación

El sistema **MUST** cobrar la renovación como el período siguiente al último cubierto, completo y sin recargo ni descuento, ya sea en término, tarde o por adelantado.

#### Scenario: Renovación en término o tarde

- GIVEN el último período cubierto es octubre y hoy es 5/11 (o 27/11)
- WHEN se calcula el pago
- THEN cobra noviembre completo

#### Scenario: Pago adelantado

- GIVEN el último período cubierto es noviembre y hoy es 25/11
- WHEN se calcula el pago
- THEN cobra diciembre, y se puede encadenar (el siguiente pago sería enero)

### Requirement: Reingreso sin deuda retroactiva

El sistema **MUST** tratar como alta a un socio que no tiene cobertura ni en el mes anterior ni en el actual, sin cobrar los meses que faltó.

#### Scenario: Vuelve después de una pausa

- GIVEN el último período cubierto es agosto y hoy es 10/11
- WHEN se calcula el pago
- THEN aplica las reglas de alta: prorrateo (21/30) porque 10 ≤ 20

## Reglas de cálculo

- Todas las fechas se interpretan en hora argentina; el cambio de mes usa esa hora, no UTC.
- Los montos se redondean al centavo (aritmética en centavos enteros).
- El día de corte es inclusivo; el día límite de pago es inclusivo hasta las 23:59:59.999. Si `diaLimitePago + periodoGracia` no entra en el mes, el
  límite es el último día del mes (no se pasa al mes siguiente).
- Entradas inválidas (precio negativo o no numérico, día de corte fuera de 1–31, período mal formado) lanzan `RangeError`.

## Data Scenarios

| Entrada | Salida |
|---|---|
| $30.000, alta 01/11 | ALTA_PRORRATEO, $30.000, cubre hasta 30/11 |
| $30.000, alta 16/11 | ALTA_PRORRATEO, $15.000, cubre hasta 30/11 |
| $30.000, alta 20/11 (corte 20) | ALTA_PRORRATEO, $11.000, cubre hasta 30/11 |
| $30.000, alta 30/10 | ALTA_COMPLETA, $30.000, cubre 30/10 al 30/11 |
| $30.000, alta 28/12 | ALTA_COMPLETA, $30.000, cubre hasta 31/01 del año siguiente |
| $30.000, alta 30/12, corte 31 | ALTA_PRORRATEO, $1.935,48 (2/31) |
| Cubierto hasta octubre, hoy 05/11 | PENDIENTE |
| Cubierto hasta octubre, hoy 11/11 | VENCIDA |
| Cubierto hasta octubre, hoy 14/11, gracia 3 | VENCIDA (a las 00:00; el 13/11 sigue PENDIENTE) |
| Cubierto hasta septiembre, hoy 05/11 | VENCIDA |

## Fuera de alcance (tareas siguientes)

- **Registrar el pago**: `POST /api/pagos` transaccional (crear `Pago` + `Cuota`, `membresiaId`, auditoría), y anulación de pagos.
- **Pantallas**: "Registrar Pago" (Home_Interno), "Mis pagos" (socio) y comprobante.
- **Cierre de caja**.
- **Check-in**: conectar `estadoCuotaSocio` con `member-access-check`.
- Pagos parciales (un pago cubre una cuota entera) y `descuentoReactivacion` para el reingreso.
