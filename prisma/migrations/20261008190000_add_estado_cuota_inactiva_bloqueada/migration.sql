-- AlterEnum
-- Estados de cuenta propios para Inactivo y Bloqueado (D-27). VENCIDA y PENDIENTE se conservan para pagos.
ALTER TYPE "EstadoCuota" ADD VALUE 'INACTIVA';
ALTER TYPE "EstadoCuota" ADD VALUE 'BLOQUEADA';
