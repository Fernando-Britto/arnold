# Vault de Obsidian: poner al día la documentación

**Feature**: `documentacion-vault` · **Rama**: `dev`
**Destino**: `/home/fer/Documentos/Dev/arnold-vault` (fuera del repo; no es git)
**Inicio**: 2026-11-16

## Problema

El vault quedó parado entre el **2026-10-16 y el 2026-10-21** y el repositorio va por el **2026-11-16**:
**157 commits** sin reflejar. Lo verificado contra el vault:

| Tema | Estado en el vault |
|---|---|
| Catálogo de ejercicios (T-050) | Ausente |
| Músculos y balance muscular (T-051) | Ausente |
| CRUD de máquinas (T-053) y asignación a máquinas (T-054) | Ausente (`Maquina` sí está en el modelo) |
| Motor de espera y orquestación (T-055, T-056) | Ausente |
| Sugerencia de asignación en la home (T-057) | Ausente |
| Reasignación por instructor (T-058, P-61) | Ausente |
| Tema claro/oscuro (2026-11-05) | Ausente |
| Rail rediseñado + colapsado (2026-11-16) | Ausente: 0 menciones de "rail"/"sidebar" en 130+ notas |
| Kiosco con teclado físico (2026-11-16) | Ausente |
| Decisiones D-58…D-133 | Ausente: el índice llega a D-70 |
| `AsignacionDeEjercicio`, `EjercicioMaquina` | Ausentes del modelo de datos |
| 69 operaciones HTTP (45 `route.ts`) | Documentadas 53 (34 archivos) |

## Tareas

- [x] **T1** — `Modulos/Navegación y chrome.md` (nueva): rail, zonas por rol, tema, colapsado.
- [x] **T2** — `Modulos/Asignación dinámica.md` (nueva): motor de espera, orquestación, sugerencia, reasignación.
- [x] **T3** — `Modulos/Máquinas.md` (nueva): CRUD y asociación ejercicio↔máquina.
- [x] **T4** — Actualizar `Modulos/Asistencia y control de acceso.md`: teclado físico del kiosco.
- [x] **T5** — Actualizar `Modulos/Home_Socio.md`: sugerencia, balance muscular, peso, secciones sin carga.
- [x] **T6** — Actualizar `Modulos/Home_Interno.md`: panel de sesiones en curso.
- [x] **T7** — Actualizar `Proyecto/Referencia de API.md`: 69 operaciones y las rutas nuevas.
- [x] **T8** — Actualizar `Proyecto/Modelo de datos.md`: `AsignacionDeEjercicio`, `EjercicioMaquina` y enums.
- [x] **T9** — Actualizar `Proyecto/Decisiones.md`: D-58…D-133.
- [x] **T10** — Actualizar `Proyecto/Estado del proyecto.md` y `Operacion/Testing.md`.
- [x] **T11** — Actualizar índices: `00 - Inicio.md` e `Inventario de documentación.md`.

## Estado

Completo el 2026-11-16.

- 3 notas nuevas: `Modulos/Navegación y chrome.md`, `Modulos/Asignación dinámica.md`,
  `Modulos/Máquinas.md`.
- 6 notas actualizadas: Asistencia y control de acceso, Home_Socio, Home_Interno,
  Proyecto/Referencia de API, Proyecto/Modelo de datos, Proyecto/Decisiones,
  Proyecto/Estado del proyecto, Proyecto/Arquitectura, Operacion/Testing,
  Proyecto/00 - Inventario de documentación, Validaciones/00 - Mapa de módulos, 00 - Inicio.
- Verificado: 0 links internos rotos en las notas tocadas (resolución por ruta y por nombre).
- Datos tomados del código, de `PROJECT-STATUS.md` y de `openspec/decisions.md`, no de memoria.

## Segunda pasada (mismo día)

- `Proyecto/Roles y permisos.md`: prefijos de `/api/maquinas`, `/api/asignaciones` y
  `/api/reasignaciones`; se corrigió la fila del `PUT` de sesiones del Instructor (ya no está en la
  matriz) y se actualizó la tabla de pantallas al rail nuevo.
- `Proyecto/Reglas de negocio.md`: 7 specs nuevas en §2 (máquinas, asociación, motor, sugerencia,
  seed, reasignación) y 15 invariantes nuevas en §4.
- `Proyecto/Glosario.md`: 23 términos nuevos (máquina, candidata, reserva, ocupante, cola, espera,
  ahorro, reasignación, balance muscular, rail, tema, kiosco, …).
- **UML**: los 8 artefactos + el de check-in suman una sección de ampliación con casos de uso, clases
  conceptuales y de análisis, contratos, dos secuencias de diseño, paquetes del DCD y componentes.
- Notas de módulo alineadas: Ejercicios (catálogo y relación con máquinas), Rutinas (modal T-052),
  Sesiones (consumo de la reserva), Configuración (3 parámetros nuevos), Auditoría y Autenticación.
- `Proyecto/README.md`: mapa de rutas y conteo de decisiones/pendientes al día.

## Lo que sigue sin documentar (marcado 🟡 en el inventario)

- **Checklists de Validaciones** para Máquinas, Asignación dinámica, Configuración, Oferta y
  Navegación: no existen; no se hizo el barrido de esos módulos. Es el único hueco grande.
- Los diagramas **Mermaid originales** (no los de ampliación) siguen siendo del 2026-10-15: la
  Etapa 5 está documentada aparte, no fundida en los diagramas viejos.
- Conteos que envejecen solos: `Referencia de API` (69 operaciones) y `Testing` (3965 tests).

## Reglas del vault (respetar)

- Frontmatter con `tags`, `tipo`, `actualizado`.
- Links internos `[[...]]`; al repo, rutas relativas `../arnold/...`.
- Español; identificadores sin tildes.
- No inventar: lo no verificado se marca como tal.
