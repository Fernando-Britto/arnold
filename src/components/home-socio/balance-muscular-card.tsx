"use client";

import React, { useEffect, useState } from "react";
import { fetchBalanceMuscular, type BalanceMuscularDTO } from "@/api/balance-muscular";
import { ETIQUETAS_PERIODO, PERIODOS, type Periodo } from "@/domains/ejercicio/balance-muscular";
import { COLORES_POR_NIVEL, textoDeSeries } from "@/domains/ejercicio/mapa-corporal";
import { ETIQUETAS_MUSCULO, PESO_SECUNDARIO } from "@/domains/ejercicio/musculos";
import { etiquetaDeFecha } from "@/domains/peso/presentacion-peso";
import { handleApiError } from "@/utils/api-error";
import { MapaCorporal } from "./mapa-corporal";

/**
 * Balance muscular (T-051 parte 2, D-107): cuántas series de trabajo hizo el socio por músculo, con un
 * mapa corporal y el filtro Semana, 30 días, 90 días y Todo. Pide sus propios datos al servidor cada vez
 * que cambia el período, así las demás secciones no pagan el cálculo.
 *
 * Idea tomada de openGym como referencia (su "balance muscular" por series trabajadas); no se copió
 * código (AGPL-3.0).
 */
type Resultado =
  | { clave: string; datos: BalanceMuscularDTO; error?: undefined }
  | { clave: string; error: string; datos?: undefined };

const BOTON_PERIODO = "rounded-lg border px-3 py-2 text-sm font-semibold";

export function BalanceMuscularCard() {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Cada pedido lleva una clave (período e intento). Se muestra solo el resultado de la clave actual: una
  // respuesta que llega tarde de otro período no pisa lo que se está viendo, y mientras llega la nueva no
  // queda a la vista el balance de un período distinto al elegido.
  const clave = `${periodo}#${intento}`;
  useEffect(() => {
    let vigente = true;
    fetchBalanceMuscular(periodo)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error: unknown) => {
        if (vigente) {
          setResultado({ clave, error: handleApiError(error, "No se pudo cargar el balance muscular.") });
        }
      });
    return () => {
      vigente = false;
    };
  }, [periodo, intento, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const datos = actual?.datos;

  return (
    <section
      aria-labelledby="balance-titulo"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="balance-titulo" className="font-bold text-ink">
            Balance muscular
          </h2>
          <p className="text-xs text-ink-muted">Series de trabajo por músculo.</p>
        </div>
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => setPeriodo(p)}
              className={`${BOTON_PERIODO} ${
                periodo === p
                  ? "border-brand bg-orange-50 text-ink"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              {ETIQUETAS_PERIODO[p]}
            </button>
          ))}
        </div>
      </div>

      {actual === null && (
        <p role="status" className="text-sm text-ink-muted">
          Cargando balance muscular…
        </p>
      )}

      {actual?.error !== undefined && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm font-medium text-danger">
            {actual.error}
          </p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-soft"
          >
            Reintentar
          </button>
        </div>
      )}

      {datos && datos.musculos.length === 0 && (
        <p className="text-sm text-ink-muted">Todavía no hay series de trabajo en este período.</p>
      )}

      {datos && datos.musculos.length > 0 && (
        <>
          <div className="flex flex-col gap-1 text-sm text-ink-soft">
            <p data-testid="balance-resumen" className="font-medium text-ink">
              {textoDeSeries(datos.totalSeries)} de trabajo · {datos.musculos.length}{" "}
              {datos.musculos.length === 1 ? "músculo trabajado" : "músculos trabajados"}
            </p>
            {datos.desde && (
              <p data-testid="balance-desde" className="text-xs text-ink-muted">
                Desde el {etiquetaDeFecha(new Date(datos.desde))}
              </p>
            )}
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <MapaCorporal musculos={datos.musculos} />

            <ul aria-label="Series por músculo" className="flex flex-col gap-2">
              {datos.musculos.map((m) => (
                <li key={m.musculo} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-ink-soft">{m.etiqueta}</span>
                  <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                    <span
                      data-testid="balance-barra"
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.round(m.intensidad * 100)}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-ink">
                    {textoDeSeries(m.series)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 text-xs text-ink-muted">
            {datos.sinTrabajar.length > 0 && (
              <p data-testid="balance-sin-trabajar">
                Sin trabajar en este período: {datos.sinTrabajar.map((m) => ETIQUETAS_MUSCULO[m]).join(", ")}
              </p>
            )}
            <p>Un músculo que acompaña al principal cuenta {String(PESO_SECUNDARIO).replace(".", ",")} series.</p>
            <div className="flex items-center gap-2" aria-hidden="true">
              <span>Menos series</span>
              {COLORES_POR_NIVEL.map((color) => (
                <span
                  key={color}
                  className="inline-block h-3 w-5 rounded-sm border border-border"
                  style={{ backgroundColor: color }}
                />
              ))}
              <span>Más series</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
