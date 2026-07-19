import { readdirSync } from "node:fs";
import { join } from "node:path";

const SINGLE_QUOTE = "\x27";
const DOUBLE_QUOTE = "\x22";
const BACKSLASH = "\x5c";
const TEMPLATE_TICK = "\x60";

const FINANCIAL_NAME_PARTS = [
  "amount",
  "balance",
  "capacity",
  "computed" + "total",
  "debit",
  "income",
  "premium",
  "remainder",
  "tax" + "rate",
  "value",
];

function stripStringsAndComments(input: string): string {
  let output = "";
  let cursor = 0;
  let mode: "code" | "line-comment" | "block-comment" | "single" | "double" | "template" = "code";

  while (cursor < input.length) {
    const character = input[cursor];
    const nextCharacter = input[cursor + 1];

    if (mode === "code") {
      if (character === "/" && nextCharacter === "/") {
        output += "  ";
        cursor += 2;
        mode = "line-comment";
        continue;
      }
      if (character === "/" && nextCharacter === "*") {
        output += "  ";
        cursor += 2;
        mode = "block-comment";
        continue;
      }
      if (character === SINGLE_QUOTE || character === DOUBLE_QUOTE || character === TEMPLATE_TICK) {
        output += " ";
        mode =
          character === SINGLE_QUOTE
            ? "single"
            : character === DOUBLE_QUOTE
              ? "double"
              : "template";
        cursor += 1;
        continue;
      }
      output += character;
      cursor += 1;
      continue;
    }

    if (mode === "line-comment") {
      output += character === "\n" ? "\n" : " ";
      if (character === "\n") mode = "code";
      cursor += 1;
      continue;
    }

    if (mode === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        output += "  ";
        cursor += 2;
        mode = "code";
      } else {
        output += character === "\n" ? "\n" : " ";
        cursor += 1;
      }
      continue;
    }

    const delimiter =
      mode === "single" ? SINGLE_QUOTE : mode === "double" ? DOUBLE_QUOTE : TEMPLATE_TICK;
    if (character === BACKSLASH) {
      output += "  ";
      cursor += 2;
    } else if (character === delimiter) {
      output += " ";
      cursor += 1;
      mode = "code";
    } else {
      output += character === "\n" ? "\n" : " ";
      cursor += 1;
    }
  }

  return output;
}

function isFinancialOperand(operand: string): boolean {
  const parts = operand.split(".");
  return parts.some((part) => {
    const normalizedPart = part.toLocaleLowerCase();
    return FINANCIAL_NAME_PARTS.some((namePart) => normalizedPart.includes(namePart));
  });
}

export function findFinancialSourceViolations(input: string): string[] {
  const code = stripStringsAndComments(input);
  const violations: string[] = [];
  const parsingCalls = ["parse" + "Float", "parse" + "Int", "Num" + "ber"].join("|");
  const parsingPattern = new RegExp(`\\b(?:${parsingCalls})\\s*\\(`, "g");
  for (const match of code.matchAll(parsingPattern)) violations.push(match[0]);

  const identifier = "[A-Za-z_$][\\w$]*";
  const propertyOperand = `${identifier}(?:\\.${identifier})*`;
  const operand = `(?:${propertyOperand}|\\d+(?:\\.\\d+)?)`;
  const binaryPattern = new RegExp(
    `(${operand})\\s*(\\+=|-=|\\*=|\\/=|%=|\\+|-|\\*|/|%)\\s*(${operand})`,
    "g",
  );
  for (const match of code.matchAll(binaryPattern)) {
    if (isFinancialOperand(match[1]) || isFinancialOperand(match[3])) violations.push(match[0]);
  }

  const unaryPattern = new RegExp(
    `(?:^|\\breturn\\s+|[=(:,;{\\[])\\s*\\+\\s*(${propertyOperand})`,
    "gm",
  );
  for (const match of code.matchAll(unaryPattern)) {
    if (isFinancialOperand(match[1])) violations.push(match[0]);
  }

  return violations;
}

export function isScannableMoneyMapSource(path: string): boolean {
  const normalizedPath = path.toLocaleLowerCase();
  const isTypeScript = normalizedPath.endsWith(".ts") || normalizedPath.endsWith(".tsx");
  const isTest = normalizedPath.endsWith(".test.ts") || normalizedPath.endsWith(".test.tsx");
  return isTypeScript && !isTest;
}

export function moneyMapSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return moneyMapSourceFiles(path);
    return isScannableMoneyMapSource(path) ? [path] : [];
  });
}
