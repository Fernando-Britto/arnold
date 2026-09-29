"use client";

import React from "react";
import { Dumbbell, Flame } from "lucide-react";
import type { DiaCalendario } from "@/domains/home-socio/home-socio";

/**
 * RachaSemanal — weekly streak for Fila3 of Home_Socio.
 * Matches Home_Socio_1x design: flame + streak in weeks, history link, and a
 * Mon–Sun calendar (attended day = filled icon, today = ring, else number).
 * AC-006: the calendar is the calendar week, built by buildSemanaCalendario.
 *
 * SCHEMA GAP (documented): the design shows different icons per activity type
 * (dumbbell vs. running) but nothing in the schema records an activity type
 * for an Asistencia/sesión, so every attended day uses the dumbbell.
 */
export interface RachaSemanalProps {
  semanasRacha: number;
  /** Exactly 7 entries, Monday first. */
  dias: DiaCalendario[];
  onVerHistorial?: () => void;
}

const DIAS_LABEL = ["L", "M", "X", "J", "V", "S", "D"];

export function RachaSemanal({ semanasRacha, dias, onVerHistorial }: RachaSemanalProps) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center gap-10">
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Flame className="h-8 w-8 text-[#FC4C02]" aria-hidden="true" />
              <p data-testid="racha-count" className="text-[40px] font-bold text-zinc-900">
                {semanasRacha}
              </p>
            </div>
            <p className="text-[13px] text-zinc-500">
              {semanasRacha === 1 ? "Semana" : "Semanas"}
            </p>
          </div>
          <button
            type="button"
            onClick={onVerHistorial}
            className="text-sm font-bold text-[#FC4C02]"
          >
            Ver mi historial completo →
          </button>
        </div>

        <div className="flex gap-4">
          {dias.map((dia, i) => {
            const estado = dia.asistio ? "asistio" : dia.esHoy ? "hoy" : "libre";
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <p className="text-[11px] font-medium text-zinc-500">{DIAS_LABEL[i]}</p>
                <div
                  data-testid="dia-celda"
                  data-estado={estado}
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    estado === "asistio"
                      ? "bg-[#FC4C02]"
                      : estado === "hoy"
                        ? "border-2 border-[#FC4C02]"
                        : "border border-zinc-200"
                  }`}
                >
                  {estado === "asistio" ? (
                    <Dumbbell className="h-5 w-5 text-white" aria-hidden="true" />
                  ) : (
                    <span
                      className={`text-[15px] ${
                        estado === "hoy" ? "font-bold text-[#FC4C02]" : "font-medium text-zinc-500"
                      }`}
                    >
                      {dia.numero}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
