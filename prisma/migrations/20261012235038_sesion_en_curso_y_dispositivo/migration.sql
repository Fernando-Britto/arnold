-- CreateEnum
CREATE TYPE "TipoDispositivo" AS ENUM ('PUERTA', 'RECEPCION');

-- CreateEnum
CREATE TYPE "EstadoDispositivo" AS ENUM ('ACTIVO', 'INACTIVO');

-- AlterEnum
ALTER TYPE "EstadoSesion" ADD VALUE 'EN_CURSO';

-- AlterTable
ALTER TABLE "RegistroDeProgreso" ADD COLUMN     "numeroSerie" INTEGER,
ADD COLUMN     "rir" INTEGER,
ADD COLUMN     "sesionId" TEXT,
ALTER COLUMN "pesoCorporal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SesionDeEntrenamiento" ADD COLUMN     "ejercicioActualId" TEXT,
ADD COLUMN     "serieActual" INTEGER;

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDispositivo" NOT NULL DEFAULT 'PUERTA',
    "tokenHash" TEXT NOT NULL,
    "estado" "EstadoDispositivo" NOT NULL DEFAULT 'ACTIVO',
    "ultimoContacto" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_tokenHash_key" ON "Dispositivo"("tokenHash");

-- CreateIndex
CREATE INDEX "Dispositivo_estado_idx" ON "Dispositivo"("estado");

-- CreateIndex
CREATE INDEX "RegistroDeProgreso_sesionId_idx" ON "RegistroDeProgreso"("sesionId");

-- AddForeignKey
ALTER TABLE "RegistroDeProgreso" ADD CONSTRAINT "RegistroDeProgreso_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionDeEntrenamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
