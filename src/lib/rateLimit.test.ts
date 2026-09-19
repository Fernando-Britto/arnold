import { checkRateLimit, cleanupRateLimitLogsIfNeeded } from "./rateLimit";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    rateLimitLog: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Cast prisma with proper mocking support
const mockPrisma = prisma as any;

describe("Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("should allow request when under limit", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(5);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "user-1",
        route: "/api/socios",
        timestamp: new Date(),
      } as any);

      const result = await checkRateLimit("user-1", "/api/socios", 100);

      expect(result).toBe(true);
      expect(mockPrisma.rateLimitLog.create).toHaveBeenCalledTimes(1);
    });

    it("should deny request when at limit", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(100);

      const result = await checkRateLimit("user-1", "/api/socios", 100);

      expect(result).toBe(false);
      expect(mockPrisma.rateLimitLog.create).not.toHaveBeenCalled();
    });

    it("should deny request when over limit", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(150);

      const result = await checkRateLimit("user-1", "/api/socios", 100);

      expect(result).toBe(false);
    });

    it("should use default limit of 100 when not specified", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(50);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "ip-192.168.1.1",
        route: "/api/ejercicios",
        timestamp: new Date(),
      } as any);

      const result = await checkRateLimit("ip-192.168.1.1", "/api/ejercicios");

      expect(result).toBe(true);
      expect(mockPrisma.rateLimitLog.count).toHaveBeenCalled();
      expect(mockPrisma.rateLimitLog.create).toHaveBeenCalledTimes(1);
    });

    it("should support custom limits", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(9);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "user-2",
        route: "/api/pagos",
        timestamp: new Date(),
      } as any);

      const result = await checkRateLimit("user-2", "/api/pagos", 10);

      expect(result).toBe(true);
    });

    it("should check count within 60-second window", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(10);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "user-3",
        route: "/api/rutinas",
        timestamp: new Date(),
      } as any);

      const beforeCall = Date.now();
      await checkRateLimit("user-3", "/api/rutinas");
      const afterCall = Date.now();

      const callArgs = mockPrisma.rateLimitLog.count.mock.calls[0][0];
      const timestampFilter = callArgs.where.timestamp;

      const gteDate = timestampFilter.gte;
      const expectedMinDate = beforeCall - 61 * 1000; // Allow 1 second variance
      const expectedMaxDate = afterCall; // Should be called right now

      expect(gteDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate);
      expect(gteDate.getTime()).toBeLessThanOrEqual(expectedMaxDate);
    });

    it("should track requests by key and route combination", async () => {
      mockPrisma.rateLimitLog.count.mockResolvedValue(5);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "user-4",
        route: "/api/clientes",
        timestamp: new Date(),
      } as any);

      await checkRateLimit("user-4", "/api/clientes");

      expect(mockPrisma.rateLimitLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            key: "user-4",
            route: "/api/clientes",
          }),
        })
      );
    });

    it("should log request when allowed", async () => {
      const now = new Date();
      mockPrisma.rateLimitLog.count.mockResolvedValue(5);
      mockPrisma.rateLimitLog.create.mockResolvedValue({
        id: "1",
        key: "user-5",
        route: "/api/membresias",
        timestamp: now,
      } as any);

      await checkRateLimit("user-5", "/api/membresias");

      expect(mockPrisma.rateLimitLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: "user-5",
          route: "/api/membresias",
        }),
      });
    });
  });

  describe("cleanupRateLimitLogsIfNeeded", () => {
    beforeEach(() => {
      // Reset Math.random for each test
      jest.spyOn(Math, "random").mockRestore();
    });

    it("should cleanup when random triggers (probability 1/50)", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0.015); // Triggers cleanup

      await cleanupRateLimitLogsIfNeeded();

      expect(mockPrisma.rateLimitLog.deleteMany).toHaveBeenCalled();
    });

    it("should not cleanup when random doesn't trigger", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0.99); // Doesn't trigger cleanup

      await cleanupRateLimitLogsIfNeeded();

      expect(mockPrisma.rateLimitLog.deleteMany).not.toHaveBeenCalled();
    });

    it("should delete logs older than 2 minutes", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0.01); // Trigger cleanup

      const beforeCall = Date.now();
      await cleanupRateLimitLogsIfNeeded();
      const afterCall = Date.now();

      const callArgs = mockPrisma.rateLimitLog.deleteMany.mock.calls[0][0];
      const timestampFilter = callArgs.where.timestamp;
      const ltDate = timestampFilter.lt;

      const expectedMinDate = beforeCall - 2 * 60 * 1000 - 1000; // Allow 1 second variance
      const expectedMaxDate = afterCall;

      expect(ltDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate);
      expect(ltDate.getTime()).toBeLessThanOrEqual(expectedMaxDate);
    });

    it("should handle cleanup errors gracefully", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0.01); // Trigger cleanup
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const testError = new Error("Database error");
      mockPrisma.rateLimitLog.deleteMany.mockRejectedValue(testError);

      await expect(cleanupRateLimitLogsIfNeeded()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Rate limit log cleanup failed:",
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
