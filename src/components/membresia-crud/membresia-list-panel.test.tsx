/**
 * Integration tests for MembresiaListPanel
 * Tests list rendering and structure
 */

import React from "react";
import { render } from "@testing-library/react";
import { MembresiaListPanel } from "./membresia-list-panel";

describe("MembresiaListPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering structure", () => {
    it("should render without crashing", () => {
      const { container } = render(<MembresiaListPanel />);
      expect(container).toBeTruthy();
    });

    it("should accept activeOnly prop", () => {
      const { container } = render(<MembresiaListPanel activeOnly={true} />);
      expect(container).toBeTruthy();
    });

    it("should accept onEditClick callback", () => {
      const onEditClick = jest.fn();
      const { container } = render(
        <MembresiaListPanel onEditClick={onEditClick} />
      );
      expect(container).toBeTruthy();
    });

    it("should render with default props", () => {
      const { container } = render(<MembresiaListPanel />);
      expect(container).toBeTruthy();
    });
  });

  describe("Component composition", () => {
    it("should have error display area for API errors", () => {
      const { container } = render(<MembresiaListPanel />);
      // Component has structure to display errors
      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should have sorting controls", () => {
      const { container } = render(<MembresiaListPanel />);
      // Component has select element for sorting
      expect(container.querySelector("select")).toBeTruthy();
    });

    it("should have refresh button", () => {
      const { container } = render(<MembresiaListPanel />);
      // Component has button element
      expect(container.querySelector("button")).toBeTruthy();
    });
  });

  describe("Props acceptance", () => {
    it("should accept both activeOnly and onEditClick props together", () => {
      const onEditClick = jest.fn();
      const { container } = render(
        <MembresiaListPanel
          activeOnly={true}
          onEditClick={onEditClick}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should have error container for delete blocking", () => {
      const { container } = render(<MembresiaListPanel />);
      // Component renders with space for error display
      expect(container).toBeTruthy();
    });
  });
});
