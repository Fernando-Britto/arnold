# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Socios** (miembros del gimnasio): entrenan y controlan su progreso. Usan el celular,
de pie en la sala, entre series, muchas veces con una sola mano y con la pantalla a
distancia de brazo. *Inferido de la existencia de `/home-socio` y su diseño mobile-first;
confirmar.*

**Staff** (Administrador, Instructor, Recepcionista): atienden el mostrador de entrada en
una computadora compartida, con gente esperando. Necesitan leer rápido y hacer la tarea en
la menor cantidad de clics posible.

## Product Purpose

Manejar la operación diaria de un gimnasio —altas, membresías, pagos, caja, rutinas,
acceso— y a la vez darle a cada socio el registro de su entrenamiento.
El éxito es que la recepción despache la cola sin errores y que el socio vuelva a abrir
su rutina.

## Positioning

El registro de entrenamiento del socio y la operación del mostrador son el **mismo dato**,
no dos sistemas integrados. La asistencia que marca el kiosco es la racha que ve el socio;
la serie que registra en su rutina es el progreso que el instructor mira.
Un CRM genérico de gimnasios no tiene el entrenamiento adentro.

## Operating Context

- Mostrador con cola: alta de socio, cobro de cuota, cierre de caja al final del turno.
- Kiosco de acceso por DNI + PIN, abierto y dejado corriendo toda la jornada.
- Instructor asignando rutinas desde una tablet o computadora de la sala.
- Socio consultando su rutina en el celular, en medio del entrenamiento.
- Idioma del producto: español rioplatense (`es-AR`). Terminología propia del dominio:
  socio, membresía, cuota, cierre de caja, serie, repeticiones, RIR, descanso.

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma + PostgreSQL.
- Cuatro roles con distinto alcance: ADMINISTRADOR, INSTRUCTOR, RECEPCIONISTA, SOCIO.
- Catálogo de 1.324 ejercicios con media (imagen/video) y taxonomía de 18 músculos.
- Rutinas asignadas, sesiones de entrenamiento con registro serie por serie, progresión de
  carga, peso corporal, asistencias, membresías, pagos y cierres.
- Acceso por kiosco (DNI + PIN) y huella. JWT con revocación.
- Sin datos de producción: el entorno de desarrollo usa datos del seed.

## Brand Commitments

- Nombre: **Arnold Gym**.
- El naranja Strava `#FC4C02` es una decisión explícita del dueño y no se negocia.
- La tipografía Inter vino impuesta por los mockups originales de OpenPencil. Es
  **revisable**: el dueño pidió un rediseño desde cero.

## Evidence on Hand

- Catálogo real de 1.324 ejercicios con nombres, grupos musculares y media (`prisma/data/`).
- Usuarios, rutinas, asistencias y pagos de desarrollo (`prisma/seed-data.ts`).
- Mockups originales como SVG en `openspec/`.
- No hay testimonios, métricas de negocio ni prensa. No inventar ninguno.

## Product Principles

1. **El mostrador no espera.** Toda tarea de recepción se resuelve sin pensar y en pocos clics.
2. **El dato del socio es el mismo del gimnasio.** Una sola fuente para asistencia, rutina y pago.
3. **El entrenamiento manda.** Cuando haya conflicto de espacio, gana lo que el socio hace hoy.
4. **Nada decorativo en la sala.** En una pantalla compartida con luz variable, la legibilidad
   y el contraste valen más que la expresividad.
5. **Sin datos inventados.** Si falta un dato, se muestra vacío o se dice, no se rellena.

## Accessibility & Inclusion

WCAG AA en todo el producto: contraste 4.5:1 en texto, 3:1 en UI no textual, objetivos
táctiles cómodos en el celular del socio.
