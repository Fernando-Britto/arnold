# Diseño — asignacion-ui

## 1. Contexto y restricciones

Change de **solo front** (más un slice de seed). Consume la API de la Etapa 4 sin tocarla. Restricciones que
mandan sobre el diseño:

- **Visibilidad** (D-118): con sesión `EN_CURSO` no se muestra la tarjeta. `sesionEnProgreso` ya viene en el
  payload del home (`src/api/home-socio.ts:130`, derivado en `src/api/home-socio-data.ts:272`), así que no
  hace falta consultar la sesión.
- **Sin pantallas de carga** (`odd/tasks/socio-sin-pantallas-de-carga.md`): el marco se dibuja al instante y
  solo el área de datos pulsa; nunca se reemplaza la home.
- **Tema** (`odd/tasks/tema-claro-oscuro.md`): solo tokens.
- **Costo** (D-110): cada `GET` ejecuta el motor para `siguienteEnOrden` (`src/api/asignaciones.ts:80-93,149`);
  no hay polling.
- **Sin cambios de backend** (AC-556).
- El portal ya tiene `SeccionCargando` (`src/components/home-socio/seccion-cargando.tsx`) y el mecanismo de
  inicio/reanudación de rutina: `onSeguirRutina` (`src/app/home-socio/page.tsx:85`) monta `EjecucionRutina`,
  que al montar retoma o inicia la sesión con `fetchSesionEnCurso` (`src/api/sesiones.ts:263`).

## 2. Mapa de capas y archivos

```
/home-socio (page.tsx)
   └── <TarjetaSugerencia />            ← presentación pura (sin fetch)
          └── useSugerenciaAsignacion() ← estado, refresco y carreras
                 └── asignaciones-cliente.ts ← fetch tipado, sin React
```

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/api/asignaciones-cliente.ts` | **nuevo** | `fetchSugerencia()`, `decidirSugerencia(accion)`; errores tipados con `code`/`status` |
| `src/components/home-socio/use-sugerencia-asignacion.ts` | **nuevo** | estado de la tarjeta, consulta al montar / `visibilitychange` / tras acciones, cancelación |
| `src/components/home-socio/tarjeta-sugerencia.tsx` | **nuevo** | presentación: tabla de estados, `aria-live`, botones |
| `src/app/home-socio/page.tsx` | **modificado** | monta la tarjeta y refresca el home al cerrar la ejecución |
| `src/api/asignaciones-cliente.test.ts`, `use-sugerencia-asignacion.test.tsx`, `tarjeta-sugerencia.test.tsx` | **nuevos** | pruebas por capa |
| `prisma/seed-data.ts` | **modificado** (S0) | asociaciones `EjercicioMaquina` de "Torso B" |
| `tests/prisma-seed.test.ts` | **modificado** (S0) | `findMany` en el doble + pruebas de asociaciones |
| `README.md` | **modificado** (S0) | una línea en "Datos de desarrollo" |

No se toca `src/api/asignaciones.ts`, `src/domains/asignacion/**` ni `src/lib/route-error-mapper.ts`.

### Por qué `import type` y no copiar los DTO

`src/api/asignaciones.ts` importa orquestación y `process`-free server code; importarlo en el cliente
arrastraría backend al bundle. Pero `import type` se borra en compilación, así que el fetcher puede tipar con
los DTO reales sin riesgo de bundle:

```ts
import type { RespuestaSugerencia, RespuestaDecision } from "@/api/asignaciones";
```

Si el contrato cambia, el cliente deja de compilar. No hay copia que pueda derivar.

## 3. Contratos

Tipos que consume la UI (copiados del código real, `src/api/asignaciones.ts:25-64`):

```ts
interface SugerenciaDTO {
  asignacionId: string; ejercicioId: string; ejercicioNombre: string;
  maquinaId: string; maquinaNombre: string | null;
  esperaSegundos: number; ahorroSegundos: number;
  creadaEn: string; venceEn: string;
}
interface SiguienteDTO { ejercicioId: string; ejercicioNombre: string; maquinaId: string | null; esperaSegundos: number; }
interface RespuestaSugerencia { socioId: string; sugerencia: SugerenciaDTO | null; siguienteEnOrden: SiguienteDTO | null; calculadoEn: string; }
interface RespuestaDecision { accion: "ACEPTAR" | "ESPERAR"; sugerencia: SugerenciaDTO | null; siguienteEnOrden: SiguienteDTO | null; }
```

Fetcher:

```ts
export async function fetchSugerencia(signal?: AbortSignal): Promise<RespuestaSugerencia>;
export async function decidirSugerencia(accion: "ACEPTAR" | "ESPERAR", signal?: AbortSignal): Promise<RespuestaDecision>;
```

`decidirSugerencia` envía **solo** `{ accion }` (`src/api/asignaciones.ts:169-176`). Los errores se normalizan
a `ErrorAsignacion { status: number; code: string; message: string }` leyendo el sobre `{ code, message }`
(`src/api/asignaciones.ts:63`).

## 4. Regla de visibilidad (D-118)

```ts
const visible =
  data !== null &&
  data.rutinaActiva !== null &&
  data.sesionEnProgreso === false;
```

- La tarjeta **no se monta** si `visible` es falso → el hook no existe → **no hay consulta**.
- Con `sesionEnProgreso === true` la reserva vigente es la del **siguiente** ejercicio y no se puede consumir
  a mitad de sesión (`src/domains/sesion/sesion-de-entrenamiento.ts:547-560`), así que mostrarla con "Ir
  ahora" sería una promesa falsa. Ese caso queda para S4 (D-112).
- El rol ya está garantizado por el guard de la página (`src/app/home-socio/page.tsx:76-82`).

Consecuencia de diseño: **el hook vive dentro de la tarjeta**, no en la página. Si viviera arriba, habría que
pasarle la condición y aun así podría consultar; montarlo condicionalmente lo hace imposible.

### Estado obsoleto al volver de entrenar

`sesionEnProgreso` sale de `fetchHomeSocioData`, cacheado 60 s (`src/lib/cache-cliente.ts:25`). Las mutaciones
de sesión invalidan ese cache (`invalidarDatosDelSocio`, `src/api/sesiones.ts:257-260,282,309,320`), pero la
home **no vuelve a pedirlo** al cerrar `EjecucionRutina`. Sin arreglo, la tarjeta quedaría oculta hasta un
refresh. D-121: al cerrar la ejecución se re-ejecuta la carga del home (basta con volver a llamar
`fetchHomeSocioData` con el cache ya invalidado).

## 5. Tabla de estados de la tarjeta

Estado interno del hook:

```ts
type Estado =
  | { tipo: "cargando" }                       // solo la primera vez
  | { tipo: "lista"; respuesta: RespuestaSugerencia }
  | { tipo: "aceptada"; sugerencia: SugerenciaDTO }
  | { tipo: "vencida" }
  | { tipo: "error" };
```

| Estado UI | Condición | Texto | Acciones | aria |
|---|---|---|---|---|
| `libre` | `sugerencia.esperaSegundos === 0` | "Está libre" · "Andá a **{máquina}** y hacé **{ejercicio}**." | "Ir ahora" (primaria), "Esperar" | `role="status" aria-live="polite"` |
| `enEspera` | `> 0` | "Te toca en **{N} min**" (`Math.ceil(s/60)`; `s < 60` → "menos de 1 min") · "**{ejercicio}** en **{máquina}**." | "Ir ahora", "Esperar" | ídem |
| `aceptada` | `POST` 200 `ACEPTAR` | "Listo, te guardamos **{máquina}** para **{ejercicio}**." | "Empezar entrenamiento" | ídem |
| `sinReserva` | `sugerencia === null` y `siguienteEnOrden !== null` | "Ahora no tenés una reserva." · "Si seguís el orden de tu rutina, toca **{ejercicio}**." | "Volver a consultar" | ídem |
| `sinSugerencia` | ambos `null` | "Todavía no tenemos una sugerencia para vos." (D-114) | "Volver a consultar" | ídem |
| `vencida` | `POST` 409 `SIN_SUGERENCIA_VIGENTE` | "La reserva venció. Volvemos a consultar." | "Volver a consultar" | ídem |
| `error` | `GET`/`POST` ≥500 o red | "No pudimos calcular tu próxima máquina." | "Reintentar" | ídem |
| `enviando` | `POST` en vuelo | igual al estado previo | botones `disabled`, `aria-busy="true"` | ídem |
| `cargando` | primera consulta | sin texto; `SeccionCargando className="h-24"` dentro del mismo marco | — | `role="status" aria-busy="true"` (del componente) |

`maquinaNombre === null` → "tu máquina". Contenedor: `<section aria-labelledby="sugerencia-titulo">` con
`<h2 id="sugerencia-titulo">Tu próxima máquina</h2>`, para que el live region no anuncie el título en cada
cambio.

## 6. Hook: consulta, carreras y latencia

```ts
function useSugerenciaAsignacion(): {
  estado: Estado;
  enviando: boolean;
  consultar: () => void;
  decidir: (accion: "ACEPTAR" | "ESPERAR") => Promise<void>;
}
```

- **Consulta**: `AbortController` por pedido + un contador monotónico (`idRef`). Al resolver, si el `id` no es
  el último, se descarta: la respuesta vieja no pisa a la nueva.
- **Disparadores**: `useEffect` de montaje; listener de `visibilitychange` que consulta solo si
  `document.visibilityState === "visible"`; `consultar()` tras `ESPERAR`/409/error; `decidir()` tras éxito.
- **Sin polling**: no hay `setInterval` en ningún camino.
- **Sin cache**: no se usa `conCache`/`leerCache`.
- **Latencia**: mientras un pedido está en vuelo se conserva el estado previo (sin parpadeo). No hay timeout
  propio: el servidor ya acota el cálculo (D-110) y el `AbortController` solo cancela al desmontar.
- **Desmontaje**: el cleanup aborta el pedido en vuelo, así no hay `setState` sobre un componente desmontado.

### Ajustes de implementación (S1)

- `EstadoSugerencia.lista` guarda `{ sugerencia, siguienteEnOrden }` y **no** la `RespuestaSugerencia`
  completa: la respuesta del `POST` no trae `socioId` ni `calculadoEn`, y la tarjeta no los usa. Evita
  inventar campos o pedir un `GET` extra solo para rellenarlos.
- Los errores usan `ApiError` de `src/utils/api-error.ts` como `ErrorAsignacion`: ya expone `status`, `code`
  y `message`, así que no se duplica la clase.
- `decidirSugerencia`, la acción `decidir`, el estado `enviando` y los estados `aceptada`/`vencida` se
  implementan en S3 (T-057e): S1 quedó solo con lectura y refresco.

## 7. Acciones y arranque de la sesión

- `decidir("ACEPTAR")` → `POST` → estado `aceptada`. El botón "Empezar entrenamiento" llama `onSeguirRutina`
  (prop nueva de la tarjeta, cableada a `page.tsx:85`), que monta `EjecucionRutina`. Esa pantalla retoma la
  sesión con `fetchSesionEnCurso` (`src/api/sesiones.ts:263`) y el backend arranca en el ejercicio de la
  reserva (`src/domains/sesion/sesion-de-entrenamiento.ts:260-267`). **No** se crea un endpoint ni un flujo
  nuevo.
- `decidir("ESPERAR")` → `POST` → `vencida`/`sinReserva` según la respuesta (`siguienteEnOrden`).
- Doble toque: `enviando` deshabilita ambos botones; además `decidir` es no-op si ya hay un pedido en vuelo.
- 404 `SIN_SUGERENCIA` se trata igual que "vencida" (la reserva ya no está) y refresca.

## 8. S0 — seed

Parejas fijas (todas contra máquinas `DISPONIBLE` de `prisma/seed-data.ts:158-165`):

| Ejercicio de "Torso B" | Máquina |
|---|---|
| Press inclinado | Banco plano |
| Jalón al pecho | Polea alta |
| Remo con mancuerna | Banco plano |
| Elevaciones laterales | Polea alta |
| Extensión de tríceps | Polea alta |

Cada ejercicio queda con **una sola candidata** por máquina elegible: el motor no tiene que desempatar y la
demo es determinista. Las dos máquinas se comparten entre ejercicios, así que las colas se ejercitan igual.

Implementación:

1. Las máquinas se crean con `createMany` y **no devuelven ids** (`prisma/seed-data.ts:249-251`). Después de
   crearlas (o si ya existían), leerlas con
   `prisma.maquina.findMany({ where: { nombre: { in: [...] } }, select: { id: true, nombre: true } })`.
2. Cruzar esa lista con el mapa `ejercicioId` que el seed ya arma (`prisma/seed-data.ts:230-246`).
3. `prisma.ejercicioMaquina.createMany({ data, skipDuplicates: true })` apoyado en
   `@@unique([maquinaId, ejercicioId])` → idempotente por construcción.
4. `tests/prisma-seed.test.ts`: el doble no implementa `findMany` (devuelve un objeto, no un arreglo). Agregar
   un override que devuelva `MAQUINAS` con ids; no tocar la aserción de `createMany` (`:78`) ni la lista de
   modelos "no se re-crean" (`:67-68`).

## 9. Estrategia de pruebas

| Slice | Jest / Testing Library | Dobles | Manual |
|---|---|---|---|
| S0 | `tests/prisma-seed.test.ts`: crea las 5 asociaciones, ninguna a `FUERA_DE_SERVICIO`, segunda corrida no duplica | Prisma falso + `findMany` | — |
| S1 | `asignaciones-cliente.test.ts`: URLs, método, body exacto `{ accion }`, normalización de 409/500/red y `signal` | `global.fetch` mockeado | — |
| S2 | `tarjeta-sugerencia.test.tsx`: los estados de §5, textos exactos, `maquinaNombre` null, `aria-live`, teclado | props directas (sin fetch) | — |
| S3 | `use-sugerencia-asignacion.test.tsx` + `page.test.tsx`: visibilidad con/sin sesión, consulta al montar, `visibilitychange`, carrera respuesta-vieja, doble toque, 409, refetch al cerrar la ejecución | `fetch` mockeado; `visibilityState` con `Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })` + `document.dispatchEvent(new Event("visibilitychange"))`, restaurado en `afterEach` | seed + check-in + aceptar + empezar |

Reglas anti-frágiles: nada de `setTimeout` reales ni `waitFor` con tiempos arbitrarios; los eventos de
visibilidad se disparan a mano y se restauran; `limpiarCache()` en `beforeEach` como ya hace
`page.test.tsx:137`.

## 10. Partición definitiva

| Slice | Contenido | Líneas est. | Corte si se pasa |
|---|---|---|---|
| **S0** | seed + fake + README | ≈120 | — |
| **S1** | `asignaciones-cliente.ts` + tests | ≈180 | — |
| **S2** | `tarjeta-sugerencia.tsx` + tests (sin hook) | ≈220 | **S2a** tarjeta + `libre`/`enEspera`/`sinReserva`/`sinSugerencia`; **S2b** `aceptada`/`vencida`/`error`/`cargando` (>380) |
| **S3** | `use-sugerencia-asignacion.ts`, montaje en `page.tsx`, refetch al cerrar, tests de integración | ≈150 | — |
| **S4** | **diferido** (D-112) | ≈120 | — |

Orden: S0 → S1 → S2 → S3. Total ≈670; ningún slice pasa 400.

## 11. Decisiones registradas (D-118+)

### D-118 · La tarjeta se oculta mientras hay una sesión en curso
- **Origen**: Fernando (2026-11-05).
- **Contexto**: con sesión `EN_CURSO` la API devuelve la reserva del **siguiente** ejercicio y no existe
  consumo a mitad de sesión (`src/domains/sesion/sesion-de-entrenamiento.ts:547-560`).
- **Decisión**: la tarjeta se monta solo con `data.rutinaActiva !== null` y `data.sesionEnProgreso === false`
  (`src/api/home-socio.ts:130`). Con sesión en curso no se muestra ni se consulta.
- **Por qué**: "Ir ahora" sobre una reserva que no se puede consumir es una promesa falsa; el caso se resuelve
  en S4, que es de solo lectura.

### D-119 · Se consulta al montar, al volver a la pestaña y tras cada acción
- **Origen**: Fernando (2026-11-05, D-116 del change).
- **Decisión**: `useEffect` de montaje + `visibilitychange` a visible + después de `ACEPTAR`/`ESPERAR`/409/
  error y al cerrar la ejecución. Sin polling. Sin cache.
- **Por qué**: cada `GET` corre el motor (`src/api/asignaciones.ts:149`) y la reserva vence; un cache de 60 s
  (`src/lib/cache-cliente.ts:25`) ofrecería acciones sobre algo muerto.

### D-120 · Solo la última consulta escribe el estado
- **Origen**: IA, adoptada.
- **Decisión**: cada consulta lleva `AbortController` y un identificador monotónico; al resolver, si no es la
  última, se descarta.
- **Por qué**: volver a la pestaña puede disparar una consulta mientras otra está en vuelo; sin esto, una
  respuesta vieja puede reintroducir una reserva ya vencida.

### D-121 · Al cerrar la ejecución se recargan los datos del home
- **Origen**: IA, adoptada (hueco detectado en el diseño).
- **Contexto**: `sesionEnProgreso` viene del payload del home y ese payload está cacheado 60 s
  (`src/api/home-socio.ts:144-146`); las mutaciones de sesión invalidan el cache
  (`src/api/sesiones.ts:257-260`) pero la home no se vuelve a pedir al cerrar `EjecucionRutina`.
- **Decisión**: cuando `modoEjecucion` pasa a `false`, la home vuelve a cargar sus datos; con eso
  `sesionEnProgreso` se recalcula y la tarjeta se reevalúa.
- **Por qué**: sin esto, después de entrenar la tarjeta podría quedar oculta hasta un refresh manual.

### D-122 · El hook vive en un contenedor, no en la tarjeta
- **Origen**: Fernando (2026-11-05).
- **Decisión**: `SugerenciaAsignacion` (`src/components/home-socio/sugerencia-asignacion.tsx`) es el único
  que usa el hook y le pasa el estado a `TarjetaSugerencia`, que sigue siendo presentación pura. La página
  monta el contenedor solo con rutina activa y sin sesión en curso (D-118): si no se monta, no hay consulta.
- **Por qué**: mantiene la tarjeta testeable sin red y hace imposible consultar cuando la regla de
  visibilidad no se cumple.

### D-123 · Sin callback, sin botón
- **Origen**: Fernando (2026-11-05).
- **Decisión**: "Ir ahora", "Esperar", "Volver a consultar" y "Reintentar" se renderizan **solo** si llega
  su callback. Entre S2b y S3 no existen botones muertos.
- **Por qué**: un botón que no hace nada es peor que su ausencia, y evita que S2b invente no-ops.

## 12. Riesgos y reversión

- **R1 · Latencia del `GET`** con base remota (D-110): se conserva el estado previo y no se bloquea la home.
- **R2 · Deriva del contrato**: mitigada con `import type`; si el backend cambia, falla la compilación.
- **R3 · Seed sobre bases ya sembradas**: las asociaciones se crean con `skipDuplicates`; una base que ya tenía
  asociaciones no se toca ni se duplica.
- **R4 · `maquinaNombre` nulo**: copy "tu máquina", cubierto con test.
- **R5 · Carrera de respuestas**: D-120.
- **R6 · Refresco al cerrar la sesión**: D-121 y test en `page.test.tsx`.

Reversión: S0, S1, S2 y S3 son commits independientes. Revertir S3 deja S0–S2 (tarjeta en modo lectura);
revertir S2 devuelve la home al estado actual (el único punto de montaje es `page.tsx`); revertir S0 borra el
bloque de asociaciones y el seed vuelve a su comportamiento previo.
