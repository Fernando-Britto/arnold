# Explore — adaptacion-rutina

- **Change**: `adaptacion-rutina` (progresión periódica automática: Fuerza / Hipertrofia / Descarga)
- **Rama**: `feat/adaptacion-rutina` (desde `dev`)
- **Fecha**: 2026-11-17
- **Estado**: exploración. Sin código. Las decisiones de §7 son de Fernando; 1–3 resueltas (D-134…D-136), 4–7 en recomendación provisional.
- **Origen**: `requirements.md:37` (Fase 2, módulo 2: "Progresión periódica automática (Fuerza, Hipertrofia, Descarga) con o sin registro de cargas") y pedido de Fernando del 2026-11-17.
- **Alcance del documento**: insumo de exploración. No compromete arquitectura final ni alcance y no propone D-xxx.

## 1. Contexto y objetivo

Hoy el sistema registra la serie (carga, repeticiones, RIR, tipo) y calcula, **por ejercicio**, una sugerencia de carga para la próxima sesión (D-59). Esa sugerencia es lineal y no conoce la meta del socio, su nivel, su asistencia ni el paso del tiempo: no hay fases (fuerza/hipertrofia/descarga) ni periodización.

El objetivo de Fernando: un proceso que **analice el progreso del cliente y cambie automáticamente su rutina**. Ejemplos: meta "mejorar press banca" → rutina progresiva de press banca que cambia semana a semana según pesos, repeticiones y RIR; meta "definir" → otra rutina; tras ~3 meses de fuerza → hipótesis de hipertrofia, con descarga cuando corresponda.

Lo que hoy existe cubre la **micro** (carga por sesión). La **meso** (volumen por músculo, estancamiento, fatiga semanal) existe solo como tarjeta, y la **macro** (fase según meta) no existe. Este documento separa lo verificable de lo que falta y deja las decisiones en manos de Fernando.

## 2. Lo que ya existe (verificable)

| Pieza | Archivo:línea | Qué aporta |
|---|---|---|
| Rutina (plantilla compartida) | `prisma/schema.prisma:309-323` | `Rutina` con `objetivoPrincipal` (`:312`), `frecuenciaSemanal` (`:313`), `nivelDeDificultad` (`:315`, enum `:325-329`) |
| Ejercicios de la rutina | `prisma/schema.prisma:335-354` | `EjercicioEnRutina` con `series`, `repeticiones`, `descanso`, `orden` y `updatedAt` (`:349`) |
| Asignación | `prisma/schema.prisma:360-377`; `src/domains/rutina/asignar-rutina.ts:64-105`; `src/api/rutinas-asignadas.ts:17-26` | `RutinaAsignada` (socio ↔ rutina, `activa`, `fechaAsignacion`); RN-04: una activa por socio |
| Motor de progresión | `src/domains/sesion/progresion-ejercicio.ts:108-178` (`sugerirProximaCarga`) | Propón la próxima carga por ejercicio, con motivo |
| Criterio de una sesión | `src/domains/sesion/progresion-ejercicio.ts:64-78` (`leerSesion`) | Serie acierta si llega a las repeticiones objetivo; carga = la mayor de las series que cuentan |
| Racha y descarga | `src/domains/sesion/progresion-ejercicio.ts:28-29`, `:85-101` | `FALLOS_PARA_DESCARGAR = 3`, `FACTOR_DESCARGA = 0.9` (−10 % ajustado a la grilla) |
| Precarga | `src/domains/sesion/progresion-ejercicio.ts:185-194` (`cargaInicial`); `src/domains/sesion/historial-ejercicio.ts:140-150` (`cargaPrecargada`) | Carga con la que arranca cada serie |
| Historial | `src/domains/sesion/historial-ejercicio.ts:66-94` (`agruparSesiones`) | Agrupa registros por `sesionId` (o por día del gimnasio si no hay sesión) |
| Lectura y cableado | `src/domains/sesion/sesion-de-entrenamiento.ts:891-929` (`seguimientoDeEjercicios`), `:817-857` (`registrosDeEjercicio`), `:806-815` (`incrementoLineal`), `:39` (`REGISTROS_PARA_ULTIMA_VEZ = 50`) | Una sola lectura por ejercicio alimenta "última vez", sugerencia y récords |
| Regla de progresión | `prisma/schema.prisma:562-573`; `src/domains/home-socio/home-socio.ts:221` (`DEFAULT_INCREMENTO_KG = 2.5`) | Incremento `LINEAL` (o 2,5 por defecto); `ONDULANTE` sin lógica |
| Registro por serie | `prisma/schema.prisma:514-539`; `src/domains/sesion/sesion-de-entrenamiento.ts:520-545` | `RegistroDeProgreso` por serie, con `sesionId`, `numeroSerie`, `rir`, `tipo` |
| Validación de RIR | `src/domains/sesion/sesion-de-entrenamiento.ts:41-42`, `:193-200` | RIR entero entre 0 y 5; nulo permitido |
| Tipos de serie | `src/domains/sesion/tipo-serie.ts:17-50`; `prisma/schema.prisma:503-512` | `NORMAL`, `CALENTAMIENTO`, `HASTA_EL_FALLO`, `DROP_SET`; el drop no ocupa serie |
| Consumo del motor | `src/api/home-socio-data.ts:327` (tarjeta Progreso, D-60); `src/domains/sesion/resumen-sesion.ts:107` (resumen, D-62) | La sugerencia del motor llega al Home y al resumen de fin de sesión |
| Objetivo de rutina | `src/domains/rutina/rutina.ts:15-21` | `OBJETIVOS_PRINCIPALES`: Hipertrofia, Fuerza, Resistencia, Pérdida de Peso, Acondicionamiento General |
| Volumen por músculo | `src/domains/ejercicio/musculos.ts:19` (18 músculos), `:201` (`volumenPorMusculo`); `src/domains/ejercicio/balance-muscular.ts:76` (`armarBalance`); `src/api/balance-muscular.ts:24` | Base de la capa meso; hoy es una tarjeta, no un insumo del motor |
| Datos del socio | `prisma/schema.prisma:60-97` | `fechaAlta` (`:66`), `pesoObjetivo`/`pesoInicialDeMeta` (`:75-76`); sin meta de entrenamiento, nivel, días ni lesiones |
| Seed | `prisma/seed-data.ts:86-126` (rutinas), `:291-293` (regla), `:128-133` (historial), `:371-437` (tracking), `:439-446` (pesajes) | Un único socio con tres sesiones de historial para probar el tracking |

### Cómo se calcula HOY la progresión (verificable)

- **Función**: `sugerirProximaCarga(todas, prescripcion, incrementoKg, planDesde?)` → `Sugerencia` (`src/domains/sesion/progresion-ejercicio.ts:108-178`, tipo en `:45-53`).
- **Entradas**: el historial de sesiones del ejercicio (`SesionHistorica[]`, de `agruparSesiones`, `historial-ejercicio.ts:66-94`); la prescripción `{ series, repeticiones }` de la rutina actual (`sesion-de-entrenamiento.ts:914-919`); el incremento (primera `ReglaDeProgresion` `LINEAL` o `DEFAULT_INCREMENTO_KG`, `:806-815` y `home-socio.ts:221`); y `planDesde` = `EjercicioEnRutina.updatedAt` (`:918`).
- **Salida**: `{ tipo: "primera" | "subir" | "mantener" | "descargar", carga: number | null, motivo: string }` (`progresion-ejercicio.ts:45-53`).
- **Criterio**: `leerSesion` (`:64-78`) deja afuera drop set y calentamiento, toma las series pedidas, `carga` = la mayor y `cumplida` = todas las series con `repeticiones >= objetivo`. Si la última cumple → `subir` (+incremento). Si no → `mantener`. `rachaDeFallos` (`:85-93`) cuenta fallos seguidos a la misma carga; con `FALLOS_PARA_DESCARGAR = 3` (`:28`) → `descargar` un 10 % (`FACTOR_DESCARGA = 0.9`, `:29`), ajustado a la grilla del incremento (`cargaDescargada`, `:96-101`). `planDesde` excluye las sesiones anteriores a un cambio de series/repeticiones (`:114-126`).
- **Cableado**: `seguimientoDeEjercicios` (`:891-929`) lee el historial por ejercicio (`:817-857`, acotado a 50, `:39`) y llama a `sugerirProximaCarga` (`:914`). Lo consumen la pantalla de ejecución y `GET /api/sesiones?enCurso=1` / `POST /api/sesiones` (D-59, `openspec/decisions.md:940-942`), la tarjeta Progreso del Home (`src/api/home-socio-data.ts:327`) y el resumen de fin de sesión (`src/domains/sesion/resumen-sesion.ts:107`).

### Qué se registra por serie (verificable)

`RegistroDeProgreso` (`prisma/schema.prisma:514-539`): `carga` (kg), `repeticiones`, `pesoCorporal?` (`:518-519`), `rir?` 0–5 (`:521`), `numeroSerie?` (`:523`), `tipo` (`:525`, `NORMAL` por defecto), `fecha` (`:526`), `ejercicioId`, `socioId`, `sesionId?`. `registrarSerie` valida el RIR (`sesion-de-entrenamiento.ts:193-200`) y guarda la fila (`:520-545`); el drop set se guarda sin `numeroSerie` ni `rir` y cuelga de la serie (`:639-649`, D-69); el calentamiento se guarda sin `numeroSerie` y no mueve la sesión (`:528-536`, D-64).

### Qué se ignora (verificable)

- **El RIR en el criterio** (detalle en el Bloque 1).
- **`RegistroDeProgreso.pesoCorporal`**: existe (`prisma/schema.prisma:518-519`) pero "sigue sin usarse en ningún lado" (D-65, `openspec/decisions.md:1112`).
- **`ReglaDeProgresion.ONDULANTE`**: el enum existe (`prisma/schema.prisma:570-573`) pero "sigue sin lógica" (D-59, `openspec/decisions.md:936`); `incrementoLineal` solo lee la primera `LINEAL` (`sesion-de-entrenamiento.ts:809-814`).
- **Meta, nivel, días disponibles, lesiones y fatiga**: no entran. El motor solo lee `carga`, `repeticiones` y `tipo` (`progresion-ejercicio.ts:69-76`).
- **Ejercicios asistidos**: no se distinguen (P-44, `openspec/decisions.md:1042-1043` y `:1898`).

### Bloque 1 — ¿El RIR entra HOY al motor? NO (verificable)

**Respuesta: NO.** El RIR se **persiste** y se **transporta**, pero **no participa del criterio** de progresión.

- Se guarda por serie: `prisma/schema.prisma:521` (`rir Int?`), validado 0–5 en `src/domains/sesion/sesion-de-entrenamiento.ts:193-200`.
- Se lee en la consulta del historial: `src/domains/sesion/sesion-de-entrenamiento.ts:831` (`rir: true`) y se mapea en `:851`.
- Viaja por el historial: `RegistroHistorico.rir` (`src/domains/sesion/historial-ejercicio.ts:19`) y `SerieUltimaVez.rir` (`:32`), y `agruparSesiones` lo copia (`:88`).
- **Pero el motor no lo lee**: `src/domains/sesion/progresion-ejercicio.ts` no tiene ninguna referencia a `rir` (las únicas coincidencias de texto son la palabra "sugerir"). `leerSesion` (`:64-78`) solo usa `s.tipo`, `s.carga` y `s.repeticiones`; `SesionLeida` (`:38-43`) solo expone `{ carga, cumplida }`; `sugerirProximaCarga` (`:108-178`), `rachaDeFallos` (`:85-93`) y `cargaDescargada` (`:96-101`) no lo mencionan; `cargaInicial` (`:185-194`) y `cargaPrecargada` (`historial-ejercicio.ts:140-150`) tampoco.
- **Consecuencia**: hoy una serie con RIR 0 (al fallo) y una con RIR 4 se juzgan igual si hicieron las mismas repeticiones. La carga se propone por repeticiones cumplidas, no por esfuerzo percibido. La pantalla sí muestra el RIR en la última vez (`historial-ejercicio.ts:163`) y el resumen lo muestra (`describirSeries`), pero el número no alimenta la sugerencia.

## 3. Brechas de datos

| Dato | Estado hoy (verificable) | Dónde viviría | Justificación breve |
|---|---|---|---|
| Meta de entrenamiento ("mejorar press banca", "definir") | **No existe.** `Rutina.objetivoPrincipal` es de la plantilla (`prisma/schema.prisma:312`; lista en `src/domains/rutina/rutina.ts:15-21`); `Socio.pesoObjetivo` es peso corporal (`schema.prisma:75`) | `Socio.meta` (enum nuevo) o `MetaDeEntrenamiento` por socio | Sin meta no hay fase ni transición; es el disparador del cambio automático |
| Nivel / experiencia | **No existe por socio.** `Rutina.nivelDeDificultad` es de la plantilla (`schema.prisma:315`) | `Socio.nivel` reusando `NivelDeDificultad` (`schema.prisma:325-329`), o inferido de `fechaAlta` + historial | Determina incrementos y ejercicios; hoy el incremento es único para todos (`schema.prisma:562-568`) |
| Días disponibles / frecuencia real | **No existe por socio.** `Rutina.frecuenciaSemanal` es de la plantilla (`schema.prisma:313`); el pasado está en `Asistencia` (`:434-448`) | `Socio.diasDisponibles` (int 1–7) o `RutinaAsignada.frecuencia` | La periodización semanal necesita saber cuántos días entrena |
| Lesiones / limitaciones | **No existe.** | Tabla nueva `LimitacionDeSocio` (tipo, lado, fecha, notas) | Seguridad: el sistema no debe proponer un ejercicio lesionante |
| Antigüedad | **Existe.** `Socio.fechaAlta` (`schema.prisma:66`), `RutinaAsignada.fechaAsignacion` (`:366`), `Asistencia.fechaHora` (`:436`) | Ya existe | Alcanza para "tras ~3 meses de fuerza" |
| Peso corporal | **Existe.** `MedicionDePeso` (`schema.prisma:546-556`), `Socio.pesoObjetivo`/`pesoInicialDeMeta` (`:75-76`) | Ya existe | La meta "definir" puede colgar de acá |
| RIR | **Existe por serie.** `RegistroDeProgreso.rir` (`schema.prisma:521`) | Ya existe | Para que el motor lo use (hoy no) |
| Volumen por músculo | **Existe como tarjeta.** `src/domains/ejercicio/musculos.ts:19,201`; `balance-muscular.ts:76`; `src/api/balance-muscular.ts:24` | Ya existe (sección) | Base para la capa meso; hoy no alimenta al motor |
| Asistencias | **Existe.** `Asistencia` (`schema.prisma:434-448`) | Ya existe | Para asistencia irregular y racha |

## 4. Propiedad de la rutina

Hoy `Rutina` es una **plantilla compartida**: `RutinaAsignada` apunta a `Rutina` (`prisma/schema.prisma:364-365`) y `SesionDeEntrenamiento` apunta a `RutinaAsignada` (`:471-472`). Un socio no tiene rutina propia: recibe un puntero a una plantilla que muchos socios comparten. `asignarRutina` desactiva las asignaciones previas y crea una nueva (`src/domains/rutina/asignar-rutina.ts:85-98`). El motor lee `EjercicioEnRutina` de la plantilla y usa `updatedAt` como "cuándo cambió el plan" (`progresion-ejercicio.ts:106-116`).

Si el sistema va a **adaptar** la rutina por socio, hay tres opciones:

| Opción | Qué es | Costos | Riesgos | Migración | Impacto en lo ya construido |
|---|---|---|---|---|---|
| **A. Copia por socio** | Al asignar (o al adaptar), clonar `Rutina` + `EjercicioEnRutina` en una rutina propia del socio | Medio: hay que decidir cuándo copiar | Duplica plantillas; la pantalla de Rutinas deja de reflejar lo que el socio ve | No requiere migración si se crea una `Rutina` nueva por socio; sí tocar `asignarRutina` y el seed | `asignacion-sugerencia-ui` y `SesionDeEntrenamiento` ya leen `RutinaAsignada.rutina`, así que apuntar a la copia es transparente; cambian el CRUD de rutinas y el seed |
| **B. Ajustes por socio sobre la plantilla** | Tabla de overrides por `RutinaAsignada` + `ejercicioId` (series, repeticiones, descanso, carga) | Bajo en datos, medio en lectores: cada lectura de prescripción debe resolver el override antes de `sugerirProximaCarga` | Dos fuentes de verdad por ejercicio; `planDesde` deja de bastar; si el instructor edita la plantilla, el override puede quedar colgado | Sí: tabla nueva (aditiva) | `seguimientoDeEjercicios` y el CRUD de rutinas deben interceptar; la asignación dinámica lee la rutina activa (no el override) |
| **C. Versionado de la rutina** | `Rutina` gana versión; `RutinaAsignada` apunta a una versión; adaptar crea una nueva versión | Alto en lectores y en el CRUD: "rutina activa" pasa a "versión activa" | Explosión de versiones; comparabilidad y auditoría más complejas | Sí: migración (versión + FK) | `asignarRutina`, `SesionDeEntrenamiento`, el CRUD y el motor deben leer la versión correcta; `planDesde` se puede volver más limpio |

**Lectura**: la opción **A** es la que más se acerca a "cada socio tiene su rutina" sin reescribir el motor; la **B** es la más barata en datos pero la más ambigua en lectores; la **C** es la más honesta con el historial y la más cara. La elección condiciona el primer slice y el diseño; **resuelta en D-135 (opción A, copia perezosa)**.

## 5. Hipótesis de arquitectura en tres capas (a validar)

Hipótesis de trabajo (no decidida): **el sistema propone, el instructor aprueba**. Ninguna de estas capas especifica quién ejecuta el cambio.

| Capa | Qué lee | Qué produce | ¿Función pura? | Estado hoy |
|---|---|---|---|---|
| **Micro** (carga por sesión) | Historial del ejercicio (`agruparSesiones`), prescripción de la rutina, incremento, `planDesde` | `Sugerencia { tipo, carga, motivo }` | Sí (`progresion-ejercicio.ts`) | Existe (D-59). Extensión tentativa: que el criterio lea RIR y fatiga |
| **Meso** (semanal, por músculo) | `RegistroDeProgreso` agrupado por los 18 músculos (`musculos.ts:19`), asistencias, series de trabajo | Volumen por músculo, estancamiento, fatiga | Sí (`balance-muscular.ts:76`, `musculos.ts:201`) | Existe como tarjeta/sección (D-107), no como insumo del motor |
| **Macro** (fase según meta) | Meta del socio, antigüedad, historial de fases, volumen meso | Fase (fuerza / hipertrofia / descarga) y transición | Sería pura (a diseñar) | **No existe** |

La frontera entre capas es lo que hay que validar: el micro hoy no recibe nada del meso ni del macro; el macro sería el único que tocaría la rutina (vía la propiedad elegida en §4).

## 6. Riesgos y límites

- **Datos escasos**: el seed deja un único socio con tres sesiones de historial (`prisma/seed-data.ts:128-133`, `:371-437`); no hay volumen real para inferir nivel ni fases.
- **Asistencia irregular**: la periodización semanal asume una frecuencia; con `Asistencia` irregular, la detección de estancamiento puede confundir "no vino" con "se estancó".
- **RIR autoinformado**: 0–5, lo pone el socio (`schema.prisma:521`, `sesion-de-entrenamiento.ts:193-200`); no es una medida objetiva.
- **Responsabilidad del gimnasio**: el motor propone cargas; no es consejo médico. Una lesión o una meta de salud requiere firma humana (refuerza la hipótesis "propone, aprueba").
- **Criterio lineal simple**: D-59 descarta rangos de repeticiones, doble progresión y Greyskull (`openspec/decisions.md:937-939`); el "automático" de Fernando convive con esa simplificación.
- **`planDesde` depende de `updatedAt`**: solo cambiar series/repeticiones lo mueve (D-61, `openspec/decisions.md:973-996`); una adaptación que no toque esos campos no reinicia el juicio.
- **Spec vs. código**: el spec `rutinas-crud` dice que `objetivoPrincipal` es un enum predefinido (`openspec/specs/rutinas-crud/spec.md:21`) y el schema lo guarda como `String` (`prisma/schema.prisma:312`); la lista vive en `rutina.ts:15-21`. Una meta nueva debe decidir si sigue ese patrón.
- **No probado con base real ni en navegador**: D-59 lo registra (`openspec/decisions.md:950`); el tracking y el catálogo tampoco (`PROJECT-STATUS.md:196`).

## 7. Decisiones

### 7.1 Resueltas por Fernando (2026-11-18)

#### Decisión 1 — Aprobación → **D-134**

**Resuelta: el sistema propone y el instructor aprueba.** La propuesta se modela como registro con estado, de modo que una auto-aprobación futura sea configuración y no rediseño. Descartadas: automático y aceptación por el socio. Ver D-134.

#### Decisión 2 — Propiedad de la rutina → **D-135**

**Resuelta: copia por socio, creada de forma perezosa en la primera adaptación**; el socio sin meta sigue en la plantilla compartida. Se agrega `planActualizadoAt` en `EjercicioEnRutina` como fuente de `planDesde`, en lugar de `updatedAt`. Migración aditiva. Ver §4 y D-135.

#### Decisión 3 — Alcance del primer slice → **D-136**

**Resuelta: opción B cortada en slices.** S1 motor puro de micro con RIR como señal blanda y tests con historiales sintéticos; S2 persistencia (copia por socio y propuesta); S3 aprobación del instructor y vista del socio. **Meso queda fuera de este change.** Ver D-136.

### 7.2 Recomendación provisional — pendiente de Fernando

Lo que sigue **no está decidido**: es la recomendación de esta exploración.

#### Decisión pendiente 4 — Metas soportadas en el MVP

- A. Las de `OBJETIVOS_PRINCIPALES` (`rutina.ts:15-21`). B. Una sublista acotada (Fuerza, Hipertrofia, Definición). C. La meta del socio como texto libre.

**Recomendación provisional: B**: un enum nuevo en `Socio` con 2–3 valores, para mapear a fase sin texto libre. "Definición" hoy no está en la lista (`rutina.ts:15-21`).

#### Decisión pendiente 5 — Cómo se infiere el nivel

- A. El instructor lo carga. B. Se infiere de `fechaAlta` + historial. C. Se pregunta al socio.

**Recomendación provisional: A** (dato explícito, reusa `NivelDeDificultad`) y dejar B como mejora. El nivel condiciona el incremento.

#### Decisión pendiente 6 — Descarga: ¿reactiva o calendario?

- A. Reactiva (como hoy: 3 fallos seguidos → −10 %, `progresion-ejercicio.ts:28`). B. Calendario (cada N semanas). C. Ambas.

**Recomendación provisional: C** si el macro existe; A si solo hay micro. La descarga de D-59 ya es reactiva y hoy no hay calendario.

#### Decisión pendiente 7 — Qué ve el socio

- A. Solo la sugerencia de carga (como hoy). B. La rutina de la semana y el motivo. C. La fase y el historial de cambios.

**Recomendación provisional: B**: el motivo ya existe (`Sugerencia.motivo`, `progresion-ejercicio.ts:52`) y mostrar la rutina adaptada da transparencia sin exponer el motor.

## 8. Preguntas abiertas para la fase de research

1. ¿Qué fuentes de referencia (openGym u otras) sobre periodización automática se pueden citar sin copiar código? (D-58…D-69 ya siguieron a openGym como referencia, no como copia.)
2. ¿Qué modelo de fases (fuerza/hipertrofia/descarga) es defendible para un gimnasio generalista y con qué duraciones?
3. ¿Cómo distinguir "no vino" de "se estancó" con la `Asistencia` y el `RegistroDeProgreso` actuales?
4. ¿Qué regla de descarga es segura con RIR autoinformado y con ejercicios asistidos (P-44)?
5. ¿Dónde debe vivir la meta del socio para que el peso corporal (`Socio.pesoObjetivo`, `prisma/schema.prisma:75`) y la meta de entrenamiento no se mezclen?
6. ¿Qué contrato de API y qué permisos necesita la aprobación del instructor? Hoy el instructor solo lee `/api/sesiones` (`src/lib/authorization.ts`).
7. ¿Cómo se copia o versiona la rutina sin romper `asignacion-sugerencia-ui` (que lee la rutina activa) ni la sesión en curso?
