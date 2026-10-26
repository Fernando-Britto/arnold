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

  it("declara los 14 campos esperados", () => {
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
      "segundosEjecucionSerie",
      "minutosVencimientoReserva",
      "minutosInactividadSesion",
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

  it("acepta segundosEjecucionSerie en los bordes 1 y 3600", () => {
    expect(validarCambiosConfiguracion({ segundosEjecucionSerie: 1 })).toEqual({
      ok: true,
      cambios: { segundosEjecucionSerie: 1 },
    });
    expect(validarCambiosConfiguracion({ segundosEjecucionSerie: 3600 })).toEqual({
      ok: true,
      cambios: { segundosEjecucionSerie: 3600 },
    });
  });

  it("rechaza segundosEjecucionSerie 0", () => {
    expect(validarCambiosConfiguracion({ segundosEjecucionSerie: 0 })).toEqual({
      ok: false,
      message: "segundosEjecucionSerie debe estar entre 1 y 3600",
    });
  });

  it("rechaza segundosEjecucionSerie 3601", () => {
    expect(validarCambiosConfiguracion({ segundosEjecucionSerie: 3601 })).toEqual({
      ok: false,
      message: "segundosEjecucionSerie debe estar entre 1 y 3600",
    });
  });

  it("rechaza segundosEjecucionSerie 60.5", () => {
    expect(validarCambiosConfiguracion({ segundosEjecucionSerie: 60.5 })).toEqual({
      ok: false,
      message: "segundosEjecucionSerie debe ser un número entero",
    });
  });

  it("acepta minutosVencimientoReserva 0 y 1440", () => {
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: 0 })).toEqual({
      ok: true,
      cambios: { minutosVencimientoReserva: 0 },
    });
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: 1440 })).toEqual({
      ok: true,
      cambios: { minutosVencimientoReserva: 1440 },
    });
  });

  it("rechaza minutosVencimientoReserva -1 y 1441", () => {
    const esperado = { ok: false, message: "minutosVencimientoReserva debe estar entre 0 y 1440" };
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: -1 })).toEqual(esperado);
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: 1441 })).toEqual(esperado);
  });

  it("rechaza minutosVencimientoReserva NaN, Infinity y string", () => {
    const esperado = { ok: false, message: "minutosVencimientoReserva debe ser un número" };
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: NaN })).toEqual(esperado);
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: Infinity })).toEqual(esperado);
    expect(validarCambiosConfiguracion({ minutosVencimientoReserva: "15" })).toEqual(esperado);
  });

  it("acepta minutosInactividadSesion 1 y 1440", () => {
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: 1 })).toEqual({
      ok: true,
      cambios: { minutosInactividadSesion: 1 },
    });
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: 1440 })).toEqual({
      ok: true,
      cambios: { minutosInactividadSesion: 1440 },
    });
  });

  it("rechaza minutosInactividadSesion 0, -1 y 1441", () => {
    const esperado = { ok: false, message: "minutosInactividadSesion debe estar entre 1 y 1440" };
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: 0 })).toEqual(esperado);
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: -1 })).toEqual(esperado);
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: 1441 })).toEqual(esperado);
  });

  it("rechaza minutosInactividadSesion 30.5, NaN, Infinity y string", () => {
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: 30.5 })).toEqual({
      ok: false,
      message: "minutosInactividadSesion debe ser un número entero",
    });
    const noNumero = { ok: false, message: "minutosInactividadSesion debe ser un número" };
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: NaN })).toEqual(noNumero);
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: Infinity })).toEqual(noNumero);
    expect(validarCambiosConfiguracion({ minutosInactividadSesion: "30" })).toEqual(noNumero);
  });
});
