import React from "react";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { navigateTo } from "@/lib/navigation";

jest.mock("@/lib/navigation", () => ({ navigateTo: jest.fn() }));

const user = { id: "u1", nombre: "Ana", email: "a@arnold.gym", rol: "SOCIO" as const };
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider initialUser={user}>{children}</AuthProvider>
);

beforeEach(() => (navigateTo as jest.Mock).mockClear());

it("logout llama a /api/auth/logout y navega a /login", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  const { result } = renderHook(() => useAuth(), { wrapper });
  await act(async () => { await result.current.logout(); });
  expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  expect(navigateTo).toHaveBeenCalledWith("/login");
});

it("navega a /login aunque el fetch falle", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
  const { result } = renderHook(() => useAuth(), { wrapper });
  await act(async () => { await result.current.logout(); });
  expect(navigateTo).toHaveBeenCalledWith("/login");
});
