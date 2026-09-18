import { describe, expect, it } from "vitest";
import {
  formatDateGBDay,
  formatDateTimeNG,
  formatMoneyMajor,
  formatMoneyMinor,
  formatScoreOrDash,
} from "../format";

describe("shared format primitives (consolidation P19)", () => {
  it("formats major-unit money with two decimals", () => {
    expect(formatMoneyMajor(50000, "NGN")).toBe("₦50,000.00");
    expect(formatMoneyMajor(0, "NGN")).toBe("₦0.00");
    expect(formatMoneyMajor(-1500.5, "NGN")).toBe("-₦1,500.50");
    expect(formatMoneyMajor(123456789.99, "NGN")).toBe("₦123,456,789.99");
  });

  it("keeps the minor-unit trap explicit", () => {
    // 50000 kobo is 500 naira: Minor and Major disagree by 100x by design.
    expect(formatMoneyMinor(50000, "NGN")).toContain("500");
    expect(formatMoneyMinor(50000, "NGN")).not.toBe(formatMoneyMajor(50000, "NGN"));
    expect(formatMoneyMinor(0, "NGN")).toContain("0");
  });

  it("formats the portal day variant and the admin datetime variant", () => {
    const noon = Date.UTC(2026, 5, 15, 12, 0, 0);
    expect(formatDateGBDay(noon)).toBe("15 Jun 2026");
    expect(formatDateTimeNG(noon)).toContain("2026");
  });

  it("renders scores with dash for null", () => {
    expect(formatScoreOrDash(null)).toBe("—");
    expect(formatScoreOrDash(85)).toBe("85");
    expect(formatScoreOrDash(87.25)).toBe("87.3");
  });
});
