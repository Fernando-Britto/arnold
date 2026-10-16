-- CreateEnum
CREATE TYPE "AccionHuella" AS ENUM ('ENROLAR', 'BORRAR');

-- CreateEnum
CREATE TYPE "EstadoSolicitudHuella" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'FALLIDA');

-- AlterTable
ALTER TABLE "Socio" ADD COLUMN     "huellaConsentimientoEn" TIMESTAMP(3),
ADD COLUMN     "huellaId" INTEGER;

-- CreateTable
CREATE TABLE "SolicitudDeHuella" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "accion" "AccionHuella" NOT NULL,
    "huellaId" INTEGER NOT NULL,
    "estado" "EstadoSolicitudHuella" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "duplicadoDe" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudDeHuella_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudDeHuella_estado_createdAt_idx" ON "SolicitudDeHuella"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudDeHuella_socioId_idx" ON "SolicitudDeHuella"("socioId");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_huellaId_key" ON "Socio"("huellaId");

-- AddForeignKey
ALTER TABLE "SolicitudDeHuella" ADD CONSTRAINT "SolicitudDeHuella_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

