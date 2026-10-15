import { CAMPOS_CONFIGURACION, validarCambiosConfiguracion } from "./configuracion";

const payloadCompleto = {
  capacidadMaxima: 120,
  periodoGracia: 3,
  diasInactividad: 30,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  descuentoReactivacion: 12.5,
  ofertaReactivacionActiva: true,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
};

describe("validarCambiosConfiguracion", () => {
  it("acepta un payload completo y devuelve solo las claves enviadas", () => {
    const r = validarCambiosConfiguracion(payloadCompleto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cambios).toEqual(payloadCompleto);
    expect(r.cambios).not.toBe(payloadCompleto);
  });

  it("declara los 11 campos esperados", () => {
    expect(Object.keys(CAMPOS_CONFIGURACION)).toEqual([
      "capacidadMaxima",
      "periodoGracia",
      "diasInactividad",
      "ventanaAforoMinutos",
      "diaLimitePago",
      "diaCorteAltaTardia",
      "antiPassbackMinutos",
      "descuentoReactivacion",
      "ofertaReactivacionActiva",
      "diasSinAsistirParaOferta",
      "enfriamientoOfertaDias",
    ]);
  });

  it("un objeto vacío es válido y no cambia nada", () => {
    expect(validarCambiosConfiguracion({})).toEqual({ ok: true, cambios: {} });
  });

  it("acepta los bordes min y max de varios campos", () => {
    const r = validarCambiosConfiguracion({
      capacidadMaxima: 10000,
      periodoGracia: 0,
      diasInactividad: 365,
      diaLimitePago: 1,
      antiPassbackMinutos: 720,
      diasSinAsistirParaOferta: 7,
      enfriamientoOfertaDias: 730,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cambios.capacidadMaxima).toBe(10000);
    expect(r.cambios.periodoGracia).toBe(0);
    expect(r.cambios.enfriamientoOfertaDias).toBe(730);
  });

  it("rechaza justo por debajo del min", () => {
    const r = validarCambiosConfiguracion({ periodoGracia: -1 });
    expect(r).toEqual({ ok: false, message: "periodoGracia debe estar entre 0 y 30" });
  });

  it("rechaza justo por encima del max", () => {
    const r = validarCambiosConfiguracion({ capacidadMaxima: 10001 });
    expect(r).toEqual({ ok: false, message: "capacidadMaxima debe estar entre 1 y 10000" });
  });

  it("rechaza un valor no numérico", () => {
    const r = validarCambiosConfiguracion({ diasInactividad: "30" });
    expect(r).toEqual({ ok: false, message: "diasInactividad debe ser un número" });
  });

  it("rechaza fraccionario en un campo entero", () => {
    const r = validarCambiosConfiguracion({ capacidadMaxima: 1.5 });
    expect(r).toEqual({ ok: false, message: "capacidadMaxima debe ser un número entero" });
  });

  it("acepta fraccionario en el campo decimal", () => {
    const r = validarCambiosConfiguracion({ descuentoReactivacion: 12.5 });
    expect(r).toEqual({ ok: true, cambios: { descuentoReactivacion: 12.5 } });
  });

  it("rechaza NaN e Infinity (no son finitos)", () => {
    expect(validarCambiosConfiguracion({ diasInactividad: NaN })).toEqual({
      ok: false,
      message: "diasInactividad debe ser un número",
    });
    expect(validarCambiosConfiguracion({ diasInactividad: Infinity })).toEqual({
      ok: false,
      message: "diasInactividad debe ser un número",
    });
  });

  it("rechaza un no-booleano en ofertaReactivacionActiva", () => {
    expect(validarCambiosConfiguracion({ ofertaReactivacionActiva: "si" })).toEqual({
      ok: false,
      message: "ofertaReactivacionActiva debe ser verdadero o falso",
    });
    expect(validarCambiosConfiguracion({ ofertaReactivacionActiva: 1 })).toEqual({
      ok: false,
      message: "ofertaReactivacionActiva debe ser verdadero o falso",
    });
  });

  it("acepta el booleano real", () => {
    expect(validarCambiosConfiguracion({ ofertaReactivacionActiva: false })).toEqual({
      ok: true,
      cambios: { ofertaReactivacionActiva: false },
    });
  });

  it("rechaza un campo desconocido (typo)", () => {
    expect(validarCambiosConfiguracion({ capacidadMaximaa: 10 })).toEqual({
      ok: false,
      message: "Campo desconocido: capacidadMaximaa",
    });
  });

  it("rechaza null, arrays y strings", () => {
    const mensaje = "Se esperaba un objeto con los campos a actualizar";
    expect(validarCambiosConfiguracion(null)).toEqual({ ok: false, message: mensaje });
    expect(validarCambiosConfiguracion([])).toEqual({ ok: false, message: mensaje });
    expect(validarCambiosConfiguracion("capacidadMaxima")).toEqual({ ok: false, message: mensaje });
    expect(validarCambiosConfiguracion(42)).toEqual({ ok: false, message: mensaje });
  });

  it("devuelve el primer error según el orden de CAMPOS_CONFIGURACION", () => {
    const r = validarCambiosConfiguracion({ periodoGracia: 99, capacidadMaxima: -5 });
    expect(r).toEqual({ ok: false, message: "capacidadMaxima debe estar entre 1 y 10000" });
  });
});
