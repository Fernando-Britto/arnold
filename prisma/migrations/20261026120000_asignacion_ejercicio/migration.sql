-- Etapa 4: tabla de asignaciones/reservas del motor de espera.
-- Aditiva: un tipo, una tabla, índices y FKs inline. Sin DROP ni ALTER sobre tablas existentes.

CREATE TYPE "EstadoAsignacion" AS ENUM ('RESERVADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');

CREATE TABLE "AsignacionDeEjercicio" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "maquinaId" TEXT,
    "sesionId" TEXT,
    "estado" "EstadoAsignacion" NOT NULL,
    "esperaSegundos" INTEGER NOT NULL,
    "ahorroSegundos" INTEGER NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsignacionDeEjercicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AsignacionDeEjercicio_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsignacionDeEjercicio_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionDeEntrenamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AsignacionDeEjercicio_socioId_estado_venceEn_idx" ON "AsignacionDeEjercicio"("socioId", "estado", "venceEn");
CREATE INDEX "AsignacionDeEjercicio_maquinaId_estado_creadaEn_idx" ON "AsignacionDeEjercicio"("maquinaId", "estado", "creadaEn");
CREATE INDEX "AsignacionDeEjercicio_sesionId_idx" ON "AsignacionDeEjercicio"("sesionId");
CREATE INDEX "AsignacionDeEjercicio_ejercicioId_idx" ON "AsignacionDeEjercicio"("ejercicioId");

-- Rollback manual (solo al revertir la etapa):
-- DROP TABLE IF EXISTS "AsignacionDeEjercicio";
-- DROP TYPE IF EXISTS "EstadoAsignacion";
