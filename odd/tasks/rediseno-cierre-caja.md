# Rediseño de Cierre de Caja

## Objetivo

Rehacer `/cierres` a ancho completo: un panel de resumen del turno con jerarquía clara, confirmación
explícita antes de cerrar y el historial como tabla paginada con detalle por fila. Sin tocar las
reglas de cierre (`cerrarCaja`, guardas de conflicto, totales por método).

## Problema

La pantalla actual mete resumen e historial en dos bloques `max-w-lg`, sin diálogo de confirmación
(el botón cierra directo) y con tarjetas individuales de historial sin detalle ni paginación. Un
error del historial se traga en silencio (`catch → []`).

## Alcance

- `GET /api/cierres` pasa a responder `{ items, total }` con `limit`/`offset` validados (default 10,
  1..50). `?preview=1` no cambia.
- `listarCierres` acepta `{ limit, offset }` y se agrega `contarCierres()`.
- Pantalla nueva: panel "Cierre del turno actual" (fecha, total grande, operaciones pendientes,
  desglose Efectivo/Transferencia/Tarjeta/Total), botón "Confirmar cierre" y `ConfirmDialog` con el
  resumen antes de ejecutar. Historial como tabla (Fecha, Total, Efectivo, Transferencia, Tarjeta,
  Operaciones) con fila seleccionable y `TableDetailRow`, paginación server-side de 10.
- `ConfirmDialog` gana un slot `children` opcional para el resumen (retrocompatible).
- Tests de dominio/API/ruta/página/diálogo.

## Fuera de alcance

- Esquema, `cerrarCaja`, `calcularTotales`, guardas `CASH_CLOSE_CONFLICT`, POST y auditoría.
- Otras pantallas; el sidebar; agregar/eliminar/modificar cierres.
- Mostrar el nombre del responsable: no viene en el listado actual y no se agrega join.

## Decisiones técnicas

- **Cierre con 0 operaciones:** la regla de dominio lo permite (crea un cierre en $0), pero la UI
  muestra "No hay operaciones pendientes en este turno." y deshabilita "Confirmar cierre". No se
  cambia la API ni el dominio: sólo se evita invitar a un cierre vacío que después bloquea el turno
  por la guarda de rango.
- **Detalle:** `pagos` ya viene incluido en el listado; se muestra fecha/hora, método y monto de cada
  operación. Si el cierre no tuvo pagos, se informa. No se inventan datos ni se agrega endpoint nuevo.
- **Paginación:** server-side real (`take/skip/count`), 10 por página. Tras cerrar, el historial se
  remonta con `key` para volver a la página 0 (el cierre nuevo es el más reciente).
- **Fechas:** helper local `formatFechaCierre(iso, conHora?)` con `GYM_TIME_ZONE`; no se toca
  `src/utils/formatting.ts` para no chocar con la rama de pagos que agrega `formatFechaCorta`.
- **No tocar `src/components/ui/table.tsx`:** se usa `TableRow onClick/disclosure` tal cual (la rama
  de pagos le agrega teclado; evitar conflicto).
- Importes con `formatMoney` existente (es-AR, sin centavos) y columnas numéricas alineadas a la
  derecha con `tabular-nums`.

## Tareas

- [x] T1 · `src/domains/cierre/cierre-de-caja.ts`: `listarCierres({ limit?, offset? })` (default 20/0)
      y `contarCierres()`. Actualizar `cierre-de-caja.test.ts`.
- [x] T2 · `src/api/cierres.ts`: `PaginaDeCierres`, `PagoDeCierreDTO`, `pagos` en el DTO,
      `handleListarCierres({ limit, offset })` → `{ items, total }`, `fetchCierres(params?)`.
      Actualizar `cierres.test.ts` y, si hace falta, `auth-headers.test.ts` (sin params la URL sigue
      siendo `/api/cierres`).
- [x] T3 · `src/app/api/cierres/route.ts`: parsear `limit`/`offset` (default 10/0, 1..50, ≥0) con
      error 400 `VALIDATION_ERROR`; devolver la página. `preview=1` intacto. Tests de ruta.
- [x] T4 · `src/components/ui/confirm-dialog.tsx`: prop `children?: React.ReactNode` entre mensaje y
      botones. Test de que se renderiza.
- [x] T5 · `src/components/cierre/resumen-turno.tsx`: panel presentacional + estados + botón.
- [x] T6 · `src/components/cierre/historial-cierres.tsx`: fetch paginado, tabla, detalle, estados,
      paginación.
- [x] T7 · `src/app/cierres/page.tsx`: guardas de sesión/rol, fetch de preview, diálogo y
      orquestación del cierre; header visible y sin `max-w-lg`.
- [x] T8 · Tests de página (reescritura) y verificación: jest de las suites afectadas, `tsc`, `eslint`.

## Criterios de aceptación

- Panel de resumen a ancho completo, total con la mayor jerarquía y desglose alineado a la derecha.
- El cierre pide confirmación con total, desglose y cantidad; doble clic no duplica el POST.
- Turno sin operaciones: mensaje informativo y acción deshabilitada.
- Historial en tabla, orden descendente, filas con hover y detalle al seleccionar; sin acciones de
  modificación/eliminación.
- Paginación de 10 con búsqueda estable al cambiar de página.
- Estados de carga/error/vacío cubiertos, con reintento donde corresponde.
- `cerrarCaja`, totales por método y guardas existentes sin cambios.

## Checks

- `npx jest src/domains/cierre src/api/cierres.test.ts src/app/api/cierres src/app/cierres src/components/ui/confirm-dialog.test.tsx`
- `npx tsc --noEmit`
- `npx eslint src/domains/cierre src/api/cierres.ts src/app/api/cierres src/app/cierres src/components/cierre src/components/ui/confirm-dialog.tsx`

## Progreso

- Verificación: `npx jest src/domains/cierre src/api/cierres.test.ts src/app/api/cierres src/app/cierres src/components/ui/confirm-dialog.test.tsx src/api/auth-headers.test.ts`
  → 6 suites / 79 tests OK. `npx eslint` de los archivos tocados → OK.
- `npx tsc --noEmit` falla solo en `tests/factories/usuario.ts` (`debeCambiarPassword`), archivo no tocado por
  esta rama: la otra sesión tiene `prisma/schema.prisma` modificado y regeneró el cliente Prisma compartido.
  Con ese fixture completado temporalmente, `tsc` sale 0; se restauró sin cambios.
- Smoke contra la base real: `contarCierres()` = 2, `listarCierres({limit:10,offset:0})` devuelve las filas
  con sus `pagos` y orden descendente.
- Pendiente: smoke visual en navegador y probar el POST real desde el diálogo.
