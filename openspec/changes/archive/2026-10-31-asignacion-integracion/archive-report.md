# Archive Report — asignacion-integracion

- **Change**: `asignacion-integracion` (Etapa 4 de "asignación dinámica de ejercicios")
- **Close date**: 2026-10-31
- **Artifact store**: openspec
- **Archived to**: `openspec/changes/archive/2026-10-31-asignacion-integracion/`
- **Branch**: `feat/asignacion-integracion`
- **Verify report**: `verify-report.md` — **APROBADO CON OBSERVACIONES** (hallazgos medios 1, 2 y 3 cerrados)

## Qué se entregó

La Etapa 4 conecta el motor puro de espera (Etapa 3) con la base, el check-in, la sesión y la
configuración. Sin pantallas, sin reasignación de instructor y sin cambios al motor.

- **T-056a — Esquema, migraciones, configuración y panel (CP1)**. Tabla `AsignacionDeEjercicio` con
  enum de cuatro estados (`RESERVADA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`), `esperaSegundos` y
  `ahorroSegundos` como instantánea, `venceEn`, cuatro índices y FKs (`socio` y `ejercicio` con
  `CASCADE`, `maquina` y `sesion` con `SET NULL`). Dos migraciones **a mano y aditivas**:
  `20261026120000_asignacion_ejercicio` y `20261026120500_asignacion_configuracion`. Tres parámetros
  nuevos en el lector único y en el panel `/configuracion`: `segundosEjecucionSerie` (60, 1–3600),
  `minutosVencimientoReserva` (15, 0–1440) y `minutosInactividadSesion` (30, 1–1440).
- **T-056b/c — Repositorio, entrada del motor, ocupantes, cola y lock (CP2)**. El repositorio se partió
  por responsabilidad (`asignacion-puerto`, `-lecturas`, `-ocupacion`, `-escrituras` y la composición
  `asignacion-repositorio`). Arma `EntradaMotor` desde la rutina activa; ocupantes derivados de
  sesiones y filas `EN_CURSO` con corte de inactividad (D-105) y `seriesRestantes` filtrando
  `CALENTAMIENTO` y `DROP_SET`; cola de `RESERVADA` no vencidas de otros socios (P-67); escrituras con
  guard y `enTransaccionBloqueada` con `pg_advisory_xact_lock` global (D-95, D-111).
- **T-056d — Orquestación (CP3)**. `calcularYReservar` (camino feliz, fallback `SIN_RUTINA`/
  `SIN_OPCIONES`/`VACIO`/`SIN_MAQUINA`, `invalido` y errores contenidos, timeout con carrera externa),
  `decidirSugerencia` (`ACEPTAR` idempotente, `ESPERAR` con guard, 404/409 según D-102),
  `reservaVigente`, `calcularSinReservar`, `calcularEnCheckIn` y las pasarelas. Timeouts configurables
  por entorno (D-110).
- **T-056e — Handlers HTTP (CP4a)**. `handleObtenerSugerencia` (GET, 13 tests) y
  `handleDecidirSugerencia` (POST, 17 tests), con body estricto, regla fina por rol y propiedad, y
  `contenido` de D-109 mapeado a 500.
- **T-056f — Rutas, matriz RBAC y mapper (CP4b)**. Rutas `sugerencia` (GET) y `decidir` (POST);
  matriz `/api/asignaciones` con SOCIO GET+POST, INSTRUCTOR GET y ADMINISTRADOR GET explícito que
  recorta el comodín; `SIN_SUGERENCIA` (404) y `SIN_SUGERENCIA_VIGENTE` (409) en el mapper, con los
  mensajes en un solo lugar.
- **T-056g — Check-in y sesión (CP4c)**. Gancho best-effort en `evaluarYRegistrarAcceso` (g1);
  adaptador `integracion-asignaciones.ts` con la guarda D-103 y el inicio de sesión que consume la
  reserva **dentro** de la transacción (g2/g2b); `registrarSerie` que consume/avanza solo al completar
  el ejercicio y recalcula `POST_EJERCICIO` (g3a); `finalizarSesion` que cierra sesión y ejecuciones en
  una transacción (g3b).
- **Deliberadamente fuera**: pantalla del socio, reasignación por instructor (P-61), simulación
  comparativa (P-62) y cambios al motor puro.

## Decisiones

- **D-88…D-111 (23 decisiones, sin D-107, que pertenece a balance muscular)** registradas en `openspec/decisions.md` §1, después de D-87, con el
  mismo formato que D-75…D-87.
  - **De Fernando (D-88…D-92)**: disparo del cálculo en tres momentos; vencimiento a los 15 min
    configurable; tres parámetros en `/configuracion`; solo socios con rutina activa; flujo
    `ACEPTAR`/`ESPERAR`.
  - **Propuestas de la IA adoptadas (D-93…D-111, sin D-107)**: tabla y cuatro estados; instantánea inmutable;
    advisory lock global; una reserva activa por socio; ocupación derivada; timeout de 2 s; matriz de
    permisos; rechazo de `after()`; ocupante con la rutina de su sesión; 404 vs 409; guarda de
    capacidad; dos migraciones; corte de inactividad; `CASCADE` en `ejercicioId`; consulta del lock que
    devuelve un entero; límite multi-máquina de D-108; `contenido` en `decidirSugerencia`; tope
    configurable por entorno.

> **Nota**: D-107 original renumerada a D-111 el 2026-10-31 por colisión con el D-107 de balance
> muscular (dev). Los mensajes de commits viejos que dicen D-107 no se corrigen.

## Literales de los pendientes

- **Cerrados en esta etapa**: **P-64** (check-in best-effort), **P-65** (vencimiento configurable),
  **P-66** (`after` evaluado y descartado), **P-67** (exclusión del propio socio), **P-68**
  (concurrencia probada contra Docker), **P-70** (`ejercicioActualId` refleja la asignación).
- **Abiertos**: **P-61** (reasignación por instructor, Etapa 5), **P-62** (simulación de la tesis,
  posterior a la Etapa 5), **P-63** (limitación solo-espera, informe), **P-69** (limpieza batch de
  `RESERVADA` vencidas), **P-71** (latencia del check-in; mitigada por D-110, falta medir con carga
  real).

## Specs sincronizadas

| Dominio | Acción | Detalles |
|---------|--------|----------|
| `asignacion-ejercicio-persistencia` | **Creada** | Promovido byte a byte a `openspec/specs/asignacion-ejercicio-persistencia/spec.md` (558 líneas). |
| `asignacion-orquestacion` | **Creada** | Promovido byte a byte a `openspec/specs/asignacion-orquestacion/spec.md` (487 líneas). |
| `asignacion-api` | **Creada** | Promovido byte a byte a `openspec/specs/asignacion-api/spec.md` (333 líneas). |
| `configuracion-sistema` | **Actualizado** | Requirements **fusionados el 2026-10-31** sobre `openspec/specs/configuracion-sistema/spec.md`, conservando el resto del spec intacto. **ADDED**: "Parámetros del motor de espera", "Migración aditiva de los parámetros", "Consumo de los parámetros por la orquestación". **MODIFIED** (reemplazados en su lugar): "Lector único", "API de configuración", "Auditoría de cambios", "Pantalla `/configuracion`". |
| `member-access-check` | **Actualizado** | Requirements **fusionados el 2026-10-31** sobre `openspec/specs/member-access-check/spec.md`, conservando el resto del spec intacto. **ADDED** (9): "Punto único de gancho en el check-in", "La asistencia nunca falla por el cálculo", "Condiciones de disparo del cálculo", "Segundo check-in y anti-passback", "Reloj inyectado", "Sin registros duplicados ni cambios en la auditoría de acceso", "Registro de fallos del gancho", "Espera acotada y respuesta del check-in", "Compatibilidad con el flujo actual". Sin `MODIFIED`. |

Los tres specs promovidos conservan requirements, escenarios y AC tal como estaban en el change; las
copias se verificaron con `diff -q` (salida vacía). Los dos specs con requirements fusionados se
editaron en `openspec/specs/` el 2026-10-31; las copias originales quedan en
`openspec/changes/archive/2026-10-31-asignacion-integracion/specs/` como registro histórico.

## Resultados de verificación

Del `verify-report.md` (APROBADO CON OBSERVACIONES):

- **61 AC** de los cinco specs: 56 ✅ cubiertos, 5 🟡 parciales/aceptados como bajos, 0 sin cobertura.
- **23 decisiones** D-88…D-111 (sin D-107, que pertenece a balance muscular) verificadas en el código, sin desviaciones de comportamiento.
- `npx tsc --noEmit` limpio; `npm test` **264 suites / 3731 tests**; `npm run build` compilado en
  11,2 s / 49 páginas; `npx eslint .` con solo el error preexistente **P-57**.
- Suite de integración: **9 suites / 54 tests**, ejecutada por Fernando el 2026-10-31 con resultado OK.
- Hallazgos abiertos: bajos 4–7 (AC-403 enum por tipo/DDL, AC-486 identidad encadenada, AC-521 rutas de
  ingreso, AC-509 arrastra la compuerta de integración). Aceptados como están.

## Lecciones

Del `tasks.md` del change:

- **Los tests de concurrencia se verifican con mutación**: sin el advisory lock deben fallar. Un test
  de lock que pasa sin el lock no prueba nada.
- **Un test que solo verifica que un argumento existe (`expect.anything()`) no prueba que llegue al
  lugar correcto**: el cableado de timeouts de D-110 estaba mal (los pasaba dentro del input en vez de
  en `deps`) y lo detectó el smoke manual, no los tests.
- **Los tests con Prisma falso no ejecutan el SQL real**: cada adaptador que escribe necesita al menos
  un flujo contra Postgres.
- **El smoke manual contra la BD real encontró lo que los tests no veían**: el recálculo en cada serie
  (en vez de al completar el ejercicio) y el timeout de 2 s contra una base remota.

## Pasos manuales que quedan

1. Correr el smoke de CP4b (`/api/asignaciones/*` con los cuatro roles) y el de CP4c (check-in, inicio,
   serie, fin) con `npm run dev` y los usuarios del seed. El guion está en el `tasks.md` archivado.
2. Antes de usar el flujo contra una BD remota, ajustar `ASIGNACION_TIMEOUT_CALCULO_MS` (D-110); el
   valor por defecto es 2000 ms.
3. Asociar máquinas a los ejercicios de la rutina desde `/maquinas` → fila expandida → "Asignar
   ejercicios": el seed **no** crea `EjercicioMaquina`, así que sin ese paso el motor devuelve
   `sin_opciones` y el check-in no deja reserva.
4. Mergear `feat/asignacion-integracion` → `dev`, y `dev` → `main` cuando la verificación esté cerrada.
5. Los dos specs (`configuracion-sistema`, `member-access-check`) ya están fusionados en
   `openspec/specs/` (2026-10-31).

## Qué NO se verificó

- La interfaz del socio y las pantallas: esta etapa no tiene UI.
- Concurrencia con decenas de socios reales: los tests usan pocos socios en Docker.
- Latencia real contra Supabase: medida solo de forma cualitativa en el smoke manual (de ahí D-110).
