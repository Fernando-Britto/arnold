CREATE UNIQUE INDEX "Maquina_nombre_ubicacion_key"
  ON "Maquina" (lower(btrim("nombre")), lower(btrim("ubicacion")));
