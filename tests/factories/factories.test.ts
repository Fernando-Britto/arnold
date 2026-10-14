import { Rol, EstadoUsuario, NivelDeDificultad } from "@prisma/client";
import { validateCliente, normalizeDNI } from "@/domains/cliente/cliente";
import { validateMembresia } from "@/domains/membresia/membresia";
import { validateRutina } from "@/domains/rutina/rutina";
import { validateEjercicio } from "@/domains/ejercicio/ejercicio";
import {
  buildCliente,
  buildEjercicio,
  buildEjercicioEnRutina,
  buildMembresia,
  buildRutina,
  buildUsuario,
  resetFactories,
} from "./index";

// validateEjercicio vive junto al repositorio, que importa la base: acá no se toca.
jest.mock("@/lib/db", () => ({ prisma: {} }));

beforeEach(() => resetFactories());

describe("los datos por defecto pasan la validación del dominio", () => {
  it("Cliente", () => {
    expect(validateCliente(buildCliente())).toEqual({ valid: true, errors: [] });
  });

  it("Membresía", () => {
    expect(validateMembresia(buildMembresia())).toEqual({ valid: true, errors: [] });
  });

  it("Rutina", () => {
    expect(validateRutina(buildRutina())).toEqual({ valid: true, errors: [] });
  });

  it("Ejercicio", () => {
    expect(validateEjercicio(buildEjercicio())).toEqual({ valid: true, errors: [] });
  });
});

describe("valores únicos entre llamadas", () => {
  it("Cliente: id, DNI y email distintos", () => {
    const [a, b] = [buildCliente(), buildCliente()];
    expect(a.id).not.toBe(b.id);
    expect(a.dni).not.toBe(b.dni);
    expect(a.email).not.toBe(b.email);
  });

  it("Usuario: id y email distintos", () => {
    const [a, b] = [buildUsuario(), buildUsuario()];
    expect(a.id).not.toBe(b.id);
    expect(a.email).not.toBe(b.email);
  });

  it("EjercicioEnRutina: el par (rutinaId, ejercicioId) no se repite", () => {
    const [a, b] = [buildEjercicioEnRutina(), buildEjercicioEnRutina()];
    expect(`${a.rutinaId}/${a.ejercicioId}`).not.toBe(`${b.rutinaId}/${b.ejercicioId}`);
  });

  it("resetFactories reinicia la secuencia", () => {
    const first = buildEjercicio().id;
    buildEjercicio();
    resetFactories();
    expect(buildEjercicio().id).toBe(first);
  });
});

describe("overrides y aislamiento", () => {
  it("los overrides pisan los valores por defecto", () => {
    expect(buildCliente({ nombre: "Marta Gómez" }).nombre).toBe("Marta Gómez");
    expect(buildMembresia({ precio: 99.5 }).precio).toBe(99.5);
    expect(buildRutina({ nivelDeDificultad: NivelDeDificultad.AVANZADO }).nivelDeDificultad).toBe("AVANZADO");
    expect(buildEjercicioEnRutina({ series: 5, orden: 2 })).toMatchObject({ series: 5, orden: 2 });
  });

  it("cada llamada devuelve fechas nuevas (mutar una no afecta a la siguiente)", () => {
    const a = buildEjercicio();
    a.createdAt.setFullYear(1999);
    expect(buildEjercicio().createdAt.getFullYear()).not.toBe(1999);
  });
});

describe("Cliente", () => {
  it("el DNI viene normalizado (solo dígitos), como lo guarda el dominio", () => {
    const { dni } = buildCliente();
    expect(dni).toBe(normalizeDNI(dni));
    expect(dni).toMatch(/^\d{8}$/);
  });

  it("estado Activo y membresía asignada por defecto", () => {
    expect(buildCliente()).toMatchObject({ estadoCuenta: "Activa" });
    expect(buildCliente().membresiaAsignada).toBeTruthy();
  });
});

describe("Usuario", () => {
  it("es un socio activo por defecto, con un valor de contraseña que no es un hash real", () => {
    const u = buildUsuario();
    expect(u).toMatchObject({ rol: Rol.SOCIO, estado: EstadoUsuario.ACTIVO, deletedAt: null });
    expect(u.password).not.toMatch(/^\$2[aby]\$/);
  });

  it("acepta cualquier rol del schema", () => {
    for (const rol of Object.values(Rol)) {
      expect(buildUsuario({ rol }).rol).toBe(rol);
    }
  });

  it("los emails usan el dominio @arnold.test, igual que el seed", () => {
    expect(buildUsuario().email).toMatch(/@arnold\.test$/);
  });
});
