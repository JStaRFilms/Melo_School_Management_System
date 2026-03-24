import { z } from "zod";

// Exam Input Mode
export const examInputModeSchema = z.union([
  z.literal("raw40"),
  z.literal("raw60_scaled_to_40"),
]);

// School Assessment Settings
export const saveSchoolAssessmentSettingsSchema = z.object({
  examInputMode: examInputModeSchema,
});

// Grading Band Input
export const gradingBandInputSchema = z.object({
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  gradeLetter: z.string().min(1),
  remark: z.string().min(1),
});

export const saveGradingBandsSchema = z.object({
  bands: z.array(gradingBandInputSchema).min(1),
});

// Assessment Record Input
export const assessmentRecordInputSchema = z.object({
  studentId: z.string(),
  ca1: z.number().min(0).max(20),
  ca2: z.number().min(0).max(20),
  ca3: z.number().min(0).max(20),
  examRawScore: z.number().min(0),
});

export const upsertAssessmentRecordsBulkSchema = z.object({
  sessionId: z.string(),
  termId: z.string(),
  classId: z.string(),
  subjectId: z.string(),
  records: z.array(assessmentRecordInputSchema),
});

// Get Exam Entry Sheet
export const getExamEntrySheetSchema = z.object({
  sessionId: z.string(),
  termId: z.string(),
  classId: z.string(),
  subjectId: z.string(),
});

// Get School Assessment Settings
export const getSchoolAssessmentSettingsSchema = z.object({
  schoolId: z.string(),
});

// Get Active Grading Bands
export const getActiveGradingBandsSchema = z.object({
  schoolId: z.string(),
});

// Type exports
export type ExamInputMode = z.infer<typeof examInputModeSchema>;
export type SaveSchoolAssessmentSettingsInput = z.infer<typeof saveSchoolAssessmentSettingsSchema>;
export type GradingBandInput = z.infer<typeof gradingBandInputSchema>;
export type SaveGradingBandsInput = z.infer<typeof saveGradingBandsSchema>;
export type AssessmentRecordInput = z.infer<typeof assessmentRecordInputSchema>;
export type UpsertAssessmentRecordsBulkInput = z.infer<typeof upsertAssessmentRecordsBulkSchema>;
export type GetExamEntrySheetInput = z.infer<typeof getExamEntrySheetSchema>;
export type GetSchoolAssessmentSettingsInput = z.infer<typeof getSchoolAssessmentSettingsSchema>;
export type GetActiveGradingBandsInput = z.infer<typeof getActiveGradingBandsSchema>;
