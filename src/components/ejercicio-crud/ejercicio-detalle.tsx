"use client";

import React, { useEffect, useState } from "react";
import { fetchEjercicio } from "@/api/ejercicios";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { AtribucionMedia, EjercicioVideo } from "./ejercicio-media";

const ETIQUETA = "text-[11px] font-bold uppercase text-[#C13D00]";
const VALOR = "text-sm text-[#333333]";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div>
      <dt className={ETIQUETA}>{etiqueta}</dt>
      <dd className={VALOR}>{valor}</dd>
    </div>
  );
}

/** Instrucciones pedidas para un ejercicio concreto; `id` evita mostrarlas bajo otro ejercicio. */
type Carga = { id: string; pasos: string[] | null };

/**
 * Detalle de un ejercicio dentro del listado (T-050e4, D-70): animación, equipamiento, músculos,
 * descripción e instrucciones. El listado no trae las instrucciones (pesan el 66 % del catálogo),
 * así que se piden acá, y solo para ejercicios del catálogo: uno cargado a mano no tiene.
 */
export function EjercicioDetalle({ ejercicio }: { ejercicio: EjercicioConUso }) {
  const delCatalogo = Boolean(ejercicio.datasetId);
  const yaTraeInstrucciones = (ejercicio.instrucciones?.length ?? 0) > 0;
  const [carga, setCarga] = useState<Carga | null>(null);

  useEffect(() => {
    if (!delCatalogo || yaTraeInstrucciones) return;
    // Si el usuario pasa a otro ejercicio antes de que responda, la respuesta vieja se descarta.
    let vigente = true;
    fetchEjercicio(ejercicio.id).then(
      (completo) => { if (vigente) setCarga({ id: ejercicio.id, pasos: completo.instrucciones }); },
      () => { if (vigente) setCarga({ id: ejercicio.id, pasos: null }); }
    );
    return () => { vigente = false; };
  }, [ejercicio.id, delCatalogo, yaTraeInstrucciones]);

  const cargaActual = carga?.id === ejercicio.id ? carga : null;
  const pasos = yaTraeInstrucciones ? (ejercicio.instrucciones ?? []) : (cargaActual?.pasos ?? null);
  const fallo = delCatalogo && !yaTraeInstrucciones && cargaActual !== null && cargaActual.pasos === null;
  const cargando = delCatalogo && !yaTraeInstrucciones && cargaActual === null;
  const secundarios = ejercicio.musculosSecundarios?.join(", ");

  return (
    <div className="flex flex-wrap gap-6">
      {ejercicio.mediaId && (
        <div className="flex flex-col gap-1">
          <EjercicioVideo mediaId={ejercicio.mediaId} nombre={ejercicio.nombre} />
          <AtribucionMedia />
        </div>
      )}
      <div className="flex min-w-[240px] flex-1 flex-col gap-3">
        <dl className="flex flex-col gap-3">
          <Dato etiqueta="Equipamiento" valor={ejercicio.equipamiento} />
          <Dato etiqueta="Músculo principal" valor={ejercicio.musculoObjetivo} />
          <Dato etiqueta="Músculos secundarios" valor={secundarios} />
        </dl>
        <div>
          <p className={ETIQUETA}>Descripción</p>
          <p className={VALOR}>{ejercicio.descripcion || "-"}</p>
        </div>
        {(delCatalogo || (pasos?.length ?? 0) > 0) && (
          <div>
            <p className={ETIQUETA}>Instrucciones</p>
            {cargando && <p className="text-sm text-[#71717A]">Cargando instrucciones…</p>}
            {fallo && <p className="text-sm text-[#B42318]">No se pudieron cargar las instrucciones.</p>}
            {pasos && pasos.length > 0 && (
              <ol className={`${VALOR} list-decimal space-y-1 pl-5`}>
                {pasos.map((paso, i) => (
                  <li key={i}>{paso}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
