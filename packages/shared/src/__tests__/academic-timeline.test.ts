import { describe, expect, it } from "vitest";
import {
  calculateDynamicTermSchedule,
  suggestTermDateRange,
} from "../academic-timeline";

describe("academic-timeline", () => {
  it("partitions a standard 10-month Nigerian school session cleanly into 3 terms", () => {
    // 2026-09-08 to 2027-07-24
    const start = new Date(2026, 8, 8, 12, 0, 0).getTime();
    const end = new Date(2027, 6, 24, 12, 0, 0).getTime();

    const terms = calculateDynamicTermSchedule(start, end);

    expect(terms).toHaveLength(3);

    const [t1, t2, t3] = terms;

    // Term 1 starts on session start
    expect(t1.name).toBe("First Term");
    expect(t1.startDate).toBe(start);
    expect(t1.isActive).toBe(true);
    expect(t1.resultCalculationMode).toBe("standalone");
    expect(t1.endDate).toBeGreaterThan(t1.startDate);

    // Term 2 starts after break
    expect(t2.name).toBe("Second Term");
    expect(t2.startDate).toBeGreaterThan(t1.endDate);
    expect(t2.endDate).toBeGreaterThan(t2.startDate);
    expect(t2.isActive).toBe(false);
    expect(t2.resultCalculationMode).toBe("standalone");

    // Term 3 starts after break and ends on session end
    expect(t3.name).toBe("Third Term");
    expect(t3.startDate).toBeGreaterThan(t2.endDate);
    expect(t3.endDate).toBe(end);
    expect(t3.isActive).toBe(false);
    expect(t3.resultCalculationMode).toBe("cumulative_annual");

    // Check holiday gap is at least 14 days (2 weeks)
    const gap1Days = (t2.startDate - t1.endDate) / (1000 * 60 * 60 * 24);
    const gap2Days = (t3.startDate - t2.endDate) / (1000 * 60 * 60 * 24);
    expect(gap1Days).toBeGreaterThanOrEqual(14);
    expect(gap2Days).toBeGreaterThanOrEqual(14);
  });

  it("handles custom edited session dates without overflowing bounds", () => {
    // Custom user session: 2026-10-01 to 2027-06-30
    const start = new Date(2026, 9, 1, 12, 0, 0).getTime();
    const end = new Date(2027, 5, 30, 12, 0, 0).getTime();

    const terms = calculateDynamicTermSchedule(start, end);

    expect(terms[0].startDate).toBe(start);
    expect(terms[2].endDate).toBe(end);

    for (const term of terms) {
      expect(term.startDate).toBeGreaterThanOrEqual(start);
      expect(term.endDate).toBeLessThanOrEqual(end);
      expect(term.endDate).toBeGreaterThan(term.startDate);
    }
  });

  it("suggests term date range for a specific term index", () => {
    const start = new Date(2026, 8, 8, 12, 0, 0).getTime();
    const end = new Date(2027, 6, 24, 12, 0, 0).getTime();

    const term1 = suggestTermDateRange(start, end, 0);
    const term2 = suggestTermDateRange(start, end, 1);
    const term3 = suggestTermDateRange(start, end, 2);

    expect(term1.startDate).toBe(start);
    expect(term2.startDate).toBeGreaterThan(term1.endDate);
    expect(term3.endDate).toBe(end);
  });
});
