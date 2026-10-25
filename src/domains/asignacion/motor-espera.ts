export type EstadoMaquina = "DISPONIBLE" | "OCUPADA" | "FUERA_DE_SERVICIO" | "INACTIVA";

/** Códigos de bloqueo emitidos; los candidatos vacíos no se bloquean. */
export type MotivoBloqueo = "TODAS_FUERA_DE_SERVICIO" | "TODAS_INACTIVAS" | "SIN_MAQUINA_USABLE";

export interface EjercicioPendiente {
  id: string;
  orden: number;
  series: number;
  descanso: number;
  candidatos: string[];
}

export interface Ocupante {
  seriesRestantes: number;
  descanso: number;
}

export interface ColaMiembro {
  series: number;
  descanso: number;
}

export interface MaquinaEnGimnasio {
  id: string;
  estado: EstadoMaquina;
  ocupante: Ocupante | null;
  cola: ColaMiembro[];
}

export interface ParametrosMotor {
  segundosEjecucionSerie: number;
}

export interface EntradaMotor {
  ejercicios: EjercicioPendiente[];
  maquinas: MaquinaEnGimnasio[];
  parametros: ParametrosMotor;
}

export interface Bloqueado {
  ejercicioId: string;
  motivo: MotivoBloqueo;
}

export interface Sugerencia {
  ejercicioId: string;
  espera: number;
  maquinaId: string | null;
}

export type ResultadoMotor =
  | { tipo: "invalido"; errores: string[] }
  | {
      tipo: "exito";
      recomendado: Sugerencia;
      siguienteEnOrden: Sugerencia;
      ahorro: number;
      bloqueados: Bloqueado[];
    }
  | { tipo: "sin_opciones"; bloqueados: Bloqueado[] }
  | { tipo: "vacio" };

/** La ocupación real la aporta `ocupante`; por eso una fila OCUPADA heredada sigue siendo usable. */
export function esMaquinaUsable(estado: EstadoMaquina): boolean {
  return estado === "DISPONIBLE" || estado === "OCUPADA";
}

function validar(entrada: EntradaMotor): string[] {
  const errores: string[] = [];

  for (const pendiente of entrada.ejercicios) {
    if (pendiente.series < 1) {
      errores.push(`El ejercicio ${pendiente.id} debe tener al menos una serie`);
    }
    if (pendiente.descanso < 0) {
      errores.push(`El descanso del ejercicio ${pendiente.id} no puede ser negativo`);
    }
  }

  for (const maquina of entrada.maquinas) {
    if (maquina.ocupante && maquina.ocupante.descanso < 0) {
      errores.push(`El descanso del ocupante de ${maquina.id} no puede ser negativo`);
    }
    for (const miembro of maquina.cola) {
      if (miembro.descanso < 0) {
        errores.push(`El descanso de un miembro de la cola de ${maquina.id} no puede ser negativo`);
      }
    }
  }

  if (entrada.parametros.segundosEjecucionSerie <= 0) {
    errores.push("La duración de la serie debe ser mayor que cero");
  }

  return errores;
}

function esperaDeMaquina(maquina: MaquinaEnGimnasio, segundosPorSerie: number): number {
  let espera = 0;
  if (maquina.ocupante) {
    espera +=
      maquina.ocupante.seriesRestantes * segundosPorSerie +
      (maquina.ocupante.seriesRestantes - 1) * maquina.ocupante.descanso;
  }
  for (const miembro of maquina.cola) {
    espera += miembro.series * segundosPorSerie + (miembro.series - 1) * miembro.descanso;
  }
  return espera;
}

function clasificarMotivo(candidatas: MaquinaEnGimnasio[]): MotivoBloqueo {
  const hayFueraDeServicio = candidatas.some(
    (maquina) => maquina.estado === "FUERA_DE_SERVICIO"
  );
  const hayInactiva = candidatas.some((maquina) => maquina.estado === "INACTIVA");

  if (hayFueraDeServicio && hayInactiva) return "SIN_MAQUINA_USABLE";
  if (hayFueraDeServicio) return "TODAS_FUERA_DE_SERVICIO";
  if (hayInactiva) return "TODAS_INACTIVAS";
  return "SIN_MAQUINA_USABLE";
}

interface Candidata {
  maquina: MaquinaEnGimnasio;
  posicion: number;
  espera: number;
}

function compararCandidata(a: Candidata, b: Candidata): number {
  if (a.espera !== b.espera) return a.espera - b.espera;
  if (a.posicion !== b.posicion) return a.posicion - b.posicion;
  if (a.maquina.id < b.maquina.id) return -1;
  if (a.maquina.id > b.maquina.id) return 1;
  return 0;
}

interface Evaluado {
  ejercicio: EjercicioPendiente;
  posicion: number;
  espera: number;
  maquinaId: string | null;
}

function sugerencia(evaluado: Evaluado): Sugerencia {
  return {
    ejercicioId: evaluado.ejercicio.id,
    espera: evaluado.espera,
    maquinaId: evaluado.maquinaId,
  };
}

function compararPorOrdenPosicionId(a: Evaluado, b: Evaluado): number {
  if (a.ejercicio.orden !== b.ejercicio.orden) return a.ejercicio.orden - b.ejercicio.orden;
  if (a.posicion !== b.posicion) return a.posicion - b.posicion;
  if (a.ejercicio.id < b.ejercicio.id) return -1;
  if (a.ejercicio.id > b.ejercicio.id) return 1;
  return 0;
}

function compararParaRecomendado(a: Evaluado, b: Evaluado): number {
  if (a.espera !== b.espera) return a.espera - b.espera;
  return compararPorOrdenPosicionId(a, b);
}

function mejorPor(
  evaluados: Evaluado[],
  comparar: (a: Evaluado, b: Evaluado) => number
): Evaluado {
  return evaluados.reduce((mejor, actual) => (comparar(actual, mejor) < 0 ? actual : mejor));
}

export function calcularEspera(entrada: EntradaMotor): ResultadoMotor {
  const errores = validar(entrada);
  if (errores.length > 0) return { tipo: "invalido", errores };

  if (entrada.ejercicios.length === 0) return { tipo: "vacio" };

  const maquinasPorId = new Map(entrada.maquinas.map((maquina) => [maquina.id, maquina]));
  const segundosPorSerie = entrada.parametros.segundosEjecucionSerie;
  const libres: Evaluado[] = [];
  const bloqueados: Bloqueado[] = [];

  entrada.ejercicios.forEach((ejercicio, posicion) => {
    const presentes: Candidata[] = [];
    ejercicio.candidatos.forEach((id, posicionCandidata) => {
      const maquina = maquinasPorId.get(id);
      if (maquina) {
        presentes.push({
          maquina,
          posicion: posicionCandidata,
          espera: esperaDeMaquina(maquina, segundosPorSerie),
        });
      }
    });

    if (ejercicio.candidatos.length === 0) {
      libres.push({ ejercicio, posicion, espera: 0, maquinaId: null });
      return;
    }

    const usables = presentes.filter((candidata) => esMaquinaUsable(candidata.maquina.estado));

    if (usables.length === 0) {
      bloqueados.push({
        ejercicioId: ejercicio.id,
        motivo: clasificarMotivo(presentes.map((candidata) => candidata.maquina)),
      });
      return;
    }

    const elegida = usables.reduce((mejor, actual) =>
      compararCandidata(actual, mejor) < 0 ? actual : mejor
    );

    libres.push({
      ejercicio,
      posicion,
      espera: elegida.espera,
      maquinaId: elegida.maquina.id,
    });
  });

  if (libres.length === 0) return { tipo: "sin_opciones", bloqueados };

  const recomendado = mejorPor(libres, compararParaRecomendado);
  const siguienteEnOrden = mejorPor(libres, compararPorOrdenPosicionId);

  return {
    tipo: "exito",
    recomendado: sugerencia(recomendado),
    siguienteEnOrden: sugerencia(siguienteEnOrden),
    ahorro: siguienteEnOrden.espera - recomendado.espera,
    bloqueados,
  };
}
