import { describe, expect, it } from "vitest";
import { calculateDynamicTermSchedule } from "@school/shared";

describe("createSession dynamic term generation", () => {
  it("generates 3 bounded terms for custom edited dates matching user screenshot scenario", () => {
    // 7 Sept 2026 to 23 Jul 2027
    const sessionStart = new Date(2026, 8, 7, 12, 0, 0).getTime();
    const sessionEnd = new Date(2027, 6, 23, 12, 0, 0).getTime();

    const terms = calculateDynamicTermSchedule(sessionStart, sessionEnd);

    expect(terms).toHaveLength(3);

    const [term1, term2, term3] = terms;

    // Check all dates strictly within bounds
    expect(term1.startDate).toBe(sessionStart);
    expect(term1.endDate).toBeGreaterThan(term1.startDate);

    expect(term2.startDate).toBeGreaterThan(term1.endDate);
    expect(term2.endDate).toBeGreaterThan(term2.startDate);

    expect(term3.startDate).toBeGreaterThan(term2.endDate);
    expect(term3.endDate).toBe(sessionEnd);

    // Verify all terms stay strictly inside the session
    for (const t of terms) {
      expect(t.startDate).toBeGreaterThanOrEqual(sessionStart);
      expect(t.endDate).toBeLessThanOrEqual(sessionEnd);
    }
  });

  it("handles late start session (e.g. November start) without errors", () => {
    const sessionStart = new Date(2026, 10, 1, 12, 0, 0).getTime();
    const sessionEnd = new Date(2027, 6, 15, 12, 0, 0).getTime();

    const terms = calculateDynamicTermSchedule(sessionStart, sessionEnd);

    expect(terms).toHaveLength(3);
    expect(terms[0].startDate).toBe(sessionStart);
    expect(terms[2].endDate).toBe(sessionEnd);

    // Strictly strictly ordered
    expect(terms[0].endDate).toBeLessThan(terms[1].startDate);
    expect(terms[1].endDate).toBeLessThan(terms[2].startDate);
  });
});
