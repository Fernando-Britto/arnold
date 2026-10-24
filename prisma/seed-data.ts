import type { PrismaClient } from "@prisma/client";

/**
 * Datos de desarrollo para Arnold (P-08). Lógica pura del seed: recibe Prisma por parámetro
 * para poder probarla con un Prisma simulado (tests/prisma-seed.test.ts). El runner real es
 * prisma/seed.ts (`npm run seed`).
 *
 * Es REPETIBLE: usuarios, empleados y socios con upsert por clave única; catálogos (membresías,
 * ejercicios, rutinas, máquinas, configuración) solo si no existen; y los datos transaccionales
 * (asistencias, progreso, pesajes, pagos, cuotas, sesiones) se borran y recrean SOLO para los socios
 * del seed, con fechas relativas a "ahora" para que los tableros siempre tengan datos recientes.
 * El socio 1 queda con `Torso B` activa y tres sesiones de historial con los cuatro tipos de serie,
 * para probar el tracking (T-046…T-048) sin cargar datos a mano.
 * No toca nada que no sea del seed. Se niega a correr en producción.
 */
export const SEED_EMAIL_DOMAIN = "arnold.test";
export const DEFAULT_SEED_PASSWORD = "Arnold2026!";
/** PIN de 4 dígitos de los socios del seed, para probar el check-in por DNI + PIN (T-035/D-47). */
export const DEFAULT_SEED_PIN = "1234";

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

interface EjercicioSeed {
  nombre: string;
  grupoMuscular: string;
  descripcion: string | null;
  /** `datasetId` de un ejercicio del catálogo (D-70). Si existe, el seed copia su media. */
  catalogoId?: string;
}

export const EJERCICIOS: EjercicioSeed[] = [
  { nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Empuje horizontal con barra." },
  { nombre: "Sentadilla", grupoMuscular: "Piernas", descripcion: "Sentadilla trasera con barra." },
  { nombre: "Peso muerto", grupoMuscular: "Espalda", descripcion: "Bisagra de cadera con barra." },
  { nombre: "Remo con barra", grupoMuscular: "Espalda", descripcion: "Tracción horizontal." },
  { nombre: "Press militar", grupoMuscular: "Hombros", descripcion: "Empuje vertical de pie." },
  { nombre: "Curl de bíceps", grupoMuscular: "Brazos", descripcion: null },
  // Ejercicios de las rutinas nuevas (T-S1). Nombres cortos propios del seed: no chocan con
  // el catálogo importado (tests/catalogo/importar-catalogo.test.ts). `catalogoId` enlaza la
  // animación, el músculo y las instrucciones del catálogo para la pantalla de ejecución (T-050f).
  { nombre: "Press inclinado", grupoMuscular: "Pecho", descripcion: "Empuje inclinado con barra.", catalogoId: "0047" },
  { nombre: "Jalón al pecho", grupoMuscular: "Espalda", descripcion: "Tracción vertical en polea.", catalogoId: "2330" },
  { nombre: "Remo con mancuerna", grupoMuscular: "Espalda", descripcion: "Tracción horizontal a una mano.", catalogoId: "0292" },
  { nombre: "Elevaciones laterales", grupoMuscular: "Hombros", descripcion: "Abducción de hombro con mancuernas.", catalogoId: "0334" },
  { nombre: "Extensión de tríceps", grupoMuscular: "Brazos", descripcion: "Extensión de codo en polea.", catalogoId: "0241" },
  { nombre: "Prensa de piernas", grupoMuscular: "Piernas", descripcion: "Empuje de piernas en máquina.", catalogoId: "0739" },
  { nombre: "Peso muerto rumano", grupoMuscular: "Piernas", descripcion: "Bisagra de cadera con piernas semirrígidas.", catalogoId: "0085" },
  { nombre: "Curl femoral", grupoMuscular: "Piernas", descripcion: "Flexión de rodilla en máquina.", catalogoId: "0586" },
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
  // Rutinas nuevas (T-S1/T-S4): pensadas para probar el tracking completo en el navegador.
  {
    nombre: "Torso B", objetivoPrincipal: "Hipertrofia", frecuenciaSemanal: 3, duracionEstimada: 55,
    nivelDeDificultad: "INTERMEDIO" as const,
    ejercicios: [
      { nombre: "Press inclinado", series: 4, repeticiones: 8, descanso: 120 },
      { nombre: "Jalón al pecho", series: 4, repeticiones: 10, descanso: 90 },
      { nombre: "Remo con mancuerna", series: 3, repeticiones: 10, descanso: 90 },
      { nombre: "Elevaciones laterales", series: 3, repeticiones: 12, descanso: 60 },
      { nombre: "Extensión de tríceps", series: 3, repeticiones: 12, descanso: 60 },
    ],
  },
  {
    nombre: "Piernas B", objetivoPrincipal: "Hipertrofia", frecuenciaSemanal: 2, duracionEstimada: 45,
    nivelDeDificultad: "BASICO" as const,
    ejercicios: [
      { nombre: "Prensa de piernas", series: 4, repeticiones: 10, descanso: 120 },
      { nombre: "Peso muerto rumano", series: 3, repeticiones: 8, descanso: 150 },
      { nombre: "Curl femoral", series: 3, repeticiones: 12, descanso: 60 },
    ],
  },
];

/** Historial de `Torso B` (T-S3): cargas por ejercicio y por sesión, en el orden de la rutina. */
const HISTORIAL_TORSO_B = [
  { dias: 21, duracion: 54, cargas: [40, 45, 24, 8, 20] },
  { dias: 14, duracion: 57, cargas: [42.5, 47.5, 26, 9, 22.5] },
  { dias: 7, duracion: 60, cargas: [45, 50, 28, 10, 25] },
];

/** Pesajes del socio 1 (T-S4): [días atrás, kg]. La meta (77 kg) se fija desde 82,4 kg. */
const PESAJES = [[35, 82.4], [28, 81.9], [21, 81.3], [14, 80.8], [7, 80.2], [2, 79.9]] as const;

type TipoSerieSeed = "NORMAL" | "CALENTAMIENTO" | "HASTA_EL_FALLO" | "DROP_SET";

interface FilaDeProgreso {
  socioId: string;
  sesionId: string;
  ejercicioId: string;
  carga: number;
  repeticiones: number;
  numeroSerie: number | null;
  rir: number | null;
  tipo: TipoSerieSeed;
  pesoCorporal: number;
  fecha: Date;
}

/**
 * Máquinas sembradas solo si la tabla está vacía (`prisma.maquina.count() === 0`). El cambio de
 * "Polea alta" a `DISPONIBLE` solo afecta bases frescas; en instalaciones ya sembradas el
 * administrador corrige la fila desde `/maquinas`.
 */
export const MAQUINAS = [
  { nombre: "Prensa de piernas", tipoEquipamiento: "MAQUINA_GUIADA" as const, estado: "DISPONIBLE" as const },
  { nombre: "Polea alta", tipoEquipamiento: "MAQUINA_GUIADA" as const, estado: "DISPONIBLE" as const },
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
  const pinHash = await opts.hash(DEFAULT_SEED_PIN);
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
  for (const { catalogoId, ...datos } of EJERCICIOS) {
    // El catálogo importado (D-70) trae la animación, el músculo y las instrucciones. Si el
    // ejercicio del seed ya existe, se le completan una vez; nunca se pisan datos cargados.
    const catalogo = catalogoId
      ? await prisma.ejercicio.findUnique({
          where: { datasetId: catalogoId },
          select: { mediaId: true, musculoObjetivo: true, instrucciones: true },
        })
      : null;
    const media = {
      mediaId: catalogo?.mediaId ?? null,
      musculoObjetivo: catalogo?.musculoObjetivo ?? null,
      instrucciones: catalogo?.instrucciones ?? [],
    };
    const existente = await prisma.ejercicio.findFirst({ where: { nombre: datos.nombre } });
    if (!existente) {
      ejercicioId[datos.nombre] = (await prisma.ejercicio.create({ data: { ...datos, ...media } })).id;
    } else {
      // Refresca la media si el catálogo cambió (p. ej. instrucciones pasadas a rioplatense): la
      // fila del seed es una copia, no la fuente. Sin catálogo no se toca nada.
      const cambio =
        Boolean(catalogo?.mediaId) &&
        (existente.mediaId !== media.mediaId ||
          existente.musculoObjetivo !== media.musculoObjetivo ||
          (existente.instrucciones ?? []).join("|") !== media.instrucciones.join("|"));
      if (cambio) await prisma.ejercicio.update({ where: { id: existente.id }, data: media });
      ejercicioId[datos.nombre] = existente.id;
    }
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
      update: { membresiaAsignadaId: membresiaId[s.plan], pinHash },
      create: { usuarioId: u.id, dni: s.dni, telefono: s.telefono, membresiaAsignadaId: membresiaId[s.plan], estadoCuota: "AL_DIA", pinHash },
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
  await prisma.medicionDePeso.deleteMany({ where: delos });

  // Socio 1 al día; socio 2 con una cuota atrasada (alerta de Home_Interno). La cuenta de ambos
  // es AL_DIA: el atraso es del PAGO calculado (D-40/D-46), nunca un estado de cuenta persistido.
  const cuotaVigente = await prisma.cuota.create({
    data: { socioId: socio1, fechaInicio: ago(10 * DAY_MS), fechaVencimiento: new Date(now.getTime() + 20 * DAY_MS), estado: "VIGENTE" },
  });
  await prisma.cuota.create({
    data: { socioId: socio2, fechaInicio: ago(45 * DAY_MS), fechaVencimiento: ago(15 * DAY_MS), estado: "VENCIDA" },
  });
  await prisma.socio.update({ where: { id: socio2 }, data: { estadoCuota: "AL_DIA" } });

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
        socioId: socio1, ejercicioId: ejercicioId["Press banca"], carga, repeticiones: 8, pesoCorporal: 78, tipo: "NORMAL" as const, fecha: ago(d * DAY_MS),
      })),
      { socioId: socio1, ejercicioId: ejercicioId["Sentadilla"], carga: 80, repeticiones: 6, pesoCorporal: 78, tipo: "NORMAL" as const, fecha: ago(12 * DAY_MS) },
    ],
  });

  // Una rutina activa para el socio 1 (RN-04) y una sesión completada de la anterior.
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

  // --- Tracking completo del socio 1 con la rutina nueva (T-S2/T-S3, D-58..D-69) ---
  // Una sola activa por socio (RN-04): se desactiva la anterior y queda `Torso B`, que ya trae
  // historial para que la pantalla de entrenamiento muestre "última vez", progresión y marcas.
  await prisma.rutinaAsignada.updateMany({
    where: { socioId: socio1, activa: true },
    data: { activa: false },
  });
  const existenteTorso = await prisma.rutinaAsignada.findFirst({
    where: { socioId: socio1, rutinaId: rutinaId["Torso B"] },
  });
  const asignacionTorso = existenteTorso
    ? await prisma.rutinaAsignada.update({
        where: { id: existenteTorso.id },
        data: { activa: true, fechaAsignacion: ago(35 * DAY_MS) },
      })
    : await prisma.rutinaAsignada.create({
        data: { socioId: socio1, rutinaId: rutinaId["Torso B"], fechaAsignacion: ago(35 * DAY_MS), activa: true },
      });

  const torsoB = RUTINAS.find((r) => r.nombre === "Torso B")!;
  for (const [n, hist] of HISTORIAL_TORSO_B.entries()) {
    const inicio = ago(hist.dias * DAY_MS);
    const sesion = await prisma.sesionDeEntrenamiento.create({
      data: {
        socioId: socio1, rutinaAsignadaId: asignacionTorso.id, horaInicio: inicio,
        horaFin: new Date(inicio.getTime() + hist.duracion * MIN_MS),
        estadoDeFinalizacion: "COMPLETADA",
      },
    });
    const ultima = n === HISTORIAL_TORSO_B.length - 1;
    const filas: FilaDeProgreso[] = torsoB.ejercicios.flatMap((e, i) =>
      Array.from({ length: e.series }, (_, s) => {
        const serie = s + 1;
        const alFallo = ultima && e.nombre === "Press inclinado" && serie === e.series;
        return {
          socioId: socio1,
          sesionId: sesion.id,
          ejercicioId: ejercicioId[e.nombre],
          carga: hist.cargas[i],
          repeticiones: e.repeticiones,
          numeroSerie: serie,
          rir: alFallo ? 0 : 2,
          tipo: alFallo ? "HASTA_EL_FALLO" : "NORMAL",
          pesoCorporal: 80.2,
          fecha: new Date(inicio.getTime() + (i * e.series + serie) * 4 * MIN_MS),
        };
      })
    );
    if (ultima) {
      // Calentamiento sin número de serie y drop set colgado de la última serie del jalón
      // (D-64/D-69): así se prueban los cuatro tipos sin cargarlos a mano.
      filas.push(
        {
          socioId: socio1, sesionId: sesion.id, ejercicioId: ejercicioId["Press inclinado"],
          carga: 20, repeticiones: 15, numeroSerie: null, rir: null,
          tipo: "CALENTAMIENTO", pesoCorporal: 80.2, fecha: inicio,
        },
        {
          socioId: socio1, sesionId: sesion.id, ejercicioId: ejercicioId["Jalón al pecho"],
          carga: 30, repeticiones: 12, numeroSerie: 4, rir: 0,
          tipo: "DROP_SET", pesoCorporal: 80.2,
          fecha: new Date(inicio.getTime() + 40 * MIN_MS),
        }
      );
    }
    await prisma.registroDeProgreso.createMany({ data: filas });
  }

  // --- Peso corporal del socio 1 (T-S4, D-65): pesajes semanales y meta en curso ---
  await prisma.medicionDePeso.createMany({
    data: PESAJES.map(([dias, peso]) => ({ socioId: socio1, peso, fecha: ago(dias * DAY_MS) })),
  });
  await prisma.socio.update({
    where: { id: socio1 },
    data: { pesoObjetivo: 77, pesoInicialDeMeta: 82.4 },
  });

  // Un pago de hoy para que la Caja de Home_Interno tenga datos.
  await prisma.pago.create({
    data: { socioId: socio1, cuotaId: cuotaVigente.id, monto: 25000, metodoPago: "TARJETA", estado: "CONFIRMADO", fechaPago: ago(60 * MIN_MS) },
  });

  return { password, usuarios };
}
