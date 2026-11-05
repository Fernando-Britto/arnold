# Socio sin pantallas de carga

**Feature**: `socio-sin-pantallas-de-carga` · **Rama**: `dev` · **Inicio**: 2026-11-04

## Objetivo

Eliminar las pantallas de carga de la sección del socio: el shell, los títulos y los marcos se
renderizan al instante; solo el contenido que viene de la base de datos espera, con un pulso
discreto (mismo criterio que `home-interno` y que los CRUD de admin).

## Problema

`SocioSeccionPage` reemplaza toda la sección por `Cargando...`, y `/home-socio` reemplaza todo por
`Cargando tu inicio...`. El rail y los títulos no dependen de la base y, aun así, desaparecen
hasta que vuelve `/api/home-socio/secciones`.

## Alcance

- `src/components/home-socio/socio-seccion-page.tsx`: siempre renderiza `SocioShell`; el error
  sigue teniendo su alerta. Los children reciben `data | null` + `cargando`.
- `src/components/home-socio/seccion-cargando.tsx`: pulso compartido (sin texto visible).
- `MiRutinaSection`, `MisEjerciciosSection`, `ProgresoDetalleSection`, `PagosSection` y
  `AsistenciasSection`: prop `cargando`; marco/título al instante y pulso en el área de datos;
  los estados vacíos solo aparecen cuando terminó la carga.
- `src/app/home-socio/page.tsx`: cabecera "Hoy" + fecha al instante; el contenido espera.
- `EjecucionRutina` y `BalanceMuscularCard`: reemplazar el texto "Cargando…" por el pulso.

## Fuera

- Cambios de backend o del contrato de `/api/home-socio/secciones`.

## Fase 2: cache entre secciones

Cambiar de item en el rail ya no debe pedir de nuevo la base. Se reutiliza el cache en memoria
por pestaña de `src/lib/cache-cliente.ts` (el mismo de las listas de admin, TTL 60 s y limpieza
en logout) y se agrega lectura sincrónica para que la primera renderización ya tenga datos.

- [x] **C1** — `leerCache` + `invalidarCachePorPrefijo` en `cache-cliente`; claves `homeSocio`,
      `homeSocioSecciones` y `balanceMuscular(periodo)`.
- [x] **C2** — `conCache` en `fetchHomeSocioData`, `fetchHomeSocioSeccionesData` y
      `fetchBalanceMuscular`.
- [x] **C3** — Estado inicial de `useSeccionesSocio`, `HomeSocioPage` y `BalanceMuscularCard`
      sembrado desde el cache (sin pulso al volver).
- [x] **C4** — Invalidación al mutar: peso (`homeSocio`) y sesiones (`homeSocio`,
      `homeSocioSecciones`, balance).
- [x] **C5** — Tests: cache (leer/vaciar/por prefijo), reuso de fetch y limpieza entre tests de API.

## Checklist

- [x] **T1** — `SocioSeccionPage` sin gate de carga; error conserva alerta.
- [x] **T2** — `SeccionCargando` compartido.
- [x] **T3** — Las cinco secciones aceptan `cargando` y dibujan su marco antes de los datos.
- [x] **T4** — Inicio con cabecera estática y contenido con pulso.
- [x] **T5** — `EjecucionRutina` y `BalanceMuscularCard` sin texto de carga.
- [x] **T6** — Tests: helpers esperan el fin del pulso y regresión de "título visible mientras carga".

## Verificación

- `npx jest src/app/home-socio src/components/home-socio` → 22 suites, 290 tests verdes.
- `npx tsc --noEmit` → limpio.
- `npx eslint` sobre lo tocado → mismos 2 hallazgos preexistentes de `page.tsx` (`logout` sin uso, `Date.now()` en render).

### Verificación fase 2

- `npx jest src/lib/cache-cliente.test.ts src/api/home-socio.test.ts src/api/home-socio-secciones.test.ts src/api/balance-muscular.test.ts src/api/peso.test.ts src/api/sesiones.test.ts` → 6 suites, 42 tests verdes.
- `npx jest src/app/home-socio src/components/home-socio` → 22 suites, 290 tests verdes.
- `npx tsc --noEmit` → limpio.
- El cache es por pestaña y en memoria: un F5 vuelve a pedir la base; el TTL es de 60 s y se
  invalida al registrar pesos o series/sesiones.
