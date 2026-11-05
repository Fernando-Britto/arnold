import {
  CLAVES,
  conCache,
  invalidarCache,
  invalidarCachePorPrefijo,
  leerCache,
  limpiarCache,
} from "./cache-cliente";

describe("cache-cliente", () => {
  beforeEach(() => limpiarCache());
  afterEach(() => jest.restoreAllMocks());

  it("devuelve el valor cacheado sin volver a cargar", async () => {
    const cargar = jest.fn().mockResolvedValue([1]);

    expect(await conCache("lista", cargar)).toEqual([1]);
    expect(await conCache("lista", cargar)).toEqual([1]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("deduplica dos cargas concurrentes de la misma clave", async () => {
    let resolver!: (valor: number[]) => void;
    const cargar = jest.fn(
      () => new Promise<number[]>((resolve) => { resolver = resolve; })
    );

    const primera = conCache("lista", cargar);
    const segunda = conCache("lista", cargar);
    resolver([2]);

    expect(await Promise.all([primera, segunda])).toEqual([[2], [2]]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("vuelve a cargar cuando vence el TTL", async () => {
    let ahora = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => ahora);
    const cargar = jest.fn().mockResolvedValueOnce(["viejo"]).mockResolvedValueOnce(["nuevo"]);

    expect(await conCache("lista", cargar, 1_000)).toEqual(["viejo"]);
    ahora += 1_001;
    expect(await conCache("lista", cargar, 1_000)).toEqual(["nuevo"]);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("invalidarCache fuerza la próxima carga", async () => {
    const cargar = jest.fn().mockResolvedValueOnce(["viejo"]).mockResolvedValueOnce(["nuevo"]);

    expect(await conCache("lista", cargar)).toEqual(["viejo"]);
    invalidarCache("lista");
    expect(await conCache("lista", cargar)).toEqual(["nuevo"]);
  });

  it("no cachea un error y deja reintentar", async () => {
    const cargar = jest
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(["ok"]);

    await expect(conCache("lista", cargar)).rejects.toThrow("boom");
    expect(await conCache("lista", cargar)).toEqual(["ok"]);
  });

  it("limpiarCache vacía todas las claves", async () => {
    const cargar = jest.fn().mockResolvedValueOnce(["uno"]).mockResolvedValueOnce(["dos"]);

    expect(await conCache("lista", cargar)).toEqual(["uno"]);
    limpiarCache();
    expect(await conCache("lista", cargar)).toEqual(["dos"]);
  });

  it("cada clave tiene su propio valor", async () => {
    expect(await conCache("a", async () => ["a"])).toEqual(["a"]);
    expect(await conCache("b", async () => ["b"])).toEqual(["b"]);
  });

  it("leerCache devuelve el valor vigente sin cargar", async () => {
    const cargar = jest.fn().mockResolvedValue(["guardado"]);
    await conCache("lista", cargar);

    expect(leerCache<string[]>("lista")).toEqual(["guardado"]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("leerCache devuelve null después de invalidar la clave", async () => {
    await conCache("lista", async () => ["guardado"]);

    invalidarCache("lista");

    expect(leerCache("lista")).toBeNull();
  });

  it("leerCache devuelve null cuando vence el TTL", async () => {
    let ahora = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => ahora);
    await conCache("lista", async () => ["guardado"], 1_000);

    expect(leerCache("lista")).toEqual(["guardado"]);
    ahora += 1_001;
    expect(leerCache("lista")).toBeNull();
  });

  it("invalidarCachePorPrefijo borra las claves del prefijo y respeta las demás", async () => {
    await conCache(CLAVES.balanceMuscular("semana"), async () => ({ periodo: "semana" }));
    await conCache(CLAVES.balanceMuscular("90d"), async () => ({ periodo: "90d" }));
    await conCache(CLAVES.homeSocio, async () => ({ inicio: true }));

    invalidarCachePorPrefijo("balance-muscular:");

    expect(leerCache(CLAVES.balanceMuscular("semana"))).toBeNull();
    expect(leerCache(CLAVES.balanceMuscular("90d"))).toBeNull();
    expect(leerCache(CLAVES.homeSocio)).toEqual({ inicio: true });
  });
});
