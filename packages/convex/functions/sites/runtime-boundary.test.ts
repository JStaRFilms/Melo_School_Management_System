// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";

test("deployable Sites modules importing Node APIs declare the Node runtime", async () => {
  const directory = new URL("./", import.meta.url);
  const checked: string[] = [];
  for (const file of await readdir(directory)) {
    // Convex excludes multi-dot test/spec files from function entry points.
    if (!file.endsWith(".ts") || (file.match(/\./g) ?? []).length !== 1) continue;
    const url = new URL(file, directory);
    const source = ts.createSourceFile(fileURLToPath(url), await readFile(url, "utf8"), ts.ScriptTarget.Latest, true);
    const importsNode = source.statements.some(statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("node:") &&
      statement.importClause?.isTypeOnly !== true,
    );
    if (!importsNode) continue;
    checked.push(file);
    const first = source.statements[0];
    expect(ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use node", file).toBe(true);
  }
  expect(checked).toContain("providerNode.ts");
});
