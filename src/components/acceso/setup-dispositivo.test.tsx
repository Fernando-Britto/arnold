/**
 * M — Token del dispositivo: riesgo aceptado de `localStorage`.
 * Guard de regresión: el token vive sólo bajo la clave esperada (no en sessionStorage) y nunca
 * se loguea en consola. No hay RED de comportamiento: M es una aceptación de riesgo documentada
 * en el módulo, no un defecto funcional.
 */
import {
  guardarTokenDispositivo,
  leerTokenDispositivo,
  borrarTokenDispositivo,
  TOKEN_DISPOSITIVO_STORAGE_KEY,
} from "./setup-dispositivo";

describe("M — token del dispositivo: alcance y no exposición", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it("se guarda sólo bajo la clave esperada y no en sessionStorage", () => {
    guardarTokenDispositivo("secreto-dev");

    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(TOKEN_DISPOSITIVO_STORAGE_KEY);
    expect(localStorage.getItem(TOKEN_DISPOSITIVO_STORAGE_KEY)).toBe("secreto-dev");
    expect(leerTokenDispositivo()).toBe("secreto-dev");
    expect(sessionStorage.length).toBe(0);
  });

  it("borrarTokenDispositivo lo elimina", () => {
    guardarTokenDispositivo("secreto-dev");
    borrarTokenDispositivo();
    expect(leerTokenDispositivo()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("no registra el token en consola", () => {
    const metodos = ["log", "info", "warn", "error", "debug"] as const;
    const spies = metodos.map((m) => jest.spyOn(console, m).mockImplementation(() => {}));

    guardarTokenDispositivo("secreto-dev");
    leerTokenDispositivo();
    borrarTokenDispositivo();

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
