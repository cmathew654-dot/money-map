import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findFinancialSourceViolations,
  isScannableMoneyMapSource,
  moneyMapSourceFiles,
} from "./source-guard";

describe("financial firewall source guard", () => {
  it.each([
    ["decimal parsing", "parseFloat(value)"],
    ["integer parsing", "parseInt(balance, 10)"],
    ["number coercion", "Number(amount)"],
    ["unary numeric coercion", "const result = +accountBalance"],
    ["financial right operand", "const result = 1 - balance"],
    ["compact financial arithmetic", "const result = balance+amount"],
    ["compound financial arithmetic", "value += amount"],
  ])("detects %s", (_description, source) => {
    expect(findFinancialSourceViolations(source)).not.toEqual([]);
  });

  it.each([
    ["geometry addition", "const nextX = point.x + 32"],
    ["geometry subtraction", "const left = 1 - point.x"],
    ["type-only financial name", "type Amount = string"],
    ["interface-only financial name", "interface Balance { label: string }"],
    ["double-quoted literal", 'const label = "balance+amount"'],
    ["single-quoted literal", "const label = 'Number(amount)'"],
    ["comment", "// parseFloat(value)"],
  ])("allows %s", (_description, source) => {
    expect(findFinancialSourceViolations(source)).toEqual([]);
  });

  it("recognizes TypeScript and TSX production files but excludes tests", () => {
    expect(isScannableMoneyMapSource("model/document.ts")).toBe(true);
    expect(isScannableMoneyMapSource("canvas/Module.tsx")).toBe(true);
    expect(isScannableMoneyMapSource("model/document.test.ts")).toBe(false);
    expect(isScannableMoneyMapSource("canvas/Module.test.tsx")).toBe(false);
    expect(isScannableMoneyMapSource("notes.md")).toBe(false);
  });

  it("finds no forbidden operations in Money Map production TypeScript or TSX", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = moneyMapSourceFiles(root);

    expect(files.some((file) => file.endsWith("types.ts"))).toBe(true);
    for (const file of files) {
      expect(findFinancialSourceViolations(readFileSync(file, "utf8")), file).toEqual([]);
    }
  });
});
