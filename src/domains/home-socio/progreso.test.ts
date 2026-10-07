import { computeProgresoActual, DEFAULT_INCREMENTO_KG } from "./home-socio";

const HOY = new Date("2026-10-07T15:00:00Z"); // 12:00 en Argentina
const reg = (ejercicioId: string, nombre: string, carga: number, iso: string) => ({
  ejercicioId,
  ejercicioNombre: nombre,
  carga,
  fecha: new Date(iso),
});

describe("computeProgresoActual", () => {
  it("devuelve null sin registros en las últimas 4 semanas", () => {
    expect(computeProgresoActual([], HOY, 2.5)).toBeNull();
    expect(
      computeProgresoActual([reg("e1", "Press banca", 60, "2026-08-01T15:00:00Z")], HOY, 2.5)
    ).toBeNull();
  });

  it("toma el ejercicio del registro más reciente y su mejor carga por día", () => {
    const res = computeProgresoActual(
      [
        reg("e2", "Sentadilla", 100, "2026-09-20T15:00:00Z"),
        reg("e1", "Press banca", 55, "2026-09-15T15:00:00Z"),
        reg("e1", "Press banca", 60, "2026-09-22T15:00:00Z"),
        reg("e1", "Press banca", 57.5, "2026-09-22T16:00:00Z"), // mismo día: gana la mayor
        reg("e1", "Press banca", 65, "2026-10-05T15:00:00Z"),
      ],
      HOY,
      2.5
    );

    expect(res).toEqual({
      ejercicioNombre: "Press banca",
      marcaActual: 65,
      deltaEsteMes: 10,
      progresionCarga: [
        { fecha: "2026-09-15", carga: 55 },
        { fecha: "2026-09-22", carga: 60 },
        { fecha: "2026-10-05", carga: 65 },
      ],
      proximaSesionSugerida: 67.5,
    });
  });

  it("un solo punto: delta 0", () => {
    const res = computeProgresoActual([reg("e1", "Remo", 40, "2026-10-01T15:00:00Z")], HOY, 2.5);
    expect(res?.deltaEsteMes).toBe(0);
    expect(res?.marcaActual).toBe(40);
  });

  it("agrupa el día según la hora del gimnasio (UTC-3), no UTC", () => {
    // 01:30Z del 6/10 = 22:30 del 5/10 en Argentina
    const res = computeProgresoActual([reg("e1", "Remo", 40, "2026-10-06T01:30:00Z")], HOY, 2.5);
    expect(res?.progresionCarga[0].fecha).toBe("2026-10-05");
  });

  it("expone el incremento por defecto", () => {
    expect(DEFAULT_INCREMENTO_KG).toBe(2.5);
  });
});
