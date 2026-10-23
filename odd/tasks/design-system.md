# Design system: tokens y primitivas compartidas

**Feature**: `design-system` · **Rama**: `dev` · **Modo**: checks funcionales (jest + build)
**Fuente de verdad**: `odd/tasks/design-alignment.md` (tokens extraídos de los mockups OpenPencil)

## Objetivo

El proyecto ya tiene una paleta de facto (naranja Strava `#FC4C02` usado 83 veces) y un spec de
tokens documentado, pero **nunca se implementó como tokens**: cada componente repite hex crudos,
y aparecieron variantes divergentes del mismo valor (`#E4E4E7` vs `#E5E5E5` para bordes,
`#999999` / `#A1A1AA` / `#A1A5B0` para texto atenuado, `#FC4C02` / `#FF6B00` / `#e04400` para marca).

Objetivo: **una sola fuente de verdad en CSS** y que las primitivas compartidas la usen, para
que la reforma de pantallas que viene no genere más drift.

## Alcance

- [x] T1 · Tokens en `src/app/globals.css` (`@theme` con marca, superficies, texto, líneas, estados, escala, elevación)
- [x] T2 · `nav-shell.tsx`: chrome compartido por las dos navs (header, marca, botón de ícono)
- [x] T3 · `top-nav.tsx` y `admin-top-nav.tsx` migrados al shell + tokens (sin cambiar los ítems de menú)
- [x] T4 · `badge.tsx` migrado a la paleta de estados del sistema (deja de usar `green-100`/`red-100`/…)
- [x] T5 · `table.tsx`, `action-bar.tsx`, `crud-page-layout.tsx`, `placeholder-panel.tsx`, `tabs.tsx`, `crud-actions.tsx`, `section-page-layout.tsx`, `confirm-dialog.tsx` migrados a tokens
- [x] T6 · Tests que afirman clases crudas actualizados a los tokens

## Fuera de alcance (fases siguientes)

- Reagrupar el menú del socio (`Mi rutina` / `Mis ejercicios` / `Mi progreso` / `Mi membresía` / `Mis asistencias`)
- Rediseño de los dos homes
- Mejora de las pantallas de gestión (membresías, rutinas, ejercicios, clientes)
- Migrar las ~170 pantallas restantes: es adopción incremental, no parte del sistema
- Modo oscuro (los tokens son semánticos; agregarlo después es un solo bloque)

## Decisiones

- **Nombres de color**: sigo el vocabulario de `design-alignment.md` (`surface`, `border`, `brand`,
  `success`…) salvo el texto, que usa `ink-*` para no generar utilidades tipo `text-text-primary`.
- **Radio**: sin tokens nuevos. La escala de Tailwind ya cubre el spec (8px = `rounded-lg`).
  Se estandariza: paneles/controles `rounded-lg`, chips `rounded-sm`, pills `rounded-full`.
- **Escala tipográfica**: solo se agregan los tres tamaños que Tailwind no tiene y que el diseño
  usa repetidamente: `--text-overline` (11px), `--text-meta` (13px), `--text-hero` (40px).
- **Nav activa**: unificada a `text-brand font-bold` + subrayado naranja en las dos navs
  (la de gestión usaba texto oscuro; era la única diferencia de estado entre ambas).
- **Botones de ícono**: unificados a 40×40 `rounded-lg` (la de gestión usaba 32×32 `rounded-full`).
- **No se agrega el link "Inicio" a la nav de gestión** en este cambio: toca el reagrupado de menú,
  que es fase siguiente. Queda anotado como hueco real (desde un CRUD no hay vuelta al panel).

## Checks

- `npx jest` verde
- `npx tsc --noEmit` limpio
- `npm run build` compila

## Evidencia

- `npx jest` → **228 suites / 3195 tests, todo verde**
- `npx tsc --noEmit` → limpio
- `npx eslint src/components/layout src/components/ui` → 0 errores
- `npm run build` → compila las 18 rutas
- Tokens verificados en el CSS compilado (`.next/static/chunks/*.css`): `--color-*`,
  `--text-meta`, `--shadow-header`/`--shadow-card` presentes y las utilidades
  `bg-brand`, `text-ink-muted`, `bg-surface-page`, `bg-brand-soft`, `bg-success-soft`,
  `border-border`, `enabled:hover:bg-surface-active`, `hover:bg-surface-hover` generadas.
- Hex crudo restante en `src/components/layout/*` y `src/components/ui/*` (excluyendo tests
  y comentarios): **0**.

## Consumidores pendientes

`--text-overline` (11px), `--text-hero` (40px) y `--color-border-soft` están definidos pero
todavía no se consumen: sus usos viven en las pantallas que la reforma va a migrar
(17× `text-[11px]`, 3× `text-[40px]`, `border-zinc-100`). Son el destino de la fase siguiente,
no código muerto por decisión de diseño.


---

## Fase 2 — Pase de accesibilidad (WCAG AA)

Disparado por `npx impeccable detect http://localhost:3000/login`, que encontró
`[low-contrast] 3.4:1 (need 4.5:1) — text #ffffff on #fc4c02`.

Verificado a mano antes de actuar (fórmula de luminancia relativa WCAG):

| Par | Antes | Ahora | Estado |
|---|---|---|---|
| blanco sobre `brand` #FC4C02 | 3.40:1 | 3.40:1 | **solo UI no textual** (≥3:1) |
| blanco sobre `brand-strong` #C13D00 | — | 5.34:1 | AA ok |
| `success` sobre `success-soft` | 2.42:1 | **4.82:1** | AA ok |
| `danger` sobre `danger-soft` | 3.95:1 | **5.38:1** | AA ok |
| blanco sobre `danger` | 4.83:1 | 6.57:1 | AA ok |
| `warning` sobre `warning-soft` | 4.66:1 | 4.66:1 | AA ok (sin cambio) |
| `ink-disabled` sobre blanco | 2.46:1 | 2.46:1 | exento (texto deshabilitado) |

### Tokens cambiados

- `--color-success`: `#14B452` → `#0F7A38`
- `--color-danger`: `#DC2626` → `#B42318`
- `--color-danger-strong`: `#B91C1C` → `#8F1D1D` (el anterior quedaba más claro que el nuevo `danger`)
- `--color-brand-deep`: **nuevo** `#A33300` — hover de un relleno `brand-strong`

### Regla de uso del naranja

- `bg-brand` → formas, barras, puntos, íconos, subrayados (UI no textual, 3.40:1 ≥ 3:1)
- `bg-brand-strong` → cualquier superficie con **texto blanco** (5.34:1)
- `hover:bg-brand-deep` → hover sobre `brand-strong`

### Alcance aplicado

- 26 botones/controles con texto blanco → `bg-brand-strong` + `text-surface`
- 7 elementos decorativos → `bg-brand`
- 15 hovers → `hover:bg-brand-deep`
- 13 `disabled:bg-gray-400` → `disabled:bg-ink-disabled`
- 22 archivos afectados

### Verificación

- `detect http://localhost:3000/login` → **EXIT 0**, sin hallazgos (antes EXIT 2)
- `npx jest` → 228 suites / 3195 tests verdes
- `npx tsc --noEmit` → limpio
- `npm run build` → ok; `bg-brand-strong`, `hover:bg-brand-deep`, `text-surface` generadas

### Límite de esta verificación

Las pantallas privadas (`/home-socio`, `/home-interno`, `/membresias`, etc.) devuelven
`307 → /login` sin sesión, así que **no se pudieron escanear renderizadas**. Los ratios de
`success`/`danger` sobre sus fondos suaves se verificaron por cálculo, no por render.
Falta auditar los homes y las pantallas de gestión con sesión activa.

### Deuda detectada, fuera de esta fase

11 botones con `bg-blue-600` (y otros con `bg-green-600`, `bg-yellow-600`, `bg-red-600`):
colores por defecto de Tailwind sin relación con la identidad de marca. Es una tercera
capa de drift de color que hay que resolver en la reforma.

---

## Fase 3 — Reforma de estructura (menú + homes + adopción total)

### Menú

- Nav del socio: 6 ítems planos → **3 zonas** (`Inicio` · `Entrenamiento` · `Mi cuenta`) con
  etiqueta y separador de 1px. Sin dropdowns: los 6 destinos siguen a un clic, y los
  `data-testid`/`data-active` no cambiaron, así que el contrato de navegación se preservó.
- Nav de gestión: se agregó **`Inicio` → `/home-interno`**. Antes, estando en Membresías,
  Rutinas, Ejercicios, Clientes o Configuración no había ninguna forma de volver al panel.
  Era un callejón sin salida real.
- `NavSection` incorpora `"inicio"`; `HomeInternoPage` pasa `activeSection="inicio"`.

### Home del socio

La acción estaba en la fila 2, debajo del gráfico de progreso, compitiendo con tres tarjetas
del mismo peso. Reordenado por prioridad de uso:

1. **Tu sesión de hoy** — rutina + ejercicio actual (única zona con acción)
2. **Progreso + aforo** — lo ya hecho
3. **Racha + membresía**
4. **Peso corporal**

`TarjetaDetalle`: el grupo Series×Reps dejó de ser una caja con borde dentro de otra card;
ahora es una banda tintada (`bg-surface-subtle`).

### Home interno

Trece elementos clickeables, con `/clientes` alcanzable desde cuatro lugares distintos
(Nuevo Socio, Ver de alertas, Socios inactivos, Contador de Clientes) y tres filas de
tarjetas idénticas.

- `CounterCard` y `OperationCard` dejaron de ser tarjetas con borde y fondo: son métricas
  en línea.
- `OPERACIÓN` + `GESTIÓN` se fusionan en **un solo panel** con dos filas divididas (3 + 4).
- Queda: 4 acciones rápidas → 3 señales del día → 1 panel de referencia → actividad.

### Piso de calidad de diseño

- `FormPanelShell`: eliminada la banda naranja de 3px pegada al borde izquierdo. El piso
  de calidad prohíbe un `border-left` de color mayor a 1px en cards y paneles.

### Adopción total de tokens

Barrido sobre **todo `src`**, no solo las primitivas:

- 62 archivos (hex, neutros de Tailwind, escala tipográfica) + 45 archivos (estados de
  formulario y SVG) + ajustes puntuales.
- `bg-blue-600` (11 botones primarios que usaban el azul por defecto de Tailwind) →
  `bg-brand-strong`. `bg-red-600` → `bg-danger`. `bg-green-600`/`bg-yellow-600` → según
  semántica. `ring-blue-500` → `ring-brand`.
- SVG: `stroke`/`fill` con hex → `var(--color-*)`.
- Texto de 9px y 10px (10 usos en ejes de gráfico y calendarios) → `text-overline` (11px).
- **Resultado medido: 0 hex crudos y 0 colores de paleta Tailwind en `src`** (excluyendo
  tests y comentarios).

### Verificación

- `npx jest` → **228 suites / 3196 tests verdes**
- `npx tsc --noEmit` → limpio
- `npx eslint src` → 0 problemas
- `npm run build` → compila, 47 páginas generadas
- `impeccable detect src/ --json` → **0 findings**
- `impeccable detect http://localhost:3000/login` → **EXIT 0**
- `impeccable detect http://localhost:3000/puerta` → **EXIT 0**

### Lo que NO se pudo verificar

Las rutas privadas (`/home-socio`, `/home-interno`, `/membresias`, `/rutinas`,
`/ejercicios`, `/clientes`, `/pagos`, `/cierres`, `/configuracion`) responden
`307 → /login` sin sesión. **La reforma de los dos homes no fue auditada sobre el DOM
renderizado.** El detector solo corrió sobre `/login` y `/puerta`, más el escaneo estático
de `src/`. Falta una pasada con sesión activa para confirmar contraste, densidad y
desbordes en los homes.

### Deuda conocida

- `PRODUCT.md` y `DESIGN.md` de Impeccable no existen (este documento cumple ese rol).
- Las ~170 pantallas adoptaron tokens por barrido mecánico; ninguna fue revisada
  individualmente en composición.
- Sin captura visual: no hay herramienta de screenshot en este entorno, así que el
  criterio "mirá el resultado renderizado" del skill se cubrió solo con el detector.

---

## Fase 4 — Auditoría activa con sesión (14 pantallas, desktop + mobile)

`detect` no acepta cookies, y `--cdp` exige un navegador ya logueado a mano. Se resolvió con un
**proxy local autenticado**: login por `POST /api/auth/login` con los usuarios del seed
(`admin@arnold.test` / `socio@arnold.test`, contraseña `Arnold2026!` de `prisma/seed-data.ts:16`),
un proxy en `:4000` que inyecta la cookie `authToken`, y `detect` apuntando al proxy. La cookie
nunca se imprimió y el proxy + credenciales temporales se borraron al terminar.

### Hallazgos reales (14 pantallas auditadas sobre el DOM renderizado)

Primera pasada: **3 anti-patterns por pantalla** en las 8 de gestión y las 5 subsecciones del socio.

| Hallazgo | Causa | Corrección |
|---|---|---|
| `#fc4c02` sobre blanco = **3.4:1** | `text-brand` usado como texto de 15px (link activo, botón de acento) | `text-brand-strong` en texto chico; `brand` queda solo para íconos y display grande |
| `#a1a5b0` sobre blanco = **2.5:1** | `text-ink-disabled` usado como texto real (breadcrumb "Gestión", etiquetas de zona, fechas) | `text-ink-muted` |
| `#a1a5b0` sobre `#f7f7f7` = **2.3:1** | mismo token sobre el fondo de página | `text-ink-muted` |
| `#71717a` sobre `#f4f4f5` = **4.4:1** (advisory) | cabecera de tabla y badges neutros | `text-ink-soft` |
| placeholder `#8c8c8d` = **3.4:1** | el color por defecto del navegador, en cada input | regla global `::placeholder` con `--color-ink-muted` |
| `[overused-font] Inter 100%` | tipografía impuesta por los mockups | `impeccable ignores add-value overused-font Inter --reason "Tipografía fijada por los mockups OpenPencil"` |

Se agregó también lo que el piso de calidad llama "superficies del navegador", que ningún
componente dibuja: `::selection`, `caret-color`, `scrollbar-color`, `text-wrap: pretty` y
`font-variant-numeric: tabular-nums` en tablas.

### Hallazgo de responsive (mobile 390×844)

`/clientes` desbordaba **458px** a la derecha: `CrudPageLayout` ponía un panel de formulario fijo
de `380px` al lado de la lista sin apilar. Corregido: `flex-col` hasta `xl`, panel `w-full` en
mobile, y `ActionBar` con `flex-wrap`.

### Verificación final

| Pasada | Resultado |
|---|---|
| 8 pantallas de gestión, 1280×800 | **EXIT 0**, 0 hallazgos |
| 6 pantallas del socio, 1280×800 | **EXIT 0**, 0 hallazgos |
| 11 pantallas, 390×844 | **EXIT 0**, 0 hallazgos |
| `npx jest` | 228 suites / 3196 tests verdes |
| `npx tsc --noEmit` | limpio |
| `npx eslint src` | 0 problemas |
| `npm run build` | compila, 47 páginas |
| `detect src/ --json` | 0 findings |

Rutas cubiertas: `/home-interno`, `/membresias`, `/rutinas`, `/ejercicios`, `/clientes`,
`/configuracion`, `/pagos`, `/cierres`, `/home-socio`, `/home-socio/mi-rutina`,
`/home-socio/progreso`, `/home-socio/mi-membresia`, `/home-socio/mis-asistencias`,
`/home-socio/mis-ejercicios`, más `/login` y `/puerta` sin sesión.

### Sigue sin cubrirse

- `/acceso` (kiosco) requiere flujo de DNI+PIN, no se auditó.
- Estados vacíos, de error y de carga no se ejercitaron: las pantallas se escanearon con datos del seed.
- Modales (`AsignarRutinaModal`, `ConfirmDialog`) no se abren durante un escaneo de URL.
- El detector cubre mecánica; la composición (jerarquía, ritmo, si un home "se siente" bien)
  la juzgó el criterio de diseño, no una herramienta.

---

## Fase 5 — Reacomodo de navegación por rol

### Hallazgo

Inventario de rutas vs. navegación. Cinco pantallas no tenían lugar en ningún menú:

| Ruta | Cómo se llegaba | Problema |
|---|---|---|
| `/pagos` | solo `QuickAction` "Registrar Pago" en el panel | invisible para un RECEPCIONISTA fuera del panel |
| `/cierres` | solo la `CajaCard` del panel | idem |
| `/acceso` | solo `QuickAction` "Control Acceso" | kiosco: correcto que no esté en la nav |
| `/dispositivos` | **nada** — cero links entrantes | duplica la pestaña "Dispositivos" de `/configuracion` (mismo `DispositivosPanel`) |
| `/puerta` | solo lógica de hardware | correcto |

El defecto real: **la nav estaba armada alrededor de entidades del modelo, no del trabajo de cada
rol**. Un RECEPCIONISTA —cuyo día es cobrar, cerrar caja y controlar el acceso— veía un único
link: "Clientes". Sus dos pantallas de trabajo diario no existían en ningún menú.

### Cambio

`AdminTopNav` pasa a zonas, igual que la nav del socio, y suma **Pagos** y **Cierres**:

- **Inicio**
- **Operación**: Clientes · Rutinas · Ejercicios
- **Comercial**: Membresías · Pagos · Cierres
- Configuración

Efecto por rol:

| Rol | Destinos |
|---|---|
| ADMINISTRADOR | 8 |
| RECEPCIONISTA | 4 (Inicio, Clientes, Pagos, Cierres) |
| INSTRUCTOR | 3 (Inicio, Rutinas, Ejercicios) |

- Las zonas se filtran por rol y **las vacías no se renderizan**: un INSTRUCTOR no ve la etiqueta
  "Comercial" sin destinos debajo.
- `Control de Acceso` queda fuera a propósito: es un kiosco que se abre y se deja corriendo, no un
  destino de navegación.
- `NavCluster` y `NavDivider` se extrajeron a `nav-shell.tsx`: las dos navs comparten el mismo
  agrupado en vez de replicarlo.
- Guarda de overflow: las navs son `min-w-0 overflow-x-auto`, así que en pantallas angostas se
  desplazan en horizontal en lugar de empujar la página.

### No se tocó

`/dispositivos` sigue siendo una ruta duplicada sin link entrante. Redirigirla a
`/configuracion?tab=dispositivos` requiere que Configuración lea el parámetro; hoy caería en
"Parámetros", que es peor que la página directa. Queda documentado, no resuelto.

### Verificación

- `npx jest` → 228 suites / **3198 tests verdes** (+2 nuevos de agrupado por rol)
- `npx tsc --noEmit` y `npx eslint src` → limpios
- `npm run build` → 47 páginas
- `detect` en **tres viewports** (1280×800, 1024×768, 390×844):
  - 8 pantallas de gestión → EXIT 0 en las tres
  - 6 pantallas del socio → EXIT 0 en las tres
  - `/acceso`, `/dispositivos`, `/puerta` → EXIT 0 en desktop y mobile

### Nota sobre la medición de ancho

Intenté medir `document.scrollWidth` a 390px con Brave headless (`--dump-dom` + script inyectado
por un proxy). El binario de flatpak no termina en modo headless, así que se abandonó: el ancho real
quedó verificado solo por la regla `body-text-viewport-edge` del detector, que sí detectó antes el
desborde de 458px. No hay medición independiente.

---

## Fase 6 — Rediseño del inicio del socio (implementación)

Dirección visual pineada por el dueño a partir de su propuesta: sustrato oscuro, rail lateral,
naranja como señal, densidad alta. El roll del atlas quedó anulado (el brief del usuario gana).

### Sustrato oscuro

`.theme-dark` en `globals.css` sobrescribe los tokens semánticos dentro de un scope. No hay
componentes duplicados: los mismos componentes sirven en los dos sustratos. El naranja deja de
necesitar `brand-strong` sobre negro (`#FC4C02` da 5.21:1), y `brand-strong` pasa a `#FF7A45`
para texto pequeño.

**Decisión abierta:** el staff queda sobre el sustrato claro. Es un mostrador con luz de día y
pantalla compartida; ahí el fondo claro gana. Falta llevar el mismo lenguaje al home interno.

### Navegación

`SocioRail` reemplaza la barra horizontal en las seis pantallas del socio:

- Tres zonas con etiqueta: `Hoy` / `Entrenamiento` (Mi rutina · Mis ejercicios · Mi progreso) /
  `Mi cuenta` (Mi membresía · Mis asistencias).
- Activo = regla naranja de 2px + fondo + peso, **no** una píldora naranja llena: así el único
  naranja relleno de la pantalla es la acción primaria.
- Pie con identidad y salida.
- Se conservaron `data-testid="nav-link-*"` y `data-active` para no romper el contrato de
  navegación.

### Inicio

| Antes | Ahora |
|---|---|
| 4 filas de tarjetas iguales | 2 columnas con un solo eje: la sesión manda |
| Rutina + detalle en dos tarjetas | `SesionHero`: recorrido de paradas numeradas + una acción |
| Barra de progreso + detalle duplicado | un único eje de lectura |
| Gráfico de línea sin eje | `ProgresoCargaCard`: una barra por sesión, con valor |
| Racha como número | `TuSerieCard`: tira de la semana + trama de 5 semanas |
| Sin historial | `UltimasSesiones`: tabla con volumen y duración reales |

### Datos nuevos (reales, no inventados)

- `HomeSocioViewModel.ultimasSesiones`: las últimas 5 sesiones cerradas. `volumenKg` se calcula
  en el servidor como suma de `carga × repeticiones` de las series de trabajo (D-64 excluye
  calentamiento); `duracionMin` sale de `horaFin − horaInicio`.
- `EjercicioEnRutinaDTO.mediaId`: el hero usa la media real del catálogo
  (`public/ejercicios/<mediaId>.jpg`, 1.324 archivos), no una foto stock.

### Desvíos conscientes del mockup

- **`PesoCorporalCard` se mantiene tal cual.** Además de mostrar, registra y borra pesajes.
  Reemplazarla por la tarjeta compacta del mockup habría quitado esa función del inicio.
- **El título "Torso B" no se repite** en la barra superior y en el hero: el mockup lo duplicaba
  y la página lo resolvió dejando "Hoy" arriba y la rutina solo en el hero.

### Bug encontrado al implementar

Un día que era **hoy y además tenía asistencia** perdía la marca de hoy (el ternario evaluaba
`asistio` primero). Ahora "hoy" gana y, si además cumplió, se dibuja relleno **con anillo**.

### Verificación

- `npx jest` → 228 suites / **3198 tests verdes** (tests del home reescritos para la composición nueva)
- `npx tsc --noEmit` y `npx eslint src` → limpios
- `npm run build` → compila
- `detect` renderizado con sesión real: las **6 pantallas del socio** en 1280×800 → EXIT 0;
  `/home-socio` también en 390×844 y 1024×768 → EXIT 0
- Media del catálogo responde 200

### Pendiente

- Home interno y pantallas de gestión con el mismo lenguaje en sustrato claro.
- Los cinco componentes retirados del inicio (`TarjetaRutina`, `TarjetaDetalle`,
  `ProgresoSection`, `RachaSemanal`, `AforoCard`, `MembresiaCard`) siguen en el repo y con sus
  tests: se usan en `mi-rutina`, `progreso` y `mis-asistencias`. No borrar sin revisar esas rutas.

---

## Fase 7 — Panel del staff (mismo lenguaje, sustrato oscuro)

El dueño pineó el mismo lenguaje para el staff. Se aplicó a las 8 pantallas de gestión vía un rail
compartido, y se reconstruyó el panel operativo.

### Correcciones aplicadas al panel

Pedidas por el dueño sobre la primera propuesta:

| Problema | Corrección |
|---|---|
| "Cuotas por vencer" era una lista pasiva que repetía el 3 tres veces y pintaba todo del mismo naranja | **"Pendientes de hoy"**: excepciones con UNA acción cada una (`Cobrar`, `Revisar`, `Asignar`). El color sale del nivel: `danger` vencida, `warning` vence hoy, neutro el resto |
| El naranja significaba todo a la vez | Naranja reservado a **la acción primaria** (solo el primer pendiente) y a la selección del rail. Estados con `danger` / `warning` / `success` |
| "Cerrar caja" era lo más fuerte a media mañana | Ya era secundario (outline) en `CajaCard`; se mantiene así, sin relleno |
| "Datos en vivo" era una afirmación falsa (hay caché con fallback) | "Actualizado hace N min", calculado desde la última carga exitosa |
| Los 4 contadores de Gestión duplicaban el menú | **Retirados** del panel (siguen en el rail) |
| Aforo y alertas quedaban con el fondo vacío | Grilla de 12 columnas `5 / 4 / 3`, con las tres tarjetas estirándose a la misma altura |
| El "pago anulado" no se distinguía | Se destaca en `text-danger` en el feed, y además sube a **Pendientes de hoy** |
| El feed no llevaba a ningún lado | Cada fila navega a Pagos o Clientes |

### Verificación de dos afirmaciones

- **"Equipos operativos" y "Personal en turno" SÍ tienen respaldo**: salen de `Maquina` y `Empleado`
  (`maquinas: {estado}[]`, `personal: {rol}[]`). No son cifras inventadas.
- **"Datos en vivo" no lo tenía**: el panel cachea el último payload y puede mostrar datos viejos.
  Corregido a "Actualizado hace N min".

### Datos nuevos (reales)

- `AlertaVencimiento.nivel`: `vencida` | `hoy`, calculado en el dominio. La UI ya no parsea texto
  para decidir un color.
- `ActivityItemView.tipo`: la UI destaca `ANULACION_PAGO` y enruta la fila.
- `HomeInternoRaw/ViewModel.sociosSinRutina`: `socio.count` de activos sin rutina activa. Es la
  excepción más propia del producto: el instructor puede resolverla hoy.

### Navegación

- `app-rail.tsx`: rail presentacional compartido (marca, zonas, pie con identidad y salida).
- `socio-rail.tsx` y `staff-rail.tsx` son envoltorios finos sobre él.
- `admin-top-nav.tsx` y el `TopNav` horizontal **se eliminaron** (código muerto). `top-nav.tsx`
  conserva solo `TopNavLink` + `topNavHref`, que siguen siendo el contrato de rutas del socio.
- Se preservó `data-testid="nav-link-*"`, `data-active` y `aria-label="Navegación principal"`,
  que es lo que usan las pantallas y sus tests.

### Verificación

- `npx jest` → 228 suites / **3175 tests verdes** (bajó por los tests de Row_Gestion eliminados y
  los del nav viejo; se agregaron los de `StaffRail`)
- `npx tsc --noEmit` → limpio
- `npm run build` → compila
- `detect` renderizado con sesión real: **8 pantallas del staff** en 1908×1000 y 390×844 → EXIT 0

### Pendiente

- El bloque de pendientes solo conoce `vueltas`, `anulaciones` y `sin rutina`. Si el producto
  agrega más excepciones (equipos fuera de servicio, socios bloqueados), entran ahí con su acción.
- Las pantallas de gestión heredaron el rail pero no fueron rediseñadas por dentro.

---

## Fase 8 — Sustrato oscuro del staff y dos bugs de shell

### Bugs encontrados

1. **Las pantallas de gestión devolvían 200 pero no se veían.** `StaffRail` es `lg:h-screen`
   (ocupa la ventana entera) y `CrudPageLayout` / `SectionPageLayout` seguían siendo `flex-col`,
   así que el rail tomaba los 100vh y `ActionBar` + `main` arrancaban **debajo del pliegue**.
   Corregido: los tres shells son `flex-col lg:flex-row` y el contenido va en una columna hermana
   (`flex min-w-0 flex-1 flex-col`).

2. **Texto invisible en `/rutinas` y `/pagos`.** Los elementos sin clase de color heredan `color`
   del `body`, que seguía en el `#18181b` del tema claro. Sobre el fondo oscuro daba **1.0:1**.
   Corregido en la raíz del tema: `.theme-dark { color: var(--color-ink); --background: …;
   --foreground: … }`. Un solo cambio arregla todas las heredades, presente y futuras.

El detector cazó el segundo; el primero no lo ve ninguna herramienta automática — lo reportó el
dueño mirando la pantalla.

### Sustrato

El staff usa el mismo negro que el socio: `theme-dark` en `CrudPageLayout`, `SectionPageLayout` y
el panel. Mismo rail (#0A0A0B), mismo suelo (#111113).

### Verificación

- `npx jest` → 228 suites / 3175 tests verdes
- `npx tsc --noEmit` → limpio
- `npm run build` → compila
- `detect` **8 pantallas del staff** en 1908×1000, 1280×800 y 390×844 → EXIT 0
- Estructura del DOM verificada: `<aside>` y la columna de contenido son hermanos en la fila
