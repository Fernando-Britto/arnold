-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'INSTRUCTOR', 'RECEPCIONISTA', 'SOCIO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('AL_DIA', 'VENCIDA', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "EstadoLaboral" AS ENUM ('ACTIVO', 'INACTIVO', 'LICENCIA');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoCuotaModel" AS ENUM ('VIGENTE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('CONFIRMADO', 'PENDIENTE', 'ANULADO');

-- CreateEnum
CREATE TYPE "NivelDeDificultad" AS ENUM ('BASICO', 'INTERMEDIO', 'AVANZADO');

-- CreateEnum
CREATE TYPE "TipoEquipamiento" AS ENUM ('MAQUINA_GUIADA', 'PESO_LIBRE', 'CARDIO');

-- CreateEnum
CREATE TYPE "EstadoMaquina" AS ENUM ('DISPONIBLE', 'OCUPADA', 'FUERA_DE_SERVICIO', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoSesion" AS ENUM ('COMPLETADA', 'INCOMPLETA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "TipoProgresion" AS ENUM ('LINEAL', 'ONDULANTE');

-- CreateEnum
CREATE TYPE "TipoOperacion" AS ENUM ('ALTA', 'BAJA', 'MODIFICACION', 'ANULACION');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'SOCIO',
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Socio" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estadoCuota" "EstadoCuota" NOT NULL DEFAULT 'AL_DIA',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "membresiaAsignadaId" TEXT,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "turno" "Turno" NOT NULL DEFAULT 'MANANA',
    "estadoLaboral" "EstadoLaboral" NOT NULL DEFAULT 'ACTIVO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membresia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "periodicidad" INTEGER NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoMembresia" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCuotaModel" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'CONFIRMADO',
    "cuotaId" TEXT,
    "socioId" TEXT,
    "cierreDeCajaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ejercicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupoMuscular" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rutina" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "objetivoPrincipal" TEXT NOT NULL,
    "frecuenciaSemanal" INTEGER NOT NULL,
    "duracionEstimada" INTEGER NOT NULL,
    "nivelDeDificultad" "NivelDeDificultad" NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rutina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EjercicioEnRutina" (
    "id" TEXT NOT NULL,
    "rutinaId" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticiones" INTEGER NOT NULL,
    "descanso" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EjercicioEnRutina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutinaAsignada" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "rutinaId" TEXT NOT NULL,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutinaAsignada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoEquipamiento" "TipoEquipamiento" NOT NULL,
    "estado" "EstadoMaquina" NOT NULL DEFAULT 'DISPONIBLE',
    "ubicacion" TEXT NOT NULL,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socioId" TEXT NOT NULL,
    "estadoAlIngresar" TEXT NOT NULL,
    "autorizadoExcepcionalmente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionDeEntrenamiento" (
    "id" TEXT NOT NULL,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFin" TIMESTAMP(3),
    "socioId" TEXT NOT NULL,
    "rutinaAsignadaId" TEXT NOT NULL,
    "estadoDeFinalizacion" "EstadoSesion" NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionDeEntrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroDeProgreso" (
    "id" TEXT NOT NULL,
    "carga" DECIMAL(10,2) NOT NULL,
    "repeticiones" INTEGER NOT NULL,
    "pesoCorporal" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ejercicioId" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,

    CONSTRAINT "RegistroDeProgreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaDeProgresion" (
    "id" TEXT NOT NULL,
    "tipo" "TipoProgresion" NOT NULL,
    "incrementoSugerido" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReglaDeProgresion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreDeCaja" (
    "id" TEXT NOT NULL,
    "totalRecaudado" DECIMAL(10,2) NOT NULL,
    "totalEfectivo" DECIMAL(10,2) NOT NULL,
    "totalTransferencia" DECIMAL(10,2) NOT NULL,
    "totalTarjeta" DECIMAL(10,2) NOT NULL,
    "cantidadOperaciones" INTEGER NOT NULL,
    "observaciones" TEXT,
    "responsableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreDeCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroDeAuditoria" (
    "id" TEXT NOT NULL,
    "tipoOperacion" "TipoOperacion" NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsableId" TEXT NOT NULL,
    "detalles" TEXT,

    CONSTRAINT "RegistroDeAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionDelSistema" (
    "id" TEXT NOT NULL,
    "capacidadMaxima" INTEGER NOT NULL,
    "periodoGracia" INTEGER NOT NULL,
    "diasInactividad" INTEGER NOT NULL,
    "descuentoReactivacion" DECIMAL(5,2) NOT NULL,
    "ventanaAforoMinutos" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionDelSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_usuarioId_key" ON "Socio"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_dni_key" ON "Socio"("dni");

-- CreateIndex
CREATE INDEX "Socio_dni_idx" ON "Socio"("dni");

-- CreateIndex
CREATE INDEX "Socio_estadoCuota_idx" ON "Socio"("estadoCuota");

-- CreateIndex
CREATE INDEX "Socio_membresiaAsignadaId_idx" ON "Socio"("membresiaAsignadaId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuarioId_key" ON "Empleado"("usuarioId");

-- CreateIndex
CREATE INDEX "Empleado_estadoLaboral_idx" ON "Empleado"("estadoLaboral");

-- CreateIndex
CREATE INDEX "Membresia_estado_idx" ON "Membresia"("estado");

-- CreateIndex
CREATE INDEX "Cuota_socioId_idx" ON "Cuota"("socioId");

-- CreateIndex
CREATE INDEX "Cuota_fechaVencimiento_idx" ON "Cuota"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "Cuota_estado_idx" ON "Cuota"("estado");

-- CreateIndex
CREATE INDEX "Pago_fechaPago_idx" ON "Pago"("fechaPago");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE INDEX "Pago_metodoPago_idx" ON "Pago"("metodoPago");

-- CreateIndex
CREATE INDEX "Pago_cuotaId_idx" ON "Pago"("cuotaId");

-- CreateIndex
CREATE INDEX "Pago_socioId_idx" ON "Pago"("socioId");

-- CreateIndex
CREATE INDEX "Pago_cierreDeCajaId_idx" ON "Pago"("cierreDeCajaId");

-- CreateIndex
CREATE INDEX "Ejercicio_grupoMuscular_idx" ON "Ejercicio"("grupoMuscular");

-- CreateIndex
CREATE INDEX "EjercicioEnRutina_rutinaId_idx" ON "EjercicioEnRutina"("rutinaId");

-- CreateIndex
CREATE INDEX "EjercicioEnRutina_ejercicioId_idx" ON "EjercicioEnRutina"("ejercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "EjercicioEnRutina_rutinaId_ejercicioId_key" ON "EjercicioEnRutina"("rutinaId", "ejercicioId");

-- CreateIndex
CREATE INDEX "RutinaAsignada_socioId_activa_idx" ON "RutinaAsignada"("socioId", "activa");

-- CreateIndex
CREATE INDEX "RutinaAsignada_rutinaId_idx" ON "RutinaAsignada"("rutinaId");

-- CreateIndex
CREATE INDEX "RutinaAsignada_activa_idx" ON "RutinaAsignada"("activa");

-- CreateIndex
CREATE INDEX "Maquina_estado_idx" ON "Maquina"("estado");

-- CreateIndex
CREATE INDEX "Maquina_tipoEquipamiento_idx" ON "Maquina"("tipoEquipamiento");

-- CreateIndex
CREATE INDEX "Asistencia_socioId_idx" ON "Asistencia"("socioId");

-- CreateIndex
CREATE INDEX "Asistencia_fechaHora_idx" ON "Asistencia"("fechaHora");

-- CreateIndex
CREATE INDEX "SesionDeEntrenamiento_socioId_idx" ON "SesionDeEntrenamiento"("socioId");

-- CreateIndex
CREATE INDEX "SesionDeEntrenamiento_rutinaAsignadaId_idx" ON "SesionDeEntrenamiento"("rutinaAsignadaId");

-- CreateIndex
CREATE INDEX "SesionDeEntrenamiento_horaInicio_idx" ON "SesionDeEntrenamiento"("horaInicio");

-- CreateIndex
CREATE INDEX "RegistroDeProgreso_ejercicioId_idx" ON "RegistroDeProgreso"("ejercicioId");

-- CreateIndex
CREATE INDEX "RegistroDeProgreso_socioId_idx" ON "RegistroDeProgreso"("socioId");

-- CreateIndex
CREATE INDEX "RegistroDeProgreso_fecha_idx" ON "RegistroDeProgreso"("fecha");

-- CreateIndex
CREATE INDEX "ReglaDeProgresion_tipo_idx" ON "ReglaDeProgresion"("tipo");

-- CreateIndex
CREATE INDEX "CierreDeCaja_responsableId_idx" ON "CierreDeCaja"("responsableId");

-- CreateIndex
CREATE INDEX "CierreDeCaja_createdAt_idx" ON "CierreDeCaja"("createdAt");

-- CreateIndex
CREATE INDEX "RegistroDeAuditoria_tipoOperacion_idx" ON "RegistroDeAuditoria"("tipoOperacion");

-- CreateIndex
CREATE INDEX "RegistroDeAuditoria_fechaHora_idx" ON "RegistroDeAuditoria"("fechaHora");

-- CreateIndex
CREATE INDEX "RegistroDeAuditoria_responsableId_idx" ON "RegistroDeAuditoria"("responsableId");

-- CreateIndex
CREATE INDEX "RateLimitLog_key_route_timestamp_idx" ON "RateLimitLog"("key", "route", "timestamp");

-- CreateIndex
CREATE INDEX "RateLimitLog_timestamp_idx" ON "RateLimitLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Socio" ADD CONSTRAINT "Socio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Socio" ADD CONSTRAINT "Socio_membresiaAsignadaId_fkey" FOREIGN KEY ("membresiaAsignadaId") REFERENCES "Membresia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cierreDeCajaId_fkey" FOREIGN KEY ("cierreDeCajaId") REFERENCES "CierreDeCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjercicioEnRutina" ADD CONSTRAINT "EjercicioEnRutina_rutinaId_fkey" FOREIGN KEY ("rutinaId") REFERENCES "Rutina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjercicioEnRutina" ADD CONSTRAINT "EjercicioEnRutina_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutinaAsignada" ADD CONSTRAINT "RutinaAsignada_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutinaAsignada" ADD CONSTRAINT "RutinaAsignada_rutinaId_fkey" FOREIGN KEY ("rutinaId") REFERENCES "Rutina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionDeEntrenamiento" ADD CONSTRAINT "SesionDeEntrenamiento_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionDeEntrenamiento" ADD CONSTRAINT "SesionDeEntrenamiento_rutinaAsignadaId_fkey" FOREIGN KEY ("rutinaAsignadaId") REFERENCES "RutinaAsignada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroDeProgreso" ADD CONSTRAINT "RegistroDeProgreso_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroDeProgreso" ADD CONSTRAINT "RegistroDeProgreso_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreDeCaja" ADD CONSTRAINT "CierreDeCaja_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroDeAuditoria" ADD CONSTRAINT "RegistroDeAuditoria_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
