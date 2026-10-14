import { formatDNI, formatMoney, formatPhone } from "./formatting";
import { validateDNI, validatePhone } from "./validation";

describe("formatDNI", () => {
  it("agrega los puntos a 8 dígitos", () => {
    expect(formatDNI("12345678")).toBe("12.345.678");
  });

  it("es idempotente si ya viene con puntos", () => {
    expect(formatDNI("12.345.678")).toBe("12.345.678");
  });

  it("ignora espacios y otros separadores", () => {
    expect(formatDNI(" 12 345 678 ")).toBe("12.345.678");
  });

  it("devuelve el texto tal cual si no son 8 dígitos (no inventa un DNI)", () => {
    expect(formatDNI("1234567")).toBe("1234567");
    expect(formatDNI("123456789")).toBe("123456789");
    expect(formatDNI("")).toBe("");
  });

  it("el resultado pasa validateDNI", () => {
    expect(validateDNI(formatDNI("12345678"))).toBe(true);
  });
});

describe("formatPhone", () => {
  it("formatea 10 dígitos nacionales (código de área + número)", () => {
    expect(formatPhone("3764123456")).toBe("+54 9 3764 123456");
  });

  it("formatea con el prefijo 549", () => {
    expect(formatPhone("5493764123456")).toBe("+54 9 3764 123456");
    expect(formatPhone("+54 9 3764 123456")).toBe("+54 9 3764 123456");
  });

  it("ignora guiones, paréntesis y espacios", () => {
    expect(formatPhone("(3764) 12-3456")).toBe("+54 9 3764 123456");
  });

  it("devuelve el texto tal cual si no encaja en el formato", () => {
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone("")).toBe("");
  });

  it("el resultado pasa validatePhone", () => {
    expect(validatePhone(formatPhone("3764123456"))).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formatea enteros es-AR con prefijo '$ ' (sin centavos)", () => {
    expect(formatMoney(15000)).toBe("$ 15.000");
    expect(formatMoney(30000)).toBe("$ 30.000");
  });

  it("redondea al entero más cercano", () => {
    expect(formatMoney(15000.6)).toBe("$ 15.001");
    expect(formatMoney(15000.4)).toBe("$ 15.000");
    expect(formatMoney(0.5)).toBe("$ 1");
  });

  it("nunca muestra centavos", () => {
    const result = formatMoney(1234.56);
    expect(result).toBe("$ 1.235");
    expect(result).not.toContain(".00");
    expect(result).not.toMatch(/,\d\d$/);
  });

  it("acepta string numérico", () => {
    expect(formatMoney("30000")).toBe("$ 30.000");
  });

  it("acepta Decimal ({ toString })", () => {
    expect(formatMoney({ toString: () => "15000.6" })).toBe("$ 15.001");
    expect(formatMoney({ toString: () => "100" })).toBe("$ 100");
  });

  it("formatea el cero", () => {
    expect(formatMoney(0)).toBe("$ 0");
  });

  it("usa separador de miles de es-AR", () => {
    expect(formatMoney(1234567)).toBe("$ 1.234.567");
  });
});
