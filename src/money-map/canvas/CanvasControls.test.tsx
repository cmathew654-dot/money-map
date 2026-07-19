import { render, screen } from "@testing-library/react";
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
    await user.click(screen.getByRole("button", { name: "Fit map" }));
    await user.click(screen.getByRole("button", { name: "Fit selection" }));

    expect(screen.getByText("125%")).toBeTruthy();
    expect(controller.zoomOut).toHaveBeenCalledOnce();
    expect(controller.resetZoom).toHaveBeenCalledOnce();
    expect(controller.zoomIn).toHaveBeenCalledOnce();
    expect(controller.fitMap).toHaveBeenCalledOnce();
    expect(controller.fitSelection).toHaveBeenCalledOnce();
  });
});
