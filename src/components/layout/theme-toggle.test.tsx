import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.tema;
    document.cookie = "tema=; path=/; max-age=0";
  });

  it("alterna claro → oscuro → claro sobre <html>", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Cambiar tema" }));
    expect(document.documentElement.dataset.tema).toBe("oscuro");

    await user.click(screen.getByRole("button", { name: "Cambiar tema" }));
    expect(document.documentElement.dataset.tema).toBe("claro");
  });

  it("tiene nombre accesible", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Cambiar tema" })).toBeInTheDocument();
  });
});
