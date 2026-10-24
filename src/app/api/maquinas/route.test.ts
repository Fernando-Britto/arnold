/**
 * Route tests for GET /api/maquinas and POST /api/maquinas
 * T-053g — slice PR-1a-5
 */

import {
  GET,
  POST,
  handleMaquinaListRequest,
  handleMaquinaCreateRequest,
  type CreateSuccess,
} from "./route";
import {
  handleMaquinaList,
  handleMaquinaCreate,
} from "@/api/maquinas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import type { Maquina } from "@/domains/maquina/maquina";
import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

jest.mock("@/api/maquinas");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;
const mockList = handleMaquinaList as jest.MockedFunction<typeof handleMaquinaList>;
const mockCreate = handleMaquinaCreate as jest.MockedFunction<typeof handleMaquinaCreate>;

const adminUser = { id: "u-admin", rol: "ADMINISTRADOR" };

const getReq = (search: string) =>
  ({
    nextUrl: new URL(`http://localhost/api/maquinas${search}`),
  }) as unknown as Parameters<typeof GET>[0];

const postReq = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as Parameters<typeof POST>[0];

const mockMaquinas: Maquina[] = [
  {
    id: "m1",
    nombre: "Polea alta",
    tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
    estado: "DISPONIBLE" as EstadoMaquina,
    ubicacion: "Sala principal",
    fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "m2",
    nombre: "Cinta",
    tipoEquipamiento: "CARDIO" as TipoEquipamiento,
    estado: "OCUPADA" as EstadoMaquina,
    ubicacion: "Sala principal",
    fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("Maquina API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockReturnValue(adminUser);
  });

  describe("GET /api/maquinas", () => {
    it("lista todas las máquinas", async () => {
      mockList.mockResolvedValue(mockMaquinas);

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveLength(2);
      expect(json[0]).toMatchObject({ id: "m1", nombre: "Polea alta" });
      expect(json[1]).toMatchObject({ id: "m2", estado: "OCUPADA" });
      expect(mockList).toHaveBeenCalledWith({});
    });

    it("pasa estado, tipoEquipamiento y nombre como filtros", async () => {
      mockList.mockResolvedValue([mockMaquinas[0]]);

      const res = await GET(
        getReq("?estado=DISPONIBLE&tipoEquipamiento=MAQUINA_GUIADA&nombre=Polea")
      );

      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        estado: "DISPONIBLE",
        tipoEquipamiento: "MAQUINA_GUIADA",
        nombre: "Polea",
      });
    });

    it("acepta estado=OCUPADA", async () => {
      mockList.mockResolvedValue([mockMaquinas[1]]);

      const res = await GET(getReq("?estado=OCUPADA"));

      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({ estado: "OCUPADA" });
    });

    it("devuelve [] cuando no hay resultados", async () => {
      mockList.mockResolvedValue([]);

      const res = await GET(getReq("?nombre=sin-resultados"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("responde 400 VALIDATION_ERROR para estado=FOO", async () => {
      const res = await GET(getReq("?estado=FOO"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(json.message).toMatch(/estado/i);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("responde 400 VALIDATION_ERROR para tipoEquipamiento=FOO", async () => {
      const res = await GET(getReq("?tipoEquipamiento=FOO"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(json.message).toMatch(/equipamiento/i);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("responde 400 cuando el handler lanza VALIDATION_ERROR", async () => {
      mockList.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El nombre debe tener entre 2 y 80 caracteres"),
          { code: "VALIDATION_ERROR" }
        )
      );

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("responde 403 a un rol distinto de ADMINISTRADOR", async () => {
      mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toMatchObject({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe("handleMaquinaListRequest", () => {
    it("devuelve el resultado del handler", async () => {
      mockList.mockResolvedValue(mockMaquinas);

      const result = await handleMaquinaListRequest({ estado: "DISPONIBLE" });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
      }
    });
  });

  describe("POST /api/maquinas", () => {
    it("crea y responde 201", async () => {
      const created = { ...mockMaquinas[0], id: "m-nueva" };
      mockCreate.mockResolvedValue(created);

      const body = {
        nombre: "Polea baja",
        ubicacion: "Sala principal",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      };
      const res = await POST(postReq(body));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toMatchObject({ id: "m-nueva", status: 201 });
      expect(mockCreate).toHaveBeenCalledWith(body);
    });

    it("audita ALTA con el id del actor y { maquinaId }", async () => {
      const created = { ...mockMaquinas[0], id: "m-auditada" };
      mockCreate.mockResolvedValue(created);

      const res = await POST(
        postReq({
          nombre: "Máquina auditada",
          ubicacion: "Sala principal",
          tipoEquipamiento: "PESO_LIBRE",
          estado: "DISPONIBLE",
        })
      );

      expect(res.status).toBe(201);
      expect(mockAudit).toHaveBeenCalledWith({
        tipoOperacion: "ALTA",
        responsableId: "u-admin",
        detalles: { maquinaId: "m-auditada" },
      });
    });

    it("responde 403 a un rol distinto de ADMINISTRADOR", async () => {
      mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });

      const res = await POST(postReq({ nombre: "X" }));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toMatchObject({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("responde 400 para OCUPADA con ESTADO_NO_ASIGNABLE", async () => {
      mockCreate.mockRejectedValue(
        Object.assign(
          new Error(
            "ESTADO_NO_ASIGNABLE: El estado OCUPADA no puede asignarse desde este panel"
          ),
          { code: "ESTADO_NO_ASIGNABLE" }
        )
      );

      const res = await POST(
        postReq({
          nombre: "Polea",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "OCUPADA",
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "ESTADO_NO_ASIGNABLE" });
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("responde 409 para un duplicado", async () => {
      mockCreate.mockRejectedValue(
        Object.assign(
          new Error(
            "DUPLICATE_NOMBRE_UBICACION: Ya existe una máquina con el mismo nombre y ubicación"
          ),
          { code: "DUPLICATE_NOMBRE_UBICACION" }
        )
      );

      const res = await POST(
        postReq({
          nombre: "Polea alta",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "DISPONIBLE",
        })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json).toMatchObject({ code: "DUPLICATE_NOMBRE_UBICACION" });
    });

    it("un fallo de auditoría no cambia la respuesta 201", async () => {
      const created = { ...mockMaquinas[0], id: "m-audit-fail" };
      mockCreate.mockResolvedValue(created);
      mockAudit.mockRejectedValue(new Error("DB audit down"));

      const res = await POST(
        postReq({
          nombre: "Polea baja",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "DISPONIBLE",
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toMatchObject({ id: "m-audit-fail", status: 201 });
      expect(mockAudit).toHaveBeenCalled();
    });
  });

  describe("handleMaquinaCreateRequest", () => {
    it("devuelve 201 junto al registro creado", async () => {
      const created = { ...mockMaquinas[0], id: "m-req" };
      mockCreate.mockResolvedValue(created);

      const result = await handleMaquinaCreateRequest({
        nombre: "Polea",
        ubicacion: "Sala",
        tipoEquipamiento: "CARDIO",
        estado: "DISPONIBLE",
      });

      expect((result as CreateSuccess).status).toBe(201);
      expect((result as CreateSuccess).id).toBe("m-req");
    });
  });
});
