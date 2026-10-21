import path from "path";
import { convertirMedia, type DepsMedia } from "../../prisma/convertir-media-data";

/** Sistema de archivos y ffmpeg simulados: `archivos` es el contenido del disco (ruta → tamaño en bytes). */
function fakeDeps(archivos: Record<string, number>, opciones: { falla?: (args: string[]) => boolean } = {}) {
  const llamadas: { comando: string; args: string[] }[] = [];
  const carpetas: string[] = [];
  const borrados: string[] = [];
  let enCurso = 0;
  let maxEnCurso = 0;
  const deps: DepsMedia = {
    existe: (ruta) => ruta in archivos,
    crearCarpeta: (ruta) => { carpetas.push(ruta); },
    tamaño: (ruta) => archivos[ruta] ?? 0,
    renombrar: (de, a) => { archivos[a] = archivos[de]; delete archivos[de]; },
    borrar: (ruta) => { borrados.push(ruta); delete archivos[ruta]; },
    ejecutar: async (comando, args) => {
      llamadas.push({ comando, args });
      enCurso++; maxEnCurso = Math.max(maxEnCurso, enCurso);
      await new Promise((r) => setTimeout(r, 1));
      enCurso--;
      if (opciones.falla?.(args)) throw new Error("ffmpeg salió con error");
      const salida = args[args.length - 1];
      archivos[salida] = salida.endsWith(".mp4") ? 8_000 : 3_000; // lo que "escribe" ffmpeg
    },
  };
  return { deps, archivos, llamadas, carpetas, borrados, maxEnCurso: () => maxEnCurso };
}

const ORIGEN = path.join("dataset", "videos");
const DESTINO = path.join("public", "ejercicios");
const gifs = (...ids: string[]) => Object.fromEntries(ids.map((id) => [path.join(ORIGEN, `${id}.gif`), 90_000]));
const base = { origen: ORIGEN, destino: DESTINO };

describe("convertirMedia: GIF → mp4 + miniatura (T-050d, D-70)", () => {
  it("convierte cada GIF a mp4 H.264 sin audio y le saca una miniatura jpg", async () => {
    const { deps, archivos, llamadas } = fakeDeps(gifs("0001-aaa"));
    await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa"] });

    expect(archivos[path.join(DESTINO, "0001-aaa.mp4")]).toBeDefined();
    expect(archivos[path.join(DESTINO, "0001-aaa.jpg")]).toBeDefined();

    const video = llamadas.find((l) => l.args.includes("libx264"))!;
    expect(video.comando).toBe("ffmpeg");
    expect(video.args).toEqual(expect.arrayContaining(["-i", path.join(ORIGEN, "0001-aaa.gif"), "-an", "-pix_fmt", "yuv420p", "+faststart"]));
    const poster = llamadas.find((l) => l.args.includes("-frames:v"))!;
    expect(poster.args).toEqual(expect.arrayContaining(["-i", path.join(ORIGEN, "0001-aaa.gif"), "1"]));
  });

  it("crea la carpeta de destino", async () => {
    const { deps, carpetas } = fakeDeps(gifs("0001-aaa"));
    await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa"] });
    expect(carpetas).toContain(DESTINO);
  });

  it("no deja archivos temporales: escribe a un nombre temporal y lo renombra al terminar", async () => {
    const { deps, archivos } = fakeDeps(gifs("0001-aaa"));
    await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa"] });
    expect(Object.keys(archivos).filter((k) => k.includes(".tmp"))).toEqual([]);
  });

  it("es repetible: lo que ya está convertido se omite, y --forzar lo reconvierte", async () => {
    const { deps, llamadas } = fakeDeps(gifs("0001-aaa", "0002-bbb"));
    await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa", "0002-bbb"] });
    const primera = llamadas.length;

    const r = await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa", "0002-bbb"] });
    expect(llamadas.length).toBe(primera);
    expect(r).toMatchObject({ convertidos: 0, omitidos: 2 });

    const f = await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa", "0002-bbb"], forzar: true });
    expect(f).toMatchObject({ convertidos: 2, omitidos: 0 });
  });

  it("si el mp4 está pero falta la miniatura, genera solo la miniatura", async () => {
    const { deps, llamadas } = fakeDeps({ ...gifs("0001-aaa"), [path.join(DESTINO, "0001-aaa.mp4")]: 8_000 });
    await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa"] });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].args).toContain("-frames:v");
  });

  it("si faltan GIF de origen, falla ANTES de convertir nada y los lista", async () => {
    const { deps, llamadas } = fakeDeps(gifs("0001-aaa"));
    await expect(convertirMedia(deps, { ...base, mediaIds: ["0001-aaa", "0002-bbb", "0003-ccc"] })).rejects.toThrow(
      /0002-bbb[\s\S]*0003-ccc/
    );
    expect(llamadas).toHaveLength(0);
  });

  it("nunca corre más conversiones a la vez que la concurrencia pedida", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `00${i}-x`);
    const f = fakeDeps(gifs(...ids));
    await convertirMedia(f.deps, { ...base, mediaIds: ids, concurrencia: 3 });
    expect(f.maxEnCurso()).toBeLessThanOrEqual(3);
    expect(f.maxEnCurso()).toBeGreaterThan(1);
  });

  it("--dry-run no ejecuta ni crea nada", async () => {
    const f = fakeDeps(gifs("0001-aaa"));
    const r = await convertirMedia(f.deps, { ...base, mediaIds: ["0001-aaa"], dryRun: true });
    expect(r).toMatchObject({ convertidos: 1, dryRun: true });
    expect(f.llamadas).toHaveLength(0);
    expect(f.carpetas).toHaveLength(0);
  });

  it("si ffmpeg falla, el error nombra el archivo y no queda un mp4 a medias que se confunda con uno bueno", async () => {
    const f = fakeDeps(gifs("0001-aaa"), { falla: (args) => args.some((a) => a.endsWith(".tmp.mp4")) });
    await expect(convertirMedia(f.deps, { ...base, mediaIds: ["0001-aaa"] })).rejects.toThrow(/0001-aaa/);
    expect(Object.keys(f.archivos).filter((k) => k.endsWith(".mp4"))).toEqual([]);
  });

  it("informa cuánto pesaban los GIF y cuánto pesa lo convertido", async () => {
    const { deps } = fakeDeps(gifs("0001-aaa", "0002-bbb"));
    const r = await convertirMedia(deps, { ...base, mediaIds: ["0001-aaa", "0002-bbb"] });
    expect(r.bytesOrigen).toBe(180_000);
    expect(r.bytesDestino).toBe(2 * (8_000 + 3_000));
  });
});
