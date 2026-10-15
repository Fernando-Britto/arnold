-- AlterTable
-- Oferta de reactivación (D-54). Apagada por defecto, para que el despliegue no cambie ningún precio.
-- Las filas existentes quedan apagadas, con 30 días sin asistir y 180 de enfriamiento.
ALTER TABLE "ConfiguracionDelSistema" ADD COLUMN     "diasSinAsistirParaOferta" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "enfriamientoOfertaDias" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "ofertaReactivacionActiva" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- Qué se cobró y con qué descuento (D-54). Nulos en los pagos que no llevaron oferta, y en todos los anteriores.
ALTER TABLE "Pago" ADD COLUMN     "descuentoPct" DECIMAL(5,2),
ADD COLUMN     "montoLista" DECIMAL(10,2);
