# Cierre de pendientes y desfasajes del repo

## Objetivo

Cerrar los puntos abiertos que quedaron del barrido de documentación: verificar en la máquina,
verificar el refresh token contra la base, corregir dos menores, y **corregir los desfasajes** entre
`PROJECT-STATUS.md` y `openspec/decisions.md` (y sus espejos en el vault).

## Estado verificado de cada punto (2026-10-16, con evidencia)

| # | Punto reportado | Estado real | Evidencia |
|---|---|---|---|
| 1 | **P-28** Despliegue: falta probar el pooler de Supabase y `npm run build` | **Parcial.** `npm run build` verificado. El pooler **sigue sin probar**: no hay URL *pooled* (puerto 6543, `?pgbouncer=true&connection_limit=1`); la conexión directa del `.env` no sirve para esa prueba. | `.env.example` documenta el requisito (D-35) |
| 2 | **P-20** Refresh token: código en `94089ca`, falta documentarlo y verificarlo | **Código sí** (`src/lib/refresh-token.ts`, `src/app/api/auth/refresh/route.ts`, con rotación y detección de reuso). **Falta**: entrada de decisión y verificación contra la base. | `refreshToken.count() = 3` en la base; spec `refresh-token` **no existe** en `openspec/specs/` |
| 3 | Verificación en máquina (T-024 / D-39): `npm test`, `tsc`, abrir los 4 CRUD | `npm test` y `tsc` verdes. Los 4 CRUD **no** se abrieron en navegador (requiere que lo haga Fernando). | ver *Verificación* |
| 4a | **P-09** El login ignora `?from=` | **YA RESUELTO.** | `src/lib/login-redirect.ts` (`postLoginRoute`, `safeRedirectTarget`); `src/app/login/page.tsx:36` lo usa |
| 4b | **P-18** El nav del Socio no tiene botón de salir | **YA RESUELTO.** | `src/components/home-socio/socio-shell.tsx:14,21` (`logout` de `useAuth` → `onLogoutClick`) |
| 5a | `PROJECT-STATUS.md` dice que falta aplicar `sesion_en_curso_y_dispositivo` | **Desfasaje.** Ya está aplicada. | `npx prisma migrate status`: 15 migraciones, "Database schema is up to date!" |
| 5b | **P-40** abierto en `decisions.md` y resuelto en `PROJECT-STATUS.md` | **Desfasaje real.** `decisions.md` se contradice: la línea 793 dice "P-40 cerrado (2026-10-15)" y la fila 915 lo lista abierto. | `openspec/decisions.md:793` vs `:915` |
| 5c | **P-36** menciona dos `.patch` sueltos en la raíz y no están | **Confirmado.** No hay `.patch`; el `.gitignore:50-51` ya los ignora con un comentario de P-36. | `ls *.patch` → no existe |

**No hay cambios de código que hacer**: P-09 y P-18 ya están implementados; el código de P-20 ya está.
El trabajo es **verificar** y **corregir la documentación** para que diga la verdad.

## Trabajo

- [x] **U1** — Verificación de máquina: `npm test` (189/2394), `npx tsc --noEmit` (exit 0), `npm run build` (exit 0, 9.4 s, 45 páginas).
- [x] **U2** — Verificación del refresh contra la base: login 200 → refresh 204 con rotación → reuso 401 → cadena entera revocada (4/4).
- [x] **U3** — `decisions.md`: **D-57** (refresh con rotación y detección de reuso) + P-40, P-36, P-09, P-18, P-20 resueltos y P-28 parcial.
- [x] **U4** — `PROJECT-STATUS.md`: migraciones 15/15 aplicadas, evidencia de test/tsc/build, gotcha de `tsc`, y estado de los pendientes.
- [x] **U5** — Vault: `Proyecto/Estado del proyecto.md`, `Proyecto/Decisiones.md`, `Proyecto/README.md`, `Modelo de datos`, `Glosario`, `Inventario`, `Validaciones/00 - Mapa de módulos`, `Operacion/*` y los `Hallazgos/` de P-09 y P-36.

**Extra (no pedido, encontrado al verificar)**: la deuda de lint del repo ya estaba saldada (`eslint` da 0 errores / 0 avisos), `P-39`/`T-031`/`D-36` tenían menciones obsoletas, y existe CI (`.github/workflows/ci.yml`) aunque la documentación decía que no. Todo corregido.

## Bloqueante (necesita a Fernando)

**P-28 pooler**: hace falta la URL *pooled* de Supabase (puerto 6543, con
`?pgbouncer=true&connection_limit=1`). Sin eso no se puede probar. Además `.env.example` advierte que
la app usa **transacciones interactivas** y que las migraciones necesitan conexión directa, así que la
prueba tiene que cubrir ambos caminos.

## Verificación

- `npm test` · `npx tsc --noEmit` · `npm run build`
- Refresh: `curl` contra `npm run dev` con `admin@arnold.test` (password por defecto del seed).
- `npx prisma migrate status`

## Progreso

- 2026-10-16 — Documento creado. Puntos verificados contra el código y la base (ver tabla).
- 2026-10-16 — Segunda pasada: **`npm run start` verificado** (P-28) y **barrido del vault** (`Modulos/` + `Proyecto/UML*`).

### `npm run start` (P-28) — verificado

Levanta y sirve en 1,1–1,8 s. Resultados contra el build de producción local:

| Request | Resultado |
|---|---|
| `GET /login` (sin base) | 200 en **0,07 s** |
| `POST /api/auth/login` (seed) | 200 |
| `GET /home-interno` sin sesión | 307 (redirige a login) |
| `GET /home-interno` con sesión | 200 |
| `GET /api/home-interno` con sesión | 200 — **3,21 s la 1ª (fría)**, 1,71 s y 1,33 s las siguientes |
| `GET /clientes` con sesión | 200 |

**Hallazgo 1 — `JWT_SECRET`**: con `next start` (NODE_ENV=production) **cualquier flujo de auth falla** con `JWT_SECRET must be set in production` si el `.env` no lo define (`src/lib/auth.ts:9-13`). En `next dev` cae a un fallback y no se nota. Se agregó un `JWT_SECRET` local al `.env` (generado con `crypto.randomBytes(48)`; no impreso) para poder verificar. **En producción real: usar un valor propio y distinto.**

**Hallazgo 2 — el costo de la conexión directa (evidencia para el pooler)**: `/login` sin tocar la base tarda 0,07 s, pero `/api/home-interno` tarda 3,21 s en frío y 1,33–1,71 s en caliente. La diferencia frío/caliente (~1,5 s) es el establecimiento de conexión que el pooler de Supabase debería amortiguar. También refuerza P-11 (el proxy consulta la base en cada navegación).

**Gotcha de proceso**: matar el wrapper `npm` **no** mata el `next-server` hijo; queda huérfano tomando el puerto 3000 y hay que matarlo por proceso (`pkill -f next-server`). Me pasó dos veces durante esta verificación.

### Barrido del vault

`Modulos/` y `Proyecto/UML*` corregidos: la anulación de pagos (P-39) ya existe, `?from=` (P-09) ya se respeta, el refresh (P-20) pasa a **D-57**, y P-28 queda con la distinción build ✅ / start ✅ / pooler ❌. Extra: la oferta de reactivación **sí** cuenta pagos `ANULADO` en el enfriamiento (`oferta-reactivacion-consulta.ts:80`), y `Clientes.md` citaba siete hallazgos cerrados como vigentes.
