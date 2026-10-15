import { Prisma } from "@prisma/client";
import { getConfiguracion, CONFIGURACION_POR_DEFECTO, type ConfiguracionReader } from "./configuracion";

// El lector recibe el cliente (o la transacción) por parámetro: acá no se toca la base.
jest.mock("@/lib/db", () => ({ prisma: {} }));

function lector(fila: unknown): ConfiguracionReader & { findFirst: jest.Mock } {
  const findFirst = jest.fn().mockResolvedValue(fila);
  return { configuracionDelSistema: { findFirst }, findFirst } as ConfiguracionReader & { findFirst: jest.Mock };
}

describe("getConfiguracion", () => {
  it("sin fila devuelve los valores por defecto de siempre", async () => {
    expect(await getConfiguracion(lector(null))).toEqual({
      capacidadMaxima: 0,
      periodoGracia: 0,
      diasInactividad: 15,
      descuentoReactivacion: 0,
      ofertaReactivacionActiva: false,
      diasSinAsistirParaOferta: 30,
      enfriamientoOfertaDias: 180,
      ventanaAforoMinutos: 90,
      diaLimitePago: 10,
      diaCorteAltaTardia: 20,
      antiPassbackMinutos: 60,
    });
  });

  it("con fila devuelve sus valores y convierte el porcentaje Decimal a number", async () => {
    const fila = {
      capacidadMaxima: 120,
      periodoGracia: 3,
      diasInactividad: 20,
      descuentoReactivacion: new Prisma.Decimal("12.5"),
      ofertaReactivacionActiva: true,
      diasSinAsistirParaOferta: 45,
      enfriamientoOfertaDias: 90,
      ventanaAforoMinutos: 45,
      diaLimitePago: 8,
      diaCorteAltaTardia: 25,
      antiPassbackMinutos: 30,
    };
    const config = await getConfiguracion(lector(fila));
    expect(config).toEqual({ ...fila, descuentoReactivacion: 12.5 });
    expect(typeof config.descuentoReactivacion).toBe("number");
  });

  it("si a la fila le falta un campo, ese campo usa su valor por defecto", async () => {
    const config = await getConfiguracion(lector({ capacidadMaxima: 100, ventanaAforoMinutos: 30 }));
    expect(config.capacidadMaxima).toBe(100);
    expect(config.ventanaAforoMinutos).toBe(30);
    expect(config.diaLimitePago).toBe(10);
    expect(config.antiPassbackMinutos).toBe(60);
  });

  it("hoy la fila no trae los campos de la oferta (T-045b los agrega): oferta apagada, 30 y 180 días", async () => {
    const config = await getConfiguracion(lector({ capacidadMaxima: 100, diaLimitePago: 8 }));
    expect(config.ofertaReactivacionActiva).toBe(false);
    expect(config.diasSinAsistirParaOferta).toBe(30);
    expect(config.enfriamientoOfertaDias).toBe(180);
  });

  it("un valor 0 de la fila no se confunde con 'falta' (periodoGracia 0, capacidad 0)", async () => {
    const config = await getConfiguracion(lector({ periodoGracia: 0, diasInactividad: 15, diaLimitePago: 0 }));
    expect(config.periodoGracia).toBe(0);
    expect(config.diaLimitePago).toBe(0);
  });

  it("siempre toma la fila más reciente y hace una sola consulta", async () => {
    const db = lector(null);
    await getConfiguracion(db);
    expect(db.findFirst).toHaveBeenCalledTimes(1);
    expect(db.findFirst).toHaveBeenCalledWith({ orderBy: { updatedAt: "desc" } });
  });

  it("devuelve un objeto nuevo: modificarlo no cambia los valores por defecto", async () => {
    const a = await getConfiguracion(lector(null));
    a.diaLimitePago = 99;
    expect((await getConfiguracion(lector(null))).diaLimitePago).toBe(10);
    expect(CONFIGURACION_POR_DEFECTO.diaLimitePago).toBe(10);
    expect(Object.isFrozen(CONFIGURACION_POR_DEFECTO)).toBe(true);
  });
});
