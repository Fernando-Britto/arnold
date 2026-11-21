"use client";

import React, { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { EjercicioDeSesionDTO, SerieMarcaDTO } from "@/api/sesiones";
import {
  ETIQUETAS_TIPO_SERIE,
  TIPOS_ELEGIBLES,
  type TipoSerie,
} from "@/domains/sesion/tipo-serie";
import { DropsDeSerie, type DropEnEdicion } from "./drops-de-serie";
import { RecordEnVivo } from "./record-en-vivo";

/** Disco de peso por defecto del stepper, en kg (mismo que la pantalla de ejecución). */
export const INCREMENTO_KG_DEFAULT = 2.5;

export interface RegistroSerieProps {
  ejercicio: EjercicioDeSesionDTO;
  serieActual: number;
  repeticiones: number;
  onRepeticiones: (n: number) => void;
  carga: number;
  onCarga: (n: number) => void;
  rir: number;
  onRir: (n: number) => void;
  tipo: TipoSerie;
  onTipo: (t: TipoSerie) => void;
  drops: DropEnEdicion[];
  onDrops: (drops: DropEnEdicion[]) => void;
  enviando: boolean;
  error: string | null;
  /** Recibe los valores efectivos del formulario (incluye el borrador en foco). */
  onRegistrar: (valores: { repeticiones: number; carga: number }) => void;
  records: SerieMarcaDTO[];
  /** Disco del stepper de peso, en kg. */
  incrementoKg?: number;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Repeticiones siempre enteras y al menos una. */
function acotarRepeticiones(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1;
}

/** Peso nunca negativo; se permiten decimales. */
function acotarCarga(n: number): number {
  return Number.isFinite(n) ? Math.max(0, redondear(n)) : 0;
}

const BOTON_REDONDO =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-soft disabled:text-ink-disabled";

/**
 * Columna derecha del entrenamiento: la serie que se está por registrar. Repeticiones y peso se
 * editan en el momento (con borrador local y confirmación al salir del campo) o con los steppers;
 * RIR y tipo se eligen con botones. Los drops y el récord en vivo cuelgan de esta tarjeta.
 */
export function RegistroSerie({
  ejercicio,
  serieActual,
  repeticiones,
  onRepeticiones,
  carga,
  onCarga,
  rir,
  onRir,
  tipo,
  onTipo,
  drops,
  onDrops,
  enviando,
  error,
  onRegistrar,
  records,
  incrementoKg = INCREMENTO_KG_DEFAULT,
}: RegistroSerieProps) {
  // Mientras el campo tiene foco se muestra un borrador de texto; sin foco manda el valor del
  // padre (los steppers lo cambian y el input se actualiza solo).
  const [repsEnFoco, setRepsEnFoco] = useState(false);
  const [repsBorrador, setRepsBorrador] = useState("");
  const [cargaEnFoco, setCargaEnFoco] = useState(false);
  const [cargaBorrador, setCargaBorrador] = useState("");

  const repsTexto = repsEnFoco ? repsBorrador : String(repeticiones);
  const cargaTexto = cargaEnFoco ? cargaBorrador : String(carga);

  const confirmarRepeticiones = () => {
    const valor = acotarRepeticiones(Number.parseInt(repsBorrador, 10));
    setRepsEnFoco(false);
    onRepeticiones(valor);
  };

  const confirmarCarga = () => {
    const valor = acotarCarga(Number.parseFloat(cargaBorrador.replace(",", ".")));
    setCargaEnFoco(false);
    onCarga(valor);
  };

  // Valores efectivos: si el campo tiene foco manda el borrador. Los steppers y el botón usan
  // estos valores, así una edición seguida de un clic no se pierde por el orden blur → click.
  const repsEfectivas = repsEnFoco
    ? acotarRepeticiones(Number.parseInt(repsBorrador, 10))
    : repeticiones;
  const cargaEfectiva = cargaEnFoco
    ? acotarCarga(Number.parseFloat(cargaBorrador.replace(",", ".")))
    : carga;

  const ajustarRepeticiones = (delta: number) => {
    setRepsEnFoco(false);
    onRepeticiones(acotarRepeticiones(repsEfectivas + delta));
  };

  const ajustarCarga = (delta: number) => {
    setCargaEnFoco(false);
    onCarga(acotarCarga(redondear(cargaEfectiva + delta)));
  };

  const registrar = () => {
    setRepsEnFoco(false);
    setCargaEnFoco(false);
    onRepeticiones(repsEfectivas);
    onCarga(cargaEfectiva);
    onRegistrar({ repeticiones: repsEfectivas, carga: cargaEfectiva });
  };

  return (
    <section
      data-testid="registro-serie"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">Registro de serie</h3>
        <p className="text-sm font-semibold text-ink-muted">
          Serie {serieActual} de {ejercicio.series}
        </p>
      </div>

      <ol aria-label="Progreso de series" className="flex flex-wrap gap-1.5">
        {Array.from({ length: ejercicio.series }, (_, i) => i + 1).map((n) => {
          const estado = n < serieActual ? "completada" : n === serieActual ? "actual" : "pendiente";
          const clase =
            estado === "completada"
              ? "border-success bg-success-soft text-success"
              : estado === "actual"
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-border bg-surface-subtle text-ink-muted";
          return (
            <li
              key={n}
              data-estado={estado}
              aria-label={`Serie ${n} ${estado}`}
              aria-current={estado === "actual" ? "step" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${clase}`}
            >
              {estado === "completada" ? "✓" : n}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3">
          <span className="text-xs font-bold text-ink-muted">REPETICIONES</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ajustarRepeticiones(-1)}
              aria-label="Restar una repetición"
              className={BOTON_REDONDO}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={repsTexto}
              onFocus={() => {
                setRepsEnFoco(true);
                setRepsBorrador(String(repeticiones));
              }}
              onChange={(e) => setRepsBorrador(e.target.value)}
              onBlur={confirmarRepeticiones}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Repeticiones"
              className="w-16 rounded-md bg-transparent text-center text-3xl font-black tabular-nums text-ink outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="button"
              onClick={() => ajustarRepeticiones(1)}
              aria-label="Sumar una repetición"
              className={BOTON_REDONDO}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3">
          <span className="text-xs font-bold text-ink-muted">PESO (KG)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ajustarCarga(-incrementoKg)}
              aria-label="Restar peso"
              className={BOTON_REDONDO}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={cargaTexto}
              onFocus={() => {
                setCargaEnFoco(true);
                setCargaBorrador(String(carga));
              }}
              onChange={(e) => setCargaBorrador(e.target.value)}
              onBlur={confirmarCarga}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Peso (kg)"
              className="w-20 rounded-md bg-transparent text-center text-3xl font-black tabular-nums text-ink outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="button"
              onClick={() => ajustarCarga(incrementoKg)}
              aria-label="Sumar peso"
              className={BOTON_REDONDO}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {tipo !== "CALENTAMIENTO" && <RecordEnVivo frontera={records} carga={carga} />}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-ink-muted">RIR (repeticiones en reserva)</span>
        <div role="group" aria-label="RIR" className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => onRir(valor)}
              aria-label={`RIR ${valor}`}
              aria-pressed={rir === valor}
              className={`h-10 w-10 rounded-lg border text-sm font-bold ${
                rir === valor
                  ? "border-brand bg-brand-soft text-brand-deep"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              {valor}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-ink-muted">TIPO DE SERIE</span>
        <div role="group" aria-label="Tipo de serie" className="flex flex-wrap gap-2">
          {TIPOS_ELEGIBLES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => onTipo(opcion)}
              aria-pressed={tipo === opcion}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                tipo === opcion
                  ? "border-brand bg-brand-soft text-brand-deep"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              {ETIQUETAS_TIPO_SERIE[opcion]}
            </button>
          ))}
        </div>
        {tipo === "CALENTAMIENTO" && (
          <p className="text-xs text-ink-muted">
            No cuenta como una de las series de la rutina ni para tu progreso.
          </p>
        )}
      </div>

      {tipo !== "CALENTAMIENTO" && (
        <DropsDeSerie
          drops={drops}
          onChange={onDrops}
          cargaBase={carga}
          repeticionesBase={repeticiones}
          deshabilitado={enviando}
        />
      )}

      {error && (
        <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={registrar}
        disabled={enviando}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-strong text-[15px] font-bold text-surface disabled:bg-ink-disabled"
      >
        <Check className="h-[18px] w-[18px]" aria-hidden="true" />
        {enviando
          ? "Guardando…"
          : tipo === "CALENTAMIENTO"
            ? "Calentamiento hecho"
            : "✓ Serie hecha"}
      </button>
    </section>
  );
}
