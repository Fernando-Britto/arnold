# Catálogo de ejercicios (T-050, D-70)

## Objetivo
Cargar los 1.324 ejercicios de `hasaneyldrm/exercises-dataset` en Arnold, solo en español, con sus datos y su animación.

## Pasos (un patch cada uno, ≤400 LOC)
1. **T-050a** — schema, migración y grupos Cuello/Cardio, `grupoDesdeCategoria`. ✅
2. **T-050b** — diccionario de traducción (nombres, equipamiento, músculos) y `ejercicios-es.json` generado por script. ✅
3. **T-050c** — importador idempotente (por `datasetId`, en lotes, con `--dry-run`) y su test. ✅
4. **T-050d** — media: script con ffmpeg (GIF → mp4 + miniatura) hacia `public/ejercicios/`; solo se commitean los mp4 y jpg. ✅
5. **T-050e** — UI: video, instrucciones y músculos en Ejercicios y en la rutina del socio; filtros por equipamiento y músculo; paginación; atribución © Gym visual visible. ✅ (panel del admin: e1–e4; socio: e5a–e5b)

## Riesgos
- Licencia de la media (P-50).
- Peso del repo si se commitean los GIF (por eso la conversión va antes).
- Traducir 1.324 nombres: revisión humana de una muestra antes de importar.

## Verificación (2026-10-21)

- Migración `20261019120000_catalogo_ejercicios` aplicada: `prisma migrate status` 18/18 y `migrate diff`, 0 diferencias.
- `npm run catalogo:importar`: **1.324 creados**; la base quedó con **1.330** ejercicios (los 6 del seed intactos).
- Media: **1.324 pares** mp4 + jpg en `public/ejercicios/`; 122,8 MB de GIF → 16,5 MB.
- `npx tsc --noEmit` y `npx eslint src prisma tests` limpios; **224 suites / 3.052 tests**; `npm run build` OK.
- El patch 0007 (media) llegó con un tramo binario corrupto: `git apply` aplicó 1.103 pares y falló. Se recuperaron los
  221 pares restantes aplicando cada entrada del patch por separado. No falta ningún archivo de los 1.324.
- **No** se revisó el aspecto en el navegador: queda para Fernando.

## Pendientes

- P-50: atribución © Gym visual visible y respetar 180×180 (licencia).
- P-51: las instrucciones están en español de España; adaptarlas al rioplatense es opcional.
