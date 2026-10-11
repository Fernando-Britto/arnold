-- AlterTable
-- Día límite de pago y día de corte para altas tardías (D-40). Las filas existentes quedan con 10 y 20.
ALTER TABLE "ConfiguracionDelSistema" ADD COLUMN     "diaCorteAltaTardia" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "diaLimitePago" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
-- Plan pagado en cada cuota (D-40). Nulo en las cuotas anteriores.
ALTER TABLE "Cuota" ADD COLUMN     "membresiaId" TEXT;

-- CreateIndex
CREATE INDEX "Cuota_membresiaId_idx" ON "Cuota"("membresiaId");

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_membresiaId_fkey" FOREIGN KEY ("membresiaId") REFERENCES "Membresia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
