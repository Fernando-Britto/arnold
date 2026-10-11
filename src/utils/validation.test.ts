import { validateEmail, validateDNI, validatePhone } from "./validation";

describe("validateEmail", () => {
  it("acepta un email con formato válido", () => {
    expect(validateEmail("ana@gym.com")).toBe(true);
    expect(validateEmail("ana.perez+1@mail.gym.com.ar")).toBe(true);
  });

  it.each(["", "ana", "ana@", "@gym.com", "ana@gym", "ana @gym.com", "ana@gym .com"])(
    "rechaza %p",
    (value) => {
      expect(validateEmail(value)).toBe(false);
    }
  );
});

describe("validateDNI", () => {
  it("acepta 8 dígitos con o sin puntos", () => {
    expect(validateDNI("12345678")).toBe(true);
    expect(validateDNI("12.345.678")).toBe(true);
  });

  it.each(["", "1234567", "123456789", "12.345.67", "12-345-678", "abcdefgh", "12.34.5678"])(
    "rechaza %p",
    (value) => {
      expect(validateDNI(value)).toBe(false);
    }
  );
});

describe("validatePhone", () => {
  it("acepta el formato +54 9 XXXX XXXXXX", () => {
    expect(validatePhone("+54 9 3764 123456")).toBe(true);
  });

  it.each(["", "3764123456", "+549 3764 123456", "+54 9 376 1234567", "+54 9 3764 12345", "+54 9 3764-123456"])(
    "rechaza %p",
    (value) => {
      expect(validatePhone(value)).toBe(false);
    }
  );
});
