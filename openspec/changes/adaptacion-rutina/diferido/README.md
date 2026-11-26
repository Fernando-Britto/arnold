# Diferido — borradores para el change `adaptacion-plan`

Estos archivos **no son specs vigentes** de `adaptacion-rutina`. Son los deltas que se escribieron cuando el
change todavía incluía propuestas con estado, aprobación del instructor, copia por socio y `planActualizadoAt`.

Se aplazaron, **no se descartaron**, en D-143 (2026-11-26) y pasan al change posterior `adaptacion-plan`
(pendiente P-74). Motivo: `EjercicioEnRutina` no tiene campo de carga (`prisma/schema.prisma:337-356`) y la
sugerencia de carga ya es automática en cada sesión (D-59), así que una propuesta de cambiar carga no tiene dónde
aterrizar; la aprobación tiene sentido para cambios de **plan** (series, repeticiones, ejercicios, fases).

## Qué hay acá

- `adaptacion-propuesta/spec.md`: propuestas con estado, ciclo de vida, copia por socio y `planActualizadoAt`.
- `adaptacion-aprobacion/spec.md`: aprobación del instructor, RBAC, 409, carga de meta y nivel.
- `rutinas-crud/spec.md`: `planActualizadoAt` y tolerancia de la copia por socio en el CRUD.
- `home-socio-portal/spec.md`: motivo de la última adaptación **aprobada** en la vista del socio.

Los números AC de estos borradores quedaron como `AC-TBD`: no reservan numeración mientras estén diferidos.

## Notas de diseño para retomar

Correcciones acordadas para cuando se retome `adaptacion-plan`; no están implementadas ni decididas como D-xxx.

1. **Meta y nivel con `PATCH` dedicado**, no `PUT /api/clientes/[id]`: son datos de entrenamiento, no de registro
   del cliente. Endpoint y panel propios evitan tocar `cliente-form.tsx`, que tiene trabajo paralelo (R8 del
   proposal anterior).
2. **Permisos solo por rol**: no existe relación instructor–socio en el schema. Rechazar la idea de "socios a
   cargo" por ahora; todos los INSTRUCTOR y ADMINISTRADOR ven todas las pendientes, y el aprobador queda
   registrado.
3. **`resueltoPor` en lugar de `aprobadoPor`**: el campo cubre aprobación y rechazo con el mismo registro.
4. **Aprobación en una sola transacción**, con la transición condicionada a `PENDIENTE` (guard por estado), igual
   que las transiciones de `reasignacion-instructor`.
5. **409 si el socio tiene una sesión `EN_CURSO`**: no se aplica un cambio de plan a mitad de sesión.

## Vigente que NO está acá

Sigue en `adaptacion-rutina`: el motor puro (S1), la integración en la sugerencia de la sesión (S2), la regla
ACSM (D-137), la meta como parámetro con `meta = null` en producción (D-138) y el incremento por grilla (D-141).
El socio sigue viendo el **motivo de la sugerencia**; lo que se difiere es el motivo de una **aprobación**.
