import { toGymWallClock } from "./gym-time";

describe("toGymWallClock", () => {
  it("corre el instante a hora de pared del gimnasio (UTC-3) para usar getUTC*", () => {
    const d = toGymWallClock(new Date("2026-10-06T01:30:00Z"));
    expect(d.getUTCDate()).toBe(5);
    expect(d.getUTCHours()).toBe(22);
  });
});
