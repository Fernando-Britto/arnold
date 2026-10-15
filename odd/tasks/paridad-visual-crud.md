# Paridad visual de /clientes y anchos de tabla

**Feature**: `paridad-visual-crud` · **Rama**: `dev` · **Inicio**: 2026-10-15
**Fuente de verdad**: `openspec/Clientes.svg`, `openspec/Membresias.svg` (OpenPencil, 1920×1080)

## Objetivo

Que `/clientes` tenga el mismo chrome y el mismo comportamiento de carga que el resto de
las pantallas CRUD, y que las tablas llenen el ancho disponible repartiendo el espacio
sobrante en lugar de acumularlo en una sola columna.

## Problema

1. `/clientes` era la única pantalla CRUD que **no** usaba `FormPanelShell` / `ListPanelShell`.
   `ClienteForm` traía su propia tarjeta (`max-w-md` = 448px) y su propio `h2`.
2. El panel del form se montaba como `loading ? null : <ClienteForm/>`, así que durante la
   carga el panel izquierdo no existía: gris pelado con un texto "Cargando clientes...".
   Eso es la "pantalla en blanco" reportada.
3. Las columnas de tabla medían px fijo (`flexShrink: 0`) y sólo la principal crecía, así que
   todo el sobrante de la pantalla caía en `Nombre` (a 1920 ya son ~720px de hueco; a 2560,
   ~1360px).
4. La app renderizaba **Arial**: `globals.css` pisaba el token `--font-sans` con
   `body { font-family: Arial, Helvetica, sans-serif }`, mientras el mockup declara
   `font-family="Inter"` en todos sus nodos de texto.

## Decisiones

- `ClienteForm` deja de dibujar marco y título: los aporta `FormPanelShell`, igual que
  `EjercicioForm` y `RutinaForm`. Así el panel mide los **380px** del diseño en las cuatro
  pantallas (antes 448px en clientes, que le robaba 68px a la lista).
- El desplegable de membresías tiene su **propia** carga (`membresiasLoading`), separada de la
  lista de clientes: durante la precarga el select dice "Cargando membresías..." en lugar del
  engañoso "No hay membresías activas".
- **NO** se sube el tamaño de fuente: cabecera 13/700 y celdas 14px ya coinciden exacto con el
  mockup. El problema era la **familia** (Arial en vez de Inter), no el tamaño.
- Anchura de columnas: se **reparte el sobrante entre todas** las columnas en proporción a su
  medida del mockup (`flexGrow` = `flexBasis` = base). Esto **se aleja a propósito** del AC
  "anchos relativos" de `design-alignment.md`, que concentraba el sobrante en `Nombre`
  (846px de hueco a 1920). Decisión del usuario: priorizar la densidad de la tabla.

## Alcance

- `src/app/clientes/page.tsx`, `src/components/cliente-crud/cliente-form.tsx`
- `src/components/membresia-crud/membresia-form.tsx`
- `src/app/layout.tsx`, `src/app/globals.css` (fuente Inter — **afecta a todas las pantallas**)
- `src/components/ui/table.tsx` (`cellStyle` — **afecta a las 4 tablas CRUD**)

## Checklist

- [x] **T1** — `/clientes`: `FormPanelShell` + `ListPanelShell` y precarga del panel del form
      (se elimina `loading ? null`; la lista maneja su propio estado de carga).
- [x] **T2** — `ClienteForm`: prop `membresiasLoading` + submit deshabilitado mientras carga.
- [x] **T3** — Fuente: `Inter` vía `next/font` en `layout.tsx`; `globals.css` deja de pisar
      `--font-sans` con Arial.
- [x] **T4** — `table.tsx`: `cellStyle` reparte el ancho proporcionalmente (`FLEX_BASE` = 320
      para la columna principal); se elimina el ancho fijo con `flexShrink: 0`.
- [x] **T5** — Tests de regresión: precarga de la página, select en estado de carga y reparto
      de columnas en el kit de tabla.
- [x] **T6** — `/membresias`: `MembresiaForm` deja de dibujar su tarjeta (`max-w-md`) y su `h2`
      dentro del `FormPanelShell` de la página. Era el mismo defecto que tenía clientes:
      título duplicado y tarjeta anidada. Test anti-reincidencia: el form no renderiza
      ningún `heading`.

## Verificación

- `npx jest` → **2047/2047** tests verdes (163 suites).
- `npx tsc --noEmit` → limpio.
- `npx eslint` sobre los archivos tocados → sin errores nuevos. Los 2 que reporta
  (`react-hooks/set-state-in-effect` en `cliente-form.tsx:116` y un `as any` en
  `cliente-form.test.tsx`) son **preexistentes**, en código no modificado.
- Fuente verificada contra el dev server real (`/login`): el `<html>` sale con la variable
  `inter_*_variable` y el CSS emitido trae `body { font-family: var(--font-inter), ... }`.

## Próximo paso

Revisar visualmente `/clientes` y `/membresias` en el navegador. Si el reparto de columnas
quedó demasiado denso, el único número a mover es `FLEX_BASE` en `src/components/ui/table.tsx`.
