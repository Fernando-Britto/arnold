/**
 * Integration tests for GET /api/membresias (list) and POST /api/membresias (create)
 * T-016: Membresia API layer CRUD
 * 
 * Note: These are handler tests that verify discriminated union response types
 * and error code mapping. Full integration with database happens in e2e tests.
 */

import { handleMembresiaListRequest, handleMembresiaCreateRequest } from "./route";

describe("Membresia API Routes", () => {
  describe("GET /api/membresias", () => {
    it.todo("should return list of all membresias with assignedSocioCount (integration test with database)");
  });

  describe("POST /api/membresias", () => {
    it("should return error when input is missing required nombre field", async () => {
      const result = await handleMembresiaCreateRequest({
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
        // nombre missing
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      }
    });

    it("should return error when precio is invalid", async () => {
      const result = await handleMembresiaCreateRequest({
        nombre: "Gold",
        precio: -100, // invalid
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      }
    });

    it("should return error when periodicidad is invalid", async () => {
      const result = await handleMembresiaCreateRequest({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 0, // invalid
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      }
    });

    it("should return error when nombre is too short", async () => {
      const result = await handleMembresiaCreateRequest({
        nombre: "Go", // < 3 chars
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
