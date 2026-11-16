# Diseño — reasignacion-instructor

## 1. Contexto y restricciones

Change de **backend + UI del staff**, sin migraciones ni cambios al motor. Restricciones que mandan:

- **Solo cambia la máquina**: la sesión (`ejercicioActualId`, `serieActual`) no se toca (D-125/D-127).
- **Transacción bloqueada**: mismo `pg_advisory_xact_lock` que `calcularYReservar`
  (`src/domains/asignacion/asignacion-repositorio.ts:107-136`) (D-130).
- **Auditoría dentro**: `registrarOperacion` usa el cliente global (`src/lib/audit.ts:59-72`), así que acá se
  escribe con `tx.registroDeAuditoria.create`, como el override de acceso
  (`src/api/socios/access-override.ts:94-100`) (D-128).
- **Destino validado**: candidata + `DISPONIBLE` + libre (D-129).
- **RBAC con la trampa de D-99**: una entrada explícita del ADMIN recorta su comodín
  (`src/lib/authorization.ts:80`), así que al sumar `POST` hay que sumarlo en las dos entradas.

## 2. Mapa de capas y archivos

```
POST /api/reasignaciones   (route)
   └── handleReasignar (src/api/asignaciones.ts)
          └── reasignarMaquina (src/domains/asignacion/reasignacion.ts)
                 └── PuertoReasignacion (implementado por AsignacionRepository)
                        └── enTransaccionBloqueada + lock global
```

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/domains/asignacion/reasignacion.ts` | **nuevo** | reglas puras: validaciones, códigos de error y orquestación de la transacción |
| `src/domains/asignacion/asignacion-repositorio.ts` | modificado | método `enTransaccionDeReasignacion` que reusa el lock y expone las operaciones del puerto |
| `src/domains/asignacion/asignacion-escrituras.ts` | modificado | `cancelarEjecucion` (guard `EN_CURSO`) |
| `src/api/asignaciones.ts` | modificado | `handleReasignar` (body estricto, roles, mapeo a 409) |
| `src/app/api/reasignaciones/route.ts` | **nuevo** | rutas GET y POST, 401/403 |
| | `src/api/sesiones.ts` | modificado | `handleSesionesEnCursoStaff` + fetchers de cliente |
| `src/lib/authorization.ts` | modificado | `POST` para INSTRUCTOR y ADMIN en `/api/asignaciones` |
| `src/app/home-interno/page.tsx` | modificado | monta el panel |
| `src/components/home-interno/sesiones-en-curso.tsx` | **nuevo** | panel y acción |
| `tests/integration/reasignacion-instructor.integration.test.ts` | **nuevo** | lock + transición reales (lo corre Fernando) |

`prisma/schema.prisma`, `prisma/migrations/**`, `motor-espera.ts` y `orquestacion.ts`: **intactos**.

## 3. Contratos

### Dominio

```ts
export type CodigoReasignacion =
  | "ASIGNACION_NO_ENCONTRADA"
  | "ASIGNACION_YA_TERMINADA"
  | "MAQUINA_NO_CANDIDATA"
  | "MAQUINA_NO_DISPONIBLE"
  | "MAQUINA_OCUPADA";

export interface EntradaReasignacion {
  asignacionId: string;
  maquinaDestinoId: string;
  responsableId: string;
  ahora: Date;
}

export interface EjecucionEnCurso {
  id: string; socioId: string; sesionId: string; ejercicioId: string; maquinaId: string | null;
}

export interface TxReasignacion {
  leerEjecucion(id: string): Promise<EjecucionEnCurso | null>;
  leerSesion(sesionId: string): Promise<{ id: string; ejercicioActualId: string | null } | null>;
  esCandidata(ejercicioId: string, maquinaId: string): Promise<boolean>;
  estadoDeMaquina(maquinaId: string): Promise<"DISPONIBLE" | "OCUPADA" | "FUERA_DE_SERVICIO" | "INACTIVA" | null>;
  maquinaOcupada(maquinaId: string, socioId: string, ahora: Date): Promise<boolean>;
  cancelarEjecucion(id: string, sesionId: string): Promise<boolean>;
  crearEjecucionEnCurso(datos: {
    socioId: string; sesionId: string; ejercicioId: string; maquinaId: string; ahora: Date;
  }): Promise<{ id: string }>;
  registrarAuditoria(datos: {
    responsableId: string; detalles: Record<string, unknown>;
  }): Promise<void>;
}

export type ResultadoReasignacion =
  | { tipo: "ok"; asignacionId: string; maquinaId: string; maquinaNombre: string | null }
  | { tipo: "error"; codigo: CodigoReasignacion };
```

`reasignarMaquina(entrada, puerto)` corre **todo** dentro de `puerto.enTransaccionBloqueada`.

### HTTP

`POST /api/reasignaciones`

```jsonc
// request
{ "asignacionId": "cln...", "maquinaId": "clx..." }
// 200
{ "asignacionId": "cln...", "maquinaId": "clx...", "maquinaNombre": "Banco plano" }
// errores
{ "code": "MAQUINA_OCUPADA", "message": "Esa máquina está ocupada" }   // 409
```

`GET /api/reasignaciones`

```jsonc
[
  {
    "sesionId": "cln...", "socioId": "cln...", "socioNombre": "Santiago Socio",
    "horaInicio": "2026-11-12T17:41:00.000Z",
    "ejercicioId": "clv...", "ejercicioNombre": "Press inclinado",
    "asignacionId": "cln...", "maquinaId": "clv...", "maquinaNombre": "Banco plano",
    "candidatos": [{ "id": "clv...", "nombre": "Banco plano", "estado": "DISPONIBLE" }]
  }
]
```

## 4. Secuencia de la reasignación

```
reasignarMaquina({ asignacionId, maquinaDestinoId, responsableId, ahora }, repo)
└─ enTransaccionBloqueada(tx)                       // lock global, D-95
   1. ejecucion = tx.leerEjecucion(id)              // estado EN_CURSO
      └─ null → error ASIGNACION_NO_ENCONTRADA      // 404
   2. sesion = tx.leerSesion(ejecucion.sesionId)
      └─ null || sesion.ejercicioActualId !== ejecucion.ejercicioId
         → error ASIGNACION_YA_TERMINADA            // 409 (el socio avanzó)
   3. tx.esCandidata(ejercicioId, destino)   → false → MAQUINA_NO_CANDIDATA   // 409
   4. tx.estadoDeMaquina(destino) !== "DISPONIBLE" → MAQUINA_NO_DISPONIBLE    // 409
   5. tx.maquinaOcupada(destino, ejecucion.socioId, ahora) → true → MAQUINA_OCUPADA // 409
   6. tx.cancelarEjecucion(id, sesionId)  // updateMany id+sesionId+EN_CURSO
      └─ false → ASIGNACION_YA_TERMINADA           // 409 (carrera con el socio)
   7. tx.crearEjecucionEnCurso({ socioId, sesionId, ejercicioId, maquinaId: destino, ahora })
   8. tx.registrarAuditoria({ responsableId, detalles: {
        socioId, ejercicioId, asignacionOrigenId, maquinaOrigenId, maquinaDestinoId } })
```

Si cualquier paso lanza, la transacción revierte: no queda la fila cancelada sin la nueva (AC-574/AC-580).

### Ocupación del destino, sin inventar lógica

`tx.maquinaOcupada` reusa `aplicarOcupantes` (`src/domains/asignacion/asignacion-ocupacion.ts:84`) con una
entrada mínima de **una** máquina y `lectura.socioId = ejecucion.socioId`, para que la propia fila del socio
no cuente:

```ts
const maquina = { id: destino, estado: "DISPONIBLE", ocupante: undefined, cola: [] };
await aplicarOcupantes([maquina], { socioId, ahora, minutosInactividadSesion, excluirEjercicioIds: [] }, tx);
return maquina.ocupante !== undefined;
```

Con eso hereda gratis el corte de inactividad (D-105) y la regla de D-108 para sesiones sin fila.

`minutosInactividadSesion` sale de `leerConfiguracion()` dentro de la misma transacción (el puerto ya lo
expone, `src/domains/asignacion/asignacion-puerto.ts:78`).

### `cancelarEjecucion`

Nuevo método de escritura, espejo de `cancelarReserva` (`asignacion-escrituras.ts:52-59`) pero con otro guard:

```ts
updateMany({ where: { id, sesionId, estado: "EN_CURSO" }, data: { estado: "CANCELADA" } }) // count === 1
```

## 5. Lectura del staff

`handleSesionesEnCursoStaff()` en `src/api/sesiones.ts` (servidor):

1. `sesionDeEntrenamiento.findMany({ where: { estadoDeFinalizacion: "EN_CURSO", ejercicioActualId: { not: null } }, orderBy: { horaInicio: "asc" } })`
   con `socio.usuario.nombre` y `rutinaAsignada.rutina.ejercicios { ejercicioId, series, descanso }`.
2. Una consulta a `asignacionDeEjercicio` por los `sesionId` con `estado: "EN_CURSO"` (la más reciente por
   sesión, como hace `aplicarOcupantes`).
3. Una consulta a `EjercicioMaquina` + `Maquina` por los `ejercicioId` para `candidatos`.
4. Se arma el DTO; si falta la fila `EN_CURSO` o la máquina, se devuelven `null`.

Tres lecturas, sin escrituras y sin lock: es un panel de solo lectura.

## 6. RBAC

| Rol | `GET /api/reasignaciones` | `POST /api/reasignaciones` |
|---|---|---|
| INSTRUCTOR | ✅ | ✅ |
| ADMINISTRADOR | ✅ | ✅ |
| SOCIO | 403 | 403 |
| RECEPCIONISTA | 403 | 403 |

Matriz exacta (`src/lib/authorization.ts`):

```ts
INSTRUCTOR:    '/api/reasignaciones': ['GET', 'POST'],
ADMINISTRADOR: '/api/reasignaciones': ['GET', 'POST'],   // entrada explícita: recorta el comodín (D-99)
SOCIO:         sin entrada
RECEPCIONISTA: sin entrada
```

**Por qué un recurso propio**: la matriz es por prefijo. Colgar la reasignación de `/api/asignaciones`
obligaba a darle `POST` al INSTRUCTOR y al ADMIN en ese prefijo, y entonces el SOCIO habría quedado
habilitado en el proxy para `POST /api/asignaciones/decidir` por el mismo prefijo (el handler lo rechaza,
pero el guardián de consistencia lo marcaría como over-grant). `'/api/reasignaciones'` es un prefijo nuevo
con exactamente los roles que corresponden: cero excepciones en `authorization-consistency.test.ts`.

Los handlers igual repiten el chequeo de rol (defensa en profundidad, como el resto del proyecto).

## 7. UI

`src/components/home-interno/sesiones-en-curso.tsx` (client), montado en `Home_Interno` después de
`QuickActions` (`src/app/home-interno/page.tsx:257`), como bloque de ancho completo:

- Estado inicial: **no** dibuja el panel hasta saber que el rol puede (la página ya conoce el rol por
  `useAuth`); para INSTRUCTOR/ADMIN muestra un pulso chico mientras carga, sin pantalla completa (mismo
  criterio que el resto del portal).
- Filas: socio · ejercicio · máquina (o "sin máquina asignada") · hora de inicio, ordenadas por hora.
- Acción: un `<select>` con `candidatos` (deshabilitando los que no estén `DISPONIBLE`) + botón "Reasignar".
  El `POST` es la autoridad: si el destino está ocupado, el 409 se muestra en la fila y se refresca.
- Vacío: "No hay sesiones en curso".
- Después de reasignar: refresca la lista (una consulta, sin polling).
- Sin `Date.now()` en render: la hora de inicio se muestra como HH:MM con un `Intl.DateTimeFormat("es-AR")`
  a nivel de módulo (mismo patrón que `fmtFecha` en `src/app/home-socio/page.tsx:36`), formateando la fecha
  fija que llega del servidor. No se usa `formatHaceTiempo` porque necesita `hoy` y eso sí leería el reloj
  en render.

## 8. Pruebas

| Slice | Jest / Testing Library | Qué demuestra |
|---|---|---|
| S0 | `reasignacion.test.ts` con doble del puerto | las 5 validaciones, el orden de las llamadas, que el `create` va después del `cancel`, y que un fallo del `create` no deja la cancelación (el doble simula el throw) |
| S0 | `asignacion-repositorio.escrituras.test.ts` | `cancelarEjecucion` con el guard `EN_CURSO` (count 1 / count 0) |
| S1 | `sesiones/route.test.ts` | roles, DTO con y sin fila `EN_CURSO`, orden por `horaInicio`, sesiones finalizadas excluidas |
| S2 | `asignaciones.reasignar.test.ts` + `route.test.ts` | body estricto, 400/403/404/409, mapeo de cada código y matriz ↔ handler |
| S3/S4 | `sesiones-en-curso.test.tsx` | lista, vacío, select de candidatos, 409 visible, botón deshabilitado mientras envía |
| Integración | `tests/integration/reasignacion-instructor.integration.test.ts` | Postgres real: lock, transacción, dos filas (`CANCELADA` + `EN_CURSO`), auditoría y `409` cuando el socio terminó. **La escribe el agente y la corre Fernando con Docker** |
| Mutación | quitar `enTransaccionBloqueada` (o el guard) | la integración debe **fallar**; se documenta el resultado |

Reglas anti-frágiles: el doble del puerto es determinista (sin timers); la integración usa el `socioId` y los
`ejercicioId` sembrados por el propio test.

## 9. Slices definitivos

| # | Slice | Contenido | Base | Cota 1,5× |
|---|---|---|---|---|
| **S0** | Dominio | `reasignacion.ts`, `cancelarEjecucion`, `enTransaccionDeReasignacion` y unitarios | 220 | 330 |
| **S1** | Lectura del staff | `handleSesionesEnCursoStaff`, ruta, fetcher de cliente y tests | 160 | 240 |
| **S2** | Endpoint de reasignación | `handleReasignar`, ruta, matriz, mapper de códigos y tests | 200 | 300 |
| **S3** | Panel | `sesiones-en-curso.tsx` (lista + vacío) y montaje | 180 | 270 |
| **S4** | Acción | selector de candidatos, `POST`, 409, refresco | 150 | 225 |
| | **Total** | | **≈910** | **≈1.365** |

Orden: S0 → S1 → S2 → S3 → S4. Un commit por slice.

## 10. Decisiones de diseño

### D-132 · Un recurso propio para la reasignación: `GET`/`POST /api/reasignaciones`
- **Origen**: IA, adoptada (revisada durante S1).
- **Decisión**: `GET /api/reasignaciones` devuelve las sesiones abiertas con sus candidatas y
  `POST /api/reasignaciones` recibe `{ asignacionId, maquinaId }`.
- **Por qué**: la matriz es por prefijo. Colgarlo de `/api/asignaciones` obligaba a dar `POST` en ese prefijo
  al INSTRUCTOR y al ADMIN, lo que habilitaba también `POST /api/asignaciones/decidir` para ellos (over-grant
  que el guardián marca). Con un prefijo propio, los roles son exactos y no hace falta ninguna excepción.

### D-133 · La ocupación del destino se evalúa reusando `aplicarOcupantes`
- **Origen**: IA, adoptada.
- **Decisión**: `maquinaOcupada` llama `aplicarOcupantes` sobre una entrada mínima de una máquina con el
  `socioId` del reasignado (D-129).
- **Por qué**: hereda el corte de inactividad (D-105) y la regla D-108 sin duplicar SQL ni divergir del motor.

## 11. Riesgos y reversión

- **R1 · Transacción larga**: la validación de ocupación corre 3 consultas dentro del lock global; es una
  operación rara (emergencia) y el timeout de la transacción ya existe (`TIMEOUT_TRANSACCION_MS`, 2 s). Si
  aparece contención, se mide y se sube por entorno como D-110.
- **R2 · Sesión sin fila `EN_CURSO`**: el panel la muestra con `asignacionId: null`; la acción queda
  deshabilitada hasta que exista una fila (o se resuelve con `crearEjecucionEnCurso` en otra iteración).
- **R3 · Ocupación por sesión sin fila** (D-108): si el ejercicio del otro socio tiene varias candidatas, el
  destino puede parecer libre. Es la limitación conocida; el motor ya la acepta y la reasignación no la
  empeora.
- **R4 · El socio cierra la sesión en el medio**: el guard por `estado` da 0 → 409; la UI refresca.

Reversión: cinco commits independientes, sin migraciones. Revertir S3/S4 deja la API sin UI; revertir S1/S2
deja S0 sin llamantes; revertir S0 no deja rastro en la base (las filas creadas son estados válidos del
modelo).
