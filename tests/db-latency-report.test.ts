import { diagnose, diagnoseBench, summarize } from "../prisma/db-latency-report";

describe("summarize", () => {
  it("mínimo, mediana y máximo", () => {
    expect(summarize([300, 100, 200])).toEqual({ min: 100, mediana: 200, max: 300 });
  });

  it("con cantidad par, la mediana es el promedio de los dos del medio", () => {
    expect(summarize([100, 200, 300, 400])).toEqual({ min: 100, mediana: 250, max: 400 });
  });
});

describe("diagnose", () => {
  const run = (frio: number, seq: number[], par: number[]) => diagnose({ frio, seq, par }).join("\n");

  it("base lejos: cada consulta tarda mucho solo de red", () => {
    const out = run(900, [500, 520, 480], [550, 560, 540]);
    expect(out).toMatch(/lejos/i);
    expect(out).toMatch(/región/i);
  });

  it("base cerca y pool sano: lo dice", () => {
    const out = run(400, [60, 70, 65], [80, 90, 85]);
    expect(out).toMatch(/responde rápido/i);
    expect(out).not.toMatch(/lejos/i);
    expect(out).not.toMatch(/connection_limit/);
    expect(out).toMatch(/pool.*(bien|alcanza|atiende)/i);
  });

  it("consultas en paralelo que tardan varias veces una sola: pool chico → sugiere connection_limit", () => {
    const out = run(400, [100, 100, 100], [320, 330, 340]);
    expect(out).toMatch(/connection_limit/);
    expect(out).toMatch(/de a tandas|tandas/i);
  });

  it("conexión en frío mucho más lenta que una consulta normal: lo explica", () => {
    const out = run(2200, [150, 140, 160], [200, 210, 190]);
    expect(out).toMatch(/en frío/i);
    expect(out).toMatch(/2200/);
  });

  it("siempre incluye los números medidos", () => {
    const out = run(500, [100, 120, 110], [150, 160, 155]);
    expect(out).toMatch(/110/); // mediana secuencial
    expect(out).toMatch(/155/); // mediana en paralelo
  });
});

describe("diagnose — casos intermedios", () => {
  const run = (frio: number, seq: number[], par: number[]) => diagnose({ frio, seq, par }).join("\n");

  it("~200 ms por consulta: moderada, no 'rápida' ni 'lejos' (cada viaje seguido cuesta)", () => {
    const out = run(900, [212, 193, 230], [203, 190, 210]);
    expect(out).toMatch(/moderada/i);
    expect(out).not.toMatch(/responde rápido/i);
    expect(out).not.toMatch(/lejos/i);
    expect(out).toMatch(/viajes seguidos/i);
  });

  it("un primer lote paralelo lento con el resto normal es la apertura del pool, no un problema", () => {
    const out = run(2178, [212, 193, 230], [2120, 190, 205, 200, 187]);
    expect(out).toMatch(/apertura/i);
    expect(out).toMatch(/2120/);
    expect(out).not.toMatch(/connection_limit/);
  });
});

describe("diagnoseBench", () => {
  const run = (rtt: number, builder: number[], auth: number[]) => diagnoseBench({ rtt, builder, auth }).join("\n");

  it("fuera de Next el armado ronda 1–3 viajes: la base y el código andan bien, lo extra es del servidor de desarrollo", () => {
    const out = run(200, [2100, 380, 410, 360, 395], [250, 230, 240, 235, 260]);
    expect(out).toMatch(/servidor de desarrollo/i);
    expect(out).not.toMatch(/consultas pesadas/i);
  });

  it("separa la primera corrida (en frío) de las siguientes", () => {
    const out = run(200, [2100, 380, 410, 360, 395], [250, 230, 240, 235, 260]);
    expect(out).toMatch(/primera corrida.*2100 ms/); // la primera, aparte
    expect(out).toMatch(/mínimo 360 ms/); // mínimo de las siguientes (380, 410, 360, 395): no incluye la primera
    expect(out).not.toMatch(/mínimo 2100/);
  });

  it("si incluso fuera de Next tarda mucho más que unos pocos viajes: lo marca como problema de la base", () => {
    const out = run(200, [2500, 1500, 1700, 1400, 1600], [250, 230, 240, 235, 260]);
    expect(out).toMatch(/consultas pesadas|reabren conexiones/i);
    expect(out).not.toMatch(/servidor de desarrollo/i);
  });

  it("la verificación de sesión debería costar ~1 viaje: si cuesta más, lo dice", () => {
    expect(run(200, [2100, 380, 410, 360], [900, 880, 950, 910])).toMatch(/sesión[\s\S]*más de lo esperable/i);
    expect(run(200, [2100, 380, 410, 360], [250, 230, 240, 235])).toMatch(/sesión[\s\S]*viaje/i);
  });
});
