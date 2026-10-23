import { buildHomeSocioPayload } from "./home-socio-data";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    socio: { findUnique: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
    asistencia: { findMany: jest.fn(), findFirst: jest.fn() },
    registroDeProgreso: { findMany: jest.fn() },
    reglaDeProgresion: { findFirst: jest.fn() },
    rutinaAsignada: { findMany: jest.fn() },
    sesionDeEntrenamiento: { findFirst: jest.fn(), findMany: jest.fn() },
    pago: { findFirst: jest.fn() },
    medicionDePeso: { findMany: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Miércoles 07/10/2026 12:00 en Argentina (UTC-3)
const NOW = new Date("2026-10-07T15:00:00Z");
const dec = (n: number) => ({ toString: () => n.toFixed(2) }); // imita Prisma.Decimal
const at = (iso: string) => new Date(iso);

const SOCIO = {
  id: "socio-1",
  estadoCuota: "AL_DIA",
  fechaAlta: at("2025-01-01T12:00:00Z"),
  membresiaAsignada: { nombre: "Premium", periodicidad: 30 },
  cuotas: [{ fechaVencimiento: at("2026-10-20T03:00:00Z") }],
};

/** Fila de `RegistroDeProgreso` tal como la leen la ventana del Home y el motor (D-60). */
interface FilaHistorial {
  carga: number;
  repeticiones: number;
  fecha: string;
  sesionId: string;
  numeroSerie: number;
}

/** Press banca (e1) pide 3×10. Sesión vieja a 60 kg y sesión del 5/10 con las 3 series a 65 kg × 10. */
const HISTORIAL_PRESS: FilaHistorial[] = [
  { carga: 60, repeticiones: 10, fecha: "2026-09-22T15:00:00Z", sesionId: "s0", numeroSerie: 1 },
  { carga: 65, repeticiones: 10, fecha: "2026-10-05T15:00:00Z", sesionId: "sA", numeroSerie: 1 },
  { carga: 65, repeticiones: 10, fecha: "2026-10-05T15:05:00Z", sesionId: "sA", numeroSerie: 2 },
  { carga: 65, repeticiones: 10, fecha: "2026-10-05T15:10:00Z", sesionId: "sA", numeroSerie: 3 },
];

function seed(historial: FilaHistorial[] = HISTORIAL_PRESS) {
  db.socio.findUnique.mockResolvedValue(SOCIO);
  db.medicionDePeso.findMany.mockResolvedValue([]);
  db.sesionDeEntrenamiento.findMany.mockResolvedValue([]);
  db.configuracionDelSistema.findFirst.mockResolvedValue({ capacidadMaxima: 50, ventanaAforoMinutos: 90 });
  db.asistencia.findMany.mockImplementation(async (args: { where: { socioId?: string } }) =>
    args.where.socioId
      ? [
          // fechas del socio (hora Argentina): mié 7/10, lun 5/10, jue 1/10, mar 22/9
          { fechaHora: at("2026-10-07T13:00:00Z") },
          { fechaHora: at("2026-10-05T13:00:00Z") },
          { fechaHora: at("2026-10-01T13:00:00Z") },
          { fechaHora: at("2026-09-22T13:00:00Z") },
        ]
      : [
          // asistencias del gimnasio (todas las personas)
          { fechaHora: at("2026-10-07T14:00:00Z") }, // 11:00 → dentro de la ventana
          { fechaHora: at("2026-10-07T14:30:00Z") }, // 11:30 → dentro
          { fechaHora: at("2026-10-07T12:00:00Z") }, // 09:00 → hoy, fuera de la ventana
          { fechaHora: at("2026-10-06T20:00:00Z") }, // ayer
        ]
  );
  // Dos consultas distintas al mismo modelo: la ventana de 28 días del Home (trae el ejercicio) y,
  // por ejercicio, el historial que lee el motor de progresión (trae sesión y número de serie).
  db.registroDeProgreso.findMany.mockImplementation(async (args: { where: { ejercicioId?: string } }) => {
    if (args.where.ejercicioId) {
      return args.where.ejercicioId === "e1"
        ? [...historial].reverse().map((h) => ({
            carga: dec(h.carga),
            repeticiones: h.repeticiones,
            rir: null,
            numeroSerie: h.numeroSerie,
            fecha: at(h.fecha),
            sesionId: h.sesionId,
          }))
        : [];
    }
    return historial.map((h) => ({
      carga: dec(h.carga),
      fecha: at(h.fecha),
      ejercicio: { id: "e1", nombre: "Press banca" },
    }));
  });
  db.reglaDeProgresion.findFirst.mockResolvedValue({ incrementoSugerido: dec(5) });
  db.rutinaAsignada.findMany.mockResolvedValue([
    {
      id: "ra1",
      fechaAsignacion: at("2026-09-01T15:00:00Z"),
      rutinaId: "r1",
      rutina: {
        nombre: "Fuerza A",
        ejercicios: [
          { series: 3, repeticiones: 10, descanso: 120, updatedAt: at("2026-09-01T15:00:00Z"), ejercicio: { id: "e1", nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Con barra" } },
          { series: 4, repeticiones: 8, descanso: 90, updatedAt: at("2026-09-01T15:00:00Z"), ejercicio: { id: "e2", nombre: "Remo", grupoMuscular: "Espalda", descripcion: null } },
        ],
      },
    },
  ]);
  db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s1" });
}

describe("buildHomeSocioPayload", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("devuelve null si el usuario no tiene perfil de socio", async () => {
    db.socio.findUnique.mockResolvedValue(null);
    expect(await buildHomeSocioPayload("u-staff", NOW)).toBeNull();
    expect(db.socio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: "u-staff" } })
    );
  });

  it("aforo: mismo cálculo que Home_Interno (AC-005)", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.aforo).toMatchObject({ ocupacionActual: 2, capacidadMaxima: 50, horaActual: 12 });
    const barra = (h: number) => res?.aforo.horas.find((x) => x.hora === h)?.ocupacion;
    expect(barra(10)).toBe(2);
    expect(barra(8)).toBe(1);
  });

  it("racha semanal sobre semana calendario Lun–Dom en hora Argentina (AC-006)", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.racha.semanasRacha).toBe(3);
    expect(res?.racha.dias.map((d) => d.numero)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(res?.racha.dias.map((d) => d.asistio)).toEqual([true, false, true, false, false, false, false]);
    expect(res?.racha.dias[2].esHoy).toBe(true);
  });

  it("membresía: plan, vencimiento y grilla de 28 días", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.membresia).toMatchObject({
      planNombre: "Premium",
      fechaVencimiento: "2026-10-20T03:00:00.000Z",
      diasTotalMembresia: 30,
      totalAsistencias28Dias: 4,
    });
    expect(res?.membresia?.dias28).toHaveLength(28);
    expect(res?.membresia?.dias28.filter(Boolean)).toHaveLength(4);
  });

  describe("progreso: la sugerencia sale del motor de progresión (P-42, D-60)", () => {
    it("completó todas las series: sube con el incremento de la regla configurada", async () => {
      seed();
      const res = await buildHomeSocioPayload("u1", NOW);

      expect(res?.progreso).toMatchObject({
        ejercicioNombre: "Press banca",
        marcaActual: 65,
        deltaEsteMes: 5,
        sugerencia: { tipo: "subir", carga: 70 },
      });
      expect(res?.progreso).not.toHaveProperty("proximaSesionSugerida");
      // El id interno del ejercicio no viaja al cliente.
      expect(res?.progreso).not.toHaveProperty("ejercicioId");
    });

    it("una serie quedó corta: mantiene el peso (el Home ya NO dice 'marca + incremento')", async () => {
      seed([
        { carga: 65, repeticiones: 10, fecha: "2026-10-05T15:00:00Z", sesionId: "sA", numeroSerie: 1 },
        { carga: 65, repeticiones: 10, fecha: "2026-10-05T15:05:00Z", sesionId: "sA", numeroSerie: 2 },
        { carga: 65, repeticiones: 7, fecha: "2026-10-05T15:10:00Z", sesionId: "sA", numeroSerie: 3 },
      ]);
      const res = await buildHomeSocioPayload("u1", NOW);

      expect(res?.progreso?.marcaActual).toBe(65);
      expect(res?.progreso?.sugerencia).toMatchObject({ tipo: "mantener", carga: 65 });
    });

    it("tres sesiones seguidas sin llegar a las repeticiones: sugiere descargar", async () => {
      const sesion = (id: string, dia: string) =>
        [1, 2, 3].map((n) => ({
          carga: 65,
          repeticiones: n === 3 ? 6 : 10,
          fecha: `2026-10-${dia}T15:0${n}:00Z`,
          sesionId: id,
          numeroSerie: n,
        }));
      seed([...sesion("sA", "01"), ...sesion("sB", "03"), ...sesion("sC", "05")]);
      const res = await buildHomeSocioPayload("u1", NOW);

      // 10 % menos de 65 son 58,5, redondeado a un múltiplo del incremento de la regla (5 kg) = 60.
      expect(res?.progreso?.sugerencia).toMatchObject({ tipo: "descargar", carga: 60 });
    });

    it("el ejercicio ya no está en la rutina activa: sin sugerencia (no hay qué juzgar)", async () => {
      seed();
      db.rutinaAsignada.findMany.mockResolvedValue([
        {
          id: "ra1",
          fechaAsignacion: at("2026-09-01T15:00:00Z"),
          rutinaId: "r1",
          rutina: {
            nombre: "Fuerza A",
            ejercicios: [
              { series: 4, repeticiones: 8, descanso: 90, updatedAt: at("2026-09-01T15:00:00Z"), ejercicio: { id: "e2", nombre: "Remo", grupoMuscular: "Espalda", descripcion: null } },
            ],
          },
        },
      ]);
      const res = await buildHomeSocioPayload("u1", NOW);

      expect(res?.progreso?.ejercicioNombre).toBe("Press banca");
      expect(res?.progreso?.sugerencia).toBeNull();
    });

    it("la sesión en curso no cuenta: una serie floja de hoy no cambia la sugerencia", async () => {
      seed([
        ...HISTORIAL_PRESS,
        // Serie de la sesión EN_CURSO (id "s1" en el mock): no es historial.
        { carga: 40, repeticiones: 3, fecha: "2026-10-07T14:00:00Z", sesionId: "s1", numeroSerie: 1 },
      ]);
      const res = await buildHomeSocioPayload("u1", NOW);

      expect(res?.progreso?.sugerencia).toMatchObject({ tipo: "subir", carga: 70 });
    });
  });

  it("rutina activa con ejercicios en orden y sesión en progreso", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.rutinaActiva?.nombre).toBe("Fuerza A");
    expect(res?.rutinaActiva?.rutinaAsignadaId).toBe("ra1");
    expect(res?.rutinaActiva?.indiceActual).toBe(0);
    expect(res?.rutinaActiva?.ejercicios.map((e) => e.nombre)).toEqual(["Press banca", "Remo"]);
    expect(res?.rutinaActiva?.ejercicios[0]).toEqual({
      id: "e1", nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Con barra",
      series: 3, repeticiones: 10, descanso: 120,
    });
    expect(res?.sesionEnProgreso).toBe(true);
  });

  // SE-4: con una sesión EN_CURSO, el índice actual sale del `ejercicioActualId` para
  // reanudar donde quedó el socio (no siempre 0).
  it("con sesión EN_CURSO: indiceActual sale de ejercicioActualId", async () => {
    seed();
    db.sesionDeEntrenamiento.findFirst.mockResolvedValue({
      id: "s1",
      ejercicioActualId: "e2",
    });

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.sesionEnProgreso).toBe(true);
    expect(res?.rutinaActiva?.indiceActual).toBe(1);
  });

  it("sin sesión EN_CURSO: indiceActual 0 y sesionEnProgreso false", async () => {
    seed();
    db.sesionDeEntrenamiento.findFirst.mockResolvedValue(null);

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.sesionEnProgreso).toBe(false);
    expect(res?.rutinaActiva?.indiceActual).toBe(0);
  });

  it("todas las consultas del socio van filtradas por su socioId", async () => {
    seed();
    await buildHomeSocioPayload("u1", NOW);
    for (const m of [db.registroDeProgreso.findMany, db.rutinaAsignada.findMany, db.sesionDeEntrenamiento.findFirst]) {
      expect(m.mock.calls[0][0].where.socioId).toBe("socio-1");
    }
    expect(db.rutinaAsignada.findMany.mock.calls[0][0].where.activa).toBe(true);
    const socioCall = db.asistencia.findMany.mock.calls.find((c: [{ where: { socioId?: string } }]) => c[0].where.socioId);
    expect(socioCall[0].where).toMatchObject({ socioId: "socio-1", estado: "PERMITIDO" });
  });

  it("D-64: la ventana de progreso del Home excluye los calentamientos", async () => {
    seed();
    await buildHomeSocioPayload("u1", NOW);

    // La consulta de la ventana es la que no filtra por ejercicio (la otra la hace el motor).
    const ventana = db.registroDeProgreso.findMany.mock.calls
      .map((c: [{ where: Record<string, unknown> }]) => c[0])
      .find((arg: { where: Record<string, unknown> }) => arg.where.ejercicioId === undefined);
    expect(ventana.where).toMatchObject({ tipo: { not: "CALENTAMIENTO" } });
  });

  it("estados vacíos: sin rutina, sin progreso, sin membresía ni cuota", async () => {
    seed();
    db.socio.findUnique.mockResolvedValue({ id: "socio-1", membresiaAsignada: null, cuotas: [] });
    db.registroDeProgreso.findMany.mockResolvedValue([]);
    db.rutinaAsignada.findMany.mockResolvedValue([]);
    db.sesionDeEntrenamiento.findFirst.mockResolvedValue(null);
    db.reglaDeProgresion.findFirst.mockResolvedValue(null);

    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res).toMatchObject({ progreso: null, rutinaActiva: null, membresia: null, sesionEnProgreso: false });
  });

  it("oferta: null y sin consultar asistencia/pago de la oferta cuando está apagada (D-54)", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.oferta).toBeNull();
    expect(db.asistencia.findFirst).not.toHaveBeenCalled();
    expect(db.pago.findFirst).not.toHaveBeenCalled();
  });

  it("oferta: el socio vencido que dejó de venir recibe el aviso (D-54)", async () => {
    seed();
    db.configuracionDelSistema.findFirst.mockResolvedValue({
      capacidadMaxima: 50,
      ventanaAforoMinutos: 90,
      ofertaReactivacionActiva: true,
      diasSinAsistirParaOferta: 30,
      descuentoReactivacion: 10,
      enfriamientoOfertaDias: 180,
    });
    db.socio.findUnique.mockResolvedValue({
      ...SOCIO,
      cuotas: [{ fechaVencimiento: at("2026-08-31T03:00:00Z") }], // agosto: VENCIDA en octubre
    });
    db.asistencia.findFirst.mockResolvedValue({ fechaHora: at("2026-08-01T13:00:00Z") }); // 60 días sin venir
    db.pago.findFirst.mockResolvedValue(null);

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.oferta).toEqual({ descuentoPct: 10 });
    expect(db.asistencia.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estado: "PERMITIDO" },
      orderBy: { fechaHora: "desc" },
      select: { fechaHora: true },
    });
    expect(db.pago.findFirst).toHaveBeenCalledWith({
      where: {
        socioId: "socio-1",
        estado: { in: ["CONFIRMADO", "ANULADO"] },
        descuentoPct: { not: null },
      },
      orderBy: { fechaPago: "desc" },
      select: { fechaPago: true },
    });
  });

  it("oferta: sin aviso cuando el socio sigue viniendo (actividad reciente, D-54)", async () => {
    seed();
    db.configuracionDelSistema.findFirst.mockResolvedValue({
      capacidadMaxima: 50,
      ventanaAforoMinutos: 90,
      ofertaReactivacionActiva: true,
      diasSinAsistirParaOferta: 30,
      descuentoReactivacion: 10,
      enfriamientoOfertaDias: 180,
    });
    db.socio.findUnique.mockResolvedValue({
      ...SOCIO,
      cuotas: [{ fechaVencimiento: at("2026-08-31T03:00:00Z") }],
    });
    db.asistencia.findFirst.mockResolvedValue({ fechaHora: at("2026-10-05T13:00:00Z") }); // hace 2 días
    db.pago.findFirst.mockResolvedValue(null);

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.oferta).toBeNull();
  });

  it("sin configuración del sistema: capacidad 0 en vez de romper", async () => {
    seed();
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.aforo.capacidadMaxima).toBe(0);
  });

  it("más de una rutina activa (RN-04): usa la más antigua y avisa (AC-002)", async () => {
    seed();
    db.rutinaAsignada.findMany.mockResolvedValue([
      { id: "ra2", fechaAsignacion: at("2026-09-20T15:00:00Z"), rutinaId: "r2", rutina: { nombre: "Nueva", ejercicios: [] } },
      { id: "ra1", fechaAsignacion: at("2026-09-01T15:00:00Z"), rutinaId: "r1", rutina: { nombre: "Vieja", ejercicios: [] } },
    ]);
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.rutinaActiva?.nombre).toBe("Vieja");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("ROUTINE_INTEGRITY_ERROR"), expect.anything());
  });
});

describe("buildHomeSocioPayload: peso corporal (T-048 parte 2, D-66; P-47, D-68)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin pesajes ni meta: mediciones vacías y meta nula", async () => {
    seed();

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.peso).toEqual({ mediciones: [], pesoObjetivo: null, pesoInicial: null });
  });

  it("lee los pesajes del propio socio, con su id, los más recientes primero y con un tope", async () => {
    seed();

    await buildHomeSocioPayload("u1", NOW);

    expect(db.medicionDePeso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { socioId: "socio-1" },
        orderBy: { fecha: "desc" },
        take: 400,
        select: { id: true, peso: true, fecha: true },
      })
    );
  });

  it("entrega las mediciones del más antiguo al más reciente, con su id y el peso como número", async () => {
    seed();
    db.medicionDePeso.findMany.mockResolvedValue([
      // La base los entrega del más nuevo al más viejo.
      { id: "m3", peso: dec(78.4), fecha: at("2026-10-05T22:00:00Z") },
      { id: "m2", peso: dec(79.1), fecha: at("2026-10-05T12:00:00Z") },
      { id: "m1", peso: dec(80), fecha: at("2026-09-28T12:00:00Z") },
    ]);

    const res = await buildHomeSocioPayload("u1", NOW);

    // Van TODAS, también las del mismo día: la tarjeta necesita el id de cada una para poder borrarla y
    // decide cuál dibujar (el último de cada día) con la misma regla del servidor.
    expect(res?.peso.mediciones).toEqual([
      { id: "m1", fecha: "2026-09-28T12:00:00.000Z", peso: 80 },
      { id: "m2", fecha: "2026-10-05T12:00:00.000Z", peso: 79.1 },
      { id: "m3", fecha: "2026-10-05T22:00:00.000Z", peso: 78.4 },
    ]);
  });

  it("trae la meta y el peso desde el que se fijó, como números", async () => {
    seed();
    db.socio.findUnique.mockResolvedValue({ ...SOCIO, pesoObjetivo: dec(77), pesoInicialDeMeta: dec(78.4) });

    const res = await buildHomeSocioPayload("u1", NOW);

    expect(res?.peso.pesoObjetivo).toBe(77);
    expect(res?.peso.pesoInicial).toBe(78.4);
    expect(db.socio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ pesoObjetivo: true, pesoInicialDeMeta: true }),
      })
    );
  });
});

