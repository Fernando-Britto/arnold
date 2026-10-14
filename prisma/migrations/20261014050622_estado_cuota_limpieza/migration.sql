-- P-24: limpieza del enum "EstadoCuota".
-- "Socio.estadoCuota" describe sólo la CUENTA (AL_DIA | INACTIVA | BLOQUEADA). Los valores de
-- pago "VENCIDA" y "PENDIENTE" se eliminan: el estado de pago se calcula (estadoCuotaSocio, D-40)
-- y nunca se persiste. Las filas legacy se migran a 'AL_DIA' (cuenta habilitada): migrarlas a
-- 'INACTIVA' seguiría rechazando socios que pagan, que es el bug que P-24 corrige.
--
-- Postgres no permite quitar valores de un enum in place: se crea un enum nuevo, se convierte
-- la columna y se intercambian los nombres. Hoy sólo "Socio"."estadoCuota" usa este enum.

-- 1. Enum nuevo con los tres estados de cuenta.
CREATE TYPE "EstadoCuota_new" AS ENUM ('AL_DIA', 'INACTIVA', 'BLOQUEADA');

-- 2. Quitar el default antes de convertir la columna.
ALTER TABLE "Socio" ALTER COLUMN "estadoCuota" DROP DEFAULT;

-- 3. Convertir la columna mapeando los valores de pago legacy a 'AL_DIA' (todo lo demás se preserva).
ALTER TABLE "Socio"
  ALTER COLUMN "estadoCuota" TYPE "EstadoCuota_new"
  USING (
    CASE "estadoCuota"::text
      WHEN 'VENCIDA' THEN 'AL_DIA'
      WHEN 'PENDIENTE' THEN 'AL_DIA'
      ELSE "estadoCuota"::text
    END
  )::"EstadoCuota_new";

-- 4. Intercambiar los nombres: el nuevo enum pasa a llamarse "EstadoCuota".
DROP TYPE "EstadoCuota";
ALTER TYPE "EstadoCuota_new" RENAME TO "EstadoCuota";

-- 5. Restaurar el default del schema (Socio.estadoCuota @default(AL_DIA)).
ALTER TABLE "Socio" ALTER COLUMN "estadoCuota" SET DEFAULT 'AL_DIA';
