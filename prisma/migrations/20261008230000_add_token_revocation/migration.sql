-- CreateTable
CREATE TABLE "TokenRevocation" (
    "jti" TEXT NOT NULL,
    "usuarioId" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRevocation_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "TokenRevocation_expiraEn_idx" ON "TokenRevocation"("expiraEn");
