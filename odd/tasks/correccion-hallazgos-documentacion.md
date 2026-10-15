# Corrección de los hallazgos de la documentación

**Estado**: cerrado (2026-10-15) — 34 hallazgos corregidos; quedan P-11 (diferido por D-51) y P-39 (necesita decisión del negocio)
**Rama**: `dev`
**Origen**: la pasada de documentación del 2026-10-15 (vault `../arnold-vault`). Los hallazgos están en
`Hallazgos/` con evidencia `archivo:línea`.
**TDD**: activo — `strict_tdd: true`, runner jest (`npm test`).

## Objetivo

Cerrar los 34 hallazgos abiertos que dejó la documentación. Cada uno tiene su nota en el vault; al
cerrarlo se actualiza la nota (`estado: cerrado`) y el [[Validaciones/00 - Mapa de módulos|Mapa]].

## Orden y agrupación

### Grupo 1 — Seguridad y permisos
| Hallazgo | Qué se hace |
|---|---|
| `N` matriz↔handlers | Alinear la matriz al handler donde no hay decisión (quitar los permisos fantasma del Instructor) y agregar el **test de consistencia** que el hallazgo `H` pidió y nunca se escribió. |
| `T` rol del JWT | El chequeo fino de `access-override` pasa a leer el rol **vigente** de la base. |
| `W` rotación no atómica | Rotar el refresh token dentro de una transacción. |
| `U` sin rate limit | Extender el límite por IP a `logout` y `refresh`. |
| `AC-10/11/12` dispositivos | Poder revocar el token, backfill del `tokenPrefix` y pantalla de gestión. |
| `H10` contraseña temporal | Generar con `crypto` en vez de `Math.random`. |

### Grupo 2 — Datos y dinero
| Hallazgo | Qué se hace |
|---|---|
| `CC-4` pago fuera de todo cierre | Definir la semántica y que el cierre incluya los pagos pendientes. |
| `PG-8` mensaje de `P2034` | Traducirlo en el dominio del pago, no con el mensaje del cierre. |
| `H13` alta de cliente | Aplicar `estadoCuenta` al persistir. |
| `NF-13` `objetivoPrincipal: null` | Rechazarlo en la validación. |
| `NF-14`, `N8` no se puede vaciar una descripción | Contrato de limpieza (`null` explícito). |
| `CFG-1` oferta sin descuento | Coherencia entre el default y el rango. |
| `CFG-2` PUT vacío | Que no mute sin auditar. |

### Grupo 3 — Menores y bordes
`H11` (P2003), `H12` (tildes), `NF-15` (auditoría de asignación), `SE-6` (404), `AC-9` (DNI del check-in),
`N9` (precio redondeado), `NEW-8` (historial de progreso), `CFG-3`/`V` (comentarios obsoletos),
`H-7`/`H-8` (orden y ID en Ejercicios), código muerto (pagos/membresías), `ARQ-1`/`ARQ-2`/`ARQ-3`.

### Grupo 4 — Proceso
`PRO-1` (gate automático).

### Fuera de alcance
- `P-11` — diferido a propósito por D-51.
- `P-39` — anular un pago: necesita tres respuestas del negocio antes de escribir código (ver su nota).

## Restricciones

1. `npm test` y `npx tsc --noEmit` en verde en cada paso; `npm run test:integration` cuando toque base.
2. Cada arreglo lleva su test: el proyecto no acepta una corrección sin prueba (Strict TDD).
3. La oferta sigue **apagada por defecto**: ningún cambio puede alterar el cobro con la oferta apagada.
4. ≤400 LOC por entrega, commits convencionales con `(P-xx, D-xx)`.

## Verificación

- `npx tsc --noEmit` — limpio
- `npm test` — 178 suites / 2294 tests
- `npm run test:integration` — 18 tests contra Postgres real
- `npm run build` — compila

## Resultado

Seis commits: `bfb01d9` (RBAC), `f7f3eea` (auth y dispositivos), `d429479` (datos y dinero),
`55bd42e` (borde y comentarios), `da21087` (arquitectura + CI), `df99121` (dispositivos y progreso).
