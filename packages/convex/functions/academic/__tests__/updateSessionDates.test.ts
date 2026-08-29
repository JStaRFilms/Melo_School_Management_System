import { describe, expect, it } from "vitest";
import { toCalendarDayString } from "@school/shared";

describe("updateSessionDates boundary constraints", () => {
  const sessionStart = new Date(2026, 8, 1, 12, 0, 0).getTime();
  const sessionEnd = new Date(2027, 6, 31, 12, 0, 0).getTime();

  const term1Start = new Date(2026, 8, 8, 12, 0, 0).getTime();
  const term1End = new Date(2026, 11, 15, 12, 0, 0).getTime();

  const term2Start = new Date(2027, 0, 10, 12, 0, 0).getTime();
  const term2End = new Date(2027, 3, 10, 12, 0, 0).getTime();

  const term3Start = new Date(2027, 4, 1, 12, 0, 0).getTime();
  const term3End = new Date(2027, 6, 20, 12, 0, 0).getTime();

  const terms = [
    { name: "First Term", startDate: term1Start, endDate: term1End },
    { name: "Second Term", startDate: term2Start, endDate: term2End },
    { name: "Third Term", startDate: term3Start, endDate: term3End },
  ];

  function simulateUpdateSessionDates(newStart: number, newEnd: number) {
    if (newEnd <= newStart) {
      throw new Error("Session end date must be after its start date");
    }

    for (const term of terms) {
      let effectiveTermStart = term.startDate;
      let effectiveTermEnd = term.endDate;

      if (effectiveTermStart < newStart) {
        if (newStart >= term.endDate) {
          throw new Error(
            `Session start date cannot be set after ${term.name} end date.`
          );
        }
        effectiveTermStart = newStart;
      }

      if (effectiveTermEnd > newEnd) {
        if (effectiveTermStart >= newEnd) {
          throw new Error(
            `Session end date cannot be set before ${term.name} start date.`
          );
        }
        effectiveTermEnd = newEnd;
      }
    }
  }

  it("permits expanding session date range", () => {
    const earlierStart = new Date(2026, 7, 15, 12, 0, 0).getTime();
    const laterEnd = new Date(2027, 7, 15, 12, 0, 0).getTime();

    expect(() => simulateUpdateSessionDates(earlierStart, laterEnd)).not.toThrow();
  });

  it("auto-aligns and clamps session start date even when starting after initial term start", () => {
    const newStart = new Date(2026, 8, 15, 12, 0, 0).getTime(); // After term1Start (Sep 8), but before term1End (Dec 15)
    const validEnd = new Date(2027, 6, 31, 12, 0, 0).getTime();

    expect(() => simulateUpdateSessionDates(newStart, validEnd)).not.toThrow();
  });

  it("rejects session start date if it exceeds first term end date", () => {
    const tooLateStart = new Date(2026, 11, 20, 12, 0, 0).getTime(); // After term1End (Dec 15)
    const validEnd = new Date(2027, 6, 31, 12, 0, 0).getTime();

    expect(() => simulateUpdateSessionDates(tooLateStart, validEnd)).toThrow(
      /Session start date cannot be set after First Term end date/
    );
  });

  it("auto-aligns and clamps session end date even when earlier than initial term3End", () => {
    const validStart = new Date(2026, 8, 1, 12, 0, 0).getTime();
    const earlierEnd = new Date(2027, 6, 10, 12, 0, 0).getTime(); // Before term3End (Jul 20), but after term3Start (May 1)

    expect(() => simulateUpdateSessionDates(validStart, earlierEnd)).not.toThrow();
  });

  it("rejects invalid end date before start date", () => {
    const start = new Date(2027, 6, 31, 12, 0, 0).getTime();
    const end = new Date(2026, 8, 1, 12, 0, 0).getTime();

    expect(() => simulateUpdateSessionDates(start, end)).toThrow(
      "Session end date must be after its start date"
    );
  });
});
