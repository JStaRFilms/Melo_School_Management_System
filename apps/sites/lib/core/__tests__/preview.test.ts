import { describe, expect, test } from "vitest";
import { previewPathPrefix, previewTokenFromPath } from "@/core/preview";

describe("preview route parsing", () => {
  test("accepts only the opaque token segment and preserves its path prefix", () => {
    expect(previewTokenFromPath("/__preview/opaque-token/policies/current")).toBe("opaque-token");
    expect(previewTokenFromPath("/__preview")).toBeUndefined();
    expect(previewPathPrefix("opaque token")).toBe("/__preview/opaque%20token");
  });
});
