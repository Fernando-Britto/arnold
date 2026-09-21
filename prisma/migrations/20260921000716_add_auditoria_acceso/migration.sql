/*
  Warnings:

  - You are about to drop the column `estadoAlIngresar` on the `Asistencia` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoAlIngresar" AS ENUM ('PERMITIDO', 'DENEGADO');

-- CreateEnum
CREATE TYPE "AccionAcceso" AS ENUM ('LOGIN', 'CHECK_IN', 'OVERRIDE_GRANT', 'MANUAL_DENY');

-- CreateEnum
CREATE TYPE "ResultadoAcceso" AS ENUM ('ALLOW', 'DENY');

-- AlterTable
ALTER TABLE "Asistencia" DROP COLUMN "estadoAlIngresar",
ADD COLUMN     "estado" "EstadoAlIngresar" NOT NULL DEFAULT 'PERMITIDO',
ADD COLUMN     "razon" TEXT;

-- CreateTable
CREATE TABLE "AuditoriaAcceso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "socioId" TEXT,
    "accion" "AccionAcceso" NOT NULL,
    "motivo" TEXT,
    "resultado" "ResultadoAcceso" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditoriaAcceso_accion_idx" ON "AuditoriaAcceso"("accion");

-- CreateIndex
CREATE INDEX "AuditoriaAcceso_resultado_idx" ON "AuditoriaAcceso"("resultado");

-- CreateIndex
CREATE INDEX "AuditoriaAcceso_timestamp_idx" ON "AuditoriaAcceso"("timestamp");

-- CreateIndex
CREATE INDEX "AuditoriaAcceso_usuarioId_idx" ON "AuditoriaAcceso"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditoriaAcceso_socioId_idx" ON "AuditoriaAcceso"("socioId");

-- CreateIndex
CREATE INDEX "Asistencia_estado_idx" ON "Asistencia"("estado");

-- AddForeignKey
ALTER TABLE "AuditoriaAcceso" ADD CONSTRAINT "AuditoriaAcceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaAcceso" ADD CONSTRAINT "AuditoriaAcceso_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
