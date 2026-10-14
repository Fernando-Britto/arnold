/**
 * D: POST /api/socios/{id}/access-override debe auditar la IP y el user-agent REALES de la
 * request (best-effort, como el login), no valores fabricados ("0.0.0.0"/"unknown").
 */
import { handleAccessOverrideRequest } from "./route";
import { handleAccessOverride } from "@/api/socios/access-override";
import { extractUserFromAuthHeader } from "@/lib/auth";

jest.mock("@/api/socios/access-override", () => ({ handleAccessOverride: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromAuthHeader: jest.fn(),
}));

const mockHandler = handleAccessOverride as jest.Mock;
const mockExtract = extractUserFromAuthHeader as jest.Mock;

describe("handleAccessOverrideRequest — contexto real de la request (D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtract.mockReturnValue({ id: "admin1", rol: "ADMINISTRADOR" });
    mockHandler.mockResolvedValue({ success: true, message: "Acceso otorgado" });
  });

  it("pasa la IP y el user-agent reales al handler (no 0.0.0.0/unknown)", async () => {
    const result = await handleAccessOverrideRequest(
      "Bearer token",
      { motivo: "Próximo pago confirmado para 2026-08-15" },
      "socio-1",
      { ip: "203.0.113.7", userAgent: "Mozilla/5.0 (puerta)" }
    );

    expect(result.status).toBe(200);
    const req = mockHandler.mock.calls[0][0];
    expect(req.ip).toBe("203.0.113.7");
    expect(req.headers["user-agent"]).toBe("Mozilla/5.0 (puerta)");
  });

  it("sigue rechazando sin sesión válida", async () => {
    mockExtract.mockReturnValue(null);
    const result = await handleAccessOverrideRequest("", {}, "socio-1", {
      ip: "1.2.3.4",
      userAgent: "ua",
    });
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
