import { topNavHref } from "./top-nav";

describe("Contrato de navegación del socio (T-039)", () => {
  it("mapea cada sección a su ruta real", () => {
    expect(topNavHref("inicio")).toBe("/home-socio");
    expect(topNavHref("rutina")).toBe("/home-socio/mi-rutina");
    expect(topNavHref("ejercicios")).toBe("/home-socio/mis-ejercicios");
    expect(topNavHref("progreso")).toBe("/home-socio/progreso");
    expect(topNavHref("membresia")).toBe("/home-socio/mi-membresia");
    expect(topNavHref("asistencias")).toBe("/home-socio/mis-asistencias");
  });
});
