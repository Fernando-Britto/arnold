# Acceso biométrico por huella (T-041)

## Objetivo

Que un socio abra la puerta apoyando el dedo: el sensor devuelve el ID de la plantilla, Arnold
verifica que el socio exista y tenga la cuota al día, registra el intento y responde autorizado o
denegado. El ESP32 libera el electroimán sólo si Arnold autoriza.

## Problema y por qué

Hoy el acceso es DNI + PIN (T-035/T-036). Falta el método biométrico. El diseño ya está decidido en
el repo: **D-43 propuesta 5** y **D-47 decisión 5** — el lector compara por su cuenta y manda sólo el
ID del socio. **Arnold no guarda plantillas biométricas** (Ley 25.326, P-30); las plantillas viven en
la flash del sensor. Arnold guarda únicamente la relación `socio ↔ huellaId`.

## Alcance

**Dentro**
- `Socio.huellaId` (Int?, único) + fecha de consentimiento informado.
- Modelo `SolicitudDeHuella`: cola de enrolamientos/bajas que el ESP32 consulta por polling.
- Endpoints de dispositivo (sin sesión de usuario) bajo `/api/dispositivo/...`.
- Endpoint de administración para registrar/borrar la huella de un socio.
- Panel en Clientes: registrar huella, ver estado, eliminar.
- Actualización de las rutas del `arnold_acceso_esp32.ino`.

**Fuera**
- Molinete físico, reportes de accesos, panel de auditoría (no pedidos).
- Guardar plantillas en Arnold (prohibido por diseño).

## Restricciones (descubiertas en el código)

1. **Namespace obligatorio.** `src/lib/access-decision.ts` exime de sesión sólo `DEVICE_PATHS =
   ["/puerta", "/api/dispositivo"]`. Los endpoints del `.ino` (`/api/huellas/*`, `/api/acceso/verificar`)
   darían 401. Van bajo `/api/dispositivo/huellas/*` y `/api/dispositivo/acceso/verificar`.
   Se actualiza el `.ino` para reflejarlo. `/api/acceso` NO se exime: lo usa el kiosco con sesión.
2. **Auth de dispositivo reutilizada.** `autenticarDispositivo` acepta `Authorization: Bearer <token>`
   (token de la tabla `Dispositivo`, tipo `PUERTA`). No se agrega auth nueva ni variables de entorno.
3. **Sin `DELETE` para Recepcionista.** La matriz da `['GET','POST','PUT']` en `/api/socios`. La baja
   va por `POST` con `accion: "borrar"`.
4. **Sin migración de enums.** `MetodoIdentificacion.HUELLA` ya existe y la auditoría reutiliza
   `AccionAcceso.CHECK_IN` (el método queda en `Asistencia.metodo`). No hace falta tocar enums.
5. **La migración la aplica Fernando** (D-41). Se genera el SQL, no se aplica.

## Contrato

### Schema (`prisma/schema.prisma`)
- `Socio`: `huellaId Int? @unique`, `huellaConsentimientoEn DateTime?`, relación `solicitudesHuella`.
- `enum AccionHuella { ENROLAR, BORRAR }`
- `enum EstadoSolicitudHuella { PENDIENTE, CONFIRMADA, FALLIDA }`
- `model SolicitudDeHuella { id, socio, socioId, accion, huellaId Int, estado @default(PENDIENTE),
  motivo String?, duplicadoDe Int?, createdAt, resueltaEn DateTime? }` + índices `[estado, createdAt]`, `[socioId]`.

### Dominio puro — `src/domains/acceso/huella.ts`
- `HUELLA_ID_MIN = 1`, `HUELLA_ID_MAX = 1000`, `HUELLA_CONFIANZA_MINIMA = 50`.
- `elegirHuellaIdLibre(idsUsados: number[]): number | null` — primer hueco libre entre 1 y 1000.
  Devuelve `null` si el sensor está lleno.

### Servicio — `src/api/acceso.ts` (refactor)
Extraer de `handleCheckIn` la parte posterior a la identidad a
`evaluarYRegistrarAcceso(prisma, socio, { ip, userAgent, metodo, ahora })`: calcula `estadoCuota`
(`estadoCuotaSocio`), anti-passback, llama `decidirAcceso`, escribe `Asistencia` (con `metodo`) +
`AuditoriaAcceso` (`CHECK_IN`) en una transacción, y devuelve `CheckInResultado`.
`handleCheckIn` (DNI+PIN, `metodo: "DNI_PIN"`) y `handleAccesoPorHuella` (`metodo: "HUELLA"`) lo usan.
Comportamiento de DNI+PIN **sin cambios** (los tests existentes deben seguir pasando).

### Servicio — `src/api/huellas.ts` (nuevo)
- `solicitarEnrolamiento(socioId, { consentimiento })` — exige membresía/consentimiento; asigna
  `huellaId` libre (considerando IDs reservados por solicitudes PENDIENTES); setea
  `huellaConsentimientoEn`; crea `SolicitudDeHuella ENROLAR PENDIENTE`; cancela/reemplaza una PENDIENTE
  previa del mismo socio. `@throws VALIDATION_ERROR` si no hay consentimiento o IDs (`CAPACITY`).
- `solicitarBaja(socioId)` — crea `SolicitudDeHuella BORRAR PENDIENTE` con el `huellaId` actual.
  `@throws VALIDATION_ERROR` si el socio no tiene huella.
- `estadoHuella(socioId)` — `{ huellaId, consentimientoEn, solicitud: {...}|null }` (la más reciente).
- `tomarSolicitudPendiente()` — la PENDIENTE más antigua → `{ accion: "enrolar"|"borrar", huellaId }` o `{ accion: null }`.
- `confirmarSolicitud(input)` — `{ huellaId, accion, ok, motivo, duplicadoDe? }`: marca la solicitud
  CONFIRMADA/FALLIDA; si `enrolar`+`ok` → `Socio.huellaId = huellaId`; si `borrar`+`ok` → `huellaId = null`.
- `handleAccesoPorHuella({ huellaId, confianza, ip, userAgent, ahora })` — busca socio por `huellaId`
  (null → audita DENY y devuelve denegado); si `confianza < HUELLA_CONFIANZA_MINIMA` → denegado sin
  evaluar; si no, `evaluarYRegistrarAcceso` con `metodo: "HUELLA"`.

### Rutas de dispositivo (sin sesión; `autenticarDispositivo`)
- `GET  /api/dispositivo/huellas/pendiente` → `{ accion: "enrolar"|"borrar"|null, huellaId? }`
- `POST /api/dispositivo/huellas/confirmar` → body del `.ino` → `200 { ok: true }`
- `POST /api/dispositivo/acceso/verificar` → `{ huellaId, confianza }` → `{ autorizado, nombre?, motivo? }`

### Ruta de administración (sesión; ADMINISTRADOR + RECEPCIONISTA, como `/pin`)
- `POST /api/socios/[id]/huella` body `{ accion: "enrolar"|"borrar", consentimiento?: boolean }`
- `GET  /api/socios/[id]/huella` → estado
- Auditar con `registrarOperacion` (MODIFICACION, `detalles: { socioId, campo: "huella" }`), nunca el ID.

### UI — `src/components/cliente-crud/panel-huella.tsx` (nuevo)
Panel del cliente seleccionado en `/clientes`:
- Sin huella → checkbox "El socio firmó el consentimiento informado" + botón "Registrar huella" (deshabilitado sin consentimiento).
- Con huella → "Huella registrada (ID n)" + botón "Eliminar huella".
- Con solicitud PENDIENTE → "Esperando al sensor…" con polling de `GET /api/socios/[id]/huella` (~2 s, con tope de tiempo).
- Resultado visible: registrada / falló (motivo legible).
Avisos vía `useNotifications`; errores vía `handleApiError`.

### Firmware
`arnold_acceso_esp32.ino`: cambiar las 3 rutas a `/api/dispositivo/...`; aclarar en el encabezado que
`DEVICE_TOKEN` es el token de un `Dispositivo` tipo PUERTA provisionado en `/dispositivos`. No cambia
la forma de los cuerpos/respuestas.

## Tareas

- [x] **A1** — Schema + migración (SQL generado, **no aplicada**) + `prisma generate`. → `0d623d6`
- [x] **A2** — `src/domains/acceso/huella.ts` + tests (elección de ID libre, lleno). → `0d623d6`
- [x] **A3** — Refactor `src/api/acceso.ts` (`evaluarYRegistrarAcceso`) sin romper los tests de DNI+PIN. → `0d623d6`
- [x] **A4** — `src/api/huellas.ts` + tests (enrolar/baja/confirmar/acceso, con Prisma simulado). → `0d623d6`
- [x] **A5** — Rutas de dispositivo + tests. → `0d623d6`
- [x] **A6** — `POST`/`GET /api/socios/[id]/huella` + tests. → `0d623d6`
- [x] **A7** — `panel-huella.tsx` + `src/api/huellas-client.ts` + integración en `/clientes` + test. → `4dcf471`
- [x] **A8** — Actualizar `arnold_acceso_esp32.ino` (rutas bajo `/api/dispositivo/...`). → `4dcf471`
- [x] **A9** — Nota en `openspec/decisions.md` (**D-56**, D-55 ya existía) y `PROJECT-STATUS.md`. → `4dcf471`

## Criterios de aceptación

1. Un socio con huella enrolada y cuota al día → `POST /api/dispositivo/acceso/verificar` responde
   `autorizado: true` y crea `Asistencia` con `metodo: HUELLA` + `AuditoriaAcceso` ALLOW.
2. Socio con cuota vencida, cuenta inactiva/bloqueada o anti-passback → `autorizado: false` con motivo,
   y el intento queda auditado.
3. `huellaId` inexistente → `autorizado: false`, auditado, sin excepción.
4. Enrolamiento: `POST /api/socios/[id]/huella` deja una solicitud PENDIENTE con un ID libre; al
   confirmar OK, `Socio.huellaId` queda seteado; con `duplicado`/`timeout` la solicitud queda FALLIDA y
   el socio sin huella.
5. Baja: confirmar OK limpia `Socio.huellaId`.
6. Sin sesión de usuario, los endpoints `/api/dispositivo/huellas/*` y `/api/dispositivo/acceso/verificar`
   responden 401 sin token de dispositivo y 200 con uno válido.
7. No se persiste ninguna plantilla biométrica en Arnold.

## Verificación

- `npx prisma generate`
- `npm test`
- `npx tsc --noEmit`
- `npx eslint` sobre los archivos tocados (sin errores nuevos)

## Progreso

- 2026-10-16 — Documento creado. Explorado el repo; diseño alineado a D-43/D-47.
- 2026-10-16 — Backend commiteado (`0d623d6`): schema, migración generada (no aplicada),
  dominio, servicio, rutas de dispositivo y de administración. 86 tests de huella/acceso en verde.
- 2026-10-16 — UI, firmware y docs commiteados (`4dcf471`). Suite completa: 189 suites / 2394 tests.
  `tsc --noEmit` y `eslint` sobre lo tocado, sin errores.

### Qué falta (fuera de esta implementación)

- **Aplicar la migración** `20261016120000_add_huella_socio` (la aplica Fernando, D-41).
- **Probar con el hardware real**: sensor óptico, relé y electroimán. Nada se probó con el ESP32.
- **Probar contra una base real**: el flujo completo de enrolamiento y acceso (base remota, no tocada).

### Riesgos conocidos

- La reserva de `huellaId` no es transaccional (lee usados + crea la solicitud por separado): dos
  enrolamientos simultáneos podrían compartir un ID PENDIENTE. El `@unique` de `Socio.huellaId` lo
  atrapa en la confirmación. `shortcut:` con un solo sensor y disparo manual desde el panel alcanza;
  si se agregan múltiples lectores o enrolamiento masivo, envolver la reserva en una transacción.
- El `.ino` usa `setInsecure()` en HTTPS: para producción, certificado del dominio.
