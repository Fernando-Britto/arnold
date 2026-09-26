# T-016: 5 Hallazgos Críticos en ClienteRepository

## 🔴 CRÍTICOS (Rompen funcionalidad)

### Hallazgo 1: Type mismatch en update() - MERGE INCORRECTO
**Archivo**: `src/domains/cliente/cliente.ts` línea 324
```typescript
const merged = { ...existing, ...data, id, fechaAlta: existing.fechaAlta };
```
**Problema**: 
- `existing` es tipo Prisma `Socio` (tiene `usuarioId`, `membresiaAsignadaId`, `estadoCuota`)
- `data` es tipo Cliente (tiene `nombre`, `email`, `membresiaAsignada`, `estadoCuenta`)
- Merge crea objeto inválido: `merged.email` = undefined, `merged.membresiaAsignada` = undefined, `merged.estadoCuenta` = undefined
- `validateCliente(merged)` SIEMPRE FALLA

**Impacto**: Cualquier actualización de cliente rechaza validación. BLOQUEA FUNCIONALIDAD.

**Solución**:
```typescript
const existingCliente = this.mapSocioToCliente(existing);
const merged = { ...existingCliente, ...data, id, fechaAlta: existing.fechaAlta };
```

---

### Hallazgo 2: estadoCuenta nunca persiste
**Archivo**: `src/domains/cliente/cliente.ts` línea 358-366
```typescript
const updateData: any = {};
if (data.nombre !== undefined) updateData.nombre = data.nombre;
if (data.dni !== undefined) updateData.dni = normalizeDNI(data.dni);
if (data.telefono !== undefined) updateData.telefono = data.telefono;
if (data.email !== undefined) updateData.email = data.email;
if (data.membresiaAsignada !== undefined)
  updateData.membresiaAsignadaId = data.membresiaAsignada;
// FALTA: estadoCuenta
```

**Problema**:
- No hay mapeo de `data.estadoCuenta` → `updateData.estadoCuota`
- Usuario cambia estado a "Inactivo" o "Bloqueado" pero se ignora
- Estado anterior persiste en base de datos

**Impacto**: Estado de cuenta no se actualiza. DATO INCOMPLETO.

**Solución**:
1. Crear mapEstadoCuentaToEstadoCuota (inverso del existente)
2. Agregar en updateData:
```typescript
if (data.estadoCuenta !== undefined) {
  updateData.estadoCuota = mapEstadoCuentaToEstadoCuota(data.estadoCuenta);
}
```

---

## 🟡 IMPORTANT (Inconsistencias y gaps)

### Hallazgo 3: Código de error inconsistente
**Archivo**: 
- Spec: `clientes-crud/spec.md` → `MEMBERSHIP_NO_LONGER_ACTIVE`
- Código: `src/domains/cliente/cliente.ts` línea 353 → `VALIDATION_MEMBERSHIP_INACTIVE`

**Problema**: Tests y mappers esperan `MEMBERSHIP_NO_LONGER_ACTIVE` pero código lanza otra.

**Solución**: Cambiar a `MEMBERSHIP_NO_LONGER_ACTIVE` en create() y update()

---

### Hallazgo 4: Usuario huérfano al eliminar Socio
**Archivo**: `src/domains/cliente/cliente.ts` línea 388-393
```typescript
async delete(id: string): Promise<boolean> {
  const prisma = await this.getPrisma();
  const existing = await prisma.socio.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.socio.delete({ where: { id } });
```

**Problema**:
- Socio.usuarioId referencia Usuario
- Al eliminar Socio, Usuario queda huérfano
- Email del usuario sigue siendo UNIQUE → bloquea creación de nuevos usuarios con ese email

**Impacto**: Deuda técnica. Usuarios fantasma ocupan emails únicos.

**Solución**: Eliminar Usuario en transacción o usar cascada en Prisma schema

---

### Hallazgo 5: Test gap en ClienteRepository
**Archivo**: `src/domains/cliente/cliente.test.ts`
**Problema**:
- Solo prueba funciones puras: `validateCliente`, `normalizeDNI`, `createCliente`
- NO prueba métodos de `ClienteRepository` (create, update, delete, getById, list)
- Tests de integración existen en capas superiores pero no blindan dominio

**Spec requiere**: "npm test -- src/domains/cliente/ passes (validation + CRUD + RN-01 downstream)"

**Impacto**: Gaps de cobertura en capa de dominio.

**Solución**: Agregar suite de ClienteRepository con Prisma mockeado

---

## 📋 Plan T-016 (6 tareas)

1. **H1**: Fix update() merge → usar mapSocioToCliente
2. **H2**: Crear mapEstadoCuentaToEstadoCuota + agregar en update
3. **H3**: Cambiar VALIDATION_MEMBERSHIP_INACTIVE → MEMBERSHIP_NO_LONGER_ACTIVE
4. **H4**: Fix delete() → eliminar usuario asociado en transacción
5. **H5**: Agregar ClienteRepository tests en cliente.test.ts
6. **Suite**: Ejecutar todo + verificar 0 TS errors

**Bloquea**: Cierre de módulo Cliente/Socio. Sin estos fixes, UPDATE QUEBRADO.

