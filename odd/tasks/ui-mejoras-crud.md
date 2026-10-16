# Mejoras de UI: modal de borrado, uso de ejercicios y Dispositivos dentro de Configuración

## Objetivo

Tres cambios pedidos después de la verificación manual de los 4 CRUD:

1. **Modal de confirmación antes de eliminar** en vez del diálogo nativo `window.confirm`.
2. **Ejercicios: mostrar si está en uso** (asignado a rutinas) para saber si se puede borrar.
3. **Mover Dispositivos dentro de Configuración**, como pestaña.

## Estado verificado (2026-10-16)

- Los 4 CRUD (`/ejercicios`, `/rutinas`, `/clientes`, `/membresias`) **ya** usan `window.confirm`:
  `ejercicios/page.tsx:127`, `rutinas/page.tsx:185`, `clientes/page.tsx:203`, `membresias/page.tsx:105`.
- El backend **ya devuelve 409 `DELETE_BLOCKED_ASSIGNED`** (AC-006) al borrar un ejercicio en uso
  (`src/lib/route-error-mapper.ts:62`), pero la UI no lo anticipa: el usuario se entera recién al fallar.
- `/configuracion` es una página de un solo formulario (sin pestañas); `/dispositivos` es una página aparte.
- Hay patrón de modal accesible para reutilizar: `src/hooks/use-modal-a11y.ts` y
  `src/components/rutina/asignar-rutina-modal.tsx` / `src/components/acceso/override-acceso.tsx`.

## Alcance

**Dentro**
- Un diálogo de confirmación reutilizable y accesible, usado por los 4 CRUD.
- En Ejercicios: mostrar cuántas rutinas usan el ejercicio, y bloquear el borrado desde la UI con
  mensaje claro (sin depender del 409).
- `/configuracion` con pestañas; la de Dispositivos monta el panel que hoy vive en `/dispositivos`.

**Fuera**
- Otras acciones destructivas (anular pago, borrar sesión) que no sean de los 4 CRUD.
- Cambios en la lógica de negocio del borrado (el 409 del backend queda igual).

## Restricciones

- Reutilizar `useModalA11y` (Esc, focus-trap, foco de retorno). No agregar dependencias.
- El diálogo nuevo va en `src/components/ui/` (es compartido).
- En Configuración, `/dispositivos` **no debe romperse**: si se mueve, dejar un redirect a la pestaña.
- Los 4 CRUD siguen con sus tests verdes; los nuevos flujos llevan test.

## Verificación

- `npm test` · `npx tsc --noEmit` · `npx eslint` sobre lo tocado.

## Progreso

- 2026-10-16 — Documento creado.
- 2026-10-16 — Los tres cambios implementados y verificados (`tsc` OK, `eslint` OK, **191 suites / 2410 tests**).
  - `ConfirmDialog` reutilizable + los 4 CRUD migrados.
  - Ejercicios: `enRutinas` aditivo en el listado, columna "Rutinas" y borrado bloqueado desde la UI.
  - `/configuracion` con pestañas (Parámetros / Dispositivos); `/dispositivos` reusa el panel compartido.

### Nota sobre `npm test` (no es una regresión de este cambio)

Con los workers por defecto (Jest usa `cores-1` = 11 acá) fallan de forma **intermitente** los suites
del kiosco (`kiosco-acceso`, `kiosco-acceso-override`, `kiosco-puerta`): son los más lentos, dejan
timers abiertos (`MS_AUTO_CLEAR`) y superan el `waitFor` de 5 s bajo carga. **Pasan aislados**, no
importan nada de este cambio, y el repo ya lo documenta (FX-18, `tests/setup.ts`). Con
`npm test -- --maxWorkers=4` la suite da **191/191 en verde**. En CI (2–4 cores) el paralelismo es
mucho menor, así que el riesgo ahí es más bajo. Queda como deuda de higiene de tests, aparte.
