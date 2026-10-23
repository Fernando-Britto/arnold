"use client";

import React, { useCallback, useEffect, useState } from "react";
import { checkIn, type CheckInResultado } from "@/api/acceso";
import { handleApiError } from "@/utils/api-error";
import { TecladoNumerico } from "./teclado-numerico";
import { MS_AUTO_CLEAR, PanelResultado } from "./panel-resultado";
import { OverrideAcceso } from "./override-acceso";

const LARGO_DNI_MAX = 8;
const LARGO_PIN = 4;

type Paso = "DNI" | "PIN" | "RESULTADO";

/**
 * Kiosco de recepción (T-035, D-47): pantalla que queda abierta. Primero se tipea el DNI,
 * después el PIN de 4 dígitos, y el resultado (nombre + estado / motivo) se limpia solo.
 */
export function KioscoAcceso() {
  const [paso, setPaso] = useState<Paso>("DNI");
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<CheckInResultado | null>(null);
  // Mientras el diálogo de override está abierto no se limpia el resultado: el operador
  // necesita tiempo para escribir el motivo (el auto-clear de 5 s lo borraría).
  const [overrideAbierto, setOverrideAbierto] = useState(false);

  const reiniciar = useCallback(() => {
    setPaso("DNI");
    setDni("");
    setPin("");
    setResultado(null);
    setEnviando(false);
    setOverrideAbierto(false);
  }, []);

  useEffect(() => {
    if (paso !== "RESULTADO" || overrideAbierto) return;
    const id = setTimeout(reiniciar, MS_AUTO_CLEAR);
    return () => clearTimeout(id);
  }, [paso, reiniciar, overrideAbierto]);

  const handleOverrideOtorgado = useCallback(() => {
    // El override ya registró el ingreso: mostramos el estado otorgado en vez de repetir el
    // check-in (que volvería a negar por anti-passback al detectar el ingreso recién creado).
    setResultado((prev) =>
      prev
        ? { ...prev, resultado: "PERMITIDO", motivo: "Acceso otorgado por autorización excepcional" }
        : prev
    );
    setOverrideAbierto(false);
  }, []);

  const handleDigito = (digito: string) => {
    if (enviando) return;
    if (paso === "DNI") setDni((prev) => (prev.length < LARGO_DNI_MAX ? prev + digito : prev));
    else if (paso === "PIN") setPin((prev) => (prev.length < LARGO_PIN ? prev + digito : prev));
  };

  const handleBorrar = () => {
    if (enviando) return;
    if (paso === "DNI") setDni((prev) => prev.slice(0, -1));
    else if (paso === "PIN") setPin((prev) => prev.slice(0, -1));
  };

  const continuar = () => {
    if (dni.trim()) setPaso("PIN");
  };

  const volver = () => {
    setPin("");
    setPaso("DNI");
  };

  const ingresar = async () => {
    if (pin.length !== LARGO_PIN || enviando) return;
    setEnviando(true);
    try {
      setResultado(await checkIn({ dni: dni.trim(), pin }));
    } catch (error) {
      setResultado({ resultado: "DENEGADO", motivo: handleApiError(error, "No se pudo registrar el ingreso.") });
    } finally {
      setEnviando(false);
      setPaso("RESULTADO");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface-page p-6">
      {paso === "RESULTADO" && resultado ? (
        <>
          <PanelResultado
            resultado={{
              resultado: resultado.resultado,
              motivo: resultado.motivo,
              nombre: resultado.socio?.nombre,
              membresia: resultado.socio?.membresia,
            }}
          />
          {resultado.resultado === "DENEGADO" && resultado.socio && (
            <OverrideAcceso
              socio={resultado.socio}
              motivoDenegacion={resultado.motivo}
              abierto={overrideAbierto}
              onAbiertoChange={setOverrideAbierto}
              onOtorgado={handleOverrideOtorgado}
            />
          )}
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-ink">
            {paso === "DNI" ? "Ingresá tu DNI" : "Ingresá tu PIN"}
          </h1>

          {paso === "DNI" ? (
            <output
              aria-label="DNI ingresado"
              className="min-h-16 w-full max-w-xs rounded-lg border border-border bg-surface px-4 py-3 text-center text-3xl tracking-widest text-ink"
            >
              {dni || "—"}
            </output>
          ) : (
            <div role="group" aria-label="PIN" className="flex gap-3">
              {Array.from({ length: LARGO_PIN }).map((_, i) => (
                <span
                  key={i}
                  className="flex h-16 w-12 items-center justify-center rounded-lg border border-border bg-surface text-2xl text-ink"
                >
                  {i < pin.length ? "●" : ""}
                </span>
              ))}
              <span className="sr-only">{pin.length} de {LARGO_PIN} dígitos ingresados</span>
            </div>
          )}

          <TecladoNumerico onDigito={handleDigito} onBorrar={handleBorrar} deshabilitado={enviando} />

          {paso === "DNI" ? (
            <button
              type="button"
              onClick={continuar}
              disabled={!dni}
              className="rounded-lg bg-brand-strong px-8 py-3 text-lg font-semibold text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
            >
              Continuar
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={volver}
                disabled={enviando}
                className="rounded-lg border border-border bg-surface px-6 py-3 text-lg font-semibold text-ink-soft hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={ingresar}
                disabled={pin.length !== LARGO_PIN || enviando}
                className="rounded-lg bg-brand-strong px-8 py-3 text-lg font-semibold text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
              >
                {enviando ? "Ingresando..." : "Ingresar"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
