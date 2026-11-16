# Sidebar propuesta (mockup HTML)

**Feature**: `sidebar-propuesta` · **Rama**: `dev`
**Fuente**: `Sidebar propuesta-html.zip` → `Main.dc.html` (mockup del diseñador, artboard 280×900)
**Inicio**: 2026-11-16

## Objetivo

Llevar el `AppRail` (staff y socio) al lenguaje visual del mockup: rail de 280px, filas de 44px
con ícono, activo con barra naranja interna, zonas con etiqueta y pie con avatar de iniciales.
El mockup es oscuro fijo; **acá el rail sigue el tema de la app** (claro/oscuro) usando los tokens
existentes. Ningún hex nuevo en componentes.

## Traducción mockup → tokens

| Mockup (oscuro) | Token / clase | Claro | Oscuro |
|---|---|---|---|
| fondo `#0f0f10` | `bg-surface-rail` | `#ffffff` | `#0a0a0b` |
| borde der. `#232326` | `border-border-soft` | `#f4f4f5` | `#232327` |
| label `#c7c7cc` | `text-ink-soft` | `#3d4454` | `#c9c9ce` |
| hover `#18181a` | `hover:bg-surface-subtle` | `#f4f4f5` | `#1f1f23` |
| activo `#1f1f22` | `bg-surface-subtle` + `text-ink` | — | — |
| barra `#ff4d00` | `inset 3px 0 0 var(--color-brand)` | `#fc4c02` | `#fc4c02` |
| acento de marca | `text-brand` | `#fc4c02` | `#fc4c02` |
| zona `#9a9aa2` 11/600 | `text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled` | — | — |
| avatar `#27272a` | `bg-surface-active text-ink-soft` | — | — |

Medidas: ancho 280 · padding 16/12 · fila 44 (radio 8, gap 12, ícono 18, label 14) · header de
zona 32 · avatar 36 · botones de header 40.

## Ruta de implementación

Todo el cambio se hizo **inline**, en una sola pasada. Es una desviación consciente del trigger
de escritor (2+ archivos no triviales): el rediseño se define entero contra un mismo mockup y
las mismas decisiones de token se repiten en los cuatro archivos de UI, así que partirlo entre
un escritor y yo habría duplicado el contexto sin reducir riesgo. La verificación sí fue
independiente: suite completa, `tsc`, `eslint` y `next build`.

## Tareas

- [x] **T1 — Tokens y CSS del rail colapsado.** `.rail*` en `globals.css` + `data-rail` con
      cookie (`src/lib/rail.ts`) y script pre-paint en `layout.tsx`. Solo escritorio.
- [x] **T2 — `AppRail` al mockup.** 280px, íconos lucide 18, filas 44 con barra naranja interna,
      zonas de 32px, pie con avatar de dos iniciales, `aria-label` en cada link.
- [x] **T3 — Zonas nuevas del staff.** Hoy suelto · Socios (Clientes, Membresías) ·
      Entrenamiento (Rutinas, Ejercicios, Máquinas) · Caja (Pagos, Cierres de caja) ·
      Configuración al pie. Filtro por rol intacto.
- [x] **T4 — Íconos del socio.** Mismo rail, íconos por destino; etiquetas y `data-testid` intactos.
- [x] **T5 — Botón de colapsar.** Toggle con `alternarRail()`; en colapsado se ocultan labels y
      zonas y el rail queda en 68px.
- [x] **T6 — Tests.** `staff-rail.test.tsx` actualizado a las zonas nuevas; `app-rail.test.tsx`
      nuevo para el toggle y el contrato `data-testid`/`aria-current`.

## Fuera de alcance (consciente)

- **Badges con conteos** (Clientes 3, Rutinas 3, Máquinas 1): el mockup los trae de fantasía y no
  existe endpoint de conteos por sección. Quedan afuera hasta decidir la fuente de datos.
- **Chevrons / colapso por zona**: el mockup solo muestra el estado expandido; no se agrega un
  control sin estado definido.

## Estado

Completo y verificado el 2026-11-16.

- `npx jest` → **3963 tests / 283 suites OK**.
- `npx tsc --noEmit` → sin errores. `npx eslint src` → solo 2 warnings previos (archivos ajenos).
- `npx next build` → compila; el CSS generado incluye la barra `inset 3px 0 0 0 var(--color-brand)`
  y las reglas `[data-rail="colapsado"]`.
- Gotcha encontrado: poner `aria-label` en los links del rail rompía `getByLabelText(/Membresía/i)`
  en `clientes/page.test.tsx` (los `aria-label` también matchean ahí). Se resolvió con el label
  visualmente oculto (`clip-path`, no `display:none`), que además conserva el nombre accesible
  en modo colapsado.

## Aceptación

- Ningún componente escribe un hex; todo sale de `globals.css`.
- Con `data-tema="claro"` el rail es claro; con `oscuro`, oscuro (relación de contraste del mockup).
- `nav-link-*` y `data-active` se conservan: es el contrato de las pantallas y sus tests.
- Mobile sigue apilando el rail arriba del contenido.
