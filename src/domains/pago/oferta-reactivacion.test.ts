/**
 * Oferta de reactivación: elegibilidad y descuento (T-045a, D-54). Funciones puras.
 * Spec: openspec/specs/oferta-reactivacion/spec.md
 *
 * Qué cuenta como asistencia (solo ingresos PERMITIDO, incluido el autorizado por excepción; los
 * DENEGADO no) lo resuelve quien consulta la base: acá `ultimaAsistenciaPermitida` ya viene filtrada.
 * Ese filtro se prueba en T-045c, donde vive la consulta.
 */
import {
  aplicarOferta,
  calcularDescuento,
  descuentoEsValido,
  evaluarOferta,
  type EvaluarOfertaInput,
} from "./oferta-reactivacion";

const DIA_MS = 24 * 60 * 60 * 1000;
const HOY = new Date("2026-11-20T15:00:00-03:00");
const hace = (dias: number, ms = 0) => new Date(HOY.getTime() - dias * DIA_MS + ms);

/** Socio elegible por defecto: oferta activa, cuota vencida, última asistencia hace 31 días, sin oferta previa. */
function base(cambios: Partial<EvaluarOfertaInput> = {}): EvaluarOfertaInput {
  return {
    config: {
      ofertaReactivacionActiva: true,
      diasSinAsistirParaOferta: 30,
      descuentoReactivacion: 10,
      enfriamientoOfertaDias: 180,
    },
    estadoCuenta: "AL_DIA",
    tieneMembresia: true,
    estadoPago: "VENCIDA",
    ultimaAsistenciaPermitida: hace(31),
    fechaAlta: hace(400),
    ultimoPagoConDescuento: null,
    hoy: HOY,
    ...cambios,
  };
}
const conConfig = (c: Partial<EvaluarOfertaInput["config"]>) => base({ config: { ...base().config, ...c } });

describe("descuentoEsValido", () => {
  it.each([[1], [10], [12.5], [50]])("acepta %p (rango 1–50)", (pct) => {
    expect(descuentoEsValido(pct)).toBe(true);
  });
  it.each([[0], [0.99], [-5], [50.01], [51], [100], [NaN], [Infinity]])("rechaza %p", (pct) => {
    expect(descuentoEsValido(pct)).toBe(false);
  });
});

describe("evaluarOferta — caso elegible", () => {
  it("socio vencido que dejó de venir y nunca usó una oferta → elegible con el porcentaje configurado", () => {
    expect(evaluarOferta(base())).toEqual({ elegible: true, descuentoPct: 10 });
  });

  it("usa el porcentaje de la configuración", () => {
    expect(evaluarOferta(conConfig({ descuentoReactivacion: 25 }))).toEqual({ elegible: true, descuentoPct: 25 });
  });
});

describe("evaluarOferta — condición 1: interruptor y configuración", () => {
  it("apagada → no se ofrece", () => {
    expect(evaluarOferta(conConfig({ ofertaReactivacionActiva: false }))).toEqual({
      elegible: false,
      motivo: "OFERTA_APAGADA",
    });
  });

  it.each([[0], [51], [100], [-10], [NaN]])("descuento fuera de rango (%p) → no se ofrece, se cobra de lista", (pct) => {
    expect(evaluarOferta(conConfig({ descuentoReactivacion: pct }))).toEqual({
      elegible: false,
      motivo: "CONFIGURACION_INVALIDA",
    });
  });

  it("los extremos del rango (1 y 50) sí se ofrecen", () => {
    expect(evaluarOferta(conConfig({ descuentoReactivacion: 1 })).elegible).toBe(true);
    expect(evaluarOferta(conConfig({ descuentoReactivacion: 50 })).elegible).toBe(true);
  });

  it.each([[NaN], [-1], [Infinity]])("días sin asistir inválidos (%p) → no se ofrece (falla cerrado)", (dias) => {
    expect(evaluarOferta(conConfig({ diasSinAsistirParaOferta: dias }))).toEqual({
      elegible: false,
      motivo: "CONFIGURACION_INVALIDA",
    });
  });

  it.each([[NaN], [-1], [Infinity]])("enfriamiento inválido (%p) → no se ofrece (falla cerrado, no abierto)", (dias) => {
    expect(evaluarOferta(conConfig({ enfriamientoOfertaDias: dias })).elegible).toBe(false);
  });
});

describe("evaluarOferta — condición 2: cuenta y membresía", () => {
  it.each([["INACTIVA"], ["BLOQUEADA"]] as const)("cuenta %s → no elegible", (estadoCuenta) => {
    expect(evaluarOferta(base({ estadoCuenta }))).toEqual({ elegible: false, motivo: "CUENTA_NO_HABILITADA" });
  });

  it("sin membresía asignada → no elegible", () => {
    expect(evaluarOferta(base({ tieneMembresia: false }))).toEqual({ elegible: false, motivo: "SIN_MEMBRESIA" });
  });
});

describe("evaluarOferta — condición 3: solo cuota vencida", () => {
  it.each([["AL_DIA"], ["PENDIENTE"], ["SIN_CUOTA"]] as const)(
    "estado de pago %s → no elegible aunque lleve 60 días sin venir",
    (estadoPago) => {
      expect(evaluarOferta(base({ estadoPago, ultimaAsistenciaPermitida: hace(60) }))).toEqual({
        elegible: false,
        motivo: "CUOTA_NO_VENCIDA",
      });
    }
  );
});

describe("evaluarOferta — condición 4: referencia de actividad", () => {
  it("sigue viniendo (última asistencia hace 5 días) → no elegible", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: hace(5) }))).toEqual({
      elegible: false,
      motivo: "ACTIVIDAD_RECIENTE",
    });
  });

  it("el límite es inclusivo: exactamente 30 días sin asistir → elegible", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: hace(30) })).elegible).toBe(true);
  });

  it("un milisegundo antes de cumplir los 30 días → todavía no elegible", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: hace(30, 1) })).elegible).toBe(false);
  });

  it("respeta el umbral configurado (45 días)", () => {
    const cfg = conConfig({ diasSinAsistirParaOferta: 45 });
    expect(evaluarOferta({ ...cfg, ultimaAsistenciaPermitida: hace(44) }).elegible).toBe(false);
    expect(evaluarOferta({ ...cfg, ultimaAsistenciaPermitida: hace(46) }).elegible).toBe(true);
  });

  it("nunca asistió y se dio de alta hace 10 días → no elegible (se mide desde el alta)", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: null, fechaAlta: hace(10) }))).toEqual({
      elegible: false,
      motivo: "ACTIVIDAD_RECIENTE",
    });
  });

  it("nunca asistió y se dio de alta hace 31 días → elegible", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: null, fechaAlta: hace(31) })).elegible).toBe(true);
  });

  it("si asistió alguna vez, la fecha de alta no importa", () => {
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: hace(31), fechaAlta: hace(32) })).elegible).toBe(true);
    expect(evaluarOferta(base({ ultimaAsistenciaPermitida: hace(31), fechaAlta: hace(2) })).elegible).toBe(true);
  });
});

describe("evaluarOferta — condición 5: enfriamiento", () => {
  it("usó una oferta hace 100 días con enfriamiento de 180 → no elegible", () => {
    expect(evaluarOferta(base({ ultimoPagoConDescuento: hace(100) }))).toEqual({
      elegible: false,
      motivo: "EN_ENFRIAMIENTO",
    });
  });

  it("181 días después → elegible", () => {
    expect(evaluarOferta(base({ ultimoPagoConDescuento: hace(181) })).elegible).toBe(true);
  });

  it("justo al cumplirse los 180 días ya se puede (el pago debe ser POSTERIOR a hoy − 180 para bloquear)", () => {
    expect(evaluarOferta(base({ ultimoPagoConDescuento: hace(180) })).elegible).toBe(true);
  });

  it("un milisegundo antes de cumplirse los 180 días → sigue bloqueado", () => {
    expect(evaluarOferta(base({ ultimoPagoConDescuento: hace(180, 1) })).elegible).toBe(false);
  });

  it("enfriamiento 0 lo desactiva: aunque haya usado una oferta ayer", () => {
    expect(evaluarOferta({ ...conConfig({ enfriamientoOfertaDias: 0 }), ultimoPagoConDescuento: hace(1) }).elegible).toBe(true);
  });

  it("sin pago con descuento previo → no hay enfriamiento", () => {
    expect(evaluarOferta(base({ ultimoPagoConDescuento: null })).elegible).toBe(true);
  });
});

describe("evaluarOferta — orden de los motivos", () => {
  it("cuando fallan varias condiciones informa la primera de la spec", () => {
    // apagada + cuenta bloqueada + cuota al día + actividad reciente + en enfriamiento
    const todoMal = base({
      config: { ...base().config, ofertaReactivacionActiva: false },
      estadoCuenta: "BLOQUEADA",
      estadoPago: "AL_DIA",
      ultimaAsistenciaPermitida: hace(1),
      ultimoPagoConDescuento: hace(1),
    });
    expect(evaluarOferta(todoMal)).toMatchObject({ motivo: "OFERTA_APAGADA" });
    expect(evaluarOferta({ ...todoMal, config: base().config })).toMatchObject({ motivo: "CUENTA_NO_HABILITADA" });
    expect(evaluarOferta({ ...todoMal, config: base().config, estadoCuenta: "AL_DIA" })).toMatchObject({ motivo: "CUOTA_NO_VENCIDA" });
    expect(evaluarOferta({ ...todoMal, config: base().config, estadoCuenta: "AL_DIA", estadoPago: "VENCIDA" })).toMatchObject({
      motivo: "ACTIVIDAD_RECIENTE",
    });
    expect(
      evaluarOferta({ ...todoMal, config: base().config, estadoCuenta: "AL_DIA", estadoPago: "VENCIDA", ultimaAsistenciaPermitida: hace(60) })
    ).toMatchObject({ motivo: "EN_ENFRIAMIENTO" });
  });

  it("no modifica sus argumentos (la entrada congelada no hace saltar ningún error)", () => {
    const input = base();
    Object.freeze(input.config);
    Object.freeze(input);
    expect(() => evaluarOferta(input)).not.toThrow();
    expect(evaluarOferta(input)).toEqual({ elegible: true, descuentoPct: 10 });
  });
});

describe("calcularDescuento", () => {
  it("renovación de $30.000 con 10 % → se cobra $27.000", () => {
    expect(calcularDescuento({ monto: 30000, descuentoPct: 10 })).toEqual({
      montoLista: 30000,
      descuentoPct: 10,
      montoFinal: 27000,
    });
  });

  it("reingreso de dos períodos ($30.000) con 20 % → $24.000 sobre el total", () => {
    expect(calcularDescuento({ monto: 30000, descuentoPct: 20 }).montoFinal).toBe(24000);
  });

  it("acepta porcentajes con decimales (12,5 %)", () => {
    expect(calcularDescuento({ monto: 30000, descuentoPct: 12.5 }).montoFinal).toBe(26250);
  });

  it("33,33 % no sufre errores de coma flotante", () => {
    expect(calcularDescuento({ monto: 30000, descuentoPct: 33.33 }).montoFinal).toBe(20001);
  });

  it("redondea al centavo (el prorrateo de $1.935,48 con 10 %)", () => {
    expect(calcularDescuento({ monto: 1935.48, descuentoPct: 10 }).montoFinal).toBe(1741.93);
  });

  it("el medio centavo exacto redondea hacia arriba, igual que el prorrateo", () => {
    // 10,05 − 10 % = 9,045 → 9,05
    expect(calcularDescuento({ monto: 10.05, descuentoPct: 10 }).montoFinal).toBe(9.05);
  });

  it("extremos del rango: 1 % y 50 %", () => {
    expect(calcularDescuento({ monto: 30000, descuentoPct: 1 }).montoFinal).toBe(29700);
    expect(calcularDescuento({ monto: 30000, descuentoPct: 50 }).montoFinal).toBe(15000);
  });

  it("un monto de $0 queda en $0", () => {
    expect(calcularDescuento({ monto: 0, descuentoPct: 10 }).montoFinal).toBe(0);
  });

  it("nunca cobra más que el precio de lista ni deja un monto negativo", () => {
    for (const monto of [0.01, 1, 10.05, 1935.48, 30000, 99999.99]) {
      for (const pct of [1, 7.77, 25, 33.33, 50]) {
        const r = calcularDescuento({ monto, descuentoPct: pct });
        expect(r.montoFinal).toBeLessThanOrEqual(r.montoLista);
        expect(r.montoFinal).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.each([[0], [0.5], [51], [100], [-1], [NaN]])("rechaza un porcentaje fuera de rango (%p) con RangeError", (pct) => {
    expect(() => calcularDescuento({ monto: 30000, descuentoPct: pct })).toThrow(RangeError);
  });

  it.each([[-1], [NaN], [Infinity]])("rechaza un monto inválido (%p) con RangeError", (monto) => {
    expect(() => calcularDescuento({ monto, descuentoPct: 10 })).toThrow(RangeError);
  });
});

describe("aplicarOferta", () => {
  it("elegible: devuelve el monto descontado más montoLista y descuentoPct para guardar en el Pago", () => {
    expect(aplicarOferta({ monto: 30000, evaluacion: { elegible: true, descuentoPct: 10 } })).toEqual({
      monto: 27000,
      montoLista: 30000,
      descuentoPct: 10,
    });
  });

  it("no elegible: el monto queda exactamente igual y montoLista/descuentoPct nulos (cobro idéntico al de hoy)", () => {
    expect(aplicarOferta({ monto: 1935.48, evaluacion: { elegible: false, motivo: "OFERTA_APAGADA" } })).toEqual({
      monto: 1935.48,
      montoLista: null,
      descuentoPct: null,
    });
  });

  it("integra con evaluarOferta de punta a punta", () => {
    expect(aplicarOferta({ monto: 30000, evaluacion: evaluarOferta(base()) })).toEqual({
      monto: 27000,
      montoLista: 30000,
      descuentoPct: 10,
    });
    expect(aplicarOferta({ monto: 30000, evaluacion: evaluarOferta(base({ estadoPago: "AL_DIA" })) })).toEqual({
      monto: 30000,
      montoLista: null,
      descuentoPct: null,
    });
  });
});
