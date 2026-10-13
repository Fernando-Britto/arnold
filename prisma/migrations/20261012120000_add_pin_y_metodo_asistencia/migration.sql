-- CreateEnum
-- Método con el que se identificó un ingreso (D-47: DNI + PIN primero, huella al final).
CREATE TYPE "MetodoIdentificacion" AS ENUM ('DNI_PIN', 'MANUAL', 'HUELLA');

-- AlterTable
-- PIN de 4 dígitos del check-in, hasheado con bcrypt. Nulo hasta que recepción lo defina (D-47).
ALTER TABLE "Socio" ADD COLUMN     "pinHash" TEXT;

-- AlterTable
-- Los registros existentes quedan como ingreso manual.
ALTER TABLE "Asistencia" ADD COLUMN     "metodo" "MetodoIdentificacion" NOT NULL DEFAULT 'MANUAL';
