import fs from "fs";
import path from "path";
import { hasRouteAccess, type HttpMethod, type UserRole } from "./authorization";

/**
 * Guardián N3 (hallazgo H): la matriz del proxy (`src/lib/authorization.ts`) y los handlers
 * (`ALLOWED_*_ROLES`) no pueden desalinearse. Este test descubre las rutas reales bajo
 * cada `route.ts` bajo `src/app/api`, les lee los roles con un escaneo de texto (sin AST, sin dependencias)
 * y falla si la matriz le da a un rol un método que el handler rechaza (over-grant del proxy).
 *
 * Dirección del chequeo: `roles(matriz, path, method) ⊆ roles(handler)`. Es la que habría cazado
 * el drift de socios y sesiones. La otra dirección (el handler acepta algo que la matriz niega) no
 * es un agujero de seguridad: el proxy ya lo bloqueó antes de llegar al handler.
 *
 * Si el escaneo no puede determinar los roles de un archivo, LANZA en vez de pasar en silencio:
 * un guardián que pasa mudo es peor que no tenerlo.
 */

const ROLES: UserRole[] = ["SOCIO", "INSTRUCTOR", "RECEPCIONISTA", "ADMINISTRADOR"];
const ADMIN: UserRole = "ADMINISTRADOR";
const METODOS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const API = path.resolve(__dirname, "..", "app", "api");

/**
 * Excepciones intencionales: la matriz le da a un rol un método que el handler rechaza A PROPÓSITO.
 * Cada una con su motivo. Ninguna otra desalineación en esta dirección es aceptable.
 * Clave: `${metodo} ${ruta}`.
 */
const EXCEPCIONES: Record<string, string> = {
  // El handler resuelve el permiso con una regla fina (solo Administrador) en la capa `api/`,
  // no con una constante `ALLOWED_*`. La matriz lo deja pasar por el prefijo `/api/socios`.
  "POST /api/socios/[id]/access-override":
    "El handler es más estricto a propósito: regla fina de solo Administrador (D-47/P-24).",
  // Defensa en profundidad: el handler repite `solo SOCIO`; el Administrador entra por el comodín
  // de la matriz, pero el handler lo rechaza a propósito.
  "GET /api/home-socio":
    "Defensa en profundidad: el handler solo acepta Socio.",
  "GET /api/home-socio/secciones":
    "Defensa en profundidad: el handler solo acepta Socio.",
  // El estado de la huella es un dato sensible del socio: la matriz deja pasar el GET de INSTRUCTOR
  // por el prefijo `/api/socios`, pero el handler exige Administrador o Recepcionista a propósito.
  "GET /api/socios/[id]/huella":
    "Dato sensible: solo Administrador y Recepcionista ven/registran la huella (T-041).",
};

/** Rutas cuyo handler no fija roles: delega por completo en el proxy y se saltean (se listan abajo). */
interface Infractor {
  clave: string; // `${metodo} ${ruta}`
  detalle: string;
}

function archivosRoute(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivosRoute(ruta);
    return e.name === "route.ts" ? [ruta] : [];
  });
}

/** Ruta HTTP de un archivo: `socios/[id]/pin/route.ts` → `/api/socios/[id]/pin`. */
function rutaApi(file: string): string {
  const dir = path.relative(API, file).split(path.sep).slice(0, -1).join("/");
  return dir ? `/api/${dir}` : "/api";
}

/** Constantes del archivo cuyo literal es una lista de roles conocidos (`ALLOWED_*`, `allowedRoles`, etc.). */
function constantesDeRoles(texto: string): Map<string, UserRole[]> {
  const mapa = new Map<string, UserRole[]>();
  for (const m of texto.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) {
    const items = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (items.length > 0 && items.every((i) => (ROLES as string[]).includes(i))) {
      mapa.set(m[1], items as UserRole[]);
    }
  }
  return mapa;
}

/** Falla fuerte si una constante `ALLOWED_*ROLES` existe pero no se pudo leer. */
function validarParseo(texto: string, mapa: Map<string, UserRole[]>, file: string): void {
  for (const m of texto.matchAll(/const\s+(ALLOWED_\w*ROLES)\s*=\s*\[/g)) {
    if (!mapa.has(m[1])) {
      throw new Error(
        `[consistencia] no se pudieron leer los roles de ${m[1]} en ${path.relative(API, file)}: ` +
          `revisá el literal (roles esperados: ${ROLES.join(", ")})`
      );
    }
  }
}

function unicos(roles: UserRole[]): UserRole[] {
  return [...new Set(roles)];
}

/**
 * Roles que acepta cada handler HTTP del archivo. Un handler sin chequeo directo usa las constantes
 * del archivo (cubre el chequeo delegado a un helper, p. ej. `autorizar` en /api/configuracion).
 * Un archivo sin constantes de rol se saltea: su handler no fija roles con `ALLOWED_*` (delega en el
 * proxy, o resuelve el rol en otra capa o con una regla fina: es el caso de /api/home-socio,
 * /api/home-socio/secciones y /api/socios/[id]/access-override, documentados en EXCEPCIONES).
 */
function handlersDe(texto: string, consts: Map<string, UserRole[]>, file: string): { metodo: HttpMethod; roles: UserRole[] }[] {
  const matches = [...texto.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)];
  const handlers: { metodo: HttpMethod; roles: UserRole[] }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const nombre = matches[i][1];
    if (!(METODOS as string[]).includes(nombre)) continue;

    const desde = matches[i].index!;
    const hasta = i + 1 < matches.length ? matches[i + 1].index! : texto.length;
    const segmento = texto.slice(desde, hasta);

    // Identificadores usados en `ALGO.includes(...rol...)`.
    const identificadores = new Set<string>();
    for (const m of segmento.matchAll(/(\w+)\.includes\(\s*([^)]*)\)/g)) {
      if (/\brol\b/.test(m[2])) identificadores.add(m[1]);
    }

    if (identificadores.size === 0) {
      if (consts.size === 0) continue; // delega en el proxy → salteado
      handlers.push({ metodo: nombre as HttpMethod, roles: unicos([...consts.values()].flat()) });
      continue;
    }

    const roles: UserRole[] = [];
    for (const id of identificadores) {
      const valores = consts.get(id);
      if (!valores) {
        throw new Error(
          `[consistencia] ${path.relative(API, file)}: el handler ${nombre} chequea el rol con ` +
            `${id}, pero no se pudo leer su lista de roles`
        );
      }
      roles.push(...valores);
    }
    handlers.push({ metodo: nombre as HttpMethod, roles: unicos(roles) });
  }

  return handlers;
}

/** Over-grants del proxy para un archivo: la matriz deja pasar un rol que el handler rechaza. */
function infractoresDe(file: string): Infractor[] {
  const texto = fs.readFileSync(file, "utf8");
  const consts = constantesDeRoles(texto);
  validarParseo(texto, consts, file);
  const ruta = rutaApi(file);
  const infractores: Infractor[] = [];

  for (const { metodo, roles } of handlersDe(texto, consts, file)) {
    for (const rol of ROLES) {
      if (rol === ADMIN) continue; // el comodín '*' de ADMIN nunca es un over-grant real
      if (roles.includes(rol)) continue; // el handler lo acepta
      if (hasRouteAccess(rol, ruta, metodo).allowed) {
        infractores.push({
          clave: `${metodo} ${ruta}`,
          detalle: `${ruta} ${metodo} — la matriz le da ${rol}, el handler lo rechaza`,
        });
      }
    }
  }
  return infractores;
}

describe("consistencia matriz de autorización ↔ handlers", () => {
  const archivos = archivosRoute(API);

  it("descubre las rutas reales bajo src/app/api", () => {
    expect(archivos.length).toBeGreaterThan(0);
    expect(archivos.every((f) => f.endsWith("route.ts"))).toBe(true);
  });

  it("la matriz no le da a ningún rol un método que el handler rechaza", () => {
    const infractores = archivos.flatMap(infractoresDe).filter((i) => !(i.clave in EXCEPCIONES));

    // El mensaje nombra cada `path method` ofensor para ubicarlo sin abrir el test.
    expect(infractores.map((i) => i.detalle)).toEqual([]);
  });
});
