# 5) Casos de uso reales (Fase III · Diseño)

> **Fuente**: código de `arnold/` (pantallas, componentes, rutas y handlers). Cada afirmación lleva
> `archivo:línea`. **Fecha de extracción**: 2026-11-16.
> **Regla**: los textos entre comillas son **literales del código**. Si algo no existe, dice
> **NO IMPLEMENTADO**.
> **Mensajes**: en los 4xx de validación el texto que ve el usuario es el `message` del servidor
> (`src/utils/api-error.ts:33-41`). El cliente lo reemplaza en cuatro casos fijos: 401 → "Tu sesión
> venció. Iniciá sesión de nuevo."; 403 → "No tenés permiso para esta acción."; 429 → "Demasiados
> intentos. Esperá un momento y probá de nuevo."; 5xx → "No se pudo procesar la solicitud. Probá de
> nuevo más tarde." (`src/utils/api-error.ts:28-39`).

## Datos de prueba (seed)

Fuente: `prisma/seed-data.ts:17-19, 40-50, 185-190` y `prisma/seed.ts`.

| Dato | Valor |
|---|---|
| Contraseña de todos los usuarios | `Arnold2026!` (`DEFAULT_SEED_PASSWORD`, `:17`) |
| Dominio de email | `@arnold.test` (`SEED_EMAIL_DOMAIN`, `:16`) |
| PIN de todos los socios | `1234` (`DEFAULT_SEED_PIN`, `:19`) |
| Administrador | `admin@arnold.test` — "Admin Arnold" (`:41`) |
| Instructor | `instructor@arnold.test` — "Ivana Instructora" (`:42`) |
| Recepcionista | `recepcion@arnold.test` — "Rocío Recepción" (`:43`) |
| Socio 1 | `socio@arnold.test` — "Santiago Socio", DNI `30123456`, plan Premium, rutina activa **Torso B** (`:44`, `:358-390`) |
| Socio 2 | `socio2@arnold.test` — "Sofía Socia", DNI `31234567`, plan Básica (`:45`) |
| Membresías | Básica $15.000 · Premium $25.000 · Anual $200.000 · Promo verano (INACTIVA) (`:47-52`) |
| Máquinas | "Banco plano" y "Polea alta", `DISPONIBLE`, "Sala principal", asociadas a los ejercicios de Torso B (`:154-180`, `:262-289`) |
| Configuración | `capacidadMaxima` 60, `periodoGracia` 3, `diasInactividad` 15, `descuentoReactivacion` 10, `ventanaAforoMinutos` 90 (`:200-202`) |

---

# 1. Iniciar sesión

| | |
|---|---|
| **Pantalla** | `/login` — `src/app/login/page.tsx` (único archivo; no usa layout) |
| **Rol** | Público (sin sesión) |
| **Cómo se llega** | Directo a `/login`, o por redirección del proxy con `?from=<ruta>`; la raíz `/` redirige a `/login` si no hay sesión o al home del rol si la hay (`src/app/page.tsx:6-9`). Tras el login va a `from` (solo si es ruta relativa segura) o al home del rol (`src/lib/login-redirect.ts:23-25`): Socio → `/home-socio`; staff → `/home-interno` (`src/lib/authorization.ts:homeRouteForRole`). |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Marca | "ARNOLD" + "GYM" | `page.tsx:54-55` |
| Label email | "Email" | `:58` |
| Campo email | `type="email"`, `required`, `autoComplete="email"` | `:59-60` |
| Label contraseña | "Contraseña" | `:62` |
| Campo contraseña | `type="password"`, `required`, `autoComplete="current-password"` | `:63-64` |
| Error | `<p role="alert">` con el texto del servidor | `:66` |
| Botón | "Ingresar" / "Ingresando…" mientras carga, `disabled` | `:68-71` |
| Placeholder | **NO IMPLEMENTADO** (no hay `placeholder` en ninguno de los dos campos) | — |
| Atajos | Los nativos del formulario: `Enter` envía (`<form onSubmit>`) | `:52` |

## Secuencia normal

1. El usuario escribe email y contraseña (`:59-64`).
2. Pulsa "Ingresar" o `Enter` → `handleSubmit` (`:14`) hace `preventDefault`, limpia el error y pone `loading`.
3. `POST /api/auth/login` con `{ email, password }` (`:19-23`).
4. Si responde 200, `navigateTo(postLoginRoute(from, data.role))` (`:35-40`).
5. El proxy deja pasar a la pantalla destino.

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| 429 del proxy (más de 8 intentos/min por IP) | "Demasiados intentos. Probá de nuevo en un minuto." | `page.tsx:25`, alerta del formulario |
| 400 del servidor | "Email y contraseña son obligatorios" | `src/api/auth.ts:23` → alerta |
| 401 del servidor | "Email o contraseña incorrectos" | `src/api/auth.ts:24` → alerta |
| 403 del servidor | "Cuenta deshabilitada. Contactá al administrador." | `src/api/auth.ts:25` → alerta |
| Fallo de red | "No se pudo conectar con el servidor" | `page.tsx:42` |
| Respuesta no-ok sin `message` | "No se pudo iniciar sesión" | `page.tsx:31` |

## Estados de pantalla

- **Cargando**: botón deshabilitado con "Ingresando…" (`:70`).
- **Vacío**: formulario en blanco, sin error.
- **Error**: alerta roja arriba del botón; el formulario queda cargado para reintentar.
- **Éxito**: no hay estado de éxito visible; redirige (`:35`).

## Capturas sugeridas

1. `/login` vacío.
2. `/login` con la alerta "Email o contraseña incorrectos" (probar `admin@arnold.test` + clave errónea).
3. `/home-interno` como Administrador, para mostrar la redirección post-login (`admin@arnold.test` / `Arnold2026!`).
4. `/home-socio` como Socio (`socio@arnold.test`), para contrastar la redirección por rol.

---

# 2. Registrar pago

| | |
|---|---|
| **Pantalla** | `/pagos` — `src/app/pagos/page.tsx`; formulario `src/components/pago/pago-form.tsx` |
| **Rol** | Administrador y Recepcionista (`page.tsx:11`). Otros roles ven "Acceso Denegado" (`:41-49`). |
| **Cómo se llega** | Destino **Pagos** del rail del staff (`src/components/layout/staff-rail.tsx`) o la acción rápida "Registrar Pago" de Home_Interno (`src/components/home-interno/quick-actions.tsx:15`). |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Título de la tarjeta | "Registrar Pago" | `pago-form.tsx:102` |
| Label DNI | "DNI" | `:113` |
| Campo DNI | `type="text"`, placeholder "XX.XXX.XXX o XXXXXXXX" | `:126`, `:121` |
| Botón buscar | "Buscar" / "Buscando..." | `:137-138` |
| Tarjeta del socio | `aria-label="Socio encontrado"`; muestra Nombre, "DNI", "Email", "Teléfono", "Membresía", "Estado de cuota", "Monto a cobrar", "Período" | `socio-pago-card.tsx:33-57` |
| Estados de cuota | "Al día" · "Pendiente" · "Vencida" · "Sin cuota" | `socio-pago-card.tsx:6-11` |
| Oferta (si aplica) | "Precio de lista" y "Descuento" con "−N %" | `:53-58` |
| Sin membresía | "El socio no tiene una membresía asignada: no se puede registrar un pago." | `:63-65` |
| Historial | Tabla "Fecha · Método · Monto · Estado · Acción"; vacío: "Todavía no hay pagos registrados."; cargando: "Cargando…" | `pagos-historial.tsx:126-137` |
| Anular | Botón con campo "Motivo" | `pagos-historial.tsx:165` |
| Label método | "Método de pago" | `pago-form.tsx:142` |
| Opciones | "Efectivo" · "Transferencia" · "Tarjeta" | `:14-18`, `:150-155` |
| Botón confirmar | "Confirmar pago" / "Registrando..." | `:168-170` |

## Secuencia normal

1. Escribe el DNI y pulsa "Buscar" → `handleBuscar` (`pago-form.tsx:36`); si está vacío, error local "Ingresá un DNI para buscar." (`:44`).
2. `fetchSocioPorDni(consulta)` → `GET /api/socios?dni=` (`src/api/socios.ts`) y se pinta `SocioPagoCard`, el historial y el select de método.
3. Elige el método (`:145-157`).
4. Pulsa "Confirmar pago" → `handleConfirmar` (`:57`) calcula `montoEsperado` (oferta o plan) y llama `createPago({ socioId, metodoPago, montoEsperado })` → `POST /api/pagos` (`src/api/pagos.ts:65-75`).
5. Éxito: notificación "Pago registrado: {monto} · Período {períodos}" (`:70-73`) y el formulario se limpia (`:74-76`).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| DNI vacío | "Ingresá un DNI para buscar." | `pago-form.tsx:44` |
| Búsqueda falla | "No se pudo buscar el socio." o el mensaje del servidor | `:50` |
| 403 | "No tenés permiso para esta acción." | `api-error.ts:35` |
| Socio sin membresía (cliente) | "El socio no tiene una membresía asignada: no se puede registrar un pago." | `socio-pago-card.tsx:63-65` |
| Socio sin membresía (servidor) | "El socio no tiene una membresía asignada" | `registrar-pago.ts:122` |
| Pago duplicado (409) | "Ya existe una cuota para el período que se intenta pagar" | `route-error-mapper.ts:166` |
| Monto cambiado (409) | "El monto cambió a {monto}" y se **refresca la vista previa** | `registrar-pago.ts:200`, `pago-form.tsx:81-88` |
| Choque de cobro (409) | "Otro pago se registró al mismo tiempo; vuelva a intentarlo" | `route-error-mapper.ts:157` |
| Socio inexistente (404) | "Socio no encontrado" | `route-error-mapper.ts` (`resourceName`) |
| Error de cobro genérico | "No se pudo registrar el pago." | `pago-form.tsx:80` |
| 5xx | "No se pudo procesar la solicitud. Probá de nuevo más tarde." | `api-error.ts:37` |

## Estados de pantalla

- **Cargando**: "Buscando..." en el botón; "Cargando…" en el historial.
- **Vacío**: sin socio seleccionado no aparecen tarjeta, historial ni método. Historial vacío: "Todavía no hay pagos registrados."
- **Error**: alerta roja dentro de la tarjeta (`pago-form.tsx:105-109`).
- **Éxito**: notificación global y formulario limpio; la pantalla queda lista para otro socio.

## Capturas sugeridas

1. `/pagos` sin socio (estado inicial).
2. Socio encontrado con `30123456` y su tarjeta con estado "Al día" y monto.
3. Notificación "Pago registrado: …".
4. Historial con un pago y el campo "Motivo" abierto para anular.

---

# 3. Registrar ingreso por DNI y PIN

| | |
|---|---|
| **Pantalla** | `/acceso` — `src/app/acceso/page.tsx`; kiosco en `src/components/acceso/kiosco-acceso.tsx` |
| **Rol** | Administrador y Recepcionista (`page.tsx:11`) |
| **Cómo se llega** | Acción rápida "Control Acceso" de Home_Interno (`quick-actions.tsx:17`). **No está en el rail**: es un kiosco que se abre y se deja corriendo. También existe el panel "Definir PIN" con el botón del ActionBar (`page.tsx:55-62`). |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Título paso DNI | "Ingresá tu DNI" | `kiosco-acceso.tsx:114` |
| Título paso PIN | "Ingresá tu PIN" | `:114` |
| Visor del DNI | `<output aria-label="DNI ingresado">` con "—" cuando está vacío | `:118-123` |
| PIN | `role="group" aria-label="PIN"` con 4 casillas y "●" por dígito | `:125-135` |
| Lector para pantalla | "{n} de 4 dígitos ingresados" (`sr-only`) | `:134` |
| Teclado | `role="group" aria-label="Teclado numérico"`, teclas 0–9 y "Borrar" ("⌫") | `teclado-numerico.tsx:22-44` |
| Botón DNI | "Continuar" (deshabilitado sin DNI) | `:141-148` |
| Botones PIN | "Volver" y "Ingresar" / "Ingresando..." | `:151-166` |
| Resultado | Panel con nombre, membresía y "Acceso permitido" / "Acceso denegado" (`PanelResultado`) | `panel-resultado.tsx` |
| Override (solo Admin) | "Otorgar acceso (override)" | `override-acceso.tsx:97` |
| Atajos de teclado físico | `0`–`9` agrega dígito · `Backspace` borra · `Enter` avanza/ingresa · `Esc` vuelve del PIN al DNI | `kiosco-acceso.tsx:100-118` |

> Los atajos ignoran `Ctrl`/`Meta`/`Alt`, lo tipeado en `input`/`textarea`/`select` y todo el kiosco
> mientras el diálogo de override está abierto; con un botón enfocado, `Enter` no se intercepta
> (`kiosco-acceso.tsx:104-125`).

## Secuencia normal

1. El recepcionista tipea el DNI (máx. 8 dígitos) con el teclado en pantalla o el físico (`:55-65`).
2. "Continuar" → `continuar()` pasa a PIN solo si hay DNI (`:67-69`).
3. Tipea el PIN (4 dígitos) (`:58`).
4. "Ingresar" → `ingresar()`: `checkIn({ dni, pin })` → `POST /api/acceso/check-in` (`src/api/acceso.ts:331`).
5. Con 200, `PanelResultado` muestra el estado; si es denegado y hay socio, aparece el override (solo Admin).
6. A los 5 s (`MS_AUTO_CLEAR`) el kiosco se limpia solo y vuelve al DNI (`:38-42`); con el override abierto, el auto-clear se pausa (`:39`).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| DNI o PIN incorrecto | "DNI o PIN incorrectos" | `src/api/acceso.ts:35` (motivo del panel) |
| 429 (20 intentos fallidos/min por IP) | "Demasiados intentos. Probá de nuevo en un minuto." | `route.ts:27` |
| 400 (falta DNI o PIN) | "Se requieren el DNI y el PIN" | `route.ts:68` |
| 400 (body inválido) | "Cuerpo de la solicitud inválido" | `route.ts:61` |
| 403 | "No tenés permiso para esta acción." | `api-error.ts:35` |
| Cuota vencida / cuenta bloqueada / anti-passback | El `motivo` que devuelve el dominio (p. ej. "Cuota vencida") | `decidirAcceso`, `src/domains/acceso/check-in.ts` |
| Fallo de red | "No hay conexión con el servidor. Revisá tu internet." | `api-error.ts:40` |

## Estados de pantalla

- **Cargando**: "Ingresando..." con el botón deshabilitado.
- **Vacío**: DNI "—" y casillas de PIN sin puntos.
- **Error**: el resultado se muestra como DENEGADO con motivo en el panel; los 429/400 se muestran con el mismo panel/mensaje.
- **Éxito**: "Acceso permitido" (o con aviso de cuota pendiente) y limpieza automática.

## Capturas sugeridas

1. Paso DNI con "—".
2. Paso PIN con dos dígitos cargados.
3. Resultado permitido con `30123456` + PIN `1234`.
4. Resultado denegado y el botón de override con `admin@arnold.test`.

---

# 4. Asignar rutina

| | |
|---|---|
| **Pantalla** | Modal `src/components/rutina/asignar-rutina-modal.tsx`, montado desde Home_Interno |
| **Rol** | Administrador e Instructor (`src/app/api/rutinas-asignadas/route.ts:10`) |
| **Cómo se llega** | Acción rápida "Asignar Rutina" de Home_Interno (`quick-actions.tsx:16`). |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Título | "Asignar Rutina a Socio" | `asignar-rutina-modal.tsx:108` |
| Cerrar | Botón con `aria-label="Cerrar"` | `:109` |
| Label DNI | "DNI" | `:123` |
| Campo DNI | placeholder "XX.XXX.XXX o XXXXXXXX" | `:131` |
| Botón buscar | "Buscar" / "Buscando..." | `:139-143` |
| Socio | `aria-label="Socio seleccionado"`, nombre y "DNI {dni}" | `:145-150` |
| Label rutina | "Rutina" | `:154` |
| Select | Opción vacía "Seleccioná una rutina"; cada opción "{nombre} (Nivel: {nivel}, {min} min)" | `:164-171` |
| Botones | "Cancelar" y "Asignar" / "Asignando..." | `:178-189` |

## Secuencia normal

1. Escribe el DNI y "Buscar" → `handleBuscar`; vacío → "Ingresá un DNI para buscar." (`:77`).
2. `fetchSocioPorDni` → `GET /api/socios?dni=`; se muestra el socio y se llena el select con las rutinas.
3. Elige la rutina y pulsa "Asignar" → `handleAsignar` (`:80`) → `createAsignacionRutina({ socioId, rutinaId })` → `POST /api/rutinas-asignadas` (`src/api/rutinas-asignadas.ts:42`).
4. Éxito: notificación "Rutina asignada a {nombre}" (`:86`), cierra el modal y refresca la home (`onAsignada`).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| DNI vacío | "Ingresá un DNI para buscar." | `:77` |
| Búsqueda falla | "No se pudo buscar el socio." | `:71` |
| Socio inactivo (400) | "El socio debe estar activo para asignar rutina" | `asignar-rutina.ts:36` |
| Socio/rutina inexistente (404) | "Socio no encontrado" / "Rutina no encontrada" | `route.ts:23-24` |
| Carrera de asignación (409) | "Otra asignación de rutina se procesó al mismo tiempo; vuelva a intentarlo" | `route-error-mapper.ts:199` |
| Asignación falla | "No se pudo asignar la rutina." | `:88` |

> **NO IMPLEMENTADO**: el route no valida la forma del body (`request.json()` y listo, `route.ts:81-91`).
> Un body sin `socioId`/`rutinaId` no tiene un 400 explícito; el error termina en 500.

## Estados de pantalla

- **Cargando**: "Buscando..." y el select deshabilitado mientras carga rutinas.
- **Vacío**: sin socio no hay select ni botones de acción; el botón "Asignar" está deshabilitado.
- **Error**: alerta roja dentro del modal (`:115-119`).
- **Éxito**: notificación, cierre y refresco.

## Capturas sugeridas

1. Modal recién abierto.
2. Socio encontrado (`30123456`) con el select de rutinas.
3. Notificación "Rutina asignada a …".

---

# 5. Iniciar sesión de entrenamiento

| | |
|---|---|
| **Pantalla** | `/home-socio` → modo ejecución: `src/app/home-socio/page.tsx` monta `EjecucionRutina` (`:127-130`) |
| **Rol** | Socio (`SOCIO`); el Administrador puede iniciar para un socio por API, no por esta pantalla |
| **Cómo se llega** | "Empezar entrenamiento" del hero (`sesion-hero.tsx:108`) o el mismo botón de la tarjeta de sugerencia (`tarjeta-sugerencia.tsx:149`); ambos llaman a `handleSeguirRutina` que pone `modoEjecucion` |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Sin rutina | "Sin rutina asignada" | `sesion-hero.tsx:33` |
| Botón del hero | "Empezar entrenamiento" / "Retomar entrenamiento" | `sesion-hero.tsx:108` |
| Encabezado de ejecución | "EJECUTANDO RUTINA" y el nombre del ejercicio | `ejecucion-rutina.tsx:340-344` |
| Salir | "Salir" | `:346-352` |
| Progreso | "Ejercicio {n} de {total}" y "{hechas}/{total} series" con barra | `encabezado-de-sesion.tsx:38, 49-50, 60` |
| Serie | "Serie {n} de {series}" | `ejecucion-rutina.tsx:399-401` |
| Campos | "REPETICIONES", "PESO (KG)", "RIR (repeticiones en reserva)", "TIPO DE SERIE" | `:417, 443, 475, 498` |
| Botones de ajuste | `aria-label` "Restar una repetición" / "Sumar una repetición" / "Restar peso" / "Sumar peso" | `:422-459` |
| Tipos | "Normal" · "Calentamiento" · "Al fallo" | `tipo-serie.ts:45-50` |
| Drop sets | "Agregar drop set"; tope "Hasta 5 drop sets por serie." | `drops-de-serie.tsx:139-144` |
| Botón registrar | "Serie hecha" / "Calentamiento hecho" / "Guardando..." | `:537-545` |
| Sin ejercicio | "No hay un ejercicio en curso." | `:580` |
| Atajos | **NO IMPLEMENTADO**: la pantalla no define atajos de teclado | — |

## Secuencia normal

1. "Empezar entrenamiento" → `modoEjecucion = true` y se monta `EjecucionRutina`.
2. Al montar, `fetchSesionEnCurso()` → `GET /api/sesiones?enCurso=1` (`ejecucion-rutina.tsx:168`).
3. Si no hay sesión, `iniciarSesionDeEntrenamiento(rutinaAsignadaId)` → `POST /api/sesiones` con `{ rutinaAsignadaId }` (`src/api/sesiones.ts:270-283`).
4. Con 201 se pinta el primer ejercicio, la serie 1 y el encabezado.
5. El usuario ajusta repeticiones y peso y registra la serie (caso 6).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Sin rutina asignada | "No tenés una rutina asignada." | `ejecucion-rutina.tsx:192` |
| Carga inicial falla | "No pudimos cargar la sesión." | `:195` |
| 403 (socio pidiendo otro socio) | "No tenés permiso para esta acción." | `api-error.ts:35` |
| 400 (rutina no activa o de otro socio) | "La rutina asignada no está activa" / "La rutina asignada no pertenece al socio" | `sesion-de-entrenamiento.ts:240-246` |
| 404 | "Socio no encontrado" / "Rutina asignada no encontrada" | `:225-235` |
| 400 (falta `rutinaAsignadaId`) | "Se requiere el rutinaAsignadaId" | `src/app/api/sesiones/route.ts:95` |

## Estados de pantalla

- **Cargando**: `SeccionCargando` con pulso (`page.tsx:134`).
- **Vacío**: sin rutina activa, hero "Sin rutina asignada" y no se ofrece ejecución.
- **Error**: alerta roja en el contenedor (`page.tsx:120-124`) o dentro de la ejecución.
- **Éxito**: se ve la tarjeta de ejecución con el primer ejercicio.

## Capturas sugeridas

1. `/home-socio` como `socio@arnold.test`, con hero y tarjeta de sugerencia.
2. Ejecución recién iniciada (encabezado + "Serie 1 de N").
3. Estado "Sin rutina asignada" con `socio2@arnold.test` (sin rutina en el seed).

---

# 6. Registrar serie

| | |
|---|---|
| **Pantalla** | `src/components/home-socio/ejecucion-rutina.tsx` (misma pantalla del caso 5) |
| **Rol** | Socio |
| **Cómo se llega** | Con la ejecución abierta (caso 5) |

## Elementos visibles

Ver caso 5: "REPETICIONES", "PESO (KG)", "RIR (repeticiones en reserva)", "TIPO DE SERIE",
"Serie hecha", "Descanso", "Saltar", "¡Descanso terminado!", "Hasta 5 drop sets por serie.".

## Secuencia normal

1. Ajusta repeticiones con `aria-label` "Sumar/ Restar una repetición" (`:422-441`) y peso con
   "Sumar/ Restar peso" (`:448-467`).
2. Elige el tipo de serie (3 botones, `aria-pressed`) (`:499-514`). Si elige "Calentamiento", ve
   "No cuenta como una de las series de la rutina ni para tu progreso." (`:516-520`).
3. Opcionalmente agrega drop sets (`DropsDeSerie`).
4. "Serie hecha" → `handleSerieHecha` → `registrarSerieDeEntrenamiento(sesionId, {...})` →
   `POST /api/sesiones/{id}/series` (`src/api/sesiones.ts:287`).
5. Con 201 la sesión avanza; si hay descanso, aparece el bloque "Descanso" con cuenta regresiva
   (`:547-577`). Al expirar: "¡Descanso terminado!" (`:563-566`).
6. Si era la última serie del ejercicio, avanza al siguiente o termina (caso 7).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Fallo al registrar | "No se pudo registrar la serie." o el mensaje del servidor | `ejecucion-rutina.tsx:290` |
| Carga inválida (400) | "La carga debe ser un número mayor o igual a 0" | `sesion-de-entrenamiento.ts:463` |
| Repeticiones inválidas | "Las repeticiones deben ser un entero mayor o igual a 1" | `:466` |
| Tipo inválido | "El tipo de serie no es válido" | `:471` |
| Drop como serie | "El drop set se agrega a una serie, no se registra solo" | `:475` |
| Drop inválido | "Una serie admite hasta 5 drop sets" / "Un calentamiento no lleva drop sets" | `:684-688` |
| Sesión no en curso | "La sesión no está en curso" | `:499` |
| Ejercicio no actual | "El ejercicio no es el actual de la sesión" | `:505` |
| Concurrencia | "La sesión fue modificada por un registro concurrente; recargá e intentá de nuevo" | `:604-606` |

## Estados de pantalla

- **Cargando**: "Guardando..." con el botón deshabilitado.
- **Vacío**: "No hay un ejercicio en curso."
- **Error**: alerta roja dentro de la tarjeta.
- **Éxito**: avanza la serie, aparece el descanso y se actualiza el encabezado.

## Capturas sugeridas

1. Tarjeta de serie con repeticiones, peso, RIR y tipo.
2. Calentamiento seleccionado con el aviso.
3. Drop set agregado (una fila con `aria-label="Drop 1"`).
4. Bloque "Descanso" con "¡Descanso terminado!".

---

# 7. Finalizar sesión

| | |
|---|---|
| **Pantalla** | `src/components/home-socio/ejecucion-rutina.tsx` |
| **Rol** | Socio |
| **Cómo se llega** | Se dispara automáticamente al registrar la última serie (`ejecucion-rutina.tsx:255-262`). También se puede salir con "Salir" (`:346-352`), que **no** finaliza la sesión. |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Resumen | `data-testid="resumen-sesion"` con totales "{n} series · {m} min" | `resumen-de-sesion.tsx:48-51` |
| Por ejercicio | Hoy, tendencia "↑ ↓ =" y próxima carga | `:60-70` |
| Marcas | Trofeo con el texto de la marca nueva | `:24-30` |

## Secuencia normal

1. Al registrar la serie que deja `serieActual = null`, la pantalla llama
   `finalizarSesionDeEntrenamiento(sesionId)` → `PUT /api/sesiones/{id}` (`src/api/sesiones.ts:314`).
2. Con 200, pide `fetchResumenDeSesion(sesionId)` → `GET /api/sesiones/{id}/resumen`
   (`ejecucion-rutina.tsx:261`).
3. Se muestra el resumen (`:265-280`).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Finalización falla | "No se pudo registrar la serie." — el cierre ocurre **dentro** de `handleSerieHecha`, así que cae en su mismo `catch` | `ejecucion-rutina.tsx:290` |
| Resumen falla | No bloquea: igual se cierra la sesión. **NO IMPLEMENTADO** un mensaje específico de resumen fallido. | `:255-262` |
| 404 | "Sesión no encontrada" | `route-error-mapper.ts` (`resourceName`) |

## Estados de pantalla

- **Cargando**: botón "Guardando..." antes de cerrar.
- **Error**: alerta roja de la tarjeta.
- **Éxito**: resumen por ejercicio; si el resumen falla, la sesión queda cerrada igual.

## Capturas sugeridas

1. Última serie registrada.
2. Resumen con tendencias y una marca nueva.

---

# 8. Sugerencia de asignación dinámica

| | |
|---|---|
| **Pantalla** | `/home-socio`, tarjeta `SugerenciaAsignacion` → `TarjetaSugerencia` |
| **Rol** | Socio |
| **Cómo se llega** | Se monta sola en la home **solo con rutina activa y sin sesión en curso** (`src/app/home-socio/page.tsx:140-142`) |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Título | "Tu próxima máquina" | `tarjeta-sugerencia.tsx:56-58` |
| Cargando | Pulso (`SeccionCargando`) | `:58` |
| Libre | "Está libre" + "Andá a {máquina} y hacé {ejercicio}." | `:99-104` |
| Con espera | "Te toca en {tiempo}" + "{ejercicio} en {máquina}." | `:108-115` |
| Sin reserva | "Ahora no tenés una reserva." + "Si seguís el orden de tu rutina, toca {ejercicio}." | `:120-126` |
| Sin datos | "Todavía no tenemos una sugerencia para vos." | `:87-89` |
| Vencida | "La reserva venció. Volvemos a consultar." | `:79-81` |
| Error | "No pudimos calcular tu próxima máquina." | `:83-85` |
| Botones | "Ir ahora" y "Esperar" | `:133-146` |
| Aceptada | "Listo, te guardamos {máquina} para {ejercicio}." + "Empezar entrenamiento" | `:91-97`, `:148-152` |
| Reintentar | "Reintentar" / "Volver a consultar" / "Consultando…" | `:157-167` |

## Secuencia normal

1. Al montar, `useSugerenciaAsignacion` llama `fetchSugerencia()` → `GET /api/asignaciones/sugerencia`
   (`src/api/asignaciones-cliente.ts:10-14`).
2. Según la respuesta, la tarjeta muestra libre / espera / sin reserva / sin datos.
3. "Ir ahora" o "Esperar" → `decidirSugerencia(accion)` → `POST /api/asignaciones/decidir`
   (`:22-30`).
4. Vuelve a consultar la home al volver a la pestaña y después de cada acción (`use-sugerencia-asignacion.ts:76-120`).

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Consulta falla | "No pudimos calcular tu próxima máquina." | `:84` |
| Reserva vencida (404/409 al decidir) | "La reserva venció. Volvemos a consultar." | `:80` |
| Sin sugerencia | "Todavía no tenemos una sugerencia para vos." | `:88` |
| 403 | "No tenés permiso para esta acción." | `api-error.ts:35` |

## Estados de pantalla

- **Cargando**: pulso.
- **Vacío**: mensaje neutro único.
- **Error**: mensaje + "Reintentar".
- **Éxito**: sugerencia con acciones, o confirmación con "Empezar entrenamiento".

## Capturas sugeridas

1. Tarjeta "Está libre" con `socio@arnold.test`.
2. Tarjeta "Te toca en …".
3. Estado "Todavía no tenemos una sugerencia para vos." (socio sin rutina: `socio2@arnold.test`).
4. Tarjeta "Listo, te guardamos …" con el botón "Empezar entrenamiento".

---

# 9. Decisión de asignación dinámica

| | |
|---|---|
| **Pantalla** | Misma tarjeta (botones "Ir ahora" y "Esperar") |
| **Rol** | Socio (`src/api/asignaciones.ts:196`) |
| **Cómo se llega** | Tarjeta de sugerencia visible (caso 8) |

## Elementos visibles

"Ir ahora" y "Esperar" (`tarjeta-sugerencia.tsx:133-146`), deshabilitados mientras `enviando`.

## Secuencia normal

1. "Ir ahora" → `decidirSugerencia("ACEPTAR")` → `POST /api/asignaciones/decidir` con `{ accion }`.
2. Con 200, la tarjeta pasa a "Listo, te guardamos …" y ofrece "Empezar entrenamiento".
3. "Esperar" → `decidirSugerencia("ESPERAR")`; con 200 se reconsulta la sugerencia.

> El código es explícito: **"ACEPTAR no escribe"** (`src/domains/asignacion/orquestacion.ts:242`).
> La reserva la crea el cálculo disparado en el check-in; aceptar la confirma.

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Acción inválida (400) | "La solicitud no es válida: la acción debe ser ACEPTAR o ESPERAR" | `src/api/asignaciones.ts` (`mensajeValidacion`) |
| Sin sugerencia (404) | "La reserva venció. Volvemos a consultar." (el hook mapea 404/409 a `vencida`) | `use-sugerencia-asignacion.ts:112-113` |
| Sugerencia vencida (409) | idem | idem |
| El motor falla (500) | "No pudimos calcular tu próxima máquina." | `tarjeta-sugerencia.tsx:84` |

## Estados de pantalla

- **Cargando**: "Consultando…" en el botón secundario cuando corresponde.
- **Éxito**: confirmación con "Empezar entrenamiento".
- **Error/vencida**: mensaje y reconsulta.

## Capturas sugeridas

1. Antes de decidir (ambos botones).
2. Después de "Ir ahora" (confirmación).
3. Después de "Esperar".

---

# 10. Registrar cierre de caja

| | |
|---|---|
| **Pantalla** | `/cierres` — `src/app/cierres/page.tsx` |
| **Rol** | Administrador y Recepcionista (`page.tsx:12`); otros ven "Acceso Denegado" |
| **Cómo se llega** | Destino "Cierres de caja" del rail, o el botón "Cierre de Caja" de la tarjeta Caja de Home_Interno (`caja-card.tsx:50-55`) |

## Elementos visibles

| Elemento | Texto exacto | Fuente |
|---|---|---|
| Título (sr-only) | "Cierre de Caja" | `page.tsx:149` |
| Total | "Total del turno" + monto | `:153-158` |
| Operaciones | "{n} operaciones pendientes de cierre" | `:159-161` |
| Desglose | "Efectivo", "Transferencia", "Tarjeta" | `:170-180` |
| Botón | "Confirmar cierre" / "Cerrando..." | `:188-194` |
| Historial | "Cierres recientes"; vacío: "Sin cierres registrados." | `:198-202` |

## Secuencia normal

1. Al entrar (autorizado), se llama `fetchPreviewCierre()` → `GET /api/cierres?preview=1`
   (`page.tsx:86`) y `fetchCierres()` → `GET /api/cierres` (`:98`).
2. Se muestran totales y desglose.
3. "Confirmar cierre" → `handleConfirmar` (`:111`) → `createCierre({ desde, hasta })` con el rango
   **previsualizado** (`src/api/cierres.ts:126`) → `POST /api/cierres`.
4. Éxito: notificación "Cierre registrado: {monto} · {n} operaciones" (`:119-122`) y se recargan la
   vista previa y el historial.

## Excepciones y mensajes

| Situación | Mensaje que ve el usuario | Dónde aparece |
|---|---|---|
| Vista previa falla | "No se pudo calcular el cierre de caja." | `:65`, `:91` |
| Cierre duplicado (409) | "Ya existe un cierre de caja para el turno" | `route-error-mapper.ts:148` |
| Usuario sin empleado (400) | "El usuario no tiene un empleado asociado" | `cierre-de-caja.ts:181` |
| Rango inválido (400) | "El rango de fechas es inválido" | `route.ts:122` |
| Cierre falla | "No se pudo cerrar la caja." | `:126` |

## Estados de pantalla

- **Cargando**: `loading` inicial; totales en `$0.00` si todavía no llegaron (`:156`).
- **Vacío**: "Sin cierres registrados." y "0 operaciones pendientes de cierre".
- **Error**: alerta roja (`:163-167`).
- **Éxito**: notificación y el cierre aparece en "Cierres recientes".

## Capturas sugeridas

1. `/cierres` con pagos pendientes (registrar uno antes desde `/pagos`).
2. Notificación "Cierre registrado: …".
3. "Sin cierres registrados." en una base recién sembrada.
