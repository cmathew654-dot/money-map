import { isAuthoringViewportSupported } from "./MoneyMapWorkspace";

describe("authoring minimum", () => {
  it.each([
    [1180, 660, true],
    [1179, 660, false],
    [1180, 659, false],
  ])("treats %sx%s support as %s", (width, height, supported) => {
    expect(isAuthoringViewportSupported(width, height)).toBe(supported);
  });
});
