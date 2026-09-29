import { describe, expect, it } from "vitest";
import { isDraftExpired, resolveDraftExpiryDate } from "../draftGuard";
import { assertBoundedRows } from "../boundedRead";
import { isEmailAddress, normalizeEmailCase } from "../normalize";

describe("foundation shared mechanics (consolidation P13)", () => {
  it("resolves draft expiry from explicit date or retention window", () => {
    expect(resolveDraftExpiryDate({ expiresAt: 1000, createdAt: 1 }, 30)).toBe(1000);
    expect(resolveDraftExpiryDate({ expiresAt: null, createdAt: 1000 }, 30)).toBe(
      1000 + 30 * 86400000,
    );
    expect(isDraftExpired({ expiresAt: 1000, createdAt: 1 }, 30, 1001)).toBe(true);
    expect(isDraftExpired({ expiresAt: null, createdAt: 1000 }, 30, 1001)).toBe(false);
  });

  it("validates email shape without caps", () => {
    expect(isEmailAddress("parent@example.com")).toBe(true);
    expect(isEmailAddress("a@b")).toBe(false);
    expect(isEmailAddress("no-at-sign")).toBe(false);
    expect(isEmailAddress("a @b.com")).toBe(false);
    expect(normalizeEmailCase("  Parent@Example.COM ")).toBe("parent@example.com");
  });

  it("bounds row lists or throws the caller error", () => {
    expect(assertBoundedRows([1, 2], 100, () => {
      throw new Error("over");
    })).toEqual([1, 2]);
    expect(() =>
      assertBoundedRows(new Array(101).fill(0), 100, () => {
        throw new Error("over limit");
      }),
    ).toThrow("over limit");
  });
});
