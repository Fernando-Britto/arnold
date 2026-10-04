# Arnold — Estado del proyecto

**Actualizado**: 2026-10-03 · **Plan**: `openspec/sdd-tasks-tdd.md` · **Modo**: Strict TDD

## Tareas

| Tarea | Qué | Estado |
|---|---|---|
| T-001 | Schema Prisma | ✅ |
| T-022 | Role gating (middleware + contexto) | ✅ |
| T-023a | Auth infra (JWT, DB singleton, rate limit, fine-grained) | ✅ |
| T-002 – T-005 | Ejercicios (dominio, UI, API, pantalla) | ✅ |
| T-025 | Override manual de acceso (`/api/socios/[id]/access-override`) | ✅ |
| T-006 – T-009 | Rutinas | ✅ |
| T-010 – T-013 | Clientes | ✅ |
| T-014 – T-017 | Membresías | ✅ |
| T-018, T-019 | Home_Socio (Tarjeta_Detalle + página) | ✅ |
| T-020 | Home_Interno: `OperationCard`, `ActivityColumn` + dominio | ✅ |
| T-021a | Home_Interno Parte 1 (Row_Acciones, Row_Hoy, Row_Operacion) | ✅ ver abajo |
| T-021b | Home_Interno Parte 2 (Row_Gestion, Col_Actividad + integración) | ✅ ver abajo |
| T-023b | Utilidades UI (validación, formato, errores) | ⏳ `src/utils/` no existe |
| T-024 | Fixtures y factories | ⏳ `tests/factories/` no existe |

### T-021a — cómo quedó
El plan la estimaba en 250 LOC, pero T-020 no había cubierto Row_Acciones, Alertas, Aforo (staff) ni Caja. Se partió en 3 PRs encadenados (≤400 LOC):
- **PR-009-A1** dominio: `computeAforo`, `computeAlertasVencimiento`, `computePersonalEnTurno`, `aggregateHomeInternoPart1`.
- **PR-009-A2** componentes: `QuickActions`, `AlertasCard`, `AforoHoyCard`, `CajaCard`.
- **PR-009-A3** `src/api/home-interno.ts` + `src/app/home-interno/page.tsx`.
- **Fix** (T-020): `computeCajaHoy` ahora suma `TARJETA`; "hoy" se calcula en `America/Argentina/Buenos_Aires` (antes UTC).

### T-021b — cómo quedó
- **Row_Gestion**: 4 `CounterCard` (Rutinas, Ejercicios, Clientes, Membresías) con el conteo en vivo, navegan a su CRUD. Se renderizan siempre (la spec lo exige), pero la card cuyo destino no permite el rol (`ROLE_GATE_MATRIX`) queda **deshabilitada**: p. ej. un INSTRUCTOR no puede abrir Clientes ni Membresías.
- **Col_Actividad**: reusa `ActivityColumn` + `filterActivityFeed` (5 tipos, sin check-ins, 24h, más nuevo primero), compuestos dentro de `aggregateHomeInterno`. `formatHaceTiempo` se movió al dominio (se re-exporta desde el componente).
- **Contrato**: `fetchHomeInternoData` / `HomeInternoData` (antes `...Part1`) ahora incluye `contadores` y `eventos`.
- **Fixture compartido** `tests/fixtures/home-interno-data.ts` (adelanto de T-024, que sigue pendiente).

## Límites de alcance conocidos (documentados, no ocultos)

- `/api/home-socio` **no existe**: Home_Socio sigue construida contra fetch mockeado.
- `/api/home-interno` existe (`src/api/home-interno-data.ts` + `src/app/api/home-interno/route.ts`): junta datos crudos con Prisma y las reglas de negocio siguen en el dominio (`aggregateHomeInterno`). Sus consultas se probaron con Prisma simulado y contra `schema.prisma`, **no** contra una base real: validar a mano con datos reales.
- Recepcionista lee solo `/api/membresias/activas` (dropdown de Clientes, AC-004); el resto de Membresías sigue siendo solo de Admin (RN-06).
- Botones de Home_Interno sin destino (no-ops): Registrar Pago, Asignar Rutina (modal: `openspec/asignar-rutina-flowspec.md`), Control Acceso, Cierre de Caja. Las cards de Equipos y Personal tampoco tienen lista filtrada.
- Solo se renderiza la alerta "Vencimiento" (la spec no define las otras dos del diseño). Se omite "+12% vs ayer" de Caja (sin fuente de datos).
- Defaults asumidos (la spec solo documenta `periodoGracia = 0`): `diasInactividad = 15`; `capacidadMaxima` ausente → "Aforo no configurado".
- Supuestos de `/api/home-interno` que la spec no define: turnos Mañana 06–14 / Tarde 14–22 / Noche 22–06 (hora argentina); barras de aforo = franjas de 2 h entre 06 y 22 con las entradas PERMITIDAS de hoy; "activo" = entrada dentro de `ventanaAforoMinutos` (Asistencia no tiene salida); "baja de socio" = Usuario SOCIO con `deletedAt` en las últimas 24 h.
- Los controles que llevan a `/clientes` (Nuevo Socio, "Ver" de Alertas, Socios inactivos) y las cards de Row_Gestion se renderizan para todo el staff pero quedan **deshabilitados** (tooltip "Sin acceso con tu rol") cuando `ROLE_GATE_MATRIX` no deja abrir el destino.
- Recuperación `AGGREGATION_TIMEOUT` (valores cacheados + indicador) sin implementar.

## Huecos de autenticación (observados, sin resolver)

- No hay página `/login` ni rutas `/api/auth/*`, pero ambas homes redirigen a `/login` y el middleware las referencia.
- `AuthProvider` no está montado en `layout.tsx`; `logout` es un stub.
- El `matcher` de `src/middleware.ts` cubre `/api/*` y `/dashboard/*`, no `/home-interno` ni `/home-socio`: hoy esas páginas solo se protegen del lado cliente.

## Calidad

- Tests: la suite corre con `npm test`. `src/domains/ejercicio/ejercicio.test.ts` depende de una DB real (falla sin ella).
- Lint: los archivos de T-021a están limpios, pero `npx eslint src` reporta ~160 problemas preexistentes (118 errores) en el resto del código. El ítem "`npm run lint` clean" del checklist TDD **no se cumple a nivel repo**.
- Próximo paso: auth (login + middleware) o T-023b/T-024; ver "Huecos de autenticación".

## Documentación relacionada
`T-007a-PROPOSAL.md`, `T-010-011-012-013_BUGS.md`, `T-010-013-FIXES-SUMMARY.md`, `T-011-AC-CHECKLIST.md`, `T-012-CRITICAL-ISSUES.md`, `T-016_HALLAZGOS.md`.
