# Archive Report — reasignacion-instructor (P-61)

- **Change**: `reasignacion-instructor` (P-61 — salida de emergencia del flujo obligatorio)
- **Close date**: 2026-11-14
- **Artifact store**: openspec
- **Archived to**: `openspec/changes/archive/2026-11-14-reasignacion-instructor/`
- **Branch**: `feat/reasignacion-instructor`
- **Verify report**: `verify-report.md` — **APROBADO CON OBSERVACIONES** (sin hallazgos críticos, altos ni medios)

## Qué se entregó

El instructor y el administrador pueden cambiar la máquina de una ejecución `EN_CURSO` sin tocar la sesión del
socio. Es la transición que la spec de persistencia tenía reservada: `EN_CURSO → CANCELADA`.

- **S0 · Dominio** (`src/domains/asignacion/reasignacion.ts`). `reasignarMaquina` valida la ejecución, que la
  sesión siga en ese ejercicio, que el destino sea candidata del ejercicio, esté `DISPONIBLE` y libre; cancela
  con guard `id + sesionId + EN_CURSO` y crea la fila nueva en la misma transacción. `cancelarEjecucion` es el
  guard nuevo; `enTransaccionDeReasignacion` toma el **mismo advisory lock global** que `calcularYReservar` y
  escribe la auditoría con el cliente transaccional (no con `registrarOperacion`, que usa el cliente global).
- **S1 y S2 · API**. `GET /api/reasignaciones` lista las sesiones abiertas con socio, ejercicio, máquina actual
  y candidatas; `POST /api/reasignaciones` recibe `{ asignacionId, maquinaId }`. Recurso propio para que la
  matriz por prefijo quede exacta: INSTRUCTOR y ADMINISTRADOR con `GET` y `POST`, RECEPCIONISTA y SOCIO sin
  entrada. Cero excepciones nuevas en `authorization-consistency.test.ts`.
- **S3 y S4 · Panel**. Sección "Sesiones en curso" en `Home_Interno` (solo INSTRUCTOR y ADMINISTRADOR), con
  selector de candidatas (deshabilita las no disponibles), "Reasignar", 409 visible y refresco tras la acción.
  Sin pantallas de carga completas y con tokens del tema.
- **Integración**. `tests/integration/reasignacion-instructor.integration.test.ts`: estado final, fila
  completada, destino ocupado y **serialización del lock** con barrera controlada por el test.

## Decisiones

- **D-125…D-133 (9 decisiones)** registradas en `openspec/decisions.md` después de D-124.
  - De Fernando: v1 cambia la máquina y saltar el ejercicio queda en P-72 (D-125); panel en `Home_Interno`
    para INSTRUCTOR y ADMIN (D-126); la sesión sigue `EN_CURSO` (D-127); auditoría **dentro** de la
    transacción (D-128); destino candidata + disponible + libre (D-129); lock global y guard (D-130); sin aviso
    al socio ni recálculo de reservas ajenas (D-131).
  - De la IA adoptadas: recurso propio `/api/reasignaciones` (D-132, revisada durante la implementación) y
    ocupación del destino reusando `aplicarOcupantes` (D-133).

## Specs sincronizadas

| Dominio | Acción | Detalles |
|---|---|---|
| `reasignacion-instructor` | **Creada** | Promovida a `openspec/specs/reasignacion-instructor/spec.md`; solo cambian la cabecera y la fila de capability. AC-571…AC-585. |

## Verificación

- `npx tsc --noEmit` limpio · `npm run lint` **0 errores** (96 warnings preexistentes) ·
  `npm test` **282 suites / 3957 tests** · `npm run build` compilado (9,3 s).
- Cobertura de los 15 AC: 13 con tests unitarios o de componente, AC-581 (lock) por integración y AC-584
  (sesión intacta) por integración más la restricción de diff. Sin AC sin cobertura.
- Mutaciones independientes: guard de estado, control de rol, destino libre y destino candidato — las cuatro
  hicieron fallar el test correcto.
- **Integración con Docker (Fernando)**: 10 suites / 59 tests en verde (antes 9 / 54).
- **Mutación del lock (Fernando)**: con el test de dos reasignaciones el lock quitado **no fallaba** (medía
  timing); con el test de serialización nuevo **falla** "serializa dos transacciones de reasignación" y al
  revertir vuelve a verde.
- **Smoke del flujo contra la API y la base reales (2026-11-14)**: destapó un 500 por el timeout fijo de la
  transacción contra la base remota. Corregido en la rama: `enTransaccionDeReasignacion` usa
  `timeoutsDeEntorno()` (D-110). Con `ASIGNACION_TIMEOUT_CALCULO_MS=20000` el flujo se verificó completo
  (200, `CANCELADA` + `EN_CURSO`, sesión intacta, auditoría y serie posterior).
- **Smoke visual (Fernando, 2026-11-16)**: OK. La sección "Sesiones en curso" se ve en `Home_Interno` para
  instructor y administrador, el selector de candidatas funciona y el 409 se muestra en pantalla.

## Lecciones

- **Un test de concurrencia sin barrera mide timing, no el lock**. El de dos reasignaciones simultáneas pasaba
  igual con el `pg_advisory_xact_lock` comentado. El que detecta la falta del lock es el de serialización: A
  retiene el lock dentro de su callback, B no puede entrar, y sin lock B corre de inmediato. Es el mismo patrón
  que ya había pasado con la asignación.
- **La matriz de permisos es por prefijo**: colgar `POST /api/asignaciones/[id]/reasignar` obligaba a dar
  `POST` al INSTRUCTOR y al ADMIN en `/api/asignaciones`, lo que abría `POST /api/asignaciones/decidir` en el
  proxy (over-grant que el guardián marca). Un recurso propio (`/api/reasignaciones`) resolvió el RBAC sin
  excepciones.
- **La auditoría dentro de la transacción no se puede escribir con el helper global**: `registrarOperacion`
  usa el cliente de Prisma de siempre (`src/lib/audit.ts:59-72`), así que dentro de un `$transaction` hay que
  escribir con `tx.registroDeAuditoria.create`, como el override de acceso.
- **Tres caminos seguidos mostraron lo mismo**: cada flujo nuevo con transacciones interactivas de Prisma
  necesita los topes configurables por entorno (D-110), o falla contra una base remota. El cálculo, la sesión y
  ahora la reasignación. Un test de arquitectura chico —que falle si aparece un `timeout`/`maxWait` numérico
  fijo en `src/domains/asignacion/`— sería un seguro barato para el cuarto.

## Pasos manuales que quedan

1. **P-72** (diferido): saltar el ejercicio durante la sesión. Requiere mover `ejercicioActualId` y
   `serieActual` en `sesion-de-entrenamiento.ts`, que este change evitó a propósito.
2. Si el panel crece, evaluar paginar o filtrar por turno: hoy lista todas las sesiones abiertas ordenadas por
   hora de inicio.
3. **Contra una base remota**, subir `ASIGNACION_TIMEOUT_CALCULO_MS` y `ASIGNACION_MAX_WAIT_TRANSACCION_MS`
   antes de usar el panel: los mismos topes de D-110 ahora gobiernan también la transacción de reasignación
   (con los 2 s por defecto el `POST` devuelve 500 contra Supabase).
4. La segunda asociación de "Press inclinado" que se creó para el smoke quedó en la base de desarrollo; se
   puede dejar o quitar desde `/maquinas`. La sesión de prueba se finalizó como `INCOMPLETA` al cerrar el smoke.

## Qué NO se verificó

- El caso de dos reasignaciones simultáneas verifica el **estado final**, no el orden (lo cubre el test de
  serialización).
- La privacidad del panel más allá del alcance decidido: el instructor ve nombres de socios entrenando y su
  ejercicio.
- El socio no ve el cambio en su pantalla: se entera en el próximo recálculo (D-131).
