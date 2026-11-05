# T-012: Cliente API Route - 4 Hallazgos Críticos

## 🔴 CRÍTICO 1: Bug de Contrato JSON (POST /api/clientes)

### Problema
Desconexión entre forma de respuesta API y expectativa del cliente frontend.

**API (route.ts)**:
```typescript
// Devuelve objeto APLANADO
export async function handleClienteCreateRequest(body: any): Promise<CreateSuccess> {
  const result = await handleClienteCreate(body);
  return {
    ...result.cliente,        // ← Spread del cliente
    tempPassword: result.tempPassword,
    status: 201
  } as CreateSuccess;
}
// Response: { id, nombre, email, ..., tempPassword, status: 201 }
```

**Cliente API (src/api/clientes.ts)**:
```typescript
export async function createCliente(data: ClienteInput): Promise<{ cliente: Cliente; tempPassword: string }> {
  const response = await fetch("/api/clientes", ...);
  return response.json();  // ← Recibe objeto aplanado, NO wrapped
  // Retorna: { id, nombre, email, ..., tempPassword, status: 201 }
}
```

**Pantalla (src/app/clientes/page.tsx)**:
```typescript
const result = await createCliente(...);
savedCliente = result.cliente;        // ← 💥 undefined!
tempPassword = result.tempPassword;   // ← undefined!
setClientes((prev) => [...prev, savedCliente]); // ← Agrega undefined
// TypeError: Cannot read properties of undefined (reading 'nombre')
```

### Impacto
- ❌ CREATE en producción FALLA
- ❌ E2E tests reales rompen
- ❌ Tabla explota con TypeError
- ⚠️ Tests unitarios mockeados NO detectan porque aíslan clientes fetch

### Solución (elegir UNA)

**Opción A**: route.ts devuelve objeto wrapped
```typescript
export async function handleClienteCreateRequest(body: any) {
  const result = await handleClienteCreate(body);
  return {
    cliente: result.cliente,
    tempPassword: result.tempPassword
  };
}
```

**Opción B**: clientes.ts mapea respuesta aplanada
```typescript
export async function createCliente(data: ClienteInput) {
  const response = await fetch("/api/clientes", ...);
  const data = await response.json();
  // Espera objeto aplanado de API
  return {
    cliente: {
      id: data.id,
      nombre: data.nombre,
      email: data.email,
      // ... mapea todos los campos
    },
    tempPassword: data.tempPassword
  };
}
```

---

## 🔴 CRÍTICO 2: Falta de Autenticación JWT y Role Gating (RN-06)

### Problema
Spec T-012: "CRUD endpoints + Membresía assignment effects + **Next.js route.ts with JWT auth**"
AC: Acceso restringido solo a ADMINISTRADOR + RECEPCIONISTA

**Código actual**:
```typescript
// src/app/api/clientes/route.ts
export async function GET(req: Request) {
  const body = await req.json();
  const result = await handleClienteList(body);
  return Response.json(result, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = await handleClienteCreateRequest(body);
  return Response.json(result, { status: result.status || 201 });
}

// ❌ NO hay:
// - lectura de Authorization header
// - extractUserFromAuthHeader()
// - validación de rol
```

### Contraste: Otros endpoints SÍ lo hacen
```typescript
// src/app/api/access-override/route.ts (ejemplo que SÍ funciona)
export async function POST(req: Request) {
  const user = extractUserFromAuthHeader(req);
  if (!user || !["ADMINISTRADOR", "RECEPCIONISTA"].includes(user.rol)) {
    return Response.json({ error: "Acceso denegado" }, { status: 403 });
  }
  // ... resto del handler
}
```

### Impacto
- ❌ Cualquier usuario sin autenticar puede GET/POST/PUT/DELETE clientes
- ❌ SOCIO puede editar/borrar otros clientes
- ⚠️ CRÍTICO: Violación de seguridad
- ⚠️ Spec no cumplida

### Solución
Agregar validación en CADA handler:
```typescript
export async function GET(req: Request) {
  const user = extractUserFromAuthHeader(req);
  if (!user || !["ADMINISTRADOR", "RECEPCIONISTA"].includes(user.rol)) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json();
  const result = await handleClienteList(body);
  return Response.json(result, { status: 200 });
}

export async function POST(req: Request) {
  const user = extractUserFromAuthHeader(req);
  if (!user || !["ADMINISTRADOR", "RECEPCIONISTA"].includes(user.rol)) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // ... resto
}

// Igual en PUT, DELETE, y /[id]/route.ts
```

---

## 🟡 BUG POTENCIAL 3: Falsos Positivos en Validación Read-Only

### Problema
```typescript
// src/app/api/clientes/[id]/route.ts (PUT handler)
if ("id" in body || "fechaAlta" in body) {
  throw new Error("VALIDATION_ERROR: id y fechaAlta son campos de solo lectura");
}
```

Operador `"in"` devuelve `true` si propiedad existe, **incluso si es `undefined`**:
```javascript
const body = { id: undefined, nombre: "Juan" };
"id" in body  // ← true! (pero el valor es undefined)
```

### Impacto
- 🟡 Cliente manda `{ id: undefined, nombre: "Juan" }` (desintencional)
- 🟡 Validación falla: "id y fechaAlta son campos de solo lectura"
- 🟡 Usuario ve error confuso: ¿No intenté cambiar id?
- 🟡 Test que verifica rechazo de id pasa, pero por razón equivocada

### Solución
```typescript
if (body.id !== undefined || body.fechaAlta !== undefined) {
  throw new Error("VALIDATION_ERROR: id y fechaAlta son campos de solo lectura");
}
```

---

## 🟡 GAP 4: Cobertura de Pruebas Incompleta en src/api/clientes.test.ts

### Problema
**Spec AC**: `npm test -- src/api/clientes passes (7+ scenarios)`
**Status actual**: Solo 2 tests, solo handleClienteCreate

### Faltan Pruebas Para:

**1. Handlers de API (src/api/clientes.ts functions)**:
- [ ] handleClienteList()
  - Buscar, filtrar, ordenar
- [ ] handleClienteGet(id)
  - Caso exitoso
  - Caso 404 (no existe)
- [ ] handleClienteUpdate(id, data)
  - Actualización parcial
  - Validación de membresía inactiva
  - Rechazo de id/fechaAlta
- [ ] handleClienteDelete(id)
  - Eliminación exitosa
  - Caso 404

**2. Fetch clients (src/api/clientes.ts exports)**:
- [ ] fetchClientes()
- [ ] createCliente() - OK actualmente
- [ ] updateCliente(id, data)
- [ ] deleteCliente(id)

**3. Integración Route ↔ Handler**:
- [ ] GET /api/clientes (200 OK, lista)
- [ ] POST /api/clientes (201 Created)
- [ ] PUT /api/clientes/[id] (200 OK)
- [ ] DELETE /api/clientes/[id] (204 No Content)

### Solución
Expandir cliente.test.ts con:
```typescript
describe("handleClienteList", () => { ... });
describe("handleClienteGet", () => { ... });
describe("handleClienteUpdate", () => { ... });
describe("handleClienteDelete", () => { ... });
describe("fetchClientes", () => { ... });
describe("updateCliente", () => { ... });
describe("deleteCliente", () => { ... });
```

---

## 📋 Plan de Acción T-012

### Prioridad CRÍTICA
1. **P1**: Arreglar Bug #1 (Contrato JSON) - Bloquea CREATE
2. **P1**: Agregar JWT Auth #2 - Violación de seguridad
3. **P2**: Arreglar Bug #3 (falsos positivos validación)
4. **P2**: Expandir cobertura #4 - Spec AC incumplida

### Tareas
- [ ] **T-012-B1**: Unificar contrato JSON create (Opción A o B)
- [ ] **T-012-B2**: Agregar JWT auth a GET/POST/PUT/DELETE
- [ ] **T-012-B3**: Cambiar `"in"` a `!== undefined`
- [ ] **T-012-B4**: Expandir cliente.test.ts a 7+ scenarios

### Validación
```bash
$ npm test -- src/api/clientes
✅ 7+ tests passed
✅ 0 errors en route.ts
✅ Todos handlers tienen JWT
```

---

## ⚠️ Bloquea
- ❌ T-012 Acceptance: Falta de 7+ scenarios
- ❌ T-013 Integración: Depende de POST correcto
- ❌ E2E: CREATE + UPDATE fallan
- ⚠️ Seguridad: Endpoints sin autenticación

