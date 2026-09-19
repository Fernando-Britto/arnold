import { Rol } from "@prisma/client";
import { isAdmin, isStaff, createRoleChecker } from "@/middleware/role-gating";

describe("Auth Context Utilities", () => {
  describe("Role checking functions", () => {
    it("should correctly identify admin users", () => {
      expect(isAdmin(Rol.ADMINISTRADOR)).toBe(true);
    });

    it("should correctly identify non-admin users", () => {
      expect(isAdmin(Rol.SOCIO)).toBe(false);
      expect(isAdmin(Rol.INSTRUCTOR)).toBe(false);
      expect(isAdmin(Rol.RECEPCIONISTA)).toBe(false);
    });

    it("should correctly identify staff members", () => {
      expect(isStaff(Rol.ADMINISTRADOR)).toBe(true);
      expect(isStaff(Rol.INSTRUCTOR)).toBe(true);
      expect(isStaff(Rol.RECEPCIONISTA)).toBe(true);
    });

    it("should correctly identify non-staff members", () => {
      expect(isStaff(Rol.SOCIO)).toBe(false);
    });

    it("should provide role checker factory", () => {
      const isInstructor = createRoleChecker(Rol.INSTRUCTOR);
      expect(isInstructor(Rol.INSTRUCTOR)).toBe(true);
      expect(isInstructor(Rol.SOCIO)).toBe(false);
    });

    it("should support multiple roles in role checker", () => {
      const isStaffChecker = createRoleChecker([
        Rol.ADMINISTRADOR,
        Rol.INSTRUCTOR,
        Rol.RECEPCIONISTA,
      ]);
      expect(isStaffChecker(Rol.ADMINISTRADOR)).toBe(true);
      expect(isStaffChecker(Rol.INSTRUCTOR)).toBe(true);
      expect(isStaffChecker(Rol.SOCIO)).toBe(false);
    });
  });

  describe("Role context state", () => {
    it("should track user role state", () => {
      const mockUserRole = Rol.ADMINISTRADOR;
      expect(mockUserRole).toBe(Rol.ADMINISTRADOR);
      expect(isAdmin(mockUserRole)).toBe(true);
    });

    it("should support role transitions", () => {
      let userRole: Rol = Rol.SOCIO;
      expect(isAdmin(userRole)).toBe(false);
      
      userRole = Rol.ADMINISTRADOR;
      expect(isAdmin(userRole)).toBe(true);
    });

    it("should provide consistent role checks across multiple calls", () => {
      const role = Rol.INSTRUCTOR;
      expect(isStaff(role)).toBe(true);
      expect(isStaff(role)).toBe(true);
      expect(isStaff(role)).toBe(true);
    });
  });
});
