/**
 * Conversión de las instrucciones del catálogo de ejercicios a español rioplatense (voseo y vocabulario).
 * Dominio PURO. El dataset trae los textos en castellano (tuteo: "Túmbate", "Mantén", "suelo") y en Argentina
 * se dice "Acostate", "Mantené", "piso". Es un conversor por reglas pensado para el vocabulario acotado de las
 * instrucciones de gimnasio, no un traductor general: solo toca los verbos del léxico y solo donde la posición
 * garantiza que son un imperativo, para no convertir adjetivos ("la parte baja") ni palabras que casualmente
 * contienen un verbo ("tomate").
 */

/** Imperativo de tú (sin tilde) → infinitivo. De ahí salen el imperativo de vos y el presente de vos. */
const VERBOS: Readonly<Record<string, string>> = {
  abraza: "abrazar", abre: "abrir", acerca: "acercar", activa: "activar", adopta: "adoptar", agacha: "agachar",
  agarra: "agarrar", ajusta: "ajustar", alarga: "alargar", aleja: "alejar", alterna: "alternar", alza: "alzar",
  aplica: "aplicar", apoya: "apoyar", aprieta: "apretar", arrodilla: "arrodillar", asegura: "asegurar",
  aterriza: "aterrizar", atrapa: "atrapar", aumenta: "aumentar", avanza: "avanzar", ayuda: "ayudar", baja: "bajar",
  balancea: "balancear", bloquea: "bloquear", busca: "buscar", cambia: "cambiar", camina: "caminar", cierra: "cerrar",
  coloca: "colocar", comienza: "comenzar", concentra: "concentrar", configura: "configurar", conserva: "conservar",
  continua: "continuar", contrae: "contraer", controla: "controlar", corre: "correr", cruza: "cruzar", cuelga: "colgar",
  curva: "curvar", da: "dar", deja: "dejar", descansa: "descansar", desea: "desear", desengancha: "desenganchar",
  deshaz: "deshacer", desliza: "deslizar", desplaza: "desplazar", deten: "detener", devuelve: "devolver",
  disminuye: "disminuir", dobla: "doblar", eleva: "elevar", empieza: "empezar", empuja: "empujar", encoge: "encoger",
  endereza: "enderezar", enfria: "enfriar", enrolla: "enrollar", entrelaza: "entrelazar", envuelve: "envolver",
  equilibra: "equilibrar", estabiliza: "estabilizar", estira: "estirar", evita: "evitar", exhala: "exhalar",
  extiende: "extender", flexiona: "flexionar", gira: "girar", haz: "hacer", impulsa: "impulsar", inclina: "inclinar",
  incorpora: "incorporar", inhala: "inhalar", inicia: "iniciar", intenta: "intentar", invierte: "invertir",
  jala: "tirar", // "jalar" es mexicanismo: en Argentina se dice "tirar"
  junta: "juntar", lanza: "lanzar", levanta: "levantar", libera: "liberar", lleva: "llevar", manten: "mantener",
  mueve: "mover", necesita: "necesitar", nota: "notar", pasa: "pasar", pide: "pedir", pisa: "pisar", pivota: "pivotar",
  planta: "plantar", pon: "poner", posiciona: "posicionar", presiona: "presionar", realiza: "realizar", recibe: "recibir",
  reclina: "reclinar", recuerda: "recordar", recuesta: "recostar", reduce: "reducir", regresa: "regresar",
  reinicia: "reiniciar", relaja: "relajar", repite: "repetir", respira: "respirar", retrae: "retraer",
  retrocede: "retroceder", rota: "rotar", rueda: "rodar", saca: "sacar", salta: "saltar", selecciona: "seleccionar",
  separa: "separar", sienta: "sentar", siente: "sentir", sigue: "seguir", sosten: "sostener", sube: "subir",
  suelta: "soltar", sujeta: "sujetar", tensa: "tensar", termina: "terminar", tira: "tirar", toca: "tocar", toma: "tomar",
  transfiere: "transferir", traslada: "trasladar",
  tumba: "acostar", // "tumbarse" es de España: en Argentina "acostarse"
  ubica: "ubicar", usa: "usar", utiliza: "utilizar", vuelve: "volver",
};

/** Bases cuyo imperativo con pronombre pegado se escribe SIN tilde ("ponte", "mantenla", "date"). */
const SIN_TILDE_CON_CLITICO: ReadonlySet<string> = new Set(["pon", "haz", "deshaz", "manten", "sosten", "deten", "da"]);

/** Pronombres que se pegan al imperativo, de más largo a más corto para no cortar "las" como "la". */
const CLITICOS = ["nos", "las", "los", "les", "te", "se", "me", "la", "lo", "le"] as const;

/** Presentes de tú con raíz irregular, que no salen de la regla "imperativo + s". */
const PRESENTE_TU_IRREGULAR: Readonly<Record<string, string>> = {
  mantienes: "mantenés", sostienes: "sostenés", haces: "hacés", deshaces: "deshacés", pones: "ponés",
  detienes: "detenés", tienes: "tenés", puedes: "podés", debes: "debés", quieres: "querés", sabes: "sabés", eres: "sos",
};

/**
 * Después de estas palabras un verbo de la lista es un presente de tú ("mientras bajas", "el brazo que extiendes"),
 * no un adjetivo ("poleas bajas"). Entre ellas y el verbo pueden ir pronombres y adverbios de `INTERCALADAS`.
 */
const ANTES_DE_PRESENTE: ReadonlySet<string> = new Set(["mientras", "cuando", "si", "aunque", "que"]);

/** Palabras que pueden ir entre "mientras" y el verbo: "mientras te agachas", "si lo deseas", "mientras al mismo tiempo levantas". */
const INTERCALADAS: ReadonlySet<string> = new Set([
  "te", "se", "me", "lo", "la", "los", "las", "le", "les", "simultáneamente", "también", "al", "mismo", "tiempo", "a", "vez",
]);

/** Palabras que después de "y" suelen ser un adjetivo ("flexionadas y juntas"), no un segundo verbo. */
const ADJETIVOS_AMBIGUOS: ReadonlySet<string> = new Set(["juntas", "bajas", "altas", "alternas", "plantas", "sujetas", "rotas", "tensas", "activas"]);

/** Frases que preceden a una orden sin coma: "…y de inmediato baja", "…pero esta vez gira". */
const FRASE_ANTES_DE_ORDEN = /(de inmediato|esta vez|al mismo tiempo|a la vez|a continuación)$/;

/** Después de estas palabras un verbo de la lista es un imperativo encadenado ("coloca la barra y baja"). */
const ANTES_DE_IMPERATIVO: ReadonlySet<string> = new Set(["y", "e", "o", "pero", "luego", "después", "entonces", "ahora", "ni"]);

const PALABRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;

/** Quita solo los acentos agudos (conserva la ñ y la ü). */
const sinTilde = (palabra: string): string => palabra.normalize("NFD").replace(/\u0301/g, "").normalize("NFC");

const imitarMayuscula = (original: string, nueva: string): string =>
  original[0] !== original[0].toLowerCase() ? nueva[0].toUpperCase() + nueva.slice(1) : nueva;

const TERMINACION_VOS_IMPERATIVO = { ar: "á", er: "é", ir: "í" } as const;
const TERMINACION_VOS_PRESENTE = { ar: "ás", er: "és", ir: "ís" } as const;
type Clase = keyof typeof TERMINACION_VOS_IMPERATIVO;
const claseDe = (infinitivo: string): Clase => infinitivo.slice(-2) as Clase;

/** Presente de tú ("bajas") → presente de vos ("bajás"), para todos los verbos del léxico. */
const PRESENTE_VOS: ReadonlyMap<string, string> = (() => {
  const mapa = new Map(Object.entries(PRESENTE_TU_IRREGULAR));
  for (const [base, infinitivo] of Object.entries(VERBOS)) {
    // "sienta" (sentar) daría "sientas", que choca con el subjuntivo de "sentir" ("cuando sientas"): no se toca.
    if (SIN_TILDE_CON_CLITICO.has(base) || base === "sienta") continue;
    mapa.set(`${base}s`, infinitivo.slice(0, -2) + TERMINACION_VOS_PRESENTE[claseDe(infinitivo)]);
  }
  return mapa;
})();

interface Imperativo {
  infinitivo: string;
  clitico: string | null;
}

/** ¿Es la palabra un imperativo de tú del léxico, con o sin pronombre pegado? */
function reconocerImperativo(palabra: string): Imperativo | null {
  const plana = sinTilde(palabra.toLowerCase());
  if (VERBOS[plana]) return { infinitivo: VERBOS[plana], clitico: null };

  for (const clitico of CLITICOS) {
    if (plana.length <= clitico.length || !plana.endsWith(clitico)) continue;
    const base = plana.slice(0, -clitico.length);
    const infinitivo = VERBOS[base];
    if (!infinitivo) continue;
    // Con pronombre, el imperativo de tú lleva tilde ("colócala"); sin ella solo en las bases de una sílaba o
    // que pierden la tilde ("ponte", "mantenla"). Así "tomate" no es "toma" + "te" y "levantala" (ya vos) no se toca.
    if (/[áéíóú]/i.test(palabra) || SIN_TILDE_CON_CLITICO.has(base)) return { infinitivo, clitico };
  }
  return null;
}

/** Imperativo de vos: sin pronombre lleva tilde en la última sílaba; con pronombre, la raíz del infinitivo + pronombre. */
function imperativoDeVos({ infinitivo, clitico }: Imperativo): string {
  if (clitico) return infinitivo.slice(0, -1) + clitico; // levantar + las → "levantalas"; poner + te → "ponete"
  return infinitivo.slice(0, -2) + TERMINACION_VOS_IMPERATIVO[claseDe(infinitivo)]; // levantar → "levantá"
}

/** Dónde está una palabra respecto de la oración: decide si un verbo ambiguo es una orden o un presente de tú. */
function contexto(antes: string, actual: string): {
  inicioDeOracion: boolean;
  trasComa: boolean;
  anterior: string;
  trasFraseDeOrden: boolean;
  esPresenteDeTu: boolean;
} {
  const t = antes.replace(/\s+$/, "");
  const palabras = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? []).map((w) => w.toLowerCase());
  // Solo cuenta lo que está en la misma cláusula: una coma o un punto cortan el alcance de "mientras".
  const clausula = t.slice(Math.max(t.lastIndexOf(","), t.lastIndexOf("."), t.lastIndexOf(";"), t.lastIndexOf(":")) + 1);
  const enClausula = (clausula.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? []).map((w) => w.toLowerCase());

  const conActual = [...enClausula, actual.toLowerCase()];
  const esPresenteDeTu = enContextoDePresente(conActual, conActual.length - 1);

  return {
    inicioDeOracion: t === "" || /[.:;!?]$/.test(t),
    trasComa: t.endsWith(","),
    anterior: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/.test(t) ? (palabras[palabras.length - 1] ?? "") : "",
    trasFraseDeOrden: FRASE_ANTES_DE_ORDEN.test(t.toLowerCase()),
    esPresenteDeTu,
  };
}

/**
 * ¿La palabra en `posicion` de `palabras` (la cláusula hasta la palabra evaluada, incluida) va después de un "mientras"/"cuando"/"si"/"que" (con pronombres o
 * adverbios en medio), o encadenada con "y" a otro presente que sí lo está? Es recursivo para que "las poleas bajas
 * y las plantas" no tome "bajas" (adjetivo) por un verbo y arrastre a "plantas".
 */
function enContextoDePresente(palabras: readonly string[], posicion: number): boolean {
  // "mientras llevas la rodilla hacia el pecho y giras…": un "y" pegado al verbo y otro presente antes en la cláusula
  if (
    posicion >= 2 &&
    ["y", "e", "o"].includes(palabras[posicion - 1]) &&
    !ADJETIVOS_AMBIGUOS.has(palabras[posicion] ?? "") &&
    palabras.slice(0, posicion - 1).some((_, j) => esPresenteDeTu(palabras[j]) && enContextoDePresente(palabras, j))
  ) {
    return true;
  }
  let i = posicion - 1;
  while (i >= 0 && INTERCALADAS.has(palabras[i])) i--;
  if (i < 0) return false;
  if (ANTES_DE_PRESENTE.has(palabras[i])) return true;
  return ["y", "e", "o"].includes(palabras[i]) && i >= 1 && esPresenteDeTu(palabras[i - 1]) && enContextoDePresente(palabras, i - 1);
}

/** ¿La palabra es un presente de tú del léxico, o ya está en voseo? (para encadenar "empujas y tiras") */
function esPresenteDeTu(palabra: string): boolean {
  return PRESENTE_VOS.has(sinTilde(palabra)) || [...PRESENTE_VOS.values()].includes(palabra);
}

/** Palabras de España o de otra variante que en el Río de la Plata se dicen distinto (con su concordancia). */
function adaptarVocabulario(texto: string): string {
  const igualar = (original: string, nueva: string) => imitarMayuscula(original, nueva);
  return texto
    // balón → pelota: cambia el género, así que el artículo va con la palabra
    .replace(/\b(el|El|un|Un|este|Este|ese|Ese)\s+balón\b/g, (_, art: string) => {
      const femenino = ({ el: "la", un: "una", este: "esta", ese: "esa" } as Record<string, string>)[art.toLowerCase()];
      return `${igualar(art, femenino)} pelota`;
    })
    .replace(/\b(del|Del)\s+balón\b/g, (_, art: string) => `${igualar(art, "de")} la pelota`)
    .replace(/\b(al|Al)\s+balón\b/g, (_, art: string) => `${igualar(art, "a")} la pelota`)
    .replace(/\b(los|Los|unos|Unos)\s+balones\b/g, (_, art: string) => `${igualar(art, art.toLowerCase() === "los" ? "las" : "unas")} pelotas`)
    .replace(/\b(Balón|balón)\b/g, (m) => igualar(m, "pelota"))
    .replace(/\b(Balones|balones)\b/g, (m) => igualar(m, "pelotas"))
    // suelo → piso, esterilla → colchoneta, tumbado → acostado
    .replace(/\b(Suelos?|suelos?)\b/g, (m) => igualar(m, m.toLowerCase().replace("suelo", "piso")))
    .replace(/\b(Esterillas?|esterillas?)\b/g, (m) => igualar(m, m.toLowerCase().replace("esterilla", "colchoneta")))
    .replace(/\b(Tumbad|tumbad)(o|a|os|as)\b/g, (m, raiz: string, fin: string) => igualar(m, `acostad${fin}`))
    .replace(/\b(Tumb|tumb)(ándote|ándose|arte|arse|ar)\b/g, (m, _raiz: string, fin: string) => igualar(m, `acost${fin}`));
}

/** Convierte un texto de instrucciones a español rioplatense. Es idempotente: pasarlo dos veces da lo mismo. */
export function aRioplatense(texto: string): string {
  const conVocabulario = adaptarVocabulario(texto);

  return conVocabulario.replace(PALABRA, (palabra: string, desplazamiento: number) => {
    const { inicioDeOracion, trasComa, anterior, trasFraseDeOrden, esPresenteDeTu: trasMientras } = contexto(
      conVocabulario.slice(0, desplazamiento),
      palabra
    );
    const minuscula = palabra.toLowerCase();

    // Presente de tú: solo en una posición donde sin duda es un verbo ("mientras bajas")
    const presente = PRESENTE_VOS.get(sinTilde(minuscula));
    if (presente && trasMientras) return imitarMayuscula(palabra, presente);

    const imperativo = reconocerImperativo(palabra);
    if (!imperativo) return palabra;

    // Con pronombre pegado ("llévalas") es un imperativo en cualquier posición; sin pronombre, "baja" puede ser
    // un adjetivo, así que solo se convierte donde empieza una orden.
    const esOrden = inicioDeOracion || trasComa || trasFraseDeOrden || ANTES_DE_IMPERATIVO.has(anterior);
    if (imperativo.clitico === null && !esOrden) return palabra;

    return imitarMayuscula(palabra, imperativoDeVos(imperativo));
  });
}
