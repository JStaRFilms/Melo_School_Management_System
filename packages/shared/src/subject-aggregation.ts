import type { GradingBand } from "./exam-recording";
import { deriveGradeAndRemark, round } from "./exam-recording";

export type SubjectAggregationStrategy =
  | "fixed_contribution"
  | "raw_combined_normalized";

export interface SubjectAggregationComponentScore {
  subjectId: string;
  ca1?: number | null;
  ca2?: number | null;
  ca3?: number | null;
  examScore?: number | null;
  total: number | null;
  rawMax?: number | null;
  contributionMax?: number | null;
}

export interface SubjectAggregationAssessmentConfig {
  ca1Max: number;
  ca2Max: number;
  ca3Max: number;
  examMax: number;
}

export interface DerivedAggregatedSubjectResult {
  ca1: number;
  ca2: number;
  ca3: number;
  examScore: number;
  aggregatedRawTotal: number;
  aggregatedRawMax: number;
  total: number;
  gradeLetter: string;
  remark: string;
  isRecorded: boolean;
}

function normalizeRawMax(value: number | null | undefined): number {
  if (typeof value === "number" && value > 0) {
    return value;
  }
  return 100;
}

function normalizePartMax(value: number | null | undefined, fallback: number) {
  if (typeof value === "number" && value > 0) {
    return value;
  }
  return fallback;
}

function normalizeRecordedPart(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function scaleRecordedPart(
  score: number,
  sourceMax: number,
  targetMax: number
): number {
  if (sourceMax <= 0 || targetMax <= 0) {
    return 0;
  }
  return (score / sourceMax) * targetMax;
}

function finalizeBreakdown(args: {
  ca1: number;
  ca2: number;
  ca3: number;
  examScore: number;
  total: number;
}) {
  const ca1 = round(args.ca1, 2);
  const ca2 = round(args.ca2, 2);
  const ca3 = round(args.ca3, 2);
  const examScore = round(args.total - ca1 - ca2 - ca3, 2);

  return {
    ca1,
    ca2,
    ca3,
    examScore,
    total: round(ca1 + ca2 + ca3 + examScore, 2),
  };
}

export function deriveAggregatedSubjectResult(args: {
  strategy: SubjectAggregationStrategy;
  components: SubjectAggregationComponentScore[];
  assessmentConfig?: Partial<SubjectAggregationAssessmentConfig>;
  gradingBands: GradingBand[];
}): DerivedAggregatedSubjectResult {
  const assessmentConfig = {
    ca1Max: normalizePartMax(args.assessmentConfig?.ca1Max, 20),
    ca2Max: normalizePartMax(args.assessmentConfig?.ca2Max, 20),
    ca3Max: normalizePartMax(args.assessmentConfig?.ca3Max, 20),
    examMax: normalizePartMax(args.assessmentConfig?.examMax, 40),
  };
  const assessmentTotalMax =
    assessmentConfig.ca1Max +
    assessmentConfig.ca2Max +
    assessmentConfig.ca3Max +
    assessmentConfig.examMax;
  const normalizedComponents = args.components.map((component) => ({
    ...component,
    ca1: normalizeRecordedPart(component.ca1),
    ca2: normalizeRecordedPart(component.ca2),
    ca3: normalizeRecordedPart(component.ca3),
    examScore: normalizeRecordedPart(component.examScore),
    rawMax: normalizeRawMax(component.rawMax),
  }));
  const isRecorded = normalizedComponents.every(
    (component) =>
      typeof component.total === "number" &&
      typeof component.ca1 === "number" &&
      typeof component.ca2 === "number" &&
      typeof component.ca3 === "number" &&
      typeof component.examScore === "number"
  );
  const aggregatedRawTotal = round(
    normalizedComponents.reduce(
      (sum, component) => sum + (component.total ?? 0),
      0
    ),
    2
  );
  const aggregatedRawMax = round(
    normalizedComponents.reduce((sum, component) => sum + component.rawMax, 0),
    2
  );

  if (!isRecorded) {
    return {
      ca1: 0,
      ca2: 0,
      ca3: 0,
      examScore: 0,
      aggregatedRawTotal,
      aggregatedRawMax,
      total: 0,
      gradeLetter: "-",
      remark: "Pending",
      isRecorded: false,
    };
  }

  let ca1: number;
  let ca2: number;
  let ca3: number;
  let examScore: number;
  let total: number;

  if (args.strategy === "fixed_contribution") {
    const merged = normalizedComponents.reduce(
      (sum, component) => {
        const contributionMax = component.contributionMax ?? 0;
        if (!contributionMax) {
          return sum;
        }

        const ca1Target =
          assessmentTotalMax <= 0
            ? 0
            : (contributionMax * assessmentConfig.ca1Max) / assessmentTotalMax;
        const ca2Target =
          assessmentTotalMax <= 0
            ? 0
            : (contributionMax * assessmentConfig.ca2Max) / assessmentTotalMax;
        const ca3Target =
          assessmentTotalMax <= 0
            ? 0
            : (contributionMax * assessmentConfig.ca3Max) / assessmentTotalMax;
        const examTarget =
          assessmentTotalMax <= 0
            ? 0
            : (contributionMax * assessmentConfig.examMax) / assessmentTotalMax;

        return {
          ca1:
            sum.ca1 +
            scaleRecordedPart(component.ca1!, assessmentConfig.ca1Max, ca1Target),
          ca2:
            sum.ca2 +
            scaleRecordedPart(component.ca2!, assessmentConfig.ca2Max, ca2Target),
          ca3:
            sum.ca3 +
            scaleRecordedPart(component.ca3!, assessmentConfig.ca3Max, ca3Target),
          examScore:
            sum.examScore +
            scaleRecordedPart(
              component.examScore!,
              assessmentConfig.examMax,
              examTarget
            ),
        };
      },
      { ca1: 0, ca2: 0, ca3: 0, examScore: 0 }
    );

    total = round(
      normalizedComponents.reduce((sum, component) => {
        const contributionMax = component.contributionMax ?? 0;
        if (!contributionMax || component.total === null || component.rawMax <= 0) {
          return sum;
        }
        return sum + (component.total / component.rawMax) * contributionMax;
      }, 0),
      2
    );
    ({ ca1, ca2, ca3, examScore, total } = finalizeBreakdown({
      ca1: merged.ca1,
      ca2: merged.ca2,
      ca3: merged.ca3,
      examScore: merged.examScore,
      total,
    }));
  } else {
    const componentCount = normalizedComponents.length;
    const ca1RawTotal = normalizedComponents.reduce(
      (sum, component) => sum + component.ca1!,
      0
    );
    const ca2RawTotal = normalizedComponents.reduce(
      (sum, component) => sum + component.ca2!,
      0
    );
    const ca3RawTotal = normalizedComponents.reduce(
      (sum, component) => sum + component.ca3!,
      0
    );
    const examRawTotal = normalizedComponents.reduce(
      (sum, component) => sum + component.examScore!,
      0
    );

    ca1 =
      componentCount <= 0
        ? 0
        : scaleRecordedPart(
            ca1RawTotal,
            componentCount * assessmentConfig.ca1Max,
            assessmentConfig.ca1Max
          );
    ca2 =
      componentCount <= 0
        ? 0
        : scaleRecordedPart(
            ca2RawTotal,
            componentCount * assessmentConfig.ca2Max,
            assessmentConfig.ca2Max
          );
    ca3 =
      componentCount <= 0
        ? 0
        : scaleRecordedPart(
            ca3RawTotal,
            componentCount * assessmentConfig.ca3Max,
            assessmentConfig.ca3Max
          );
    examScore =
      componentCount <= 0
        ? 0
        : scaleRecordedPart(
            examRawTotal,
            componentCount * assessmentConfig.examMax,
            assessmentConfig.examMax
          );
    total =
      aggregatedRawMax <= 0
        ? 0
        : round((aggregatedRawTotal / aggregatedRawMax) * 100, 2);
    ({ ca1, ca2, ca3, examScore, total } = finalizeBreakdown({
      ca1,
      ca2,
      ca3,
      examScore,
      total,
    }));
  }

  const { gradeLetter, remark } = deriveGradeAndRemark(total, args.gradingBands);

  return {
    ca1,
    ca2,
    ca3,
    examScore,
    aggregatedRawTotal,
    aggregatedRawMax,
    total,
    gradeLetter,
    remark,
    isRecorded: true,
  };
}
