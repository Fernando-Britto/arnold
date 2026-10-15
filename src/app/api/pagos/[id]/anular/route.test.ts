/** @jest-environment node */
/**
 * POST /api/pagos/{id}/anular — P-39.
 * Se usa NextRequest/NextResponse reales (jest.unmock) para ejercitar el chequeo de sesión y
 * de rol, igual que registrar pago.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/pagos");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleAnularPago } from "@/api/pagos";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { POST, handleAnularPagoRequest } from "./route";

const mockAnular = handleAnularPago as jest.MockedFunction<typeof handleAnularPago>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const anulado = {
  pago: { id: "pago-1", socioId: "socio-1", cuotaId: "cuota-1", estado: "ANULADO" },
  cuotaEliminada: "cuota-1",
};

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/pagos/pago-1/anular", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const params = { params: Promise.resolve({ id: "pago-1" }) };

describe("handleAnularPagoRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el pago anulado", async () => {
    mockAnular.mockResolvedValueOnce(anulado as never);

    const r = await handleAnularPagoRequest("pago-1", "cobro por error");

    expect(r.status).toBe(200);
    expect(r.body).toEqual(anulado);
    expect(mockAnular).toHaveBeenCalledWith({ pagoId: "pago-1", motivo: "cobro por error" });
  });

  it("404 si el pago no existe", async () => {
    mockAnular.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const r = await handleAnularPagoRequest("pago-x", "error");

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
    expect((r.body as { message: string }).message).toBe("Pago no encontrado");
  });

  it("409 con código propio si el pago ya estaba anulado", async () => {
    mockAnular.mockRejectedValueOnce(
      Object.assign(new Error("PAYMENT_ALREADY_ANNULLED: El pago ya está anulado"), {
        code: "PAYMENT_ALREADY_ANNULLED",
      })
    );

    const r = await handleAnularPagoRequest("pago-1", "error");

    expect(r.status).toBe(409);
    expect((r.body as { code: string }).code).toBe("PAYMENT_ALREADY_ANNULLED");
  });
});

describe("POST /api/pagos/{id}/anular", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ motivo: "error" }), params);
    expect(res.status).toBe(401);
    expect(mockAnular).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ motivo: "error" }), params);
    expect(res.status).toBe(403);
    expect(mockAnular).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("400 si falta el motivo, sin llamar al dominio", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({}), params);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("El motivo es requerido");
    expect(mockAnular).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("400 si el motivo es sólo espacios", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ motivo: "   " }), params);
    expect(res.status).toBe(400);
    expect(mockAnular).not.toHaveBeenCalled();
  });

  it("200 para RECEPCIONISTA y audita la ANULACION con pagoId, socioId, cuotaId y motivo", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockAnular.mockResolvedValueOnce(anulado as never);

    const res = await POST(postReq({ motivo: "cobro por error" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(anulado);
    expect(mockAnular).toHaveBeenCalledWith({ pagoId: "pago-1", motivo: "cobro por error" });
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ANULACION",
      responsableId: "u-rec",
      detalles: {
        pagoId: "pago-1",
        socioId: "socio-1",
        cuotaId: "cuota-1",
        motivo: "cobro por error",
      },
    });
  });

  it("409 con código propio si ya estaba anulado, sin auditar", async () => {
    mockUser.mockReturnValue({ id: "u-adm", rol: "ADMINISTRADOR" });
    mockAnular.mockRejectedValueOnce(
      Object.assign(new Error("PAYMENT_ALREADY_ANNULLED: El pago ya está anulado"), {
        code: "PAYMENT_ALREADY_ANNULLED",
      })
    );

    const res = await POST(postReq({ motivo: "error" }), params);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PAYMENT_ALREADY_ANNULLED");
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("audita el cuotaId del pago aunque no se haya borrado la cuota", async () => {
    mockUser.mockReturnValue({ id: "u-adm", rol: "ADMINISTRADOR" });
    mockAnular.mockResolvedValueOnce({
      pago: { id: "pago-1", socioId: "socio-1", cuotaId: "cuota-1", estado: "ANULADO" },
      cuotaEliminada: null,
    } as never);

    await POST(postReq({ motivo: "otro pago vivo" }), params);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ detalles: expect.objectContaining({ cuotaId: "cuota-1" }) })
    );
  });
});
