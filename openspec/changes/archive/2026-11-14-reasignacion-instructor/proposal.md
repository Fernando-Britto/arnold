# Propuesta: reasignacion-instructor (P-61 — salida de emergencia del flujo obligatorio)

## Resumen

El flujo del socio es obligatorio y no tiene salida cuando la realidad cambia a mitad de entrenamiento: si la
máquina se rompe, el socio queda trabado en una ejecución que ya no puede completar. Esta change agrega la
**reasignación por instructor**: desde un panel de "Sesiones en curso" en `Home_Interno`, el instructor
cancela la fila `EN_CURSO` del socio y la recrea en otra máquina candidata del **mismo** ejercicio, dentro de
una transacción bloqueada y con auditoría.

Es la transición que la spec de persistencia ya había reservado: `EN_CURSO → CANCELADA` "solo
reasignación/cancelación por instructor de Etapa 5 (P-61); no implementada"
(`openspec/specs/asignacion-ejercicio-persistencia/spec.md:101`).

## Problema

- **No hay forma de cancelar una fila `EN_CURSO`**: `cancelarReserva` filtra `estado: "RESERVADA"`
  (`src/domains/asignacion/asignacion-escrituras.ts:52-59`).
- **El instructor no puede escribir sobre la sesión**: `/api/sesiones` le permite solo GET
  (`src/app/api/sesiones/route.ts:11-13`, `src/lib/authorization.ts:49`).
- **No hay pantalla donde ver el problema**: `Home_Interno` no lista quién está entrenando
  (`src/api/home-interno-data.ts` no consulta sesiones abiertas) y el instructor no tiene `/clientes`
  (`src/lib/authorization.ts:39-52`).
- **Limitación D-108 sin mitigar**: si un ejercicio tiene varias candidatas y la sesión no registró la
  máquina, el motor no sabe qué máquina ocupa el socio. El instructor sí lo sabe y hoy no puede decírselo al
  sistema.

## Objetivos medibles

1. Un instructor puede mover a un socio de la máquina A a la máquina B del mismo ejercicio en **una sola
   acción**, y el socio sigue en el mismo ejercicio con todas sus series registradas.
2. La reasignación deja **exactamente una** fila `EN_CURSO` para esa sesión y ejercicio, y la anterior
   `CANCELADA` (`count === 1` en el guard).
3. Un destino inválido (no candidata, `FUERA_DE_SERVICIO`/`INACTIVA`, u ocupada por otro socio) se rechaza
   con `409` y un mensaje en español, sin tocar nada.
4. Si el socio terminó el ejercicio entre la lectura y la escritura, la respuesta es `409` y no se reescribe
   nada.
5. Toda reasignación deja un `RegistroDeAuditoria` **en la misma transacción**: responsable, socio,
   ejercicio, máquina origen (o `null`) y máquina destino.
6. El panel muestra las sesiones abiertas con socio, ejercicio y máquina actual, y solo es accesible para
   INSTRUCTOR y ADMINISTRADOR.

## Alcance

### In Scope

1. **Escritura de dominio** (`src/domains/asignacion/`): `cancelarEjecucion` (guard
   `id + sesionId + estado = EN_CURSO`) y `reasignarEjecucion` (cancelar + crear `EN_CURSO` nueva con
   `crearEjecucionEnCurso`, `src/domains/asignacion/asignacion-escrituras.ts:88`), dentro de
   `enTransaccionBloqueada` (`src/domains/asignacion/asignacion-repositorio.ts:107-118`).
2. **Asignar máquina a una fila `EN_CURSO` con `maquinaId` nulo**: mismo endpoint, `maquinaId` destino. Es
   el caso que mitiga D-108.
3. **Lectura para el staff**: `GET /api/reasignaciones` — sesiones `EN_CURSO` con socio, ejercicio actual,
   máquina actual y el `asignacionId` de la fila `EN_CURSO`.
4. **Reasignación**: `POST /api/reasignaciones` con `{ maquinaId }`, solo INSTRUCTOR y
   ADMINISTRADOR.
5. **Matriz de roles**: `/api/asignaciones` gana `POST` para INSTRUCTOR y para ADMINISTRADOR (entrada
   explícita, ver D-99 abajo).
6. **Panel "Sesiones en curso"** en `Home_Interno` con la acción de reasignar.
7. **Auditoría** dentro de la transacción y **tests de integración contra Postgres** (los corre Fernando).

### Out of Scope

- **Saltar el ejercicio** (lesión): obliga a mover `ejercicioActualId`/`serieActual` de la sesión
  (`src/domains/sesion/sesion-de-entrenamiento.ts:171`), que es territorio de `sesion-de-entrenamiento`.
  Queda como **P-72**.
- Avisarle al socio en su pantalla: el instructor se lo dice en persona; la UI del socio se entera en el
  próximo recálculo.
- Recalcular reservas ajenas: las sugerencias son instantáneas (D-102) y se refrescan en el recálculo del
  propio socio.
- Abrir `/clientes` al INSTRUCTOR ni cambiar RN-06.
- Finalizar la sesión desde el panel (sigue siendo del socio).
- Cambios al motor de espera o al esquema.

## Flujo

```
POST /api/reasignaciones  { maquinaId }
  ├─ rol INSTRUCTOR | ADMINISTRADOR            → si no, 403
  ├─ enTransaccionBloqueada (lock global)      → D-95
  │   ├─ leer la fila EN_CURSO por id + sesionId
  │   ├─ validar destino: candidata del ejercicio + DISPONIBLE + libre   → si no, 409
  │   ├─ cancelar EN_CURSO  (updateMany id+sesionId+estado) → count === 1  → si no, 409 "ya terminó"
  │   ├─ crearEjecucionEnCurso (misma sesión, mismo ejercicio, máquina nueva)
  │   └─ tx.registroDeAuditoria.create (responsable, socio, ejercicio, origen, destino)
  └─ 200 { asignacionId, maquinaId, maquinaNombre }
```

La sesión **no** se toca: sigue `EN_CURSO` con sus series y su `ejercicioActualId`.

## Decisiones de Fernando (vinculantes)

### D-125 · La v1 cambia la máquina; saltar el ejercicio queda para P-72
- **Origen**: Fernando (2026-11-12).
- **Contexto**: saltar un ejercicio obliga a mover `ejercicioActualId` y `serieActual`
  (`src/domains/sesion/sesion-de-entrenamiento.ts:171`), que es justo lo que la Etapa 4 evitó tocar.
- **Decisión**: la reasignación cancela la fila `EN_CURSO` y crea otra del **mismo** ejercicio en la máquina
  elegida. También cubre asignar máquina a una fila `EN_CURSO` con `maquinaId` nulo (mitiga D-108). Saltar el
  ejercicio se registra como **P-72**.
- **Por qué**: cambiar de máquina no toca la sesión; el socio sigue en su ejercicio con sus series.

### D-126 · El panel vive en Home_Interno y es para INSTRUCTOR y ADMINISTRADOR
- **Origen**: Fernando (2026-11-12).
- **Decisión**: sección "Sesiones en curso" en `Home_Interno` (`src/app/home-interno/page.tsx:259`), sin abrir
  `/clientes` ni tocar RN-06. RECEPCIONISTA no accede.
- **Por qué**: el caso es operativo y en vivo; el instructor necesita ver quién está entrenando ahora, no
  buscar una ficha.

### D-127 · La sesión sigue EN_CURSO
- **Origen**: Fernando (2026-11-12).
- **Decisión**: solo cambia la fila de ejecución. La sesión conserva `ejercicioActualId`, `serieActual` y sus
  registros; cerrarla sigue siendo del socio.
- **Por qué**: el instructor resuelve la emergencia, no termina el entrenamiento de la persona.

### D-128 · La auditoría va dentro de la transacción
- **Origen**: Fernando (2026-11-12), con la evidencia de `src/api/socios/access-override.ts:94-100`, que
  audita el override dentro de `prisma.$transaction`.
- **Contexto**: `registrarOperacion` (`src/lib/audit.ts:59-72`) usa el cliente **global**
  (`prisma.registroDeAuditoria.create`, `src/lib/audit.ts:65`), así que llamarlo dentro de un
  `$transaction` escribiría por otra conexión y podría quedar auditado sin reasignar (o al revés).
- **Decisión**: se escribe con `tx.registroDeAuditoria.create` dentro de `enTransaccionBloqueada`, con
  responsable, socio, ejercicio, máquina origen (`null` si no tenía) y máquina destino. **No** se usa
  `registrarOperacion` en esta operación.
- **Por qué**: es una acción con privilegios; no puede existir una reasignación sin rastro ni un rastro sin
  reasignación.

### D-129 · Destino válido: candidata, DISPONIBLE y libre
- **Origen**: Fernando (2026-11-12).
- **Decisión**: la máquina destino tiene que estar en `EjercicioMaquina` para ese ejercicio, con
  `Maquina.estado = DISPONIBLE` y **sin ocupante vigente**. La ocupación se calcula con la misma lógica de
  `aplicarOcupantes` (`src/domains/asignacion/asignacion-ocupacion.ts:84`), excluyendo al socio que se
  reasigna. Si no cumple: `409` con mensaje en español.
- **Por qué**: el motor ya prohíbe dos ocupantes por máquina; la reasignación no puede introducir el estado
  que el modelo no contempla.

### D-130 · Concurrencia con el lock global y transición guardada
- **Origen**: Fernando (2026-11-12).
- **Decisión**: toda la operación corre en `enTransaccionBloqueada`
  (`src/domains/asignacion/asignacion-repositorio.ts:107-118`, el mismo `pg_advisory_xact_lock` que
  `calcularYReservar`), y la cancelación usa `updateMany` filtrado por `id + sesionId + estado = EN_CURSO`
  con `count === 1`. Si el socio completó la última serie en el medio, el guard devuelve `0` y la respuesta es
  `409` ("el socio ya terminó ese ejercicio").
- **Por qué**: el socio y el instructor compiten por la misma fila; el lock y el guard son la única forma
  barata de que gane uno solo.

### D-131 · Fuera de alcance: avisar al socio y recalcular reservas ajenas
- **Origen**: Fernando (2026-11-12).
- **Decisión**: no hay notificación en la pantalla del socio ni recálculo de otras reservas. Las sugerencias
  son instantáneas (D-102) y se refrescan en el próximo recálculo del propio socio.
- **Por qué**: el aviso es verbal y recalcular a terceros agranda el alcance sin necesidad.

## Slices

| # | Slice | Qué entrega | Base | Cota 1,5× |
|---|---|---|---|---|
| **S0** | Dominio de escritura | `cancelarEjecucion`, `reasignarEjecucion` (transacción + lock + guard + validación de destino), auditoría en `tx`; unitarios con dobles y transacción simulada | 220 | 330 |
| **S1** | Lectura del staff | `GET /api/reasignaciones` (sesiones abiertas con asignación, ejercicio y máquina), matriz de roles y handler | 160 | 240 |
| **S2** | Endpoint de reasignación | `POST /api/reasignaciones`, roles, mapper de errores (409) y matriz (D-99) | 200 | 300 |
| **S3** | Panel de lectura | Sección "Sesiones en curso" en `Home_Interno` con datos del endpoint de S1 | 180 | 270 |
| **S4** | Acción en el panel | Selector de máquina candidata y acción de reasignar, con estados de envío/error | 150 | 225 |
| | **Total** | | **≈910** | **≈1.365** |

Ningún slice supera 400 con la cota. Un commit por slice en `feat/reasignacion-instructor` (el proyecto no usa
PRs). AC propuestos: **AC-571…AC-585** (libres; el máximo usado es AC-566).

## Criterios de éxito

- Con un socio en `EN_CURSO` en la máquina A, el instructor elige la máquina B (candidata, disponible y
  libre) y la sesión pasa a tener una fila `CANCELADA` en A y una `EN_CURSO` en B, con el mismo `sesionId`,
  el mismo `ejercicioId` y las mismas series registradas.
- Una fila `EN_CURSO` con `maquinaId = null` puede recibir máquina sin cancelar nada.
- Elegir una máquina no candidata, fuera de servicio o con otro ocupante devuelve `409` y no cambia nada.
- Si el socio terminó el ejercicio antes de que el instructor confirme, `409` y no se reescribe nada.
- Cada reasignación deja su `RegistroDeAuditoria` con las cuatro piezas (responsable, socio, ejercicio,
  origen → destino).
- El panel solo se ve con rol INSTRUCTOR o ADMINISTRADOR; RECEPCIONISTA y SOCIO reciben `403`.
- `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` siguen verdes.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **R1 · Carrera con el socio** (completa la última serie mientras el instructor confirma) | Doble transición | Lock global + guard `count === 1` → `409` (D-130) |
| **R2 · Doble ocupación**: dos socios en la misma máquina | Estado que el modelo no contempla | Validación de destino con la lógica de `aplicarOcupantes` (D-129) |
| **R3 · Auditoría fuera de la transacción** | Rastro sin reasignación | `tx.registroDeAuditoria.create` dentro del lock (D-128) |
| **R4 · Sesión apuntando a un ejercicio sin fila** | UI del socio inconsistente | Se cancela y se crea en la misma transacción, mismo `sesionId` y `ejercicioId`; test de ambos lados |
| **R5 · RN-06** | Abrir `/clientes` al instructor | El panel va en `Home_Interno` (D-126) |
| **R6 · Test de concurrencia que pasa sin el lock** | Falsa confianza | Test de integración + **mutación obligatoria**: quitar el lock debe hacerlo fallar |
| **R7 · Sesión huérfana** si el socio no vuelve | Ocupación fantasma | Ya cubierto por el corte de inactividad (D-105); finalizarla desde el panel queda fuera |

## Dependencias

- **Lectura del modelo existente**: `AsignacionDeEjercicio`, `SesionDeEntrenamiento`, `EjercicioMaquina`,
  `Maquina` (sin migraciones).
- `enTransaccionBloqueada` y el lock global (`asignacion-repositorio.ts:107`), `crearEjecucionEnCurso`
  (`asignacion-escrituras.ts:88`), `aplicarOcupantes` (`asignacion-ocupacion.ts:84`).
- `extractUserFromRequest` y la matriz de `src/lib/authorization.ts`, con `matrix-consistency.test.ts`.
- Auditoría: tabla `RegistroDeAuditoria` y su tipo `MODIFICACION`.
- Pantalla: `Home_Interno` (`src/app/home-interno/page.tsx:259`) y sus componentes.
- Docker para el test de integración (lo corre Fernando).

## Estrategia de pruebas

- **S0 (unitarias)**: cancelación con guard (count 0 → error), reasignación feliz, destino no candidato, no
  disponible, ocupado, `maquinaId` nulo, auditoría escrita **dentro** de la misma transacción (doble que
  registra el orden de las llamadas).
- **S1/S2 (unitarias de ruta)**: roles (INSTRUCTOR/ADMINISTRADOR pasan; SOCIO y RECEPCIONISTA 403; sin sesión
  401), body estricto (`{ maquinaId }`), mapeo de los 409, y consistencia matriz ↔ handler.
- **Integración contra Postgres** (`tests/integration/reasignacion-instructor.integration.test.ts`): la
  escribo yo, **no la ejecuto**; la corre Fernando con Docker (`npm run test:integration`). Cubre el lock y la
  transición real. **Mutación obligatoria**: quitar `enTransaccionBloqueada` (o el guard) debe hacerla fallar.
- **S3/S4 (Testing Library)**: el panel lista las sesiones abiertas, el selector ofrece solo candidatas
  disponibles, el error 409 se muestra en español y el botón se deshabilita mientras envía.
- **Smoke manual (Fernando)**: dos socios con sesión abierta, uno en una máquina; el instructor abre
  `Home_Interno`, reasigna al socio a otra máquina y verifica en SQL las dos filas (`CANCELADA` + `EN_CURSO`)
  y el `RegistroDeAuditoria`; repetir con una máquina ocupada para ver el 409.

## Plan de reversión

Cinco commits independientes. Revertir S3/S4 devuelve `Home_Interno` al estado actual sin tocar la API;
revertir S1/S2 deja el dominio de S0 sin llamantes; revertir S0 no deja rastros (no hay migraciones ni
cambios de esquema). Los datos creados por una reasignación son filas normales del modelo: `CANCELADA` +
`EN_CURSO`, sin columnas nuevas.

## Preguntas abiertas

Ninguna bloqueante. Queda para el diseño decidir la forma exacta del endpoint de lectura (subruta
`/api/reasignaciones` vs. parámetro en el GET existente) y el criterio de orden del panel (hora de inicio).
