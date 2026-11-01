-- Etapa 4: parámetros del motor de espera. Aditiva; las filas existentes reciben el default.
ALTER TABLE "ConfiguracionDelSistema"
  ADD COLUMN "segundosEjecucionSerie" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "minutosVencimientoReserva" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "minutosInactividadSesion" INTEGER NOT NULL DEFAULT 30;

-- Rollback manual (solo al revertir la etapa):
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "minutosInactividadSesion";
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "minutosVencimientoReserva";
-- ALTER TABLE "ConfiguracionDelSistema" DROP COLUMN IF EXISTS "segundosEjecucionSerie";
