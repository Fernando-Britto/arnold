/**
 * Decisión de acceso al gimnasio (T-035, D-47). Función pura: sin Prisma ni React.
 *
 * Dos pasos (D-46): primero la CUENTA (`Socio.estadoCuota`: AL_DIA/INACTIVA/BLOQUEADA)
 * y después el PAGO calculado (`estadoCuotaSocio`, D-40). El anti-passback niega un
 * segundo ingreso dentro de la ventana.
 */
import { decidirAcceso, type DecidirAccesoInput } from "./check-in";

const base: DecidirAccesoInput = {
  estadoCuota: "AL_DIA",
  estadoCuenta: "AL_DIA",
  antiPassback: false,
};

describe("decidirAcceso — estado de la cuenta (D-46)", () => {
  it("cuenta INACTIVA niega aunque el pago esté al día", () => {
    const r = decidirAcceso({ ...base, estadoCuenta: "INACTIVA" });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/inactiva/i);
  });

  it("cuenta BLOQUEADA niega aunque el pago esté al día", () => {
    const r = decidirAcceso({ ...base, estadoCuenta: "BLOQUEADA" });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/bloqueada/i);
  });

  it("la cuenta pesa más que un pago vencido", () => {
    const r = decidirAcceso({ ...base, estadoCuenta: "INACTIVA", estadoCuota: "VENCIDA" });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/inactiva/i);
  });
});

describe("decidirAcceso — estado de pago (D-40)", () => {
  it("AL_DIA permite sin aviso ni motivo", () => {
    const r = decidirAcceso({ ...base });
    expect(r.resultado).toBe("PERMITIDO");
    expect(r.motivo).toBeUndefined();
  });

  it("PENDIENTE permite con el aviso que se le pasa (día límite)", () => {
    const r = decidirAcceso({ ...base, estadoCuota: "PENDIENTE", mensajePendiente: "Cuota a pagar hasta el día 10" });
    expect(r.resultado).toBe("PERMITIDO_CON_AVISO");
    expect(r.motivo).toBe("Cuota a pagar hasta el día 10");
  });

  it("PENDIENTE sin mensaje usa un aviso genérico", () => {
    const r = decidirAcceso({ ...base, estadoCuota: "PENDIENTE" });
    expect(r.resultado).toBe("PERMITIDO_CON_AVISO");
    expect(r.motivo).toBeTruthy();
  });

  it("VENCIDA niega y pide autorización", () => {
    const r = decidirAcceso({ ...base, estadoCuota: "VENCIDA" });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/vencida/i);
  });

  it("SIN_CUOTA niega (se trata como vencida)", () => {
    const r = decidirAcceso({ ...base, estadoCuota: "SIN_CUOTA" });
    expect(r.resultado).toBe("DENEGADO");
  });
});

describe("decidirAcceso — anti-passback", () => {
  it("un segundo ingreso dentro de la ventana niega aunque el pago esté al día", () => {
    const r = decidirAcceso({ ...base, antiPassback: true });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/ya registró/i);
  });

  it("el anti-passback pesa más que el aviso de PENDIENTE", () => {
    const r = decidirAcceso({ ...base, estadoCuota: "PENDIENTE", antiPassback: true });
    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/ya registró/i);
  });
});
