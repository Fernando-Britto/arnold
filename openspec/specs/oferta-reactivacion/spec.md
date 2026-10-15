# Oferta de Reactivación Specification

## Purpose

Ofrecer un descuento sobre el cobro de la cuota a un socio que **dejó de asistir** y **necesita pagar para volver**, con el porcentaje y el
tiempo de espera configurables por el Administrador (D-54). Complementa `pagos-cuotas` (cuánto y cuándo se paga) y `member-access-check`
(quién entra); no cambia ninguna de las dos.

Estado: **implementado** (T-045a a T-045d, D-54). Las funciones puras de elegibilidad y descuento, la migración, el cobro con la oferta aplicada dentro de la transacción, la vista previa y los avisos están en `dev`. La oferta **viene apagada por defecto**: hasta que se active desde `/configuracion`, el sistema cobra igual que siempre.

## Modelo

- La elegibilidad **se calcula al consultar**; no hay proceso programado ni columna que diga "este socio tiene una oferta". Es la misma idea de
  D-40 y D-46: el estado se deriva de los datos (`Cuota`, `Pago`, `Asistencia`).
- Es una **regla determinística**, no un modelo predictivo. Con los datos de un solo gimnasio un modelo no aportaría nada confiable.
- El descuento se aplica **en el servidor, al registrar el pago** (`registrarPago`). La pantalla solo muestra una vista previa.
- Un cambio en el panel rige de inmediato: no hay caché de la configuración más allá de cada pedido.

Configuración (`ConfiguracionDelSistema`, ver spec `configuracion-sistema`):

| Campo | Por defecto | Rango | Significado |
|---|---|---|---|
| `ofertaReactivacionActiva` | `false` | — | Interruptor. Apagada, el sistema cobra exactamente igual que hoy |
| `diasSinAsistirParaOferta` | 30 | 7–365 | Días sin asistir a partir de los cuales el socio puede recibir la oferta |
| `descuentoReactivacion` | 10 (valor del seed) | 1–50 (%) | Porcentaje que se descuenta del cobro |
| `enfriamientoOfertaDias` | 180 | 0–730 | Días que deben pasar desde la última oferta usada para poder recibir otra |

`diasInactividad` (la card "Socios inactivos" de Home_Interno, 15 por defecto) es un parámetro **distinto**: la card puede marcar inactivo a un
socio a los 15 días y la oferta salir a los 30.

## Requirements

### Requirement: Elegibilidad

Un socio **MUST** ser elegible si y solo si se cumplen **todas** estas condiciones al momento de consultar:

1. `ofertaReactivacionActiva` es `true` y `descuentoReactivacion` está entre 1 y 50.
2. La cuenta del socio es `AL_DIA` (`Socio.estadoCuota`, D-46) y tiene una membresía asignada.
3. Su estado de pago (`estadoCuotaSocio`) es `VENCIDA`. `PENDIENTE`, `AL_DIA` y `SIN_CUOTA` no son elegibles.
4. La **referencia de actividad** es anterior o igual a `hoy − diasSinAsistirParaOferta`. La referencia es la `fechaHora` de la última `Asistencia`
   con `estado = PERMITIDO`; si el socio nunca asistió, es `Socio.fechaAlta`.
5. No tiene un `Pago` `CONFIRMADO` con descuento aplicado y `fechaPago` posterior a `hoy − enfriamientoOfertaDias`. Con `enfriamientoOfertaDias = 0` no bloquea nunca.

Si un parámetro de la oferta no es un número válido (días negativos o que no son un número), **MUST** no ofrecerse: ante la duda se cobra de lista. La función informa
el motivo de cada rechazo (`OFERTA_APAGADA`, `CONFIGURACION_INVALIDA`, `CUENTA_NO_HABILITADA`, `SIN_MEMBRESIA`, `CUOTA_NO_VENCIDA`, `ACTIVIDAD_RECIENTE`, `EN_ENFRIAMIENTO`), siempre
la primera condición que falla en el orden de esta lista.

#### Scenario: Socio vencido que dejó de venir

- GIVEN la oferta está activa, el socio tiene cuota `VENCIDA`, su última asistencia `PERMITIDO` fue hace 31 días y nunca usó una oferta
- WHEN se evalúa la oferta
- THEN es elegible

#### Scenario: Socio que sigue viniendo

- GIVEN el socio tiene cuota `VENCIDA` pero su última asistencia `PERMITIDO` fue hace 5 días
- WHEN se evalúa la oferta
- THEN no es elegible

#### Scenario: Ingreso autorizado por excepción

- GIVEN el socio entró con `autorizadoExcepcionalmente = true` hace 10 días (con `estado = PERMITIDO`)
- WHEN se evalúa la oferta
- THEN esa asistencia **cuenta** como actividad: si vino, no se fue, y no necesita un incentivo para volver

#### Scenario: Intentos denegados

- GIVEN el socio tiene solo asistencias con `estado = DENEGADO` en los últimos 30 días
- WHEN se evalúa la oferta
- THEN esos intentos **no** cuentan como actividad

#### Scenario: Socio recién dado de alta

- GIVEN el socio nunca asistió y su `fechaAlta` es de hace 10 días
- WHEN se evalúa la oferta
- THEN no es elegible: la inactividad se mide desde el alta, para no marcar a los recién llegados

#### Scenario: Socio al día que no viene

- GIVEN el socio tiene cuota `AL_DIA` o `PENDIENTE` y hace 60 días que no asiste
- WHEN se evalúa la oferta
- THEN no es elegible: ya paga y no necesita descuento; dárselo reduciría ingresos

#### Scenario: Cuenta inactiva o bloqueada

- GIVEN `Socio.estadoCuota` es `INACTIVA` o `BLOQUEADA`
- WHEN se evalúa la oferta
- THEN no es elegible

#### Scenario: Enfriamiento

- GIVEN el socio usó una oferta hace 100 días y `enfriamientoOfertaDias` es 180
- WHEN se evalúa la oferta
- THEN no es elegible; en cuanto se cumple el plazo (180 días o más) vuelve a serlo. El límite es exacto: un pago con descuento bloquea solo si es **posterior** a `hoy − enfriamiento`

### Requirement: Cálculo del descuento

El descuento **MUST** aplicarse **una sola vez** sobre el `monto` que ya calcula `planDePago` (alta con prorrateo, alta completa o renovación, D-40),
sobre el **cobro completo** (si el plan cubre dos períodos, el descuento es sobre el total). El resultado se calcula en centavos enteros y se redondea
al centavo, igual que el prorrateo.

#### Scenario: Descuento sobre una renovación

- GIVEN el plan es `RENOVACION` por $30.000 y el descuento es 10 %
- WHEN se aplica la oferta
- THEN `montoLista = 30000`, `descuentoPct = 10` y se cobra $27.000

#### Scenario: Descuento sobre un reingreso con dos períodos

- GIVEN el plan es `ALTA_COMPLETA` por $30.000 (cubre dos períodos) y el descuento es 20 %
- WHEN se aplica la oferta
- THEN se cobra $24.000 por los dos períodos

#### Scenario: El tope no se puede superar

- GIVEN el valor guardado de `descuentoReactivacion` es 100 (fuera de rango)
- WHEN se evalúa la oferta
- THEN no se ofrece (condición 1 de la elegibilidad) y el cobro es el de lista

### Requirement: Aplicación al cobrar

`registrarPago` **MUST** evaluar la elegibilidad y aplicar el descuento **dentro de la misma transacción `Serializable`** que crea la `Cuota` y el
`Pago` (D-40, PG-4), para que dos cobros simultáneos no puedan usar la misma oferta dos veces.

- `Pago.monto` **MUST** seguir siendo lo efectivamente cobrado, así el cierre de caja no cambia.
- `Pago` **MUST** guardar `montoLista` y `descuentoPct` (nulables; nulos si no hubo oferta) para el comprobante y la auditoría.
- El cliente **MUST NOT** poder fijar, quitar ni cambiar el descuento: el recepcionista no ve ni envía ningún campo de descuento.

#### Scenario: Cobro con oferta

- GIVEN el socio es elegible
- WHEN se registra el pago
- THEN se crean `Cuota` y `Pago` con `monto` descontado, `montoLista` y `descuentoPct`, y el socio deja de ser elegible por el enfriamiento

#### Scenario: Oferta apagada

- GIVEN `ofertaReactivacionActiva` es `false`
- WHEN se registra cualquier pago
- THEN el cobro es idéntico al actual y `montoLista` y `descuentoPct` quedan nulos

### Requirement: Vista previa y monto esperado

`GET /api/socios?dni=` **MUST** devolver, cuando el socio es elegible, `oferta: { montoLista, descuentoPct, montoFinal }`, y `null` si no.
`POST /api/pagos` **MAY** recibir `montoEsperado` (el que vio el recepcionista). Si se envía y difiere del monto que calcula el servidor, **MUST**
responder `409 AMOUNT_CHANGED` con el monto vigente y no crear nada. Si no se envía, cobra el monto calculado (compatible con el comportamiento actual).

#### Scenario: La oferta venció entre la vista previa y el cobro

- GIVEN la pantalla mostró "−30 %: $30.000 → $21.000" y, antes de cobrar, el Administrador apagó la oferta
- WHEN el recepcionista confirma con `montoEsperado = 21000`
- THEN el servidor responde `409 AMOUNT_CHANGED` con 30.000 y la pantalla pide confirmar de nuevo

### Requirement: Dónde se ve

La oferta **MUST** mostrarse en la pantalla de pagos (vista previa), en la card de socios inactivos de Home_Interno y en un aviso de Home_Socio.
**MUST NOT** mostrarse en la pantalla de la puerta (`/puerta`), que no muestra más que el nombre y el estado (D-47).

## Fuera de alcance

- **Avisos por email o WhatsApp**: requieren elegir un canal y un planificador y revisar el consentimiento de los socios. Etapa posterior (notificaciones
  escalonadas, Fase 2).
- **Alcance configurable**: la v1 ofrece la oferta **solo a socios con cuota vencida**. "Todos los inactivos" podría ser un parámetro más adelante.
- **Anulación de pagos**: hoy no existe un flujo que ponga un `Pago` en `ANULADO` (P-39). Cuando exista habrá que definir qué pasa con la oferta y con la `Cuota`.
- **Refinar la regla** (por ejemplo, mirar la caída de frecuencia en vez de un corte fijo), una antigüedad mínima y reportes de descuentos otorgados.
