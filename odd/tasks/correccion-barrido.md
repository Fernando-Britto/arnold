# Corrección del barrido de verificación

## Objetivo
Corregir los hallazgos del barrido de verificación por código de los 11 módulos de Arnold (Documentados en `~/Documentos/Dev/arnold-vault`, plan en `Planes/2026-10-13 - Plan de cierre de pendientes.md`).

## Problema
El barrido produjo 82 hallazgos nuevos (93 notas totales). Hay 1 de severidad ALTA con pérdida de datos (NF-1), varios P1 de integridad/seguridad y un bug transversal repetido en ~11 rutas.

## Por qué
El sistema está "hecho" pero no verificado integralmente. La corrección cierra las brechas antes de conectar hardware real (T-041) y desplegar.

## Scope autorizado
- Repo `arnold`, branch `dev`.
- Sólo código + tests. No hay cambios de schema salvo que un hallazgo lo exija explícitamente (se pedirá confirmación).
- **No commitear** hasta que el usuario lo pida (regla de `AGENTS.md`).

## Constraints
- **Strict TDD**: RED → GREEN → REFACTOR. Runner: `npx jest`.
- Criterio lint D-14: sin errores nuevos en lo tocado.
- PR ≤ 400 LOC por unidad de trabajo.
- No romper contratos existentes (DTOs, rutas).

## Checks
- `npx jest <suites tocadas>`
- `npx tsc --noEmit`
- `npx eslint <archivos tocados>`

## Unidades de trabajo
- [ ] **U1 (P0) · NF-1** — Editar una rutina borra todos sus ejercicios (pérdida de datos).
- [ ] **U2 (P1) · Clase `request.json()`** — Helper de parseo → 400; aplicar en ~11 rutas (clientes, ejercicios, rutinas, membresías, access-override).
- [ ] **U3 (P1) · CC-1** — Cierre de caja concurrente / re-cierre → doble conteo.
- [ ] **U4 (P1) · PG-6** — Borrado de socio orfana pagos y borra cuotas.
- [ ] **U5 (P1) · PG-2** — `POST /api/pagos` acepta `monto` arbitrario.
- [ ] **U6 (P1) · Atomicidad** — NF-2 (rutina), AC-2 (check-in), E (override), SE-2 (registrarSerie), PG-4 (idempotencia pago).
- [ ] **U7 (P1) · Rate limits** — G (login global), AC-4 (check-in por IP).
- [ ] **U8 (P1) · Auditoría** — `RegistroDeAuditoria` nunca se escribe (C).
- [ ] **U9 (P2/P3)** — resto de hallazgos del plan.

## Progreso
- (vacío — arranca con U1)
