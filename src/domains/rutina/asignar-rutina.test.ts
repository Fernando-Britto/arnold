/**
 * Asignar rutina a un socio (T-034, RN-04).
 * Spec: openspec/asignar-rutina-flowspec.md
 *
 * Prisma va mockeado: el motor remoto no es alcanzable desde este entorno.
 * `$transaction(callback)` recibe el mismo mock como `tx` (igual que registrar-pago.test.ts).
 */
import {
  asignarRutina,
  listarRutinasDeSocio,
  EntidadNoEncontradaError,
} from "./asignar-rutina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn() },
    rutina: { findUnique: jest.fn() },
    rutinaAsignada: { updateMany: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops) =>
    typeof ops === "function" ? Promise.resolve(ops(prisma)) : Promise.all(ops.map(() => ({})))
  );
  return { prisma };
});

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

/** Socio y rutina existentes, más la asignación que devuelve `create`. */
async function armarExistentes(creada: unknown = { id: "asig-1" }) {
  const prisma = await mocks();
  (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
    id: "socio-1",
    usuario: { estado: "ACTIVO", deletedAt: null },
  });
  (prisma.rutina.findUnique as jest.Mock).mockResolvedValue({ id: "rutina-1" });
  (prisma.rutinaAsignada.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.rutinaAsignada.create as jest.Mock).mockResolvedValue(creada);
  return prisma;
}

describe("asignarRutina — RN-04 (una sola rutina activa por socio)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("desactiva las asignaciones activas previas y crea la nueva activa en UNA transacción", async () => {
    const creada = {
      id: "asig-2",
      socioId: "socio-1",
      rutinaId: "rutina-1",
      activa: true,
      rutina: { id: "rutina-1", nombre: "Full Body" },
    };
    const prisma = await armarExistentes(creada);

    const r = await asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" });

    expect(r).toEqual(creada);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.rutinaAsignada.updateMany).toHaveBeenCalledWith({
      where: { socioId: "socio-1", activa: true },
      data: { activa: false },
    });
    expect(prisma.rutinaAsignada.create).toHaveBeenCalledWith({
      data: { socioId: "socio-1", rutinaId: "rutina-1", activa: true },
      include: { rutina: true },
    });

    // Dentro de la transacción, primero se desactivan las previas y después se crea la nueva.
    const ordenDesactivar = (prisma.rutinaAsignada.updateMany as jest.Mock).mock
      .invocationCallOrder[0];
    const ordenCrear = (prisma.rutinaAsignada.create as jest.Mock).mock.invocationCallOrder[0];
    expect(ordenDesactivar).toBeLessThan(ordenCrear);
  });

  it("valida que el socio exista antes de abrir la transacción", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      asignarRutina({ socioId: "nope", rutinaId: "rutina-1" })
    ).rejects.toBeInstanceOf(EntidadNoEncontradaError);
    await expect(
      asignarRutina({ socioId: "nope", rutinaId: "rutina-1" })
    ).rejects.toThrow(/Socio no encontrado/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("valida que la rutina exista antes de abrir la transacción", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      usuario: { estado: "ACTIVO", deletedAt: null },
    });
    (prisma.rutina.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      asignarRutina({ socioId: "socio-1", rutinaId: "nope" })
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      asignarRutina({ socioId: "socio-1", rutinaId: "nope" })
    ).rejects.toThrow(/Rutina no encontrada/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("asignarRutina — NF-5 (el socio debe estar ACTIVO)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("consulta el Usuario del socio para poder validar su estado", async () => {
    const prisma = await armarExistentes();

    await asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" });

    expect(prisma.socio.findUnique).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      include: { usuario: { select: { estado: true, deletedAt: true } } },
    });
  });

  it("rechaza asignar a un socio cuyo Usuario no está ACTIVO (no abre transacción)", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      usuario: { estado: "INACTIVO", deletedAt: null },
    });
    (prisma.rutina.findUnique as jest.Mock).mockResolvedValue({ id: "rutina-1" });

    await expect(
      asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" })
    ).rejects.toThrow(/El socio debe estar activo para asignar rutina/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza asignar a un socio con Usuario soft-deleted (deletedAt)", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      usuario: { estado: "ACTIVO", deletedAt: new Date() },
    });
    (prisma.rutina.findUnique as jest.Mock).mockResolvedValue({ id: "rutina-1" });

    await expect(
      asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" })
    ).rejects.toThrow(/El socio debe estar activo para asignar rutina/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("el rechazo se mapea a 400, no a un 500", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      usuario: { estado: "BLOQUEADO", deletedAt: null },
    });
    (prisma.rutina.findUnique as jest.Mock).mockResolvedValue({ id: "rutina-1" });

    const error = await asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" }).catch(
      (e) => e
    );

    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    expect(mapped.status).toBe(400);
    expect(mapped.message).toMatch(/El socio debe estar activo para asignar rutina/);
  });
});

describe("asignarRutina — NF-12 (RN-04 bajo concurrencia con Serializable)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("abre la transacción con isolationLevel Serializable", async () => {
    const prisma = await armarExistentes();

    await asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("traduce un fallo de serialización (P2034) a un conflicto 409, no a un 500", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      usuario: { estado: "ACTIVO", deletedAt: null },
    });
    (prisma.rutina.findUnique as jest.Mock).mockResolvedValue({ id: "rutina-1" });
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("write conflict"), { code: "P2034" })
    );

    const error = await asignarRutina({ socioId: "socio-1", rutinaId: "rutina-1" }).catch(
      (e) => e
    );

    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("ASIGNACION_CONFLICTO");
  });
});

describe("listarRutinasDeSocio", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista las asignaciones del socio, más nuevas primero, incluyendo la rutina", async () => {
    const prisma = await mocks();
    const lista = [{ id: "asig-2", activa: true, rutina: { id: "rutina-1" } }];
    (prisma.rutinaAsignada.findMany as jest.Mock).mockResolvedValueOnce(lista);

    const r = await listarRutinasDeSocio("socio-1");

    expect(r).toEqual(lista);
    expect(prisma.rutinaAsignada.findMany).toHaveBeenCalledWith({
      where: { socioId: "socio-1" },
      include: { rutina: true },
      orderBy: { fechaAsignacion: "desc" },
    });
  });
});
