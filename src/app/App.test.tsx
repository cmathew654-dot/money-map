import { render, screen } from "@testing-library/react";

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
});
