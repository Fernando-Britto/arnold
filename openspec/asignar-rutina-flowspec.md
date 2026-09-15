# Mini-Spec: Asignar Rutina (Row_Acciones Button Flow)

**Trigger**: User clicks "Asignar Rutina" button in Home_Interno → Row_Acciones

**UI Component**: Modal dialog (not a new screen)

---

## Flow Overview

1. User clicks "Asignar Rutina" → Modal opens
2. Step 1: Search & select Socio from existing members
3. Step 2: Select a Rutina from available templates
4. Step 3: Confirm assignment
5. Backend logic: Deactivate any existing active RutinaAsignada for that Socio, then create new one with `activa=true`
6. Modal closes, Home_Interno refreshes (optional toast: "Rutina asignada a [Socio]")

---

## Modal Layout

### Header
- Title: "Asignar Rutina a Socio"
- Close button (X)

### Body (Two-step form)

#### Step 1: Select Socio
- Label: "Seleccionar socio"
- Input: Searchable dropdown / autocomplete field
  - Filter: Socios with `estado = ACTIVO` (optional: exclude Socios already with active RutinaAsignada to simplify UX)
  - Display format: "Nombre (DNI)" or "Nombre (Email)"
  - Placeholder: "Buscar socio por nombre o DNI..."
- Validation: Required field
- After selection: Proceed to Step 2 (button or automatic)

#### Step 2: Select Rutina
- Appears after Socio is selected
- Label: "Seleccionar rutina"
- Input: Searchable dropdown / list of all Rutina records
  - Display format: "Nombre (Nivel: Básico/Intermedio/Avanzado, Duración: X min)"
  - Filter: All Rutinas with `estado = ACTIVA` (if Rutina had an estado field; assume all available for MVP)
  - Placeholder: "Buscar rutina por nombre..."
- Validation: Required field
- After selection: Proceed to Step 3

### Footer
- Button: "Cancelar" (close modal without action)
- Button: "Asignar" (primary, disabled until both Socio and Rutina selected)

---

## Backend Logic (Server Action)

**Endpoint**: POST `/api/rutinas-asignadas` (or similar)

**Input**:
```
{
  socioId: string,
  rutinaId: string
}
```

**Business Logic** (within transaction):
1. Verify Socio exists and is ACTIVO
2. Verify Rutina exists
3. Find any existing RutinaAsignada where `socioId = {socioId}` AND `activa = true`
4. If exists: set `activa = false` (deactivate)
5. Create new RutinaAsignada:
   - `socioId`
   - `rutinaId`
   - `activa = true`
   - `fechaAsignacion = now()`

**Error Handling**:
- Socio not found: "Socio no encontrado"
- Rutina not found: "Rutina no encontrada"
- Socio inactive: "El socio debe estar activo para asignar rutina"
- DB constraint violation on unique([socioId, activa]): "Ya hay una rutina activa asignada a este socio" (shouldn't happen if step 3 deactivates correctly)

**Response**:
```
{
  success: true,
  message: "Rutina asignada a [Socio nombre]",
  rutinaAsignada: { id, socioId, rutinaId, fechaAsignacion, activa }
}
```

---

## RN-04 Enforcement

**Constraint**: One active RutinaAsignada per Socio at any time

- Unique constraint at DB level: `@@unique([socioId, activa])` on RutinaAsignada
- Application logic: Deactivate previous before creating new
- Validation: Block assignment if it would violate the constraint

---

## UI States & Edge Cases

1. **No Socios exist**: Dropdown empty → "No hay socios disponibles"
2. **No Rutinas exist**: Dropdown empty → "No hay rutinas disponibles"
3. **Socio already has active Rutina**: Assignment replaces it (no warning needed; automatic deactivation handles it)
4. **Assignment in progress**: "Asignar" button shows loading spinner
5. **Assignment succeeds**: Toast notification, modal closes, Home_Interno table refreshes (if RutinaAsignada display is shown elsewhere)
6. **Assignment fails**: Error toast + error message in modal (stays open for retry)

---

## Acceptance Criteria

- ✅ Modal opens with "Asignar Rutina" title
- ✅ Step 1: Searchable dropdown filters Socios by name/DNI
- ✅ Step 2: Searchable dropdown filters Rutinas by name
- ✅ "Asignar" button is disabled until both Socio and Rutina selected
- ✅ Clicking "Asignar" triggers assignment Server Action
- ✅ Backend deactivates any existing active RutinaAsignada for that Socio
- ✅ Backend creates new RutinaAsignada with `activa=true`
- ✅ RN-04 constraint (one active per Socio) enforced at DB and app level
- ✅ On success: Toast notification shown, modal closes
- ✅ On error: Error message shown in modal, user can retry or cancel
- ✅ "Cancelar" button closes modal without action

---

## Data Model Requirements

- **Socio** (+ Usuario join):
  - Socio.id, Socio.dni
  - Usuario.nombre, Usuario.email, Usuario.estado (join via Socio.usuarioId)
  - Filter: Usuario.estado = ACTIVO (only show active Socios)
  - Display format: "Usuario.nombre (Socio.dni)"
  
- **Rutina**: id, nombre, nivelDeDificultad, duracionEstimada

- **RutinaAsignada**: id, socioId, rutinaId, fechaAsignacion, activa
  - Note: No unique constraint; RN-04 (one active per Socio) enforced at application level via transaction (deactivate previous before creating new)

---

## Next Steps (After Spec Approval)

1. T-014 (Rutina CRUD): Ensure Rutina model and CRUD screens are complete
2. T-XXX (Asignar Rutina Modal): Implement modal component, Server Action, integration with Home_Interno Row_Acciones button
3. T-XXX (Home_Interno Integration): Wire "Asignar Rutina" button to open modal; ensure Home_Interno refreshes after assignment
