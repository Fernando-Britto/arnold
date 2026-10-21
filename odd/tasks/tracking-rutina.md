# Tracking del socio (T-046, T-047, T-048, T-049)

## Objetivo

Que el socio vea su progreso mientras entrena y al terminar: qué hizo la última vez, cuánto le toca
hoy y por qué, si batió una marca, qué tal le fue contra la sesión anterior y cuánto pesa. Todo se
deriva de `RegistroDeProgreso`; solo el peso corporal pide tablas nuevas.

## Problema y por qué

La pantalla de ejecución solo sabía la última carga del ejercicio actual y el Home calculaba una
"próxima sesión" con una regla vieja (marca + incremento). Faltaba el tracking que openGym usa como
referencia (ideas, no código: openGym es AGPL-3.0).

## Alcance

**Dentro**
- T-046a: "última vez" por ejercicio y precarga de la carga de la serie equivalente (D-58).
- T-046d: motor de progresión (subir / mantener / descargar) y sugerencia con motivo (D-59).
- Tarjeta Progreso del Home con la misma sugerencia del motor (D-60).
- Guardar una rutina tocando solo los ejercicios que cambiaron (D-61).
- T-046b: resumen al terminar la sesión, por ejercicio (D-62).
- T-046c: 1RM estimado (Epley) y marcas nuevas; línea de récord en vivo (D-63).
- T-047: tipos de serie (normal, calentamiento, al fallo, drop set) en backend y pantalla (D-64).
- T-049: encabezado de la pantalla de entrenamiento (D-67).
- T-048: peso corporal con meta en backend (`POST /api/peso`, `DELETE /api/peso/[id]`, `PUT /api/peso/meta`) (D-65) y tarjeta en el Home con gráfico, formularios y lista de recientes (D-66).

**Fuera (por ahora)**
- Músculos primario y secundario (idea 7 de la lista).
- Volumen semanal por músculo, heatmap y rediseño de Stats.

## Restricciones y hallazgos

1. **Decisiones renumeradas.** Los patches se generaron como D-56…D-63, pero en `dev` D-56 (huella) y
   D-57 (refresh token) ya existían. El bloque quedó en **D-58…D-65** en docs, código y schema.
2. **Migraciones escritas a mano.** `20261018120000_tipo_de_serie` y
   `20261018180000_peso_corporal_con_meta` se aplicaron a la base real el 2026-10-19 (P-45 resuelto). Antes se verificó que
   aplican desde cero en un Postgres 17 efímero y que `prisma migrate diff` da 0 diferencias.
3. **Sin guardar contadores.** La última vez, la progresión, las marcas y el resumen se recalculan
   desde el historial. Corregir un dato corrige lo que se muestra.
4. **Calentamiento fuera de las métricas.** `SOLO_SERIES_DE_TRABAJO` (`tipo <> CALENTAMIENTO`) se usa
   en última vez, progresión, marcas, `ultimaCarga`, progreso de Home y mejores marcas.
5. **Drop set.** Cuelga de la serie: se manda **junto con la serie** (`drops`, hasta 5), no ocupa una serie,
   no avanza la sesión, no tiene descanso propio y la progresión lo ignora (P-46, D-69).
6. **Peso corporal.** Solo el SOCIO, siempre sobre su propio `socioId` (sale del token). Rango 20–400 kg.
   Se puede borrar un pesaje propio desde los 3 recientes (un toque); no se corrige ni se carga una fecha distinta (P-47, D-68).

## Contrato

### Dominio puro
- `src/domains/sesion/historial-ejercicio.ts` — sesiones anteriores, "última vez", tendencia,
  frontera de récords.
- `src/domains/sesion/progresion-ejercicio.ts` — `sugerirProximaCarga`, `leerSesion`.
- `src/domains/sesion/marcas-ejercicio.ts` — `estimar1RM`, `detectarMarcasNuevas`.
- `src/domains/sesion/resumen-sesion.ts` — resumen por ejercicio.
- `src/domains/sesion/tipo-serie.ts` — `TipoSerie`, `SOLO_SERIES_DE_TRABAJO`.
- `src/domains/peso/peso-corporal.ts` — validación, `progresoHaciaMeta`, puntos del gráfico.

### API
- `GET /api/sesiones?enCurso=1` y `POST /api/sesiones`: suman `ultimasVeces`, `sugerencias` y `records`.
- `GET /api/sesiones/[id]/resumen`: resumen por ejercicio (SOCIO dueño, ADMINISTRADOR, INSTRUCTOR).
- `POST /api/sesiones/[id]/series`: acepta `tipo` (inválido = 400).
- `POST /api/peso` (201), `DELETE /api/peso/[id]` (204) y `PUT /api/peso/meta` (200): solo SOCIO.
- `GET /api/home-socio`: `progreso.sugerencia` reemplaza `progreso.proximaSesionSugerida`.

### Schema
- `enum TipoSerie { NORMAL, CALENTAMIENTO, HASTA_EL_FALLO, DROP_SET }`
- `RegistroDeProgreso.tipo TipoSerie @default(NORMAL)`
- `Socio.pesoObjetivo Decimal?(5,2)`, `Socio.pesoInicialDeMeta Decimal?(5,2)`
- `model MedicionDePeso { id, socio, socioId, peso Decimal(5,2), fecha, createdAt }` + índice
  `[socioId, fecha]`.

## Tareas

- [x] T-046a · última vez por ejercicio + precarga (D-58).
- [x] T-046d · motor de progresión conectado a API y pantalla (D-59).
- [x] Home · tarjeta Progreso con la sugerencia del motor (P-42, D-60).
- [x] Rutinas · guardar solo lo que cambió (P-43, D-61).
- [x] T-046b · resumen al terminar la sesión (D-62).
- [x] T-046c · 1RM, marcas nuevas y récord en vivo (D-63).
- [x] T-047 · tipos de serie backend + pantalla (D-64).
- [x] T-048 parte 1 · peso corporal con meta en backend (D-65).
- [x] T-048 parte 2 · tarjeta con gráfico, formularios y borrado de pesajes en Home (D-66).
- [x] T-049 · encabezado con ejercicio, series, tiempo y barra de progreso (D-67).
- [x] Aplicar y verificar las migraciones en la base real (P-45, 2026-10-19: 17/17 y `migrate diff` en 0).

## Verificación

- `npx tsc --noEmit`: 0 errores.
- `npx eslint src prisma`: 0 errores y 0 avisos.
- `npm test`: **213 suites / 2944 tests**, todos en verde.
- Migraciones: aplicadas desde cero en Postgres 17 efímero; `prisma migrate diff --exit-code` → 0.
- **No** se probó contra la base real ni en el navegador (pendiente de Fernando).

## Estado

Código completo y en verde, con las 17 migraciones aplicadas. Pendientes abiertos: P-44 (marcas con
historial grande) y P-49 (confirmar la cuarta fila del Home con el diseño). P-46, P-47 y P-48 quedaron
resueltos (D-69, D-68 y peso privado).
