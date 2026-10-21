jest.mock("@vercel/functions", () => ({ ipAddress: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: jest.fn() } } }));
jest.mock("@/lib/rateLimit", () => ({ checkRateLimit: jest.fn(), cleanupRateLimitLogsIfNeeded: jest.fn() }));
jest.mock("@/lib/audit", () => ({ recordDeniedAccess: jest.fn() }));
jest.mock("@/lib/token-revocation", () => ({ isTokenRevoked: jest.fn() }));

import { config } from "./proxy";

/**
 * El matcher del proxy decide qué pedidos pasan por la autenticación. Cada pedido que pasa cuesta
 * consultas a la base (usuario + revocación de token), así que los archivos estáticos (imágenes y
 * los mp4 del catálogo de ejercicios, D-70) tienen que quedar afuera.
 */
const pasaPorElProxy = (ruta: string) => new RegExp(`^${config.matcher[0]}$`).test(ruta);

describe("matcher del proxy", () => {
  it.each(["/ejercicios/0001-abc.mp4", "/ejercicios/0001-abc.jpg", "/logo.svg", "/anim.gif"])(
    "%s no pasa por el proxy (estático)",
    (ruta) => expect(pasaPorElProxy(ruta)).toBe(false)
  );

  it.each(["/ejercicios", "/api/ejercicios", "/rutinas/123", "/"])("%s sí pasa por el proxy", (ruta) =>
    expect(pasaPorElProxy(ruta)).toBe(true)
  );
});
