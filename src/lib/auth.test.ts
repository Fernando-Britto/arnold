import {
  hashPassword,
  comparePassword,
  createJWT,
  verifyJWT,
  extractUserFromAuthHeader,
  extractUserFromRequest,
  AUTH_COOKIE_NAME,
  authHeaderFromRequest,
} from "./auth";

describe("Auth Library", () => {
  describe("Password hashing and comparison", () => {
    it("should hash a password", async () => {
      const password = "my-secure-password";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are typically 60 chars
    });

    it("should hash the same password differently each time (salt variation)", async () => {
      const password = "test-password";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts produce different hashes
    });

    it("should compare password against hash correctly", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const password = "correct-password";
      const wrongPassword = "wrong-password";
      const hash = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it("should handle empty password", async () => {
      const emptyPassword = "";
      const hash = await hashPassword(emptyPassword);

      const isValid = await comparePassword(emptyPassword, hash);
      expect(isValid).toBe(true);
    });

    it("should handle special characters in password", async () => {
      const specialPassword = "p@ssw0rd!#$%^&*()";
      const hash = await hashPassword(specialPassword);

      const isValid = await comparePassword(specialPassword, hash);
      expect(isValid).toBe(true);
    });
  });

  describe("JWT creation and verification", () => {
    it("should create a valid JWT", () => {
      const userId = "user-123";
      const token = createJWT(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should encode user ID in JWT", () => {
      const userId = "user-456";
      const token = createJWT(userId);

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(userId);
    });

    it("should create different tokens for different users", () => {
      const token1 = createJWT("user-1");
      const token2 = createJWT("user-2");

      expect(token1).not.toBe(token2);
      expect(verifyJWT(token1)?.sub).toBe("user-1");
      expect(verifyJWT(token2)?.sub).toBe("user-2");
    });

    it("should reject invalid tokens", () => {
      const invalidToken = "not.a.real.token";
      const result = verifyJWT(invalidToken);

      expect(result).toBeNull();
    });

    it("should reject tampered tokens", () => {
      const userId = "user-123";
      const token = createJWT(userId);

      // Tamper with the token by changing a character
      const tamperedToken = token.slice(0, -5) + "XXXXX";
      const result = verifyJWT(tamperedToken);

      expect(result).toBeNull();
    });

    it("should reject empty token", () => {
      const result = verifyJWT("");
      expect(result).toBeNull();
    });

    it("should support custom expiration", () => {
      const userId = "user-789";
      const token = createJWT(userId, "1h");

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(userId);
    });

    it("should support numeric expiration (seconds)", () => {
      const userId = "user-999";
      const token = createJWT(userId, 3600); // 1 hour

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(userId);
    });
  });

  describe("Edge cases", () => {
    it("should handle very long user IDs", async () => {
      const longUserId = "user-" + "x".repeat(1000);
      const token = createJWT(longUserId);

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(longUserId);
    });

    it("should handle special characters in user ID", () => {
      const specialId = "user@example.com!#$%";
      const token = createJWT(specialId);

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(specialId);
    });

    it("should include role in JWT when provided", () => {
      const userId = "admin-123";
      const token = createJWT(userId, "7d", { rol: "ADMINISTRADOR" });

      const verified = verifyJWT(token);
      expect(verified?.sub).toBe(userId);
      expect(verified?.rol).toBe("ADMINISTRADOR");
    });

    it("should extract user from Authorization Bearer header", () => {
      const userId = "user-456";
      const token = createJWT(userId, "7d", {
        rol: "RECEPCIONISTA",
        email: "user@test.com",
        nombre: "Test User",
      });

      const user = extractUserFromAuthHeader(`Bearer ${token}`);
      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.rol).toBe("RECEPCIONISTA");
    });

    it("should return null for missing Authorization header", () => {
      const user = extractUserFromAuthHeader(undefined);
      expect(user).toBeNull();
    });

    it("should return null for malformed Bearer header", () => {
      const user = extractUserFromAuthHeader("Basic user:pass");
      expect(user).toBeNull();
    });

    it("should return null for invalid JWT token", () => {
      const user = extractUserFromAuthHeader("Bearer invalid.token.xyz");
      expect(user).toBeNull();
    });
  });

  describe("createJWT jti", () => {
    it("incluye un jti único por token", () => {
      const a = verifyJWT(createJWT("u1"))!;
      const b = verifyJWT(createJWT("u1"))!;
      expect(a.jti).toBeDefined();
      expect(a.jti).not.toBe(b.jti);
    });
  });

  describe("JWT_SECRET en producción", () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = { node: env.NODE_ENV, secret: env.JWT_SECRET };
    const restore = (k: string, v?: string) => (v === undefined ? delete env[k] : (env[k] = v));
    afterEach(() => { restore("NODE_ENV", prev.node); restore("JWT_SECRET", prev.secret); });

    it("lanza si falta JWT_SECRET", () => {
      env.NODE_ENV = "production";
      delete env.JWT_SECRET;
      expect(() => createJWT("u1")).toThrow(/JWT_SECRET/);
    });
  });
});

describe("extractUserFromRequest", () => {
  const token = () => createJWT("u1", 3600, { rol: "RECEPCIONISTA" });
  const req = (headers: Record<string, string> = {}, cookie?: string) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    cookies: {
      get: (n: string) => (n === AUTH_COOKIE_NAME && cookie ? { value: cookie } : undefined),
    },
  });

  it("lee el header Bearer", () => {
    expect(extractUserFromRequest(req({ authorization: `Bearer ${token()}` }))).toEqual({
      id: "u1",
      rol: "RECEPCIONISTA",
    });
  });
  it("lee la cookie de sesión", () => {
    expect(extractUserFromRequest(req({}, token()))).toEqual({ id: "u1", rol: "RECEPCIONISTA" });
  });
  it("si hay cookie y Bearer, gana la cookie (la identidad que validó el proxy)", () => {
  const cookieToken = createJWT("u-cookie", 3600, { rol: "RECEPCIONISTA" });
  const bearer = createJWT("u-header", 3600, { rol: "ADMINISTRADOR" });
  expect(
    extractUserFromRequest(req({ authorization: `Bearer ${bearer}` }, cookieToken))
  ).toEqual({ id: "u-cookie", rol: "RECEPCIONISTA" });
});
  it("sin credenciales → null", () => {
    expect(extractUserFromRequest(req())).toBeNull();
  });
  it("cookie con token inválido → null", () => {
    expect(extractUserFromRequest(req({}, "basura"))).toBeNull();
  });
  it("cookie con token expirado → null", () => {
    expect(extractUserFromRequest(req({}, createJWT("u1", -10, { rol: "SOCIO" })))).toBeNull();
  });
  it("no confía en headers x-user-* falsificados", () => {
    expect(
      extractUserFromRequest(req({ "x-user-id": "u9", "x-user-rol": "ADMINISTRADOR" }))
    ).toBeNull();
  });
});
describe("authHeaderFromRequest", () => {
  const req = (headers: Record<string, string> = {}, cookie?: string) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    cookies: {
      get: (n: string) => (n === AUTH_COOKIE_NAME && cookie ? { value: cookie } : undefined),
    },
  });

  it("cookie → Bearer con el token de la cookie", () => {
    expect(authHeaderFromRequest(req({}, "tok-cookie"))).toBe("Bearer tok-cookie");
  });
  it("solo header → el mismo header", () => {
    expect(authHeaderFromRequest(req({ authorization: "Bearer tok-h" }))).toBe("Bearer tok-h");
  });
  it("cookie y header → gana la cookie", () => {
    expect(authHeaderFromRequest(req({ authorization: "Bearer tok-h" }, "tok-c"))).toBe("Bearer tok-c");
  });
  it("sin credenciales → undefined", () => {
    expect(authHeaderFromRequest(req())).toBeUndefined();
  });
});
