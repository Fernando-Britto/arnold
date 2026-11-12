# Verify Report — asignacion-ui

- **Change**: `asignacion-ui` (Etapa 5 — pantalla del socio)
- **Rama**: `feat/asignacion-ui` (desde `dev`)
- **Fecha**: 2026-11-05
- **Alcance verificado**: 2 specs del change (AC-541…AC-556 y AC-561…AC-566), decisiones D-112…D-124,
  restricciones de capa y compuertas. El backend no se tocó, así que la suite de integración queda fuera.
- **Veredicto**: **APROBADO CON OBSERVACIONES**

## Resumen

La implementación cumple los 22 criterios del change: 19 cubiertos con tests que verifican valores o
comportamiento, 2 parciales (AC-550 sin click end-to-end en la página, AC-566 solo smoke) y 1 verificado por
inspección más que por test (AC-551 "sin polling"). Las 13 decisiones del change se cumplen en el código sin
desviaciones de comportamiento; las dos únicas diferencias son de documentación (README desactualizado) y de
cobertura (navegador/tema solo en smoke).

Las compuertas están verdes: `tsc`, `lint` (0 errores), `npm test` (278 suites / 3908 tests) y `build`. Las
dos mutaciones de verificación independiente fallaron en el test correcto.

## Cobertura de criterios

| AC | Test(s) | Estado |
|---|---|---|
| AC-541 | `src/app/home-socio/page.test.tsx:428` "con rutina activa y sin sesión en curso muestra la tarjeta y consulta una vez" | ✅ |
| AC-542 | `page.test.tsx:418` "D-118: con sesión en curso no muestra la tarjeta ni consulta" | ✅ (mutación a) |
| AC-543 | `page.test.tsx:454` "sin rutina activa no muestra la tarjeta ni consulta"; redirects `page.test.tsx:187,193` | ✅ |
| AC-544 | `tarjeta-sugerencia.test.tsx:32,41,48` (libre, 90 s → 2 min, 60 s → 1 min, 30 s → "menos de 1 min") | ✅ |
| AC-545 | `tarjeta-sugerencia.test.tsx:57` "sinReserva: informa el ejercicio por orden y no ofrece acciones" | ✅ |
| AC-546 | `tarjeta-sugerencia.test.tsx:120` "sinSugerencia: mensaje neutro único…" | ✅ |
| AC-547 | `use-sugerencia-asignacion.test.tsx:177` (409 → vencida + reconsulta); render `tarjeta-sugerencia.test.tsx:134` | ✅ |
| AC-548 | `tarjeta-sugerencia.test.tsx:143`; `sugerencia-asignacion.test.tsx:66` ("Reintentar"); `page.test.tsx:464` (home intacta) | ✅ |
| AC-549 | `asignaciones-cliente.test.ts:73,87` (body exacto); `tarjeta-sugerencia.test.tsx:199` (disabled); `use-…:198` (doble toque) | ✅ |
| AC-550 | `tarjeta-sugerencia.test.tsx:182` (copy + botón); `sugerencia-asignacion.test.tsx:98` (llama `onSeguirRutina`); `page.test.tsx:366` (ese handler abre la ejecución) | 🟡 parcial: no hay un test que toque el botón **de la tarjeta** dentro de la página |
| AC-551 | `use-…:69,78,91` (montar, pestaña, manual), `:177` (tras 409), `:220` (tras ESPERAR); sin `setInterval` en el hook | ✅ |
| AC-552 | `use-…:100` (respuesta vieja descartada), `:251` (GET viejo no pisa la decisión), `asignaciones-cliente.test.ts:55`; el hook no importa `cache-cliente` | ✅ |
| AC-553 | `tarjeta-sugerencia.test.tsx:152` (pulso sin texto); `page.test.tsx:533` (recarga sin pantalla) | ✅ |
| AC-554 | `page.test.tsx:475` (tokens, sin `dark:` ni hex) | 🟡 parcial: no verifica contraste ni el tema oscuro real (smoke) |
| AC-555 | `tarjeta-sugerencia.test.tsx:78` (aria-live, título, `<button type="button">`), `:88` (máquina nula), `:107` (texto, no color) | ✅ |
| AC-556 | `git diff --name-only origin/dev...HEAD` sin backend (ver Restricciones) | ✅ |
| AC-561 | `tests/prisma-seed.test.ts:87` | ✅ |
| AC-562 | `tests/prisma-seed.test.ts:87` (el `findMany` filtra `estado: "DISPONIBLE"` y solo acepta las dos máquinas) | ✅ |
| AC-563 | `tests/prisma-seed.test.ts:115` (`skipDuplicates`, sin `deleteMany`) | ✅ |
| AC-564 | `tests/prisma-seed.test.ts:87` (no crea máquina/ejercicio/rutina) | ✅ |
| AC-565 | `tests/prisma-seed.test.ts` (18 tests) | ✅ |
| AC-566 | Smoke manual con base real (no hay test que corra el seed contra Postgres) | 🟡 solo smoke |

## Decisiones del change

| D | Qué | Dónde se cumple |
|---|---|---|
| D-112 | Sugerencia en la home; S4 diferido | `src/app/home-socio/page.tsx:140` (único montaje); S4 no existe |
| D-113 | "Ir ahora"/"Esperar" | `tarjeta-sugerencia.tsx:130,135`; `sugerencia-asignacion.tsx:25-26` |
| D-114 | Mensaje neutro único | `tarjeta-sugerencia.tsx:83` (una sola frase, sin causas) |
| D-115 | Vista de personal fuera | Sin código de instructor/administrador en el change |
| D-116 | Sin polling ni cache | `use-sugerencia-asignacion.ts` sin `setInterval` ni import de `cache-cliente` |
| D-117 | Seed con asociaciones | `prisma/seed-data.ts:172` (`ASOCIACIONES_DEMO`), `:270-289` |
| D-118 | Ocultar con sesión en curso | `page.tsx:140` (`data.rutinaActiva && !data.sesionEnProgreso`) |
| D-119 | Consultar al montar/pestaña/acción | `use-sugerencia-asignacion.ts:69,76,96` |
| D-120 | Solo la última consulta escribe | `use-sugerencia-asignacion.ts:85-86` (abort + contador) |
| D-121 | Recargar el home al cerrar | `page.tsx:94-100` (`cerrarEjecucion` + `invalidarCache`) |
| D-122 | Contenedor con el hook | `src/components/home-socio/sugerencia-asignacion.tsx:18-28` |
| D-123 | Sin callback, sin botón | `tarjeta-sugerencia.tsx:126,128,133,141,149` |
| D-124 | ESPERAR usa el POST y reconsulta | `use-sugerencia-asignacion.ts:96` |

Sin colisiones: `openspec/decisions.md` termina en **D-111**; D-112…D-124 viven solo en el change.

## Restricciones (comandos y salida)

**AC-556 — backend intacto**

```
$ git diff --name-only origin/dev...HEAD | grep -E "src/api/asignaciones\.ts|src/domains/asignacion/|route-error-mapper"
(exit 1, sin coincidencias)
```

**DTOs con `import type`, sin copiar**

```
src/api/asignaciones-cliente.ts:7:import type { RespuestaDecision, RespuestaSugerencia } from "@/api/asignaciones";
src/components/home-socio/use-sugerencia-asignacion.ts:16:import type { SiguienteDTO, SugerenciaDTO } from "@/api/asignaciones";
```

**Sin reloj en render ni colores fijos (archivos nuevos de producción)**

```
$ grep -nE "Date\.now|new Date\(|dark:|#[0-9a-fA-F]{3,6}" src/api/asignaciones-cliente.ts \
    src/components/home-socio/use-sugerencia-asignacion.ts \
    src/components/home-socio/tarjeta-sugerencia.tsx \
    src/components/home-socio/sugerencia-asignacion.tsx
(exit 1, sin coincidencias)
```

**`page.tsx`: sin usos nuevos de reloj ni colores**

```
$ git diff origin/dev...HEAD -- src/app/home-socio/page.tsx | grep -E "^\+" | grep -nE "Date\.now|new Date\(|dark:|#[0-9a-fA-F]{3,6}"
(exit 1, sin coincidencias)
```
Los `new Date()` de `page.tsx:95,101` son preexistentes (P-57 y el formateo de fecha), no de este change.

**D-118 — el hook no se monta si no corresponde**

```
src/app/home-socio/page.tsx:140:  {data.rutinaActiva && !data.sesionEnProgreso && (
src/app/home-socio/page.tsx:141:    <SugerenciaAsignacion onSeguirRutina={handleSeguirRutina} />
```
El hook vive dentro del contenedor (`sugerencia-asignacion.tsx:23`), así que sin montaje no hay consulta.

**README de S0**: **falta**. `README.md:36` todavía dice "El seed **no** asocia ejercicios a máquinas: sin ese
paso el motor de asignación devuelve `sin_opciones`", que es exactamente lo contrario de D-117. Ver hallazgos.

## Compuertas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | **exit 0** |
| Lint | `npm run lint` | **exit 0** — 0 errores, 96 warnings preexistentes |
| Tests | `npm test` | **278 suites / 3908 tests passed** (55.3 s) |
| Build | `npm run build` | **exit 0** — ✓ Compiled successfully in 16.3s |
| Integración | `npm run test:integration` | **no aplica**: el backend no se tocó |

## Mutación independiente

| Mutación | Test que falló |
|---|---|
| (a) quitar `!data.sesionEnProgreso` en `page.tsx:140` | `page.test.tsx:418` "D-118: con sesión en curso no muestra la tarjeta…" (+ el de D-121) |
| (b) quitar `if (enviando) return;` en `use-sugerencia-asignacion.ts:82` | `use-…:198` "doble toque: mientras hay un POST en vuelo no se envía otro" |

Ambas revertidas; `git status --short` quedó vacío.

## Riesgos residuales

1. **Navegador y tema claro/oscuro**: no hay e2e. El smoke es la única verificación real del render, del
   contraste y del cambio de tema (`page.test.tsx:475` solo mira clases).
2. **AC-550 sin cadena completa**: el contenedor llama `onSeguirRutina` y la página le pasa el mismo handler
   del hero, pero ningún test hace click en "Empezar entrenamiento" **de la tarjeta** dentro de la página.
3. **Ambigüedad "sin rutina" vs "rutina sin máquinas"**: el contrato devuelve ambos `null` en los dos casos
   (`src/api/asignaciones.ts:143-147`); la UI usa un mensaje neutro (D-114). No se puede distinguir.
4. **Latencia con base remota** (D-110): el `GET` corre el motor para `siguienteEnOrden`
   (`src/api/asignaciones.ts:149`). No hay timeout del lado del cliente; el estado previo se conserva.
5. **Contrato backend↔UI**: `import type` garantiza que un cambio de DTO rompa la compilación, pero no que el
   runtime devuelva esa forma (no hay test de contrato contra el handler real en la UI).
6. **Seed sobre bases ya sembradas**: `skipDuplicates` cubre la idempotencia, pero si una máquina fue
   renombrada la asociación se omite con un log (caso real: "Banco planoo").
7. **Acoplamiento del helper de carga**: la tarjeta en `cargando` usa `SeccionCargando`
   (`tarjeta-sugerencia.tsx:54`), el mismo `data-testid` que espera `waitForLoadingComplete` de la home; un
   futuro test con la tarjeta colgada podría quedar esperando.

## Hallazgos

### Críticos
Ninguno.

### Altos
Ninguno.

### Medios
Ninguno.

### Bajos
1. **README contradice S0** (`README.md:36`): dice que el seed no asocia ejercicios a máquinas. **Arreglo**:
   cambiar esa línea por "el seed asocia los ejercicios de la rutina Torso B a máquinas disponibles (D-117);
   el resto de las asociaciones se cargan desde `/maquinas`".
2. **AC-550 parcial**: falta el test end-to-end del botón de la tarjeta en la página. **Arreglo**: en
   `page.test.tsx`, con la sugerencia en estado `aceptada`, clickear "Empezar entrenamiento" de la tarjeta y
   esperar `ejecucion-rutina`.
3. **AC-554/AC-566 solo smoke**: sin e2e ni corrida del seed contra Postgres en CI. **Arreglo**: aceptado
   como está; el smoke manual lo cubre.
