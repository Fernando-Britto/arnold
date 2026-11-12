# Sugerencia de Asignación — UI Specification

## Purpose

Hacer visible la asignación dinámica en el portal del socio: una tarjeta en `/home-socio` que muestra la
sugerencia vigente (ejercicio, máquina y espera estimada), permite decidir con dos botones y explica qué
pasa cuando no hay nada que decidir. Consume la API existente **sin modificarla**.

Estado: **especificado**. No modifica el backend.

## Metadatos

| Campo | Valor |
|---|---|
| Capability | `asignacion-sugerencia-ui` |
| Change | `asignacion-ui` (Etapa 5) |
| Dependencias | `GET /api/asignaciones/sugerencia` y `POST /api/asignaciones/decidir` (`src/api/asignaciones.ts`), `HomeSocioViewModel.sesionEnProgreso` (`src/api/home-socio.ts:130`), `EjecucionRutina` (`src/components/home-socio/ejecucion-rutina.tsx`) |
| Numeración AC | `AC-541…AC-556`. No colisiona: el rango ocupado termina en AC-530 |

## Requirements

### Requirement: Visibilidad de la tarjeta

La tarjeta **MUST** mostrarse en `/home-socio` **solo** cuando se cumplen las cuatro condiciones:

1. La persona es SOCIO. La página ya redirige a cualquier otro rol antes de renderizar
   (`src/app/home-socio/page.tsx:76-82`), así que fuera del portal del socio la tarjeta no existe y **MUST
   NOT** consultarse la API.
2. Los datos del home ya están disponibles (`data !== null`). Antes de eso la tarjeta **MUST NOT** dibujarse:
   no se inventa un estado vacío ni se agrega una pantalla de carga nueva.
3. `data.rutinaActiva !== null`: sin rutina activa no hay nada que sugerir y la tarjeta **MUST NOT**
   mostrarse ni consultarse.
4. `data.sesionEnProgreso === false`.

La condición 4 es la regla crítica. Con una sesión `EN_CURSO`, la reserva que devuelve la API es la del
**siguiente** ejercicio y no existe consumo a mitad de sesión
(`src/domains/sesion/sesion-de-entrenamiento.ts:547-560` solo recalcula al completar un ejercicio). Ofrecer
"Ir ahora" ahí prometería un salto que hoy no ocurre, así que **la tarjeta se oculta mientras haya sesión
en curso** y ese caso queda para el S4 diferido (D-118).

`sesionEnProgreso` viene del servidor como «existe una sesión EN_CURSO» (`src/api/home-socio-data.ts:272`),
así que la home no necesita consultar la sesión por su cuenta.

#### Scenario: Socio sin sesión en curso con rutina activa

- GIVEN un SOCIO con rutina activa y `sesionEnProgreso = false`
- WHEN abre `/home-socio`
- THEN la tarjeta se dibuja y hace **una** consulta a `GET /api/asignaciones/sugerencia`

#### Scenario: Socio con sesión en curso

- GIVEN un SOCIO con `sesionEnProgreso = true`
- WHEN abre `/home-socio`
- THEN la tarjeta **no** se dibuja
- AND **no** se consulta la API de asignaciones
- AND no aparece ningún botón "Ir ahora"

#### Scenario: Socio sin rutina activa

- GIVEN un SOCIO sin rutina activa
- WHEN abre `/home-socio`
- THEN la tarjeta no se dibuja y no se consulta la API

#### Scenario: Otro rol

- GIVEN una sesión de ADMINISTRADOR, INSTRUCTOR o RECEPCIONISTA
- WHEN entra al portal
- THEN es redirigido a `/home-interno` y la API de asignaciones no se consulta desde esta pantalla

### Requirement: Estados de la tarjeta

La tarjeta **MUST** tener un estado por cada respuesta posible de la API y los textos **MUST** ser exactamente
los de esta tabla (español rioplatense, sin jerga técnica).

| Estado | Condición | Texto | Acciones |
|---|---|---|---|
| `libre` | `sugerencia.esperaSegundos === 0` | "Está libre" · "Andá a **{maquinaNombre}** y hacé **{ejercicioNombre}**." | "Ir ahora" (primaria) · "Esperar" |
| `enEspera` | `esperaSegundos > 0` | "Te toca en **{N} min**" (N = `Math.ceil(esperaSegundos / 60)`; si N = 1, "1 min"; si `esperaSegundos < 60`, "menos de 1 min") · "**{ejercicioNombre}** en **{maquinaNombre}**." | "Ir ahora" (primaria) · "Esperar" |
| `aceptada` | el `POST ACEPTAR` devolvió 200 | "Listo, te guardamos **{maquinaNombre}** para **{ejercicioNombre}**." | "Empezar entrenamiento" (primaria) |
| `sinReserva` | `sugerencia === null` y `siguienteEnOrden !== null` | "Ahora no tenés una reserva." · "Si seguís el orden de tu rutina, toca **{siguiente.ejercicioNombre}**." | "Volver a consultar" (secundaria) |
| `sinSugerencia` | `sugerencia === null` y `siguienteEnOrden === null` | "Todavía no tenemos una sugerencia para vos." (mensaje único neutro, D-114) | "Volver a consultar" (secundaria) |
| `vencida` | `POST` → 409 `SIN_SUGERENCIA_VIGENTE` | "La reserva venció. Volvemos a consultar." | "Volver a consultar" (secundaria) |
| `error` | `GET`/`POST` → 5xx o fallo de red | "No pudimos calcular tu próxima máquina." | "Reintentar" (secundaria) |
| `enviando` | hay un `POST` en vuelo | el texto del estado anterior, sin cambios | botones deshabilitados, `aria-busy="true"` |

`maquinaNombre` puede venir `null` (`src/api/asignaciones.ts:25-34`); en ese caso la tarjeta **MUST** usar
"tu máquina" y no romper.

La tarjeta **MUST** anunciar los cambios de estado con `aria-live="polite"`, ser navegable y accionable con
teclado, y **MUST NOT** depender solo del color para distinguir estados. El nombre del ejercicio y de la
máquina **MUST** estar en texto, no solo en un icono o color.

#### Scenario: Espera cero

- GIVEN una sugerencia con `esperaSegundos = 0` y `maquinaNombre = "Banco plano"`
- WHEN se renderiza la tarjeta
- THEN dice "Está libre" y nombra "Banco plano" y el ejercicio
- AND muestra "Ir ahora" y "Esperar"

#### Scenario: Espera de 90 segundos

- GIVEN una sugerencia con `esperaSegundos = 90`
- WHEN se renderiza
- THEN muestra "2 min" (`Math.ceil(90 / 60)`)

#### Scenario: Sin reserva pero con orden de rutina

- GIVEN `sugerencia = null` y `siguienteEnOrden` con `ejercicioNombre = "Jalón al pecho"`
- WHEN se renderiza
- THEN dice que no hay reserva y que por orden toca "Jalón al pecho"
- AND **no** muestra "Ir ahora" ni "Esperar"

#### Scenario: Sin rutina computable

- GIVEN `sugerencia = null` y `siguienteEnOrden = null` con rutina activa
- WHEN se renderiza
- THEN muestra el mensaje neutro único
- AND no enumera causas ni pide nada al socio

#### Scenario: La reserva venció

- GIVEN el socio toca "Ir ahora" sobre una reserva vencida
- WHEN el `POST` responde 409 `SIN_SUGERENCIA_VIGENTE`
- THEN la tarjeta dice "La reserva venció. Volvemos a consultar."
- AND dispara una consulta nueva

#### Scenario: Error del servidor

- GIVEN la API responde 500 o falla la red
- WHEN la tarjeta procesa el error
- THEN muestra "No pudimos calcular tu próxima máquina." con "Reintentar"
- AND el resto de la home sigue visible y funcionando

#### Scenario: Máquina sin nombre

- GIVEN una sugerencia con `maquinaNombre = null`
- WHEN se renderiza
- THEN usa "tu máquina" y no muestra `null` ni un hueco

### Requirement: Acciones "Ir ahora" y "Esperar"

"Ir ahora" **MUST** enviar `POST /api/asignaciones/decidir` con el cuerpo exacto `{ "accion": "ACEPTAR" }` y
"Esperar" con `{ "accion": "ESPERAR" }`. Ningún otro campo **MUST** enviarse: el contrato rechaza cualquier
otro (`src/api/asignaciones.ts:169-176`).

- Con `ACEPTAR` 200, la tarjeta pasa al estado `aceptada` y ofrece **"Empezar entrenamiento"**, que **MUST**
  reutilizar el mecanismo existente de inicio/reanudación de rutina (`onSeguirRutina`,
  `src/app/home-socio/page.tsx:85`, que monta `EjecucionRutina`); **MUST NOT** crear un flujo nuevo.
- Con `ESPERAR` 200, la tarjeta pasa a `sinReserva` o `sinSugerencia` según `siguienteEnOrden` de la respuesta.
- Mientras un `POST` está en vuelo los dos botones **MUST** estar deshabilitados (`enviando`), para que un
  doble toque no dispare dos acciones. `ACEPTAR` es idempotente en el backend; `ESPERAR` repetido no debe
  poder enviarse desde la UI.

#### Scenario: Aceptar

- GIVEN una sugerencia vigente
- WHEN el socio toca "Ir ahora"
- THEN se envía `{ accion: "ACEPTAR" }`
- AND la tarjeta muestra "Listo, te guardamos … para …" y "Empezar entrenamiento"
- AND los botones vuelven a estar habilitados

#### Scenario: Empezar desde la tarjeta

- GIVEN la tarjeta en estado `aceptada`
- WHEN el socio toca "Empezar entrenamiento"
- THEN se abre `EjecucionRutina` por el mismo camino que "Seguir rutina"
- AND la sesión arranca en el ejercicio de la reserva (`src/domains/sesion/sesion-de-entrenamiento.ts:260-267`)

#### Scenario: Esperar

- GIVEN una sugerencia vigente
- WHEN el socio toca "Esperar"
- THEN se envía `{ accion: "ESPERAR" }`
- AND la tarjeta deja de ofrecer "Ir ahora" y muestra el estado de "sin reserva"

#### Scenario: Doble toque

- GIVEN un `POST` en vuelo
- WHEN el socio vuelve a tocar cualquiera de los dos botones
- THEN no se envía una segunda petición

### Requirement: Refresco sin polling y sin cache

La tarjeta **MUST** consultar la sugerencia en estos momentos y en ningún otro:

1. Al montarse, cuando se cumplen las condiciones de visibilidad.
2. Cuando la pestaña vuelve a estar visible (`document.visibilityState === "visible"`).
3. Después de `ACEPTAR` o `ESPERAR`.
4. Cuando el socio cierra la ejecución de la rutina y vuelve a la home.

**MUST NOT** consultar en un intervalo periódico (sin polling) ni cachear la respuesta en
`src/lib/cache-cliente.ts`: la reserva tiene `venceEn` (`src/api/asignaciones.ts:25`) y un cache de 60 s
(`src/lib/cache-cliente.ts:25`) ofrecería acciones sobre algo vencido (D-116).

Los pedidos **MUST** cancelarse o descartarse si llega una respuesta vieja: solo la última consulta **MUST**
poder escribir el estado en pantalla.

#### Scenario: Volver a la pestaña

- GIVEN la home abierta y la pestaña en segundo plano
- WHEN el socio vuelve a la pestaña
- THEN se hace una consulta nueva

#### Scenario: Respuesta vieja

- GIVEN dos consultas superpuestas
- WHEN responde primero la más vieja y después la más nueva
- THEN la tarjeta muestra el resultado de la más nueva

#### Scenario: Volver de entrenar

- GIVEN el socio cerró su sesión de entrenamiento
- WHEN vuelve a la home
- THEN el estado de sesión se actualiza y la tarjeta vuelve a evaluarse

### Requirement: Sin pantallas de carga nuevas

La tarjeta **MUST NOT** introducir una pantalla de carga ni bloquear la home: mientras consulta por primera
vez **MUST** reservar su espacio sin mostrar texto de "cargando" (o no dibujarse, según el diseño), y en las
recargas posteriores **MUST** conservar el último estado conocido sin parpadear
(`odd/tasks/socio-sin-pantallas-de-carga.md`). El resto de la home (cabecera, `SesionHero`, historial) **MUST**
seguir operativo ante cualquier estado de la tarjeta.

#### Scenario: La API tarda

- GIVEN una API lenta (por ejemplo con base remota, D-110)
- WHEN el socio abre `/home-socio`
- THEN la cabecera, el recorrido de la rutina y el historial se ven al instante
- AND la tarjeta no reemplaza la pantalla por un cartel de carga

### Requirement: Tema y tokens

La tarjeta **MUST** usar solo los tokens del design system (`text-ink`, `text-ink-muted`, `bg-surface`,
`border-border`, `text-brand`, etc., como `src/components/home-socio/sesion-hero.tsx`) y **MUST NOT** usar
colores fijos ni variantes `dark:`. **MUST** funcionar en claro y en oscuro sin cambios de código
(`odd/tasks/tema-claro-oscuro.md`).

#### Scenario: Modo oscuro

- GIVEN el tema oscuro activo
- WHEN se renderiza la tarjeta
- THEN textos, bordes y superficies salen de los tokens y se leen con contraste

### Requirement: Solo lectura del backend

La UI **MUST** consumir únicamente `GET /api/asignaciones/sugerencia` y `POST /api/asignaciones/decidir` con
los contratos existentes. **MUST NOT** requerir cambios en `src/api/asignaciones.ts`, en el motor, en la
orquestación, en la tabla de asignaciones ni en `src/lib/route-error-mapper.ts`.

#### Scenario: Contrato estable

- GIVEN el backend actual
- WHEN se implementa la UI
- THEN no hay diff en `src/api/asignaciones.ts` ni en `src/domains/asignacion/`

## Acceptance Criteria

- **AC-541**: La tarjeta se renderiza solo en `/home-socio`, con datos cargados, `rutinaActiva !== null` y `sesionEnProgreso === false`; en ese caso hace exactamente una consulta al montar.
- **AC-542**: Con `sesionEnProgreso === true` no se dibuja la tarjeta, no se consulta la API y no existe ningún botón "Ir ahora".
- **AC-543**: Sin rutina activa no se dibuja la tarjeta ni se consulta la API; para roles distintos de SOCIO la página redirige antes de renderizar.
- **AC-544**: Los estados `libre` y `enEspera` muestran el texto exacto de la tabla, con los minutos calculados con `Math.ceil(esperaSegundos / 60)` y "menos de 1 min" cuando corresponde.
- **AC-545**: `sugerencia === null` con `siguienteEnOrden !== null` muestra el estado informativo sin "Ir ahora" ni "Esperar".
- **AC-546**: `sugerencia === null` con `siguienteEnOrden === null` muestra el mensaje neutro único, sin enumerar causas.
- **AC-547**: Un 409 `SIN_SUGERENCIA_VIGENTE` muestra "La reserva venció. Volvemos a consultar." y dispara una consulta nueva.
- **AC-548**: Un 5xx o un fallo de red muestra el estado de error con "Reintentar" y no afecta al resto de la home.
- **AC-549**: "Ir ahora" envía `{ accion: "ACEPTAR" }` y "Esperar" envía `{ accion: "ESPERAR" }`, sin otros campos; con el `POST` en vuelo ambos botones quedan deshabilitados.
- **AC-550**: Tras `ACEPTAR` 200 la tarjeta muestra el estado `aceptada` y "Empezar entrenamiento" abre `EjecucionRutina` por el mecanismo existente (`onSeguirRutina`).
- **AC-551**: La consulta se repite al volver a la pestaña, tras cada acción y al cerrar la ejecución; nunca por intervalo (sin polling).
- **AC-552**: La sugerencia no se cachea en `src/lib/cache-cliente.ts` y una respuesta vieja no sobrescribe a la más nueva.
- **AC-553**: La tarjeta no introduce pantalla de carga ni bloquea la home, y conserva el último estado durante las recargas.
- **AC-554**: La tarjeta usa solo tokens del tema, funciona en claro y oscuro, y no usa colores fijos ni `dark:`.
- **AC-555**: La tarjeta anuncia cambios con `aria-live="polite"`, es operable por teclado y no depende solo del color; nombres de ejercicio y máquina en texto (con "tu máquina" si `maquinaNombre` es `null`).
- **AC-556**: No hay cambios en `src/api/asignaciones.ts`, `src/domains/asignacion/` ni `src/lib/route-error-mapper.ts`.

## Trazabilidad

| Requirement | Escenarios | AC |
|---|---|---|
| Visibilidad | sin sesión, con sesión, sin rutina, otro rol | AC-541, AC-542, AC-543 |
| Estados | espera 0, 90 s, sin reserva, ambos null, 409, 500, máquina null | AC-544, AC-545, AC-546, AC-547, AC-548, AC-555 |
| Acciones | aceptar, empezar, esperar, doble toque | AC-549, AC-550 |
| Refresco | volver a la pestaña, respuesta vieja, volver de entrenar | AC-551, AC-552 |
| Sin pantallas de carga | API lenta | AC-553 |
| Tema | modo oscuro | AC-554 |
| Solo lectura | contrato estable | AC-556 |

## Fuera de alcance

- S4: cualquier indicación de la sugerencia **dentro** de `EjecucionRutina` (D-112).
- Vista de instructor/administrador (D-115, P-61).
- Cambios al contrato, al motor, a la orquestación o a la tabla.
- Reasignación por instructor y simulación de la tesis.

## Contrato de datos (solo lectura)

| Dato | Origen | Uso en la UI |
|---|---|---|
| `sugerencia.ejercicioNombre` | `SugerenciaDTO` (`src/api/asignaciones.ts:25`) | texto del estado `libre` / `enEspera` / `aceptada` |
| `sugerencia.maquinaNombre \| null` | ídem | nombre de la máquina o "tu máquina" |
| `sugerencia.esperaSegundos` | ídem | minutos estimados |
| `sugerencia.venceEn` | ídem | no se muestra; solo justifica no cachear |
| `siguienteEnOrden.ejercicioNombre` | `SiguienteDTO` (`src/api/asignaciones.ts:37`) | estado `sinReserva` |
| `sesionEnProgreso` | `HomeSocioViewModel` (`src/api/home-socio.ts:130`) | condición de visibilidad |
| `rutinaActiva` | `HomeSocioViewModel` | condición de visibilidad |

## Numeración

- Decisiones: **D-118+** (última registrada D-117).
- Tareas: **T-057+** (última registrada T-056g).
- Pendientes: sin cambios.
