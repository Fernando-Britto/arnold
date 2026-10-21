"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Equal, Scale, Trash2 } from "lucide-react";
import { borrarPesoCorporal, fijarMetaDePesoCorporal, registrarPesoCorporal } from "@/api/peso";
import {
  progresoHaciaMeta,
  puntosDelGrafico,
  validarPeso,
  variacionDelPeso,
} from "@/domains/peso/peso-corporal";
import {
  describirMeta,
  describirVariacion,
  etiquetaDeFecha,
  formatearPesoKg,
  parsearPesoIngresado,
} from "@/domains/peso/presentacion-peso";
import { handleApiError } from "@/utils/api-error";
import { GraficoDePeso } from "./grafico-de-peso";

/**
 * Peso corporal del socio en el Home (T-048 parte 2, D-66): peso actual, variación contra el
 * pesaje anterior, la meta y cuánto falta, el gráfico y dos formularios (registrar peso y fijar
 * meta). Las cuentas salen de `@/domains/peso`, las mismas funciones puras que usa el servidor.
 *
 * La tarjeta guarda su propio estado: tras registrar un peso, borrar un pesaje o cambiar la meta
 * se actualiza sin volver a pedir todo el Home. Un pesaje se puede borrar (P-47), no corregir.
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */
export interface PesoCorporalCardProps {
  /** Los pesajes con su id, del más antiguo al más reciente, como llegan del servidor (P-47, D-68). */
  mediciones: Array<{ id: string; fecha: string; peso: number }>;
  pesoObjetivo: number | null;
  /** Peso desde el que se fijó la meta: dice si el objetivo era bajar o subir. */
  pesoInicial: number | null;
}

interface Medicion {
  id: string;
  fecha: Date;
  peso: number;
}

/** Cuántos pesajes se listan para poder borrarlos (como en openGym). */
const RECIENTES = 3;

interface Mensaje {
  tipo: "ok" | "error";
  texto: string;
}

/** Los mensajes de validación del dominio llegan como "VALIDATION_ERROR: ..."; se muestra solo el texto. */
function mensajeDeValidacion(error: unknown): string {
  const texto = error instanceof Error ? error.message : "El valor no es válido";
  return texto.replace(/^VALIDATION_ERROR:\s*/, "");
}

function MensajeDeFormulario({ mensaje }: { mensaje: Mensaje | null }) {
  if (!mensaje) return null;
  return mensaje.tipo === "error" ? (
    <p role="alert" className="text-sm font-medium text-red-700">
      {mensaje.texto}
    </p>
  ) : (
    <p role="status" className="text-sm font-medium text-green-700">
      {mensaje.texto}
    </p>
  );
}

const CAMPO =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400";
const BOTON =
  "h-10 shrink-0 rounded-lg bg-[#FC4C02] px-4 text-sm font-bold text-white disabled:bg-gray-400";
const BOTON_SECUNDARIO =
  "h-10 shrink-0 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:text-gray-400";

export function PesoCorporalCard({
  mediciones: inicial,
  pesoObjetivo,
  pesoInicial,
}: PesoCorporalCardProps) {
  const [mediciones, setMediciones] = useState<Medicion[]>(() =>
    inicial.map((m) => ({ id: m.id, fecha: new Date(m.fecha), peso: m.peso }))
  );
  // Misma regla que el servidor: un solo punto por día (el último). Se recalcula con cada cambio.
  const pesajes = useMemo(
    () => puntosDelGrafico(mediciones.map(({ fecha, peso }) => ({ fecha, peso }))),
    [mediciones]
  );
  const recientes = useMemo(
    () => [...mediciones].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, RECIENTES),
    [mediciones]
  );
  const [meta, setMeta] = useState({ objetivo: pesoObjetivo, inicial: pesoInicial });

  const [textoPeso, setTextoPeso] = useState("");
  const [textoMeta, setTextoMeta] = useState("");
  const [mensajePeso, setMensajePeso] = useState<Mensaje | null>(null);
  const [mensajeMeta, setMensajeMeta] = useState<Mensaje | null>(null);
  const [enviando, setEnviando] = useState<"peso" | "meta" | "borrar" | null>(null);

  const actual = pesajes.length > 0 ? pesajes[pesajes.length - 1] : null;
  const variacion = describirVariacion(variacionDelPeso(pesajes));
  const progreso =
    actual && meta.objetivo !== null && meta.inicial !== null
      ? progresoHaciaMeta({ actual: actual.peso, objetivo: meta.objetivo, inicial: meta.inicial })
      : null;

  /** Lee y valida lo escrito en un campo. Devuelve el número, o muestra por qué no sirve. */
  const leerCampo = (
    texto: string,
    campo: "El peso" | "La meta",
    pedido: string,
    avisar: (m: Mensaje) => void
  ): number | null => {
    const valor = parsearPesoIngresado(texto);
    if (valor === null) {
      avisar({ tipo: "error", texto: pedido });
      return null;
    }
    try {
      return validarPeso(valor, campo);
    } catch (error) {
      avisar({ tipo: "error", texto: mensajeDeValidacion(error) });
      return null;
    }
  };

  const guardarPeso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setMensajePeso(null);

    const peso = leerCampo(
      textoPeso,
      "El peso",
      "Escribí tu peso en kilos, por ejemplo 78,4.",
      setMensajePeso
    );
    if (peso === null) return;

    setEnviando("peso");
    try {
      const guardado = await registrarPesoCorporal(peso);
      setMediciones((previas) => [
        ...previas,
        { id: guardado.id, fecha: new Date(guardado.fecha), peso: guardado.peso },
      ]);
      setTextoPeso("");
      setMensajePeso({ tipo: "ok", texto: "Peso guardado" });
    } catch (error) {
      setMensajePeso({ tipo: "error", texto: handleApiError(error, "No se pudo registrar el peso.") });
    } finally {
      setEnviando(null);
    }
  };

  const cambiarMeta = async (objetivo: number | null) => {
    setEnviando("meta");
    try {
      const guardada = await fijarMetaDePesoCorporal(objetivo);
      setMeta({ objetivo: guardada.pesoObjetivo, inicial: guardada.pesoInicial });
      setTextoMeta("");
      setMensajeMeta({ tipo: "ok", texto: objetivo === null ? "Meta eliminada" : "Meta guardada" });
    } catch (error) {
      setMensajeMeta({ tipo: "error", texto: handleApiError(error, "No se pudo guardar la meta.") });
    } finally {
      setEnviando(null);
    }
  };

  const guardarMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setMensajeMeta(null);

    const objetivo = leerCampo(
      textoMeta,
      "La meta",
      "Escribí tu meta en kilos, por ejemplo 77.",
      setMensajeMeta
    );
    if (objetivo === null) return;
    await cambiarMeta(objetivo);
  };

  const quitarMeta = async () => {
    if (enviando) return;
    setMensajeMeta(null);
    await cambiarMeta(null);
  };

  const borrarPeso = async (id: string) => {
    if (enviando) return;
    setMensajePeso(null);
    setEnviando("borrar");
    try {
      await borrarPesoCorporal(id);
      setMediciones((previas) => previas.filter((m) => m.id !== id));
      setMensajePeso({ tipo: "ok", texto: "Pesaje borrado" });
    } catch (error) {
      setMensajePeso({ tipo: "error", texto: handleApiError(error, "No se pudo borrar el pesaje.") });
    } finally {
      setEnviando(null);
    }
  };

  const sinPesajes = actual === null;

  return (
    <section
      data-testid="peso-corporal"
      aria-label="Peso corporal"
      className="flex flex-col gap-6 rounded-lg border border-[#E4E4E7] bg-white p-6"
    >
      <div className="flex items-center gap-2">
        <Scale className="h-[18px] w-[18px] text-[#FC4C02]" aria-hidden="true" />
        <h2 className="text-lg font-bold text-zinc-900">Peso corporal</h2>
      </div>

      {sinPesajes ? (
        <p className="text-sm text-zinc-500">
          Todavía no registraste tu peso. Anotalo y vas a ver cómo evoluciona.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <p data-testid="peso-actual" className="text-[40px] font-bold leading-none text-zinc-900">
              {formatearPesoKg(actual.peso)}
            </p>
            <p className="text-xs text-zinc-500">Último pesaje: {etiquetaDeFecha(actual.fecha)}</p>
            {variacion && (
              <p
                data-testid="peso-variacion"
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700"
              >
                {variacion.sentido === "baja" ? (
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                ) : variacion.sentido === "sube" ? (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Equal className="h-4 w-4" aria-hidden="true" />
                )}
                {variacion.texto}
              </p>
            )}
            {meta.objetivo !== null && (
              <p data-testid="peso-meta" className="text-sm font-semibold text-amber-700">
                {progreso ? describirMeta(progreso, meta.objetivo) : `Meta ${formatearPesoKg(meta.objetivo)}`}
              </p>
            )}
          </div>
          <GraficoDePeso puntos={pesajes} meta={meta.objetivo} />
        </div>
      )}

      {recientes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-zinc-500">PESAJES RECIENTES</h3>
          <ul aria-label="Pesajes recientes" className="flex flex-col divide-y divide-zinc-100">
            {recientes.map((m) => {
              const descripcion = `${formatearPesoKg(m.peso)} del ${etiquetaDeFecha(m.fecha)}`;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-zinc-700">
                    <span className="font-semibold text-zinc-900">{formatearPesoKg(m.peso)}</span>
                    {" · "}
                    {etiquetaDeFecha(m.fecha)}
                  </span>
                  <button
                    type="button"
                    onClick={() => borrarPeso(m.id)}
                    disabled={enviando !== null}
                    aria-label={`Borrar pesaje de ${descripcion}`}
                    className="rounded-md p-2 text-zinc-500 hover:text-red-700 disabled:text-zinc-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid gap-6 border-t border-zinc-200 pt-6 lg:grid-cols-2">
        <form aria-label="Registrar peso" onSubmit={guardarPeso} className="flex flex-col gap-2">
          <label htmlFor="peso-hoy" className="text-sm font-medium text-zinc-700">
            Tu peso de hoy (kg)
          </label>
          <div className="flex gap-2">
            <input
              id="peso-hoy"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={textoPeso}
              onChange={(e) => setTextoPeso(e.target.value)}
              placeholder="78,4"
              disabled={enviando !== null}
              className={CAMPO}
            />
            <button type="submit" disabled={enviando !== null} className={BOTON}>
              {enviando === "peso" ? "Guardando..." : "Guardar peso"}
            </button>
          </div>
          <MensajeDeFormulario mensaje={mensajePeso} />
        </form>

        <form aria-label="Meta de peso" onSubmit={guardarMeta} className="flex flex-col gap-2">
          <label htmlFor="peso-meta-campo" className="text-sm font-medium text-zinc-700">
            Tu meta (kg)
          </label>
          <div className="flex gap-2">
            <input
              id="peso-meta-campo"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={textoMeta}
              onChange={(e) => setTextoMeta(e.target.value)}
              placeholder="77"
              disabled={sinPesajes || enviando !== null}
              className={CAMPO}
            />
            <button type="submit" disabled={sinPesajes || enviando !== null} className={BOTON}>
              {enviando === "meta" ? "Guardando..." : meta.objetivo === null ? "Fijar meta" : "Cambiar meta"}
            </button>
            {meta.objetivo !== null && (
              <button
                type="button"
                onClick={quitarMeta}
                disabled={enviando !== null}
                className={BOTON_SECUNDARIO}
              >
                Quitar meta
              </button>
            )}
          </div>
          {sinPesajes && (
            <p className="text-xs text-zinc-500">Registrá tu peso para poder fijar una meta.</p>
          )}
          <MensajeDeFormulario mensaje={mensajeMeta} />
        </form>
      </div>

    </section>
  );
}
