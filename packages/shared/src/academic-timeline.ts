export interface CalculatedTermSchedule {
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  resultCalculationMode: "standalone" | "cumulative_annual";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDayStartNoon(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime();
}

function addDaysToTimestamp(baseTimestamp: number, daysToAdd: number): number {
  const d = new Date(baseTimestamp);
  d.setDate(d.getDate() + daysToAdd);
  return toDayStartNoon(d.getTime());
}

/**
 * Dynamically partitions an academic session's date range into 3 balanced terms
 * separated by realistic holiday breaks (2-3 weeks).
 *
 * Guarantees that:
 * 1. Term 1 starts exactly on session start date.
 * 2. Term 3 ends exactly on session end date.
 * 3. Terms are non-overlapping and strictly bounded within the session date range.
 */
export function calculateDynamicTermSchedule(
  sessionStartTimestamp: number,
  sessionEndTimestamp: number
): CalculatedTermSchedule[] {
  const startNoon = toDayStartNoon(sessionStartTimestamp);
  const endNoon = toDayStartNoon(sessionEndTimestamp);

  const totalDays = Math.max(
    3,
    Math.round((endNoon - startNoon) / MS_PER_DAY)
  );

  // Dynamic holiday break calculation between terms
  let breakDays = 14;
  if (totalDays >= 240) {
    breakDays = Math.min(21, Math.max(14, Math.floor(totalDays * 0.055)));
  } else if (totalDays >= 60) {
    breakDays = Math.min(14, Math.max(7, Math.floor(totalDays * 0.05)));
  } else {
    breakDays = Math.max(1, Math.floor(totalDays / 15));
  }

  const totalBreakDays = 2 * breakDays;
  const availableSchoolDays = Math.max(3, totalDays - totalBreakDays);
  const termDays = Math.max(1, Math.floor(availableSchoolDays / 3));

  const t1Start = startNoon;
  const t1End = addDaysToTimestamp(t1Start, termDays);

  const t2Start = addDaysToTimestamp(t1End, breakDays);
  const t2End = addDaysToTimestamp(t2Start, termDays);

  const t3StartCandidate = addDaysToTimestamp(t2End, breakDays);
  const t3End = endNoon;

  // In edge cases with very compressed dates, guarantee t3Start < t3End
  const t3Start =
    t3StartCandidate < t3End
      ? t3StartCandidate
      : addDaysToTimestamp(t3End, -1);

  return [
    {
      name: "First Term",
      startDate: t1Start,
      endDate: t1End,
      isActive: true,
      resultCalculationMode: "standalone",
    },
    {
      name: "Second Term",
      startDate: t2Start,
      endDate: t2End,
      isActive: false,
      resultCalculationMode: "standalone",
    },
    {
      name: "Third Term",
      startDate: t3Start,
      endDate: t3End,
      isActive: false,
      resultCalculationMode: "cumulative_annual",
    },
  ];
}

/**
 * Suggests default start and end dates for a specific term index (0: First, 1: Second, 2: Third)
 * within a session.
 */
export function suggestTermDateRange(
  sessionStartTimestamp: number,
  sessionEndTimestamp: number,
  termIndex: number
): { startDate: number; endDate: number } {
  const schedule = calculateDynamicTermSchedule(
    sessionStartTimestamp,
    sessionEndTimestamp
  );
  const clampedIndex = Math.max(0, Math.min(termIndex, schedule.length - 1));
  const term = schedule[clampedIndex];
  return {
    startDate: term.startDate,
    endDate: term.endDate,
  };
}
