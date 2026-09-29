import { describe, expect, it } from "vitest";
import { assertBranchDoc, CROSS_SCHOOL_ACCESS_DENIED } from "../tenantScope";

const SCHOOL = "school_1" as unknown as never;

describe("assertBranchDoc (consolidation P2)", () => {
  it("passes a same-school doc through", () => {
    const doc = { schoolId: SCHOOL };
    expect(() => assertBranchDoc(doc, SCHOOL)).not.toThrow();
  });

  it("throws the boundary error on missing or foreign docs", () => {
    expect(() => assertBranchDoc(null, SCHOOL)).toThrow(CROSS_SCHOOL_ACCESS_DENIED);
    expect(() => assertBranchDoc(undefined, SCHOOL)).toThrow(
      CROSS_SCHOOL_ACCESS_DENIED,
    );
    expect(() =>
      assertBranchDoc({ schoolId: "school_2" }, SCHOOL),
    ).toThrow(CROSS_SCHOOL_ACCESS_DENIED);
  });

  it("rejects archived docs only with excludeArchived", () => {
    const archived = { schoolId: SCHOOL, isArchived: true };
    expect(() => assertBranchDoc(archived, SCHOOL)).not.toThrow();
    expect(() => assertBranchDoc(archived, SCHOOL, { excludeArchived: true })).toThrow(
      CROSS_SCHOOL_ACCESS_DENIED,
    );
  });

  it("preserves oracle messages without inventing new ones", () => {
    expect(() =>
      assertBranchDoc(null, SCHOOL, { message: "Aggregation not found." }),
    ).toThrow("Aggregation not found.");
  });
});
