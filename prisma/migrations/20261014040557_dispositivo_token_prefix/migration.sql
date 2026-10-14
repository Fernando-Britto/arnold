-- AC-7: selector por prefijo de token para no comparar bcrypt contra todos los dispositivos.
-- Aditiva y nullable: los dispositivos existentes quedan con NULL (no hay backfill posible: sólo
-- se guardó el hash bcrypt del token). Los dispositivos nuevos guardan sus primeros 8 chars.

ALTER TABLE "Dispositivo" ADD COLUMN "tokenPrefix" TEXT;

CREATE INDEX "Dispositivo_tokenPrefix_idx" ON "Dispositivo"("tokenPrefix");
