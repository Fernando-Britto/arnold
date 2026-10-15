/**
 * Consulta de la oferta de reactivación (T-045c, D-54): los dos `findFirst` a la base.
 * Spec: openspec/specs/oferta-reactivacion/spec.md
 *
 * El filtro de asistencia (solo `PERMITIDO`) es el que fija la spec: un ingreso autorizado por
 * excepción cuenta y un `DENEGADO` no, por eso el `DENEGADO` ni se consulta. Se espía la función
 * pura `evaluarOferta` para verificar el mapeo exacto de las filas a su entrada.
 */
import * as ofertaMod from "./oferta-reactivacion";
import { evaluarOfertaDeSocio, type OfertaReader } from "./oferta-reactivacion-consulta";

const DIA_MS = 24 * 60 * 60 * 1000;
const HOY = new Date("2026-11-20T15:00:00-03:00");
const hace = (dias: number) => new Date(HOY.getTime() - dias * DIA_MS);

const CONFIG = {
  ofertaReactivacionActiva: true,
  diasSinAsistirParaOferta: 30,
  descuentoReactivacion: 10,
  enfriamientoOfertaDias: 180,
};

const CONTEXTO = {
  estadoCuenta: "AL_DIA" as const,
  tieneMembresia: true,
  estadoPago: "VENCIDA" as const,
  fechaAlta: hace(400),
};

function fakeReader() {
  const asistencia = { findFirst: jest.fn().mockResolvedValue(null) };
  const pago = { findFirst: jest.fn().mockResolvedValue(null) };
  const reader = { asistencia, pago } as unknown as OfertaReader;
  return { reader, asistencia, pago };
}

describe("evaluarOfertaDeSocio — consultas a la base", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    spy = jest.spyOn(ofertaMod, "evaluarOferta");
  });
  afterEach(() => spy.mockRestore());

  it("con la oferta apagada no consulta la base y devuelve OFERTA_APAGADA", async () => {
    const { reader, asistencia, pago } = fakeReader();

    const r = await evaluarOfertaDeSocio(
      reader,
      "socio-1",
      { ...CONFIG, ofertaReactivacionActiva: false },
      CONTEXTO,
      HOY
    );

    expect(r).toEqual({ elegible: false, motivo: "OFERTA_APAGADA" });
    // El cobro, con la oferta apagada, no paga dos lecturas de más en su transacción.
    expect(asistencia.findFirst).not.toHaveBeenCalled();
    expect(pago.findFirst).not.toHaveBeenCalled();
  });

  it("usa la última asistencia PERMITIDO y no consulta las DENEGADO", async () => {
    const { reader, asistencia } = fakeReader();
    asistencia.findFirst.mockResolvedValue({ fechaHora: hace(31) });

    const r = await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    expect(asistencia.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estado: "PERMITIDO" },
      orderBy: { fechaHora: "desc" },
      select: { fechaHora: true },
    });
    expect(JSON.stringify(asistencia.findFirst.mock.calls)).not.toContain("DENEGADO");
    expect(r).toEqual({ elegible: true, descuentoPct: 10 });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ultimaAsistenciaPermitida: hace(31) })
    );
  });

  it("sin fila de asistencia mapea ultimaAsistenciaPermitida a null", async () => {
    const { reader, asistencia } = fakeReader();
    asistencia.findFirst.mockResolvedValue(null);

    const r = await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    // fechaAlta es vieja: con la referencia en null se mide desde el alta y sigue siendo elegible.
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ultimaAsistenciaPermitida: null })
    );
    expect(r).toEqual({ elegible: true, descuentoPct: 10 });
  });

  it("el filtro de pago exige un pago con descuento CONFIRMADO o ANULADO (P-39)", async () => {
    const { reader, pago } = fakeReader();

    await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    expect(pago.findFirst).toHaveBeenCalledWith({
      where: {
        socioId: "socio-1",
        estado: { in: ["CONFIRMADO", "ANULADO"] },
        descuentoPct: { not: null },
      },
      orderBy: { fechaPago: "desc" },
      select: { fechaPago: true },
    });
  });

  it("un pago con descuento ya ANULADO sigue dejando al socio en enfriamiento (la oferta no vuelve)", async () => {
    const { reader, pago } = fakeReader();
    // El pago anulado conserva su fechaPago y descuentoPct, así que la consulta lo ve.
    pago.findFirst.mockResolvedValue({ fechaPago: hace(100) });

    const r = await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    expect(r).toEqual({ elegible: false, motivo: "EN_ENFRIAMIENTO" });
  });

  it("un pago CONFIRMADO con descuento reciente deja al socio en enfriamiento", async () => {
    const { reader, pago } = fakeReader();
    pago.findFirst.mockResolvedValue({ fechaPago: hace(100) });

    const r = await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ultimoPagoConDescuento: hace(100) })
    );
    expect(r).toEqual({ elegible: false, motivo: "EN_ENFRIAMIENTO" });
  });

  it("sin pago con descuento (o pago ya viejo) mapea null y no bloquea", async () => {
    const { reader, pago } = fakeReader();
    pago.findFirst.mockResolvedValue(null);

    const r = await evaluarOfertaDeSocio(reader, "socio-1", CONFIG, CONTEXTO, HOY);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ ultimoPagoConDescuento: null }));
    expect(r).toEqual({ elegible: true, descuentoPct: 10 });
  });
});
