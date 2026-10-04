import { turnoActual, startOfGymDay, hourInGym } from "./gym-time";

describe("turnoActual (límites asumidos: Mañana 06–14, Tarde 14–22, Noche 22–06, hora argentina)", () => {
  it.each([
    ["2026-09-30T09:00:00Z", "MANANA"], // 06:00 ART
    ["2026-09-30T16:59:00Z", "MANANA"], // 13:59 ART
    ["2026-09-30T17:00:00Z", "TARDE"], // 14:00 ART
    ["2026-10-01T00:59:00Z", "TARDE"], // 21:59 ART
    ["2026-10-01T01:00:00Z", "NOCHE"], // 22:00 ART
    ["2026-09-30T08:59:00Z", "NOCHE"], // 05:59 ART
  ])("%s → %s", (iso, turno) => {
    expect(turnoActual(new Date(iso))).toBe(turno);
  });
});

describe("startOfGymDay / hourInGym", () => {
  const NOW = new Date("2026-09-30T18:00:00Z"); // 15:00 ART
  it("el día argentino empieza a las 03:00Z", () => {
    expect(startOfGymDay(NOW)).toEqual(new Date("2026-09-30T03:00:00Z"));
    expect(startOfGymDay(new Date("2026-10-01T01:30:00Z"))).toEqual(new Date("2026-09-30T03:00:00Z")); // 22:30 ART sigue siendo el 30
  });

  it("hourInGym devuelve la hora argentina (UTC-3)", () => {
    expect(hourInGym(NOW)).toBe(15);
    expect(hourInGym(new Date("2026-10-01T02:30:00Z"))).toBe(23);
  });
});
