import Home from "./page";
import { getSessionUser } from "@/lib/session";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));
jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn() }));

it.each([
  [null, "/login"],
  [{ rol: "SOCIO" }, "/home-socio"],
  [{ rol: "INSTRUCTOR" }, "/home-interno"],
  [{ rol: "RECEPCIONISTA" }, "/home-interno"],
  [{ rol: "ADMINISTRADOR" }, "/home-interno"],
])("sesión %j redirige a %s", async (user, dest) => {
  (getSessionUser as jest.Mock).mockResolvedValue(user);
  await expect(Home()).rejects.toThrow(`REDIRECT:${dest}`);
});
