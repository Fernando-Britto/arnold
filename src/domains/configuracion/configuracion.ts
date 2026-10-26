/**
 * Campos configurables del sistema y su validación (T-043b, D-54).
 *
 * Puro: sin Prisma ni React. El panel de parámetros y la API `/api/configuracion` comparten
 * estas mismas reglas, así el rango válido vive en un solo lugar.
 */

/** Campos que el Administrador puede cambiar, con su tipo y rango. El orden fija el de validación. */
export const CAMPOS_CONFIGURACION = {
  capacidadMaxima: { tipo: "entero", min: 1, max: 10000 },
  periodoGracia: { tipo: "entero", min: 0, max: 30 },
  diasInactividad: { tipo: "entero", min: 1, max: 365 },
  ventanaAforoMinutos: { tipo: "entero", min: 5, max: 720 },
  diaLimitePago: { tipo: "entero", min: 1, max: 31 },
  diaCorteAltaTardia: { tipo: "entero", min: 1, max: 31 },
  antiPassbackMinutos: { tipo: "entero", min: 0, max: 720 },
  descuentoReactivacion: { tipo: "decimal", min: 1, max: 50 },
  ofertaReactivacionActiva: { tipo: "booleano" },
  diasSinAsistirParaOferta: { tipo: "entero", min: 7, max: 365 },
  enfriamientoOfertaDias: { tipo: "entero", min: 0, max: 730 },
  segundosEjecucionSerie: { tipo: "entero", min: 1, max: 3600 },
  minutosVencimientoReserva: { tipo: "entero", min: 0, max: 1440 },
  minutosInactividadSesion: { tipo: "entero", min: 1, max: 1440 },
} as const;

export type CampoConfiguracion = keyof typeof CAMPOS_CONFIGURACION;

/** Cambios ya validados: solo las claves enviadas, con su valor tal cual llegó. */
export type CambiosConfiguracion = Partial<Record<CampoConfiguracion, number | boolean>>;

export type ResultadoValidacion =
  | { ok: true; cambios: CambiosConfiguracion }
  | { ok: false; message: string };

/**
 * Valida el cuerpo del PUT /api/configuracion. Un objeto vacío es válido (no cambia nada).
 * Una clave desconocida se rechaza en vez de ignorarse: un typo no debe pasar silencioso.
 * Devuelve el primer error, recorriendo los campos en el orden de `CAMPOS_CONFIGURACION`.
 */
export function validarCambiosConfiguracion(input: unknown): ResultadoValidacion {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, message: "Se esperaba un objeto con los campos a actualizar" };
  }
  const cuerpo = input as Record<string, unknown>;

  for (const clave of Object.keys(cuerpo)) {
    if (!Object.hasOwn(CAMPOS_CONFIGURACION, clave)) {
      return { ok: false, message: `Campo desconocido: ${clave}` };
    }
  }

  const cambios: CambiosConfiguracion = {};
  for (const campo of Object.keys(CAMPOS_CONFIGURACION) as CampoConfiguracion[]) {
    if (!Object.hasOwn(cuerpo, campo)) continue;
    const spec = CAMPOS_CONFIGURACION[campo];
    const valor = cuerpo[campo];

    if (spec.tipo === "booleano") {
      if (typeof valor !== "boolean") {
        return { ok: false, message: `${campo} debe ser verdadero o falso` };
      }
      cambios[campo] = valor;
      continue;
    }

    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      return { ok: false, message: `${campo} debe ser un número` };
    }
    if (spec.tipo === "entero" && !Number.isInteger(valor)) {
      return { ok: false, message: `${campo} debe ser un número entero` };
    }
    if (valor < spec.min || valor > spec.max) {
      return { ok: false, message: `${campo} debe estar entre ${spec.min} y ${spec.max}` };
    }
    cambios[campo] = valor;
  }

  return { ok: true, cambios };
}
