import { ConvexError, v, type Infer } from "convex/values";

export const groupDefaultDomainValidator = v.union(
  v.literal("role_templates"),
  v.literal("report_card_template"),
  v.literal("notification_preferences"),
  v.literal("academic_policy"),
  v.literal("calendar_template"),
);

export const roleTemplateDefaultValidator = v.object({
  templateIds: v.array(v.id("roleTemplates")),
});

export const reportCardTemplateValidator = v.object({
  resultCalculationMode: v.union(
    v.literal("standalone"),
    v.literal("cumulative_annual"),
  ),
  defaultTimesSchoolOpened: v.union(v.number(), v.null()),
});

export const notificationPreferencesValidator = v.object({
  showReportUpdates: v.boolean(),
  showTeacherComments: v.boolean(),
  showUpcomingEvents: v.boolean(),
});

export const academicPolicyValidator = v.object({
  examInputMode: v.union(
    v.literal("raw40"),
    v.literal("raw60_scaled_to_40"),
  ),
});

export const calendarTermTemplateValidator = v.object({
  name: v.string(),
  startOffsetDays: v.number(),
  endOffsetDays: v.number(),
  resultCalculationMode: v.union(
    v.literal("standalone"),
    v.literal("cumulative_annual"),
  ),
});

export const calendarTemplateValidator = v.object({
  terms: v.array(calendarTermTemplateValidator),
});

export const groupDefaultSettingValidator = v.union(
  v.object({
    domain: v.literal("role_templates"),
    value: roleTemplateDefaultValidator,
  }),
  v.object({
    domain: v.literal("report_card_template"),
    value: reportCardTemplateValidator,
  }),
  v.object({
    domain: v.literal("notification_preferences"),
    value: notificationPreferencesValidator,
  }),
  v.object({
    domain: v.literal("academic_policy"),
    value: academicPolicyValidator,
  }),
  v.object({
    domain: v.literal("calendar_template"),
    value: calendarTemplateValidator,
  }),
);

export const groupDefaultVersionValidator = v.union(
  v.object({
    groupId: v.id("schoolGroups"),
    domain: v.literal("role_templates"),
    version: v.number(),
    allowBranchOverride: v.boolean(),
    value: roleTemplateDefaultValidator,
    createdAt: v.number(),
    createdBy: v.id("persons"),
  }),
  v.object({
    groupId: v.id("schoolGroups"),
    domain: v.literal("report_card_template"),
    version: v.number(),
    allowBranchOverride: v.boolean(),
    value: reportCardTemplateValidator,
    createdAt: v.number(),
    createdBy: v.id("persons"),
  }),
  v.object({
    groupId: v.id("schoolGroups"),
    domain: v.literal("notification_preferences"),
    version: v.number(),
    allowBranchOverride: v.boolean(),
    value: notificationPreferencesValidator,
    createdAt: v.number(),
    createdBy: v.id("persons"),
  }),
  v.object({
    groupId: v.id("schoolGroups"),
    domain: v.literal("academic_policy"),
    version: v.number(),
    allowBranchOverride: v.boolean(),
    value: academicPolicyValidator,
    createdAt: v.number(),
    createdBy: v.id("persons"),
  }),
  v.object({
    groupId: v.id("schoolGroups"),
    domain: v.literal("calendar_template"),
    version: v.number(),
    allowBranchOverride: v.boolean(),
    value: calendarTemplateValidator,
    createdAt: v.number(),
    createdBy: v.id("persons"),
  }),
);

const branchChoiceBase = {
  groupId: v.id("schoolGroups"),
  schoolId: v.id("schools"),
  revision: v.number(),
  groupVersion: v.number(),
  createdAt: v.number(),
  createdBy: v.id("persons"),
};

export const branchSettingChoiceValidator = v.union(
  v.object({ ...branchChoiceBase, domain: v.literal("role_templates"), mode: v.literal("inherit") }),
  v.object({ ...branchChoiceBase, domain: v.literal("role_templates"), mode: v.literal("override"), value: roleTemplateDefaultValidator }),
  v.object({ ...branchChoiceBase, domain: v.literal("report_card_template"), mode: v.literal("inherit") }),
  v.object({ ...branchChoiceBase, domain: v.literal("report_card_template"), mode: v.literal("override"), value: reportCardTemplateValidator }),
  v.object({ ...branchChoiceBase, domain: v.literal("notification_preferences"), mode: v.literal("inherit") }),
  v.object({ ...branchChoiceBase, domain: v.literal("notification_preferences"), mode: v.literal("override"), value: notificationPreferencesValidator }),
  v.object({ ...branchChoiceBase, domain: v.literal("academic_policy"), mode: v.literal("inherit") }),
  v.object({ ...branchChoiceBase, domain: v.literal("academic_policy"), mode: v.literal("override"), value: academicPolicyValidator }),
  v.object({ ...branchChoiceBase, domain: v.literal("calendar_template"), mode: v.literal("inherit") }),
  v.object({ ...branchChoiceBase, domain: v.literal("calendar_template"), mode: v.literal("override"), value: calendarTemplateValidator }),
);

export const branchSettingChangeValidator = v.union(
  v.object({ domain: v.literal("role_templates"), mode: v.literal("inherit") }),
  v.object({ domain: v.literal("role_templates"), mode: v.literal("override"), value: roleTemplateDefaultValidator }),
  v.object({ domain: v.literal("report_card_template"), mode: v.literal("inherit") }),
  v.object({ domain: v.literal("report_card_template"), mode: v.literal("override"), value: reportCardTemplateValidator }),
  v.object({ domain: v.literal("notification_preferences"), mode: v.literal("inherit") }),
  v.object({ domain: v.literal("notification_preferences"), mode: v.literal("override"), value: notificationPreferencesValidator }),
  v.object({ domain: v.literal("academic_policy"), mode: v.literal("inherit") }),
  v.object({ domain: v.literal("academic_policy"), mode: v.literal("override"), value: academicPolicyValidator }),
  v.object({ domain: v.literal("calendar_template"), mode: v.literal("inherit") }),
  v.object({ domain: v.literal("calendar_template"), mode: v.literal("override"), value: calendarTemplateValidator }),
);

export type GroupDefaultDomain = Infer<typeof groupDefaultDomainValidator>;
export type GroupDefaultSetting = Infer<typeof groupDefaultSettingValidator>;
export type GroupDefaultVersion = Infer<typeof groupDefaultVersionValidator>;
export type BranchSettingChoice = Infer<typeof branchSettingChoiceValidator>;
export type BranchSettingChange = Infer<typeof branchSettingChangeValidator>;
export type RoleTemplateDefault = Infer<typeof roleTemplateDefaultValidator>;
export type ReportCardTemplate = Infer<typeof reportCardTemplateValidator>;
export type NotificationPreferences = Infer<typeof notificationPreferencesValidator>;
export type AcademicPolicy = Infer<typeof academicPolicyValidator>;
export type CalendarTemplate = Infer<typeof calendarTemplateValidator>;

export const FACTORY_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  showReportUpdates: true,
  showTeacherComments: true,
  showUpcomingEvents: true,
};

export function validateGroupDefaultValue<S extends GroupDefaultSetting>(
  setting: S,
): S["value"] {
  switch (setting.domain) {
    case "role_templates": {
      if (setting.value.templateIds.length > 30)
        throw new ConvexError("Use at most 30 role templates");
      return {
        templateIds: [...new Set(setting.value.templateIds)],
      } as S["value"];
    }
    case "report_card_template": {
      const opened = setting.value.defaultTimesSchoolOpened;
      if (opened !== null && (!Number.isInteger(opened) || opened < 0 || opened > 366))
        throw new ConvexError("Times opened must be a whole number from 0 to 366");
      return setting.value as S["value"];
    }
    case "calendar_template": {
      if (setting.value.terms.length < 1 || setting.value.terms.length > 6)
        throw new ConvexError("Use 1–6 calendar terms");
      const terms = setting.value.terms.map((term) => ({
        ...term,
        name: term.name.trim(),
      }));
      for (const [index, term] of terms.entries()) {
        if (!term.name || term.name.length > 80)
          throw new ConvexError("Calendar term names require 1–80 characters");
        if (
          !Number.isInteger(term.startOffsetDays) ||
          !Number.isInteger(term.endOffsetDays) ||
          term.startOffsetDays < 0 ||
          term.endOffsetDays < term.startOffsetDays ||
          term.endOffsetDays > 730
        ) throw new ConvexError("Calendar offsets must be ordered whole days from 0 to 730");
        if (index > 0 && term.startOffsetDays <= terms[index - 1].endOffsetDays)
          throw new ConvexError("Calendar template terms cannot overlap");
      }
      return { terms } as S["value"];
    }
    default:
      return setting.value as S["value"];
  }
}
