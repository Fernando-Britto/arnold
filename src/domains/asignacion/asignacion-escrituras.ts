import type { AsignacionDb, CargadorDb, NuevaReserva } from "./asignacion-puerto";
import { getPrisma } from "./asignacion-puerto";

export class AsignacionEscrituras {
  constructor(private readonly cargar: CargadorDb = getPrisma) {}
  private db(db?: AsignacionDb): Promise<AsignacionDb> {
    return db ? Promise.resolve(db) : this.cargar();
  }
  async cancelarReservasActivas(
    socioId: string,
    ahora: Date,
    dbInyectada?: AsignacionDb
  ): Promise<number> {
    const db = await this.db(dbInyectada);
    const { count } = await db.asignacionDeEjercicio.updateMany({
      where: { socioId, estado: "RESERVADA", venceEn: { gt: ahora } },
      data: { estado: "CANCELADA" },
    });
    return count;
  }
  async crearReserva(datos: NuevaReserva, dbInyectada?: AsignacionDb): Promise<{ id: string }> {
    const db = await this.db(dbInyectada);
    return db.asignacionDeEjercicio.create({
      data: {
        socioId: datos.socioId,
        ejercicioId: datos.ejercicioId,
        maquinaId: datos.maquinaId,
        estado: "RESERVADA",
        esperaSegundos: datos.esperaSegundos,
        ahorroSegundos: datos.ahorroSegundos,
        creadaEn: datos.creadaEn,
        venceEn: datos.venceEn,
      },
      select: { id: true },
    });
  }
  async consumirReserva(
    id: string,
    sesionId: string,
    ahora: Date,
    dbInyectada?: AsignacionDb
  ): Promise<boolean> {
    const db = await this.db(dbInyectada);
    const { count } = await db.asignacionDeEjercicio.updateMany({
      where: { id, estado: "RESERVADA", venceEn: { gt: ahora } },
      data: { estado: "EN_CURSO", sesionId },
    });
    return count > 0;
  }
  async cancelarReserva(id: string, ahora: Date, dbInyectada?: AsignacionDb): Promise<boolean> {
    const db = await this.db(dbInyectada);
    const { count } = await db.asignacionDeEjercicio.updateMany({
      where: { id, estado: "RESERVADA", venceEn: { gt: ahora } },
      data: { estado: "CANCELADA" },
    });
    return count > 0;
  }
  async completarEjecucion(
    sesionId: string,
    ejercicioId: string,
    dbInyectada?: AsignacionDb
  ): Promise<number> {
    const db = await this.db(dbInyectada);
    const { count } = await db.asignacionDeEjercicio.updateMany({
      where: { sesionId, ejercicioId, estado: "EN_CURSO" },
      data: { estado: "COMPLETADA" },
    });
    return count;
  }
  async completarEjecucionesDeSesion(
    sesionId: string,
    dbInyectada?: AsignacionDb
  ): Promise<number> {
    const db = await this.db(dbInyectada);
    const { count } = await db.asignacionDeEjercicio.updateMany({
      where: { sesionId, estado: "EN_CURSO" },
      data: { estado: "COMPLETADA" },
    });
    return count;
  }
  async crearEjecucionEnCurso(
    datos: {
      socioId: string;
      sesionId: string;
      ejercicioId: string;
      maquinaId: string | null;
      ahora: Date;
    },
    dbInyectada?: AsignacionDb
  ): Promise<{ id: string }> {
    const db = await this.db(dbInyectada);
    return db.asignacionDeEjercicio.create({
      data: {
        socioId: datos.socioId,
        sesionId: datos.sesionId,
        ejercicioId: datos.ejercicioId,
        maquinaId: datos.maquinaId,
        estado: "EN_CURSO",
        esperaSegundos: 0,
        ahorroSegundos: 0,
        creadaEn: datos.ahora,
        // `venceEn` es NOT NULL; el vencimiento solo aplica a RESERVADA, así que una ejecución vence "ya".
        venceEn: datos.ahora,
      },
      select: { id: true },
    });
  }
}
