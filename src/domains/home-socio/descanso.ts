/**
 * Cronómetro de descanso (D-44/D-48, T-038). Función PURA: no usa Prisma ni React.
 *
 * El descanso no se lleva con un contador en memoria: se calcula a partir de la hora de
 * inicio guardada (la `fecha` de la última serie registrada) y el `descanso` del ejercicio.
 * Así sobrevive a una recarga de la página o a un celular bloqueado.
 */

export interface EstadoDescanso {
  /** Segundos que faltan para terminar el descanso (nunca negativo). */
  restanteSegundos: number;
  expirado: boolean;
}

/** Ajustes de la pantalla de entrenamiento: sumar/restar 15 s y pausar el cronómetro. */
export interface OpcionesDescanso {
  /** Segundos agregados (o quitados, si es negativo) al descanso del ejercicio. */
  ajusteSegundos?: number;
  /** Tiempo que el cronómetro estuvo pausado; se descuenta de lo transcurrido. */
  pausadoMs?: number;
}

/**
 * Tiempo restante del descanso. Si el reloj va para atrás (ahora < inicio), se trata como
 * "recién iniciado" y se devuelve el descanso completo, nunca más que eso.
 *
 * `ajusteSegundos` mueve el total (±15 s) y `pausadoMs` congela lo transcurrido mientras el
 * socio mantiene el descanso en pausa. Sin opciones se comporta igual que antes.
 */
export function calcularDescanso(
  inicio: Date,
  descansoSegundos: number,
  ahora: Date,
  opciones: OpcionesDescanso = {}
): EstadoDescanso {
  const total = Math.max(0, descansoSegundos + (opciones.ajusteSegundos ?? 0));
  const pausadoMs = Math.max(0, opciones.pausadoMs ?? 0);
  const transcurridos = Math.floor((ahora.getTime() - inicio.getTime() - pausadoMs) / 1000);
  const transcurridosClamped = Math.max(0, transcurridos);
  const restante = Math.max(0, total - transcurridosClamped);
  return { restanteSegundos: restante, expirado: restante <= 0 };
}

/** Formatea segundos como M:SS (por ejemplo 75 -> "1:15", 9 -> "0:09"). */
export function formatearDescanso(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos}:${resto.toString().padStart(2, "0")}`;
}
