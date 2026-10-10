import { diagnose, summarize } from "../prisma/db-latency-report";

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
