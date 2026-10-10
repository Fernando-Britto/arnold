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
  }

  if (m.frio >= FRIO_MS && m.frio >= seq.mediana * 3) {
    out.push(
      `• Abrir una conexión nueva cuesta ${m.frio} ms (en frío): por eso la primera request después de un rato sin uso es lenta. ` +
        "En producción (Vercel) conviene usar el pooler de Supabase."
    );
  }
  return out;
}
