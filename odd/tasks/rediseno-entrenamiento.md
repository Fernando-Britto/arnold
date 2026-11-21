# Rediseño de Entrenamiento en Curso

## Objetivo

Rehacer la UI de ejecución de rutina del socio (dentro de `/home-socio`, modo ejecución) con
encabezado de progreso, dos columnas (45/55), registro de serie con historial local, descanso
como estado independiente, transición de ejercicio completado y lista de ejercicios.
**No se toca ninguna regla de negocio ni endpoint.**

## Decisiones aprobadas

1. Se muestra **“carga sugerida”**, no “peso planificado”. Se mantiene la precarga actual
   (`cargaInicial`: sugerencia de progresión o última vez). No hay peso planificado en el modelo.
2. El **historial de series es solo de la sesión en curso** y vive en estado local; se pierde al
   recargar (decisión aceptada). Tras recargar, las series anteriores a `serieActual` se muestran
   como realizadas sin valores (`—`) y con una nota.
3. En series pendientes solo se muestra la **repetición planificada**; peso, RIR y tipo quedan `—`.
4. El **progreso general sigue siendo por series** (`contarProgreso` + `porcentajeDeProgreso`), no
   por ejercicios. Se conserva “Ejercicio X de N” y se agrega el % de series.
5. La transición “Ejercicio completado” y **no iniciar descanso al completar la última serie del
   ejercicio** son lógica de UI (el backend ya avanzó de ejercicio).
6. **Sin sonido y sin cola offline.** El aviso de fin de descanso es solo visual.

## Restricciones

- No cambiar `iniciarSesion`, `registrarSerie`, `finalizarSesion`, `progresion-ejercicio`,
  `contarProgreso`, `tipo-serie`, `drop-set`, ni sus rutas/API.
- No agregar dependencias. No tocar otras pantallas (salvo el wrapper de `/home-socio` y el prop
  de nombre de rutina).
- Mantener el sidebar y la identidad visual.

## Tareas

- [x] T1 · `src/domains/home-socio/descanso.ts`: `calcularDescanso(inicio, segundos, ahora, {
      ajusteSegundos?, pausadoMs? })` retrocompatible (total = segundos + ajuste; transcurridos
      descuentan `pausadoMs`). Tests.
- [x] T2 · `src/components/ejercicio-crud/ejercicio-media.tsx`: `EjercicioVideo` acepta `ancho?`
      (default 180) para el `<video>` y el fallback `<img>`.
- [x] T3 · `src/components/home-socio/encabezado-de-sesion.tsx`: mostrar `${pct}%` de series
      (ya importa `porcentajeDeProgreso`). Mantener testids y accesibilidad.
- [x] T4 · Nuevos componentes en `src/components/home-socio/`:
      - `encabezado-entrenamiento.tsx`: h2 “Entrenamiento de hoy”, nombre de rutina, estado
        “En curso”, y debajo el `EncabezadoDeSesion` (ejercicio X de N, tiempo, series, barra).
      - `registro-serie.tsx`: columna derecha. Título “Registro de serie”, “Serie X de N”,
        indicadores `[1..N]` (verde/naranja/gris, con aria), reps y peso con steppers + input
        editable, RIR 0–5, tipo de serie, drops, `RecordEnVivo`, botón full-width “✓ Serie hecha”
        (o “Calentamiento hecho”), error. Recibe estado y callbacks.
      - `historial-series.tsx`: `Table` compacta Serie/Repeticiones/Peso/RIR/Tipo. Exporta
        `SerieLocal`. Filas planificadas 1..N; completadas con valores reales; sin datos tras
        recargar con `—`; pendientes con reps planificadas y `—` en el resto; calentamientos al
        final con Serie `—`; en Tipo, `· N drops` si la serie tuvo drops. Nota si hay filas sin
        datos. Sin acciones.
      - `descanso-entrenamiento.tsx`: panel dominante con timer `text-7xl`, +15/−15, Pausar/
        Reanudar, “Saltar descanso” y botón “Continuar entrenamiento” (ambos salen del descanso),
        tarjeta “Siguiente serie” (ejercicio, serie X de N, reps planificadas, “Carga sugerida: X
        kg”), aviso `role="status"` al expirar. +/− deshabilitados si expiró.
      - `lista-ejercicios.tsx`: `<ol>` no interactiva con estados Completado/Actual/Pendiente
        derivados de `orden` e índice actual (indicador de color + texto).
- [x] T5 · Reescribir `src/components/home-socio/ejecucion-rutina.tsx` como orquestador:
      - Prop nueva `rutinaNombre?: string | null`.
      - Estado local: `historial: SerieLocal[]`, `calentamientos`, `transicion`, `pausaInicio`,
        `pausaAcumuladaMs`, `ajusteSegundos`.
      - Historial: al registrar, guardar `numeroSerie` (el previo al POST), carga, reps, RIR, tipo
        y cantidad de drops. Calentamientos con `numeroSerie: null`. Al cambiar de ejercicio, armar
        la transición y limpiar historial.
      - Tras un registro exitoso: si terminó la rutina → finalizar como hoy; si terminó el
        ejercicio (serie previa == `series` y no fue calentamiento) → `transicion` sin descanso; si
        no → iniciar descanso reseteando pausa/ajuste.
      - Descanso con `calcularDescanso(..., { ajusteSegundos, pausadoMs })`; pausar/reanudar;
        `saltarDescanso` = continuar.
      - Render: header + grilla `xl:grid-cols-[45fr_55fr]` (izquierda ejercicio, derecha registro +
        historial) + lista de ejercicios. En descanso: header + panel de descanso. En transición:
        panel “¡Ejercicio completado!” con resumen y “Continuar al siguiente ejercicio”. Al
        finalizar: “¡Entrenamiento completado!”, “Terminaste tu rutina de hoy.”, métricas
        (ejercicios, series, repeticiones, duración) y botón “Finalizar entrenamiento” → `onCerrar`.
      - Mantener `UltimaVez` (izquierda), `RecordEnVivo` (derecha), `DropsDeSerie`, la precarga y
        todos los payloads actuales.
      - Inputs editables: drafts locales en `registro-serie`; commit en blur/Enter con clamp
        (reps entero ≥1, carga ≥0).
- [x] T6 · `src/app/home-socio/page.tsx`: quitar `max-w-3xl` del modo ejecución y pasar
      `rutinaNombre={data?.rutinaActiva?.nombre ?? null}`.
- [x] T7 · Tests: actualizar `ejecucion-rutina.test.tsx` **sin borrar escenarios** (payloads,
      precarga, tipos, drops, doble envío, finalización, progreso) y agregar historial,
      indicadores, descanso (pausa/±15/skip), transición, lista, métricas y edición directa.
      Actualizar `descanso.test.ts`, `encabezado-de-sesion.test.ts` y, si aplica, `page.test.tsx`.

## Criterios de aceptación

- Dos columnas en desktop, sidebar intacto, identidad visual y tarjetas blancas.
- Encabezado con título, rutina, estado, tiempo, “Ejercicio X de N” y % de series.
- Registro con reps/peso editables y steppers, RIR, tipo, drops y “Serie hecha”.
- Historial con completadas/pendientes/sin datos, sin acciones de edición.
- Descanso independiente, con controles y siguiente serie; no auto-avanza.
- Transición al completar ejercicio y lista de ejercicios sin navegación libre.
- Final con métricas reales y acción de cierre.
- Sin cambios en endpoints, reglas ni persistencia.

## Checks

- `npx jest src/components/home-socio src/domains/home-socio/descanso.test.ts src/app/home-socio`
- `npx tsc --noEmit` (si falla por `tests/factories/usuario.ts`, es deuda de otra sesión: probar con
  ese fixture completado y revertir)
- `npx eslint src/components/home-socio src/domains/home-socio/descanso.ts src/components/ejercicio-crud/ejercicio-media.tsx src/app/home-socio`

## Progreso

- Componentes nuevos: `encabezado-entrenamiento`, `registro-serie`, `historial-series`,
  `descanso-entrenamiento`, `lista-ejercicios`; `ejecucion-rutina` reescrito como orquestador.
- Verificación: `npx jest src/components/home-socio src/domains/home-socio/descanso.test.ts src/app/home-socio`
  → 27 suites / 371 tests OK. `npx eslint` de los archivos tocados → 0 errores (queda el warning
  pre-existente de `logout` sin usar en `page.tsx`).
- `npx tsc --noEmit` → OK con el fixture `tests/factories/usuario.ts` completado temporalmente
  (`debeCambiarPassword: false`); sin ese ajuste falla solo por la deuda de la otra sesión. El archivo
  se restauró sin cambios.
- Ajuste sobre el plan: los steppers y “Serie hecha” usan el borrador en foco (evita perder una
  edición por el orden blur → click). Las instrucciones se muestran aunque el ejercicio no tenga
  media.
- Pendiente/no incluido a propósito: confirmación al salir con cambios pendientes, sonido y cola
  offline; smoke visual en navegador.
