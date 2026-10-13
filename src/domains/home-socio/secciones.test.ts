import {
  computeMejoresMarcas,
  computeProgresoPorEjercicio,
  buildCalendarioAsistencias,
  resumirMembresia,
  resumirSesiones,
  type RegistroProgresoRef,
} from "./secciones";

const at = (iso: string) => new Date(iso);
const reg = (ejercicioId: string, ejercicioNombre: string, carga: number, fecha: string, repeticiones = 8): RegistroProgresoRef => ({
  ejercicioId,
  ejercicioNombre,
  carga,
  repeticiones,
  fecha: at(fecha),
});

describe("computeMejoresMarcas (T-039 §Mis ejercicios: mejor marca por ejercicio)", () => {
  it("devuelve la carga máxima por ejercicio", () => {
    const marcas = computeMejoresMarcas([
      reg("e1", "Press banca", 60, "2026-10-01T13:00:00Z"),
      reg("e1", "Press banca", 80, "2026-10-05T13:00:00Z"),
      reg("e2", "Remo", 50, "2026-10-02T13:00:00Z"),
    ]);
    expect(marcas.get("e1")).toBe(80);
    expect(marcas.get("e2")).toBe(50);
  });

  it("sin registros devuelve un mapa vacío", () => {
    expect(computeMejoresMarcas([]).size).toBe(0);
  });
});

describe("computeProgresoPorEjercicio (T-039 §Progreso: cargas en el tiempo)", () => {
  const HOY = at("2026-10-07T15:00:00Z");

  it("un punto por día del gimnasio con la mayor carga, en orden cronológico", () => {
    const res = computeProgresoPorEjercicio(
      [
        reg("e1", "Press banca", 60, "2026-10-05T13:00:00Z"),
        reg("e1", "Press banca", 65, "2026-10-05T20:00:00Z"), // mismo día: gana 65
        reg("e1", "Press banca", 70, "2026-10-06T13:00:00Z"),
      ],
      HOY
    );
    expect(res).toHaveLength(1);
    expect(res[0].ejercicioNombre).toBe("Press banca");
    expect(res[0].serie).toEqual([
      { fecha: "2026-10-05", carga: 65 },
      { fecha: "2026-10-06", carga: 70 },
    ]);
    expect(res[0].mejorMarca).toBe(70);
    expect(res[0].delta).toBe(5);
  });

  it("separa por ejercicio y ordena por nombre", () => {
    const res = computeProgresoPorEjercicio(
      [
        reg("e2", "Remo", 50, "2026-10-05T13:00:00Z"),
        reg("e1", "Press banca", 60, "2026-10-05T13:00:00Z"),
      ],
      HOY
    );
    expect(res.map((r) => r.ejercicioNombre)).toEqual(["Press banca", "Remo"]);
  });

  it("ignora registros fuera de la ventana", () => {
    const res = computeProgresoPorEjercicio([reg("e1", "Press banca", 60, "2026-01-01T13:00:00Z")], HOY);
    expect(res).toEqual([]);
  });

  it("sin registros devuelve un arreglo vacío", () => {
    expect(computeProgresoPorEjercicio([], HOY)).toEqual([]);
  });
});

describe("buildCalendarioAsistencias (T-039 §Mis asistencias: calendario)", () => {
  const HOY = at("2026-10-07T15:00:00Z"); // miércoles

  it("devuelve la ventana de días terminando hoy, con asistio y total", () => {
    const res = buildCalendarioAsistencias(
      [at("2026-10-05T13:00:00Z"), at("2026-10-07T13:00:00Z")],
      HOY,
      5
    );
    expect(res.dias.map((d) => d.fecha)).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(res.dias.map((d) => d.asistio)).toEqual([false, false, true, false, true]);
    expect(res.total).toBe(2);
  });

  it("cuenta varias visitas del mismo día una sola vez", () => {
    const res = buildCalendarioAsistencias(
      [at("2026-10-07T08:00:00Z"), at("2026-10-07T18:00:00Z")],
      HOY,
      3
    );
    expect(res.total).toBe(1);
  });

  it("ignora asistencias anteriores a la ventana", () => {
    const res = buildCalendarioAsistencias([at("2026-09-01T13:00:00Z")], HOY, 5);
    expect(res.total).toBe(0);
  });

  it("sin asistencias devuelve la ventana vacía", () => {
    const res = buildCalendarioAsistencias([], HOY, 4);
    expect(res.dias).toHaveLength(4);
    expect(res.total).toBe(0);
  });
});

describe("resumirMembresia (T-039 §Mis pagos: historial + estado calculado, D-40)", () => {
  const HOY = at("2026-10-07T15:00:00Z"); // período 2026-10, límite día 10
  const pago = (id: string, monto: number, fechaPago: string, vencimiento: string | null) => ({
    id,
    fechaPago: at(fechaPago),
    monto,
    metodoPago: "EFECTIVO",
    cuota: vencimiento ? { fechaVencimiento: at(vencimiento) } : null,
  });

  it("AL_DIA cuando el mes actual está cubierto", () => {
    const res = resumirMembresia({
      pagos: [pago("p1", 100, "2026-10-02T13:00:00Z", "2026-10-31T23:59:59.999-03:00")],
      ultimaCuota: { fechaVencimiento: at("2026-10-31T23:59:59.999-03:00") },
      hoy: HOY,
      diaLimite: 10,
    });
    expect(res.estado).toBe("AL_DIA");
    expect(res.ultimoPeriodoCubierto).toBe("2026-10");
    expect(res.fechaVencimiento).toBe("2026-11-01T02:59:59.999Z");
  });

  it("PENDIENTE dentro del plazo (día límite)", () => {
    const res = resumirMembresia({
      pagos: [],
      ultimaCuota: { fechaVencimiento: at("2026-09-30T23:59:59.999-03:00") },
      hoy: HOY,
      diaLimite: 10,
    });
    expect(res.estado).toBe("PENDIENTE");
    expect(res.ultimoPeriodoCubierto).toBe("2026-09");
  });

  it("VENCIDA pasado el plazo", () => {
    const res = resumirMembresia({
      pagos: [],
      ultimaCuota: { fechaVencimiento: at("2026-09-30T23:59:59.999-03:00") },
      hoy: at("2026-10-15T15:00:00Z"),
      diaLimite: 10,
    });
    expect(res.estado).toBe("VENCIDA");
  });

  it("SIN_CUOTA sin cuotas registradas", () => {
    const res = resumirMembresia({ pagos: [], ultimaCuota: null, hoy: HOY, diaLimite: 10 });
    expect(res.estado).toBe("SIN_CUOTA");
    expect(res.ultimoPeriodoCubierto).toBeNull();
    expect(res.fechaVencimiento).toBeNull();
  });

  it("mapea el historial con su período (o null si el pago no tiene cuota)", () => {
    const res = resumirMembresia({
      pagos: [
        pago("p2", 120, "2026-10-02T13:00:00Z", "2026-10-31T23:59:59.999-03:00"),
        pago("p1", 100, "2026-09-02T13:00:00Z", null),
      ],
      ultimaCuota: { fechaVencimiento: at("2026-10-31T23:59:59.999-03:00") },
      hoy: HOY,
      diaLimite: 10,
    });
    expect(res.historial).toEqual([
      { id: "p2", fechaPago: "2026-10-02T13:00:00.000Z", monto: 120, metodoPago: "EFECTIVO", periodo: "2026-10" },
      { id: "p1", fechaPago: "2026-09-02T13:00:00.000Z", monto: 100, metodoPago: "EFECTIVO", periodo: null },
    ]);
  });
});

describe("resumirSesiones (T-039 §Mi rutina: historial de sesiones)", () => {
  it("calcula la duración y deja null si sigue en curso", () => {
    const res = resumirSesiones([
      { id: "s1", horaInicio: at("2026-10-06T13:00:00Z"), horaFin: at("2026-10-06T14:05:00Z"), estado: "COMPLETADA" },
      { id: "s2", horaInicio: at("2026-10-07T13:00:00Z"), horaFin: null, estado: "EN_CURSO" },
    ]);
    expect(res[0]).toMatchObject({ id: "s1", estado: "COMPLETADA", duracionMin: 65 });
    expect(res[1]).toMatchObject({ id: "s2", estado: "EN_CURSO", duracionMin: null, horaFin: null });
  });
});
