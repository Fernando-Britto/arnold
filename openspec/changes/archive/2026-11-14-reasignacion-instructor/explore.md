# Explore — reasignacion-instructor (P-61)

- **Change**: `reasignacion-instructor` (cierre de la Etapa 5: salida de emergencia del flujo obligatorio)
- **Rama**: `feat/reasignacion-instructor` (desde `dev`)
- **Fecha**: 2026-11-12
- **Estado**: exploración. Sin código. Las decisiones de §"Decisiones pendientes" son de Fernando.
- **Pendiente que cierra**: **P-61** — "Salida de emergencia del flujo obligatorio: máquina rota durante la
  sesión o socio lesionado → reasignación por instructor. No es parte del motor puro; requiere estado de
  sesión y permisos de instructor".

## Contexto

El flujo del socio es **obligatorio**: acepta la sugerencia o espera, y la sesión avanza sola al completar
cada ejercicio. No hay salida cuando la realidad cambia a mitad de entrenamiento — la máquina se rompe o el
socio se lesiona — y hoy la única salida es que el socio cierre la app con la sesión abierta.

El modelo de datos ya lo anticipó: la spec de persistencia declara la transición **`EN_CURSO → CANCELADA`**
como "solo reasignación/cancelación por instructor de Etapa 5 (P-61); **no implementada en esta change**"
(`openspec/specs/asignacion-ejercicio-persistencia/spec.md:101`). Esto es exactamente esa pieza.

## Lo que ya existe (verificable)

| Pieza | Archivo | Qué aporta |
|---|---|---|
| Máquina de estados | `openspec/specs/asignacion-ejercicio-persistencia/spec.md:98-105` | `EN_CURSO → {COMPLETADA, CANCELADA}`; la cancelación por instructor está **reservada y no implementada** |
| Cancelar una reserva | `src/domains/asignacion/asignacion-escrituras.ts:52-59` | `cancelarReserva(id, ahora)` solo toca filas `RESERVADA` no vencidas |
| Completar | `src/domains/asignacion/asignacion-escrituras.ts:60-69` | `completarEjecucion(sesionId, ejercicioId)` pasa `EN_CURSO → COMPLETADA` |
| Crear ejecución | `src/domains/asignacion/asignacion-escrituras.ts:88-110` | `crearEjecucionEnCurso` crea una fila `EN_CURSO` con `sesionId` y `maquinaId` (admite `null`) |
| Ejercicio actual | `src/domains/sesion/sesion-de-entrenamiento.ts:171` (`ejercicioActualId`) | la sesión guarda en qué ejercicio está el socio; la fila `EN_CURSO` lo refleja |
| Avance por serie | `src/domains/sesion/sesion-de-entrenamiento.ts:547-560` | al completar un ejercicio se recalcula y puede dejar una `RESERVADA` nueva |
| Consumo de reserva | `src/domains/sesion/integracion-asignaciones.ts:57` | `consumirReservaParaSesion` con guard optimista |
| Permisos | `src/lib/authorization.ts:39-52` | INSTRUCTOR: `/api/socios` GET, `/api/sesiones` **solo GET**, `/api/asignaciones` GET; **no** tiene `/clientes` |
| Home del staff | `src/api/home-interno-data.ts` | no arma ninguna vista de sesiones en curso |
| Auditoría | `src/lib/audit.ts:60-72` (`registrarOperacion`) | patrón best-effort (`MODIFICACION`/`BAJA`) que usa el resto de las escrituras |

## El hueco

1. **No hay forma de cancelar una fila `EN_CURSO`**: `cancelarReserva` filtra `estado: "RESERVADA"`. El estado
   nuevo exige un guard distinto (`estado: "EN_CURSO"` + `sesionId`) y, por la spec, es la única transición
   que faltaba.
2. **No hay endpoint**: el instructor no puede escribir nada sobre la sesión (`/api/sesiones` le da 403 en
   POST/PUT, `src/lib/authorization.ts:49`).
3. **No hay pantalla**: el instructor no tiene `/clientes` ni un panel con quién está entrenando. Hoy no
   tendría dónde ver el problema ni dónde resolverlo.

## Decisiones pendientes (Fernando)

### 1. Qué significa "reasignar" (la decisión que define todo lo demás)

- **A. Misma máquina rota → otra candidata del mismo ejercicio.** El instructor elige la máquina de
  reemplazo entre las candidatas del ejercicio (`EjercicioMaquina`). La sesión **sigue** en el mismo
  ejercicio, con la fila `EN_CURSO` nueva en la otra máquina.
- **B. Saltar el ejercicio** (lesión): la fila pasa a `CANCELADA` y la sesión avanza al siguiente ejercicio
  por orden de rutina. No hay máquina nueva.
- **C. Las dos**, con un `destino` explícito: `MAQUINA` (elegir otra candidata del mismo ejercicio) o
  `SALTAR` (pasar al siguiente ejercicio).
**Recomendación: C**, porque los dos casos que cita P-61 son distintos (máquina rota vs. socio lesionado) y
un solo endpoint con dos destinos no duplica ni la ruta ni los permisos. Si preferís el mínimo, **A** es la
que más duele hoy; B se puede resolver cerrando la sesión.

### 2. Dónde se opera

- **A. Panel nuevo "Sesiones en curso" en `Home_Interno`**, visible para INSTRUCTOR y ADMINISTRADOR: lista
  de socios con sesión abierta, el ejercicio y la máquina actuales, y la acción. **Pro**: es el lugar donde
  el instructor ya vive y no cambia RN-06 (Clientes sigue siendo de Administrador/Recepción). **Contra**:
  suma una sección al Home ya cargado.
- **B. Habilitar `/clientes` al INSTRUCTOR** con una acción en la ficha del socio. **Pro**: reusa la
  pantalla y el detalle que ya existen. **Contra**: cambia el alcance de RN-06 y le abre al instructor una
  pantalla completa que hoy no tiene.
**Recomendación: A.** El caso es operativo y en vivo; el instructor necesita ver *quién está entrenando
ahora*, no buscar un socio en una lista.

### 3. Quién puede

**Recomendación**: INSTRUCTOR y ADMINISTRADOR. RECEPCIONISTA no (no es su tarea y ya tiene el kiosco);
SOCIO no. Se suma a la matriz (`src/lib/authorization.ts`) y al test de consistencia.

### 4. Qué pasa con la sesión y con lo ya hecho

- La sesión **sigue `EN_CURSO`** y conserva las series registradas; solo se cancela la fila de ejecución
  actual.
- Con destino `MAQUINA`, se crea una fila `EN_CURSO` nueva con la máquina elegida y `sesionId` de la misma
  sesión; `ejercicioActualId` no cambia.
- Con destino `SALTAR`, `ejercicioActualId` pasa al siguiente ejercicio pendiente (o `null` si era el
  último, que es la misma condición que dispara el resumen al terminar).
- **Los segundos restantes no se pierden**: si el socio lesionado no vuelve, la sesión queda abierta hasta
  que la finalice el propio socio (o hasta el corte de inactividad de D-105, que ya existe para ocupantes).
**Recomendación**: la sesión no se finaliza desde acá. El instructor resuelve la emergencia; cerrar la
sesión sigue siendo del socio.

### 5. Auditoría

**Recomendación**: un `RegistroDeAuditoria` por reasignación con `registrarOperacion` (`src/lib/audit.ts:60`),
responsable el instructor y en `detalles` el `asignacionId` cancelado, el destino, la máquina anterior y la
nueva. No hace falta un tipo nuevo (`MODIFICACION` alcanza) y la auditoría es best-effort, como el resto.

### 6. Qué se puede reasignar

**Recomendación**: **solo `EN_CURSO`**. Una `RESERVADA` la maneja el socio con "Esperar"; meter al
instructor ahí sería cambiar el contrato de la decisión obligatoria (D-91).

## Contornos técnicos que hay que resolver en el diseño

- **Guard de la transición**: `EN_CURSO → CANCELADA` con `updateMany` filtrado por `id + sesionId + estado`,
  igual que `consumirReserva`; si `count === 0`, 409 (la sesión ya avanzó).
- **Unicidad**: la spec prohíbe dos reservas activas, pero una `EN_CURSO` y una `RESERVADA` pueden
  coexistir (`asignacion-ejercicio-persistencia/spec.md:130`). Al reasignar hay que decidir qué pasa con la
  `RESERVADA` del *siguiente* ejercicio: no se toca.
- **Lock**: la operación toca la sesión y la asignación en la misma transacción; conviene reusar
  `enTransaccionBloqueada` (D-95) para no pelear con el recálculo del socio.
- **Recálculo posterior**: tras cancelar, el próximo `registrarSerie` del socio recalcula y puede crear una
  reserva nueva; no hay que disparar el motor desde acá.
- **Estado de la máquina**: el motor no cambia `Maquina.estado`; si la máquina está rota, el administrador
  la pasa a `FUERA_DE_SERVICIO` desde `/maquinas` y el motor deja de elegirla (D-75/D-76). La reasignación
  **no** debe inferirlo sola.

## Partición tentativa (a confirmar en tasks)

| Slice | Qué | Est. |
|---|---|---|
| **R1** | Dominio: `cancelarEjecucion` + `reasignar` (misma transacción, guard y auditoría), con tests | ≈220 |
| **R2** | Endpoint `POST /api/sesiones/[id]/reasignar` (o subruta de asignaciones), matriz RBAC y mapper | ≈180 |
| **R3** | Panel "Sesiones en curso" en `Home_Interno` con la acción | ≈220 |
| **R4** | Lectura de sesiones en curso para el staff (`GET` con rol INSTRUCTOR/ADMIN) | ≈120 |

Total ≈740, ningún slice >400. AC propuestos: **AC-571…AC-585** (rango libre; el máximo usado es AC-566).
Decisiones nuevas: **D-125+** (última D-124).

## Riesgos

- **R1 · Doble fuente de verdad**: cancelar la fila `EN_CURSO` sin mover `ejercicioActualId` deja la sesión
  apuntando a un ejercicio sin fila. Tiene que ser una sola transacción y con tests de ambos lados.
- **R2 · Carrera con el socio**: el socio puede completar la última serie mientras el instructor reasigna.
  El guard por `estado` devuelve 409 y la UI recarga; no se reescribe nada.
- **R3 · RN-06**: darle al instructor una pantalla de socios es un cambio de alcance; por eso el panel va en
  `Home_Interno` y no en `/clientes`.
- **R4 · Sesión huérfana**: si el socio no vuelve, la sesión queda `EN_CURSO` hasta el corte de inactividad
  (D-105), que hoy solo afecta la ocupación. Ver si hace falta finalizarla desde el panel del instructor; si
  sí, es otro slice.

## Fuera de alcance (propuesto)

- Simulación comparativa (P-62) y redacción de la limitación "solo espera" (P-63).
- Cambios al motor de espera.
- Historial o reportes de reasignaciones más allá del `RegistroDeAuditoria`.
- Notificar al socio (push/toast inmediato): la UI del socio se entera en el siguiente recálculo.
