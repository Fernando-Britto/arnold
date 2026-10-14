-- AlterTable
-- Ventana de anti-passback configurable (P-33). Las filas existentes quedan con 60 minutos.
ALTER TABLE "ConfiguracionDelSistema" ADD COLUMN "antiPassbackMinutos" INTEGER NOT NULL DEFAULT 60;
