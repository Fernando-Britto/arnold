# Cache de listas en el cliente

## Objetivo

Que volver a una pantalla ya visitada (Clientes, Ejercicios, Membresías, Rutinas) no vuelva a pedir
la lista completa, sin cambiar el backend y sin mezclar datos entre usuarios. Pensado para la demo;
la app sigue siendo de un solo gimnasio.

## Problema y por qué

Cada pantalla es un Client Component que pide la lista completa en un `useEffect` al montar. Ir y
volver entre pantallas repetía las consultas (y el proxy vuelve a validar la sesión en cada request).
Las mutaciones ya parcheaban el estado local; el costo estaba en las visitas.

## Alcance

**Dentro**
- C-P1: cache en memoria por pestaña, con TTL de 60 s y dedupe de pedidos concurrentes.
- C-P2: cablearlo en `fetchClientes`, `fetchEjercicios`, `fetchMembresias`, `fetchMembresiasList` y
  `fetchRutinas`.
- C-P3: invalidar la lista afectada al crear/editar/borrar (las pantallas ya actualizan su estado).
- C-P4: limpiar el cache en el logout para no dejar datos de una sesión al próximo usuario.

**Fuera**
- Cache en el servidor, Cache Components de Next, paginación/búsqueda en la base y multi-tenant.
- Cambiar la validación de sesión del proxy (queda como próximo lever, con su tradeoff de seguridad).

## Restricciones

- El cache vive solo en el navegador: nada de `localStorage` (máquina compartida en recepción).
- Datos personales: el cache se limpia al cerrar sesión; no se comparte entre usuarios.
- Las respuestas derivadas (`enRutinas`) se invalidan al mutar rutinas.

## Tareas

- [x] C-P1 · `src/lib/cache-cliente.ts` (`conCache`, `invalidarCache`, `limpiarCache`, `CLAVES`).
- [x] C-P2 · Listas cableadas en las cuatro APIs.
- [x] C-P3 · Invalidación en mutaciones de clientes, ejercicios, membresías y rutinas.
- [x] C-P4 · `limpiarCache()` en el logout de `useAuth`.
- [x] C-P5 · Tests del cache (TTL, dedupe, error, invalidación, claves).

## Verificación

- `npx jest src/lib/cache-cliente.test.ts` 7/7.
- `npx jest src/api src/lib src/components/membresia-crud` 676/676.
- `npx jest src/app/clientes src/app/ejercicios src/app/membresias src/app/rutinas src/contexts/auth.test.tsx` 95/95.
- `npx tsc --noEmit` y `eslint` limpios.
- Manual: abrir una lista, navegar a otra pantalla y volver dentro de 60 s; en Network no debe
  repetirse el GET de la lista.
