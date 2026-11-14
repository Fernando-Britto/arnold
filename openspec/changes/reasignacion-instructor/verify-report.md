# Verify Report — reasignacion-instructor (P-61)

- **Change**: `reasignacion-instructor` (P-61, cierre de la Etapa 5)
- **Rama**: `feat/reasignacion-instructor` (desde `dev`)
- **Fecha**: 2026-11-12
- **Alcance verificado**: 1 spec del change (AC-571…AC-585), decisiones D-125…D-133 y P-72, restricciones de
  capa y compuertas. La integración la corrió **Fernando** con Docker.
- **Veredicto**: **APROBADO CON OBSERVACIONES**

## Resumen

Los 15 criterios del change están cubiertos: 13 con tests unitarios o de componente que verifican
comportamiento, 1 (AC-581, el lock) verificado por la integración contra Postgres **según Fernando**, y 1
(AC-584, la sesión intacta) por la integración más la restricción de diff. Las 9 decisiones se cumplen sin
desviaciones de comportamiento. La única desviación es el recurso propio `/api/reasignaciones` (D-132
revisada), decidido durante la implementación para no abrir un over-grant en la matriz.

Compuertas verdes: `tsc`, `lint` (0 errores), `npm test` (282 suites / 3957 tests) y `build`. Una corrida
completa falló por timeout en `PuertaPage` (suite preexistente, bajo carga) y la siguiente pasó: se registra
como riesgo residual, no como defecto de este change. Las cuatro mutaciones independientes fallaron en el test
correcto.

## Cobertura de criterios

| AC | Test(s) | Estado |
|---|---|---|
| AC-571 | `src/app/home-interno/page-part1.test.tsx:146` "P-61: el panel… solo para instructor o admin"; `src/app/api/reasignaciones/route.test.ts:51` (403 a SOCIO/RECEPCIONISTA) | ✅ |
| AC-572 | `src/api/reasignaciones.test.ts:31` "arma el DTO…" + `:64` "sin fila EN_CURSO…"; `route.test.ts:63` (INSTRUCTOR/ADMIN leen) | ✅ |
| AC-573 | `src/api/reasignaciones.test.ts:89` verifica el `where` (`EN_CURSO` + `ejercicioActualId != null`) y `:102` el vacío; el doble solo expone `findMany` (sin escrituras) | ✅ |
| AC-574 | `src/domains/asignacion/reasignacion.test.ts:49` (cancela y crea, mismo `sesionId`/`ejercicioId`); integración "cancela la fila EN_CURSO y crea la nueva…" (según Fernando) | ✅ |
| AC-575 | `reasignacion.test.ts:66` "asigna máquina a una fila EN_CURSO sin máquina" | ✅ |
| AC-576 | `reasignacion.test.ts:128` "rechaza una máquina que no es candidata"; mutación (d) | ✅ |
| AC-577 | `reasignacion.test.ts:137` "rechaza una máquina que no está DISPONIBLE" | ✅ |
| AC-578 | `reasignacion.test.ts:148` "rechaza una máquina ocupada"; mutación (c); integración "rechaza una máquina ocupada por otro socio" | ✅ |
| AC-579 | `reasignacion.test.ts:108` (sesión avanzó) y `:119` (guard devuelve false); integración "una fila que el socio ya completó no se reasigna" | ✅ |
| AC-580 | `reasignacion.test.ts:83` "audita responsable, socio, ejercicio, máquina de origen y destino"; integración verifica la fila real en `RegistroDeAuditoria` | ✅ |
| AC-581 | `tests/integration/reasignacion-instructor.integration.test.ts` "serializa dos transacciones de reasignación"; mutación del lock verificada **según Fernando** | ✅ (solo integración) |
| AC-582 | `reasignaciones.test.ts:121` (`it.each` de bodies inválidos) y `:186` (`leerBodyReasignacion`) | ✅ |
| AC-583 | `route.test.ts:42,51,63` (401/403/200); `src/lib/authorization-consistency.test.ts` pasa **sin EXCEPCIONES nuevas**; mutación (b) | ✅ |
| AC-584 | `reasignacion.test.ts:49` (el doble no tiene métodos de sesión: una escritura no compilaría); integración verifica `SesionDeEntrenamiento` intacta; `git diff --name-only origin/dev...HEAD` no toca `sesion-de-entrenamiento.ts` | ✅ |
| AC-585 | `git diff --name-only origin/dev...HEAD` no incluye `prisma/` ni `motor-espera.ts` (comando en Restricciones) | ✅ |

**Ningún AC queda sin cobertura.**

## Decisiones del change

| D | Qué | Dónde se cumple |
|---|---|---|
| D-125 | v1 cambia máquina; saltar ejercicio → P-72 | `src/domains/asignacion/reasignacion.ts:1-10` (solo cambia la fila); `openspec/decisions.md:1852` (P-72) |
| D-126 | Panel en Home_Interno, INSTRUCTOR y ADMIN | `src/app/home-interno/page.tsx:261`; `src/lib/authorization.ts:51,82` |
| D-127 | La sesión sigue EN_CURSO | `reasignacion.ts` no toca sesión; diff sin `sesion-de-entrenamiento.ts`; integración verifica `ejercicioActualId` |
| D-128 | Auditoría **dentro** de la transacción | `src/domains/asignacion/asignacion-repositorio.ts:212-218` (`cliente.registroDeAuditoria.create` dentro de `$transaction`, no `registrarOperacion`) |
| D-129 | Destino candidata + DISPONIBLE + libre | `reasignacion.ts` (las tres validaciones); `asignacion-repositorio.ts:193-207` (`maquinaOcupada` con D-105/D-108) |
| D-130 | Lock global + guard | `asignacion-repositorio.ts:160-167` (lock) y `asignacion-escrituras.ts:59-68` (guard `EN_CURSO` + `sesionId`) |
| D-131 | Fuera de alcance: aviso al socio y recálculos | No hay código de notificación ni de recálculo en el diff |
| D-132 | Recurso propio `/api/reasignaciones` | `src/app/api/reasignaciones/route.ts`; `authorization.ts:51,82` |
| D-133 | Ocupación con `aplicarOcupantes` | `asignacion-repositorio.ts:195` (`await aplicarOcupantes(...)`) |

**Desviación declarada**: D-132 se revisó durante S1 — el endpoint pasó de `/api/asignaciones/[id]/reasignar`
a `/api/reasignaciones` para que la matriz por prefijo no abriera `POST /api/asignaciones/decidir` al
INSTRUCTOR y al ADMIN. Está documentada en `design.md` (D-132) y no agrega EXCEPCIONES al guardián.

## Restricciones (comandos y salida)

**La sesión no se tocó**

```
$ git diff --name-only origin/dev...HEAD | grep -E "sesion-de-entrenamiento|integracion-asignaciones"
(exit 1, sin coincidencias)
```

**RBAC exacto**

```
$ grep -n "reasignaciones" src/lib/authorization.ts
51:    '/api/reasignaciones': ['GET', 'POST'], // P-61: panel… (D-126)   ← INSTRUCTOR
82:      '/api/reasignaciones': ['GET', 'POST'], // P-61: … (D-126)      ← ADMINISTRADOR
$ npx jest src/lib/authorization-consistency.test.ts
Tests: 2 passed, 2 total          (sin EXCEPCIONES nuevas)
```

SOCIO y RECEPCIONISTA no tienen entrada → `403` (verificado en `route.test.ts:51`).

**`decidir` sigue siendo del SOCIO**

```
$ grep -n 'actor.rol !== "SOCIO"' src/api/asignaciones.ts
196:  if (actor.rol !== "SOCIO") return error(403, "FORBIDDEN", MENSAJE_FORBIDDEN);
```

**El lock es el mismo**

```
$ sed -n '114,126p;160,167p' src/domains/asignacion/asignacion-repositorio.ts
enTransaccionBloqueada (línea 124):  pg_advisory_xact_lock(${CLAVE_LOCK_INSTALACION}::bigint)
enTransaccionDeReasignacion (línea 165): pg_advisory_xact_lock(${CLAVE_LOCK_INSTALACION}::bigint)
```

**Reloj y colores en los archivos nuevos**

```
$ grep -nE "Date\.now|new Date\(|dark:|#[0-9a-fA-F]{3,6}" \
    src/domains/asignacion/reasignacion.ts src/api/reasignaciones.ts \
    src/api/reasignaciones-cliente.ts src/app/api/reasignaciones/route.ts \
    src/components/home-interno/sesiones-en-curso.tsx src/components/home-interno/hora.ts
src/app/api/reasignaciones/route.ts:63:    ahora: new Date(),
src/components/home-interno/hora.ts:15:  return formateador.format(new Date(iso));
```
Ninguno es una lectura del reloj en render: la ruta fija `ahora` en el borde (mismo patrón que
`src/app/api/asignaciones/sugerencia/route.ts`) y `hora.ts` **parsea una fecha fija** que viene del servidor.
No hay `dark:` ni colores fijos. `lint` en 0 errores lo confirma.

**DTOs compartidos con `import type`**

```
$ grep -n "import type" src/api/reasignaciones-cliente.ts
5:import type { RespuestaReasignacionDTO, SesionEnCursoStaffDTO } from "@/api/reasignaciones";
```

**Sin migraciones ni motor**

```
$ git diff --name-only origin/dev...HEAD | grep -E "^prisma/|motor-espera"
(exit 1, sin coincidencias)
```

**Auditoría**

Se registra **dentro** de la transacción bloqueada, con `cliente.registroDeAuditoria.create`
(`src/domains/asignacion/asignacion-repositorio.ts:212-218`): `tipoOperacion = MODIFICACION`, `responsableId`
= el usuario que reasigna y `detalles` con `socioId`, `ejercicioId`, `asignacionOrigenId`, `maquinaOrigenId`
(o `null`) y `maquinaDestinoId` (`reasignacion.ts:106-115`).

## Compuertas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | **exit 0** |
| Lint | `npm run lint` | **exit 0** — 0 errores, 96 warnings preexistentes |
| Tests | `npm test` | **282 suites / 3957 tests passed** (117,4 s en la última corrida) |
| Build | `npm run build` | **exit 0** — ✓ Compiled successfully in 9.3s |
| Integración | `DOCKER_HOST=unix:///var/run/docker.sock npm run test:integration` | **según Fernando**: 10 suites / 59 tests en verde (antes 9 / 54) |

**Nota sobre una corrida**: una ejecución completa falló con `PuertaPage › sin token configurado…` por
`Exceeded timeout of 20000 ms`; al correr `npx jest src/app/puerta` pasó (3/3) y la corrida completa siguiente
también (282/3957). Es flakiness por carga en una suite preexistente, ajena a este change.

## Mutaciones independientes

| Mutación | Test que falló |
|---|---|
| (a) quitar `estado: "EN_CURSO"` del guard de `cancelarEjecucion` | `asignacion-repositorio.escrituras.test.ts:49` "cancelarEjecucion usa el guard de estado EN_CURSO y de sesión" |
| (b) quitar el control de rol en la ruta | `route.test.ts:51` "el rol SOCIO recibe 403" + "el rol RECEPCIONISTA recibe 403" |
| (c) quitar la validación "destino libre" | `reasignacion.test.ts:148` "rechaza una máquina ocupada por otro socio" |
| (d) quitar la validación "destino es candidata" | `reasignacion.test.ts:128` "rechaza una máquina que no es candidata del ejercicio" |

Las cuatro se revirtieron con `git checkout -- <archivo>` y `git status --short` quedó vacío.

**Mutación del lock (según Fernando)**: con el test original de dos reasignaciones la mutación **no falló**
(medía timing); con el test de serialización nuevo (`tests/integration/reasignacion-instructor.integration.test.ts:186` "serializa dos transacciones de
reasignación") quitar el lock hace fallar ese test y al revertir vuelve a 59/59.

## Riesgos residuales

1. **Límite conocido del test de concurrencia**: el test de dos reasignaciones simultáneas verifica el
   **estado final**, no el orden; el orden lo prueba el test de serialización. No se agregó un hook de
   inyección en producción solo para testear (decisión de Fernando).
2. **Reservas ajenas no recalculadas** (D-102/D-131): las sugerencias son instantáneas y se refrescan en el
   próximo recálculo del socio.
3. **El socio no ve el cambio en pantalla**: el aviso es verbal; su UI se entera en el siguiente recálculo.
4. **Privacidad del panel**: el instructor ve nombres de socios entrenando y su ejercicio. Es el alcance
   decidido (D-126); no se muestran datos de pago ni de salud.
5. **Límites de la v1**: no se puede saltar el ejercicio (**P-72**); una sesión sin fila `EN_CURSO` no se
   puede reasignar desde el panel (el botón queda deshabilitado).
6. **Flakiness por carga** en `PuertaPage` (preexistente): no es de este change, pero conviene saberlo.

## Smoke manual (Fernando)

Datos del seed: `socio@arnold.test` (DNI 30123456, PIN 1234), `instructor@arnold.test`, `admin@arnold.test`,
`recepcion@arnold.test`; contraseña `Arnold2026!`.

**0 · Preparación** (en `/maquinas`, como admin): asegurate de que "Press inclinado" tenga **dos** máquinas
candidatas `DISPONIBLE` (por ejemplo "Banco plano" y "Polea alta"), para que el selector tenga opciones.

```bash
set +H
for r in admin recepcion socio instructor; do
  curl -s -c /tmp/$r.jar -X POST http://localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"'$r'@arnold.test","password":"Arnold2026!"}' \
    -o /dev/null -w "$r login %{http_code}\n"
done
```

**1 · Habilitar otro check-in** (tu cliente SQL):

```sql
update "Asistencia"
set "fechaHora" = "fechaHora" - interval '1 day'
where "socioId" = 'cmuyxlfai0016is2mdg2yd1pq'
  and "fechaHora" > now() - interval '1 day';
```

**2 · Check-in y sesión**

```bash
curl -s -b /tmp/recepcion.jar -X POST http://localhost:3000/api/acceso/check-in \
  -H 'content-type: application/json' -d '{"dni":"30123456","pin":"1234"}'
```

En el navegador, como socio: `/home-socio` → "Ir ahora" → "Empezar entrenamiento". La sesión queda abierta en
el ejercicio sugerido.

**3 · El instructor reasigna**

Navegador como `instructor@arnold.test` → `/home-interno` → sección **"Sesiones en curso"**: tiene que
aparecer el socio con su ejercicio y la máquina actual. Elegí otra máquina `DISPONIBLE` en el selector y tocá
**"Reasignar"**.

**4 · Verificación en SQL** (tu cliente):

```sql
-- Dos filas para la sesión: la anterior CANCELADA y la nueva EN_CURSO
select id, estado, "maquinaId", "creadaEn"
from "AsignacionDeEjercicio"
where "socioId" = 'cmuyxlfai0016is2mdg2yd1pq'
order by "creadaEn" desc limit 3;

-- La sesión sigue abierta y en el mismo ejercicio
select id, "estadoDeFinalizacion", "ejercicioActualId", "serieActual"
from "SesionDeEntrenamiento"
where "socioId" = 'cmuyxlfai0016is2mdg2yd1pq' and "estadoDeFinalizacion" = 'EN_CURSO';

-- La auditoría de la reasignación
select "tipoOperacion", "responsableId", "detalles", "fechaHora"
from "RegistroDeAuditoria"
order by "fechaHora" desc limit 1;
```

Esperado: la fila nueva `EN_CURSO` con la máquina elegida, la anterior `CANCELADA`, la sesión intacta y un
`MODIFICACION` con `socioId`, `ejercicioId`, `asignacionOrigenId`, `maquinaOrigenId` y `maquinaDestinoId`.

**5 · El socio sigue entrenando**: en su navegador, registrar una serie y finalizar la sesión sin errores.

**6 · Rechazo por máquina ocupada**: con otro socio entrenando en la máquina destino, el instructor intenta
reasignar a esa máquina → el panel muestra "Esa máquina está ocupada" y la fila original sigue `EN_CURSO`.

**7 · Acceso**: con `recepcion@arnold.test` y con `socio@arnold.test`, `Home_Interno` **no** muestra el panel
y el endpoint responde 403:

```bash
curl -s -o /dev/null -w "recepcion %{http_code}\n" -b /tmp/recepcion.jar http://localhost:3000/api/reasignaciones
curl -s -o /dev/null -w "socio %{http_code}\n"     -b /tmp/socio.jar     http://localhost:3000/api/reasignaciones
```

Esperado: `403` y `403`.

## Hallazgos

### Críticos
Ninguno.

### Altos
Ninguno.

### Medios
Ninguno.

### Bajos
1. **Test de concurrencia de estado final**: el caso de dos reasignaciones simultáneas no prueba el orden
   (lo cubre el test de serialización). Registrado como límite conocido, sin hook de producción.
2. **Flakiness preexistente de `PuertaPage` bajo carga**: una corrida completa superó el timeout de 20 s; la
   suite sola y la corrida siguiente pasaron. Ajeno a este change.
3. **Sesión sin fila `EN_CURSO`**: el panel la lista pero no permite reasignar (botón deshabilitado). Es
   coherente con AC-572; si se quiere resolver, es otro slice.
