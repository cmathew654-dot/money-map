import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { InlineField } from "./InlineField";

describe("InlineField", () => {
  it.each(["~$11,800/mo", "$20,000\u2013?", "$_____", "\u2014"])(
    "commits the exact literal %s with Enter",
    (literal) => {
      const commit = vi.fn();
      render(
        <InlineField ariaLabel="Value" value={literal} onCommit={commit} onCancel={vi.fn()} />,
      );
      const input = screen.getByRole("textbox", { name: "Value" });
      fireEvent.change(input, { target: { value: literal } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(commit).toHaveBeenCalledWith(literal);
    },
  );

  it("selects on open and restores on Escape", () => {
    const commit = vi.fn();
    const cancel = vi.fn();
    render(
      <InlineField ariaLabel="Title" value="Exact prior" onCommit={commit} onCancel={cancel} />,
    );
    const input = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    const select = vi.spyOn(input, "select");
    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(cancel).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits exact content on blur", () => {
    const commit = vi.fn();
    render(
      <InlineField ariaLabel="Title" value="Exact prior" onCommit={commit} onCancel={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Blurred exact" } });
    fireEvent.blur(input);
    expect(commit).toHaveBeenCalledWith("Blurred exact");
  });

  it("does not commit Enter while IME composition is active", () => {
    const commit = vi.fn();
    render(<InlineField ariaLabel="Title" value="prior" onCommit={commit} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "composed" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commit).toHaveBeenCalledWith("composed");
  });
});
