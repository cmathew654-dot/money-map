import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";

describe("starter chooser", () => {
  it("offers all four Money Map stories as equal entry points", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Choose a story" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retirement Income/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /RMD & Withholding/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Annuity Income Floor/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Roth Conversion/i })).toBeTruthy();
  });

  it("opens a scaffold workspace and preserves Back behavior", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Retirement Income/i }));
    expect(screen.getByRole("heading", { name: "Retirement Income" })).toBeTruthy();
    expect(screen.getByText("As of July 2026")).toBeTruthy();
    expect(screen.getByText("Synthetic demo · advisor-entered values")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back to stories" }));
    expect(screen.getByRole("heading", { name: "Choose a story" })).toBeTruthy();
  });
});
