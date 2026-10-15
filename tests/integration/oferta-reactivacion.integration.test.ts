/**
 * Integración de la oferta de reactivación y del panel de parámetros (D-54) contra Postgres real.
 *
 * Por qué existe: los tests unitarios mockean el cliente de Prisma, así que no prueban que las
 * columnas nuevas existan ni que los `Decimal` hagan round-trip. Acá se cobra de verdad y se
 * re-lee la fila desde la base.
 *
 * Lo levanta `npm run test:integration` (Postgres efímero en Docker + `prisma migrate deploy`).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getConfiguracion, actualizarConfiguracion } from "@/lib/configuracion";
import { registrarPago } from "@/domains/pago/registrar-pago";
import { evaluarOfertaDeSocio } from "@/domains/pago/oferta-reactivacion-consulta";

const HOY = new Date("2026-11-15T10:00:00-03:00");
/** Último instante de octubre: el período cubierto por la última cuota del socio. */
const FIN_DE_OCTUBRE = new Date("2026-10-31T23:59:59.999-03:00");
const DIA_MS = 24 * 60 * 60 * 1000;
const PRECIO = 30000;

const CONFIG_OFERTA_ACTIVA = {
  capacidadMaxima: 100,
  periodoGracia: 0,
  diasInactividad: 15,
  descuentoReactivacion: 10,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  ofertaReactivacionActiva: true,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
};

const CONFIG_OFERTA_APAGADA = { ...CONFIG_OFERTA_ACTIVA, ofertaReactivacionActiva: false };

/** Un admin real: `RegistroDeAuditoria.responsableId` es una FK Restrict. */
async function crearAdmin() {
  return prisma.usuario.create({
    data: { nombre: "Admin", email: `admin-${Date.now()}-${Math.random()}@test.local`, password: "x", rol: "ADMINISTRADOR" },
  });
}

/**
 * Socio con plan de $30.000, cuota de octubre (vencida a la fecha de HOY) y una asistencia
 * PERMITIDO de hace `diasSinAsistir` días. Con eso el plan es RENOVACION y el monto es el precio.
 */
async function crearSocio({ diasSinAsistir = 40 }: { diasSinAsistir?: number | null } = {}) {
  const membresia = await prisma.membresia.create({
    data: { nombre: "Plan Gold", precio: new Prisma.Decimal(PRECIO), periodicidad: 30 },
  });
  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Socio",
      email: `socio-${Date.now()}-${Math.random()}@test.local`,
      password: "x",
      rol: "SOCIO",
    },
  });
  const socio = await prisma.socio.create({
    data: {
      usuarioId: usuario.id,
      dni: String(Date.now()) + String(Math.floor(Math.random() * 1000)),
      fechaAlta: new Date("2025-01-01T10:00:00-03:00"),
      estadoCuota: "AL_DIA",
      membresiaAsignadaId: membresia.id,
    },
  });
  await prisma.cuota.create({
    data: { socioId: socio.id, membresiaId: membresia.id, fechaVencimiento: FIN_DE_OCTUBRE },
  });
  if (diasSinAsistir !== null) {
    await prisma.asistencia.create({
      data: {
        socioId: socio.id,
        estado: "PERMITIDO",
        metodo: "MANUAL",
        fechaHora: new Date(HOY.getTime() - diasSinAsistir * DIA_MS),
      },
    });
  }
  return socio;
}

describe("Oferta de reactivación y configuración contra Postgres real (D-54)", () => {
  beforeAll(async () => {
    // Guarda de seguridad: esta suite borra filas, así que sólo puede apuntar a la base de prueba.
    const filas = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (filas[0]?.db !== "arnold_test") {
      throw new Error(
        `La suite de integración solo corre contra la base de prueba (arnold_test); conectada a: ${filas[0]?.db}`
      );
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Hijas antes que padres.
    await prisma.registroDeAuditoria.deleteMany();
    await prisma.pago.deleteMany();
    await prisma.cuota.deleteMany();
    await prisma.asistencia.deleteMany();
    await prisma.socio.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.membresia.deleteMany();
    await prisma.configuracionDelSistema.deleteMany();
  });

  it("sin fila de configuración el lector devuelve los valores por defecto de la base real", async () => {
    const config = await getConfiguracion();

    expect(config.capacidadMaxima).toBe(0);
    expect(config.diasInactividad).toBe(15);
    // Los tres campos de la oferta: existen como columnas y llegan con su default.
    expect(config.ofertaReactivacionActiva).toBe(false);
    expect(config.diasSinAsistirParaOferta).toBe(30);
    expect(config.enfriamientoOfertaDias).toBe(180);
  });

  it("actualizarConfiguracion crea la fila y las columnas nuevas persisten (la migración existe de verdad)", async () => {
    const admin = await crearAdmin();

    const resultado = await actualizarConfiguracion(
      { capacidadMaxima: 120, ofertaReactivacionActiva: true, diasSinAsistirParaOferta: 45, enfriamientoOfertaDias: 90 },
      admin.id
    );
    expect(resultado.ofertaReactivacionActiva).toBe(true);

    // Re-lectura por el lector: si la columna no existiera, Prisma habría explotado antes.
    const releida = await getConfiguracion();
    expect(releida.capacidadMaxima).toBe(120);
    expect(releida.ofertaReactivacionActiva).toBe(true);
    expect(releida.diasSinAsistirParaOferta).toBe(45);
    expect(releida.enfriamientoOfertaDias).toBe(90);
    // Los campos no enviados quedaron con su default.
    expect(releida.diaLimitePago).toBe(10);

    // La fila existe una sola vez.
    expect(await prisma.configuracionDelSistema.count()).toBe(1);
  });

  it("un cambio real deja auditoría con antes y despues; repetir el mismo valor no escribe nada", async () => {
    const admin = await crearAdmin();
    await actualizarConfiguracion({ ...CONFIG_OFERTA_APAGADA }, admin.id);
    await prisma.registroDeAuditoria.deleteMany();

    await actualizarConfiguracion({ descuentoReactivacion: 25 }, admin.id);

    const registros = await prisma.registroDeAuditoria.findMany();
    expect(registros).toHaveLength(1);
    expect(registros[0].tipoOperacion).toBe("MODIFICACION");
    expect(registros[0].responsableId).toBe(admin.id);
    const detalles = JSON.parse(registros[0].detalles ?? "{}");
    expect(detalles.descuentoReactivacion).toEqual({ antes: 10, despues: 25 });

    // Mismo valor otra vez: sin cambios, sin auditoría nueva.
    await actualizarConfiguracion({ descuentoReactivacion: 25 }, admin.id);
    expect(await prisma.registroDeAuditoria.count()).toBe(1);

    // Y el Decimal se re-lee como número.
    expect((await getConfiguracion()).descuentoReactivacion).toBe(25);
  });

  it("con la oferta apagada el cobro real es el de lista y no guarda descuento", async () => {
    const socio = await crearSocio();
    await prisma.configuracionDelSistema.create({ data: CONFIG_OFERTA_APAGADA });

    const { pago } = await registrarPago({ socioId: socio.id, metodoPago: "EFECTIVO", hoy: HOY });

    const fila = await prisma.pago.findUniqueOrThrow({ where: { id: (pago as { id: string }).id } });
    expect(Number(fila.monto)).toBe(PRECIO);
    expect(fila.montoLista).toBeNull();
    expect(fila.descuentoPct).toBeNull();
  });

  it("con la oferta activa y un socio elegible el Pago guarda el monto descontado y los Decimal", async () => {
    const socio = await crearSocio({ diasSinAsistir: 40 });
    await prisma.configuracionDelSistema.create({ data: CONFIG_OFERTA_ACTIVA });

    const { pago } = await registrarPago({ socioId: socio.id, metodoPago: "EFECTIVO", hoy: HOY });

    const fila = await prisma.pago.findUniqueOrThrow({ where: { id: (pago as { id: string }).id } });
    expect(Number(fila.monto)).toBe(27000);
    // Round-trip real de los Decimal nuevos.
    expect(fila.montoLista).toBeInstanceOf(Prisma.Decimal);
    expect(Number(fila.montoLista)).toBe(30000);
    expect(Number(fila.descuentoPct)).toBe(10);
  });

  it("después de usar la oferta el socio queda en enfriamiento (la consulta lo ve en la base real)", async () => {
    const socio = await crearSocio({ diasSinAsistir: 40 });
    await prisma.configuracionDelSistema.create({ data: CONFIG_OFERTA_ACTIVA });

    const antes = await evaluarOfertaDeSocio(
      prisma,
      socio.id,
      { ofertaReactivacionActiva: true, diasSinAsistirParaOferta: 30, descuentoReactivacion: 10, enfriamientoOfertaDias: 180 },
      { estadoCuenta: "AL_DIA", tieneMembresia: true, estadoPago: "VENCIDA", fechaAlta: new Date("2025-01-01T10:00:00-03:00") },
      HOY
    );
    expect(antes).toEqual({ elegible: true, descuentoPct: 10 });

    await registrarPago({ socioId: socio.id, metodoPago: "EFECTIVO", hoy: HOY });

    // El Pago con descuento que se acaba de confirmar es la prueba del enfriamiento.
    const despues = await evaluarOfertaDeSocio(
      prisma,
      socio.id,
      { ofertaReactivacionActiva: true, diasSinAsistirParaOferta: 30, descuentoReactivacion: 10, enfriamientoOfertaDias: 180 },
      { estadoCuenta: "AL_DIA", tieneMembresia: true, estadoPago: "VENCIDA", fechaAlta: new Date("2025-01-01T10:00:00-03:00") },
      HOY
    );
    expect(despues).toEqual({ elegible: false, motivo: "EN_ENFRIAMIENTO" });
  });

  it("si el monto esperado no coincide no se crea ni Cuota ni Pago (409 AMOUNT_CHANGED)", async () => {
    const socio = await crearSocio({ diasSinAsistir: 40 });
    await prisma.configuracionDelSistema.create({ data: CONFIG_OFERTA_ACTIVA });

    await expect(
      registrarPago({ socioId: socio.id, metodoPago: "EFECTIVO", hoy: HOY, montoEsperado: 21000 })
    ).rejects.toThrow(/AMOUNT_CHANGED/);

    expect(await prisma.pago.count()).toBe(0);
    expect(await prisma.cuota.count({ where: { socioId: socio.id } })).toBe(1); // sólo la de octubre
  });

  it("el monto esperado correcto cobra normalmente", async () => {
    const socio = await crearSocio({ diasSinAsistir: 40 });
    await prisma.configuracionDelSistema.create({ data: CONFIG_OFERTA_ACTIVA });

    const { pago } = await registrarPago({
      socioId: socio.id,
      metodoPago: "EFECTIVO",
      hoy: HOY,
      montoEsperado: 27000,
    });

    const fila = await prisma.pago.findUniqueOrThrow({ where: { id: (pago as { id: string }).id } });
    expect(Number(fila.monto)).toBe(27000);
  });
});
