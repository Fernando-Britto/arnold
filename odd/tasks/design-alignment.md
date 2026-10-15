# Alineación de diseño con OpenPencil

**Feature**: `design-alignment` · **Rama**: `dev` · **Modo**: Strict TDD
**Fuente de verdad**: `openspec/Ejercicios.fig` (OpenPencil) · **Inicio**: 2026-10-13

## Objetivo

Que **todas** las pantallas usen el mismo sistema visual que los mockups: misma tipografía, colores, íconos y **posición** de los elementos. Las tablas hoy no siguen el diseño y las acciones (Buscar/Modificar/Eliminar) están dentro de la tabla; tienen que ir **arriba a la derecha** (ActionBar). Lo que el sistema todavía no tiene se muestra como **"Trabajando en esto"** (espacio en blanco), no se inventa.

## Design tokens (extraídos del .fig)

**Colores**
| Token | Hex | Uso |
|---|---|---|
| brand | `#FC4C02` | acciones primarias, acentos, fila seleccionada, valores destacados |
| brand-text | `#C13D00` | texto de acción sobre blanco (Modificar/Eliminar) — *el mockup usa `#FC4C02` en algunos headers y `#C13D00` en otros; usar `#FC4C02`* |
| text-primary | `#18181B` | títulos, labels fuertes |
| text-secondary | `#71717A` | labels de tabla, texto secundario |
| text-tertiary | `#3D4454` | descripciones |
| text-disabled | `#A1A5B0` | deshabilitado |
| surface | `#FFFFFF` | cards/paneles |
| surface-subtle | `#F4F4F5` | header de tabla, fondos sutiles |
| border | `#E4E4E7` | bordes/divisores (botones: `#E5E5E5`) |
| success-bg | `#DEF7EC` | fondo del badge de estado OK |
| status-success | `#14B452` · warning `#B94A0E` · error `#DC2626` | estados |

**Tipografía** (Inter): H1 24/700 · H2 20/700 · H3 17/700 · Body-Strong 14/700 · Body 14/500 · Body-Secondary 14/400 · Small 13/400 · Label 12/400 · Uppercase-Label 11/700. Cabecera de tabla **13/700**.

**Espaciado**: base 8px (4, 8, 12, 16, 20, 24, 32, 48). **Radio**: paneles/cards/botones/inputs **8px** (los frames usan `rounded=8`); header de tabla redondeado arriba 8.

## Chrome (idéntico en todas las pantallas)

- **TopNav** (h80, blanco, drop-shadow, padding 0/48): logo `ARNOLD` (`#18181B` 20/700) + `GYM` (`#FC4C02` 20/700) · NavLinks (gap 32, 15/500 `#71717A`) · avatar 32×32 `#F4F4F5` rounded.
- **ActionBar** (h72, padding 0/48, `justify-between`): breadcrumb izquierda (`Gestión` `#999999` 14 + chevron 14 + `<Sección>` `#333333` 14/500) · acciones derecha (gap 16).
- **MainContent** (padding 0/48/48/48, gap 24): `FormPanel` (380px) + `ListPanel` (grow).

## Botones de acción (ActionBar)

Blanco, borde `#E5E5E5` 1px, radio 8, padding 8/16, gap 8, ícono lucide 16px, label 14/500.
- **Buscar** — ícono `search`, texto `#333333`.
- **Modificar** — ícono `edit-3`, texto `#FC4C02`.
- **Eliminar** — ícono `trash-2`, texto `#FC4C02`.
- Deshabilitados cuando no hay fila seleccionada (opacity + `cursor-not-allowed`).

## Tabla (ListPanel)

- **TableHeader**: flex row, h52, `px24`, gap16, `bg #F4F4F5`, borde `#E4E4E7`, esquinas superiores 8. Labels `13/700 #71717A`.
- **Filas**: h56, borde inferior `#E4E4E7`, `px24`, items-center. Celdas `14/400`: primaria `#333333`, secundaria `#71717A`.
- **Fila seleccionada**: fondo `#FC4C02`, texto blanco, + fila de **detalle** debajo (`Row_Detail`: padding 0/48/24/48, gap16) con los campos extra y las acciones contextuales.
- **Badge de estado**: h23, `bg #DEF7EC`, radio, padding 4/10, texto de estado.

**Columnas por pantalla**
| Pantalla | Columnas |
|---|---|
| Ejercicios | ID (100) · Nombre (grow) · Grupo (118) · Estado (102) |
| Rutinas | ID (80) · Nombre (grow) · Ejercicios (100) · Frec/Sem (100) · Nivel (120) · Estado (120) |
| Clientes | ID (80) · Nombre (grow) · DNI (120) · Membresía (180) · Estado de cuota (140) |
| Membresías | ID (100) · Nombre (grow) · Precio (120) · Periodicidad (150) · Estado (100) |

## Interacción (cambio de funcionalidad)

1. La **fila se selecciona** al hacer click (una sola a la vez).
2. **Modificar** edita la fila seleccionada (carga el form). **Eliminar** borra la seleccionada (con confirmación). Ambos deshabilitados sin selección.
3. **Buscar** abre/enfoca el campo de búsqueda (ya no vive dentro de la tabla).
4. Los botones **ya no van dentro de cada fila**; se quitan de la tabla.

## "Trabajando en esto"

Componente `PlaceholderPanel` reutilizable: recuadro con el estilo de panel, ícono y el texto **"Trabajando en esto"**, para funcionalidades que el sistema todavía no tiene (ej. secciones de Home_Socio sin datos, botones del Home_Interno sin pantalla). Nunca se inventa contenido.

## Alcance

- **Fase 1** (esta): UI kit compartido (`src/components/ui/`) + refactor de las **4 pantallas CRUD** (tabla + acciones en ActionBar + selección de fila).
- **Fase 2**: Home_Interno y Home_Socio consistentes + `PlaceholderPanel` donde falta.
- **Fase 3**: pantallas nuevas (pagos, acceso, cierre, puerta, secciones) alineadas al kit.

## Criterios de aceptación

- Las 4 tablas igualan el mockup (header, filas, badge, columnas, anchos relativos).
- Las acciones están en el ActionBar arriba a la derecha, con los íconos y colores exactos.
- Mismo chrome en todas las pantallas (TopNav + ActionBar + MainContent).
- Tests verdes; `tsc` limpio; sin errores de lint nuevos.

---

**Actualización 2026-10-15** (ver `odd/tasks/paridad-visual-crud.md`): el AC de **anchos
relativos** quedó **revisado**. Concentrar todo el sobrante en la columna `Nombre` dejaba
~720px de hueco a 1920 y ~1360px a 2560; ahora `cellStyle` (en `src/components/ui/table.tsx`)
reparte el sobrante entre todas las columnas en proporción a su medida — se prioriza la
densidad de la tabla por encima de la fidelidad literal al mockup. Además la tipografía es
**Inter** de verdad (el `body` pisaba `--font-sans` con Arial). El resto de este documento
sigue vigente.
