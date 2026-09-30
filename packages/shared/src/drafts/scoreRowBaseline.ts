export type ScoreRowBaseline = {
  id: string;
  updatedAt: number;
  ca1: number;
  ca2: number;
  ca3: number;
  examRawScore: number;
} | null;

export function scoreRowBaseline(record: {
  _id: string;
  updatedAt: number;
  ca1: number;
  ca2: number;
  ca3: number;
  examRawScore: number;
} | null | undefined): ScoreRowBaseline {
  return record ? {
    id: record._id, updatedAt: record.updatedAt,
    ca1: record.ca1, ca2: record.ca2, ca3: record.ca3, examRawScore: record.examRawScore,
  } : null;
}

export function matchesScoreRowBaseline(actual: ScoreRowBaseline, expected: ScoreRowBaseline): boolean {
  return actual === null || expected === null
    ? actual === expected
    : actual.id === expected.id && actual.updatedAt === expected.updatedAt &&
      actual.ca1 === expected.ca1 && actual.ca2 === expected.ca2 &&
      actual.ca3 === expected.ca3 && actual.examRawScore === expected.examRawScore;
}
