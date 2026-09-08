# ARNOLD — Technical Design Document (TDD)

**Version**: 1.0  
**Date**: 2026-09-07  
**Status**: APPROVED FOR IMPLEMENTATION  
**Scope**: MVP Core — Admin dashboards (Home_Interno) + 4 CRUD screens + Socio home (Home_Socio)

---

## 1. Overview & Architectural Decisions

### 1.1 Design Intent

This design realizes the **MVP Core phase** of ARNOLD, focusing on:
- **Administrator workflows**: Dashboard (Home_Interno) with real-time operational visibility
- **Data management**: Four CRUD interfaces (Ejercicios, Rutinas, Clientes, Membresías)
- **Client experience**: Socio home screen (Home_Socio) with current exercise tracking and progress visibility

### 1.2 Key Design Principles

1. **Role-based separation**: Admin/staff see operational dashboards; socios see personal progress and current sessions
2. **Form-as-sidebar pattern**: CRUD operations keep form on left, list/table on right (standard gym admin workflows)
3. **Real-time status**: Machine availability, occupancy, and quick-action buttons reduce manual overhead
4. **Exercise-centric design**: Tarjeta_Detalle (exercise detail card) is the focal point of Socio experience during workouts
5. **Clean data hierarchy**: Distinct sections in dashboards (alerts, operations, management, activity)

### 1.3 Technology Stack (from requirements.md)

- **Frontend**: Next.js 15 (App Router, React 19, TypeScript)
- **Backend**: NestJS + PostgreSQL (or Next.js Server Actions)
- **Architecture**: Clean Architecture (models/, adapters/, services/, components/, utilities/)
- **Methodology**: Spec-Driven Development (SDD) + TDD

### 1.4 Data Model Authority

All entity definitions, attributes, relationships, and business rules come from **requirements.md**:
- **Ejercicio**: nombre, grupoMuscular, descripcion
- **Rutina**: nombre, objetivoPrincipal, frecuenciaSemanal, duracionEstimada, nivelDeDificultad, descripcion
- **EjercicioEnRutina**: series, repeticiones, descanso (in seconds)
- **Socio**: nombre, dni, telefono, fechaAlta, estadoCuota
- **Membresía**: nombre, precio, periodicidad, estado
- **Máquina**: nombre, tipoEquipamiento, estado, ubicacion, fechaAlta
- **Asistencia**: fechaHora, socio, estadoAlIngresar

---

## 2. Design System & Visual Foundation

### 2.1 Color Palette (Verified from Ejercicios.fig)

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **brand-fill** | #FD7009 | (253, 112, 9) | Primary actions, highlights, machine status |
| **text-primary** | #18181B | (24, 24, 27) | Headlines, form labels, strong emphasis |
| **text-secondary** | #6B7280 | (107, 114, 128) | Body text, secondary labels, muscle group |
| **text-tertiary** | #4B5563 | (75, 85, 99) | Descriptions, fine print |
| **text-disabled** | #A1A5B0 | (161, 165, 176) | Disabled fields, muted text |
| **surface-bg** | #FFFFFF | (255, 255, 255) | Card backgrounds, panels |
| **surface-secondary** | #F3F4F6 | (243, 244, 246) | Alternate backgrounds |
| **border-light** | #E5E7EB | (229, 231, 235) | Dividers, borders |
| **border-dark** | #D1D5DB | (209, 213, 219) | Emphasized borders |
| **status-success** | #10B981 | (16, 185, 129) | Active, available |
| **status-warning** | #F59E0B | (245, 158, 11) | Maintenance, caution |
| **status-error** | #EF4444 | (239, 68, 68) | Inactive, blocked |

### 2.2 Typography

All fonts: **Inter** (sans-serif)

| Type | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| **H1** | 24px | 700 | 29px | Page titles, dashboard section headers |
| **H2** | 20px | 700 | 24px | Card titles, section subheadings |
| **H3** | 17px | 700 | 21px | Exercise name (Tarjeta_Detalle) |
| **Body Strong** | 14px | 700 | 17px | Button labels, form field labels, action button text |
| **Body** | 14px | 500 | 17px | Secondary labels, navigation text |
| **Body Secondary** | 14px | 400 | 17px | Card descriptions, secondary content |
| **Small** | 13px | 400 | 16px | Exercise description, status text |
| **Label** | 12px | 400 | 15px | Table headers, field hints, operation card status |
| **Uppercase Label** | 11px | 700 | 14px | "EJERCICIO ACTUAL", section markers (text-case: UPPER) |

### 2.3 Spacing System

**Base unit**: 8px

| Scale | Value | Usage |
|-------|-------|-------|
| **xs** | 4px | Internal spacing in compact elements |
| **sm** | 8px | Item spacing, small gaps |
| **md** | 12px | Field gaps, component spacing |
| **lg** | 16px | Section padding, row gaps |
| **xl** | 20px | Card padding, form panel padding |
| **2xl** | 24px | Large component gaps |
| **3xl** | 32px | Major section spacing |
| **page** | 48px | Page margins (left/right) |

### 2.4 Corner Radius

- **Buttons, inputs, cards**: 4px (subtle, business-focused)
- **Icon circles** (e.g., dumbbell in Tarjeta_Detalle): 50% (full circle)
- **Dividers, separators**: 0px (straight edges)

---

## 3. Screen Architecture

### 3.1 Layout Pattern: Standard Admin Chrome

All screens share a consistent three-zone structure:

```
┌─ TopNav (80px) ─────────────────────────────────────┐
│ Logo | Navigation Links | User Menu                  │
├─ ActionBar (72px) ──────────────────────────────────┤
│ Breadcrumb | Action Buttons (Search, Modify, etc.)   │
├─ MainContent (remaining height) ───────────────────┤
│ FormPanel (left, 380px) | ListPanel (right, 1420px)  │
│ [Create/Edit Form]      | [Data Grid / Overview]     │
└─────────────────────────────────────────────────────┘
```

**TopNav** (80px):
- Logo (ARNOLD text) on left
- Navigation links in center (role-dependent)
- User avatar/menu on right
- Background: white, border-bottom: 1px border-light

**ActionBar** (72px):
- Breadcrumb (e.g., "Admin > Ejercicios") on left
- Action buttons (Search, Modify, Delete, Assign) on right
- Background: white, minimal padding

**MainContent**:
- **FormPanel** (380px wide, left side):
  - Form title (H2)
  - Accent line (brand-fill, 3px, full height)
  - Form fields stacked vertically
  - Submit/Cancel buttons at bottom
  - Background: white
  
- **ListPanel** (1420px wide, right side):
  - Table/grid header with column names
  - Rows of data, clickable/selectable
  - Pagination or infinite scroll
  - Background: white

---

## 4. CRUD Screens (Form-List Pattern)

### 4.1 Ejercicios CRUD

**Entity**: Ejercicio  
**Model fields** (from requirements.md):
- `nombre` (string, required)
- `grupoMuscular` (string, required)
- `descripcion` (string, optional)

**FormPanel** (left, 380px):

| Field | Type | Label | Required | Validation | Notes |
|-------|------|-------|----------|------------|-------|
| Nombre | text input | "Nombre*" | ✓ | Min 3, Max 100 chars | 14px Body Strong |
| Grupo muscular | dropdown select | "Grupo muscular*" | ✓ | Predefined list | 14px Body Strong; Options from system config |
| Descripción | textarea | "Descripción" | — | Max 500 chars | 14px Body Secondary; Multi-line, 4 rows |
| ID | text (read-only) | "ID (Autogenerado)" | — | — | 12px Label; Disabled, populated after create |

**ListPanel** (right, 1420px):

| Column | Width | Type | Sortable | Filterable |
|--------|-------|------|----------|-----------|
| Nombre | 300px | text | ✓ | ✓ |
| Grupo muscular | 250px | text | ✓ | ✓ |
| Descripción | 400px | text (truncated) | — | ✓ |
| Actions | 150px | buttons | — | — |

**Actions**:
- **Search button** (ActionBar): Filter by name/muscle group
- **Modify button**: Edit selected exercise
- **Delete button**: Remove selected exercise (confirm modal)

---

### 4.2 Rutinas CRUD

**Entity**: Rutina + EjercicioEnRutina  
**Model fields** (from requirements.md):
- `nombre` (string, required)
- `objetivoPrincipal` (enum: string, required)
- `frecuenciaSemanal` (integer 1–7, required, days)
- `duracionEstimada` (integer, minutes, required)
- `nivelDeDificultad` (enum: "Básico" | "Intermedio" | "Avanzado", required)
- `descripcion` (string, optional)
- **EjercicioEnRutina** (1:N relationship):
  - `series` (integer, required)
  - `repeticiones` (integer, required)
  - `descanso` (integer, seconds, required)

**FormPanel** (left, 380px):

| Field | Type | Label | Required | Validation | Notes |
|-------|------|-------|----------|------------|-------|
| Nombre de la rutina | text input | "Nombre de la rutina*" | ✓ | Min 3, Max 100 chars | 14px Body Strong |
| ID | text (read-only) | "ID (autogenerado)" | — | — | 12px Label; Disabled |
| Objetivo principal | dropdown select | "Objetivo principal*" | ✓ | Predefined enum | 14px Body Strong; Dynamic based on Socio profile |
| Frecuencia semanal | number input | "Frecuencia semanal (días)*" | ✓ | 1–7 | 14px Body Strong; Spinner control |
| Duración estimada | number input | "Duración estimada (min)*" | ✓ | >0 | 14px Body Strong; Spinner control |
| Nivel de dificultad | radio group | "Nivel de dificultad*" | ✓ | 3 options | 14px Body Strong; Options: Básico, Intermedio, Avanzado |
| Descripción | textarea | "Descripción" | — | Max 500 chars | 14px Body Secondary; 4 rows |

**Ejercicios de la rutina** (subsection, 100% width of form):
- Label: "Ejercicios de la rutina" (14px Body Strong, brand-fill)
- Search field: "Buscar ejercicio..." (placeholder)
- Button: "Catálogo" (brand-fill, opens modal or side panel)
- Subtable:
  | Column | Type | Editable |
  |--------|------|----------|
  | EJERCICIO | text | — |
  | SER. | number | ✓ (spinner) |
  | REPS. | number | ✓ (spinner) |
  | DESCANSO | number | ✓ (spinner, in seconds, display as min:sec) |
  | Acciones | buttons | Delete row |

**ListPanel** (right, 1420px):

| Column | Width | Type | Sortable |
|--------|-------|------|----------|
| Nombre | 250px | text | ✓ |
| Objetivo | 150px | text | ✓ |
| Frecuencia | 120px | number | ✓ |
| Duración | 120px | number | ✓ |
| Nivel | 120px | text | ✓ |
| Ejercicios | 120px | number | ✓ |
| Actions | 150px | buttons | — |

---

### 4.3 Clientes CRUD

**Entity**: Socio (extends Usuario)  
**Model fields** (from requirements.md):
- `nombre` (string, required)
- `dni` (string, required, unique)
- `telefono` (string, optional)
- `email` (string, required)
- `membresiaAsignada` (reference to Membresía, required)
- `estadoCuenta` (enum: "Activo" | "Inactivo" | "Bloqueado", required)
- `id` (read-only, auto-generated)
- `fechaAlta` (date, read-only)

**FormPanel** (left, 380px):

| Field | Type | Label | Required | Validation | Notes |
|-------|------|-------|----------|------------|-------|
| Nombre completo | text input | "Nombre completo*" | ✓ | Min 5, Max 100 chars | 14px Body Strong |
| DNI | text input | "DNI*" | ✓ | Format: XX.XXX.XXX or XXXXXXXX | 14px Body Strong; Unique constraint (checked on blur) |
| Teléfono | text input | "Teléfono" | — | Format: +54 9 XXXX XXXXXX | 14px Body Secondary |
| Email | email input | "Email*" | ✓ | Valid email format | 14px Body Strong |
| Membresía asignada | dropdown select | "Membresía asignada*" | ✓ | Active memberships only | 14px Body Strong; Shows name + price |
| Estado de la cuenta | dropdown select | "Estado de la cuenta*" | ✓ | Activo, Inactivo, Bloqueado | 14px Body Strong |
| ID | text (read-only) | "ID" | — | — | 12px Label; Gray disabled state |
| Fecha de alta | date (read-only) | "Fecha de alta" | — | — | 12px Label; Gray disabled state; Format: DD/MM/YYYY |

**ListPanel** (right, 1420px):

| Column | Width | Type | Sortable |
|--------|-------|------|----------|
| Nombre | 250px | text | ✓ |
| DNI | 150px | text | ✓ |
| Email | 250px | text | ✓ |
| Membresía | 150px | text | ✓ |
| Estado | 120px | badge (status-color-coded) | ✓ |
| Actions | 150px | buttons | — |

**Status badge styling**:
- Activo: background status-success, text white
- Inactivo: background status-warning, text white
- Bloqueado: background status-error, text white

---

### 4.4 Membresías CRUD

**Entity**: Membresía  
**Model fields** (from requirements.md):
- `nombre` (string, required)
- `precio` (decimal, required)
- `periodicidad` (integer, days, required)
- `estado` (enum: "Activa" | "Inactiva", required)
- `id` (read-only, auto-generated)

**FormPanel** (left, 380px):

| Field | Type | Label | Required | Validation | Notes |
|-------|------|-------|----------|------------|-------|
| Nombre | text input | "Nombre" | ✓ | Min 3, Max 50 chars | 14px Body Strong |
| Precio / Período | side-by-side | "Precio / Período" | ✓ | Decimal / Integer | 14px Body Strong; 2 columns: 45% + 45% (10% gap) |
| — | decimal input | "Precio ($)" | ✓ | >0, 2 decimals | Placeholder: "0,00" |
| — | number input | "Período (días)" | ✓ | >0 | Placeholder: "30" |
| Descripción | textarea | "Descripción" | — | Max 300 chars | 14px Body Secondary; 3 rows |
| Estado | dropdown select | "Estado" | ✓ | Activa, Inactiva | 14px Body Strong |
| ID | text (read-only) | "ID" | — | — | 12px Label; Disabled |

**ListPanel** (right, 1420px):

| Column | Width | Type | Sortable |
|-------|-------|------|----------|
| Nombre | 200px | text | ✓ |
| Precio | 120px | currency | ✓ |
| Período | 120px | number | ✓ |
| Estado | 120px | badge | ✓ |
| Miembros | 120px | number | — |
| Actions | 150px | buttons | — |

---

## 5. Home_Interno (Admin Dashboard)

**Purpose**: Real-time operational overview for administrators and staff  
**Layout**: Vertical stack of sections, full-width (1920px)

### 5.1 Layout Structure

```
┌─ TopNav (80px) ────────────────────────────┐
│ Logo | Nav Tabs (Inicio, Rutinas, etc.) | UserNav │
├─ ActionBar (49px) ─────────────────────────┤
│ Title: "Bienvenido, [Nombre]"             │
├─ MainContent (scroll) ─────────────────────┤
│
│  🔹 Row_Acciones (Quick Actions) — 56px
│  ┌─────────────────────────────────────┐
│  │ [Nuevo Socio] [Registrar Pago]      │
│  │ [Asignar Rutina] [Control Acceso]   │
│  └─────────────────────────────────────┘
│
│  🔹 Row_Hoy (Today's Snapshot) — 175px
│  ┌──────────────────────┬──────────────┬──────────┐
│  │ Alertas (860px)      │ Aforo (438px)│ Caja(438)│
│  │ - Vencimientos       │ Graph        │ Totals   │
│  │ - Asignaciones       │ % capacity   │ Cash/TRF │
│  └──────────────────────┴──────────────┴──────────┘
│
│  🔹 Row_Operacion (Machine & Staff) — 117px
│  ┌─────────────────────────────────────┐
│  │ [Equipo]    [Staff]    [Socios]    │
│  │ 2 en mant.  2 ent., 4s  Sin vis>15d│
│  └─────────────────────────────────────┘
│
│  🔹 Row_Gestion (Management Counters) — 90px
│  ┌──────┬──────────┬──────────┬────────┐
│  │Rutin │Ejercicio │Clientes  │Memb.  │
│  │ 124  │   342    │   892    │  15   │
│  └──────┴──────────┴──────────┴────────┘
│
│  🔹 Col_Actividad (Recent Activity) — 172px
│  │ Recent member actions, last 4 items │
│
└─────────────────────────────────────────────┘
```

### 5.2 Row_Acciones (Quick Actions)

**Structure**: Horizontal flex, 4 equal-width button cards, spaced evenly  
**Card dimensions**: ~210px each (with gaps)

| # | Icon | Label | Purpose | Color |
|---|------|-------|---------|-------|
| 1 | user-plus | Nuevo Socio | Create member | brand-fill |
| 2 | credit-card | Registrar Pago | Record payment | brand-fill |
| 3 | clipboard-list | Asignar Rutina | Assign workout | brand-fill |
| 4 | door-open | Control Acceso | Manual access | brand-fill |

**Button styling**:
- Background: white, border: 1px border-light
- Icon: 26×26px, brand-fill, centered
- Label: 14px Body Strong, brand-fill, below icon
- On hover: background surface-secondary, shadow light
- On click: navigate to action flow (modal or page)

### 5.3 Row_Hoy (Today's Overview)

**Title**: "Hoy" (14px, text-secondary, uppercase)  
**Layout**: 3 columns (860px + 438px + 438px)

#### Col_Alertas (860px)

**Title**: "Alertas" (14px Body Strong, text-secondary)  
**Content**: List of alerts/warnings (scrollable, 4–6 items visible)
- Item format: Icon + Text + Timestamp
- Types:
  - **Vencimiento**: Member membership expiring (24h warning)
  - **Asignación**: New routine assigned to member
  - **Falta de pago**: Payment due
  - **Inactividad**: Member inactive >7 days

#### Col_Aforo (438px)

**Title**: "Aforo" (14px Body Strong, text-secondary)  
**Subtitle**: "% capacity at this moment" (12px Label, text-disabled)  
**Content**:
- Graphical gauge/donut chart showing current occupancy %
- Center number: "XX%" (24px bold, brand-fill or status-warning based on threshold)
- Legend: "X / MAX_CAPACITY miembros"

#### Col_Caja (438px)

**Title**: "Caja" (14px Body Strong, text-secondary)  
**Totals** (24px bold, text-primary):
- **Efectivo**: $X,XXX.XX
- **Transferencia**: $X,XXX.XX
- **Total**: $X,XXX.XX (brand-fill)
- **Button**: "Cierre de Caja" (12px, opens close-out modal)

### 5.4 Row_Operacion (Status Cards)

**Title**: "Operación" (14px, text-secondary, uppercase)  
**Layout**: 3 equal cards (592px each)

| Card | Icon | Header | Status Text | Color |
|------|------|--------|-------------|-------|
| **Equipo** | wrench | "Equipo" (title inside card) | "2 en mantenimiento" | status-warning |
| **Staff** | people | "Staff" | "2 entrenadores, 4 staff" | status-success |
| **Socios** | user | "Socios" | "Sin visita > 15 días" | text-secondary |

**Card structure**:
- Header: Icon + title (14px Body Strong)
- Status: Icon + text (12px Label, gray)
- Background: white, border: 1px border-light
- On click: Navigate to detail view (e.g., machine list, staff roster, inactive members)

### 5.5 Row_Gestion (Management Counters)

**Title**: "Gestión" (14px, text-secondary, uppercase)  
**Layout**: 4 equal cards (438px each)

| Card | Metric | Count (24px bold) | Color |
|------|--------|------------------|-------|
| **Rutinas** | "Rutinas" (14px Body Strong) | **124** | text-primary |
| **Ejercicios** | "Ejercicios" (14px Body Strong) | **342** | text-primary |
| **Clientes** | "Clientes" (14px Body Strong) | **892** | text-primary |
| **Membresías** | "Membresías" (14px Body Strong) | **15** | text-primary |

**Card styling**:
- Background: white, border: 1px border-light
- On click: Navigate to CRUD list (Ejercicios, Rutinas, Clientes, Membresías)
- Hover: Cursor pointer, shadow light

### 5.6 Row_Operacion Card Details (Expanded View)

Each "Operacion" card can expand to show more detail:

**Equipo** card:
- Subheader: "Máquinas" (small icon + text)
- List: Machine names + status badges (Disponible/Ocupada/Fuera de Servicio)
- Action: "Reportar mantenimiento" button

**Staff** card:
- Subheader: "Turnos activos" (small icon + text)
- List: Staff names + current shift/role
- Action: "Gestionar turnos" button

**Socios** card:
- Subheader: "Inactividad" (small icon + text)
- List: Member names + days inactive
- Action: "Contactar" button (email/SMS template)

### 5.7 Col_Actividad (Recent Activity)

**Title**: "Actividad Reciente" (14px Body Strong, text-secondary)  
**Content**: Timeline of recent actions (4–6 items visible)
- Format: Timestamp + Actor + Action + Resource
- Example: "10:30 — Juan registró pago de $150 (Membresía Gold)"
- Scrollable, shows last 24h activity

---

## 6. Home_Socio (Member Portal)

**Purpose**: Personal workout tracking, routine progress, membership status  
**Audience**: Individual member (Socio)  
**Layout**: Vertical stack of sections

### 6.1 Layout Structure

```
┌─ TopNav (80px) ────────────────────────────────────┐
│ Logo | Nav Tabs ([Inicio], Mi rutina, Mi memb., Progreso) │
│                 UserNav (search, notifications, avatar)    │
├─ MainContent (scroll) ──────────────────────────────┤
│
│  🔹 Fila1 (Progress + Occupancy) — 300px
│  ┌─────────────────────────────────────────┐
│  │ [Progreso_Section (1157px)] [Aforo (633px)] │
│  │ - Series/Reps/Weight progress           │ Occupancy gauge   │
│  │ - Last 3–5 workouts                     │ Time to next peak │
│  └─────────────────────────────────────────┘
│
│  🔹 Fila2 (Current Workout + Exercise Detail) — 400px
│  ┌──────────────────────────┬────────────────────┐
│  │ Tarjeta_Rutina (1201px)  │ Tarjeta_Detalle    │
│  │ - Routine name           │ (589px)            │
│  │ - Exercise sequence      │ - Current exercise │
│  │ - Progress bar           │ - Stats, description│
│  │ - Next/Start button      │ - Machine status   │
│  └──────────────────────────┴────────────────────┘
│
│  🔹 Fila3 (Weekly Stats + Membership) — 158px
│  ┌──────────────────────────┬────────────────────┐
│  │ Racha Semanal (895px)    │ Membresía (895px)  │
│  │ - Weekly visit streak    │ - Current plan     │
│  │ - Days trained this week │ - Days remaining   │
│  │ - Goal vs actual         │ - Renewal date     │
│  └──────────────────────────┴────────────────────┘
│
└──────────────────────────────────────────────────────┘
```

### 6.2 Fila1: Progress Summary + Occupancy

#### ProgresoSection (1157px)

**Title**: "Progreso" (14px Body Strong, text-secondary)

**Content**:
- **Last workout summary**: Date, routine name, completion %
- **Strength progression chart**: Weight over last 4 weeks (line graph)
- **Recent lifts**: Last 3–5 exercises with best weight/reps

**ProgresoFooter** (action buttons):
- "Ver histórico" button (secondary)
- "Registrar sesión" button (brand-fill, primary)

#### AforoCard (633px)

**Title**: "Aforo" (14px Body Strong, text-secondary)  
**Subtitle**: "% capacity right now" (12px Label)

**Content**:
- Gauge chart (same as admin dashboard)
- Text: "XX% / MAX_CAPACITY miembros"
- **Recommendation**: "Mejor momento para entrenar: entre 14:00–16:00" (12px, text-secondary)

---

### 6.3 Fila2: Tarjeta_Rutina + Tarjeta_Detalle

#### Tarjeta_Rutina (1201px, left card)

**Title**: "Mi rutina" (14px Body Strong, brand-fill)

**Content**:
- **Routine name** (17px bold, text-primary)
- **Exercise sequence** (horizontal scroll / list):
  - Thumbnail cards for each exercise (100×100px each)
  - Format: Icon + Name + Muscle group
  - Active exercise highlighted (brand-fill border)
- **Progress bar**: "Ejercicio 3 de 6" (14px, 50% filled)
- **Action buttons**:
  - "Iniciar sesión" (brand-fill, primary, if not started)
  - "Siguiente ejercicio" (secondary, if in progress)
  - "Finalizar sesión" (secondary, if in progress)

#### Tarjeta_Detalle (589px, right card) — **KEY COMPONENT**

**Purpose**: Display current exercise details during workout session  
**Data source**: EjercicioEnRutina + Ejercicio entity

**Content structure** (verified literal from design):

| Element | Content | Styling |
|---------|---------|---------|
| **Label** | "EJERCICIO ACTUAL" | 11px uppercase bold, brand-fill (#FD7009) |
| **Spacer** | 20px gap | — |
| **Icon Circle** | 80×80px brand-fill circle with dumbbell icon (white stroke, 3.33px) | Centered, margin-top: 16px |
| **Name** | "Press Militar" | 17px bold, text-primary (#18181B) |
| **Muscle Group** | "Hombros" | 14px regular, text-secondary (#6B7280) |
| **Spacer** | 24px gap | — |
| **Stats Grid** | 4 columns (separated by 1px border-light dividers) | — |
| — | Column 1: "Series×Reps" (label 11px, value "3×10" 14px bold) | Centered text-primary |
| — | Column 2: "Descanso" (label 11px, value "2 min" 14px bold) | Centered text-primary |
| — | Column 3: "Objetivo" (label 11px, value "82,5 kg" 14px bold brand-fill) | Centered, orange highlight |
| — | (4th column can be added: e.g., "RPE" or "Peso actual") | Future-ready |
| **Description** | "Ejercicio de empuje vertical para deltoides anterior. Mantené el core firme y evitá arquear la zona lumbar al extender los brazos." | 13px regular, text-tertiary (#4B5563) |
| **Footer** | Wrench icon (14px, brand-fill orange) + "Libre en ~5 min" | 13px bold, brand-fill; indicates machine availability |

**Styling details**:
- Background: white, border: 1px border-light
- Corner radius: 4px
- Padding: 20px on all sides
- Max-width: 589px (fixed or responsive to container)
- Typography hierarchy: UPPERCASE label → Big icon → Bold name → Secondary muscle group → Stats in grid → Description → Status footer

**Interactions**:
- **Tap/Click on name**: Open exercise detail modal (full description, form variations, machine alternatives)
- **Tap/Click "Libre en ~5 min"**: Show machine reservation/waitlist modal
- **Swipe left** (mobile): Advance to next exercise (Tarjeta_Rutina moves to next exercise)

---

### 6.4 Fila3: Weekly Streak + Membership Status

#### RachaSemanal (895px)

**Title**: "Racha Semanal" (14px Body Strong, text-secondary)

**Content**:
- **Streak counter** (20px bold, brand-fill): "4 días esta semana"
- **Visual indicator**: 7 circles (Mon–Sun), filled/empty based on attendance
- **Goal vs actual**: "Objetivo: 5 días" (14px, text-secondary)
- **Last visit**: "Última visita: hace 2 horas" (12px Label)

#### MembresiCard (895px)

**Title**: "Mi membresía" (14px Body Strong, text-secondary)

**Content**:
- **Plan name**: "Membresía Gold" (17px bold, text-primary)
- **Expiration**: "Vence en 15 días" (14px, status-warning if <7 days)
- **Renewal date**: "Próximo pago: 15/10/2026" (12px Label)
- **Status badge**: "Al día" or "Vencida" (12px, color-coded)
- **Action button**: "Renovar ahora" (brand-fill, if expiring soon)

---

## 7. Technical Implementation Notes

### 7.1 Data Binding

**Ejercicios CRUD**:
- FormPanel ↔ Ejercicio model (create/update)
- ListPanel ↔ Ejercicio[] (fetch from DB, paginated)
- Search filters → WHERE clause on nombre, grupoMuscular

**Rutinas CRUD**:
- FormPanel ↔ Rutina model
- EjercicioEnRutina subsection ↔ JOIN table (1:N relationship)
- "Catálogo" button → Modal with Ejercicio list, multi-select add to routine

**Clientes CRUD**:
- FormPanel ↔ Socio model
- DNI validation → Unique constraint check
- Membresía dropdown → Active memberships only (WHERE estado = 'Activa')
- Estado de cuenta → Enum select

**Membresías CRUD**:
- FormPanel ↔ Membresía model
- Precio + Periodicidad → Calculate monthly/annual cost display
- ListPanel → Shows count of active members per membership

**Home_Interno**:
- Row_Acciones → Navigation to create flows (new member, new payment, etc.)
- Row_Hoy → Real-time data: Alerts (JOIN Cuota WHERE fechaVencimiento < TODAY+1), Aforo (COUNT Asistencia today), Caja (SUM Pago WHERE fechaPago = TODAY)
- Row_Operacion → Machine status (SELECT * FROM Máquina WHERE estado IN ['Ocupada', 'Fuera de Servicio']), Staff active (JOIN Empleado WHERE turno = current_shift)
- Row_Gestion → Simple counts: COUNT(*) per entity type

**Home_Socio**:
- ProgresoSection → Fetch Socio's active Rutina + RegistroDeProgreso history
- Tarjeta_Rutina → Active routine's EjercicioEnRutina with current exercise highlighted
- Tarjeta_Detalle → Current exercise metadata + machine availability status
- AforoCard → Real-time occupancy (same as admin dashboard)

### 7.2 State Management

**Recommended** (from SDD requirements):
- Global state: Redux or Zustand for user context, dashboard data, real-time notifications
- Local state: React hooks for form inputs, modal toggles
- Server state: Next.js Server Actions or API routes for data mutations

### 7.3 Responsive Design

**Breakpoints**:
- **Desktop** (1920px): Full layout as designed
- **Tablet** (1024px): FormPanel width → 320px, ListPanel → flex 1, stacked rows
- **Mobile** (768px): Single-column layout, Tarjeta_Rutina + Tarjeta_Detalle → stacked cards

**Tarjeta_Detalle** remains focal point on all sizes.

### 7.4 Accessibility

- All form labels tied to inputs via `<label htmlFor="fieldId">`
- Icon-only buttons must have `aria-label`
- Status badges use color + text (not color alone)
- Keyboard navigation: Tab through forms, Enter to submit, Escape to cancel
- Screen reader: Table headers announced, form validation errors in live region

### 7.5 Performance

- ListPanels: Paginate or virtual scroll (100 rows per page, lazy load on scroll)
- Tarjeta_Detalle: Preload current + next exercise data
- Home_Interno: Debounce filter searches (300ms)
- Images: Lazy load, serve optimized formats (WEBP where supported)

---

## 8. Out of Scope for This Phase

The following screens are **mentioned in requirements.md** but **NOT designed** in this Ejercicios.fig:

1. **"Mi rutina" detail screen** (Socio navigation tab exists, but full page design pending)
2. **"Mi membresía" detail screen** (Socio navigation tab exists, but full page design pending)
3. **"Progreso" analytics screen** (Socio navigation tab exists, but full page design pending)
4. **Admin screens**: Finanzas, Auditoría, Configuración (discussed conceptually in SRS, never designed in Pencil)

These are scheduled for **Phase 2** of development.

---

## 9. Handoff to Implementation (SDD-Tasks)

**Key artifacts to create in sdd-tasks phase**:

1. **Component library** (atomic design):
   - `Button`, `Input`, `Dropdown`, `Textarea`, `RadioGroup`, `Card`, `Badge`, `Modal`, `Table`, `IconCircle`

2. **Page templates**:
   - `CrudPageLayout` (FormPanel + ListPanel + ActionBar pattern)
   - `DashboardLayout` (Home_Interno sections)
   - `SocioHomeLayout` (Home_Socio sections)

3. **Data adapters**:
   - `EjercicioAdapter` (model ↔ form/API)
   - `RutinaAdapter` (with EjercicioEnRutina management)
   - `ClienteAdapter` (with membership validation)
   - `MembresiaAdapter`

4. **Server Actions / API routes**:
   - CRUD endpoints for each entity
   - Real-time status queries (Aforo, Operación, Alertas)
   - Payment recording flow

5. **Tests**:
   - Form validation (each CRUD)
   - Tarjeta_Detalle rendering with sample data
   - Home_Interno dashboard data aggregation
   - Accessibility (a11y) scans

---

## 10. Design Review Checklist

Before implementation begins:

- [ ] All form field labels match literal text from Ejercicios.fig
- [ ] Button labels ("Nuevo Socio", "Registrar Pago", etc.) are exactly as designed
- [ ] Color palette verified: brand-fill #FD7009, text-primary #18181B
- [ ] Spacing grid (8px base) applied to all components
- [ ] Typography hierarchy matches specification
- [ ] Row_Acciones, Row_Gestion, Row_Operacion metrics match screenshot
- [ ] Tarjeta_Detalle structure and content verified with literal text
- [ ] Responsive breakpoints defined and tested
- [ ] Accessibility requirements documented
- [ ] Data model alignment confirmed with requirements.md

---

## Appendix: Verification Log

**Verified from Ejercicios.fig (September 7, 2026)**:

| Element | Literal Text | Hex Color | Font Size | Font Weight |
|---------|-------------|-----------|-----------|------------|
| EJERCICIO ACTUAL label | EJERCICIO ACTUAL | #FD7009 | 11px | 700 |
| Press Militar (name) | Press Militar | #18181B | 17px | 700 |
| Hombros (muscle group) | Hombros | #6B7280 | 14px | 400 |
| Series×Reps label | Series×Reps | #6B7280 | 11px | 500 |
| 3×10 (value) | 3×10 | #18181B | 14px | 700 |
| Descanso label | Descanso | #6B7280 | 11px | 500 |
| 2 min (value) | 2 min | #18181B | 14px | 700 |
| Objetivo label | Objetivo | #6B7280 | 11px | 500 |
| 82,5 kg (value) | 82,5 kg | #FD7009 | 14px | 700 |
| Description | Ejercicio de empuje vertical para deltoides anterior. Mantené el core firme y evitá arquear la zona lumbar al extender los brazos. | #4B5563 | 13px | 400 |
| Libre en ~5 min | Libre en ~5 min | #FD7009 | 13px | 700 |
| Nuevo Socio button | Nuevo Socio | #18181B | 14px | 700 |
| Registrar Pago button | Registrar Pago | #18181B | 14px | 700 |
| Asignar Rutina button | Asignar Rutina | #18181B | 14px | 700 |
| Control Acceso button | Control Acceso | #18181B | 14px | 700 |
| Rutinas (card title) | Rutinas | — | 14px | 500 |
| 124 (count) | 124 | #18181B | 24px | 700 |
| Ejercicios (card title) | Ejercicios | — | 14px | 500 |
| 342 (count) | 342 | #18181B | 24px | 700 |
| Clientes (card title) | Clientes | — | 14px | 500 |
| 892 (count) | 892 | #18181B | 24px | 700 |
| Membresías (card title) | Membresías | — | 14px | 500 |
| 15 (count) | 15 | #18181B | 24px | 700 |
| 2 en mantenimiento | 2 en mantenimiento | #A1A5B0 | 12px | 400 |
| 2 entrenadores, 4 staff | 2 entrenadores, 4 staff | #A1A5B0 | 12px | 400 |
| Sin visita > 15 días | Sin visita > 15 días | #A1A5B0 | 12px | 400 |

---

**End of Document**
