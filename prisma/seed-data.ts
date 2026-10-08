import type { PrismaClient } from "@prisma/client";

/**
 * Datos de desarrollo para Arnold (P-08). Lógica pura del seed: recibe Prisma por parámetro
 * para poder probarla con un Prisma simulado (tests/prisma-seed.test.ts). El runner real es
 * prisma/seed.ts (`npm run seed`).
 *
 * Es REPETIBLE: usuarios, empleados y socios con upsert por clave única; catálogos (membresías,
 * ejercicios, rutinas, máquinas, configuración) solo si no existen; y los datos transaccionales
 * (asistencias, progreso, pagos, cuotas, sesiones) se borran y recrean SOLO para los socios del
 * seed, con fechas relativas a "ahora" para que los tableros siempre tengan datos recientes.
 * No toca nada que no sea del seed. Se niega a correr en producción.
 */
export const SEED_EMAIL_DOMAIN = "arnold.test";
export const DEFAULT_SEED_PASSWORD = "Arnold2026!";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export interface SeedOptions {
  /** Genera el hash bcrypt (se inyecta para no atar este módulo a bcryptjs). */
  hash: (plain: string) => Promise<string>;
  now?: Date;
  env?: string;
  password?: string;
}

export interface SeedResult {
  password: string;
  usuarios: { email: string; rol: string; nombre: string }[];
}

type Rol = "ADMINISTRADOR" | "INSTRUCTOR" | "RECEPCIONISTA" | "SOCIO";
type Turno = "MANANA" | "TARDE" | "NOCHE";

const STAFF: { nombre: string; local: string; rol: Exclude<Rol, "SOCIO">; turno: Turno }[] = [
  { nombre: "Admin Arnold", local: "admin", rol: "ADMINISTRADOR", turno: "MANANA" },
  { nombre: "Ivana Instructora", local: "instructor", rol: "INSTRUCTOR", turno: "TARDE" },
  { nombre: "Rocío Recepción", local: "recepcion", rol: "RECEPCIONISTA", turno: "MANANA" },
];

const SOCIOS = [
  { nombre: "Santiago Socio", local: "socio", dni: "30123456", telefono: "+54 9 3764 123456", plan: "Premium" },
  { nombre: "Sofía Socia", local: "socio2", dni: "31234567", telefono: "+54 9 3764 654321", plan: "Básica" },
] as const;

const MEMBRESIAS = [
  { nombre: "Básica", precio: 15000, periodicidad: 30, estado: "ACTIVA" as const },
  { nombre: "Premium", precio: 25000, periodicidad: 30, estado: "ACTIVA" as const },
  { nombre: "Anual", precio: 200000, periodicidad: 365, estado: "ACTIVA" as const },
  { nombre: "Promo verano", precio: 12000, periodicidad: 30, estado: "INACTIVA" as const },
];

const EJERCICIOS = [
  { nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Empuje horizontal con barra." },
  { nombre: "Sentadilla", grupoMuscular: "Piernas", descripcion: "Sentadilla trasera con barra." },
  { nombre: "Peso muerto", grupoMuscular: "Espalda", descripcion: "Bisagra de cadera con barra." },
  { nombre: "Remo con barra", grupoMuscular: "Espalda", descripcion: "Tracción horizontal." },
  { nombre: "Press militar", grupoMuscular: "Hombros", descripcion: "Empuje vertical de pie." },
  { nombre: "Curl de bíceps", grupoMuscular: "Brazos", descripcion: null },
];

const RUTINAS = [
  {
    nombre: "Fuerza A", objetivoPrincipal: "Fuerza", frecuenciaSemanal: 3, duracionEstimada: 60,
    nivelDeDificultad: "INTERMEDIO" as const,
    ejercicios: [
      { nombre: "Press banca", series: 4, repeticiones: 8, descanso: 120 },
      { nombre: "Remo con barra", series: 4, repeticiones: 8, descanso: 90 },
      { nombre: "Press militar", series: 3, repeticiones: 10, descanso: 90 },
      { nombre: "Curl de bíceps", series: 3, repeticiones: 12, descanso: 60 },
    ],
  },
  {
    nombre: "Piernas", objetivoPrincipal: "Hipertrofia", frecuenciaSemanal: 2, duracionEstimada: 50,
    nivelDeDificultad: "BASICO" as const,
    ejercicios: [
      { nombre: "Sentadilla", series: 4, repeticiones: 6, descanso: 150 },
      { nombre: "Peso muerto", series: 3, repeticiones: 5, descanso: 180 },
    ],
  },
];

const MAQUINAS = [
  { nombre: "Prensa de piernas", tipoEquipamiento: "MAQUINA_GUIADA" as const, estado: "DISPONIBLE" as const },
  { nombre: "Polea alta", tipoEquipamiento: "MAQUINA_GUIADA" as const, estado: "OCUPADA" as const },
  { nombre: "Banco plano", tipoEquipamiento: "PESO_LIBRE" as const, estado: "DISPONIBLE" as const },
  { nombre: "Rack de sentadillas", tipoEquipamiento: "PESO_LIBRE" as const, estado: "DISPONIBLE" as const },
  { nombre: "Cinta 1", tipoEquipamiento: "CARDIO" as const, estado: "DISPONIBLE" as const },
  { nombre: "Bicicleta fija", tipoEquipamiento: "CARDIO" as const, estado: "FUERA_DE_SERVICIO" as const },
];

export async function runSeed(prisma: PrismaClient, opts: SeedOptions): Promise<SeedResult> {
  if ((opts.env ?? process.env.NODE_ENV) === "production") {
    throw new Error("El seed no puede correr en producción");
  }
  const now = opts.now ?? new Date();
  const password = opts.password ?? DEFAULT_SEED_PASSWORD;
  const passwordHash = await opts.hash(password);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const email = (local: string) => `${local}@${SEED_EMAIL_DOMAIN}`;

  const upsertUsuario = (nombre: string, local: string, rol: Rol) =>
    prisma.usuario.upsert({
      where: { email: email(local) },
      // Al volver a correr, el login del seed queda funcionando aunque se haya cambiado o bloqueado.
      update: { nombre, rol, password: passwordHash, estado: "ACTIVO", deletedAt: null },
      create: { nombre, email: email(local), password: passwordHash, rol },
    });

  // --- Configuración, membresías, ejercicios, rutinas, máquinas, regla (solo si faltan) ---
  if (!(await prisma.configuracionDelSistema.findFirst())) {
    await prisma.configuracionDelSistema.create({
      data: { capacidadMaxima: 60, periodoGracia: 3, diasInactividad: 15, descuentoReactivacion: 10, ventanaAforoMinutos: 90 },
    });
  }

  const membresiaId: Record<string, string> = {};
  for (const m of MEMBRESIAS) {
    const existente = await prisma.membresia.findFirst({ where: { nombre: m.nombre } });
    membresiaId[m.nombre] = (existente ?? (await prisma.membresia.create({ data: m }))).id;
  }

  const ejercicioId: Record<string, string> = {};
  for (const e of EJERCICIOS) {
    const existente = await prisma.ejercicio.findFirst({ where: { nombre: e.nombre } });
    ejercicioId[e.nombre] = (existente ?? (await prisma.ejercicio.create({ data: e }))).id;
  }

  const rutinaId: Record<string, string> = {};
  for (const { ejercicios, ...datos } of RUTINAS) {
    let rutina = await prisma.rutina.findFirst({ where: { nombre: datos.nombre } });
    if (!rutina) {
      rutina = await prisma.rutina.create({ data: datos });
      for (const [orden, e] of ejercicios.entries()) {
        await prisma.ejercicioEnRutina.upsert({
          where: { rutinaId_ejercicioId: { rutinaId: rutina.id, ejercicioId: ejercicioId[e.nombre] } },
          update: {},
          create: {
            rutinaId: rutina.id, ejercicioId: ejercicioId[e.nombre],
            series: e.series, repeticiones: e.repeticiones, descanso: e.descanso, orden,
          },
        });
      }
    }
    rutinaId[datos.nombre] = rutina.id;
  }

  if ((await prisma.maquina.count()) === 0) {
    await prisma.maquina.createMany({ data: MAQUINAS.map((m) => ({ ...m, ubicacion: "Sala principal" })) });
  }
  if (!(await prisma.reglaDeProgresion.findFirst({ where: { tipo: "LINEAL" } }))) {
    await prisma.reglaDeProgresion.create({ data: { tipo: "LINEAL", incrementoSugerido: 2.5 } });
  }

  // --- Usuarios, personal y socios (upsert por clave única) ---
  const usuarios: SeedResult["usuarios"] = [];
  for (const s of STAFF) {
    const u = await upsertUsuario(s.nombre, s.local, s.rol);
    await prisma.empleado.upsert({
      where: { usuarioId: u.id },
      update: { turno: s.turno, estadoLaboral: "ACTIVO" },
      create: { usuarioId: u.id, turno: s.turno, estadoLaboral: "ACTIVO" },
    });
    usuarios.push({ email: email(s.local), rol: s.rol, nombre: s.nombre });
  }

  const socioIds: string[] = [];
  for (const s of SOCIOS) {
    const u = await upsertUsuario(s.nombre, s.local, "SOCIO");
    const socio = await prisma.socio.upsert({
      where: { usuarioId: u.id },
      update: { membresiaAsignadaId: membresiaId[s.plan] },
      create: { usuarioId: u.id, dni: s.dni, telefono: s.telefono, membresiaAsignadaId: membresiaId[s.plan], estadoCuota: "AL_DIA" },
    });
    socioIds.push(socio.id);
    usuarios.push({ email: email(s.local), rol: "SOCIO", nombre: s.nombre });
  }
  const [socio1, socio2] = socioIds;

  // --- Datos transaccionales: se recrean solo para los socios del seed ---
  const delos = { socioId: { in: socioIds } };
  await prisma.sesionDeEntrenamiento.deleteMany({ where: delos });
  await prisma.pago.deleteMany({ where: delos });
  await prisma.cuota.deleteMany({ where: delos });
  await prisma.asistencia.deleteMany({ where: delos });
  await prisma.registroDeProgreso.deleteMany({ where: delos });

  // Socio 1 al día; socio 2 con la cuota vencida y sin visitas recientes (alertas de Home_Interno).
  const cuotaVigente = await prisma.cuota.create({
    data: { socioId: socio1, fechaInicio: ago(10 * DAY_MS), fechaVencimiento: new Date(now.getTime() + 20 * DAY_MS), estado: "VIGENTE" },
  });
  await prisma.cuota.create({
    data: { socioId: socio2, fechaInicio: ago(45 * DAY_MS), fechaVencimiento: ago(15 * DAY_MS), estado: "VENCIDA" },
  });
  await prisma.socio.update({ where: { id: socio2 }, data: { estadoCuota: "VENCIDA" } });

  // Asistencias del socio 1: una hace 30 min (cuenta en el aforo) y el resto repartido en 5 semanas.
  const visitas = [30 * MIN_MS, ...[2, 3, 7, 9, 10, 14, 16, 21, 23, 28, 30].map((d) => d * DAY_MS)];
  await prisma.asistencia.createMany({
    data: [
      ...visitas.map((ms) => ({ socioId: socio1, fechaHora: ago(ms), estado: "PERMITIDO" as const })),
      { socioId: socio2, fechaHora: ago(20 * DAY_MS), estado: "PERMITIDO" as const },
    ],
  });

  await prisma.registroDeProgreso.createMany({
    data: [
      ...[[24, 55], [17, 57.5], [10, 60], [3, 62.5]].map(([d, carga]) => ({
        socioId: socio1, ejercicioId: ejercicioId["Press banca"], carga, repeticiones: 8, pesoCorporal: 78, fecha: ago(d * DAY_MS),
      })),
      { socioId: socio1, ejercicioId: ejercicioId["Sentadilla"], carga: 80, repeticiones: 6, pesoCorporal: 78, fecha: ago(12 * DAY_MS) },
    ],
  });

  // Una rutina activa para el socio 1 (RN-04) y una sesión completada.
  let asignacion = await prisma.rutinaAsignada.findFirst({ where: { socioId: socio1, rutinaId: rutinaId["Fuerza A"] } });
  if (!asignacion) {
    asignacion = await prisma.rutinaAsignada.create({
      data: { socioId: socio1, rutinaId: rutinaId["Fuerza A"], fechaAsignacion: ago(30 * DAY_MS), activa: true },
    });
  }
  await prisma.sesionDeEntrenamiento.create({
    data: {
      socioId: socio1, rutinaAsignadaId: asignacion.id, horaInicio: ago(3 * DAY_MS), horaFin: ago(3 * DAY_MS - 55 * MIN_MS),
      estadoDeFinalizacion: "COMPLETADA",
    },
  });

  // Un pago de hoy para que la Caja de Home_Interno tenga datos.
  await prisma.pago.create({
    data: { socioId: socio1, cuotaId: cuotaVigente.id, monto: 25000, metodoPago: "TARJETA", estado: "CONFIRMADO", fechaPago: ago(60 * MIN_MS) },
  });

  return { password, usuarios };
}
