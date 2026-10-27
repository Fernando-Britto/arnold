# Design: asignacion-integracion (Etapa 4 — Integración del motor de espera)

> Contrato de esta fase: solo diseño. No se modifica código, `prisma/`, `opencode.json` ni `decisions.md`.
> El motor puro `src/domains/asignacion/motor-espera.ts` se consume **tal cual**: no se toca su código,
> sus tipos, sus tests ni el guardián de dominios puros. No se agregan dependencias. No hay UI nueva:
> `/configuracion` suma exactamente tres campos.

## 1. Contexto y restricciones

La Etapa 3 dejó un motor determinista y puro (`calcularEspera(EntradaMotor): ResultadoMotor`) sin llamantes.
La Etapa 4 lo conecta con la operación real en tres momentos (check-in, inicio de rutina y fin de ejercicio),
persiste la reserva, la hace vencer sin cron y expone dos endpoints de lectura/decisión. La pantalla del socio,
la reasignación del instructor (P-61) y la simulación de tesis (P-62) quedan fuera.

Restricciones que mandan sobre el diseño:

- Un solo gimnasio/instalación (no existe entidad `Gimnasio`): la clave del advisory lock puede ser global.
- `evaluarYRegistrarAcceso` es el único punto posterior a la identidad que comparten recepción y puerta.
- `ConfiguracionDelSistema` se lee solo por `getConfiguracion()` (`src/lib/configuracion.ts`); el guardián
  `configuracion.guard.test.ts` falla si otro archivo de `src/` menciona el modelo.
- `src/domains` no puede tener un `import` estático de `@/lib/db` (`dominios-puros.guard.test.ts`).
- Las migraciones son a mano, aditivas y las aplica Fernando con `npx prisma migrate deploy`. Nunca
  `prisma migrate dev` (el índice de expresión `Maquina_nombre_ubicacion_key` no es representable en el schema).
- Los tests existentes de sesión y de acceso deben quedar verdes **sin ediciones**.

### Mapa de capas

| Capa | Archivo(s) | Prisma | Responsabilidad |
|---|---|---|---|
| Dominio puro | `src/domains/asignacion/motor-espera.ts` (sin cambios) | No | Calcular la sugerencia. Sin reloj, sin I/O. |
| Persistencia / puerto | `src/domains/asignacion/asignacion-repositorio.ts` (nuevo) | Sí, `await import("@/lib/db")` diferido | Lecturas deterministas, escrituras transaccionales, advisory lock. |
| Orquestación | `src/domains/asignacion/orquestacion.ts` (nuevo) | No | Armar la lectura, invocar el motor, decidir, persistir, contener errores/timeout. |
| Adaptador de sesión | `src/domains/sesion/integracion-asignaciones.ts` (nuevo) | No (recibe el cliente/`tx`) | Consumir la reserva, registrar/completar ejecuciones, disparar el recálculo. |
| Servicio HTTP | `src/api/asignaciones.ts` (nuevo) | No | Handlers puros respecto de Next, reglas de propiedad y rol. |
| Rutas | `src/app/api/asignaciones/{sugerencia,decidir}/route.ts` (nuevas) | No | Sesión, parseo, delegación, envelope HTTP. |
| Gancho de check-in | `src/api/acceso.ts` (modificado) | Ya usa Prisma diferido | Disparar el cálculo best-effort después de la asistencia. |

**Regla de importación**: solo la capa de persistencia y los módulos que ya lo hacían (`src/api/acceso.ts`,
`src/domains/sesion/sesion-de-entrenamiento.ts`) tocan Prisma, siempre con import diferido. La orquestación
nunca importa Prisma; recibe el puerto. La API HTTP no importa Prisma; usa el servicio.

## 2. Modelo de datos

### Modelo Prisma exacto

```prisma
enum EstadoAsignacion {
  RESERVADA
  EN_CURSO
  COMPLETADA
  CANCELADA
}

model AsignacionDeEjercicio {
  id             String   @id @default(cuid())
  socio          Socio    @relation(fields: [socioId], references: [id], onDelete: Cascade)
  socioId        String
  ejercicio      Ejercicio @relation(fields: [ejercicioId], references: [id], onDelete: Cascade)
  ejercicioId    String
  maquina        Maquina? @relation(fields: [maquinaId], references: [id], onDelete: SetNull)
  maquinaId      String?
  sesion         SesionDeEntrenamiento? @relation(fields: [sesionId], references: [id], onDelete: SetNull)
  sesionId       String?
  estado         EstadoAsignacion
  esperaSegundos Int
  ahorroSegundos Int
  creadaEn       DateTime
  venceEn        DateTime

  @@index([socioId, estado, venceEn])
  @@index([maquinaId, estado, creadaEn])
  @@index([sesionId])
  @@index([ejercicioId])
}
```

Relaciones inversas a agregar: `Socio.asignacionesDeEjercicio`, `Ejercicio.asignacionesDeEjercicio`,
`Maquina.asignacionesDeEjercicio`, `SesionDeEntrenamiento.asignacionesDeEjercicio`.

| Campo | Tipo | Nulo | Default | Decisión |
|---|---|---|---|---|
| `id` | `String` | No | `cuid()` | Igual que el resto del modelo. |
| `socioId` | `String` | No | — | FK `Cascade`: al borrar el socio desaparecen sus reservas (dato personal). |
| `ejercicioId` | `String` | No | — | FK `Cascade`: el borrado del ejercicio ya está bloqueado por `EjercicioEnRutina`/`RegistroDeProgreso` cuando hay uso real; la cascada solo elimina asignaciones de ejercicios nunca ejecutados. |
| `maquinaId` | `String?` | Sí | — | FK `SetNull`: el borrado de una máquina no rompe el historial ni la operación; una `RESERVADA` con máquina borrada deja de ser sugerencia vigente. |
| `sesionId` | `String?` | Sí | — | FK `SetNull`: el historial sobrevive al borrado de la sesión, igual que `RegistroDeProgreso.sesion`. Se fija al pasar a `EN_CURSO`. |
| `estado` | `EstadoAsignacion` | No | — | Cuatro valores persistidos. `VENCIDA` se deriva, nunca se escribe. |
| `esperaSegundos` | `Int` | No | — | Instantánea de `recomendado.espera` al crear la reserva. `>= 0`. |
| `ahorroSegundos` | `Int` | No | — | Instantánea de `resultado.ahorro` al crear la reserva. `>= 0`. |
| `creadaEn` | `DateTime` | No | — | `ahora` inyectado; clave de orden de la cola. Sin `@default(now())` para que el reloj sea el del llamante. |
| `venceEn` | `DateTime` | No | — | `creadaEn + minutosVencimientoReserva × 60 000 ms`; inmutable después. |

**Sin `actualizadaEn`**: no aporta al contrato y obliga a otra columna. La auditoría viva es el `estado` y
las fechas de la sesión/progreso.

### `VENCIDA` derivada, no persistida

Se persiste `RESERVADA | EN_CURSO | COMPLETADA | CANCELADA`. Una fila está vencida si
`estado = RESERVADA AND venceEn <= ahora`. Ninguna lectura ni job escribe `VENCIDA`. La fila vencida se
ignora en todas las lecturas y, si un recálculo la reemplaza o una decisión la cancela, pasa a `CANCELADA`.

### Snapshots `esperaSegundos` / `ahorroSegundos`

Se escriben solo al crear una fila con decisión del motor y no se recalculan al leer ni al cambiar la
configuración. Las filas `EN_CURSO` creadas por orden de rutina (sin reserva) no tienen medición: se
escriben `0/0` y se documentan como tales. Limitación declarada: `0/0` también puede ser una reserva
legítima de espera cero; la simulación de tesis (P-62) debe distinguir las filas de orden de rutina por su
origen operativo, no solo por el valor. No se agrega una columna `origen` en esta etapa para no ampliar el
contrato.

### Una sola reserva activa por socio: sin índice único parcial

**Decisión**: la regla se enforcea en aplicación, dentro de la transacción con advisory lock: cancelar las
`RESERVADA` no vencidas del socio y luego insertar la nueva. No se crea índice único parcial.

**Por qué**: PostgreSQL exige que el predicado de un índice parcial sea inmutable; `now()` no lo es, y
`venceEn > now()` no se puede expresar. Un índice `WHERE estado = 'RESERVADA'` bloquearía para siempre al
socio cuya reserva venció sin ser reemplazada (el vencimiento es perezoso y no reescribe filas), que es
justo el caso que el spec permite. El lock global + cancelar-y-insertar da la garantía sin esa trampa.
`EN_CURSO` puede coexistir con `RESERVADA` porque el predicado de la regla es solo `RESERVADA` no vencida.

## 3. Migración a mano

Dos carpetas, ambas aditivas, con el formato `prisma/migrations/YYYYMMDDHHMMSS_snake_case/migration.sql`.
Se separan para que la migración de la tabla cumpla "0 `DROP`/`ALTER` sobre tablas existentes" (AC-413)
mientras la de configuración hace el `ALTER TABLE ... ADD COLUMN` que exige su delta.

### `20261026120000_asignacion_ejercicio/migration.sql`

```sql
-- Etapa 4: tabla de asignaciones/reservas del motor de espera.
-- Aditiva: un tipo, una tabla, índices y FKs inline. Sin DROP ni ALTER sobre tablas existentes.

CREATE TYPE "EstadoAsignacion" AS ENUM ('RESERVADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');

CREATE TABLE "AsignacionDeEjercicio" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "maquinaId" TEXT,
    "sesionId" TEXT,
    "estado" "EstadoAsignacion" NOT NULL,
    "esperaSegundos" INTEGER NOT NULL,
    "ahorroSegundos" INTEGER NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsignacionDeEjercicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AsignacionDeEjercicio_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionDeEntrenamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AsignacionDeEjercicio_socioId_estado_venceEn_idx" ON "AsignacionDeEjercicio"("socioId", "estado", "venceEn");
CREATE INDEX "AsignacionDeEjercicio_maquinaId_estado_creadaEn_idx" ON "AsignacionDeEjercicio"("maquinaId", "estado", "creadaEn");
CREATE INDEX "AsignacionDeEjercicio_sesionId_idx" ON "AsignacionDeEjercicio"("sesionId");
CREATE INDEX "AsignacionDeEjercicio_ejercicioId_idx" ON "AsignacionDeEjercicio"("ejercicioId");

-- Rollback manual (solo al revertir la etapa):
-- DROP TABLE IF EXISTS "AsignacionDeEjercicio";
-- DROP TYPE IF EXISTS "EstadoAsignacion";
```

### `20261026120500_asignacion_configuracion/migration.sql`

```sql
-- Etapa 4: parámetros del motor de espera. Aditiva; las filas existentes reciben el default.
ALTER TABLE "ConfiguracionDelSistema"
  ADD COLUMN "segundosEjecucionSerie" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "minutosVencimientoReserva" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "minutosInactividadSesion" INTEGER NOT NULL DEFAULT 30;

-- Rollback manual (solo al revertir la etapa):
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "minutosInactividadSesion";
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "minutosVencimientoReserva";
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "segundosEjecucionSerie";
```

### Verificación contra Docker

1. `npx prisma generate` después de editar el schema (no es una migración).
2. `npx prisma validate`.
3. `npm run test:integration` (levanta `postgres:17-alpine` en `127.0.0.1:5433`, aplica **todas** las
   migraciones desde cero con `prisma migrate deploy` y corre la suite). Es la prueba de que el SQL escrito
   a mano aplica limpio.
4. `npx prisma migrate diff --from-url "postgresql://arnold:arnold@127.0.0.1:5433/arnold_test" --to-schema-datamodel prisma/schema.prisma --exit-code`
   con el contenedor dejado vivo (`npm run test:integration -- --keep`): **debe salir 0 y "No difference detected"**.
   Si el índice de expresión preexistente apareciera, primero se captura la salida del mismo comando en la
   rama base antes de esta change y se exige que la salida posterior sea **idéntica** (sin líneas nuevas).
   Ese es el criterio honesto: la change no introduce diferencias.
5. Prueba de fila existente (manual, una vez): levantar el contenedor, aplicar las migraciones **hasta la
   anterior** a `20261026120500`, insertar una fila de `ConfiguracionDelSistema`, aplicar la migración nueva
   con `prisma migrate deploy` y comprobar que la fila conserva sus valores y recibe `60/15/30`. Se puede hacer
   moviendo temporalmente la carpeta nueva fuera de `prisma/migrations`, o con un `db execute` del `ALTER`
   sobre una copia. No se agrega seed.
6. Fernando aplica en Supabase con `npx prisma migrate deploy` usando la conexión **directa** (las migraciones
   no funcionan por el pooler, P-28). Nunca `migrate dev`.

> Nota de entorno: al escribir este diseño el daemon de Docker no estaba disponible. Los comandos 3–4 son la
> puerta de CP1/CP2 y deben ejecutarse antes de considerar la migración "lista"; el SQL y los nombres siguen
> la convención de Prisma para que `migrate diff` no proponga cambios.

## 4. Máquina de estados

```
                         (sin fila)
                             │
        check-in / inicio / fin de ejercicio
                             ▼
                     ┌───────────────┐
        ESPERAR ────▶│   RESERVADA   │◀── recálculo crea una nueva
        recálculo ──▶│               │
        (reemplazo)  └───────┬───────┘
                             │ inicio/avance de sesión
                             ▼
                     ┌───────────────┐
                     │   EN_CURSO    │
                     └───────┬───────┘
              última serie   │   fin de sesión
                             ▼
                     ┌───────────────┐
                     │  COMPLETADA   │
                     └───────────────┘

  vence (RESERVADA + venceEn <= ahora): condición derivada, NO hay escritura ni estado VENCIDA.
  EN_CURSO → CANCELADA: solo reasignación/cancelación por instructor (P-61, Etapa 5). Fuera de alcance.
```

| # | Desde | Hacia | Disparador | Actor | Precondiciones | Reserva anterior |
|---|---|---|---|---|---|---|
| 1 | (sin fila) | `RESERVADA` | Check-in permitido con rutina activa | Servicio (gancho) | Acceso no `DENEGADO`; rutina `activa`; motor `exito` con `maquinaId != null`; recomendado en la rutina y máquina candidata | Se cancelan las `RESERVADA` no vencidas del socio en la misma transacción |
| 2 | (sin fila) | `RESERVADA` | Inicio de rutina | Servicio | Sesión creada; hay pendientes; motor `exito` | Cancelar la activa anterior antes de insertar |
| 3 | (sin fila) | `RESERVADA` | Fin de ejercicio | Servicio | Se completó la última serie; hay pendientes; motor `exito` | Cancelar la activa anterior antes de insertar |
| 4 | (sin fila) | `EN_CURSO` | Inicio/avance por orden de rutina sin reserva | Adaptador de sesión | El ejercicio no tenía reserva; máquina única o `null` | No aplica; no se crea `RESERVADA` |
| 5 | `RESERVADA` | `EN_CURSO` | Inicio de sesión | Adaptador de sesión | Reserva vigente (`venceEn > ahora`), máquina no nula | La fila se consume; se fija `sesionId` y `ejercicioActualId` |
| 6 | `RESERVADA` | `EN_CURSO` | Avance al siguiente ejercicio | Adaptador de sesión | Reserva vigente para el siguiente; `updateMany` con guard | La fila se consume; no se crea una segunda fila |
| 7 | `RESERVADA` | `CANCELADA` | `ESPERAR` del socio | API/servicio | Reserva vigente; `updateMany` con guard | La fila pasa a `CANCELADA`; no se crea otra |
| 8 | `RESERVADA` | `CANCELADA` | Recálculo con nueva recomendación | Servicio | Motor `exito` con máquina | Se cancela la activa anterior en la misma transacción |
| 9 | `RESERVADA` | `CANCELADA` | Recálculo en fallback (`sin_opciones`, `vacio`, `maquinaId null`) | Servicio | Cálculo sin recomendación persistible | Se cancela la activa anterior; no se crea fila |
| 10 | `EN_CURSO` | `COMPLETADA` | Última serie de trabajo prescrita | Adaptador de sesión | `numeroSerie >= prescripcion.series` | La fila de ejecución se completa |
| 11 | `EN_CURSO` | `COMPLETADA` | Fin de sesión | Adaptador de sesión | Sesión en curso | Todas las `EN_CURSO` restantes se completan (no se cancelan) |
| — | `RESERVADA` | (sin escritura) | Vencimiento | — | `venceEn <= ahora` | Se ignora en lecturas; sigue `RESERVADA` |
| — | `EN_CURSO` | `CANCELADA` | Reasignación de instructor | — | P-61 | **Fuera de alcance de esta change** |
| — | `RESERVADA` | `RESERVADA` | `ACEPTAR` | API/servicio | Reserva vigente | Sin transición: no cambia estado, `venceEn` ni id; idempotente |

Transiciones totales: **11 transiciones implementadas** (filas 1–11, incluidas las dos de creación por
orden de rutina), más **2 filas no-transición** (vencimiento derivado y `ACEPTAR`) y **1 fila fuera de
alcance** (`EN_CURSO → CANCELADA` por instructor). `COMPLETADA` y `CANCELADA` son terminales.

## 5. Concurrencia

**Decisión**: `pg_advisory_xact_lock` con **una clave constante global de la instalación**, adquirida al
inicio de la transacción interactiva que lee, calcula, cancela y escribe.

**Por qué no por máquina**: el motor elige la máquina comparando todas las candidatas y todas las colas; la
ganadora solo se conoce **después** de calcular. Un lock por máquina adquirido después de leer no protege la
lectura ni la instantánea de espera; solo serializaría el `INSERT`. La instalación es un único gimnasio, así
que la clave global no fragmenta nada y el volumen de check-in es bajo.

**Mecánica exacta con Prisma 6.19** (verificada en los tipos generados: `$transaction(fn, { maxWait, timeout })`,
`$queryRaw` y `$transaction` disponibles en el cliente y en `tx`):

```ts
export const CLAVE_LOCK_INSTALACION = 880_000_001;

async enTransaccionBloqueada<T>(
  fn: (tx: AsignacionTx) => Promise<T>,
  opciones: { maxWait?: number; timeout?: number } = {}
): Promise<T> {
  const cliente = await this.db();
  return cliente.$transaction(async (tx) => {
    // El lock es un SELECT: `$executeRaw` rechaza consultas que devuelven filas
    // ("Execute returned results"), así que va con `$queryRaw` e ignora la fila.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CLAVE_LOCK_INSTALACION}::bigint)`;
    return fn(new AsignacionRepository(tx));
  }, { maxWait: opciones.maxWait ?? 1000, timeout: opciones.timeout ?? TIMEOUT_CALCULO_MS });
}
```

`$queryRaw` es API pública de Prisma 6 y acepta tagged templates con parámetros (sin concatenar SQL ni usar la
variante `Unsafe`). **No se usa `$executeRaw`**: la ruta "execute" del engine de Prisma rechaza consultas que
devuelven filas (`Execute returned results`), y `pg_advisory_xact_lock` devuelve una columna `void`. El `::bigint`
fija el tipo del parámetro y evita la ambigüedad de overloads. El lock se toma como sentencia de nivel
superior (no dentro de un `WITH`: un CTE no materializado podría no ejecutarse).

**Garantía observable**:

1. Como máximo una `RESERVADA` no vencida por socio: dos recálculos concurrentes del mismo socio se serializan;
   el segundo ve la primera y la cancela antes de insertar.
2. La transacción que commitea después ve la reserva anterior en su cola, por lo que su `esperaSegundos`
   incluye la cola vigente al commit. La cola se ordena por `creadaEn, id`; con el mismo `ahora` inyectado el
   desempate es `id`, que preserva el orden de inserción en la práctica.
3. Atomicidad: cancelación, inserción y snapshot commitean juntos; si algo falla, no queda cancelación sin
   reemplazo.
4. Decisiones (`ACEPTAR`/`ESPERAR`) usan la misma transacción bloqueada, para no competir con un recálculo.

**Prueba en Docker (P-68)**: `tests/integration/asignacion-concurrencia.integration.test.ts` con dos socios,
rutinas activas y una única máquina `M1` candidata para ambos. Se ejecutan dos `calcularYReservar` con
`Promise.all` y el mismo `ahora`. Se verifica: exactamente dos `RESERVADA` sobre `M1`, una por socio; ningún
socio con dos activas; exactamente una de las dos respuestas tiene `esperaSegundos > 0` (la que commiteó
segundo vio a la primera en la cola); el orden leído coincide con `orderBy(creadaEn asc, id asc)`. Un segundo
test repite dos recálculos del **mismo** socio y exige una sola activa al final (la otra `CANCELADA`). Un
tercer test usa `enTransaccionBloqueada` para cancelar y luego lanzar; comprueba que la cancelación se revierte.

**Advertencia del pooler**: en Supabase con `?pgbouncer=true&connection_limit=1` las transacciones se serializan
por el pool, así que una prueba contra ese endpoint no distingue el lock de la serialización del pool. La prueba
de concurrencia **debe** correr contra el Postgres de Docker (sin pooler, pool por defecto mayor a 1). El pooler
sigue siendo válido para producción: `pg_advisory_xact_lock` es de transacción y las transacciones interactivas
ya fueron verificadas (P-28).

## 6. Repositorio y armado de `EntradaMotor`

Archivo: `src/domains/asignacion/asignacion-repositorio.ts`. Puerto + implementación + singleton
`asignacionRepository`, con el patrón de `MaquinaRepository`: clase, cliente inyectable y
`await import("@/lib/db")` como default. No hay `import` estático de Prisma; solo `import type`.

### Tipos del puerto

```ts
import type { Prisma } from "@prisma/client";
import type { Configuracion, ConfiguracionReader } from "@/lib/configuracion";
import type { EntradaMotor } from "./motor-espera";

export interface EjercicioDeRutinaLeido {
  ejercicioId: string;
  nombre: string;
  orden: number;
  series: number;
  descanso: number;
  candidatos: string[];
}

export interface RutinaActivaLeida {
  rutinaAsignadaId: string;
  ejercicios: EjercicioDeRutinaLeido[]; // orden asc, id asc
  nombres: Map<string, string>;          // ejercicioId -> nombre
}

export interface EntradaLeida {
  entrada: EntradaMotor;
  rutina: RutinaActivaLeida;
  configuracion: Configuracion;
  ejercicioActualId: string | null;      // sesión EN_CURSO del socio, si existe
}

export interface SugerenciaVigenteLeida {
  id: string;
  socioId: string;
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string;
  maquinaNombre: string | null;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: Date;
  venceEn: Date;
}

export interface UltimaAsignacionLeida {
  estado: "RESERVADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
  creadaEn: Date;
}

export interface NuevaReserva {
  socioId: string;
  ejercicioId: string;
  maquinaId: string;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: Date;
  venceEn: Date;
}

export interface LecturaEntrada {
  socioId: string;
  ahora: Date;
  minutosInactividadSesion: number;
  excluirEjercicioIds: string[];
}

export interface AsignacionTx {
  leerEntradaMotor(lectura: LecturaEntrada): Promise<EntradaLeida | null>;
  leerSugerenciaVigente(socioId: string, ahora: Date): Promise<SugerenciaVigenteLeida | null>;
  leerUltimaAsignacion(socioId: string): Promise<UltimaAsignacionLeida | null>;
  leerConfiguracion(): Promise<Configuracion>;
  cancelarReservasActivas(socioId: string, ahora: Date): Promise<number>;
  crearReserva(datos: NuevaReserva): Promise<{ id: string }>;
  consumirReserva(id: string, sesionId: string, ahora: Date): Promise<boolean>;
  cancelarReserva(id: string, ahora: Date): Promise<boolean>;
  completarEjecucion(sesionId: string, ejercicioId: string): Promise<number>;
  completarEjecucionesDeSesion(sesionId: string): Promise<number>;
  crearEjecucionEnCurso(datos: {
    socioId: string; sesionId: string; ejercicioId: string;
    maquinaId: string | null; ahora: Date;
  }): Promise<{ id: string }>;
}

export interface AsignacionPort extends AsignacionTx {
  tieneRutinaActiva(socioId: string): Promise<boolean>;
  leerSesionEnCurso(socioId: string): Promise<{ id: string; ejercicioActualId: string | null } | null>;
  resolverSocioPorUsuario(usuarioId: string): Promise<string | null>;
  existeSocio(socioId: string): Promise<boolean>;
  enTransaccionBloqueada<T>(
    fn: (tx: AsignacionTx) => Promise<T>,
    opciones?: { maxWait?: number; timeout?: number }
  ): Promise<T>;
}

export interface AsignacionDb extends ConfiguracionReader {
  asignacionDeEjercicio: {
    findFirst(args: Prisma.AsignacionDeEjercicioFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.AsignacionDeEjercicioFindManyArgs): Promise<unknown[]>;
    updateMany(args: Prisma.AsignacionDeEjercicioUpdateManyArgs): Promise<{ count: number }>;
    create(args: Prisma.AsignacionDeEjercicioCreateArgs): Promise<{ id: string }>;
  };
  rutinaAsignada: {
    findFirst(args: Prisma.RutinaAsignadaFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.RutinaAsignadaFindManyArgs): Promise<unknown[]>;
  };
  sesionDeEntrenamiento: {
    findFirst(args: Prisma.SesionDeEntrenamientoFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.SesionDeEntrenamientoFindManyArgs): Promise<unknown[]>;
  };
  registroDeProgreso: { findMany(args: Prisma.RegistroDeProgresoFindManyArgs): Promise<unknown[]> };
  ejercicioMaquina: { findMany(args: Prisma.EjercicioMaquinaFindManyArgs): Promise<unknown[]> };
  maquina: { findMany(args: Prisma.MaquinaFindManyArgs): Promise<unknown[]> };
  socio: { findUnique(args: Prisma.SocioFindUniqueArgs): Promise<unknown> };
  $queryRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<unknown[]>;
  $transaction<R>(
    fn: (tx: AsignacionDb) => Promise<R>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<R>;
}
```

`AsignacionDb` extiende `ConfiguracionReader` para no nombrar el modelo de configuración fuera del lector
único (lo exige `configuracion.guard.test.ts`). Los resultados de Prisma se castean a los DTO de dominio con
tipos explícitos, nunca con `any`. La implementación usa `as unknown as AsignacionDb` sobre el cliente real,
igual que `PrismaLike` en `src/api/acceso.ts`.

### Plan de lecturas, en orden

**0. Capacidad del cliente (D-103)**: `tieneRutinaActiva` comprueba primero que el cliente exponga
`asignacionDeEjercicio.findFirst`; si no (doble de Prisma viejo o código desplegado antes de la migración),
devuelve `false` sin lanzar y sin abrir transacción. Esto es lo que mantiene **una sola** `$transaction` en
los tests existentes de acceso, que la asertan con `toHaveBeenCalledTimes(1)`.

**1. Rutina activa del socio** (gate y prescripción):

```ts
rutinaAsignada.findFirst({
  where: { socioId, activa: true },
  orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }],
  select: {
    id: true,
    rutina: { select: { ejercicios: {
      orderBy: [{ orden: "asc" }, { id: "asc" }],
      select: { ejercicioId: true, series: true, descanso: true, orden: true,
                ejercicio: { select: { nombre: true } } },
    } } },
  },
});
```

Sin rutina activa: `leerEntradaMotor` devuelve `null` y no se invoca el motor.

**2. Candidatos** (`EjercicioMaquina`) de los ejercicios de la rutina:

```ts
ejercicioMaquina.findMany({
  where: { ejercicioId: { in: ejercicios.map((e) => e.ejercicioId) } },
  orderBy: [{ ejercicioId: "asc" }, { maquinaId: "asc" }],
  select: { ejercicioId: true, maquinaId: true },
});
```

El orden `maquinaId asc` fija la posición de desempate que usa el motor (D-85).

**3. Sesión EN_CURSO del socio** (para pendientes y exclusión del actual):

```ts
sesionDeEntrenamiento.findFirst({
  where: { socioId, estadoDeFinalizacion: "EN_CURSO" },
  orderBy: { horaInicio: "desc" },
  select: { id: true, ejercicioActualId: true },
});
```

**4. Series de trabajo de esa sesión** (una query, conteo en JS con el rango por prescripción):

```ts
registroDeProgreso.findMany({
  where: {
    sesionId,
    tipo: { in: ["NORMAL", "HASTA_EL_FALLO"] },
    numeroSerie: { not: null },
  },
  select: { ejercicioId: true, numeroSerie: true },
});
```

`seriesHechas(ejercicio) = count(filas con 1 <= numeroSerie <= prescripcion.series)`. `CALENTAMIENTO` y
`DROP_SET` no entran por el filtro de `tipo`; los registros pre-D-64 con `tipo` por defecto `NORMAL` cuentan.
Un ejercicio está pendiente si `seriesHechas < series`. Sin sesión EN_CURSO, todos los ejercicios de la rutina
son pendientes.

**5. Ejercicios de la entrada**: pendientes, en orden `orden asc, id asc`, menos
`excluirEjercicioIds ∪ {sesion.ejercicioActualId}`. Cada uno con `candidatos` del paso 2.

**6. Máquinas**: unión de `candidatos` de los ejercicios de la entrada, leída del catálogo:

```ts
maquina.findMany({
  where: { id: { in: unionCandidatos } },
  select: { id: true, estado: true },
});
```

Una máquina referenciada que no exista no se incluye; el motor ya tolera ids colgantes (D-83). Nunca se
escribe `Maquina.estado`.

**7. Ocupantes**: sesiones EN_CURSO de **otros** socios (P-67):

```ts
sesionDeEntrenamiento.findMany({
  where: {
    estadoDeFinalizacion: "EN_CURSO",
    socioId: { not: socioActual },
    ejercicioActualId: { not: null },
  },
  select: {
    id: true, socioId: true, ejercicioActualId: true, horaInicio: true,
    rutinaAsignada: { select: { rutina: { select: { ejercicios: {
      select: { ejercicioId: true, series: true, descanso: true },
    } } } } },
  },
});
```

Y las filas `EN_CURSO` de esos socios:

```ts
asignacionDeEjercicio.findMany({
  where: {
    estado: "EN_CURSO",
    socioId: { not: socioActual },
    maquinaId: { not: null },
  },
  orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
  select: { id: true, socioId: true, sesionId: true, ejercicioId: true, maquinaId: true, creadaEn: true },
});
```

**Vigencia (D-105)**: con `corte = new Date(lectura.ahora.getTime() - lectura.minutosInactividadSesion * 60_000)`,
se consultan los registros de actividad de todas las sesiones candidatas (unión de sesiones `EN_CURSO` y
`sesionId` de las filas `EN_CURSO`) en una query sin filtro de tipo:

```ts
registroDeProgreso.findMany({
  where: { sesionId: { in: idsDeSesiones } },
  select: { sesionId: true, fecha: true },
});
```

Para cada sesión, `ultimaActividad = max(fecha) ?? horaInicio`; para cada fila `EN_CURSO`,
`ultimaActividad = max(fecha de su sesionId) ?? creadaEn`. Solo se conservan las fuentes con
`ultimaActividad.getTime() >= corte.getTime()`: la comparación es inclusiva. El corte sale de `ahora` y del
parámetro inyectados por la orquestación; el repositorio no lee el reloj. Una sesión vieja y una fresca pueden
coexistir: la vieja se descarta y no aporta ocupante ni espera.

Reglas:

- Si hay fila `EN_CURSO` para la sesión y su `ejercicioId === sesion.ejercicioActualId`, la máquina es la de
  la fila. Si hay más de una fila para la misma sesión, se usa la de `creadaEn` más reciente y se registra la
  anomalía en el log.
- Si no hay fila, el ocupante solo se deriva cuando `ejercicioActualId` tiene **exactamente una** máquina
  candidata, leída de `EjercicioMaquina` para el ejercicio del ocupante (nunca de los pendientes del consultante:
  el ejercicio que hace otro socio normalmente no está entre ellos — defecto detectado en la integración de CP2).
  Con cero o varias, la sesión no aporta ocupante. **Limitación declarada**, tal como fija el spec; la orquestación
  crea la fila al iniciar cada ejercicio cuando la máquina es determinable.
- La prescripción (`series`, `descanso`) sale de la rutina de **esa sesión** (`rutinaAsignada.rutina`), que es
  la que el socio está ejecutando, aunque la asignación se haya desactivado después. Decisión D-101.
- `seriesRestantes` se calcula con la fórmula del spec. Se consultan todas las series de trabajo de las
  sesiones ocupantes en **una** query:

```ts
registroDeProgreso.findMany({
  where: {
    sesionId: { in: sesionesOcupantes.map((s) => s.id) },
    tipo: { in: ["NORMAL", "HASTA_EL_FALLO"] },
    numeroSerie: { not: null },
  },
  select: { sesionId: true, ejercicioId: true, numeroSerie: true },
});
```

  Se cuenta por `(sesionId, ejercicioId)` limitando `numeroSerie` a `1..prescripcion.series`. Si
  `seriesRestantes < 1`, el socio **no** es ocupante (D-87).

**8. Cola**: `RESERVADA` no vencidas de otros socios sobre las máquinas candidatas:

```ts
asignacionDeEjercicio.findMany({
  where: {
    estado: "RESERVADA",
    venceEn: { gt: ahora },
    socioId: { not: socioActual },
    maquinaId: { in: maquinasCandidatas },
  },
  orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
  select: { id: true, socioId: true, ejercicioId: true, maquinaId: true, creadaEn: true },
});
```

Para cada reserva se resuelve la prescripción del miembro en su rutina activa:

```ts
rutinaAsignada.findMany({
  where: { socioId: { in: sociosEnCola }, activa: true },
  orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }],
  select: { socioId: true, rutina: { select: { ejercicios: {
    select: { ejercicioId: true, series: true, descanso: true },
  } } } },
});
```

Cada miembro aporta `{ series, descanso }` de su `EjercicioEnRutina` para el `ejercicioId` reservado. Una fila
que no resuelve a una rutina activa **no aporta** y se registra la anomalía. Una reserva vencida no entra por
`venceEn > ahora`. `EN_CURSO` no es cola.

**9. Configuración**: `leerConfiguracion()` delega en `getConfiguracion(cliente)` dentro de la misma
transacción (o del cliente del puerto en la lectura sin lock) y devuelve `segundosEjecucionSerie`,
`minutosVencimientoReserva` y `minutosInactividadSesion` con defaults. La orquestación no hardcodea ninguno
de los tres. `minutosInactividadSesion` viaja en `LecturaEntrada` para que el repositorio calcule el corte de
ocupación; el repositorio no lee el reloj.

**10. Sugerencia vigente** (lectura de API y sesión): `findMany` con `take: 2`, `estado RESERVADA`,
`venceEn > ahora`, `maquinaId not null`, `orderBy(creadaEn desc, id desc)`. Si vinieran dos, se devuelve la
primera y se loguea la anomalía.

**P-67**: todas las consultas de ocupantes y cola llevan `socioId: { not: socioActual }`. El test dedicado
falla si se quita ese filtro.

## 7. Servicio de orquestación

Archivo: `src/domains/asignacion/orquestacion.ts`. No importa Prisma. Importa `calcularEspera` y los tipos del
motor, el puerto y el tipo `Configuracion` (solo tipo). Dependencias inyectables para test:

```ts
export const TIMEOUT_CALCULO_MS = 2000;
export const MARGEN_RESPUESTA_MS = 250; // race externo por encima del timeout de la transacción

export type MomentoCalculo = "CHECK_IN" | "INICIO_RUTINA" | "POST_EJERCICIO";

export interface CalcularYReservarInput {
  socioId: string;
  ahora: Date;
  momento: MomentoCalculo;
  excluirEjercicioIds?: string[];
}

export type ResultadoOrquestacion =
  | { tipo: "reservada"; asignacionId: string; ejercicioId: string; maquinaId: string;
      esperaSegundos: number; ahorroSegundos: number; venceEn: Date }
  | { tipo: "fallback"; motivo: "SIN_RUTINA" | "SIN_OPCIONES" | "VACIO" | "SIN_MAQUINA" }
  | { tipo: "contenido"; motivo: "INVALIDO" | "ERROR" | "TIMEOUT" };

export interface DepsOrquestacion {
  repositorio: AsignacionPort;
  motor: typeof calcularEspera;
}

export async function calcularYReservar(
  input: CalcularYReservarInput,
  deps?: Partial<DepsOrquestacion>
): Promise<ResultadoOrquestacion>;

export async function calcularSinReservar(
  input: { socioId: string; ahora: Date },
  deps?: Partial<DepsOrquestacion>
): Promise<{
  ejercicioId: string; ejercicioNombre: string;
  maquinaId: string | null; esperaSegundos: number;
} | null>;

export type ResultadoDecision =
  | { tipo: "aceptada"; reserva: SugerenciaVigenteLeida }
  | { tipo: "esperada" }
  | { tipo: "sin_sugerencia"; motivo: "NUNCA_EXISTIO" | "YA_NO_VIGENTE" }
  // Error contenido del servidor: la API lo mapea a 500 SERVER_ERROR (AC-484), nunca a 404/409.
  | { tipo: "contenido"; motivo: "ERROR" | "TIMEOUT" };

export async function decidirSugerencia(
  input: { socioId: string; accion: "ACEPTAR" | "ESPERAR"; ahora: Date },
  deps?: Partial<DepsOrquestacion>
): Promise<ResultadoDecision>;

export async function reservaVigente(
  input: { socioId: string; ahora: Date },
  deps?: Partial<DepsOrquestacion>
): Promise<SugerenciaVigenteLeida | null>;

export async function calcularEnCheckIn(
  input: { socioId: string; ahora: Date },
  deps?: Partial<DepsOrquestacion>
): Promise<void>;

// Puente usuario → socio para la API (el `id` del JWT es el de `Usuario`, no el de `Socio`).
export async function resolverSocioDeUsuario(
  usuarioId: string,
  deps?: Partial<DepsOrquestacion>
): Promise<string | null>;

export async function existeSocio(
  socioId: string,
  deps?: Partial<DepsOrquestacion>
): Promise<boolean>;
```

### Cálculo + reserva (forma exacta)

```ts
export async function calcularYReservar(input, deps = {}) {
  const { repositorio, motor } = resolverDeps(deps);
  try {
    if (!(await repositorio.tieneRutinaActiva(input.socioId))) {
      return { tipo: "fallback", motivo: "SIN_RUTINA" };
    }

    const trabajo = repositorio.enTransaccionBloqueada(async (tx) => {
      const configuracion = await tx.leerConfiguracion();
      const leida = await tx.leerEntradaMotor({
        socioId: input.socioId,
        ahora: input.ahora,
        minutosInactividadSesion: configuracion.minutosInactividadSesion,
        excluirEjercicioIds: input.excluirEjercicioIds ?? [],
      });
      if (!leida) return { tipo: "fallback", motivo: "SIN_RUTINA" } as const;

      const r = motor(leida.entrada);

      if (r.tipo === "invalido") {
        logError("invalido", { socioId: input.socioId, momento: input.momento, errores: r.errores });
        return { tipo: "contenido", motivo: "INVALIDO" } as const;
      }
      if (r.tipo === "vacio" || r.tipo === "sin_opciones") {
        await tx.cancelarReservasActivas(input.socioId, input.ahora);
        return { tipo: "fallback", motivo: r.tipo === "vacio" ? "VACIO" : "SIN_OPCIONES" } as const;
      }

      const maquinaId = r.recomendado.maquinaId;
      if (maquinaId === null) {
        await tx.cancelarReservasActivas(input.socioId, input.ahora);
        return { tipo: "fallback", motivo: "SIN_MAQUINA" } as const;
      }

      const pertenece = leida.rutina.ejercicios.some(
        (e) => e.ejercicioId === r.recomendado.ejercicioId && e.candidatos.includes(maquinaId)
      );
      if (!pertenece) {
        logError("invalido", { socioId: input.socioId, motivo: "recomendacion-fuera-de-rutina" });
        return { tipo: "contenido", motivo: "INVALIDO" } as const;
      }

      const venceEn = new Date(
        input.ahora.getTime() + configuracion.minutosVencimientoReserva * 60_000
      );
      await tx.cancelarReservasActivas(input.socioId, input.ahora);
      const reserva = await tx.crearReserva({
        socioId: input.socioId,
        ejercicioId: r.recomendado.ejercicioId,
        maquinaId,
        esperaSegundos: r.recomendado.espera,
        ahorroSegundos: r.ahorro,
        creadaEn: input.ahora,
        venceEn,
      });
      return {
        tipo: "reservada",
        asignacionId: reserva.id,
        ejercicioId: r.recomendado.ejercicioId,
        maquinaId,
        esperaSegundos: r.recomendado.espera,
        ahorroSegundos: r.ahorro,
        venceEn,
      } as const;
    }, { timeout: TIMEOUT_CALCULO_MS, maxWait: 1000 });

    return await conTimeout(trabajo, TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS);
  } catch (error) {
    logError("error", { socioId: input.socioId, momento: input.momento, error });
    return { tipo: "contenido", motivo: "ERROR" };
  }
}
```

Reglas de esta función:

- **Sin rutina activa**: una sola lectura barata (`tieneRutinaActiva`) y salida; no se abre transacción ni se
  invoca el motor. Es la condición que exige `member-access-check`.
- **Ventana de inactividad**: el servicio lee la configuración antes de la lectura y pasa
  `minutosInactividadSesion` junto con `ahora`; el repositorio calcula el corte con esos valores y nunca lee el
  reloj.
- **`sin_opciones`, `vacio` y `maquinaId null`**: fallback silencioso; cancelan la reserva activa anterior en
  la misma transacción y no crean fila. No se loguean como error (a lo sumo un `info`).
- **`invalido`**: error de servidor logueado con `socioId`, `momento` y `errores`; **no** cancela ni crea nada.
  También se trata como `invalido` una recomendación que no pertenece a la rutina o cuya máquina no es
  candidata (defensa contra una entrada mal armada).
- **`exito` persistible**: cancela la activa anterior y crea la nueva con snapshot y `venceEn` calculado desde
  el `ahora` inyectado. `cancelarReservasActivas` filtra `estado = RESERVADA AND venceEn > ahora`; las filas
  vencidas quedan como están (vencimiento perezoso).
- **Sin escritura de `Maquina.estado`**: en ningún camino.

### Timeout acotado

```ts
type Centinela = { readonly timeout: true };

async function conTimeout<T>(trabajo: Promise<T>, ms: number): Promise<T | ResultadoOrquestacion> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  trabajo.catch(() => undefined); // evita un unhandled rejection si la carrera ya terminó
  const limite = new Promise<Centinela>((resolve) => {
    temporizador = setTimeout(() => resolve({ timeout: true }), ms);
  });
  try {
    const r = await Promise.race([trabajo, limite]);
    if (typeof r === "object" && r !== null && "timeout" in r) {
      logError("timeout", { ms });
      return { tipo: "contenido", motivo: "TIMEOUT" };
    }
    return r;
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}
```

El valor es **2 000 ms** para la transacción (`timeout` de Prisma) y **2 250 ms** para la carrera externa. Si
se agota, Prisma aborta la transacción y libera el advisory lock; la respuesta del check-in no cambia. La
carrera externa es una red de seguridad: normalmente gana el rechazo de la transacción, que cae en el `catch`
y devuelve `contenido ERROR/TIMEOUT` sin propagar.

### Decisión `ACEPTAR` / `ESPERAR`

```ts
export async function decidirSugerencia(input, deps = {}) {
  const { repositorio } = resolverDeps(deps);
  return repositorio.enTransaccionBloqueada(async (tx) => {
    const reserva = await tx.leerSugerenciaVigente(input.socioId, input.ahora);

    if (reserva) {
      if (input.accion === "ACEPTAR") return { tipo: "aceptada", reserva } as const;
      const cancelada = await tx.cancelarReserva(reserva.id, input.ahora);
      if (!cancelada) return { tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" } as const;
      return { tipo: "esperada" } as const;
    }

    const ultima = await tx.leerUltimaAsignacion(input.socioId);
    const config = await tx.leerConfiguracion();
    const ventanaMs = config.minutosVencimientoReserva * 60_000;
    const reciente = ultima !== null && input.ahora.getTime() - ultima.creadaEn.getTime() <= ventanaMs;

    if (ultima?.estado === "RESERVADA" || (ultima?.estado === "CANCELADA" && reciente)) {
      return { tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" } as const;
    }
    return { tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" } as const;
  });
}
```

`ACEPTAR` es idempotente: no escribe, devuelve la misma fila y el mismo `venceEn`. `ESPERAR` usa
`updateMany` con guard (`estado = RESERVADA AND venceEn > ahora`), así que no cancela una fila que venció
entre la lectura y la escritura. La operación es transaccional bajo el mismo lock que el recálculo.

Regla **404 vs 409** (D-102): si no hay sugerencia vigente, se mira la última fila del socio por `creadaEn desc`.
Una `RESERVADA` (necesariamente vencida o sin máquina) o una `CANCELADA` creada dentro de la ventana de
vencimiento producen `409 SIN_SUGERENCIA_VIGENTE`; cualquier otro caso produce `404 SIN_SUGERENCIA`. La ventana
usa `minutosVencimientoReserva`, es determinista con el `ahora` inyectado y no deja un 409 eterno tras un
`ESPERAR` antiguo.

### Lectura informativa `siguienteEnOrden`

`calcularSinReservar` lee la configuración con el puerto, llama a `leerEntradaMotor` (sin lock, solo
lectura) pasando `ahora` y `minutosInactividadSesion`, invoca el motor y devuelve `r.siguienteEnOrden` con
el nombre resuelto desde `leida.rutina.nombres`. Si el resultado no es `exito`, si el
motor devuelve `invalido` o si algo falla, devuelve `null` y loguea; **nunca** lanza y **nunca** escribe. El
`EntradaLeida` ya excluye el ejercicio actual de una sesión EN_CURSO, así que la lectura no recomienda el
ejercicio que el socio está haciendo.

### Idempotencia y una sola reserva activa

- `ACEPTAR` repetido: mismo resultado, sin fila nueva.
- Un recálculo repetido con el mismo estado **no** es idempotente por diseño: cancela la anterior y crea una
  nueva (nuevo `id`). Lo que se garantiza es que queda **una sola** `RESERVADA` no vencida por socio.
- El lock serializa recálculos y decisiones; el `cancelarReservasActivas` + `crearReserva` van en la misma
  transacción. Un fallo revierte ambos.

## 8. Gancho de check-in

### Lugar exacto

En `src/api/acceso.ts`, dentro de `evaluarYRegistrarAcceso`, **después** del `await prisma.$transaction(...)`
de `Asistencia` + `AuditoriaAcceso` (línea 220 actual) y **antes** del `return` (línea 222). Se ejecuta solo si
`permitido` es `true` (la decisión no es `DENEGADO`). No se toca la firma pública, `CheckInResultado`,
`decidirAcceso`, `estadoCuotaSocio` ni la ventana de anti-passback.

```ts
if (permitido) {
  await dispararCalculoDeAsignacion({ socioId: socio.id, ahora });
}

return { /* exactamente el mismo objeto que hoy */ };

async function dispararCalculoDeAsignacion(input: { socioId: string; ahora: Date }): Promise<void> {
  try {
    // Import dinámico: este módulo también expone fetchers de cliente; no debe arrastrar
    // la capa de datos al bundle del navegador.
    const { calcularEnCheckIn } = await import("@/domains/asignacion/orquestacion");
    await calcularEnCheckIn(input);
  } catch (error) {
    console.error("[ASIGNACION][check-in]", {
      socioId: input.socioId,
      tipo: "error-no-contenido",
      error,
    });
  }
}
```

**Por qué no puede fallar el check-in**: la asistencia ya está confirmada en su propia transacción; el cálculo
abre **otra** transacción (no anidada) y `calcularEnCheckIn` contiene todos sus errores. El `try/catch` externo
es defensa en profundidad por si fallara el `import` o el propio servicio. El resultado del cálculo no se
agrega a `CheckInResultado` ni se devuelve al cliente.

### Por qué no `after()`

`after()` de Next 16 ejecuta trabajo después de enviar la respuesta, pero en serverless requiere `waitUntil`
y en Vercel no está verificado (P-28). Además complica el test determinista. Se usa un `await` acotado a
2 250 ms; la decisión es local al servicio y se puede revisitar cuando P-28 cierre, sin tocar el motor ni la
tabla. D-100.

### Test obligatorio de best-effort

`src/api/acceso-asignacion.test.ts` (archivo nuevo; `src/api/acceso.test.ts` no se edita):

1. Mock de `@/domains/asignacion/orquestacion` que **lanza** en `calcularEnCheckIn`. Se llama a
   `evaluarYRegistrarAcceso` con un socio permitido. Se verifica: `asistencia.create` y
   `auditoriaAcceso.create` llamados una vez; el resultado es idéntico al de un check-in sin cálculo; se
   logueó el error.
2. Mock que **rechaza** (fallo de persistencia). Mismas aserciones: la asistencia sigue registrada y la
   respuesta no cambia.
3. Check-in `DENEGADO`: el mock no se llama y la reserva existente no se toca.
4. Se conserva exactamente una `Asistencia` y una `AuditoriaAcceso` por intento.

El `ahora` del cálculo es el mismo `ahora` de la asistencia (se pasa tal cual).

## 9. Integración con la sesión

Archivo nuevo `src/domains/sesion/integracion-asignaciones.ts`; ediciones puntuales en
`src/domains/sesion/sesion-de-entrenamiento.ts`. El adaptador recibe el cliente Prisma o el `tx` y **no** hace
`import` estático de `@/lib/db`.

### Guarda de compatibilidad (D-103)

Los tests actuales mockean Prisma con un objeto que **no** tiene `asignacionDeEjercicio` ni `ejercicioMaquina`.
Para que sigan verdes sin ediciones, el adaptador detecta la capacidad del cliente inyectado:

```ts
interface ClienteConAsignaciones {
  asignacionDeEjercicio: {
    findFirst(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<unknown>;
  };
  ejercicioMaquina: { findMany(args: unknown): Promise<unknown[]> };
}

export function esClienteConAsignaciones(db: unknown): db is ClienteConAsignaciones {
  if (typeof db !== "object" || db === null) return false;
  const c = db as Record<string, unknown>;
  const a = c.asignacionDeEjercicio as Record<string, unknown> | undefined;
  const em = c.ejercicioMaquina as Record<string, unknown> | undefined;
  return (
    typeof a?.findFirst === "function" &&
    typeof a?.updateMany === "function" &&
    typeof a?.create === "function" &&
    typeof em?.findMany === "function"
  );
}
```

Si el cliente no la tiene, el adaptador es un no-op y la sesión se comporta **exactamente** como hoy. En
producción el modelo existe siempre; la guarda además permite desplegar el código antes de aplicar la
migración sin romper sesiones ni check-in (rollout aditivo). No captura errores reales de una base migrada:
si el modelo existe y la query falla, el error se propaga en los caminos donde la sesión debe ser atómica.

### Inicio de sesión

Antes de la transacción existente se lee la reserva vigente (best-effort, con guarda):

```ts
const reserva = esClienteConAsignaciones(prisma)
  ? await leerReservaVigenteParaSesion(prisma, input.socioId, ahora) // findFirst RESERVADA, venceEn > ahora, maquinaId not null
  : null;
```

Dentro de la transacción:

1. Se mantiene el `updateMany` que abandona la sesión anterior.
2. Se crea la sesión con `ejercicioActualId = reserva?.ejercicioId ?? primero?.ejercicioId ?? null` y
   `serieActual = primero o reserva ? 1 : null`.
3. Si hay `reserva`, se consume solo si su `ejercicioId` pertenece a la rutina de la sesión (`asignada.rutina`)
   y `consumirReserva(tx, reserva.id, sesion.id, ahora)` con guard (`estado = RESERVADA AND venceEn > ahora`).
   Si el guard devuelve `0` (venció/canceló en el medio) o el ejercicio no pertenece a la rutina, se actualiza
   la sesión a `primero.ejercicioId` y la reserva se deja para el vencimiento perezoso.
4. Si **no** hay reserva y el modelo está disponible, se crea una fila `EN_CURSO` para el primer ejercicio:
   `maquinaId` = la única candidata de `EjercicioMaquina`, o `null` si hay cero o varias. El snapshot de esa
   fila es `0/0` (§2). Si el ejercicio proviene de una reserva, no se crea otra fila: se consume la existente.

Después de la transacción, best-effort: `recalcularTrasSesion({ socioId, ahora, excluirEjercicioIds: [] })`.
La orquestación excluye el ejercicio actual de la sesión (el primero) y calcula para los restantes. El
recálculo se dispara con `import()` dinámico del servicio para no arrastrar la capa de datos al grafo del
cliente. Cualquier fallo se loguea y no rompe el inicio de sesión.

### Avance al completar un ejercicio

Dentro de la transacción de `registrarSerie`, cuando `numeroSerie >= actual.series` (última serie de trabajo):

1. Si el modelo está disponible, se lee la reserva vigente del socio.
2. Se intenta consumirla (`updateMany` con guard) **antes** de fijar el siguiente ejercicio, solo si su
   `ejercicioId` pertenece a la rutina de la sesión. Si se consume, `siguienteEjercicioId = reserva.ejercicioId`,
   `siguienteSerie = 1`, y no se crea fila nueva. Si no se consume (venció, canceló o no pertenece a la rutina),
   se usa el siguiente por orden de rutina.
3. Se ejecuta el `updateMany` de la sesión con el guard optimista que ya existe.
4. Se completa la ejecución del ejercicio terminado:
   `completarEjecucion(sesionId, ejercicioId)` → `EN_CURSO` a `COMPLETADA`.
5. Si el siguiente vino por orden de rutina, se crea su fila `EN_CURSO` (máquina única o `null`).
6. Se crea el `RegistroDeProgreso` y los drops, como hoy.

Después de la transacción, best-effort: `recalcularTrasSesion({ socioId, ahora, excluirEjercicioIds: [input.ejercicioId] })`.
La orquestación suma el `ejercicioActualId` actual (el siguiente) y calcula para los restantes. Si no quedan,
el resultado es `vacio` y cancela la reserva activa anterior.

El calentamiento no mueve la sesión y por lo tanto no dispara ni consumo ni recálculo; se mantiene el
`return` temprano actual.

### Fin de sesión

`finalizarSesion` envuelve la actualización de la sesión y la finalización de ejecuciones en una transacción.
Si el modelo está disponible: `completarEjecucionesDeSesion(sesionId)` pasa a `COMPLETADA` todas las filas
`EN_CURSO` de la sesión (no a `CANCELADA`: el socio terminó, no abandonó). Si la sesión ya estaba finalizada,
se mantiene el retorno idempotente sin tocar asignaciones.

### Fallback sin asignaciones

Sin reserva vigente, `iniciarSesion`, `registrarSerie` y `finalizarSesion` conservan firmas, resultados y
efectos actuales: `ejercicioActualId` sigue el orden de rutina, `serieActual` avanza igual y el registro de
progreso no cambia. **Los tests existentes de sesión quedan verdes sin ediciones**; la suite nueva
`sesion-asignaciones.test.ts` cubre el camino con modelo presente.

## 10. Configuración

Los tres parámetros siguen el patrón D-54 sin crear un segundo lector.

| Capa | Archivo | Cambio exacto |
|---|---|---|
| Dominio | `src/domains/configuracion/configuracion.ts` | Agregar a `CAMPOS_CONFIGURACION`: `segundosEjecucionSerie: { tipo: "entero", min: 1, max: 3600 }`, `minutosVencimientoReserva: { tipo: "entero", min: 0, max: 1440 }` y `minutosInactividadSesion: { tipo: "entero", min: 1, max: 1440 }`. El orden de las claves fija el de validación; van al final. |
| Lector único | `src/lib/configuracion.ts` | Agregar a `Configuracion`: `segundosEjecucionSerie: number; minutosVencimientoReserva: number; minutosInactividadSesion: number`. Agregar a `CONFIGURACION_POR_DEFECTO`: `60`, `15` y `30`. Agregar a `normalizarFila`: `fila?.segundosEjecucionSerie ?? d.segundosEjecucionSerie` y los equivalentes para los otros dos. |
| Auditoría | `src/lib/configuracion.ts` | Sin cambio: `actualizarConfiguracion` recorre `Object.keys(CONFIGURACION_POR_DEFECTO)` y ya audita cualquier campo nuevo con `antes`/`despues` en la misma transacción. |
| API | `src/app/api/configuracion/route.ts` | Sin cambio: `validarCambiosConfiguracion` y el mapeo de errores ya cubren los campos nuevos. |
| Panel | `src/app/configuracion/page.tsx` | Agregar el grupo `{ titulo: "Motor de espera", campos: ["segundosEjecucionSerie", "minutosVencimientoReserva", "minutosInactividadSesion"] }`, las etiquetas `"Duración de la serie (segundos)"`, `"Vencimiento de la reserva (minutos)"` e `"Inactividad de sesión (minutos)"`, y los tres campos en `aFormulario` con `String(config.…)`. El render, la validación cliente y `handleApiError` se reutilizan. |

Rangos y mensajes del `PUT` (todos en español, sin mensajes nuevos):

| Entrada inválida | Resultado |
|---|---|
| `segundosEjecucionSerie = 0` | `400 VALIDATION_ERROR` — "segundosEjecucionSerie debe estar entre 1 y 3600" |
| `segundosEjecucionSerie = 3601` | `400 VALIDATION_ERROR` — mismo mensaje |
| `segundosEjecucionSerie = 60.5` | `400 VALIDATION_ERROR` — "segundosEjecucionSerie debe ser un número entero" |
| `minutosVencimientoReserva = -1` | `400 VALIDATION_ERROR` — "minutosVencimientoReserva debe estar entre 0 y 1440" |
| `minutosVencimientoReserva = 1441` | `400 VALIDATION_ERROR` — mismo mensaje |
| `minutosVencimientoReserva = NaN` / `Infinity` / string | `400 VALIDATION_ERROR` — "minutosVencimientoReserva debe ser un número" |
| `minutosInactividadSesion = 0` | `400 VALIDATION_ERROR` — "minutosInactividadSesion debe estar entre 1 y 1440" |
| `minutosInactividadSesion = -1` / `1441` | `400 VALIDATION_ERROR` — mismo mensaje |
| `minutosInactividadSesion = 30.5` | `400 VALIDATION_ERROR` — "minutosInactividadSesion debe ser un número entero" |
| `minutosInactividadSesion = NaN` / `Infinity` / string | `400 VALIDATION_ERROR` — "minutosInactividadSesion debe ser un número" |

Defaults y semántica: `segundosEjecucionSerie = 60` (duración estimada de una serie, alimenta
`parametros.segundosEjecucionSerie`), `minutosVencimientoReserva = 15` (vigencia de una reserva nueva; `0` la
hace nacer vencida) y `minutosInactividadSesion = 30` (ventana de actividad para que una sesión o fila
`EN_CURSO` cuente como ocupante). El rango `1–1440` de la inactividad se propone porque `0` haría que toda
sesión quedara inactiva al instante y no tiene uso operativo. Un cambio de minutos de reserva afecta solo a
reservas nuevas; un cambio de segundos afecta solo a cálculos posteriores; un cambio de inactividad afecta
solo a lecturas posteriores. El panel muestra los rangos desde `CAMPOS_CONFIGURACION`; el cliente no envía un
valor inválido.

## 11. API

### Archivos y firmas

```ts
// src/api/asignaciones.ts
import type { UserRole } from "@/lib/authorization";

export interface ActorAsignaciones { usuarioId: string; rol: UserRole }

export interface SolicitudSugerencia {
  actor: ActorAsignaciones;
  socioIdQuery: string | null;
  ahora: Date;
}
export interface SolicitudDecision {
  actor: ActorAsignaciones;
  body: unknown;
  ahora: Date;
}

export interface SugerenciaDTO {
  asignacionId: string;
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string;
  maquinaNombre: string | null;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: string;   // ISO 8601 UTC
  venceEn: string;    // ISO 8601 UTC
}

export interface SiguienteDTO {
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string | null;
  esperaSegundos: number;
}

export interface RespuestaSugerencia {
  socioId: string;
  sugerencia: SugerenciaDTO | null;
  siguienteEnOrden: SiguienteDTO | null;
  calculadoEn: string; // ISO 8601 UTC
}

export interface RespuestaDecision {
  accion: "ACEPTAR" | "ESPERAR";
  sugerencia: SugerenciaDTO | null;
  siguienteEnOrden: SiguienteDTO | null;
}

export type ResultadoHandler<T> =
  | { status: number; body: T }
  | { status: number; body: { code: string; message: string } };

export async function handleObtenerSugerencia(
  solicitud: SolicitudSugerencia
): Promise<ResultadoHandler<RespuestaSugerencia>>;

export async function handleDecidirSugerencia(
  solicitud: SolicitudDecision
): Promise<ResultadoHandler<RespuestaDecision>>;
```

Rutas:

- `src/app/api/asignaciones/sugerencia/route.ts` → `GET`.
  `const ALLOWED_ROLES = ["SOCIO", "ADMINISTRADOR", "INSTRUCTOR"];`
- `src/app/api/asignaciones/decidir/route.ts` → `POST`.
  `const ALLOWED_ROLES = ["SOCIO"];`

Ambas: `extractUserFromRequest` → 401; rol fuera de `ALLOWED_ROLES` → 403; `const ahora = new Date()` en el
borde; delegación al handler; `NextResponse.json(body, { status })`. `POST` usa `readJsonBody` (400 estable).
El handler no conoce `NextRequest`.

### Matriz de permisos (exacta)

```ts
SOCIO:         { '/api/asignaciones': ['GET', 'POST'] }
INSTRUCTOR:    { '/api/asignaciones': ['GET'] }
RECEPCIONISTA: { /* sin entrada */ }
ADMINISTRADOR: { '/api/asignaciones': ['GET'] } // entrada explícita: recorta el comodín '*' para POST
```

El `ADMINISTRADOR` necesita la entrada explícita porque su `'*'` concede `POST`; `matchBasePath` elige el
prefijo más largo y la entrada explícita gana. `RECEPCIONISTA` no tiene entrada y recibe `403`; sin sesión,
`401`. El test de consistencia (`authorization-consistency.test.ts`) lee `ALLOWED_ROLES` de cada route y exige
`roles(matriz) ⊆ roles(handler)`.

### Regla fina por rol y propiedad

`handleObtenerSugerencia`:

- `SOCIO`: el socio sale de la sesión (`resolverSocioDeUsuario(actor.usuarioId)`); si no existe, `404
  NOT_FOUND` "Socio no encontrado". Si viene `socioId` en la query —aunque sea el propio—, `403 FORBIDDEN`.
- `ADMINISTRADOR` / `INSTRUCTOR`: `socioId` es obligatorio; ausente o vacío → `400 VALIDATION_ERROR`;
  inexistente → `404 NOT_FOUND` "Socio no encontrado".
- Si el socio **no tiene rutina activa**, devuelve `200` con `sugerencia: null` y `siguienteEnOrden: null`
  aunque exista una fila `RESERVADA` obsoleta de una rutina desactivada (AC-481). La comprobación es
  `tieneRutinaActiva` antes de leer la sugerencia.
- Devuelve `200` con `socioId`, `sugerencia` (o `null`), `siguienteEnOrden` (o `null`) y `calculadoEn`.
  No escribe.

`handleDecidirSugerencia`:

- Solo `SOCIO`; cualquier otro rol → `403 FORBIDDEN` (defensa en profundidad; la matriz ya lo bloquea).
- El socio sale de la sesión; `socioId` en el body está prohibido.
- Body estricto: objeto plano; solo la clave `accion`; valor exactamente `"ACEPTAR"` o `"ESPERAR"`.
  Clave desconocida (incluido `socioId`, `ejercicioId`, `maquinaId`), cuerpo no objeto o acción distinta →
  `400 VALIDATION_ERROR`. No hay campo para elegir máquina.
- `ACEPTAR` → `200` con la misma reserva y el mismo `venceEn`; repetir devuelve lo mismo.
- `ESPERAR` → `200` con `sugerencia: null`; la fila pasa a `CANCELADA`.
- `siguienteEnOrden` se calcula después de la decisión con `calcularSinReservar`; si falla, `null` y log, sin
  romper el `200`.
- Sin sugerencia: `404 SIN_SUGERENCIA` si nunca existió; `409 SIN_SUGERENCIA_VIGENTE` si la última fila es una
  `RESERVADA` vencida o una `CANCELADA` dentro de la ventana (D-102).

### Contrato de respuesta y errores

- JSON estable; timestamps `toISOString()` (ISO 8601 UTC); segundos enteros; `null` explícito.
- La sugerencia devuelta es la fila persistida; la API no inventa una sugerencia calculada.
- `GET` es estrictamente lectura; repetirlo no crea filas.
- No se exponen `estado`, `sesionId` ni datos internos.

| Situación | Status | Código | Mensaje |
|---|---|---|---|
| Body/query inválidos | 400 | `VALIDATION_ERROR` | "La solicitud no es válida" + detalle del campo |
| Sin sesión | 401 | — | Lo resuelve la ruta/middleware |
| Rol sin permiso o socio ajeno | 403 | `FORBIDDEN` | "No tiene permiso para realizar esta acción" |
| Socio inexistente | 404 | `NOT_FOUND` | "Socio no encontrado" |
| Sin sugerencia | 404 | `SIN_SUGERENCIA` | "No hay una sugerencia vigente" |
| Sugerencia vencida/cancelada | 409 | `SIN_SUGERENCIA_VIGENTE` | "La sugerencia ya no está vigente; vuelva a consultar" |
| Fallo de persistencia | 500 | `SERVER_ERROR` | "No se pudo procesar la solicitud" |

`route-error-mapper` gana dos ramas explícitas (mismo estilo que las existentes):
`SIN_SUGERENCIA → 404` y `SIN_SUGERENCIA_VIGENTE → 409`. Un `invalido` en el cálculo de `siguienteEnOrden`
no se convierte en 500: se degrada a `null` y se loguea.

## 12. Decisiones registradas (D-88+)

Listas para pegar en `openspec/decisions.md`. Las D-88 a D-92 son decisiones de Fernando ya fijadas en la
propuesta; las D-93 a D-108 son propuestas de la IA adoptadas por este diseño y sujetas a su aprobación
explícita al revisar el artefacto.

### Decisiones de Fernando (vinculantes)

#### D-88 · El cálculo se dispara en el check-in y en dos momentos más
- **Origen**: Fernando (propuesta, decisión 1).
- **Contexto**: el motor de Etapa 3 no tenía llamante; el check-in es el único evento compartido entre recepción y puerta.
- **Decisión**: la reserva provisional se crea en el check-in permitido, con rutina activa, y se recalcula al iniciar rutina y al completar cada ejercicio.
- **Por qué**: anclar en `evaluarYRegistrarAcceso` evita duplicar lógica entre rutas; los tres momentos cubren la operación completa.
- **Dónde**: `src/api/acceso.ts`, `src/domains/asignacion/orquestacion.ts`, `src/domains/sesion/sesion-de-entrenamiento.ts`.

#### D-89 · La reserva vence a los 15 minutos, configurable
- **Origen**: Fernando (propuesta, decisión 2).
- **Contexto**: sin vencimiento, un socio que hace check-in y se va bloquea la cola.
- **Decisión**: `venceEn = creadaEn + minutosVencimientoReserva × 60 000 ms`, con 15 por defecto y `0` como vencimiento inmediato. `venceEn` es inmutable.
- **Por qué**: el vencimiento perezoso libera la cola sin job; el snapshot evita que un cambio de configuración reescriba reservas históricas.
- **Dónde**: `AsignacionDeEjercicio.venceEn`, `src/domains/asignacion/orquestacion.ts`, spec `asignacion-orquestacion`.

#### D-90 · Tres parámetros nuevos en `/configuracion`
- **Origen**: Fernando (propuesta, decisión 3; ampliada con la ventana de inactividad por la revisión externa).
- **Contexto**: el motor necesita la duración de serie, la vigencia de reserva y la ventana de actividad de una sesión sin hardcodearlas.
- **Decisión**: `segundosEjecucionSerie` (entero, default 60, rango 1–3600), `minutosVencimientoReserva` (entero, default 15, rango 0–1440) y `minutosInactividadSesion` (entero, default 30, rango 1–1440), por el patrón D-54.
- **Por qué**: reutiliza lector único, validación, auditoría y panel ya probados; no crea un segundo lector.
- **Dónde**: `src/domains/configuracion/configuracion.ts`, `src/lib/configuracion.ts`, `src/app/configuracion/page.tsx`.

#### D-91 · Solo se calcula para socios con rutina activa
- **Origen**: Fernando (propuesta, decisión 4).
- **Contexto**: el motor necesita ejercicios pendientes; sin rutina activa no hay nada que calcular.
- **Decisión**: sin `RutinaAsignada.activa = true`, el check-in y la sesión se comportan exactamente como hoy y no se invoca el motor.
- **Por qué**: evita ruido, consultas y reservas inútiles; conserva la retrocompatibilidad.
- **Dónde**: `calcularYReservar` (gate `tieneRutinaActiva`), `member-access-check`.

#### D-92 · Flujo obligatorio `ACEPTAR` / `ESPERAR`
- **Origen**: Fernando (propuesta, decisión 5 y 6).
- **Contexto**: el flujo obligatorio es el objeto de la tesis; permitir elegir máquina lo invalidaría.
- **Decisión**: el socio solo acepta la recomendación vigente o espera el orden de rutina. No hay tercera opción ni elección libre de máquina. La reasignación por instructor queda en Etapa 5 (P-61).
- **Por qué**: acota el alcance y mantiene medible la comparación motor vs. orden de rutina.
- **Dónde**: `POST /api/asignaciones/decidir`, `src/domains/asignacion/orquestacion.ts`; `EN_CURSO → CANCELADA` no se implementa.

### Propuestas de la IA adoptadas por el diseño

#### D-93 · Tabla `AsignacionDeEjercicio` con cuatro estados persistidos
- **Origen**: IA, adoptada.
- **Contexto**: la reserva existe antes de la sesión y debe vencer sin contaminar `SesionDeEntrenamiento`.
- **Decisión**: modelo `AsignacionDeEjercicio` y enum `EstadoAsignacion` con `RESERVADA | EN_CURSO | COMPLETADA | CANCELADA`. `VENCIDA` no se persiste: se deriva con `estado = RESERVADA AND venceEn <= ahora`.
- **Por qué**: evita un valor de enum inalcanzable y una escritura en caliente que el sistema no necesita; separa reserva y sesión.
- **Dónde**: `prisma/schema.prisma`, migración `20261026120000_asignacion_ejercicio`.

#### D-94 · `esperaSegundos` y `ahorroSegundos` como instantánea inmutable
- **Origen**: IA, adoptada.
- **Contexto**: la tesis necesita saber qué espera y ahorro calculó el sistema en el momento de decidir.
- **Decisión**: enteros no nulos, escritos al crear la reserva y nunca recalculados al leer ni al cambiar la configuración. Las filas `EN_CURSO` por orden de rutina usan `0/0`.
- **Por qué**: mezclar la medición histórica con el estado actual rompería la comparación; `0/0` es la única representación no nula para una ejecución sin decisión del motor.
- **Dónde**: `AsignacionDeEjercicio`, `src/domains/asignacion/orquestacion.ts`, spec de persistencia.

#### D-95 · Advisory lock global de la instalación
- **Origen**: IA, adoptada (el spec de persistencia la fija).
- **Contexto**: dos check-in concurrentes pueden elegir la misma máquina; el unique parcial rompería la cola.
- **Decisión**: `pg_advisory_xact_lock(880000001)` al inicio de la transacción de cálculo+reserva, antes de leer, con una clave constante global.
- **Por qué**: la máquina ganadora solo se conoce después de calcular; un lock por máquina no puede adquirirse antes de la lectura. La instalación es un único gimnasio, así que no fragmenta nada.
- **Dónde**: `AsignacionRepository.enTransaccionBloqueada`, prueba `asignacion-concurrencia.integration.test.ts`.

#### D-96 · Una reserva activa por socio sin índice único parcial
- **Origen**: IA, adoptada.
- **Contexto**: el spec permite defensa en profundidad con un unique parcial.
- **Decisión**: se enforcea con el lock + cancelar las `RESERVADA` no vencidas + insertar, en una transacción. No se crea índice único parcial.
- **Por qué**: el predicado de un índice parcial debe ser inmutable; `venceEn > now()` no se puede expresar y un `WHERE estado = 'RESERVADA'` bloquearía al socio con una reserva vencida no reemplazada.
- **Dónde**: `cancelarReservasActivas` + `crearReserva`, `asignacion-repositorio.ts`.

#### D-97 · Ocupación derivada de sesiones y filas `EN_CURSO`
- **Origen**: IA, adoptada.
- **Contexto**: `Maquina.estado = OCUPADA` nunca se escribe (D-73); la ocupación real debe salir de la sesión.
- **Decisión**: ocupante = sesión `EN_CURSO` con fila `EN_CURSO` sobre la máquina cuyo `ejercicioId` coincide con `ejercicioActualId`, o —sin fila— con exactamente una máquina candidata. `seriesRestantes` descuenta solo `NORMAL`/`HASTA_EL_FALLO` dentro de `1..series`; `< 1` excluye al ocupante.
- **Por qué**: mantiene la coherencia con D-73/D-87 y evita una segunda fuente de verdad para el estado de la máquina.
- **Dónde**: `leerEntradaMotor`, spec de persistencia (limitación declarada para 0 o varias candidatas sin fila).

#### D-98 · Timeout de cálculo de 2 segundos
- **Origen**: IA, adoptada.
- **Contexto**: el check-in no puede esperar indefinidamente; `after` no está verificado en Vercel.
- **Decisión**: `TIMEOUT_CALCULO_MS = 2000` como `timeout` de la transacción interactiva, `maxWait = 1000`, y carrera externa a 2250 ms como red de seguridad.
- **Por qué**: el cálculo normal es rápido; 2 s acota la peor latencia sin dejar la transacción abierta ni el lock retenido (Prisma aborta al vencer).
- **Dónde**: `src/domains/asignacion/orquestacion.ts`, `asignacion-repositorio.ts`, `member-access-check`.

#### D-99 · Matriz de permisos de `/api/asignaciones`
- **Origen**: IA, adoptada.
- **Contexto**: el flujo obligatorio lo decide el socio; el personal solo necesita lectura para la Etapa 5.
- **Decisión**: SOCIO `GET`+`POST` sobre lo propio; ADMINISTRADOR e INSTRUCTOR solo `GET` (con `socioId` obligatorio); RECEPCIONISTA `403`. La entrada explícita de ADMINISTRADOR recorta el comodín para impedir `POST`.
- **Por qué**: mínima superficie, coherente con el flujo obligatorio y con el test de consistencia matriz/handler.
- **Dónde**: `src/lib/authorization.ts`, rutas `src/app/api/asignaciones/**`, `asignacion-api`.

#### D-100 · Se rechaza `after()`; espera acotada
- **Origen**: IA, adoptada.
- **Contexto**: `after` de Next 16 requiere `waitUntil` en serverless y Vercel no está verificado (P-28).
- **Decisión**: `await` acotado con timeout en el servicio; no se usa `after` en esta etapa.
- **Por qué**: es seguro y testeable hoy; la decisión es local al servicio y se puede revisitar cuando P-28 cierre, sin tocar el motor ni la tabla.
- **Dónde**: `src/api/acceso.ts` (gancho), `src/domains/asignacion/orquestacion.ts`.

#### D-101 · El ocupante usa la rutina de su sesión, no la rutina activa actual
- **Origen**: IA, adoptada.
- **Contexto**: una sesión `EN_CURSO` puede sobrevivir a la desactivación de la rutina asignada; su prescripción (`series`, `descanso`) debe ser la que está ejecutando.
- **Decisión**: para ocupantes se usa `sesion.rutinaAsignada.rutina`; para la cola se usa la rutina activa del miembro que reservó, como fija el spec.
- **Por qué**: usar la rutina activa actual para un ocupante con otra rutina subestimaría o sobreestimaría `seriesRestantes` y el descanso.
- **Dónde**: `leerEntradaMotor` (paso 7 y 8).

#### D-102 · Regla determinista 404 vs 409 en `decidir`
- **Origen**: IA, adoptada.
- **Contexto**: el spec distingue "nunca existió" de "venció o se canceló entre la lectura y la decisión", pero el `POST` no recibe el id de la reserva.
- **Decisión**: sin sugerencia vigente, se mira la última fila del socio por `creadaEn desc`. `RESERVADA` (vencida o sin máquina) → `409 SIN_SUGERENCIA_VIGENTE`; `CANCELADA` creada dentro de `minutosVencimientoReserva` → `409`; cualquier otro caso → `404 SIN_SUGERENCIA`.
- **Por qué**: es determinista con el `ahora` inyectado, acota el 409 a una ventana y evita un 409 eterno tras un `ESPERAR` antiguo.
- **Dónde**: `decidirSugerencia`, `src/api/asignaciones.ts`, `asignacion-api`.

#### D-103 · Guarda de capacidad en la integración de sesión
- **Origen**: IA, adoptada.
- **Contexto**: los tests existentes de sesión mockean Prisma sin los modelos nuevos; el camino sin asignaciones debe ser idéntico y los tests deben quedar verdes sin ediciones.
- **Decisión**: `esClienteConAsignaciones(db)` detecta `asignacionDeEjercicio` y `ejercicioMaquina`; sin ellos, el adaptador es no-op. Con ellos, la integración corre y los errores reales se propagan donde la sesión debe ser atómica.
- **Por qué**: preserva la retrocompatibilidad, permite desplegar el código antes de la migración y evita un mock frágil; en producción el modelo existe siempre.
- **Dónde**: `src/domains/sesion/integracion-asignaciones.ts`, `sesion-de-entrenamiento.ts`.

#### D-104 · Dos migraciones aditivas separadas
- **Origen**: IA, adoptada.
- **Contexto**: la migración de la tabla debe tener 0 `DROP`/`ALTER` (AC-413); la de configuración necesita `ALTER TABLE ADD COLUMN` (AC-504).
- **Decisión**: `20261026120000_asignacion_ejercicio` (tipo + tabla + índices + FKs inline) y `20261026120500_asignacion_configuracion` (tres columnas con default).
- **Por qué**: cada archivo cumple su criterio de revisión sin mezclar una tabla nueva con un `ALTER` a una tabla existente.
- **Dónde**: `prisma/migrations/`.

#### D-105 · Corte de inactividad para ocupantes
- **Origen**: IA, adoptada.
- **Contexto**: una sesión abandonada en `EN_CURSO` bloquea una máquina para siempre; la base de desarrollo tiene sesiones `EN_CURSO` antiguas. La consulta de ocupantes tomaba toda sesión `EN_CURSO` con `ejercicioActualId`, sin corte de edad.
- **Decisión**: una sesión o fila `AsignacionDeEjercicio` en `EN_CURSO` cuenta como ocupante solo si tuvo actividad en los últimos `minutosInactividadSesion` minutos (default 30). La actividad es el `RegistroDeProgreso` más reciente, con `horaInicio`/`creadaEn` como respaldo; la comparación es inclusiva (`>=`). `ahora` y el parámetro se inyectan al plan de lectura.
- **Por qué**: libera máquinas de sesiones fantasma sin job de limpieza, conserva el determinismo con reloj inyectado y aplica la misma regla a las dos fuentes de ocupación.
- **Dónde**: `leerEntradaMotor` (paso 7), `LecturaEntrada`, `src/domains/asignacion/orquestacion.ts`, spec `asignacion-ejercicio-persistencia`.

#### D-106 · `ejercicioId` con `ON DELETE CASCADE`
- **Origen**: IA, adoptada.
- **Contexto**: con `Restrict`, un ejercicio con cualquier asignación se volvía indeletable y el mapeo P2003 existente producía el mensaje equivocado (`DELETE_BLOCKED_ASSIGNED`). El borrado de un ejercicio con uso real ya está bloqueado por `RegistroDeProgreso` y `EjercicioEnRutina`.
- **Decisión**: la FK `AsignacionDeEjercicio.ejercicioId` usa `ON DELETE CASCADE` en Prisma y en la migración. Eliminar un ejercicio sin progreso ni filas de rutina elimina sus asignaciones y el ejercicio.
- **Por qué**: la cascada solo alcanza asignaciones de ejercicios nunca ejecutados; evita el bloqueo artificial y el mensaje incorrecto sin perder historial de ejercicios usados.
- **Dónde**: `prisma/schema.prisma`, migración `20261026120000_asignacion_ejercicio`, integración de persistencia (T-056c).

#### D-107 · La consulta del advisory lock devuelve un entero, no `void`
- **Origen**: IA, adoptada tras el fallo de la suite de integración de CP2.
- **Contexto**: `SELECT pg_advisory_xact_lock($1::bigint)` con `$queryRaw` falla en Prisma 6.19 con
  `Failed to deserialize column of type 'void'`. Los tests unitarios no podían verlo porque mockean el cliente;
  lo destapó la integración contra Postgres real.
- **Decisión**: la sentencia es
  `SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(${clave}::bigint)) AS t`. Sigue siendo
  `pg_advisory_xact_lock` dentro de la misma transacción interactiva, tomado antes de leer, y sigue usando
  `$queryRaw` (nunca `$executeRaw`, que rechaza consultas con filas).
- **Por qué**: el lock es un efecto de la función; su valor de retorno es irrelevante. Envolverlo en una
  subconsulta permite proyectar un entero que Prisma sí deserializa, sin cambiar el alcance ni el momento del lock.
- **Dónde**: `src/domains/asignacion/asignacion-repositorio.ts` (`enTransaccionBloqueada`); el contrato queda
  fijado por el test unitario "la consulta del lock pide una columna soportada" y por los dos tests de integración
  (concurrencia y liberación del lock al fallar).

#### D-108 · Ocupante sin fila `EN_CURSO`: solo se asigna a una máquina si es la única candidata
- **Origen**: revisión de CP2, adoptada.
- **Contexto**: D-97 declara la regla, pero la consecuencia quedó solo en su línea "Dónde". Una sesión `EN_CURSO` sin fila `EN_CURSO` no dice qué máquina está usando (por ejemplo, el socio avanzó por orden de rutina sin pasar por una reserva aceptada).
- **Decisión**: si el ejercicio actual tiene exactamente una candidata en `EjercicioMaquina`, esa máquina se marca ocupada. Con 0 o con 2+ candidatas, el ocupante no se asigna a ninguna máquina y esa sesión no aporta ocupación.
- **Consecuencia**: el motor puede ver libre una máquina que en realidad está ocupada y subestimar la espera. Es un límite conocido, no un defecto; el error va hacia "menos espera".
- **Por qué**: asignar a la máquina equivocada inventaría esperas falsas sobre una máquina libre; sin dato real no se adivina.
- **Mitigación pendiente**: evaluar en T-056g que el adaptador de sesión registre una fila `EN_CURSO` con `maquinaId` siempre que la máquina sea conocida.
- **Dónde**: `aplicarOcupantes` (`asignacion-ocupacion.ts`), spec de persistencia, D-97.

## 13. Plan de pruebas TDD

### Archivos y estructura

| Archivo | Tipo | `describe` principales |
|---|---|---|
| `src/domains/asignacion/asignacion-repositorio.lecturas.test.ts` | Unit (Prisma mockeado) | `lecturas base` · `guarda de capacidad y puente usuario-socio` |
| `src/domains/asignacion/asignacion-repositorio.ocupantes.test.ts` | Unit | `ocupantes` (incluye vigencia D-105) |
| `src/domains/asignacion/asignacion-repositorio.cola.test.ts` | Unit | `cola y vencimiento` · `P-67` |
| `src/domains/asignacion/asignacion-repositorio.escrituras.test.ts` | Unit | `escrituras y advisory lock` (incluye la forma de la consulta del lock, D-107) |
| `src/domains/asignacion/orquestacion.test.ts` | Unit (puerto mockeado, motor real inyectable) | `cálculo y reserva` · `fallback` · `invalido` · `timeout` · `decisión` · `sin rutina` |
| `src/domains/sesion/sesion-asignaciones.test.ts` | Unit (Prisma mockeado con los modelos nuevos) | `inicio consume reserva` · `avance consume reserva` · `completar ejecución` · `fin de sesión` · `sin reserva` |
| `src/api/asignaciones.test.ts` | Unit (servicio/repositorio mockeados) | `GET sugerencia` · `POST decidir` · `propiedad y roles` · `404/409` · `degradación de siguienteEnOrden` |
| `src/app/api/asignaciones/sugerencia/route.test.ts` | Unit | `401` · `403` · `delegación y ahora` |
| `src/app/api/asignaciones/decidir/route.test.ts` | Unit | `401` · `403` · `body inválido` · `delegación` |
| `src/api/acceso-asignacion.test.ts` | Unit (orquestación mockeada) | `check-in permitido` · `motor lanza` · `persistencia falla` · `denegado no dispara` · `una sola asistencia` |
| `src/lib/configuracion.test.ts` | Unit | `defaults 60/15/30` · `normalización por campo` |
| `src/domains/configuracion/configuracion.test.ts` | Unit | `rangos de los tres campos` · `enteros/finitos` |
| `src/app/configuracion/page.test.tsx` | Componente | `grupo Motor de espera` · `validación cliente` · `handleApiError` |
| `src/lib/authorization.test.ts` | Unit | `matriz /api/asignaciones` |
| `src/lib/route-error-mapper.test.ts` | Unit | `SIN_SUGERENCIA` · `SIN_SUGERENCIA_VIGENTE` |
| `tests/integration/asignacion-persistencia.integration.test.ts` | Integración (Docker) | `migración y FKs` · `ocupantes` · `ocupantes frescos` · `borrado en cascada` · `cola` · `P-67` · `vencimiento` · `una activa` |
| `tests/integration/asignacion-concurrencia.integration.test.ts` | Integración (Docker) | `dos socios misma máquina` · `mismo socio` · `rollback` |
| `tests/integration/configuracion-asignacion.integration.test.ts` | Integración (Docker) | `columnas y defaults` · `fila existente` (manual, ver §3) |

Los tests existentes de `src/domains/sesion/sesion-de-entrenamiento.test.ts`, `src/api/acceso.test.ts`,
`src/domains/asignacion/motor-espera.*.test.ts`, `src/domains/dominios-puros.guard.test.ts` y
`src/lib/configuracion.guard.test.ts` **no se editan** y deben seguir verdes.

### Mapeo escenario → test → valores esperados

#### `asignacion-ejercicio-persistencia`

| Escenario | Test | Esperado |
|---|---|---|
| 1 Check-in con rutina | `orquestacion.test.ts` → "persiste la instantánea del motor y vence a 15 min" | `RESERVADA`, `esperaSegundos=120`, `ahorroSegundos=60`, `venceEn=creadaEn+15m`, `sesionId=null`, máquina sin cambio |
| 2 Snapshot inmutable | `asignacion-repositorio.*.test.ts` → "la sugerencia vigente no recalcula espera ni ahorro" | mismos valores tras cambiar el estado del gimnasio |
| 3 Sin máquina candidata | `orquestacion.test.ts` → "recomendación sin máquina no crea fila" | sin `create`; cancela la anterior si existía |
| 4 Cambio de configuración | `orquestacion.test.ts` → "venceEn no cambia retroactivamente" | reserva vieja conserva su fecha; la nueva usa el valor nuevo |
| 5 `RESERVADA → EN_CURSO` | `sesion-asignaciones.test.ts` → "iniciar sesión consume la reserva" | `estado=EN_CURSO`, `sesionId` fijado, una sola fila |
| 6 Transición inválida | `asignacion-repositorio.*.test.ts` → "updateMany con guard no toca una fila COMPLETADA" | `count=0`; fila sigue `COMPLETADA` |
| 7 `VENCIDA` no persistida | `asignacion-repositorio.*.test.ts` → "vencida se ignora sin reescribir estado" | fila sigue `RESERVADA`; no es sugerencia |
| 8 Recálculo reemplaza | `orquestacion.test.ts` → "cancela la anterior y crea la nueva" | una `CANCELADA`, una `RESERVADA` |
| 9 Fallo no destruye | `orquestacion.test.ts` → "invalido/error no cancela la reserva" | anterior intacta; sin filas nuevas |
| 10 Ejecución + reserva | `sesion-asignaciones.test.ts` → "EN_CURSO y RESERVADA coexisten" | dos filas, estados distintos |
| 11 Vencimiento en el límite | `asignacion-repositorio.*.test.ts` → "venceEn == ahora está vencida; 1 s antes vigente" | inclusivo en `<=` |
| 12 Calentamiento/drop set | `asignacion-repositorio.*.test.ts` → "seriesRestantes ignora CALENTAMIENTO y DROP_SET" | `3−1=2` |
| 13 Cero restantes | ídem → "ocupante con 0 restantes no ocupa" | no aparece en `maquinas[].ocupante` |
| 14 Fuera de rango | ídem → "numeroSerie 3 con prescripción 2 no descuenta" | `seriesRestantes=0` |
| 15 Descanso del ocupante | ídem → "descanso sale del EjercicioEnRutina del ocupante" | `90`, no el del consultante |
| 16 Orden de cola | ídem → "cola ordenada por creadaEn, id" | `R1,R2,R3` |
| 17 Vencida fuera de cola | ídem → "reserva vencida no aporta" | ausente |
| 18 Reserva sin rutina activa | ídem → "reserva no resoluble no aporta y loguea" | ausente; `console.error`/log |
| 19 P-67 | ídem → "no ve su propia reserva como ocupante ni en cola" | ausente en ambos; falla si se quita `socioId: { not }` |
| 20 Sugerencia vigente | ídem → "devuelve la más reciente o null" | una fila / `null` |
| 21 Pendientes tras completar | ídem → "solo E2 pendiente tras 2 series de E1" | `[E2]` |
| 22 Concurrencia misma máquina | `asignacion-concurrencia.integration.test.ts` → "dos check-in concurrentes" | dos `RESERVADA`, una por socio; una con espera > 0 |
| 23 Concurrencia mismo socio | ídem → "dos recálculos del mismo socio" | una activa; la otra `CANCELADA` |
| 24 Fallo transaccional | ídem → "cancelar y lanzar revierte" | la reserva anterior sigue `RESERVADA` |
| 25 Migración aditiva | `asignacion-persistencia.integration.test.ts` → "aplica migrate deploy desde cero" | tablas, índices y FKs presentes; 0 `DROP`/`ALTER` en el archivo |
| 26 Sin `OCUPADA` | ídem → "reservar no cambia Maquina.estado" | `DISPONIBLE` antes y después |
| 27 Sesión sin fila, máquina única | `asignacion-repositorio.*.test.ts` → "una candidata deriva ocupante; varias no" | `M1` ocupada / sin ocupante |
| 28 Sesión inactiva 31 min | `asignacion-repositorio.*.test.ts` → "sesión con actividad de 31 min no ocupa con ventana 30" | sin ocupante |
| 29 Sesión activa 29 min | ídem → "sesión con actividad de 29 min ocupa con ventana 30" | ocupante con `seriesRestantes` |
| 30 Sesión sin registros fresca | ídem → "sin registros usa horaInicio fresca" | ocupante |
| 31 Sesión sin registros vencida | ídem → "sin registros usa horaInicio vieja y no ocupa" | sin ocupante |
| 32 Sesión vieja + fresca | ídem → "la sesión vieja no aporta si hay una fresca" | solo la fresca |
| 33 Fila `EN_CURSO` inactiva | ídem → "fila EN_CURSO con actividad de 31 min no ocupa" | sin ocupante |
| 34 Fila `EN_CURSO` activa | ídem → "fila EN_CURSO con actividad de 29 min ocupa" | ocupante |
| 35 Fila `EN_CURSO` sin registros | ídem → "fila EN_CURSO sin registros usa creadaEn" | fresca ocupa; vieja no |
| 36 Actividad en el corte | ídem → "actividad exactamente en el corte cuenta" | `>=` inclusivo |
| 37 Borrado en cascada | `asignacion-persistencia.integration.test.ts` → "borrar ejercicio sin progreso ni rutina elimina asignaciones" | asignaciones y ejercicio eliminados |

#### `asignacion-orquestacion`

| Escenario | Test | Esperado |
|---|---|---|
| 1 Entrada completa | `asignacion-repositorio.*.test.ts` → "arma ejercicios, máquinas, ocupante y cola" | `EntradaMotor` válida; `segundosEjecucionSerie` de configuración |
| 2 Sin rutina activa | `orquestacion.test.ts` → "no abre transacción ni invoca el motor" | `SIN_RUTINA`; sin escrituras |
| 3 Máquinas no candidatas | ídem → "M9 fuera de maquinas" | `M9` ausente |
| 4 Check-in permitido | `acceso-asignacion.test.ts` → "dispara una vez" | `calcularEnCheckIn` llamado una vez |
| 5 Check-in denegado | ídem → "no dispara" | mock no llamado; reserva intacta |
| 6 Inicio de rutina | `sesion-asignaciones.test.ts` → "consume la primera y recalcula las restantes" | `ejercicioActualId` de la reserva; recálculo con exclusión |
| 7 Fin de ejercicio | ídem → "completa la fila y recalcula" | `COMPLETADA` + nueva reserva |
| 8 Reserva persistida | `orquestacion.test.ts` → "snapshot de la recomendación" | valores exactos |
| 9 Sin máquina | ídem → "fallback" | sin fila; anterior cancelada |
| 10 Cancelación atómica | ídem → "cancela e inserta en la misma transacción" | llamadas dentro de `enTransaccionBloqueada` |
| 11 Aceptar | ídem → "ACEPTAR no escribe y es idempotente" | misma reserva; `cancelarReserva` no llamado |
| 12 Esperar | ídem → "ESPERAR cancela" | `cancelada=true`; resultado `esperada` |
| 13 Sin elección libre | `asignaciones.test.ts` → "body con maquinaId → 400" | `VALIDATION_ERROR` |
| 14 `sin_opciones` | `orquestacion.test.ts` → "fallback sin error" | `SIN_OPCIONES`; no `console.error` |
| 15 `vacio` | ídem → "fallback vacio" | `VACIO` |
| 16 `invalido` en check-in | `acceso-asignacion.test.ts` + `orquestacion.test.ts` | log de servidor; respuesta igual; sin escrituras |
| 17 `invalido` con reserva | `orquestacion.test.ts` → "no destruye la vigente" | intacta |
| 18 Reloj inyectado | `orquestacion.test.ts` → "creadaEn/venceEn exactos" | `10:00` y `10:15` |
| 19 Falla del motor | `acceso-asignacion.test.ts` → "motor lanza; asistencia registrada" | respuesta idéntica; una asistencia |
| 20 Falla de persistencia | ídem → "persistencia rechaza; sin residuo" | respuesta idéntica; sin fila parcial |
| 21 Timeout | `orquestacion.test.ts` → "timeout devuelve contenido y no lanza" | `TIMEOUT`; sin throw |
| 22 Sesión con reserva | `sesion-asignaciones.test.ts` → "ejercicioActualId sigue la reserva" | `E2` |
| 23 Sesión sin reserva | `sesion-de-entrenamiento.test.ts` (sin editar) | verde |
| 24 Consumo al avanzar | `sesion-asignaciones.test.ts` → "avanza consumiendo E2" | `EN_CURSO` + `sesionId` |
| 25 Ejecución `EN_CURSO` | ídem → "crea fila con sesionId y máquina única" | fila `EN_CURSO` |
| 26 Fin de sesión | ídem → "completa las EN_CURSO restantes" | todas `COMPLETADA` |
| 27 Defaults | `orquestacion.test.ts` → "60/15/30 sin fila" | valores por defecto |
| 28 Config inválida | ídem → "segundos=0 → invalido contenido" | `INVALIDO`; sin cambios |
| 29 Doble check-in dentro de ventana | `acceso-asignacion.test.ts` → "denegado no cancela" | reserva intacta |
| 30 Doble check-in fuera de ventana | `orquestacion.test.ts` → "recalcula y reemplaza" | anterior `CANCELADA` |
| 31 Motor intacto | `dominios-puros.guard.test.ts` + `motor-espera.*.test.ts` | verdes sin edición |
| 32 Ventana de inactividad | `orquestacion.test.ts` → "pasa ahora y minutosInactividadSesion al plan de lectura" | `30` y `ahora` inyectados |

#### `asignacion-api`

| Escenario | Test | Esperado |
|---|---|---|
| 1–5 GET | `asignaciones.test.ts` → `GET` | 200 con sugerencia/siguiente; sin escritura; degradación a `null` |
| 6–7 POST | ídem → `POST` | ACCEPT idempotente; ESPERAR cancela |
| 8 Sin sugerencia | ídem → "última fila inexistente" | 404 `SIN_SUGERENCIA` |
| 9 Vencida | ídem → "última RESERVADA vencida" | 409 `SIN_SUGERENCIA_VIGENTE` |
| 10–11 Validación | ídem + route tests | 400 `VALIDATION_ERROR` |
| 12 Matriz | `authorization.test.ts` | SOCIO GET+POST; ADMIN/INSTRUCTOR GET; RECEPCIONISTA 403 |
| 13–14 Propiedad | `asignaciones.test.ts` | SOCIO con `socioId` (propio o ajeno) → 403 |
| 15 ADMIN consulta | ídem | 200 |
| 16 Socio inexistente | ídem | 404 "Socio no encontrado" |
| 17–18 Sesión/rol | route tests | 401 / 403 |
| 19 Validación de cuerpo | ídem | 400 |
| 20 Error inesperado | ídem | 500 `SERVER_ERROR` genérico |
| 21–22 Contrato | ídem | misma fila; ISO 8601 y `null` explícito |

#### `configuracion-sistema`

| Escenario | Test | Esperado |
|---|---|---|
| 1 Defaults sin fila | `configuracion.test.ts` | `60/15/30` y resta igual |
| 2 Fila existente | integración + verificación manual §3 | `60/15/30`; resto intacto |
| 3 Cambio parcial | `configuracion.test.ts` | solo cambia el enviado |
| 4–5 Migración/rollback | integración + SQL comentado | tres columnas con default; rollback documentado |
| 6–8, 27 Consumo | `orquestacion.test.ts` | `venceEn` con 30; `segundos` en la entrada; inactividad en la lectura |
| 9–10 Lector | `configuracion.test.ts` | defaults; fila más reciente |
| 11–16, 23–25 PUT | `configuracion.test.ts` | 400 en 0, negativos, no entero, no finito, fuera de rango |
| 17–19 Auditoría | `configuracion.test.ts` | `antes`/`despues` de los tres; sin cambios no audita |
| 20–22, 26 Panel | `page.test.tsx` | grupo con tres campos, validación cliente, `handleApiError` |

#### `member-access-check`

| Escenario | Test | Esperado |
|---|---|---|
| 1 Recepción y puerta | `acceso-asignacion.test.ts` | el gancho vive en `evaluarYRegistrarAcceso`; ambas rutas lo comparten |
| 2 Decisión intacta | ídem | `DENEGADO` igual |
| 3 Motor lanza | ídem | asistencia registrada; respuesta igual |
| 4 Persistencia falla | ídem | sin reserva parcial; respuesta igual |
| 5 Timeout | ídem | respuesta igual; sin lock retenido |
| 6 Sin rutina | ídem | sin cálculo |
| 7 Denegado | ídem | reserva intacta |
| 8 Falla consulta de rutina | ídem + `orquestacion.test.ts` | respuesta igual; log |
| 9–10 Anti-passback | ídem | dentro no calcula; fuera recalcula |
| 11–12 Reloj | ídem | `creadaEn` exacto; determinismo |
| 13–14 Sin duplicados | ídem | una asistencia y una auditoría |
| 15 Log | ídem | socio y tipo, sin datos sensibles |
| 16–17 Compatibilidad | suites existentes | verdes sin edición |

### RED → GREEN por capa

1. **Configuración**: tests de defaults/rangos/panel RED → constantes, `Configuracion`, defaults, panel.
2. **Migraciones**: `migrate deploy` RED (sin las carpetas) → SQL; integración de columnas/FKs.
3. **Repositorio**: tests de lectura RED con Prisma mockeado → puerto + implementación; luego integración de
   ocupantes frescos/cola/vencimiento/P-67 y borrado en cascada del ejercicio.
4. **Orquestación**: tests de cálculo/fallback/inválido/timeout/decisión RED → servicio; luego integración de
   concurrencia.
5. **API**: tests de handlers/rutas/matriz/error-mapper RED → `src/api/asignaciones.ts`, rutas, matriz.
6. **Check-in y sesión**: tests de best-effort y de sesión RED → gancho y adaptador; al final `npm test`
   completo y `npm run test:integration`.

## 14. Plan de slices (CP1…CP4)

Presupuesto: **≤400 líneas autoradas** por slice (`additions + deletions`, tests incluidos). Un slice = un
commit. No hay PRs. Los cuatro checkpoints de Fernando se respetan; CP2 y CP4 se parten porque, con tests,
superan el presupuesto.

| Slice | Checkpoint | Contenido | LOC est. | Commit sugerido |
|---|---|---|---|---|
| S1 | CP1 | Schema + enum + relaciones, dos migraciones, configuración (dominio, lector, defaults, panel) y sus tests + integración de migración/config | ~240 | `feat(config): parámetros del motor de espera y migraciones aditivas` |
| S2 | CP2a | `asignacion-repositorio.ts` (puerto, DTO, lecturas de rutina/candidatos/sesión/pendientes/máquinas) + tests unitarios | ~370 | `feat(asignacion): repositorio de lectura del motor` |
| S3 | CP2b | Armado de `EntradaMotor` (ocupantes frescos, cola, P-67, vencimiento, borrado en cascada) en el repositorio + tests unitarios + integración de persistencia | ~395 | `feat(asignacion): entrada del motor, ocupantes y cola` |
| S4 | CP3 | `orquestacion.ts`: lock, transacción, cálculo, reserva, fallback, `invalido`, timeout, decisión + tests unitarios + integración de concurrencia | ~365 | `feat(asignacion): orquestación con lock global y fallback` |
| S5 | CP4a | `src/api/asignaciones.ts`: handlers, DTO, propiedad/rol, mapeo 404/409, degradación de `siguienteEnOrden` + tests | ~275 | `feat(asignacion): handlers de sugerencia y decisión` |
| S6 | CP4b | Rutas `/api/asignaciones/*`, matriz de permisos, `route-error-mapper` + tests de rutas/consistencia | ~195 | `feat(asignacion): endpoints y permisos de asignaciones` |
| S7 | CP4c | Gancho en `evaluarYRegistrarAcceso`, adaptador de sesión, consumo/completado/recálculo + tests de best-effort y sesión | ~390 | `feat(asignacion): gancho de check-in e integración de sesión` |

**Cortes declarados**: CP2 (S2+S3 ≈ 765) y CP4 (S5+S6+S7 ≈ 860) superan 400 y se parten. CP3 es un solo slice
(~365). Si S7 supera 400 al implementarse, se parte en S7a (gancho de check-in + test) y S7b (adaptador de
sesión + tests); el corte natural es el archivo `integracion-asignaciones.ts`.

### Archivos afectados

| Archivo | Acción | Slice |
|---|---|---|
| `prisma/schema.prisma` | Modificar: enum, modelo, cuatro relaciones inversas | S1 |
| `prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql` | Crear | S1 |
| `prisma/migrations/20261026120500_asignacion_configuracion/migration.sql` | Crear | S1 |
| `src/domains/configuracion/configuracion.ts` | Modificar: tres campos y rangos | S1 |
| `src/lib/configuracion.ts` | Modificar: interfaz, defaults, normalización | S1 |
| `src/app/configuracion/page.tsx` | Modificar: grupo, etiquetas, formulario | S1 |
| `src/domains/asignacion/asignacion-repositorio.ts` | Crear | S2/S3 |
| `src/domains/asignacion/orquestacion.ts` | Crear | S4 |
| `src/api/asignaciones.ts` | Crear | S5 |
| `src/app/api/asignaciones/sugerencia/route.ts` | Crear | S6 |
| `src/app/api/asignaciones/decidir/route.ts` | Crear | S6 |
| `src/lib/authorization.ts` | Modificar: entrada `/api/asignaciones` por rol | S6 |
| `src/lib/route-error-mapper.ts` | Modificar: `SIN_SUGERENCIA`, `SIN_SUGERENCIA_VIGENTE` | S6 |
| `src/api/acceso.ts` | Modificar: gancho best-effort | S7 |
| `src/domains/sesion/integracion-asignaciones.ts` | Crear | S7 |
| `src/domains/sesion/sesion-de-entrenamiento.ts` | Modificar: consumo, completado, recálculo | S7 |
| Tests unitarios y de integración listados en §13 | Crear/modificar | S1–S7 |

`src/domains/asignacion/motor-espera.ts`, sus tests, los guardianes y los tests existentes de sesión/acceso
**no** figuran en la tabla: no se tocan.

### Verificación por slice

Todas: `npx tsc --noEmit` y `npx eslint <archivos del slice>` sin errores nuevos.

| Slice | Comandos |
|---|---|
| S1 | `npx prisma generate` · `npx prisma validate` · `npx jest src/lib/configuracion.test.ts src/domains/configuracion/configuracion.test.ts src/app/configuracion/page.test.tsx` · `npm run test:integration` |
| S2 | `npx jest src/domains/asignacion` |
| S3 | `npx jest src/domains/asignacion` · `npm run test:integration` |
| S4 | `npx jest src/domains/asignacion/orquestacion.test.ts` · `npm run test:integration` |
| S5 | `npx jest src/api/asignaciones.test.ts` |
| S6 | `npx jest src/app/api/asignaciones src/lib/authorization.test.ts src/lib/route-error-mapper.test.ts` |
| S7 | `npx jest src/api/acceso-asignacion.test.ts src/domains/sesion/sesion-asignaciones.test.ts src/domains/sesion/sesion-de-entrenamiento.test.ts src/api/acceso.test.ts` · `npm test` |

### Smoke que puede correr Fernando

1. **CP1**: `npm run test:integration`. En el contenedor (`--keep`):
   `docker exec -it arnold-test-db psql -U arnold -d arnold_test -c '\d "AsignacionDeEjercicio"'` y
   `... -c 'select "segundosEjecucionSerie", "minutosVencimientoReserva", "minutosInactividadSesion" from "ConfiguracionDelSistema"'`.
2. **CP2/CP3**: el smoke es la suite de integración: aplica migraciones desde cero, arma la entrada, prueba
   P-67, vencimiento y concurrencia. No hay pantalla que mirar.
3. **CP4**: con `npm run dev` y un socio del seed con rutina activa:
   - check-in por recepción (`POST /api/acceso/check-in` con DNI+PIN);
   - `select id, "socioId", "ejercicioId", "maquinaId", estado, "esperaSegundos", "ahorroSegundos", "creadaEn", "venceEn" from "AsignacionDeEjercicio" order by "creadaEn" desc limit 1;`
     → una `RESERVADA`, `venceEn = creadaEn + 15 min`, `Maquina.estado` sin cambios;
   - como SOCIO, `GET /api/asignaciones/sugerencia` → `200` con la fila; repetir dos veces → sin filas nuevas;
   - `POST /api/asignaciones/decidir {"accion":"ACEPTAR"}` → `200` con la misma reserva y el mismo `venceEn`;
   - en otro socio, `{"accion":"ESPERAR"}` → `200` con `sugerencia: null` y la fila `CANCELADA`;
   - iniciar sesión → `ejercicioActualId` = ejercicio de la reserva y la fila `EN_CURSO`;
   - registrar la última serie → la fila pasa a `COMPLETADA` y aparece una nueva `RESERVADA` para el siguiente;
   - cambiar `minutosVencimientoReserva` a 30 → la reserva nueva vence a 30; la anterior conserva su fecha.
4. **Concurrencia manual** (opcional): dos `curl` de check-in en paralelo (`xargs -P2`) y repetir la consulta
   SQL: dos filas `RESERVADA` como máximo, una por socio.

### Rollback

- **S1**: `git revert` del commit. Si la migración ya se aplicó a una base real y se quiere revertir la
  funcionalidad, ejecutar el rollback comentado de configuración y de tabla (el de tabla pierde reservas; es
  aceptable al revertir la etapa). Nunca borrar columnas con datos de otras tablas.
- **S2–S7**: `git revert` de cada commit. La tabla y las columnas pueden quedarse; el código viejo no las lee.
- **Rollback completo**: revertir los siete slices; ejecutar el SQL comentado de ambas migraciones. El motor
  puro sigue funcionando para quien lo invoque manualmente; `/configuracion` pierde los tres campos pero el
  lector devuelve defaults y el panel los omite con el patrón actual.
- No hay feature flag: la migración es aditiva y el código degrada si el modelo no existe (D-103), lo que
  permite revertir el código sin tocar la base.

## 15. Riesgos, trazabilidad, numeración y preguntas

### Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Los tests existentes de sesión/acceso se rompen por los modelos nuevos | Media | Guarda de capacidad D-103: sin `asignacionDeEjercicio`/`ejercicioMaquina` el adaptador es no-op; suites nuevas en archivos nuevos; `npm test` completo como puerta de S7. |
| `$queryRaw` con un `SELECT` que devuelve `void` | Baja | `$queryRaw` sí acepta consultas con filas; la columna `void` no se usa. Se descartó `$executeRaw` porque el engine de Prisma rechaza las consultas que devuelven filas (`Execute returned results`). La puerta sigue siendo el test de concurrencia de S4 contra Docker. |
| El pooler de Supabase (`connection_limit=1`) serializa y oculta la carrera | Media | La prueba de P-68 corre en Docker sin pooler; en producción el lock sigue siendo correcto aunque el pool serialice. |
| Timeout: la query no se cancela instantáneamente al vencer la carrera externa | Baja | `timeout` de la transacción de Prisma aborta y libera el lock; la carrera externa (2250 ms) solo protege la respuesta. No se deja una transacción abierta. |
| La FK `Cascade` de `Ejercicio` podría borrar más de lo esperado | Baja | El borrado de un ejercicio con `RegistroDeProgreso` o `EjercicioEnRutina` sigue bloqueado por esas FKs; la cascada solo elimina asignaciones de ejercicios nunca ejecutados. Se cubre con un test de integración (T-056c). |
| El orden de la cola no coincide con el orden real de commit si dos requests concurrentes traen `ahora` distintos | Baja | La garantía dura es que la segunda transacción ve la primera; el orden es `creadaEn, id`. En producción el reloj del servidor y el lock hacen que la diferencia sea despreciable; el test usa el mismo `ahora`. |
| Crecimiento de la tabla por reservas abandonadas | Alta | Vencimiento perezoso; P-69 (limpieza batch) sigue abierto y no bloquea la operación. |
| Sesiones `EN_CURSO` antiguas en la base de desarrollo bloquean máquinas | Media | D-105: solo cuentan como ocupantes las sesiones o filas `EN_CURSO` con actividad dentro de `minutosInactividadSesion` (default 30); la sesión vieja se ignora sin limpieza. |
| Latencia del check-in sensible a la ventana acotada | Media | Peor caso ≈2,25 s (`TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS`, constantes únicas). P-71: revisar con mediciones reales en Etapa 5/despliegue y reconsiderar `after()` si P-28 (`waitUntil`) se verifica. |
| `siguienteEnOrden` en cada GET agrega costo | Baja | Es una lectura acotada a los pendientes; si falla o excede, se degrada a `null` y no rompe la lectura de la sugerencia. |
| `migrate diff` reporta el índice de expresión preexistente | Baja | Se captura la línea base antes de la change y se exige que la salida posterior no agregue diferencias; la migración se prueba desde cero en Docker. |
| `0/0` en filas `EN_CURSO` por orden de rutina se confunde con una reserva de espera cero | Media | Limitación declarada; la simulación debe separar por origen operativo. Si se vuelve bloqueante, una columna `origen` se evalúa en otra etapa (no se agrega acá). |
| Un futuro feature usa otro advisory lock y colisiona con la clave | Baja | `880000001` queda reservado para esta instalación; cualquier otro lock debe usar otra clave y documentarla. |
| Latencia del recálculo tras la última serie | Baja | Solo se recalcula al completar un ejercicio (no en cada serie), con timeout de 2 s; un fallo no rompe la sesión. |

### Trazabilidad

| Requisito / AC | Sección | Test |
|---|---|---|
| Registro persistente (AC-401, AC-402) | §2, §7 | `orquestacion.test.ts` (snapshot/vence), integración de persistencia |
| Máquina de estados (AC-403, AC-404) | §2, §4, §9 | `asignacion-repositorio.*.test.ts`, `sesion-asignaciones.test.ts` |
| Una reserva activa (AC-405) | §2, §5, §7 | `orquestacion.test.ts`, `asignacion-concurrencia.integration.test.ts` |
| Vencimiento perezoso (AC-406) | §2, §6 | `asignacion-repositorio.*.test.ts`, integración |
| Ocupación derivada (AC-407, AC-408) | §6 | `asignacion-repositorio.*.test.ts`, integración |
| Ocupación vigente (AC-415) | §6, §7 | `asignacion-repositorio.*.test.ts`, integración, `orquestacion.test.ts` |
| Cola derivada (AC-409) | §6 | `asignacion-repositorio.*.test.ts`, integración |
| P-67 (AC-410) | §6 | test dedicado en unit e integración |
| Lecturas deterministas (AC-411) | §6 | `asignacion-repositorio.*.test.ts` |
| Concurrencia y lock (AC-412) | §5 | `asignacion-concurrencia.integration.test.ts` |
| Migración aditiva (AC-413) | §3 | `npm run test:integration`, `migrate diff`, inspección SQL |
| FK `ejercicioId` en cascada (AC-416) | §2, §3 | integración "borrar ejercicio sin progreso ni rutina elimina asignaciones" |
| Sin `OCUPADA` (AC-414) | §2, §6 | integración "reservar no cambia Maquina.estado" |
| Construcción de entrada (AC-441) | §6 | `asignacion-repositorio.*.test.ts` |
| Tres momentos (AC-442) | §7, §8, §9 | `orquestacion.test.ts`, `acceso-asignacion.test.ts`, `sesion-asignaciones.test.ts` |
| Persistencia y fallback (AC-443, AC-445) | §7 | `orquestacion.test.ts` |
| Decisión obligatoria (AC-444) | §7, §11 | `orquestacion.test.ts`, `asignaciones.test.ts` |
| `invalido` (AC-446) | §7, §8 | ídem |
| Reloj inyectado (AC-447) | §7, §8, §9 | tests con `ahora` fijo |
| Best-effort (AC-448) | §8 | `acceso-asignacion.test.ts` |
| Integración con sesión (AC-449) | §9 | `sesion-asignaciones.test.ts` + suite existente sin editar |
| Ejecución `EN_CURSO` (AC-450) | §9 | `sesion-asignaciones.test.ts` |
| Motor intacto (AC-451) | Encabezado, §1 | `dominios-puros.guard.test.ts`, `motor-espera.*.test.ts` |
| Configuración (AC-452) | §10 | `configuracion.test.ts`, `orquestacion.test.ts` |
| Doble check-in (AC-453) | §8, §9 | `acceso-asignacion.test.ts` |
| Espera acotada (AC-454) | §7 | `orquestacion.test.ts`, `acceso-asignacion.test.ts` |
| API GET/POST (AC-481, AC-482) | §11 | `asignaciones.test.ts`, route tests |
| Matriz y propiedad (AC-483, AC-487, AC-488) | §11 | `authorization.test.ts`, `asignaciones.test.ts` |
| Errores y contrato (AC-484, AC-485, AC-486, AC-489, AC-490) | §11 | `asignaciones.test.ts`, `route-error-mapper.test.ts` |
| Config defaults/rangos/migración (AC-501–AC-504, AC-510) | §10 | `configuracion.test.ts`, integración |
| Panel y auditoría (AC-505, AC-506) | §10 | `page.test.tsx`, `configuracion.test.ts` |
| Consumo de parámetros (AC-507, AC-508) | §7, §10 | `orquestacion.test.ts` |
| Reloj y ventana de inactividad (AC-455) | §6, §7 | `orquestacion.test.ts`, `asignacion-repositorio.*.test.ts` |
| Suite verde (AC-509) | §13, §14 | `npm test`, `npm run test:integration`, `tsc`, `eslint` |
| Gancho único y best-effort (AC-521, AC-522, AC-523) | §8 | `acceso-asignacion.test.ts` |
| Condiciones de disparo (AC-524) | §8 | `acceso-asignacion.test.ts` |
| Anti-passback (AC-525) | §8 | ídem |
| Reloj y no duplicados (AC-526, AC-527) | §8 | ídem |
| Log y timeout (AC-528, AC-529) | §7, §8 | ídem |
| Compatibilidad (AC-530) | §9 | suites existentes sin editar |

### Numeración

- Decisiones de esta change: **D-88 a D-108** (21). Última previa: D-87.
- Tareas: **T-056+** quedan reservadas para `sdd-tasks`; este diseño no asigna IDs de tarea.
- Pendientes: **P-68** se cierra con el test de concurrencia; **P-69** sigue abierto (limpieza batch, fuera de
  alcance); **P-70** se cierra con la integración de sesión; **P-71** se abre (latencia del check-in, Etapa 5 /
  despliegue).
- No hay colisiones: los rangos D/T/P están verificados contra `openspec/decisions.md` (última revisión).

### Preguntas abiertas

**Ninguna.** El diseño no deja opciones abiertas. Dos temas quedan explícitamente fuera de alcance y no
bloquean la implementación: P-69 (limpieza batch) y la verificación de `after`+`waitUntil` en Vercel (P-28).
Si Fernando quiere cambiar la ventana de 404/409 (D-102), el valor es una constante de configuración y no
afecta la tabla ni el motor.

### Matriz de amenazas

| Frontera | Aplica | Comportamiento seguro / prueba |
|---|---|---|
| Rutas HTTP nuevas `/api/asignaciones/*` | Sí | Matriz RBAC + regla de propiedad + 401/403; tests de handler y de consistencia. |
| SQL crudo (advisory lock) | Sí | Tagged template parametrizado, sin concatenación; `::bigint`; prueba de concurrencia en Docker. |
| DDL de migración | Sí | Aditivo, escrito a mano, sin `DROP`/`ALTER` en la migración de tabla; rollback comentado; `migrate deploy` desde cero. |
| Shell / subprocesos / VCS / clasificación de ejecutables | No | La change no agrega comandos, subprocesos ni automatización de PR. |

