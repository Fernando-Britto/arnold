import {
  hashPassword,
  comparePassword,
  createJWT,
  verifyJWT,
  extractUserFromAuthHeader,
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
});
