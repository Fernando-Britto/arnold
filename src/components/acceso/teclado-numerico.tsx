"use client";

import React from "react";

const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

interface TecladoNumericoProps {
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  deshabilitado?: boolean;
}

/**
 * Teclado numérico grande para el kiosco de acceso (T-035). Cada tecla es un botón con
 * nombre accesible (el dígito o "Borrar") para que la pantalla sea operable y accesible.
 */
export function TecladoNumerico({ onDigito, onBorrar, deshabilitado = false }: TecladoNumericoProps) {
  const base =
    "flex h-16 items-center justify-center rounded-lg border border-gray-300 bg-white text-2xl font-semibold text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div role="group" aria-label="Teclado numérico" className="grid w-full max-w-xs grid-cols-3 gap-3">
      {DIGITOS.map((digito) => (
        <button
          key={digito}
          type="button"
          aria-label={digito}
          disabled={deshabilitado}
          onClick={() => onDigito(digito)}
          className={base}
        >
          {digito}
        </button>
      ))}
      <button
        type="button"
        aria-label="Borrar"
        disabled={deshabilitado}
        onClick={onBorrar}
        className={base}
      >
        ⌫
      </button>
    </div>
  );
}
