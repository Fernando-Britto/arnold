-- D-70: catálogo de ejercicios importado del dataset. Columnas nuevas, todas opcionales o con
-- default: los ejercicios existentes quedan intactos y no hay nada que migrar a mano.

-- AlterTable
ALTER TABLE "Ejercicio" ADD COLUMN     "datasetId" TEXT,
ADD COLUMN     "equipamiento" TEXT,
ADD COLUMN     "musculoObjetivo" TEXT,
ADD COLUMN     "musculosSecundarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instrucciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mediaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ejercicio_datasetId_key" ON "Ejercicio"("datasetId");

-- CreateIndex
CREATE INDEX "Ejercicio_equipamiento_idx" ON "Ejercicio"("equipamiento");
