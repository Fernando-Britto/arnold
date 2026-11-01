import type { Configuracion } from "@/lib/configuracion";
import { getConfiguracion } from "@/lib/configuracion";
import type { EntradaMotor, EstadoMaquina } from "./motor-espera";
import type {
  AsignacionDb,
  AsignacionLecturasBase,
  CargadorDb,
  EjercicioDeRutinaLeido,
  EstadoAsignacionPersistido,
  EntradaLeida,
  LecturaEntrada,
  RutinaActivaLeida,
  SugerenciaVigenteLeida,
  UltimaAsignacionLeida,
} from "./asignacion-puerto";
import { SERIES_DE_TRABAJO, anomalia, getPrisma } from "./asignacion-puerto";
import { aplicarCola, aplicarOcupantes, contarSeriesValidas } from "./asignacion-ocupacion";

/** Rutina activa tal como la devuelve el `select` de Prisma. */
interface FilaRutinaActiva {
  id: string;
  rutina: {
    ejercicios: Array<{
      ejercicioId: string;
      series: number;
      descanso: number;
      orden: number;
      ejercicio: { nombre: string };
    }>;
  };
}

interface FilaCandidato {
  ejercicioId: string;
  maquinaId: string;
}

interface FilaSesion {
  id: string;
  ejercicioActualId: string | null;
}

interface FilaMaquina {
  id: string;
  estado: EstadoMaquina;
}

interface FilaSugerencia {
  id: string;
  socioId: string;
  ejercicioId: string;
  maquinaId: string | null;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: Date;
  venceEn: Date;
  ejercicio: { nombre: string };
  maquina: { nombre: string } | null;
}

interface FilaUltimaAsignacion {
  estado: EstadoAsignacionPersistido;
  creadaEn: Date;
}

export class AsignacionLecturas implements AsignacionLecturasBase {
  constructor(private readonly cargar: CargadorDb = getPrisma) {}
  private db(db?: AsignacionDb): Promise<AsignacionDb> {
    return db ? Promise.resolve(db) : this.cargar();
  }
  async leerEntradaMotor(lectura: LecturaEntrada, dbInyectada?: AsignacionDb): Promise<EntradaLeida | null> {
    const db = await this.db(dbInyectada);
    const rutina = await this.leerRutinaActiva(lectura.socioId, db);
    if (!rutina) return null;

    const candidatos = await this.leerCandidatos(rutina.ejercicios.map((e) => e.ejercicioId), db);

    for (const ejercicio of rutina.ejercicios) {
      ejercicio.candidatos = candidatos.get(ejercicio.ejercicioId) ?? [];
    }

    const sesion = await this.leerSesionEnCurso(lectura.socioId, db);
    const seriesHechas = sesion
      ? await this.leerSeriesDeTrabajo(sesion.id, db)
      : new Map<string, number[]>();

    const excluidos = new Set(lectura.excluirEjercicioIds);
    if (sesion?.ejercicioActualId) excluidos.add(sesion.ejercicioActualId);

    const pendientes = rutina.ejercicios.filter((ejercicio) => {
      if (excluidos.has(ejercicio.ejercicioId)) return false;
      const hechas = seriesHechas.get(ejercicio.ejercicioId) ?? [];
      return contarSeriesValidas(hechas, ejercicio.series) < ejercicio.series;
    });

    const configuracion = await this.leerConfiguracion(db);
    const maquinas = await this.leerMaquinas(pendientes, db);
    await aplicarOcupantes(maquinas, lectura, db);
    await aplicarCola(maquinas, lectura, db);

    return {
      entrada: {
        ejercicios: pendientes.map((ejercicio) => ({
          id: ejercicio.ejercicioId,
          orden: ejercicio.orden,
          series: ejercicio.series,
          descanso: ejercicio.descanso,
          candidatos: ejercicio.candidatos,
        })),
        maquinas,
        parametros: { segundosEjecucionSerie: configuracion.segundosEjecucionSerie },
      },
      rutina,
      configuracion,
      ejercicioActualId: sesion?.ejercicioActualId ?? null,
    };
  }
  async leerSugerenciaVigente(
    socioId: string,
    ahora: Date,
    dbInyectada?: AsignacionDb
  ): Promise<SugerenciaVigenteLeida | null> {
    const db = await this.db(dbInyectada);
    const filas = (await db.asignacionDeEjercicio.findMany({
      where: {
        socioId,
        estado: "RESERVADA",
        venceEn: { gt: ahora },
        maquinaId: { not: null },
      },
      orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
      take: 2,
      select: {
        id: true,
        socioId: true,
        ejercicioId: true,
        maquinaId: true,
        esperaSegundos: true,
        ahorroSegundos: true,
        creadaEn: true,
        venceEn: true,
        ejercicio: { select: { nombre: true } },
        maquina: { select: { nombre: true } },
      },
    })) as FilaSugerencia[];

    if (filas.length === 0) return null;
    if (filas.length > 1) anomalia("sugerencias-multiples", { socioId });

    const fila = filas[0];
    return {
      id: fila.id,
      socioId: fila.socioId,
      ejercicioId: fila.ejercicioId,
      ejercicioNombre: fila.ejercicio.nombre,
      maquinaId: fila.maquinaId ?? "",
      maquinaNombre: fila.maquina?.nombre ?? null,
      esperaSegundos: fila.esperaSegundos,
      ahorroSegundos: fila.ahorroSegundos,
      creadaEn: fila.creadaEn,
      venceEn: fila.venceEn,
    };
  }
  async leerUltimaAsignacion(
    socioId: string,
    dbInyectada?: AsignacionDb
  ): Promise<UltimaAsignacionLeida | null> {
    const db = await this.db(dbInyectada);
    const fila = (await db.asignacionDeEjercicio.findFirst({
      where: { socioId },
      orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
      select: { estado: true, creadaEn: true },
    })) as FilaUltimaAsignacion | null;

    return fila ? { estado: fila.estado, creadaEn: fila.creadaEn } : null;
  }
  async leerConfiguracion(dbInyectada?: AsignacionDb): Promise<Configuracion> {
    const db = await this.db(dbInyectada);
    return getConfiguracion(db);
  }

  /** Guarda de capacidad D-103: sin el modelo nuevo (doble de Prisma viejo) no hay cálculo. */
  async tieneRutinaActiva(socioId: string, dbInyectada?: AsignacionDb): Promise<boolean> {
    const db = await this.db(dbInyectada);
    if (!db.asignacionDeEjercicio || typeof db.asignacionDeEjercicio.findFirst !== "function") {
      return false;
    }
    const fila = await db.rutinaAsignada.findFirst({
      where: { socioId, activa: true },
      select: { id: true },
    });
    return fila !== null;
  }
  async resolverSocioPorUsuario(usuarioId: string, dbInyectada?: AsignacionDb): Promise<string | null> {
    const db = await this.db(dbInyectada);
    const fila = (await db.socio.findUnique({
      where: { usuarioId },
      select: { id: true },
    })) as { id: string } | null;
    return fila?.id ?? null;
  }
  async existeSocio(socioId: string, dbInyectada?: AsignacionDb): Promise<boolean> {
    const db = await this.db(dbInyectada);
    const fila = (await db.socio.findUnique({
      where: { id: socioId },
      select: { id: true },
    })) as { id: string } | null;
    return fila !== null;
  }
  private async leerRutinaActiva(
    socioId: string,
    db: AsignacionDb
  ): Promise<RutinaActivaLeida | null> {
    const fila = (await db.rutinaAsignada.findFirst({
      where: { socioId, activa: true },
      orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rutina: {
          select: {
            ejercicios: {
              orderBy: [{ orden: "asc" }, { id: "asc" }],
              select: {
                ejercicioId: true,
                series: true,
                descanso: true,
                orden: true,
                ejercicio: { select: { nombre: true } },
              },
            },
          },
        },
      },
    })) as FilaRutinaActiva | null;

    if (!fila) return null;

    return {
      rutinaAsignadaId: fila.id,
      ejercicios: fila.rutina.ejercicios.map((ejercicio) => ({
        ejercicioId: ejercicio.ejercicioId,
        nombre: ejercicio.ejercicio.nombre,
        orden: ejercicio.orden,
        series: ejercicio.series,
        descanso: ejercicio.descanso,
        candidatos: [],
      })),
    };
  }
  private async leerCandidatos(
    ejercicioIds: string[],
    db: AsignacionDb
  ): Promise<Map<string, string[]>> {
    const filas = (await db.ejercicioMaquina.findMany({
      where: { ejercicioId: { in: ejercicioIds } },
      orderBy: [{ ejercicioId: "asc" }, { maquinaId: "asc" }],
      select: { ejercicioId: true, maquinaId: true },
    })) as FilaCandidato[];

    const porEjercicio = new Map<string, string[]>();
    for (const fila of filas) {
      const lista = porEjercicio.get(fila.ejercicioId) ?? [];
      lista.push(fila.maquinaId);
      porEjercicio.set(fila.ejercicioId, lista);
    }
    // La posición del candidato decide el empate de máquina en el motor (D-85): no se confía en el driver.
    for (const lista of porEjercicio.values()) lista.sort();
    return porEjercicio;
  }
  private async leerSesionEnCurso(socioId: string, db: AsignacionDb): Promise<FilaSesion | null> {
    return (await db.sesionDeEntrenamiento.findFirst({
      where: { socioId, estadoDeFinalizacion: "EN_CURSO" },
      orderBy: { horaInicio: "desc" },
      select: { id: true, ejercicioActualId: true },
    })) as FilaSesion | null;
  }
  private async leerSeriesDeTrabajo(
    sesionId: string,
    db: AsignacionDb
  ): Promise<Map<string, number[]>> {
    const filas = (await db.registroDeProgreso.findMany({
      where: {
        sesionId,
        tipo: { in: [...SERIES_DE_TRABAJO] },
        numeroSerie: { not: null },
      },
      select: { ejercicioId: true, numeroSerie: true },
    })) as Array<{ ejercicioId: string; numeroSerie: number }>;

    const porEjercicio = new Map<string, number[]>();
    for (const fila of filas) {
      const lista = porEjercicio.get(fila.ejercicioId) ?? [];
      lista.push(fila.numeroSerie);
      porEjercicio.set(fila.ejercicioId, lista);
    }
    return porEjercicio;
  }

  /** Ocupantes derivados de sesiones EN_CURSO ajenas y de filas EN_CURSO ajenas (P-67, D-101, D-105). */
  private async leerMaquinas(
    pendientes: EjercicioDeRutinaLeido[],
    db: AsignacionDb
  ): Promise<EntradaMotor["maquinas"]> {
    const ids = Array.from(new Set(pendientes.flatMap((ejercicio) => ejercicio.candidatos)));
    if (ids.length === 0) return [];

    const filas = (await db.maquina.findMany({
      where: { id: { in: ids } },
      select: { id: true, estado: true },
    })) as FilaMaquina[];

    return filas.map((fila) => ({
      id: fila.id,
      estado: fila.estado,
      ocupante: null,
      cola: [],
    }));
  }
}
