# Delta for maquinas-crud

## MODIFIED Requirements

### Requirement: Delete and the `puedeEliminar` extension point

The system **MUST** expose `DELETE /api/maquinas/[id]`. The handler **MUST** query the real `ejerciciosAsociados` count via the repository (`contarEjerciciosAsociados`) and pass it to the pure function:

```
puedeEliminar(maquina, { ejerciciosAsociados }) → { permitido: boolean, motivo: string | null }
```

- When the count is `0`, `puedeEliminar` returns `{ permitido: true, motivo: null }` and the delete proceeds **physically** (the `EjercicioMaquina` rows, if any, cascade away).
- When the count is `> 0`, `puedeEliminar` returns `{ permitido: false, motivo: "N ejercicios usan esta máquina" }`, and the handler **MUST** return 409 with code `DELETE_BLOCKED_EJERCICIOS` (distinct from `DELETE_BLOCKED_ASSIGNED`, because the message template differs — "N ejercicios usan esta máquina" vs "N socios asignados" — and the code is part of the API contract; already mapped in `route-error-mapper.ts`).

The pure function `puedeEliminar` is **UNCHANGED** from Etapa 1 — only its caller now supplies the real count instead of the hardcoded `0`.

(Previously: in Etapa 1 the handler passed `ejerciciosAsociados = 0`, so `puedeEliminar` always returned `{ permitido: true }` and the delete proceeded. Etapa 2 wires the real `Ejercicio↔Maquina` count.)

#### Scenario: Permitted delete

- GIVEN a machine with a known id and `ejerciciosAsociados = 0`
- WHEN the Administrador calls DELETE /api/maquinas/[id] and confirms
- THEN the system physically removes the machine and returns success

#### Scenario: Delete blocked by associated exercises

- GIVEN a machine with a known id and `ejerciciosAsociados = 3`
- WHEN the Administrador calls DELETE /api/maquinas/[id]
- THEN the system returns 409 with code `DELETE_BLOCKED_EJERCICIOS` and message "No se puede eliminar: 3 ejercicios usan esta máquina", and the machine is not deleted

#### Scenario: Delete of missing machine returns 404

- GIVEN an id that matches no machine
- WHEN the Administrador calls DELETE /api/maquinas/[id]
- THEN the system returns 404 with code `NOT_FOUND`

#### Scenario: `puedeEliminar` blocked branch (pure function)

- GIVEN `puedeEliminar(maquina, { ejerciciosAsociados: 3 })`
- WHEN the pure function runs
- THEN it returns `{ permitido: false, motivo: "3 ejercicios usan esta máquina" }` — unit-tested at the domain layer, unchanged from Etapa 1

## Acceptance Criteria (Delta)

- **AC-010** (updated): `DELETE /api/maquinas/[id]` queries the real `ejerciciosAsociados` count via `contarEjerciciosAsociados`; with `0` it deletes physically; with a missing id it returns 404.
- **AC-011** (updated): `DELETE /api/maquinas/[id]` returns 409 `DELETE_BLOCKED_EJERCICIOS` ("No se puede eliminar: N ejercicios usan esta máquina") when `ejerciciosAsociados > 0`; the pure `puedeEliminar` function is unchanged and still unit-tested for the blocked branch.

## Acceptance Criteria → Test Traceability

| AC | Test file | Test name(s) |
|----|-----------|--------------|
| AC-010 | `src/api/maquinas.test.ts`, `src/app/api/maquinas/[id]/route.delete.test.ts` | "DELETE queries the real ejerciciosAsociados count", "DELETE with 0 associations deletes physically", "404 on missing machine" |
| AC-011 | `src/api/maquinas.test.ts`, `src/domains/maquina/maquina.test.ts` | "DELETE with ejerciciosAsociados > 0 returns 409 DELETE_BLOCKED_EJERCICIOS", "puedeEliminar returns blocked when ejerciciosAsociados > 0" |
