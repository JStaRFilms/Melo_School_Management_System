import { ConvexError, v, type Infer } from "convex/values";

export const usageMeterType = v.union(v.literal("ai_tokens"), v.literal("ocr_pages"), v.literal("storage_bytes"));
export const heavyUsageTask = v.union(v.literal("teacher_lesson_plan"), v.literal("provider_ocr"), v.literal("knowledge_upload"), v.literal("curriculum_generation"), v.literal("ai_import"));
export const usageEntitlement = v.object({
  allowances: v.array(v.object({ meterType: usageMeterType, baseUnits: v.number(), graceUnits: v.number() })),
  warningPercent: v.number(), criticalPercent: v.number(), hardStopPercent: v.number(),
  maxFileSizeBytes: v.number(), maxPagesPerOperation: v.number(),
  profiles: v.array(v.object({ task: heavyUsageTask, meterType: usageMeterType, unitsPerItem: v.number(), maxItems: v.number(), modelProfile: v.string() })),
});
export type UsageEntitlement = Infer<typeof usageEntitlement>;
export type HeavyUsageTask = Infer<typeof heavyUsageTask>;
export function safePositive(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new ConvexError(`${label} must be a positive safe integer`);
}
export function validateEntitlement(value: UsageEntitlement) {
  if (value.allowances.length < 1 || value.allowances.length > 3 || new Set(value.allowances.map(row => row.meterType)).size !== value.allowances.length) throw new ConvexError("Configure one unique row per included meter");
  for (const row of value.allowances) {
    safePositive(row.baseUnits, "Base allowance");
    if (!Number.isSafeInteger(row.graceUnits) || row.graceUnits < 0) throw new ConvexError("Grace must be a nonnegative safe integer");
  }
  if (!Number.isSafeInteger(value.warningPercent) || !Number.isSafeInteger(value.criticalPercent) || !Number.isSafeInteger(value.hardStopPercent) || value.warningPercent < 1 || value.warningPercent >= value.criticalPercent || value.criticalPercent >= value.hardStopPercent || value.hardStopPercent > 100) throw new ConvexError("Thresholds must be increasing integer percentages ending at or below 100");
  safePositive(value.maxFileSizeBytes, "File cap"); safePositive(value.maxPagesPerOperation, "Page cap");
  if (value.profiles.length < 1 || value.profiles.length > 20 || new Set(value.profiles.map(row => row.task)).size !== value.profiles.length) throw new ConvexError("Configure unique task profiles");
  for (const profile of value.profiles) {
    safePositive(profile.unitsPerItem, "Task units"); safePositive(profile.maxItems, "Task item cap");
    if (!profile.modelProfile.trim() || profile.modelProfile.length > 100) throw new ConvexError("A bounded model task profile is required");
    if (!value.allowances.some(row => row.meterType === profile.meterType)) throw new ConvexError("Task profile meter has no allowance");
  }
}
