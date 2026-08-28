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

  function validateNewSessionDates(newStart: number, newEnd: number) {
    if (newEnd <= newStart) {
      throw new Error("Session end date must be after its start date");
    }

    const newStartStr = toCalendarDayString(newStart);
    const newEndStr = toCalendarDayString(newEnd);

    for (const term of terms) {
      const termStartStr = toCalendarDayString(term.startDate);
      const termEndStr = toCalendarDayString(term.endDate);

      if (termStartStr < newStartStr) {
        throw new Error(
          `Session start date (${newStartStr}) cannot be after ${term.name} start date (${termStartStr}). Adjust the term dates first.`
        );
      }
      if (termEndStr > newEndStr) {
        throw new Error(
          `Session end date (${newEndStr}) cannot be before ${term.name} end date (${termEndStr}). Adjust the term dates first.`
        );
      }
    }
  }

  it("permits expanding session date range", () => {
    const earlierStart = new Date(2026, 7, 15, 12, 0, 0).getTime();
    const laterEnd = new Date(2027, 7, 15, 12, 0, 0).getTime();

    expect(() => validateNewSessionDates(earlierStart, laterEnd)).not.toThrow();
  });

  it("permits tightening session date range as long as all terms remain enclosed", () => {
    const tightStart = new Date(2026, 8, 5, 12, 0, 0).getTime();
    const tightEnd = new Date(2027, 6, 25, 12, 0, 0).getTime();

    expect(() => validateNewSessionDates(tightStart, tightEnd)).not.toThrow();
  });

  it("rejects session start date after the first term begins", () => {
    const tooLateStart = new Date(2026, 8, 15, 12, 0, 0).getTime();
    const validEnd = new Date(2027, 6, 31, 12, 0, 0).getTime();

    expect(() => validateNewSessionDates(tooLateStart, validEnd)).toThrow(
      /Session start date.*cannot be after First Term start date/
    );
  });

  it("rejects session end date before the last term ends", () => {
    const validStart = new Date(2026, 8, 1, 12, 0, 0).getTime();
    const tooEarlyEnd = new Date(2027, 6, 10, 12, 0, 0).getTime();

    expect(() => validateNewSessionDates(validStart, tooEarlyEnd)).toThrow(
      /Session end date.*cannot be before Third Term end date/
    );
  });

  it("rejects invalid end date before start date", () => {
    const start = new Date(2027, 6, 31, 12, 0, 0).getTime();
    const end = new Date(2026, 8, 1, 12, 0, 0).getTime();

    expect(() => validateNewSessionDates(start, end)).toThrow(
      "Session end date must be after its start date"
    );
  });
});
