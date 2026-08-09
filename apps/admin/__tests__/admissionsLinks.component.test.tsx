import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

describe("admissions application link component boundary", () => {
  test("uses the canonical resolver and never constructs a local Apply origin", () => {
    const componentFiles = [
      "../app/admissions/AdmissionsHub.tsx",
      "../app/admissions/AdmissionsTriage.tsx",
      "../app/admissions/AdmissionsFormBuilder.tsx",
    ];
    const source = componentFiles
      .map((file) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8"))
      .join("\n");

    expect(source).not.toContain("localhost:3006");
    expect(source).not.toContain("window.location.origin");
    expect(source.match(/functions\/foundation\/applicationLinks:getApplicationLink/g)).toHaveLength(2);
    expect(source.match(/copyCanonicalApplicationLink/g)).toHaveLength(4);
  });
});
