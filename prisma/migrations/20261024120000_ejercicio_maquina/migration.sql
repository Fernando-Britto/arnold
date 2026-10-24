-- Additive join table for Ejercicio <-> Maquina (Etapa 2).
-- No destructive DDL; rollback is documented in design.md only.

CREATE TABLE "EjercicioMaquina" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EjercicioMaquina_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EjercicioMaquina_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EjercicioMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EjercicioMaquina_maquinaId_ejercicioId_key" ON "EjercicioMaquina"("maquinaId", "ejercicioId");
CREATE INDEX "EjercicioMaquina_maquinaId_idx" ON "EjercicioMaquina"("maquinaId");
CREATE INDEX "EjercicioMaquina_ejercicioId_idx" ON "EjercicioMaquina"("ejercicioId");
