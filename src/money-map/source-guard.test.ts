import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extname(path) === ".ts" && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("financial firewall source guard", () => {
  it("contains no numeric parsing, coercion, or financial arithmetic", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const forbiddenCalls = ["parse" + "Float", "parse" + "Int", "Num" + "ber("];
    const financialArithmetic =
      /\b(?:amount|balance|premium|income|value)\w*\s+(?:\+|-|\*|\/|%)\s+\w/i;
    const unaryCoercion =
      /(?:return|=|:)\s*\+\s*(?:\w+\.)*(?:amount|balance|premium|income|value)\b/i;

    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const call of forbiddenCalls) expect(source).not.toContain(call);
      expect(source).not.toMatch(financialArithmetic);
      expect(source).not.toMatch(unaryCoercion);
    }
  });
});
