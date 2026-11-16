# Reasignación por instructor (T-058a..T-058e, D-125..D-133, P-61)

## Objetivo

Cerrar **P-61**, la salida de emergencia del flujo obligatorio: cuando la máquina se rompe o el socio se
lesiona a mitad de entrenamiento, el instructor (o el administrador) **cambia la máquina** de la ejecución en
curso sin tocar la sesión del socio. Saltar el ejercicio queda diferido en **P-72**.

## Alcance

- `src/domains/asignacion/reasignacion.ts` (nuevo): validaciones, códigos y orquestación de la transacción.
- `src/domains/asignacion/asignacion-escrituras.ts`: `cancelarEjecucion` (guard `EN_CURSO` + `sesionId`).
- `src/domains/asignacion/asignacion-repositorio.ts`: `enTransaccionDeReasignacion` (lock global) y el
  adaptador `reasignacionPuerto`.
- `src/api/reasignaciones.ts`, `src/api/reasignaciones-cliente.ts` y
  `src/app/api/reasignaciones/route.ts`: `GET` (panel) y `POST` (reasignar).
- `src/lib/authorization.ts`: `/api/reasignaciones` con `GET` y `POST` para INSTRUCTOR y ADMINISTRADOR.
- `src/components/home-interno/sesiones-en-curso.tsx` y `hora.ts`; montaje en `src/app/home-interno/page.tsx`.
- `tests/integration/reasignacion-instructor.integration.test.ts` (Docker, lo corre Fernando).
- Spec `reasignacion-instructor`, `openspec/decisions.md` y este archivo (cierre).

Sin migraciones, sin cambios al motor y sin tocar `sesion-de-entrenamiento.ts`.

## Decisiones clave

- **D-125** — La v1 cambia la máquina (y asigna máquina a una fila `EN_CURSO` con `maquinaId` nulo). Saltar el
  ejercicio se registra como **P-72** porque mueve `ejercicioActualId`/`serieActual`.
- **D-126** — El panel vive en `Home_Interno`, solo para INSTRUCTOR y ADMINISTRADOR; no se abre `/clientes`.
- **D-127** — La sesión sigue `EN_CURSO` con sus series; cerrar la sesión sigue siendo del socio.
- **D-128** — La auditoría va **dentro** de la transacción con `tx.registroDeAuditoria.create`
  (`registrarOperacion` usa el cliente global y escribiría fuera).
- **D-129** — Destino válido: candidata del ejercicio, `DISPONIBLE` y libre (con D-105 y D-108).
- **D-130** — Lock global + guard `id + sesionId + EN_CURSO`; si el socio terminó, 409.
- **D-131** — Sin aviso en la pantalla del socio ni recálculo de reservas ajenas.
- **D-132** — Recurso propio `/api/reasignaciones`: la matriz por prefijo no admitía colgarlo de
  `/api/asignaciones` sin abrir `decidir` a INSTRUCTOR y ADMINISTRADOR.
- **D-133** — La ocupación del destino se evalúa reusando `aplicarOcupantes`.

## Tareas

1. **T-058a · S0 — Dominio**. ✅ `reasignarMaquina`, `cancelarEjecucion`, `enTransaccionDeReasignacion` y 12
   tests.
2. **T-058b · S1 — Lectura del staff**. ✅ `handleSesionesEnCursoStaff` y `GET /api/reasignaciones`.
3. **T-058c · S2 — Reasignación HTTP**. ✅ `handleReasignar`, `POST`, matriz de roles y mapeo de los cinco
   códigos a 400/404/409/500.
4. **T-058d · S3 — Panel**. ✅ "Sesiones en curso" con socio, ejercicio, máquina, hora y estado vacío.
5. **T-058e · S4 — Acción**. ✅ Selector de candidatas, "Reasignar", 409 visible y refresco; integración
   escrita y corrida por Fernando.

## Verificación observada

- `npx tsc --noEmit`: limpio · `npm run lint`: **0 errores** (96 warnings preexistentes) ·
  `npm test`: **282 suites / 3957 tests** · `npm run build`: compilado en 9,3 s.
- Integración con Docker (Fernando): **10 suites / 59 tests** (antes 9 / 54).
- Mutaciones independientes: guard de estado, control de rol, destino libre y destino candidato — las cuatro
  fallan el test correcto.
- **Mutación del lock**: con el test de dos reasignaciones simultáneas el lock quitado **no fallaba** (medía
  timing); con el test de serialización nuevo **falla** y al revertir vuelve a verde.
- Smoke manual de Fernando (2026-11-14): panel, reasignación, sesión intacta, rechazo por máquina ocupada y
  403 para recepción y socio.

## Límites declarados

- **Sin saltar ejercicio** (P-72): la sesión no se mueve de ejercicio.
- **El socio no ve el cambio** en su pantalla: se entera en el próximo recálculo (D-131).
- **Panel sin paginar**: lista todas las sesiones abiertas, ordenadas por hora de inicio.
- **Privacidad**: el instructor ve nombres de socios entrenando y su ejercicio; no hay datos de pago ni salud.
- **Doble reasignación simultánea**: el test de estado final no prueba el orden; el de serialización sí.

## Pendientes

- **P-72** — Saltar el ejercicio durante la sesión (mover `ejercicioActualId`/`serieActual`).
- **P-62** simulación de la tesis · **P-63** limitación "solo espera" · **P-69** limpieza de vencidas ·
  **P-71** latencia del check-in con carga real.

## Lecciones

- **Un test de concurrencia sin barrera mide timing**: el de dos reasignaciones pasaba con el lock comentado.
  El de serialización (A retiene el lock, B espera) es el que detecta la falta. Mismo patrón que la asignación.
- **El RBAC por prefijo empuja a recursos propios**: `/api/reasignaciones` resolvió los permisos sin
  excepciones en el guardián de consistencia.
- **La auditoría transaccional no puede usar el helper global**: hay que escribir con el `tx`.
