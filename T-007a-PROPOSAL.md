# T-007a Proposal: Rutina FormPanel + EjercicioEnRutina Basic

## Current State

### What Exists ✅
1. **Prisma Schema** (`prisma/schema.prisma`)
   - `Rutina` model: id, nombre, objetivoPrincipal, frecuenciaSemanal, duracionEstimada, nivelDeDificultad, descripcion
   - `EjercicioEnRutina` model: id, rutinaId, ejercicioId, series, repeticiones, descanso (seconds), orden
   - `Ejercicio` model: id, nombre, grupoMuscular, descripcion
   - Relationships: Rutina ← (1:N) → EjercicioEnRutina ← (N:1) → Ejercicio
   - **All required fields are present**

2. **Domain Logic** (`src/domains/rutina/`)
   - `rutina.ts`: Validation (nombre, frecuenciaSemanal 1-7, duracionEstimada > 0, nivelDeDificultad enum), RutinaRepository
   - `rutina.test.ts`: 230 LOC of unit tests covering all validation rules
   - **Validation is complete and correct**

3. **Ejercicio CRUD** (`src/components/ejercicio-crud/`)
   - `ejercicio-form.tsx` (275 LOC): FormPanel pattern with validation, field clearing on create
   - `ejercicio-form.test.tsx` (323+ LOC): Complete test suite covering form behavior
   - `ejercicio-list.tsx` (166 LOC): ListPanel with search, sort, modify/delete actions
   - `ejercicio-list.test.tsx`: Additional test coverage
   - **Reference implementation for FormPanel pattern**

### What's Missing ❌
1. **Components** (must create):
   - `src/components/rutina-crud/rutina-form.tsx` (FormPanel: Rutina fields + EjercicioEnRutina subsection)
   - `src/components/rutina-crud/ejercicio-en-rutina-list.tsx` (Nested table: add/remove exercises)
   - `src/components/rutina-crud/rutina-form.test.tsx` (~200 LOC)
   - `src/components/rutina-crud/ejercicio-en-rutina-list.test.tsx` (~120 LOC)

2. **Domain Extensions** (nice to have):
   - EjercicioEnRutina validation (series, repeticiones, descanso constraints)
   - Catalog/modal interaction helpers

---

## Scope for T-007a (Precise)

### In Scope ✅
**FormPanel Component** (`rutina-form.tsx`):
- Six input fields: nombre, objetivoPrincipal, frecuenciaSemanal, duracionEstimada, nivelDeDificultad, descripcion
- Validation on blur + submit using domain validation
- Error display and field-level feedback
- Full form reset on successful create (not edit mode)
- Nested subsection for EjercicioEnRutina (see below)

**EjercicioEnRutina Subsection** (`ejercicio-en-rutina-list.tsx`):
- Displays table of exercises added to this Rutina
- **Columns**: Nombre, Grupo Muscular, Series, Repeticiones, Descanso (min:sec format)
- **Row Actions**: 
  - Delete button per row (with confirmation)
  - Add row button (opens modal to select from Ejercicio catalog)
- **Modal/Catalog Interaction**:
  - Button: "Agregar Ejercicio"
  - Opens modal/dropdown with list of all Ejercicio records
  - On select: create EjercicioEnRutina entry with default values (series: 3, repeticiones: 10, descanso: 60s)
  - Inline editing of series/reps/descanso (not reorder)

**Descanso Display** ✅
- Stored in database as integer (seconds)
- Displayed as `mm:ss` format (e.g., 90 seconds → "1:30")
- Input as seconds or mm:ss (parse on save)

**Validation** ✅
- Use domain model `validateRutina()` for Rutina fields
- Manual validation for EjercicioEnRutina:
  - series > 0 and <= 100
  - repeticiones > 0 and <= 100
  - descanso >= 0 and <= 600 (max 10 min)

### Out of Scope ❌
- Reorder exercises (orden field exists but not used yet)
- Edit mode for Rutina (create only)
- Bulk actions
- Template cloning
- API endpoints (assume parent handles persistence)

---

## File Structure to Create

```
src/components/rutina-crud/
├── rutina-form.tsx                      (200-250 LOC)
├── rutina-form.test.tsx                 (~200 LOC)
├── ejercicio-en-rutina-list.tsx         (150-200 LOC)
└── ejercicio-en-rutina-list.test.tsx    (~120 LOC)
```

### Optional Structure (if splitting further)
```
src/components/rutina-crud/
├── form/
│   ├── rutina-form.tsx
│   ├── rutina-form.test.tsx
│   └── form-fields.ts          (constants: NIVEL_OPTIONS, etc.)
└── exercise-list/
    ├── ejercicio-en-rutina-list.tsx
    ├── ejercicio-en-rutina-list.test.tsx
    └── format-time.ts          (descanso formatting utility)
```

**Recommended**: Keep flat structure for now (T-007a scope); refactor after T-007b.

---

## Component Interfaces & Decisions

### RutinaFormProps
```typescript
interface RutinaFormProps {
  onSave: (data: RutinaFormData & { ejercicios: EjercicioEnRutinaInput[] }) => Promise<void> | void;
  isLoading?: boolean;
}

interface RutinaFormData {
  nombre: string;
  objetivoPrincipal: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: "Básico" | "Intermedio" | "Avanzado";
  descripcion: string;
}

interface EjercicioEnRutinaInput {
  ejercicioId: string;
  series: number;
  repeticiones: number;
  descanso: number; // seconds
}
```

### EjercicioEnRutinaListProps
```typescript
interface EjercicioEnRutinaListProps {
  ejercicios: (EjercicioEnRutina & { ejercicio: Ejercicio })[];
  ejercicioCatalog: Ejercicio[]; // for catalog modal
  onAdd: (ejercicioId: string) => void;
  onRemove: (ejercicioId: string) => void;
  onChange: (ejercicioId: string, field: "series" | "repeticiones" | "descanso", value: number) => void;
}
```

### Key Decisions

#### 1. **Validation Trigger**
- On blur for individual fields (user feedback)
- On submit for full form (catch combined errors)
- Clear errors on field change
- **Pattern**: Match ejercicio-form.tsx behavior

#### 2. **Inline Editing in EjercicioEnRutina Table**
- Series, Repeticiones, Descanso are editable directly in table cells
- Input type: `<input type="number">` with validation on blur
- Show error under cell if invalid
- Changes bubble up via `onChange` callback
- **No persist until parent form submits**

#### 3. **Catalog Modal Structure**
- Modal/Dialog component (reuse if exists, else simple overlay)
- Searchable list of Ejercicio records
- On select: `onAdd` callback with ejercicioId
- Default values (series: 3, reps: 10, rest: 60s) set by parent on add
- Modal closes after selection

#### 4. **Descanso Formatting**
- Helper function: `formatDescansoDisplay(seconds: number): string` → "mm:ss"
- Helper function: `parseDescansoInput(input: string | number): number` → seconds
  - Accepts: "1:30", 90, "90"
  - Returns: 90 (seconds)
- Input field: show seconds in placeholder, format on display

#### 5. **Error Boundary**
- Display validation errors above form (summary)
- Per-field errors below inputs
- EjercicioEnRutina errors in row or near delete button
- **Pattern**: Match ejercicio-form.tsx

---

## Test Scenarios (320 LOC combined)

### RutinaForm Tests (~200 LOC)

#### Rendering
- [ ] Renders empty form in create mode
- [ ] All six fields are present and editable
- [ ] nivelDeDificultad is dropdown with Básico|Intermedio|Avanzado
- [ ] Ejercicio subsection is rendered below main form

#### Validation
- [ ] nombre: required, 3-100 chars, error on blur
- [ ] frecuenciaSemanal: 1-7, error on invalid
- [ ] duracionEstimada: > 0, error on invalid
- [ ] nivelDeDificultad: required, error if empty
- [ ] descripcion: optional, max 500 chars
- [ ] All errors clear on field change

#### Submission
- [ ] onSave called with correct data shape
- [ ] Rutina fields + ejercicios array passed
- [ ] Form clears on successful save (create mode)
- [ ] Submit button disabled during save (isLoading)
- [ ] Validation prevents submit with errors

#### EjercicioEnRutina Integration
- [ ] "Agregar Ejercicio" button opens catalog
- [ ] Selecting ejercicio adds row to table
- [ ] Added row shows name, muscle group, defaults (3 series, 10 reps, 60s rest)
- [ ] Multiple exercises can be added (no uniqueness constraint in test)
- [ ] onSave includes all ejercicios with their series/reps/descanso

### EjercicioEnRutinaList Tests (~120 LOC)

#### Rendering
- [ ] Renders table with 0+ ejercicios
- [ ] Columns: Nombre, Grupo Muscular, Series, Repeticiones, Descanso (mm:ss)
- [ ] "Agregar Ejercicio" button present
- [ ] Delete button per row

#### Catalog Interaction
- [ ] "Agregar Ejercicio" opens modal with all catalog items
- [ ] Can search/filter catalog (if modal supports it)
- [ ] Selecting ejercicio calls onAdd with ID
- [ ] Modal closes after selection
- [ ] Can add multiple distinct exercises

#### Inline Editing
- [ ] Series field is editable (number input)
- [ ] Repeticiones field is editable (number input)
- [ ] Descanso field is editable (shows seconds, accepts mm:ss or number)
- [ ] onChange callback fires on blur
- [ ] Invalid values show error (e.g., series 0 or > 100)
- [ ] Error clears when corrected

#### Delete
- [ ] Delete button shows confirmation
- [ ] onRemove called with ejercicioId on confirm
- [ ] Row removed from table after delete
- [ ] onSave includes updated list

#### Descanso Formatting
- [ ] 0 seconds displays as "0:00"
- [ ] 60 seconds displays as "1:00"
- [ ] 90 seconds displays as "1:30"
- [ ] 600 seconds displays as "10:00"
- [ ] Input "1:30" parsed as 90 seconds
- [ ] Input 90 parsed as 90 seconds

---

## Implementation Checklist

### Phase 1: Components
- [ ] Create `src/components/rutina-crud/` directory
- [ ] Implement `rutina-form.tsx` (200-250 LOC)
  - [ ] Form state, validation errors
  - [ ] Six fields with blur validation
  - [ ] Submit handler with full validation
  - [ ] EjercicioEnRutina subsection render
- [ ] Implement `ejercicio-en-rutina-list.tsx` (150-200 LOC)
  - [ ] Table with exercise data
  - [ ] Inline editing for series/reps/descanso
  - [ ] Catalog modal/selector
  - [ ] Delete confirmation

### Phase 2: Tests
- [ ] `rutina-form.test.tsx` (~200 LOC)
  - [ ] Form rendering tests
  - [ ] Validation and error handling
  - [ ] Submission flow
  - [ ] Integration with EjercicioEnRutina
- [ ] `ejercicio-en-rutina-list.test.tsx` (~120 LOC)
  - [ ] Table rendering
  - [ ] Inline edit behavior
  - [ ] Catalog add/remove flow
  - [ ] Descanso formatting

### Phase 3: Utilities (Optional, can be inline)
- [ ] `descanso.utils.ts` (optional):
  - `formatDescansoDisplay(seconds: number): string`
  - `parseDescansoInput(input: string | number): number`
- [ ] `constants.ts` (optional):
  - `NIVEL_OPCIONES = ["Básico", "Intermedio", "Avanzado"]`
  - `GRUPO_MUSCULAR_OPCIONES = [...]` (from EjercicioForm)

---

## Dependencies & Assumptions

### Required
- React 18+, React Testing Library
- Prisma Client (for type imports)
- Domain validation already in `src/domains/rutina/rutina.ts`

### Assumptions
- Parent component handles API calls / persistence
- Ejercicio catalog is fetched by parent (passed as prop)
- Modal/overlay component available (custom or from UI library)
- Tailwind CSS for styling (consistent with ejercicio-crud)

### Type Imports
```typescript
import { Rutina, Ejercicio, EjercicioEnRutina } from "@prisma/client";
import { validateRutina, RutinaRepository } from "@/domains/rutina/rutina";
```

---

## Notes for Implementation

1. **Follow ejercicio-form.tsx pattern closely**:
   - Validation on blur + submit
   - Error state management
   - Field clearing on success
   - Disabled state during submission

2. **Descanso Format**:
   - Always store/pass as seconds (integer)
   - Display as mm:ss
   - Accept mm:ss or seconds in input
   - Use `Math.floor()` for parsing

3. **EjercicioEnRutina Defaults**:
   - When adding from catalog: series=3, repeticiones=10, descanso=60
   - These can be customized inline before submit

4. **Testing**:
   - Mock `onSave`, `onAdd`, `onRemove`, `onChange` callbacks
   - Mock Ejercicio data with id, nombre, grupoMuscular
   - Use userEvent for interactions (not fireEvent)
   - Test form submission with ejercicios array

5. **Accessibility**:
   - Label all inputs
   - Error messages linked to fields (aria-invalid, aria-describedby)
   - Confirm dialogs for destructive actions
   - Keyboard navigation for modal

---

## Deliverable Summary

| Item | Status | LOC | Notes |
|------|--------|-----|-------|
| rutina-form.tsx | TODO | 200-250 | FormPanel + EjercicioEnRutina subsection |
| rutina-form.test.tsx | TODO | ~200 | 10-12 test groups |
| ejercicio-en-rutina-list.tsx | TODO | 150-200 | Table + modal + inline editing |
| ejercicio-en-rutina-list.test.tsx | TODO | ~120 | 8-10 test groups |
| descanso.utils.ts | OPTIONAL | ~20 | Format/parse helpers |
| **Total** | | **~670-800** | All tests + components |

**Time Estimate**: 2-3 days (1 dev full-time), including thorough testing.

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/T-007a-rutina-formPanel

# After implementation:
git add src/components/rutina-crud/
git commit -m "feat(T-007a): Add RutinaForm + EjercicioEnRutina table

- Implement RutinaForm component with 6 fields + validation
- Add EjercicioEnRutina nested table with add/remove/inline-edit
- Format descanso as mm:ss display, seconds storage
- Add component tests (200+120 LOC)
- Follow ejercicio-crud pattern for consistency"
```

---

## Appendix: Example Data Structure

```typescript
// What RutinaForm submits to onSave():
{
  nombre: "Push/Pull/Legs",
  objetivoPrincipal: "Fuerza",
  frecuenciaSemanal: 3,
  duracionEstimada: 75,
  nivelDeDificultad: "Intermedio",
  descripcion: "Rutina de 3 días",
  ejercicios: [
    { ejercicioId: "ej-1", series: 4, repeticiones: 8, descanso: 120 },
    { ejercicioId: "ej-2", series: 3, repeticiones: 10, descanso: 90 },
    { ejercicioId: "ej-3", series: 3, repeticiones: 12, descanso: 60 },
  ]
}

// EjercicioEnRutina row in table (rendered as):
{
  id: "eur-1",
  rutinaId: "r-1",
  ejercicioId: "ej-1",
  ejercicio: { id: "ej-1", nombre: "Press Banca", grupoMuscular: "Pecho", ... },
  series: 4,
  repeticiones: 8,
  descanso: 120,      // ← stored as seconds
  orden: 1
}

// Displayed in table as:
| Press Banca | Pecho | 4 | 8 | 2:00 | [Delete]
```

