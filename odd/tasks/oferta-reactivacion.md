# Oferta de reactivación y panel de parámetros

**Estado**: cerrado (código); P-40 abierto (confirmar valores con el negocio)
**Rama**: `dev`
**Plan**: D-54 (`openspec/decisions.md`) · **Specs**: `openspec/specs/oferta-reactivacion/spec.md`, `openspec/specs/configuracion-sistema/spec.md`
**TDD**: activo — `strict_tdd: true` en `openspec/config.yaml`, runner jest (`npm test`)

## Objetivo

Cerrar la funcionalidad de la oferta de reactivación: lo que ya está hecho (T-043a, T-045a) son la
base pura. Falta la migración, el panel de parámetros y el cobro.

## Por qué

Un socio que dejó de venir y tiene la cuota vencida necesita un incentivo para volver. La regla es
determinística y se deriva de los datos (D-54 decisión 1): no hay proceso programado. Todo el
diseño ya está aprobado y especificado; lo que falta es código.

## Alcance

- **Entra**: migración de schema, `GET`/`PUT /api/configuracion`, pantalla `/configuracion`, cobro
  con oferta y vista previa, avisos en las tres pantallas.
- **No entra**: avisos por email o WhatsApp, anulación de pagos (P-39), reportes de descuentos,
  alcance configurable de la oferta (D-54, "Fuera de alcance").

## Restricciones

1. `npm test` sigue verde y sin Docker; `npx tsc --noEmit` sin errores.
2. La oferta **apagada por defecto**: el despliegue no cambia ningún precio.
3. El recepcionista **no puede** fijar, quitar ni cambiar el descuento: el cliente no envía ningún
   campo de descuento.
4. La configuración se lee **solo** por `src/lib/configuracion.ts` (guardián de T-043a).
5. Orden fijo de D-54: T-045b → T-043b → T-043c → T-045c → T-045d.

## Checklist

- [x] **T1** · T-045b: migración — `ConfiguracionDelSistema.ofertaReactivacionActiva` /
      `diasSinAsistirParaOferta` / `enfriamientoOfertaDias`, `Pago.montoLista` / `Pago.descuentoPct`
      — aplicada contra Supabase con `prisma migrate deploy`; cliente regenerado; `npm test` 166/2131 verde
- [x] **T2** · T-043b: `GET` y `PUT /api/configuracion` solo Administrador, con validación de rangos
      y auditoría de valor anterior/nuevo en `RegistroDeAuditoria`
      — rangos puros en `src/domains/configuracion/`; la escritura vive en `src/lib/configuracion.ts` para
      no romper el guardián de T-043a; `npm test` 168/2162 verde
- [x] **T3** · T-043c: pantalla `/configuracion` agrupada y validada
      — grupos Acceso/Cuotas/Aforo/Oferta, rangos reusados de `CAMPOS_CONFIGURACION`, diff antes de
      enviar, `notify` al guardar; link en el nav de Admin; `npm test` 170/2176 verde
- [x] **T4** · T-045c: `registrarPago` aplica la oferta dentro de la transacción `Serializable`;
      vista previa en `GET /api/socios?dni=`; `montoEsperado` en `POST /api/pagos` → `409 AMOUNT_CHANGED`
      — consulta de elegibilidad separada del módulo puro (`oferta-reactivacion-consulta.ts`); con la
      oferta apagada el cobro queda idéntico; `npm test` 171/2193 verde
- [x] **T5** · T-045d: avisos en la pantalla de pagos, la card de Home_Interno y Home_Socio
      — la card de pagos muestra lista/porcentaje/final y el form manda `montoEsperado` (con refresco de
      la búsqueda ante `409 AMOUNT_CHANGED`); aviso propio en Home_Socio; la card de inactivos suma una
      línea con cuántos son elegibles, con **una sola** consulta extra en bulk; `/puerta` no se tocó;
      `npm test` 173/2211 verde
- [x] **T6** · Docs: avances en D-54, `PROJECT-STATUS.md` y `openspec/sdd-tasks-tdd.md`; P-40 cerrado
      cuando se confirmen los valores con el negocio
      — D-54 documenta T-045b…T-045d y T-043b/c; las 7 tareas quedan ✅ en `sdd-tasks-tdd.md`. **P-40
      sigue abierto**: los valores (30 días, 180 de enfriamiento, tope de 50 %) los tiene que confirmar
      el negocio

## Criterios de aceptación

1. Con la oferta apagada, el cobro es **idéntico** al de hoy y `montoLista`/`descuentoPct` quedan nulos.
2. Un socio elegible paga el monto descontado, y el `Pago` guarda `montoLista` y `descuentoPct`.
3. Instructor, Recepcionista y Socio reciben `403` en `/api/configuracion`; sin sesión, `401`.
4. Ningún camino de lectura de la configuración queda fuera del lector único (el guardián lo prueba).
5. `npx tsc --noEmit` y `npm test` en verde.

## Verificación

- `npx tsc --noEmit`
- `npm test`
- `npx prisma migrate status` (la base queda al día)

## Progreso

- **T-045a y T-043a**: ya hechos y revisados (commits `bd7e95b`…`8bcccf5`, revisión nativa
  `review-d52846a6fd139dae` aprobada y quemada).
