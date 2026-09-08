import { v } from "convex/values";
import { reportCardExtraPrintableValidator } from "../academic/reportCardExtrasModel";
export const reportCardResultValidator = v.object({
  gradingPolicy: v.optional(
    v.object({
      version: v.number(),
      source: v.union(
        v.literal("current"),
        v.literal("snapshot"),
        v.literal("historical_missing"),
      ),
      bands: v.array(
        v.object({
          gradeLetter: v.string(),
          minScore: v.number(),
          maxScore: v.number(),
          remark: v.string(),
          colorHex: v.optional(v.string()),
        }),
      ),
    }),
  ),
  certifiedAt: v.optional(v.number()),
  schoolName: v.string(),
  schoolLogoUrl: v.union(v.string(), v.null()),
  schoolAddress: v.optional(v.union(v.string(), v.null())),
  schoolContact: v.optional(v.union(v.string(), v.null())),
  schoolMotto: v.optional(v.union(v.string(), v.null())),
  theme: v.optional(
    v.object({
      primaryColor: v.string(),
      accentColor: v.string(),
    }),
  ),
  sessionName: v.string(),
  termName: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  generatedAt: v.number(),
  assessmentConfig: v.object({
    ca1Max: v.number(),
    ca2Max: v.number(),
    ca3Max: v.number(),
    examMax: v.number(),
  }),
  resultCalculationMode: v.union(
    v.literal("standalone"),
    v.literal("cumulative_annual"),
  ),
  student: v.object({
    _id: v.id("students"),
    name: v.string(),
    displayName: v.string(),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    admissionNumber: v.string(),
    gender: v.union(v.string(), v.null()),
    dateOfBirth: v.union(v.number(), v.null()),
    guardianName: v.union(v.string(), v.null()),
    guardianPhone: v.union(v.string(), v.null()),
    address: v.union(v.string(), v.null()),
    houseName: v.union(v.string(), v.null()),
    nextTermBegins: v.union(v.number(), v.null()),
    photoUrl: v.union(v.string(), v.null()),
  }),
  summary: v.object({
    totalSubjects: v.number(),
    recordedSubjects: v.number(),
    pendingSubjects: v.number(),
    averageScore: v.union(v.number(), v.null()),
    totalScore: v.number(),
  }),
  results: v.array(
    v.object({
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      subjectCode: v.string(),
      ca1: v.union(v.number(), v.null()),
      ca2: v.union(v.number(), v.null()),
      ca3: v.union(v.number(), v.null()),
      examScore: v.union(v.number(), v.null()),
      total: v.number(),
      gradeLetter: v.string(),
      remark: v.string(),
      isRecorded: v.boolean(),
      calculationMode: v.union(
        v.literal("standalone"),
        v.literal("cumulative_annual"),
      ),
      currentTermTotal: v.union(v.number(), v.null()),
      firstTermTotal: v.union(v.number(), v.null()),
      secondTermTotal: v.union(v.number(), v.null()),
      annualAverage: v.union(v.number(), v.null()),
      isCumulativeComplete: v.boolean(),
      missingHistoricalTerms: v.array(
        v.union(v.literal("first"), v.literal("second"), v.literal("current")),
      ),
      manualAdjustment: v.union(
        v.object({
          includedTerms: v.array(
            v.union(
              v.literal("first"),
              v.literal("second"),
              v.literal("current"),
            ),
          ),
          divisor: v.number(),
          computedAverage: v.union(v.number(), v.null()),
          finalTotalOverride: v.union(v.number(), v.null()),
        }),
        v.null(),
      ),
    }),
  ),
  extras: reportCardExtraPrintableValidator,
  classTeacherName: v.union(v.string(), v.null()),
  classTeacherComment: v.union(v.string(), v.null()),
  headTeacherComment: v.union(v.string(), v.null()),
});
