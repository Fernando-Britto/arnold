-- Extensión `unaccent` (H12). La búsqueda de ejercicios pliega mayúsculas con ILIKE, pero no
-- tildes: "triceps" no encontraba "Tríceps". `unaccent` permite plegar las dos partes desde la
-- base sin cambiar el schema ni mantener una columna normalizada que podría quedar desfasada.
CREATE EXTENSION IF NOT EXISTS unaccent;
