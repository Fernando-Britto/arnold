# Research — adaptacion-rutina

- **Change**: `adaptacion-rutina`
- **Rama**: `feat/adaptacion-rutina`
- **Fecha**: 2026-11-18
- **Estado**: research. Documento de evidencia para criterios del motor de adaptación.
- **Verificación**: los 10 DOIs de las fuentes semilla se resolvieron contra **Crossref** y sus abstracts contra **PubMed** el 2026-11-18. Cada fuente declara su nivel real: `METADATOS` (DOI resuelve, abstract no leído), `ABSTRACT` (abstract leído), `TEXTO COMPLETO` (se leyó el cuerpo), o `NO VERIFICADO`.
- **Límite**: resolver un DOI prueba que la fuente existe y coincide con el título; **no** prueba que cada cifra citada acá provenga de ella. Los números marcados como *práctica* vienen de la práctica del entrenamiento, no de una tabla del paper.

---

## 1. Resumen ejecutivo

**Qué se verificó en vivo (2026-11-18)**

- Los 10 DOIs semilla resuelven en Crossref con autores, año y revista esperados. La meta-regresión de "67 estudios / 2.058 participantes" es **Pelland et al. (2026)**, *Sports Med* 56(2):481-505, DOI `10.1007/s40279-025-02344-w` (Epub 2025-12-04): el abstract confirma exactamente esas cifras.
- Se leyeron abstracts completos de Pelland 2026, Robinson 2024, Bell 2023, Coleman 2024 y Halperin 2022 (parcial). El texto completo de Bell 2023 (PMC10511399) se leyó para las tablas de consenso.
- **No** se leyeron abstracts de Schoenfeld 2017 (J Sports Sci y JSCR), Williams 2017, Moesgaard 2022, Hickmott 2022 ni del posicionamiento ACSM 2009: solo metadatos.

**Los tres hallazgos que más condicionan los parámetros**

1. **El volumen semanal es el driver principal, con retornos decrecientes.** Pelland et al. 2026 (67 estudios, 2.058 participantes, 79,1 % hombres, edad media 25,2 años) reporta probabilidad posterior del 100 % de que la pendiente de volumen sea > 0 en hipertrofia y fuerza, con ajuste por duración y nivel. La **frecuencia** no mostró efecto apreciable en hipertrofia (probabilidad posterior < 100 %) y sí un efecto positivo con retornos decrecientes en fuerza. Fuerza: media-alta para el abstract; el detalle de magnitud no se leyó.
2. **Fuerza e hipertrofia responden distinto al RIR.** Robinson et al. 2024: la pendiente de RIR para **fuerza** contiene el cero (ganancias similares en un rango amplio de RIR); para **hipertrofia** la pendiente es negativa y no contiene el cero (la masa muscular aumenta al terminar las series más cerca del fallo). Los autores advierten que la calidad de ajuste es modesta y que el RIR de cada estudio fue **estimado**, no medido.
3. **La descarga tiene consenso de definición y poco de número.** Bell et al. 2023 (Delphi, 21 expertos en la ronda final, consenso ≥ 70 %) propone una definición y acuerda que se reduce el **volumen** (series, repeticiones, días) manteniendo la intensidad relativamente alta; no fija umbrales numéricos universales. Coleman et al. 2024 (n = 39 entrenados, 9 semanas) no encontró efecto de una semana de descarga sobre hipertrofia, potencia ni resistencia local, y el grupo sin descarga ganó **más fuerza**. Es **un único ECA con cese total de una semana**: no permite concluir sobre descargas con volumen reducido ni sobre otras poblaciones.

**Implicancias**

- Los números que use el motor (series objetivo, ventana de estancamiento, factor de descarga, duración de fase) son **parámetros configurables candidatos**, no verdades derivadas.
- La detección de estancamiento **no tiene definición consensuada**: es criterio de ingeniería.
- El RIR sirve como señal, con dos correcciones: es ruidoso (Halperin 2022) y su efecto depende del objetivo (Robinson 2024: importa para hipertrofia, no para fuerza).
- La población de la evidencia es **adultos sanos, en su mayoría jóvenes entrenados**; el motor debe declarar exclusiones.

---

## 2. Tabla de criterios → fuentes → parámetros candidatos

| Criterio del motor | Fuente | Tipo de estudio | Población | Verificación | Fuerza | Límite declarado | Parámetro candidato |
|---|---|---|---|---|---|---|---|
| Volumen semanal por músculo | Schoenfeld et al. 2017, *J Sports Sci* (`10.1080/02640414.2016.1210197`) + Pelland et al. 2026, *Sports Med* (`10.1007/s40279-025-02344-w`) | Meta-regresión | 2.058 participantes, 79 % hombres, ~25 años | Pelland: ABSTRACT. Schoenfeld: METADATOS | Media-alta | Retornos decrecientes; la magnitud del punto de aplanamiento no se verificó en Schoenfeld | `VOLUMEN_OBJETIVO_SEMANAL` por músculo y nivel |
| Cercanía al fallo (RIR) | Robinson et al. 2024, *Sports Med* (`10.1007/s40279-024-02069-2`) | Meta-regresiones exploratorias | Adultos entrenados en su mayoría | ABSTRACT | Media | Ajuste modesto; RIR **estimado** por estudio, no medido. Efecto en hipertrofia, no en fuerza | `RIR_OBJETIVO` por fase (no 0 por defecto) |
| Carga alta vs baja | Schoenfeld et al. 2017, *JSCR* (`10.1519/JSC.0000000000002200`) | Meta-análisis | Entrenados y recreacionales | METADATOS (abstract no leído) | Alta (según literatura previa) | El resumen de "hipertrofia similar al fallo" **no se verificó en esta sesión** | `RANGO_REPS_HIPERTROFIA` |
| Periodización | Williams 2017 (`10.1007/s40279-017-0734-y`); Moesgaard 2022 (`10.1007/s40279-021-01636-1`) | Meta-análisis | Mixta | METADATOS | Media | No se leyó el tamaño del efecto | `DURACION_FASE_SEMANAS` |
| Autorregulación por RIR | Hickmott 2022 (`10.1186/s40798-021-00404-9`) | Revisión sistemática + meta-análisis | Entrenados | METADATOS | Media | Superioridad vs prescripción fija no verificada acá | `USAR_RIR_COMO_SENAL` (bool) |
| Precisión del RIR | Halperin 2022, *Sports Med* 52(2):377-390 (`10.1007/s40279-021-01559-x`) | Scoping review + meta-análisis exploratorio | Entrenados | ABSTRACT parcial (objetivo; resultados no) | Media | Error de predicción no verificado en magnitud | `RIR_FACTOR_CORRECCION_POR_NIVEL` |
| Progresión de carga y frecuencia | ACSM 2009 (`10.1249/MSS.0b013e3181915670`) | Posicionamiento de consenso | Adultos sanos | METADATOS | Media | Documento de posición; sin abstract con cifras | `INCREMENTO_POR_FASE_PCT` |
| Descarga — definición y variables | Bell et al. 2023, *Sports Med Open* 9:87 (`10.1186/s40798-023-00633-0`; PMC10511399) | Consenso Delphi (34/29/21 expertos) | Coaches de fuerza y físico | TEXTO COMPLETO (intro + tablas) | Alta para el acuerdo; baja para umbrales | Consenso ≥ 70 %; sin números universales | `DELOAD_REDUCCION_VOLUMEN_PCT` |
| Descarga — evidencia empírica | Coleman et al. 2024, *PeerJ* 12:e16777 (`10.7717/peerj.16777`) | Ensayo controlado aleatorizado | 39 entrenados (29 M / 10 F), 9 semanas | ABSTRACT | Media-baja | Un solo ECA, cese total de 1 semana, n = 39, miembros inferiores; no habla de descargas con volumen reducido | `DELOAD_DURACION_SEMANAS` |
| Estimación 1RM submáxima | Epley 1985; Brzycki 1993; validaciones posteriores | Estudios de validación | Mixta | NO VERIFICADO | Baja-media | Los errores por rango de repeticiones son *práctica*, no verificados acá | `RM_ESTIMACION_MAX_REPS` |
| Tasas de progreso por nivel | Derivado de ACSM 2009 + práctica | Síntesis | Entrenados | NO VERIFICADO | Baja (indirecta) | No hay paper que fije kg/semana por nivel | `INCREMENTO_KG_POR_NIVEL` |
| Detección de estancamiento | — | — | — | — | — | **No hay definición consensuada: criterio de ingeniería** | `ESTANCAMIENTO_VENTANA_SESIONES` |

---

## 3. Detalle por tema

### 3.1 Volumen de entrenamiento y masa muscular

**Fuentes**
- Schoenfeld, Ogborn & Krieger (2017), *Journal of Sports Sciences* 35(11):1073-1082. DOI `10.1080/02640414.2016.1210197` (online 2016). **METADATOS**: el DOI resuelve; abstract no leído.
- Pelland, Remmert, Robinson, Hinson & Zourdos (2026), *Sports Medicine* 56(2):481-505. DOI `10.1007/s40279-025-02344-w` (Epub 2025-12-04). PMID 41343037. **ABSTRACT**.
- Preprint previo: Pelland et al. (2024), SportRxiv, DOI `10.51224/srxiv.460` (4-oct-2024), mismo título. **Citar la versión publicada** en la bibliografía; no mezclar preprint y publicación. El DOI publicado se comprobó contra `doi.org` (302 → link.springer.com).

**Evidencia (Pelland 2026, abstract)**
- 67 estudios, 2.058 participantes (79,1 % hombres; 20,9 % mujeres; 25,16 ± 5,22 años). Modelos ajustados por duración de la intervención y nivel de entrenamiento.
- Clasificaron cada serie como directa o indirecta y probaron tres formas de cuantificar volumen; la "fraccional" (indirectas = 0,5) fue la de mejor evidencia relativa y se usó en los modelos primarios.
- Volumen: probabilidad posterior del 100 % de pendiente > 0 en hipertrofia y en fuerza, con **retornos decrecientes**; el aplanamiento es mucho más marcado en fuerza.
- Frecuencia: probabilidad posterior < 100 % para hipertrofia (compatible con efecto despreciable); 100 % para fuerza, con retornos decrecientes.

**Relevante para el change posterior de meso/macro, no para S1**

- (a) La frecuencia solo tiene un efecto identificable consistente en **fuerza**; para hipertrofia no aporta una ganancia identificable una vez contado el volumen semanal total.
- (b) El volumen muestra rendimientos decrecientes **más marcados en fuerza** que en hipertrofia.
- **Cautela (discusión abierta)**: un preprint de octubre de 2026, no revisado por pares (`preprints.org/manuscript/202610.1022`), sostiene que buena parte del efecto de frecuencia que predice ese modelo sale de un parámetro calibrado y no medido. No se pudo verificar desde esta sesión (el sitio respondió 403): se registra como señal de que el punto está discutido, no como refutación.

**Inferencia del equipo (no evidencia)**
- El punto de aplanamiento en series/músculo/semana no se puede fijar con este abstract: Pelland reporta forma de la curva, no un umbral operativo. Cualquier "8–10 series" es **práctica**, no el hallazgo.
- Como la frecuencia no aporta a hipertrofia, el motor no necesita exigir días extra por músculo; le alcanza con contar series efectivas.
- La capa meso está fuera de este change (D-136): el volumen se documenta para el change posterior.

**Parámetro candidato**: `VOLUMEN_OBJETIVO_SEMANAL_POR_MUSCULO_Y_NIVEL` (valores iniciales de práctica: novato 6–8, intermedio 8–12, avanzado 10–16; **a calibrar**).

### 3.2 Cercanía al fallo y RIR

**Fuente**: Robinson, Pelland, Remmert, Refalo, Jukic, Steele & Zourdos (2024), *Sports Medicine* 54(9):2209-2231. DOI `10.1007/s40279-024-02069-2`. PMID 38970765. **ABSTRACT**.

**Evidencia (abstract)**
- Cuantificaron la cercanía al fallo como RIR, **estimado** a partir de la descripción de cada intervención. Meta-regresiones exploratorias multinivel, ajustadas por carga, método de equiparación de volumen, duración y nivel.
- **Fuerza**: en todos los modelos de mejor ajuste, el intervalo de confianza de la pendiente de RIR contiene el cero → relación despreciable. Las ganancias de fuerza son similares en un rango amplio de RIR.
- **Hipertrofia**: las pendientes fueron negativas y sus intervalos **no** contienen el cero → la masa muscular aumenta al terminar las series más cerca del fallo.
- Los autores declaran calidad de ajuste modesta y que la relación exacta sigue sin estar clara por la estimación del RIR.

**Corrección respecto de la versión anterior de este documento**: no es cierto que "ir al fallo no da más hipertrofia". La evidencia de Robinson va en la dirección opuesta para hipertrofia y en la dirección "da igual" para fuerza.

**Inferencia del equipo**
- Para **fuerza**, el RIR no discrimina: no hace falta acercarse al fallo y conviene preservar fatiga.
- Para **hipertrofia**, acercarse al fallo aporta, pero el costo de fatiga crece. Un objetivo intermedio (RIR 1–2) es una política razonable, no un hallazgo.
- El RIR del sistema es autoinformado: la señal es ruidosa (ver 3.6). Debe leerse como tendencia, no como valor puntual.

**Parámetros candidatos**: `RIR_OBJETIVO_FUERZA` (práctica: 2–3), `RIR_OBJETIVO_HIPERTROFIA` (práctica: 1–2), `RIR_VENTANA_TENDENCIA` (sesiones).

### 3.3 Carga alta vs carga baja

**Fuente**: Schoenfeld, Grgic, Ogborn & Krieger (2017), *Journal of Strength and Conditioning Research* 31(12):3508-3523. DOI `10.1519/JSC.0000000000002200`. **METADATOS**: DOI resuelve con el título "Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis"; el abstract no se leyó en esta sesión.

**Estado**: la afirmación "hipertrofia similar con cargas altas y bajas cuando se llega al fallo, y fuerza mayor con carga alta" es **literatura conocida pero no verificada acá**. Tratarla como dirección probable, no como cita confirmada.

**Parámetros candidatos (práctica)**: `RANGO_REPS_FUERZA` (3–6), `RANGO_REPS_HIPERTROFIA` (6–20).

### 3.4 Periodización

**Fuentes**
- Williams, Tolusso, Fedewa & Esco (2017), *Sports Medicine*. DOI `10.1007/s40279-017-0734-y` — "Comparison of Periodized and Non-Periodized Resistance Training on Maximal Strength: A Meta-Analysis". **METADATOS**.
- Moesgaard et al. (2022), *Sports Medicine*. DOI `10.1007/s40279-021-01636-1` — "Effects of Periodization on Strength and Muscle Hypertrophy in Volume-Equated Resistance Training Programs". **METADATOS**.

**Estado**: ambos DOIs resuelven con títulos que confirman el tema. **No se leyó el tamaño del efecto ni la población**, así que "ventaja pequeña-moderada, mayor en intermedios-avanzados" queda como **inferencia del equipo**, no como evidencia verificada.

**Parámetro candidato**: `DURACION_FASE_SEMANAS` (práctica: 4–8; default 6).

### 3.5 Autorregulación por RIR

**Fuente**: Hickmott, Chilibeck, Shaw & Butcher (2022), *Sports Medicine - Open*. DOI `10.1186/s40798-021-00404-9` — "The Effect of Load and Volume Autoregulation on Muscular Strength and Hypertrophy: A Systematic Review and Meta-Analysis". **METADATOS**.

**Estado**: DOI y título verificados; conclusión no leída. "Factible, sin superioridad concluyente sobre la prescripción fija" es **inferencia del equipo**.

**Inferencia para el motor**: usar el RIR como señal blanda (D-136) es coherente con un estado de la evidencia que no permite afirmar superioridad de la autorregulación diaria.

### 3.6 Precisión del RIR

**Fuente**: Halperin, Malleron, Har-Nir, Androulakis-Korakakis, Wolf, Fisher & Steele (2022), *Sports Medicine* 52(2):377-390 (Epub 2021-09-20). DOI `10.1007/s40279-021-01559-x`. PMID 34542869. **ABSTRACT parcial**: se leyó el objetivo (comparar repeticiones predichas vs reales hasta el fallo, scoping review + meta-análisis exploratorio); **no** se leyeron los resultados numéricos.

**Estado**: la dirección "el RIR autoinformado tiene error y el error es mayor en novatos" es **inferencia del equipo**; la magnitud (2–3 repeticiones) **no está verificada** en esta sesión.

**Inferencia para el motor**: no confiar en el RIR puntual. Usar tendencia y, si se corrige, hacerlo con un factor por nivel como parámetro explícito.

**Parámetro candidato**: `RIR_FACTOR_CORRECCION_POR_NIVEL` (práctica: novato +1, intermedio +0,5, avanzado 0).

### 3.7 Progresión de carga y frecuencia (ACSM)

**Fuente**: American College of Sports Medicine (2009), "Progression Models in Resistance Training for Healthy Adults", *Medicine & Science in Sports & Exercise* 41(3):687-708. DOI `10.1249/MSS.0b013e3181915670`. **METADATOS**: DOI resuelve; es un posicionamiento, sin abstract con cifras.

**Estado**: la regla "incrementos de 2–10 % según nivel" es **práctica extendida**, no un dato verificado acá.

**Inferencia para el motor**: el incremento fijo de 2,5 kg del sistema actual es conservador para un novato en multiarticular y agresivo para un avanzado. Parametrizar por nivel y por tipo de ejercicio.

### 3.8 Descarga (deload)

**Fuentes**
- Bell, Strafford, Coleman, Androulakis Korakakis & Nolan (2023), *Sports Medicine - Open* 9:87. DOI `10.1186/s40798-023-00633-0`; PMC10511399. PMID 37730925. **TEXTO COMPLETO parcial** (introducción y tablas de consenso).
- Coleman et al. (2024), *PeerJ* 12:e16777. DOI `10.7717/peerj.16777`. PMID 38274324. **ABSTRACT**.

#### Bell et al. 2023 — consenso Delphi

- Método: 3 rondas; 34 coaches en la primera, 29 en la segunda, 21 en la tercera. Consenso definido como ≥ 70 % de acuerdo o desacuerdo fuerte.
- **Definición acordada** (paráfrasis): período de estrés de entrenamiento reducido, pensado para mitigar fatiga fisiológica y psicológica, favorecer la recuperación y mejorar la preparación para el entrenamiento siguiente.
- **Variables**: el acuerdo es reducir **volumen**. En la ronda final: bajar series (100 % de acuerdo), bajar repeticiones (100 %) y recortar días de entrenamiento (100 %); usar una dosis mínima efectiva de volumen (90,5 %); mantener ejercicios conocidos (100 %); reducir ejercicios secundarios (95,2 %).
- **Intensidad**: "la intensidad podría mantenerse alta durante la descarga" reunió 81 % de acuerdo: se reduce volumen, no necesariamente carga.
- **Duración y frecuencia**: el consenso **no fija números**. La introducción del paper describe la práctica habitual como una descarga cada 4–6 semanas de ~7 días, con rango de una sesión a 2 semanas, y menciona descargas preplanificadas cada 4–8 semanas. Eso es **contexto citado por los autores**, no un umbral consensuado.

#### Coleman et al. 2024 — evidencia empírica

- 39 entrenados (29 hombres, 10 mujeres) en un programa supervisado de 9 semanas, con una semana sin entrenamiento en el punto medio (DELOAD) vs entrenamiento continuo (TRAD).
- **Resultados (abstract)**: sin diferencias apreciables en hipertrofia de miembros inferiores, resistencia local ni potencia. TRAD mostró **mayor mejora de fuerza** isométrica y dinámica. TRAD también mostró una leve ventaja en el cuestionario de disposición a entrenar.
- **Conclusión de los autores**: una semana de descarga a mitad de un programa de 9 semanas parece afectar negativamente la fuerza de miembros inferiores, sin efecto en hipertrofia, potencia ni resistencia local.

**Inferencia del equipo**
- La descarga **reactiva** del sistema (3 fallos → −10 %) no está validada por esta literatura: se sostiene por **criterio de ingeniería** y, en todo caso, por el consenso de Bell (reducir volumen), no por este ensayo.
- Una descarga **por calendario** no tiene apoyo empírico en este ensayo, pero el ensayo prueba una sola cosa: **cese total de una semana**. No dice nada sobre descargas con volumen reducido, que es el protocolo que describe Bell, ni sobre otras poblaciones o duraciones.
- Reducir series/días y mantener la carga es la opción más alineada con el consenso Delphi. Si se implementa calendario, debe ser opcional y configurable.

**Parámetros candidatos**: `DELOAD_REDUCCION_VOLUMEN_PCT`, `DELOAD_REDUCCION_INTENSIDAD_PCT` (práctica: 0 %, mantener), `DELOAD_DURACION_SEMANAS`, `DELOAD_CALENDARIO_SEMANAS` (apagado por defecto).

### 3.9 Detección de estancamiento

**Estado**: **no hay definición consensuada ni umbral operativo en la literatura consultada.** Es criterio de ingeniería.

Criterios pragmáticos usados en la práctica: N sesiones consecutivas sin progreso de carga o repeticiones a la misma carga; caída respecto de un promedio móvil; combinación de RIR bajo sostenido con carga estancada.

**Criterio actual del sistema** (`src/domains/sesion/progresion-ejercicio.ts:28`): `FALLOS_PARA_DESCARGAR = 3`. Defendible como ingeniería, no como derivación bibliográfica.

**Parámetros candidatos**: `ESTANCAMIENTO_VENTANA_SESIONES` (default 3), `ESTANCAMIENTO_MIN_EJERCICIOS_AFECTADOS` (default 1).

### 3.10 Estimación de 1RM desde series submáximas

**Fuentes**: fórmulas de Epley (1985) y Brzycki (1993), más validaciones posteriores. **NO VERIFICADO**: no se resolvieron los documentos originales.

**Fórmulas (conocimiento estándar, no cita verificada)**
- Epley: `1RM = peso × (1 + reps / 30)`.
- Brzycki: `1RM = peso × (36 / (37 − reps))`.

**Validez por rango**: los cortes "alta hasta ~6 reps, cae por encima de 10" son **práctica**, no un dato verificado en esta sesión.

**Inferencia para el motor**: si se estima 1RM, hacerlo con series de ≤ 6 repeticiones y guardar la estimación como derivada, nunca como medición.

**Parámetro candidato**: `RM_ESTIMACION_MAX_REPS` (default 6).

### 3.11 Tasas de progreso esperables por nivel

**Estado**: **evidencia indirecta, no verificada**. No se encontró ni verificó un paper que fije kg/semana por nivel; los valores que siguen son práctica del entrenamiento.

| Nivel | Multiarticular | Aislamiento | Nota |
|---|---|---|---|
| Novato (0–6 meses) | ~2,5 kg/semana | ~1–1,25 kg/semana | Mayor margen de novedad |
| Intermedio (6 meses–2 años) | ~1,25 kg/semana | ~0,5–1 kg/semana | Progreso más lento |
| Avanzado (> 2 años) | ~0,5 kg/semana | ~0–0,25 kg/semana | Margen marginal |

**Inferencia para el motor**: el incremento fijo de 2,5 kg (`src/domains/home-socio/home-socio.ts:221`) es razonable solo para novatos en multiarticular. El nivel debe entrar como parámetro, no como constante.

### 3.12 "Definir" — fuerza en déficit calórico

**Estado**: **sin paper específico verificado**. "Definición" es una meta de composición corporal, no una fase de entrenamiento con literatura propia.

**Inferencia del equipo (no evidencia)**
- "Definir" = reducir grasa preservando masa magra; el déficit es nutricional y queda fuera del motor.
- La práctica recomienda mantener intensidad y recortar volumen durante el déficit, para conservar la señal mecánica con menos fatiga.
- El motor no puede verificar el déficit: solo puede proponer una rutina consistente con la meta.

**Parámetros candidatos**: `FASE_DEFINICION_VOLUMEN_FACTOR` (práctica: 0,7), `FASE_DEFINICION_INTENSIDAD_FACTOR` (práctica: 1,0).

### 3.13 Seguridad y población

**Lo que la evidencia permite afirmar**: Pelland 2026 incluye 2.058 participantes de ~25 años en promedio; Coleman 2024, 39 entrenados jóvenes; Robinson 2024, adultos entrenados. **Ninguna de las fuentes verificadas estudia menores, embarazadas, personas con lesiones activas ni patología cardiovascular.**

**Exclusiones que el motor debería declarar**
- Menores de 18 y mayores de 60–65 sin evaluación previa.
- Embarazo.
- Lesión aguda o crónica no rehabilitada.
- Condición cardiovascular no controlada.
- Trastorno de conducta alimentaria.

**Inferencia para el motor**: hoy `Socio` no tiene lesiones ni condiciones médicas (ver §3 del `explore.md`). Sin ese dato, la exclusión no se puede aplicar: es un límite declarado, no una validación.

**Parámetros candidatos**: `POBLACION_EDAD_MIN` (18), `POBLACION_EDAD_MAX` (60), `POBLACION_REQUIERE_NIVEL_EXPLICITO` (true).

### 3.14 openGym (ideas de diseño, no copia)

**Fuente**: `github.com/DuarteSantos8/openGym` (AGPL-3.0). Archivos mencionados: README, `docs/AI_COACH.md`, `frontend/src/lib/progression.js`.

**Estado**: **NO VERIFICADO**. No se leyó el repositorio en esta sesión; las ideas que siguen vienen de la referencia que ya usaron D-58…D-69.

**Regla**: AGPL-3.0 permite inspirarse en ideas, **no copiar código**. Este documento no reproduce implementaciones.

---

## 4. Lo que NO tiene evidencia directa

| Tema | Estado | Acción recomendada |
|---|---|---|
| Detección de estancamiento con umbrales numéricos | Sin consenso | Criterio de ingeniería configurable; revisar con datos reales |
| "Definición" como fase con progresión propia | Construcción de práctica | Mapear a fuerza con volumen reducido; documentar que depende de nutrición |
| Tasas de progreso por nivel (kg/semana) | Práctica, no verificada | Parametrizar y ajustar con historial real |
| Descarga por calendario | Sin apoyo en el único ECA leído (Coleman 2024: cese total de 1 semana); no evalúa descargas con volumen reducido | Apagada por defecto; reactiva primero |
| RIR como regulador diario | Superioridad no verificada (Hickmott: METADATOS) | No usarlo como regulador en este change |
| Población no adulta o con lesiones | Fuera de la literatura verificada | Declarar población objetivo y excluir |
| Fórmulas de 1RM en rangos altos | No verificadas | Limitar a ≤ 6 reps |
| Magnitud del efecto de periodización | Metadatos solamente | Leer Williams 2017 y Moesgaard 2022 antes de fijar duración de fase |
| Magnitud del efecto carga alta vs baja | Metadatos solamente | Leer Schoenfeld 2017 (JSCR) antes de fijar rangos de reps |

---

## 5. Fuentes: DOI y estado de verificación (2026-11-18)

| # | Referencia | DOI | PMID | Estado |
|---|---|---|---|---|
| 1 | Schoenfeld, Ogborn & Krieger (2017). Dose-response relationship between weekly RT volume and increases in muscle mass. *J Sports Sci* 35(11):1073-1082 | `10.1080/02640414.2016.1210197` | — | METADATOS (DOI resuelve) |
| 2 | Pelland, Remmert, Robinson, Hinson & Zourdos (2026). The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency. *Sports Med* 56(2):481-505 | `10.1007/s40279-025-02344-w` | 41343037 | ABSTRACT (67 estudios / 2.058 participantes confirmados). doi.org resuelve a Springer. Preprint SportRxiv 2024: `10.51224/srxiv.460` — citar la publicada |
| 3 | Robinson, Pelland, Remmert, Refalo, Jukic, Steele & Zourdos (2024). Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med* 54(9):2209-2231 | `10.1007/s40279-024-02069-2` | 38970765 | ABSTRACT |
| 4 | Schoenfeld, Grgic, Ogborn & Krieger (2017). Low- vs. High-Load Resistance Training. *JSCR* 31(12):3508-3523 | `10.1519/JSC.0000000000002200` | — | METADATOS |
| 5 | Williams, Tolusso, Fedewa & Esco (2017). Periodized vs. Non-Periodized RT on Maximal Strength. *Sports Med* | `10.1007/s40279-017-0734-y` | — | METADATOS |
| 6 | Moesgaard et al. (2022). Periodization on Strength and Muscle Hypertrophy in Volume-Equated Programs. *Sports Med* | `10.1007/s40279-021-01636-1` | — | METADATOS |
| 7 | Hickmott, Chilibeck, Shaw & Butcher (2022). Load and Volume Autoregulation. *Sports Med Open* | `10.1186/s40798-021-00404-9` | — | METADATOS |
| 8 | Halperin, Malleron, Har-Nir, Androulakis-Korakakis, Wolf, Fisher & Steele (2022). Accuracy in Predicting Repetitions to Task Failure. *Sports Med* 52(2):377-390 | `10.1007/s40279-021-01559-x` | 34542869 | ABSTRACT parcial (objetivo) |
| 9 | ACSM (2009). Progression Models in Resistance Training for Healthy Adults. *MSSE* 41(3):687-708 | `10.1249/MSS.0b013e3181915670` | — | METADATOS |
| 10 | Bell, Strafford, Coleman, Androulakis Korakakis & Nolan (2023). Integrating Deloading: An International Delphi Consensus. *Sports Med Open* 9:87 | `10.1186/s40798-023-00633-0` | 37730925 | TEXTO COMPLETO parcial (intro + tablas) |
| 11 | Coleman et al. (2024). Gaining more from doing less? A one-week deload. *PeerJ* 12:e16777 | `10.7717/peerj.16777` | 38274324 | ABSTRACT |
| 12 | Epley (1985); Brzycki (1993). Fórmulas de 1RM | — | — | NO VERIFICADO |

**Cómo se verificó**: `api.crossref.org/works/<DOI>` para metadatos (título, autores, año, revista) y `eutils.ncbi.nlm.nih.gov` (esearch por DOI + efetch) para abstracts y texto completo de PMC.

---

## 6. Notas metodológicas

1. **Verificación acotada**: resolver el DOI y leer el abstract no valida cada cifra del paper. Donde el documento dice *práctica*, no hay cita.
2. **Una corrección de fondo**: la versión previa afirmaba que ir al fallo no da más hipertrofia. Robinson 2024 dice lo contrario para hipertrofia y "da igual" para fuerza. Corregido en 3.2 y en la conclusión.
3. **Una fuente identificada**: la meta-regresión de 67 estudios / 2.058 participantes es Pelland et al. 2026, no una referencia sin autor.
4. **Coleman 2024 no es "apoyo limitado a la práctica" ni tampoco "evidencia en contra del calendario"**: es un único ECA (n = 39, 9 semanas) con cese total de una semana; no muestra ventaja en hipertrofia y da menos fuerza que el grupo continuo. No permite concluir sobre descargas con volumen reducido.
5. **openGym no se verificó**: las ideas de diseño siguen siendo referencia del equipo.

**Pendiente para subir la fuerza del documento**: leer los abstracts de Schoenfeld 2017 (ambos), Williams 2017, Moesgaard 2022, Hickmott 2022 y los resultados de Halperin 2022. Son cinco lecturas de abstract, no papers completos.

---

## 7. Conclusión

La evidencia verificada alcanza para tres decisiones de diseño:

1. **Volumen**: es el eje de hipertrofia, con retornos decrecientes (Pelland 2026, abstract). La frecuencia no aporta a hipertrofia. El motor debería contar series efectivas, no días.
2. **RIR**: señal, no objetivo. Importa para hipertrofia y no para fuerza (Robinson 2024), y llega ruidoso porque es autoinformado.
3. **Descarga**: definición consensuada, números no (Bell 2023). El único ECA leído (Coleman 2024) prueba cese total de una semana: sin ventaja en hipertrofia y con menos fuerza que el grupo continuo, sin evaluar descargas con volumen reducido. La descarga reactiva actual se sostiene por **criterio de ingeniería** y por el consenso de Bell, no por ese ensayo.

Todo umbral numérico de este documento es **parámetro configurable candidato**.
