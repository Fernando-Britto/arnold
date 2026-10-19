-- D-64: tipo de serie. Distingue calentamiento, hasta el fallo y drop set de la serie normal.
-- El calentamiento no cuenta para progresión, marcas ni volumen. Las filas existentes quedan NORMAL
-- por el valor por defecto, que es lo que eran: no hay nada que migrar a mano.

-- CreateEnum
CREATE TYPE "TipoSerie" AS ENUM ('NORMAL', 'CALENTAMIENTO', 'HASTA_EL_FALLO', 'DROP_SET');

-- AlterTable
ALTER TABLE "RegistroDeProgreso" ADD COLUMN     "tipo" "TipoSerie" NOT NULL DEFAULT 'NORMAL';
