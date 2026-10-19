-- D-65: peso corporal con meta. Un pesaje por fila (MedicionDePeso) y, en el socio, la meta de peso
-- junto con el peso desde el que se fijó, para saber si el objetivo era bajar o subir.
-- Los socios existentes quedan sin meta y sin pesajes: no hay nada que migrar a mano.

-- AlterTable
ALTER TABLE "Socio" ADD COLUMN     "pesoObjetivo" DECIMAL(5,2),
ADD COLUMN     "pesoInicialDeMeta" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "MedicionDePeso" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "peso" DECIMAL(5,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicionDePeso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicionDePeso_socioId_fecha_idx" ON "MedicionDePeso"("socioId", "fecha");

-- AddForeignKey
ALTER TABLE "MedicionDePeso" ADD CONSTRAINT "MedicionDePeso_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
