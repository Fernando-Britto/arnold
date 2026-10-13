"use client";

import React, { useCallback, useEffect, useState } from "react";
import { accesoDispositivo, type AccesoPuertaRespuesta } from "@/api/dispositivos";
import { handleApiError } from "@/utils/api-error";
import { TecladoNumerico } from "./teclado-numerico";
import { MS_AUTO_CLEAR, PanelResultado } from "./panel-resultado";

const LARGO_DNI_MAX = 8;
const LARGO_PIN = 4;

type Paso = "DNI" | "PIN" | "RESULTADO";

interface KioscoPuertaProps {
  /** Token del dispositivo (T-036). Viaja en el header `x-dispositivo-token`. */
  token: string;
  /** Permite volver al alta si hay que reemplazar el token. */
  onReconfigurar?: () => void;
}

/**
 * Kiosco de puerta (T-036, D-47): misma mecánica DNI + PIN que recepción, pero autenticado con
 * el token del dispositivo (sin sesión de usuario). El panel muestra sólo nombre + estado (D-43)
 * y se limpia solo para el próximo socio.
 */
export function KioscoPuerta({ token, onReconfigurar }: KioscoPuertaProps) {
  const [paso, setPaso] = useState<Paso>("DNI");
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<AccesoPuertaRespuesta | null>(null);

  const reiniciar = useCallback(() => {
    setPaso("DNI");
    setDni("");
    setPin("");
    setResultado(null);
    setEnviando(false);
  }, []);

  useEffect(() => {
    if (paso !== "RESULTADO") return;
    const id = setTimeout(reiniciar, MS_AUTO_CLEAR);
    return () => clearTimeout(id);
  }, [paso, reiniciar]);

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
      setResultado(await accesoDispositivo({ dni: dni.trim(), pin }, token));
    } catch (error) {
      setResultado({ resultado: "DENEGADO", motivo: handleApiError(error, "No se pudo registrar el ingreso.") });
    } finally {
      setEnviando(false);
      setPaso("RESULTADO");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#F1F3F5] p-6">
      {paso === "RESULTADO" && resultado ? (
        <PanelResultado resultado={resultado} mostrarMembresia={false} />
      ) : (
        <>
          <h1 className="text-3xl font-bold text-gray-900">
            {paso === "DNI" ? "Ingresá tu DNI" : "Ingresá tu PIN"}
          </h1>

          {paso === "DNI" ? (
            <output
              aria-label="DNI ingresado"
              className="min-h-16 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-3xl tracking-widest text-gray-900"
            >
              {dni || "—"}
            </output>
          ) : (
            <div role="group" aria-label="PIN" className="flex gap-3">
              {Array.from({ length: LARGO_PIN }).map((_, i) => (
                <span
                  key={i}
                  className="flex h-16 w-12 items-center justify-center rounded-lg border border-gray-300 bg-white text-2xl text-gray-900"
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
              className="rounded-lg bg-[#FC4C02] px-8 py-3 text-lg font-semibold text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              Continuar
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={volver}
                disabled={enviando}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={ingresar}
                disabled={pin.length !== LARGO_PIN || enviando}
                className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enviando ? "Ingresando..." : "Ingresar"}
              </button>
            </div>
          )}
        </>
      )}

      {onReconfigurar && paso !== "RESULTADO" && (
        <button
          type="button"
          onClick={onReconfigurar}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          Reconfigurar dispositivo
        </button>
      )}
    </div>
  );
}
