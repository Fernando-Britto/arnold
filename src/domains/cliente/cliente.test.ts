import {
  createCliente,
  validateCliente,
  normalizeDNI,
  type Cliente,
} from "./cliente";

describe("Cliente Domain Model", () => {
  describe("Cliente creation and validation", () => {
    it("should create a cliente with required fields", () => {
      const cliente = createCliente(
        "Ana García",
        "30.123.456",
        "ana@example.com",
        "gold-123",
        "Activo"
      );

      expect(cliente).toBeDefined();
      expect(cliente.nombre).toBe("Ana García");
      expect(cliente.dni).toBe("30123456"); // Normalized
      expect(cliente.email).toBe("ana@example.com");
      expect(cliente.membresiaAsignada).toBe("gold-123");
      expect(cliente.estadoCuenta).toBe("Activo");
      expect(cliente.fechaAlta).toBeInstanceOf(Date);
    });

    it("should create a cliente with optional telefono", () => {
      const cliente = createCliente(
        "Ana García",
        "30.123.456",
        "ana@example.com",
        "gold-123",
        "Activo",
        "+54 9 1234 567890"
      );

      expect(cliente.telefono).toBe("+54 9 1234 567890");
    });

    it("should create a cliente with null telefono when not provided", () => {
      const cliente = createCliente(
        "Ana García",
        "30.123.456",
        "ana@example.com",
        "gold-123",
        "Activo"
      );

      expect(cliente.telefono).toBeNull();
    });
  });

  describe("DNI normalization", () => {
    it("should normalize DNI with dots to digits-only format", () => {
      const normalized = normalizeDNI("30.123.456");
      expect(normalized).toBe("30123456");
    });

    it("should return digits-only DNI unchanged", () => {
      const normalized = normalizeDNI("30123456");
      expect(normalized).toBe("30123456");
    });

    it("should normalize DNI when creating cliente", () => {
      const cliente = createCliente(
        "Ana García",
        "30.123.456",
        "ana@example.com",
        "gold-123",
        "Activo"
      );

      expect(cliente.dni).toBe("30123456");
    });
  });

  describe("Nombre validation", () => {
    it("should accept valid nombre (5-100 chars)", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).not.toContain(
        expect.stringContaining("nombre")
      );
    });

    it("should reject empty nombre", () => {
      const validation = validateCliente({
        nombre: "",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El nombre es requerido");
    });

    it("should reject nombre with less than 5 chars", () => {
      const validation = validateCliente({
        nombre: "Ana",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El nombre debe tener al menos 5 caracteres"
      );
    });

    it("should reject nombre with more than 100 chars", () => {
      const longName = "a".repeat(101);
      const validation = validateCliente({
        nombre: longName,
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El nombre no puede exceder 100 caracteres"
      );
    });

    it("should accept nombre at exactly 5 chars (boundary)", () => {
      const validation = validateCliente({
        nombre: "Anamá", // 5 chars with accent
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept nombre at exactly 100 chars (boundary)", () => {
      const name100 = "a".repeat(100);
      const validation = validateCliente({
        nombre: name100,
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });
  });

  describe("DNI validation", () => {
    it("should accept DNI with dots format XX.XXX.XXX", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).not.toContain(
        expect.stringContaining("DNI")
      );
    });

    it("should accept DNI without dots format XXXXXXXX", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should reject empty DNI", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El DNI es requerido");
    });

    it("should reject DNI with invalid format", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30-123-456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El DNI debe tener formato XX.XXX.XXX o XXXXXXXX"
      );
    });

    it("should reject DNI with incorrect length", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "3012345",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El DNI debe tener formato XX.XXX.XXX o XXXXXXXX"
      );
    });
  });

  describe("Email validation", () => {
    it("should accept valid email format", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept email with subdomain", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@mail.example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should reject empty email", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El email es requerido");
    });

    it("should reject email without @ symbol", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana.example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Formato de email inválido");
    });

    it("should reject email without domain", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Formato de email inválido");
    });

    it("should reject email without local part", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Formato de email inválido");
    });

    it("should reject email without TLD", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Formato de email inválido");
    });
  });

  describe("Telefono validation (optional)", () => {
    it("should accept valid telefono format +54 9 XXXX XXXXXX", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
        telefono: "+54 9 1234 567890",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept missing telefono", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept empty telefono", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
        telefono: "",
      });

      expect(validation.valid).toBe(true);
    });

    it("should reject telefono with invalid format", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
        telefono: "+549123456789",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El teléfono debe tener formato +54 9 XXXX XXXXXX"
      );
    });

    it("should reject telefono without +54 prefix", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
        telefono: "9 1234 567890",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El teléfono debe tener formato +54 9 XXXX XXXXXX"
      );
    });
  });

  describe("Membresía validation", () => {
    it("should accept valid membresiaAsignada", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should reject empty membresiaAsignada", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Debe seleccionar una membresía activa"
      );
    });

    it("should reject missing membresiaAsignada", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Debe seleccionar una membresía activa"
      );
    });
  });

  describe("Estado de Cuenta validation", () => {
    it("should accept Activo estado", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept Inactivo estado", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Inactivo",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept Bloqueado estado", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Bloqueado",
      });

      expect(validation.valid).toBe(true);
    });

    it("should reject missing estadoCuenta", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El estado de cuenta es requerido"
      );
    });

    it("should reject invalid estadoCuenta value", () => {
      const validation = validateCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Pendiente" as any,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "El estado de cuenta debe ser uno de: Activo, Inactivo, Bloqueado"
      );
    });
  });

  describe("Multiple field validation", () => {
    it("should collect all validation errors", () => {
      const validation = validateCliente({
        nombre: "ab",
        dni: "invalid",
        email: "not-email",
        membresiaAsignada: "",
        estadoCuenta: "Inválido" as any,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(1);
      expect(validation.errors).toContain(
        "El nombre debe tener al menos 5 caracteres"
      );
      expect(validation.errors).toContain(
        "El DNI debe tener formato XX.XXX.XXX o XXXXXXXX"
      );
      expect(validation.errors).toContain("Formato de email inválido");
      expect(validation.errors).toContain(
        "Debe seleccionar una membresía activa"
      );
    });

    it("should validate all required fields correctly", () => {
      const validation = validateCliente({
        nombre: "Carlos López García",
        dni: "25.987.654",
        email: "carlos@example.com",
        membresiaAsignada: "silver-456",
        estadoCuenta: "Activo",
        telefono: "+54 9 2234 567890",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
