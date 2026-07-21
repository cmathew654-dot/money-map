import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CanvasControls } from "./CanvasControls";

describe("CanvasControls", () => {
  it("exposes accessible camera controls and delegates every action", async () => {
    const user = userEvent.setup();
    const controller = {
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      zoomIn: vi.fn(),
      fitMap: vi.fn(),
      fitSelection: vi.fn(),
    };

    render(<CanvasControls controller={controller} zoomPercentage={125} />);

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Fit story" }));
    await user.click(screen.getByRole("button", { name: "Fit selection" }));

    expect(screen.getByText("125%")).toBeTruthy();
    expect(controller.zoomOut).toHaveBeenCalledOnce();
    expect(controller.resetZoom).toHaveBeenCalledOnce();
    expect(controller.zoomIn).toHaveBeenCalledOnce();
    expect(controller.fitMap).toHaveBeenCalledOnce();
    expect(controller.fitSelection).toHaveBeenCalledOnce();
  });
  it("uses one roving tab stop with Arrow and Home/End navigation", () => {
    const controller = {
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      zoomIn: vi.fn(),
      fitMap: vi.fn(),
      fitSelection: vi.fn(),
    };

    render(<CanvasControls controller={controller} zoomPercentage={100} />);
    const toolbar = screen.getByRole("toolbar", { name: "Canvas camera" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);

    fireEvent.keyDown(toolbar, { key: "End" });
    expect(document.activeElement).toBe(buttons[4]);
    fireEvent.keyDown(buttons[4], { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });
});
