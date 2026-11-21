"use client";

import React from "react";
import { ETIQUETAS_TIPO_SERIE, type TipoSerie } from "@/domains/sesion/tipo-serie";
import { Table, TableCell, TableHeader, TableRow, type TableColumn } from "@/components/ui/table";

/** Una serie registrada en esta sesión (se pierde al recargar la página). */
export interface SerieLocal {
  /** `null` en un calentamiento: no es una de las series de la rutina. */
  numeroSerie: number | null;
  carga: number;
  repeticiones: number;
  rir: number | null;
  tipo: TipoSerie;
  /** Cantidad de drop sets que colgaron de esta serie. */
  drops: number;
}

export interface HistorialSeriesProps {
  /** Series que pide el ejercicio. */
  planificadas: number;
  /** Repeticiones prescriptas, para las series que todavía no se hicieron. */
  repeticionesPlanificadas: number;
  /** Serie en curso (1-based); `null` si no hay una ubicación válida. */
  serieActual: number | null;
  historial: SerieLocal[];
}

const COLUMNAS: TableColumn[] = [
  { key: "serie", label: "Serie", width: 64 },
  { key: "repeticiones", label: "Repeticiones", width: 120 },
  { key: "peso", label: "Peso", width: 100 },
  { key: "rir", label: "RIR", width: 64 },
  { key: "tipo", label: "Tipo" },
];

const GUION = "—";

function tipoLegible(tipo: TipoSerie): string {
  return ETIQUETAS_TIPO_SERIE[tipo];
}

interface Fila {
  clave: string;
  serie: string;
  repeticiones: string;
  peso: string;
  rir: string;
  tipo: string;
}

/**
 * Historial de las series del ejercicio actual. Las series hechas en esta sesión muestran sus
 * valores reales; las anteriores a una recarga quedan como realizadas sin datos (`—`). Las
 * pendientes muestran solo las repeticiones prescriptas. Los calentamientos van al final.
 */
export function HistorialSeries({
  planificadas,
  repeticionesPlanificadas,
  serieActual,
  historial,
}: HistorialSeriesProps) {
  const filas: Fila[] = [];
  let haySeriesSinDatos = false;

  for (let n = 1; n <= planificadas; n++) {
    const local = historial.find((serie) => serie.numeroSerie === n);
    if (local) {
      filas.push({
        clave: `serie-${n}`,
        serie: String(n),
        repeticiones: String(local.repeticiones),
        peso: `${local.carga} kg`,
        rir: local.rir === null ? GUION : String(local.rir),
        tipo:
          local.drops > 0
            ? `${tipoLegible(local.tipo)} · ${local.drops} drops`
            : tipoLegible(local.tipo),
      });
    } else if (serieActual !== null && n < serieActual) {
      // La serie está hecha según la sesión, pero su detalle se perdió al recargar.
      haySeriesSinDatos = true;
      filas.push({
        clave: `serie-${n}`,
        serie: String(n),
        repeticiones: GUION,
        peso: GUION,
        rir: GUION,
        tipo: GUION,
      });
    } else {
      filas.push({
        clave: `serie-${n}`,
        serie: String(n),
        repeticiones: String(repeticionesPlanificadas),
        peso: GUION,
        rir: GUION,
        tipo: GUION,
      });
    }
  }

  for (const [indice, calentamiento] of historial
    .filter((serie) => serie.numeroSerie === null)
    .entries()) {
    filas.push({
      clave: `calentamiento-${indice}`,
      serie: GUION,
      repeticiones: String(calentamiento.repeticiones),
      peso: `${calentamiento.carga} kg`,
      rir: calentamiento.rir === null ? GUION : String(calentamiento.rir),
      tipo:
        calentamiento.drops > 0
          ? `${tipoLegible(calentamiento.tipo)} · ${calentamiento.drops} drops`
          : tipoLegible(calentamiento.tipo),
    });
  }

  return (
    <section
      data-testid="historial-series"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="text-lg font-bold text-ink">Historial de series</h3>
      {filas.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no registraste series de este ejercicio.</p>
      ) : (
        <Table label="Historial de series del ejercicio">
          <TableHeader columns={COLUMNAS} />
          {filas.map((fila) => (
            <TableRow key={fila.clave}>
              <TableCell width={64}>{fila.serie}</TableCell>
              <TableCell width={120}>{fila.repeticiones}</TableCell>
              <TableCell width={100}>{fila.peso}</TableCell>
              <TableCell width={64}>{fila.rir}</TableCell>
              <TableCell>{fila.tipo}</TableCell>
            </TableRow>
          ))}
        </Table>
      )}
      {haySeriesSinDatos && (
        <p className="text-xs text-ink-muted">
          Las series anteriores a la recarga no tienen valores disponibles.
        </p>
      )}
    </section>
  );
}
