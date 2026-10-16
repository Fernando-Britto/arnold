import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabPanel } from "./tabs";

function Harness() {
  const [active, setActive] = useState("a");
  return (
    <Tabs
      tabs={[
        { id: "a", label: "Parámetros" },
        { id: "b", label: "Dispositivos" },
      ]}
      activeId={active}
      onChange={setActive}
    >
      {active === "a" ? (
        <TabPanel id="a">Panel A</TabPanel>
      ) : (
        <TabPanel id="b">Panel B</TabPanel>
      )}
    </Tabs>
  );
}

describe("Tabs", () => {
  it("marca la pestaña activa y enlaza tablist/tab/tabpanel", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-label",
      "Secciones de configuración"
    );

    const activa = screen.getByRole("tab", { name: "Parámetros" });
    expect(activa).toHaveAttribute("aria-selected", "true");
    expect(activa).toHaveAttribute("aria-controls", "tabpanel-a");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Panel A");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-a");
  });

  it("cambia de panel al clickear otra pestaña", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "Dispositivos" }));

    expect(screen.getByRole("tab", { name: "Dispositivos" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel B");
  });

  it("navega con las flechas y mueve el foco (activación automática)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: "Parámetros" }).focus();
    await user.keyboard("{ArrowRight}");

    const dispositivos = screen.getByRole("tab", { name: "Dispositivos" });
    expect(dispositivos).toHaveAttribute("aria-selected", "true");
    expect(dispositivos).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Parámetros" })).toHaveFocus();
  });
});
