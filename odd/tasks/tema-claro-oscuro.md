# Tema claro / oscuro

**Feature**: `tema-claro-oscuro` · **Rama**: `dev` · **Inicio**: 2026-11-04
**Consulta**: skill `impeccable` (`impeccable context` + `craft-floor`). PRODUCT.md existe y no
hay DESIGN.md; es un cambio in-world sobre los tokens existentes, no un rediseño.

## Objetivo

Que cada persona elija claro u oscuro desde los rails de staff y socio, que la elección se
recuerde por dispositivo y que el primer arranque siga al sistema. Sin flash y sin romper el
contraste AA que ya cumplen los tokens.

## Decisiones

- **Alcance**: staff + socio. El kiosco (`/puerta`) y el login no llevan selector, pero heredan
  la preferencia del dispositivo porque el tema se aplica en `<html>`.
- **Primer arranque**: sin cookie `tema`, se usa `prefers-color-scheme`. Después manda la
  elección explícita (cookie de 1 año, `SameSite=Lax`), porque un toggle que se resetea no sirve.
- **Sin tercer estado**: dos opciones (claro/oscuro). El sistema solo decide el primer arranque.
- **Aplicación global**: `data-tema` en `<html>`; los tokens oscuros dejan de estar scopeados a
  `.theme-dark`. Un script inline en el root layout resuelve cookie/sistema antes del primer
  paint (`suppressHydrationWarning` en `<html>`).
- **Selector**: botón de icono sol/luna en la fila de marca del `AppRail` compartido. El icono
  muestra la acción (sol en oscuro, luna en claro) y se intercambia por CSS, sin estado React
  ni parpadeo. `aria-label="Cambiar tema"` + `title`.
- **Superficies del navegador**: `color-scheme` claro/oscuro para scrollbars y controles nativos.

## Checklist

- [x] **T1** — `src/lib/tema.ts`: tipos, `SCRIPT_TEMA`, `temaActual`, `aplicarTema`, `alternarTema`.
- [x] **T2** — `ThemeToggle` + integración en la fila de marca de `AppRail`.
- [x] **T3** — `layout.tsx`: script beforeInteractive, cookie/sistema, `suppressHydrationWarning`.
- [x] **T4** — `globals.css`: `[data-tema="oscuro"]` en lugar de `.theme-dark`, `color-scheme`
      e iconos por CSS.
- [x] **T5** — Quitar `theme-dark` de los 5 shells; el tema lo resuelve `<html>`.
- [x] **T6** — Tests de `tema` y `ThemeToggle`; detector de Impeccable; `tsc` y suites verdes.

## Verificación

- `npx jest src/lib/tema.test.ts src/components/layout` → 7 suites, 32 tests verdes.
- `npx jest src/app/home-socio src/components/home-socio src/app/home-interno` → 25 suites, 320 tests verdes.
- `npx tsc --noEmit` → limpio.
- `grep -rn "theme-dark" src` → sin residuos.
- Impeccable `detect --json`: un solo warning, preexistente (`border-l-2` del ítem activo del rail).
- Verificación visual con Firefox headless a 1440×900: `/login` y el rail se ven correctos en
  claro y oscuro; el script resuelve el sistema antes del paint (sin flash observable).
- El `<script>` inline (patrón de Next "Preventing flash before hydration") reemplazó a
  `next/script`, que lo encolaba en `self.__next_s` y no garantizaba ejecución antes del paint.
