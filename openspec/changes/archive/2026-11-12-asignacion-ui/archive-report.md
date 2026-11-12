# Archive Report — asignacion-ui

- **Change**: `asignacion-ui` (Etapa 5 de "asignación dinámica de ejercicios", la parte visible)
- **Close date**: 2026-11-12
- **Artifact store**: openspec
- **Archived to**: `openspec/changes/archive/2026-11-12-asignacion-ui/`
- **Branch**: `feat/asignacion-ui`
- **Verify report**: `verify-report.md` — **APROBADO CON OBSERVACIONES** (los dos hallazgos bajos cerrados)

## Qué se entregó

La asignación dinámica dejó de ser solo API: el socio la ve y decide desde la home.

- **S0 · Seed de asociaciones (T-057a)**. El seed asocia los ejercicios de "Torso B" a máquinas
  `DISPONIBLE` (Press inclinado y Remo con mancuerna → Banco plano; Jalón al pecho, Elevaciones laterales y
  Extensión de tríceps → Polea alta), idempotente con `skipDuplicates` y buscando las máquinas por nombre
  entre las que ya existen. Si falta una máquina o un ejercicio, omite la pareja y lo informa por log.
- **S1 · Fetcher y hook (T-057b)**. `src/api/asignaciones-cliente.ts` (GET tipado con `import type` del
  handler) y `useSugerenciaAsignacion`: consulta al montar, al volver la pestaña y a pedido; sin polling ni
  cache; `AbortController` + id monotónico para que solo la última consulta escriba.
- **S2a · Tarjeta con datos (T-057c)**. `tarjeta-sugerencia.tsx`: estados `libre`, `enEspera` y
  `sinReserva`, con el copy del spec y tokens del tema.
- **S2b · Estados vacíos, error y visibilidad (T-057d)**. `sinSugerencia` (mensaje neutro), `vencida`,
  `error`, `cargando` (pulso sin texto) y el contenedor `sugerencia-asignacion.tsx` (D-122). La home monta el
  contenedor solo con rutina activa y sin sesión en curso (D-118).
- **S3a · Acciones (T-057e)**. "Ir ahora" (`ACEPTAR`) y "Esperar" (`ESPERAR`) cableados, con guard de doble
  toque, carrera decidir-vs-GET resuelta y "Empezar entrenamiento" por la misma acción que el hero.
- **S3b · Refresco al cerrar (T-057e/D-121)**. `cargarHome` + `cerrarEjecucion` con
  `invalidarCache(CLAVES.homeSocio)`, para que `sesionEnProgreso` no quede viejo 60 s.
- **Polish**. Feedback al tocar (hover/active con `scale`) y estado "Consultando…" en el botón de recarga.

## Decisiones

- **D-112…D-124 (13 decisiones)** registradas en `openspec/decisions.md` §1 después de D-111, con el mismo
  formato que las anteriores.
  - De Fernando: sugerencia en la home y S4 diferido (D-112); copy "Ir ahora"/"Esperar" (D-113); mensaje
    neutro para "sin sugerencia" (D-114); vista del personal fuera (D-115); refresco sin polling ni cache
    (D-116); seed con asociaciones (D-117); visibilidad con sesión en curso (D-118); contenedor con el hook
    (D-122); botones solo con callback (D-123).
  - De la IA adoptadas: consulta al montar/pestaña/acción (D-119), solo la última consulta escribe (D-120),
    recarga al cerrar la ejecución (D-121) y ESPERAR con reconsulta (D-124).
  - D-107 de balance muscular y D-111 del advisory lock conviven en `decisions.md`, como corresponde.

## Specs sincronizadas

| Dominio | Acción | Detalles |
|---|---|---|
| `asignacion-sugerencia-ui` | **Creada** | Promovida a `openspec/specs/asignacion-sugerencia-ui/spec.md`; solo cambian la cabecera, la fila de capability y los títulos de sección (`Requirements`, `Acceptance Criteria`). AC-541…AC-556. |
| `seed-asignacion-demo` | **Creada** | Promovida a `openspec/specs/seed-asignacion-demo/spec.md`; mismos ajustes de cabecera. AC-561…AC-566. |

## Evidencia verificada

- `npx tsc --noEmit`: limpio · `npm run lint`: **0 errores**, 96 warnings preexistentes ·
  `npm test`: **278 suites / 3911 tests** · `npm run build`: compilado (10,7 s).
- Cobertura de los 22 AC: **20 cubiertos**, 1 parcial (AC-554, el tema se valida en smoke) y 1 solo smoke
  (AC-566). AC-550 se cerró con un test de caracterización que hace clic en el botón de la tarjeta dentro de
  la página.
- Mutaciones de verificación: quitar `!data.sesionEnProgreso` rompe el test de D-118; quitar el guard de
  `enviando` rompe el de doble toque; un `onSeguirRutina` no-op rompe el de AC-550.
- **Smoke manual (Fernando, 2026-11-12)**: "Ir ahora" desde la tarjeta y la reserva queda `EN_CURSO` con
  `sesionId`; con sesión en curso la tarjeta no aparece (D-118); al terminar, la tarjeta se reevalúa sola
  (D-121); "Esperar" deja la reserva `CANCELADA` y la tarjeta pasa a "Ahora no tenés una reserva".

## Estado de tareas

**T-057a…T-057e completas**, incluida la partición S3a/S3b por presupuesto. S4 (eco de la sugerencia dentro
de `EjecucionRutina`) queda **diferido** por D-112, a decidir con la pantalla en uso.

## Pendientes abiertos

- **P-61** reasignación por instructor; **P-62** simulación comparativa de la tesis; **P-63** redacción de la
  limitación "solo espera"; **P-69** limpieza batch de `RESERVADA` vencidas; **P-71** latencia del check-in
  con carga real. Sin cambios respecto de la Etapa 4.

## Lecciones

- **Un botón que reconsulta y no cambia nada parece roto**: la respuesta idéntica no da señal. Se resuelve
  con estado visible ("Consultando…") y feedback táctil, no con más lógica.
- **`react-hooks/set-state-in-effect`**: marcar un flag al inicio de una consulta que se dispara desde un
  `useEffect` rompe el lint. La salida es separar "ejecutar" de "marcar y ejecutar" (carga inicial vs
  recarga manual).
- **El corte por presupuesto funciona**: S3 medía 417 líneas y separar D-121 dejó dos commits por debajo de
  400 sin perder cobertura.

## Qué NO se verificó

- Navegador más allá del smoke manual: no hay e2e.
- Contraste real del tema claro/oscuro (solo se verifican clases de token en tests).
- Contrato de runtime entre el handler y la UI más allá de `import type`.
