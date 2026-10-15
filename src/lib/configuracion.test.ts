import { Prisma } from "@prisma/client";
import {
  getConfiguracion,
  actualizarConfiguracion,
  CONFIGURACION_POR_DEFECTO,
  type ConfiguracionReader,
} from "./configuracion";

// El lector recibe el cliente (o la transacción) por parámetro: acá no se toca la base.
// `actualizarConfiguracion` importa Prisma en forma diferida; el mock entrega la transacción armada.
const mockTx = {
  configuracionDelSistema: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  registroDeAuditoria: { create: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

jest.mock("@/lib/db", () => ({ prisma: mockPrisma }));

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

const filaBase = {
  id: "cfg-1",
  capacidadMaxima: 100,
  periodoGracia: 0,
  diasInactividad: 15,
  descuentoReactivacion: new Prisma.Decimal("10"),
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  updatedAt: new Date(),
};

describe("actualizarConfiguracion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(null);
    mockTx.configuracionDelSistema.update.mockResolvedValue({});
    mockTx.configuracionDelSistema.create.mockResolvedValue({});
    mockTx.registroDeAuditoria.create.mockResolvedValue({});
  });

  it("con fila existente actualiza solo los campos que cambiaron", async () => {
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase);

    const r = await actualizarConfiguracion({ descuentoReactivacion: 25 }, "admin-1");

    expect(mockTx.configuracionDelSistema.update).toHaveBeenCalledWith({
      where: { id: "cfg-1" },
      data: { descuentoReactivacion: 25 },
    });
    expect(mockTx.configuracionDelSistema.create).not.toHaveBeenCalled();
    expect(r.descuentoReactivacion).toBe(25);
    expect(r.capacidadMaxima).toBe(100);
  });

  it("sin fila crea la fila completa, con los defaults en los campos no enviados", async () => {
    const r = await actualizarConfiguracion({ ventanaAforoMinutos: 120 }, "admin-1");

    expect(mockTx.configuracionDelSistema.create).toHaveBeenCalledTimes(1);
    const data = mockTx.configuracionDelSistema.create.mock.calls[0][0].data;
    expect(data.capacidadMaxima).toBe(CONFIGURACION_POR_DEFECTO.capacidadMaxima);
    expect(data.periodoGracia).toBe(CONFIGURACION_POR_DEFECTO.periodoGracia);
    expect(data.diasInactividad).toBe(CONFIGURACION_POR_DEFECTO.diasInactividad);
    expect(data.descuentoReactivacion).toBe(CONFIGURACION_POR_DEFECTO.descuentoReactivacion);
    expect(data.ventanaAforoMinutos).toBe(120);
    expect(data.diaLimitePago).toBe(CONFIGURACION_POR_DEFECTO.diaLimitePago);
    expect(mockTx.configuracionDelSistema.update).not.toHaveBeenCalled();
    expect(r.ventanaAforoMinutos).toBe(120);
  });

  it("un cambio que no cambia nada no escribe auditoría ni update", async () => {
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase);

    const r = await actualizarConfiguracion({ descuentoReactivacion: 10 }, "admin-1");

    expect(mockTx.configuracionDelSistema.update).not.toHaveBeenCalled();
    expect(mockTx.registroDeAuditoria.create).not.toHaveBeenCalled();
    expect(r.descuentoReactivacion).toBe(10);
  });

  it("un cambio real escribe exactamente un registro MODIFICACION con antes y despues", async () => {
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase);

    await actualizarConfiguracion({ descuentoReactivacion: 25 }, "admin-1");

    expect(mockTx.registroDeAuditoria.create).toHaveBeenCalledTimes(1);
    const audit = mockTx.registroDeAuditoria.create.mock.calls[0][0].data;
    expect(audit.tipoOperacion).toBe("MODIFICACION");
    expect(audit.responsableId).toBe("admin-1");
    expect(JSON.parse(audit.detalles)).toEqual({
      descuentoReactivacion: { antes: 10, despues: 25 },
    });
  });

  it("devuelve la configuración combinada (valores viejos + cambios)", async () => {
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase);

    const r = await actualizarConfiguracion(
      { capacidadMaxima: 200, ofertaReactivacionActiva: true },
      "admin-1"
    );

    expect(r.capacidadMaxima).toBe(200);
    expect(r.ofertaReactivacionActiva).toBe(true);
    expect(r.diaLimitePago).toBe(10);
    expect(r.antiPassbackMinutos).toBe(60);
  });

  it("corre dentro de una transacción", async () => {
    mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase);

    await actualizarConfiguracion({ capacidadMaxima: 150 }, "admin-1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  describe("CFG-2: un PUT sin cambios no crea la fila", () => {
    it("con la tabla vacía, un PUT {} no crea fila ni escribe auditoría", async () => {
      const r = await actualizarConfiguracion({}, "admin-1");

      expect(mockTx.configuracionDelSistema.create).not.toHaveBeenCalled();
      expect(mockTx.configuracionDelSistema.update).not.toHaveBeenCalled();
      expect(mockTx.registroDeAuditoria.create).not.toHaveBeenCalled();
      expect(r).toEqual(CONFIGURACION_POR_DEFECTO);
    });

    it("con la tabla vacía, un valor igual al default tampoco crea fila", async () => {
      await actualizarConfiguracion({ capacidadMaxima: CONFIGURACION_POR_DEFECTO.capacidadMaxima }, "admin-1");

      expect(mockTx.configuracionDelSistema.create).not.toHaveBeenCalled();
      expect(mockTx.registroDeAuditoria.create).not.toHaveBeenCalled();
    });

    it("con la tabla vacía, un cambio real crea la fila y SÍ deja auditoría", async () => {
      await actualizarConfiguracion({ ventanaAforoMinutos: 120 }, "admin-1");

      expect(mockTx.configuracionDelSistema.create).toHaveBeenCalledTimes(1);
      expect(mockTx.registroDeAuditoria.create).toHaveBeenCalledTimes(1);
      const audit = mockTx.registroDeAuditoria.create.mock.calls[0][0].data;
      expect(JSON.parse(audit.detalles)).toEqual({
        ventanaAforoMinutos: { antes: 90, despues: 120 },
      });
    });
  });

  describe("CFG-1: la oferta no queda encendida con un descuento inválido", () => {
    it("con la tabla vacía, encender la oferta sin descuento válido se rechaza y no escribe nada", async () => {
      await expect(
        actualizarConfiguracion({ ofertaReactivacionActiva: true }, "admin-1")
      ).rejects.toThrow(/VALIDATION_ERROR.*entre 1 y 50/i);

      expect(mockTx.configuracionDelSistema.create).not.toHaveBeenCalled();
      expect(mockTx.configuracionDelSistema.update).not.toHaveBeenCalled();
      expect(mockTx.registroDeAuditoria.create).not.toHaveBeenCalled();
    });

    it("con la tabla vacía, encender con un descuento válido crea la fila", async () => {
      const r = await actualizarConfiguracion(
        { ofertaReactivacionActiva: true, descuentoReactivacion: 20 },
        "admin-1"
      );

      expect(r.ofertaReactivacionActiva).toBe(true);
      expect(r.descuentoReactivacion).toBe(20);
      expect(mockTx.configuracionDelSistema.create).toHaveBeenCalledTimes(1);
    });

    it("una fila que ya tiene un descuento válido se puede encender", async () => {
      mockTx.configuracionDelSistema.findFirst.mockResolvedValue(filaBase); // descuento 10

      const r = await actualizarConfiguracion({ ofertaReactivacionActiva: true }, "admin-1");

      expect(r.ofertaReactivacionActiva).toBe(true);
      expect(mockTx.configuracionDelSistema.update).toHaveBeenCalledWith({
        where: { id: "cfg-1" },
        data: { ofertaReactivacionActiva: true },
      });
    });
  });
});
