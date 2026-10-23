# Seed con rutinas nuevas e historial de tracking

## Objetivo

Que `socio@arnold.test` (el socio del seed) tenga, al correr `npm run seed`, rutinas nuevas y
datos suficientes para probar en el navegador el tracking completo: última vez, progresión,
marcas personales, tipos de serie, resumen y peso corporal con meta.

## Problema y por qué

El seed creaba dos rutinas y un historial mínimo sin `numeroSerie`, sin `tipo` y sin pesajes.
Las funcionalidades de T-046…T-049 quedaban sin datos: la tarjeta de peso salía vacía y en la
pantalla de entrenamiento no había "última vez", marcas ni progresión que mirar.

## Alcance

**Dentro**
- T-S1: dos rutinas nuevas (`Torso B`, `Piernas B`) y los ejercicios que usan.
- T-S2: `Torso B` asignada como activa al socio 1, para entrar y entrenarla directo.
- T-S3: tres sesiones completadas de `Torso B` con una fila por serie (`numeroSerie`, `rir`,
  `sesionId`), cargas progresivas y los cuatro tipos de serie (normal, calentamiento, al fallo,
  drop set).
- T-S4: seis pesajes y meta de peso (77 kg desde 82,4 kg).
- T-S5: borrar los pesajes del seed al re-sembrar, para que el seed siga siendo repetible.
- T-S6: tests del seed para las rutinas, los tipos de serie y los pesajes.

**Fuera**
- Cambiar el schema o el motor de tracking.
- Tocar datos que no sean de los socios del seed.

## Restricciones

- El seed es repetible y solo borra datos transaccionales de `socio@arnold.test` y
  `socio2@arnold.test`.
- El calentamiento va sin `numeroSerie` y el drop set cuelga de la última serie de su ejercicio
  (D-64/D-69).
- Los nombres de los ejercicios nuevos no pueden chocar con el catálogo
  (`tests/catalogo/importar-catalogo.test.ts`).

## Tareas

- [x] T-S1 · Ejercicios nuevos y definiciones de `Torso B` y `Piernas B`.
- [x] T-S2 · Asignación activa de `Torso B` (desactivando las anteriores del socio 1).
- [x] T-S3 · Historial de tres sesiones con series tipadas.
- [x] T-S4 · Pesajes y meta de peso.
- [x] T-S5 · Limpieza de `MedicionDePeso` en el borrado transaccional.
- [x] T-S6 · Tests y verificación (`jest tests/prisma-seed.test.ts` 11/11, `jest tests/catalogo/importar-catalogo.test.ts` 6/6, `npx tsc --noEmit` sin errores).
- [x] T-S7 · Corrido `npm run seed` contra la base configurada (2026-10-21): `socio@arnold.test` quedó con `Torso B` activa, 4 sesiones, 58 series (los cuatro tipos) y 6 pesajes con meta 77 kg.
- [x] T-S8 · Media del catálogo en las rutinas nuevas (T-050f): los 8 ejercicios nuevos llevan `catalogoId` y el seed copia `mediaId`, `musculoObjetivo` e `instrucciones` del catálogo si existe (y completa filas viejas sin media). Aplicado a las filas actuales sin re-sembrar, para no borrar la sesión en curso.

## Verificación

- `npm test -- prisma-seed`
- `npm test -- importar-catalogo`
- `npx tsc --noEmit`
- `npm run seed` (contra la base configurada, solo con autorización).
