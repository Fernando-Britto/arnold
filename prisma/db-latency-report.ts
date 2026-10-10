/**
 * Lógica pura del diagnóstico de latencia a la base (P-07). La mide prisma/db-latency.ts
 * (`npm run db:latency`); acá solo se resumen los números y se interpretan, para poder probarlo.
 */
export interface Resumen {
  min: number;
  mediana: number;
  max: number;
}

export function summarize(xs: number[]): Resumen {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const mediana = s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  return { min: s[0], mediana, max: s[s.length - 1] };
}

/** Por debajo de esto (ms) la base responde rápido. */
const RAPIDA_MS = 100;
/** Una consulta ida y vuelta de este tamaño o más es "base lejos". */
const LEJOS_MS = 300;
/** Si 14 consultas juntas tardan al menos esto × una sola, el pool las atiende de a tandas. */
const POOL_CHICO_RATIO = 2.5;
/** Una conexión nueva es "lenta" si tarda al menos esto (ms) y 3 veces una consulta normal. */
const FRIO_MS = 1000;

export function diagnose(m: { frio: number; seq: number[]; par: number[] }): string[] {
  const seq = summarize(m.seq);
  const par = summarize(m.par);
  const ratio = par.mediana / seq.mediana;
  const out = [
    `Una consulta sola (${m.seq.length} seguidas): mínimo ${seq.min} ms, mediana ${seq.mediana} ms, máximo ${seq.max} ms.`,
    `14 consultas a la vez (${m.par.length} veces): mínimo ${par.min} ms, mediana ${par.mediana} ms, máximo ${par.max} ms (${ratio.toFixed(1)}× una sola).`,
    `Primera consulta con conexión en frío: ${m.frio} ms.`,
    "",
  ];

  if (seq.mediana >= LEJOS_MS) {
    out.push(
      `• La base está lejos: cada consulta tarda ~${seq.mediana} ms solo de red. Lo que más ayuda es tener pocos viajes seguidos ` +
        "(ya hecho en Home_Interno) y, si es posible, que el proyecto de Supabase esté en una región más cercana (São Paulo para Argentina)."
    );
  } else if (seq.mediana >= RAPIDA_MS) {
    out.push(
      `• La base responde con una latencia moderada (~${seq.mediana} ms por consulta). Los viajes seguidos a la base suman ese tiempo cada uno: ` +
        "por eso Home_Interno junta todas sus consultas en una sola ronda y conviene evitar consultas encadenadas."
    );
  } else {
    out.push(`• La base responde rápido (~${seq.mediana} ms por consulta): la latencia de red no es el problema.`);
  }

  if (ratio >= POOL_CHICO_RATIO) {
    out.push(
      "• Las consultas en paralelo se atienden de a tandas: el pool de conexiones es chico. Probá agregar `connection_limit=15` " +
        "a DATABASE_URL (con el pooler de Supabase en el puerto 6543 además hace falta `pgbouncer=true`) y volvé a correr esto."
    );
  } else {
    out.push("• El pool de conexiones atiende bien las consultas en paralelo: no hace falta tocar nada ahí.");
    if (par.max >= FRIO_MS) {
      out.push(
        `• El primer lote de 14 consultas tardó ${par.max} ms: es la apertura de las conexiones del pool, una sola vez; ` +
          `con las conexiones abiertas, 14 consultas juntas tardan ~${par.mediana} ms.`
      );
    }
  }

  if (m.frio >= FRIO_MS && m.frio >= seq.mediana * 3) {
    out.push(
      `• Abrir una conexión nueva cuesta ${m.frio} ms (en frío): por eso la primera request después de un rato sin uso es lenta. ` +
        "En producción (Vercel) conviene usar el pooler de Supabase."
    );
  }
  return out;
}

/**
 * Interpreta el benchmark del armado de Home_Interno y de la verificación de sesión del proxy,
 * corridos fuera de Next (prisma/bench-home-interno.ts). La primera corrida de cada serie es la
 * "en frío" (abre las conexiones); las siguientes son las representativas.
 */
export function diagnoseBench(m: { rtt: number; builder: number[]; auth: number[] }): string[] {
  const [primeraB, ...restoB] = m.builder;
  const [primeraA, ...restoA] = m.auth;
  const b = summarize(restoB);
  const a = summarize(restoA);
  const viajes = b.mediana / m.rtt;
  const out = [
    `Una consulta sola (referencia): ~${m.rtt} ms.`,
    `Armado de Home_Interno (14 consultas), fuera de Next: primera corrida (conexiones en frío) ${primeraB} ms; ` +
      `las siguientes: mínimo ${b.min} ms, mediana ${b.mediana} ms, máximo ${b.max} ms.`,
    `Verificación de sesión del proxy (usuario + revocación): primera ${primeraA} ms; ` +
      `las siguientes: mínimo ${a.min} ms, mediana ${a.mediana} ms, máximo ${a.max} ms.`,
    "",
  ];

  if (b.mediana <= 3 * m.rtt) {
    out.push(
      `• Fuera de Next el armado tarda ~${b.mediana} ms (≈ ${viajes.toFixed(1)} viajes de ${m.rtt} ms): la base y el código andan bien. ` +
        "Si en `npm run dev` ves bastante más, la diferencia es del servidor de desarrollo (compilación, recarga, conexiones del proxy), " +
        "que no existe en producción."
    );
  } else {
    out.push(
      `• Incluso fuera de Next el armado tarda ~${b.mediana} ms (${viajes.toFixed(1)}× una consulta): hay consultas pesadas en la base ` +
        "o conexiones que se reabren entre corridas. Pasame esta salida y vemos cuál."
    );
  }

  if (a.mediana <= 2.5 * m.rtt) {
    out.push(`• La verificación de sesión cuesta ~${a.mediana} ms (≈ 1 viaje): lo esperado.`);
  } else {
    out.push(`• La verificación de sesión cuesta ${a.mediana} ms: más de lo esperable para un solo viaje de ~${m.rtt} ms.`);
  }
  return out;
}
