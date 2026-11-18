# Rediseño de Registrar Pago

## Objetivo

Reemplazar la búsqueda por DNI de `/pagos` por un buscador por nombre con debounce, una grilla
seleccionable con paginación del lado del servidor y el formulario de pago bajo el cliente elegido,
sin cambiar las reglas de negocio del cobro.

## Problema

La pantalla actual (`src/components/pago/pago-form.tsx`) pide un DNI exacto en una tarjeta angosta y,
si acierta, muestra todo junto. Recepción cobra todo el día: identificar al socio por nombre debe ser
un solo gesto y el flujo tiene que aprovechar el ancho de escritorio.

## Alcance

- Backend de lectura: búsqueda de socios por nombre/apellido (`Usuario.nombre`, único campo de nombre
  del modelo; NO existe `apellido` y no se agrega), insensible a mayúsculas y tildes, con `limit`/`offset`
  y total para paginar. Más `GET /api/socios/[id]` para traer la vista previa de cobro ya existente.
- Frontend: buscador con lupa/limpiar, debounce 300 ms, guarda contra respuestas fuera de orden,
  grilla con fila seleccionable (ratón y teclado), estados vacío/cargando/error/sin resultados,
  paginación server-side, panel del cliente seleccionado y formulario de pago reutilizado.
- Tests unitarios de la API, del buscador y del flujo de pago.

## Fuera de alcance

- Esquema de base de datos, reglas de `registrarPago`/`cuota`, montos, ofertas y anulación.
- Otras pantallas (`/clientes`, `/home-interno`, acceso, rutinas): `fetchSocioPorDni` queda intacto.
- Columnas de acciones, filtros avanzados, modales.

## Decisiones técnicas

- Búsqueda SQL cruda con `unaccent(...) ILIKE unaccent(...)` (extensión ya instalada) porque Prisma no
  hace match sin tildes. Un patrón por token (`juan perez` → dos `AND`), todo parametrizado con
  `Prisma.sql`. `COUNT(*) OVER()::int` para evitar `BigInt` en JSON. Orden `u.nombre ASC, s.id ASC`.
- `shortcut: unaccent no usa índice; si la tabla de socios crece a decenas de miles, agregar índice
  de expresión/trigram.` (comentario en el repositorio de búsqueda).
- `GET /api/socios` acepta `?q=&limit=&offset=` además del `?dni=` existente. Sin parámetros: 400.
  Roles del endpoint nuevo de búsqueda: ADMINISTRADOR y RECEPCIONISTA (el listado expone estado de
  cuota). `GET /api/socios/[id]`: mismos roles.
- Paginación: `limit` 1..50 (default 10), `offset` ≥ 0 (default 0); página 0-based en el cliente,
  límite 10.
- Estados reales: sin membresía asignada → `Sin membresía`; con membresía, `EstadoCuotaSocio`
  (`AL_DIA`→Al día, `PENDIENTE`→Pendiente, `VENCIDA`→Vencida, `SIN_CUOTA`→Sin cuota). Nunca sólo color.
- Selección de fila: `TableRow` gana `tabIndex`/`onKeyDown` opcionales y anillo de foco; sin botones
  por fila. Enter y Espacio seleccionan.
- Tras cobrar: se refresca el socio por id y se recarga la página actual de la grilla; la selección
  se mantiene. La guarda `PAYMENT_ALREADY_REGISTERED` del servidor sigue evitando el doble cobro.
- `SocioBusqueda` gana `fechaVencimiento: string | null` (dato ya calculado en el handler) para la
  tarjeta del cliente; actualizar los fixtures que comparan el objeto completo.

## Tareas

- [x] T1 · `src/api/socios.ts`: tipos `SocioResumen`/`BusquedaSociosResultado`, `handleBuscarSociosPorNombre`
      (SQL crudo + `estadoCuotaSocio` + config), `handleBuscarSocioPorId` reutilizando el armado del
      `SocioBusqueda`, `fechaVencimiento` en `SocioBusqueda`, y fetch de cliente
      `fetchSociosPorNombre` / `fetchSocioPorId`.
- [x] T2 · `src/app/api/socios/route.ts`: rama `?q=` con validación de `limit`/`offset` y handler
      testeable `handleBuscarSociosRequest`. `src/app/api/socios/[id]/route.ts`: GET por id.
- [x] T3 · `src/components/ui/table.tsx`: `TableRow` con foco de teclado opcional (sin cambiar usos
      existentes).
- [x] T4 · `src/components/pago/cliente-busqueda.tsx`: buscador + grilla + paginación + estados;
      props `seleccionadoId`, `onSeleccionar`, `refrescarToken`.
- [x] T5 · `src/components/pago/pago-form.tsx`: orquestación (selección, panel, método, cobro,
      refrescos, "Cambiar cliente"). `socio-pago-card.tsx`: título "Cliente seleccionado",
      vencimiento y acción `onCambiarCliente`.
- [x] T6 · `src/app/pagos/page.tsx`: título visible "Registrar Pago" + descripción, contenido full width.
- [x] T7 · Tests: `src/api/socios.test.ts` (búsqueda y por id), `src/app/api/socios/route.test.ts`
      (`?q=`, límites, roles), `src/components/pago/cliente-busqueda.test.tsx`,
      `src/components/pago/pago-form.test.tsx`, `socio-pago-card.test.tsx`.
- [x] T8 · Verificación: jest de las suites afectadas + `npx tsc --noEmit` + `npx eslint` de los
      archivos tocados.

## Criterios de aceptación

- No queda búsqueda por DNI en `/pagos`; un solo input busca por nombre/apellido con debounce.
- La grilla muestra Cliente, DNI, Membresía, Vencimiento y Estado, sin columna de acciones.
- Clic o Enter/Espacio sobre una fila la selecciona y muestra el panel + formulario, sin navegar.
- "Cambiar cliente" oculta panel/formulario y conserva buscador y resultados.
- Cargando, sin resultados y error con reintento están cubiertos; la búsqueda se conserva al paginar.
- Se mantienen montos, oferta, `montoEsperado`, validaciones y guardas de `registrarPago`.
- Seleccionar un cliente no dispara ningún POST.

## Checks

- `npx jest src/api/socios.test.ts src/app/api/socios/route.test.ts src/components/pago`
- `npx tsc --noEmit`
- `npx eslint src/api/socios.ts src/app/api/socios src/components/pago src/components/ui/table.tsx src/app/pagos`

## Progreso

- Commits: `f09172a` (API búsqueda por nombre + por id) y `186717c` (pantalla y tests).
- Verificación: `npx jest src/api/socios.test.ts src/app/api/socios src/components/pago` → 10 suites / 88 tests OK;
  `src/app/pagos/page.test.tsx` + `src/components/ui/table.test.tsx` → 2 suites / 20 tests OK;
  `npx tsc --noEmit` y `npx eslint` de los archivos tocados → OK.
- Smoke contra la base real: `SOFIA` → Sofía Socia, `santiago socio` → Santiago Socio, sin resultados y consulta
  vacía sin query. `COUNT(*) OVER()::int` serializa como número.
- Pendiente: smoke visual en navegador (no ejecutado) y prueba manual del POST de cobro desde la pantalla.
