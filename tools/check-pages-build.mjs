import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const indexPath = resolve("dist/index.html");
const html = await readFile(indexPath, "utf8");
const references = [...html.matchAll(/\b(?:href|src)=\x22([^\x22]+)\x22/g)]
  .map((match) => match[1])
  .filter((reference) => !/^(?:#|data:|https?:|mailto:|tel:)/.test(reference));

if (references.length === 0) {
  throw new Error("Expected the production index to reference at least one local asset.");
}

const rootRelative = references.filter((reference) => reference.startsWith("/"));
if (rootRelative.length > 0) {
  throw new Error(`Pages build contains root-relative assets: ${rootRelative.join(", ")}`);
}

const nonRelative = references.filter((reference) => !reference.startsWith("./"));
if (nonRelative.length > 0) {
  throw new Error(`Pages build contains non-relative assets: ${nonRelative.join(", ")}`);
}

await Promise.all(
  references.map((reference) => {
    const assetPath = reference.split(/[?#]/, 1)[0];
    return access(resolve(dirname(indexPath), assetPath));
  }),
);

console.log(`Verified ${references.length} relative production asset references.`);
