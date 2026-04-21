import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import {
  buildInstructionTemplateSearchText,
  getInstructionTemplateApplicabilityLabel,
  getInstructionTemplateScopeRank,
  instructionTemplateDraftValidator,
  instructionTemplateListResponseValidator,
  instructionTemplateOutputTypeValidator,
  normalizeInstructionTemplateApplicability,
  normalizeInstructionTemplateObjectiveMinimums,
  normalizeInstructionTemplateSections,
  normalizeOptionalInstructionTemplateText,
  normalizeRequiredInstructionTemplateText,
  sortInstructionTemplates,
  toTemplateSearchKey,
  type InstructionTemplateObjectiveMinimums,
  type InstructionTemplateScope,
  type InstructionTemplateSectionInput,
  type NormalizedInstructionTemplatePayload,
  type SupportedInstructionTemplateOutputType,
} from "./lessonKnowledgeTemplatesHelpers";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";

const supportedOutputTypeSet = new Set<SupportedInstructionTemplateOutputType>([
  "lesson_plan",
  "student_note",
  "assignment",
]);

type InstructionTemplateDoc = Doc<"instructionTemplates">;
type SubjectDoc = Doc<"subjects">;

type InstructionTemplateResolutionContext = {
  subjectId: Id<"subjects"> | null;
  level: string | null;
};

function assertSupportedOutputType(outputType: string): asserts outputType is SupportedInstructionTemplateOutputType {
  if (!supportedOutputTypeSet.has(outputType as SupportedInstructionTemplateOutputType)) {
    throw new ConvexError("Unsupported instruction template output type");
  }
}

function normalizeApplicabilityForRecord(args: {
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
  isSchoolDefault: boolean;
}) {
  return normalizeInstructionTemplateApplicability(args);
}

function normalizeObjectiveMinimums(
  objectiveMinimums: InstructionTemplateObjectiveMinimums,
  requiredSectionCount: number
) {
  return normalizeInstructionTemplateObjectiveMinimums({ objectiveMinimums, requiredSectionCount });
}

function normalizeSections(args: {
  outputType: SupportedInstructionTemplateOutputType;
  sections: InstructionTemplateSectionInput[];
}) {
  return normalizeInstructionTemplateSections(args);
}


async function fetchSubjectsById(ctx: QueryCtx, subjectIds: Array<Id<"subjects">>) {
  if (subjectIds.length === 0) {
    return new Map<string, SubjectDoc>();
  }

  const rows = await Promise.all(subjectIds.map((subjectId) => ctx.db.get(subjectId)));
  const subjectMap = new Map<string, SubjectDoc>();

  rows.forEach((row) => {
    if (row) {
      subjectMap.set(String(row._id), row);
    }
  });

  return subjectMap;
}

function mapTemplateRecord(args: {
  template: InstructionTemplateDoc;
  subject: SubjectDoc | null;
}) {
  const sectionDefinitions = args.template.sectionDefinitions.slice().sort((a, b) => a.order - b.order);
  const requiredSectionCount = sectionDefinitions.filter((section) => section.required).length;
  const templateScope = args.template.templateScope as InstructionTemplateScope;
  const subjectName = args.subject?.name ?? null;
  const subjectCode = args.subject?.code ?? null;
  const applicabilityLabel = getInstructionTemplateApplicabilityLabel({
    templateScope,
    subjectName,
    subjectCode,
    level: args.template.level ?? null,
  });

  return {
    _id: args.template._id,
    templateKey: args.template.templateKey,
    outputType: args.template.outputType as SupportedInstructionTemplateOutputType,
    title: args.template.title,
    description: args.template.description ?? null,
    templateScope,
    subjectId: args.template.subjectId ?? null,
    subjectName,
    subjectCode,
    level: args.template.level ?? null,
    isSchoolDefault: args.template.isSchoolDefault,
    requiredSectionIds: args.template.requiredSectionIds,
    sectionDefinitions: sectionDefinitions.map((section) => ({
      id: section.id,
      label: section.label,
      order: section.order,
      required: section.required,
      minimumWordCount: section.minimumWordCount ?? null,
    })),
    objectiveMinimums: args.template.objectiveMinimums,
    searchText: args.template.searchText,
    isActive: args.template.isActive,
    createdAt: args.template.createdAt,
    updatedAt: args.template.updatedAt,
    createdBy: args.template.createdBy,
    updatedBy: args.template.updatedBy,
    sectionCount: sectionDefinitions.length,
    requiredSectionCount,
    applicabilityLabel,
    templateKeyLabel: args.template.templateKey,
    resolutionRank: getInstructionTemplateScopeRank(templateScope),
  };
}

async function loadInstructionTemplateRows(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  outputType: SupportedInstructionTemplateOutputType,
  searchQuery?: string | null
) {
  const normalizedSearch = normalizeOptionalInstructionTemplateText(searchQuery);

  if (normalizedSearch) {
    return await ctx.db
      .query("instructionTemplates")
      .withSearchIndex("search_search_text", (q) =>
        q.search("searchText", normalizedSearch).eq("schoolId", schoolId).eq("outputType", outputType)
      )
      .take(100);
  }

  return await ctx.db
    .query("instructionTemplates")
    .withIndex("by_school_and_output_type", (q) => q.eq("schoolId", schoolId).eq("outputType", outputType))
    .take(100);
}

function buildTemplateConflictMessage(args: {
  templateId?: Id<"instructionTemplates"> | null;
  templateScope: InstructionTemplateScope;
  outputType: SupportedInstructionTemplateOutputType;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
  isActive: boolean;
}) {
  return {
    templateId: args.templateId ?? null,
    templateScope: args.templateScope,
    outputType: args.outputType,
    subjectId: args.subjectId ?? null,
    level: args.level ?? null,
    isActive: args.isActive,
  };
}

async function ensureUniqueApplicability(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  templateId?: Id<"instructionTemplates"> | null;
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
  isActive: boolean;
}) {
  if (!args.isActive) {
    return;
  }

  const existingRows = await args.ctx.db
    .query("instructionTemplates")
    .withIndex("by_school_and_output_type", (q) =>
      q.eq("schoolId", args.schoolId).eq("outputType", args.outputType)
    )
    .take(100);

  const normalizedLevel = normalizeOptionalInstructionTemplateText(args.level) ?? null;
  const currentKey = buildTemplateConflictMessage({
    templateId: args.templateId,
    templateScope: args.templateScope,
    outputType: args.outputType,
    subjectId: args.subjectId ?? null,
    level: normalizedLevel,
    isActive: args.isActive,
  });

  for (const row of existingRows) {
    if (args.templateId && String(row._id) === String(args.templateId)) {
      continue;
    }

    if (!row.isActive) {
      continue;
    }

    const rowKey = buildTemplateConflictMessage({
      templateId: row._id,
      templateScope: row.templateScope as InstructionTemplateScope,
      outputType: row.outputType as SupportedInstructionTemplateOutputType,
      subjectId: row.subjectId ?? null,
      level: row.level ?? null,
      isActive: row.isActive,
    });

    const sameScope = rowKey.templateScope === currentKey.templateScope;
    const sameSubject = String(rowKey.subjectId ?? "") === String(currentKey.subjectId ?? "");
    const sameLevel = toTemplateSearchKey(rowKey.level ?? "") === toTemplateSearchKey(currentKey.level ?? "");

    if (!sameScope) {
      continue;
    }

    switch (args.templateScope) {
      case "subject_and_level":
        if (sameSubject && sameLevel) {
          throw new ConvexError("An active template already exists for this subject and level");
        }
        break;
      case "subject_only":
        if (sameSubject) {
          throw new ConvexError("An active subject-only template already exists for this subject");
        }
        break;
      case "level_only":
        if (sameLevel) {
          throw new ConvexError("An active level-only template already exists for this level");
        }
        break;
      case "school_default":
        throw new ConvexError("An active school default template already exists for this output type");
    }
  }
}

function buildInstructionTemplateRecord(args: {
  schoolId: Id<"schools">;
  userId: Id<"users">;
  existing: InstructionTemplateDoc | null;
  payload: NormalizedInstructionTemplatePayload;
  subject: SubjectDoc | null;
}) {
  const now = Date.now();
  const searchText = buildInstructionTemplateSearchText({
    title: args.payload.title,
    description: args.payload.description,
    outputType: args.payload.outputType,
    templateScope: args.payload.templateScope,
    subjectName: args.subject?.name ?? null,
    subjectCode: args.subject?.code ?? null,
    level: args.payload.level ?? null,
    objectiveMinimums: args.payload.objectiveMinimums,
    sectionDefinitions: args.payload.sectionDefinitions.map((section) => ({
      label: section.label,
      required: section.required,
      minimumWordCount: section.minimumWordCount ?? null,
    })),
  });

  const nextRecord = {
    schoolId: args.schoolId,
    templateKey: args.payload.templateKey,
    outputType: args.payload.outputType,
    title: args.payload.title,
    ...(args.payload.description ? { description: args.payload.description } : {}),
    templateScope: args.payload.templateScope,
    ...(args.payload.subjectId ? { subjectId: args.payload.subjectId } : {}),
    ...(args.payload.level ? { level: args.payload.level } : {}),
    isSchoolDefault: args.payload.isSchoolDefault,
    requiredSectionIds: args.payload.requiredSectionIds,
    sectionDefinitions: args.payload.sectionDefinitions.map((section) => ({
      id: section.id,
      label: section.label,
      order: section.order,
      required: section.required,
      ...(section.minimumWordCount !== undefined ? { minimumWordCount: section.minimumWordCount } : {}),
    })),
    objectiveMinimums: args.payload.objectiveMinimums,
    searchText,
    isActive: args.payload.isActive,
    createdAt: args.existing?.createdAt ?? now,
    updatedAt: now,
    createdBy: args.existing?.createdBy ?? args.userId,
    updatedBy: args.userId,
  };

  return nextRecord;
}

async function writeTemplateAuditEvent(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  userId: Id<"users">;
  templateId: Id<"instructionTemplates">;
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  title: string;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
  isActive: boolean;
  isCreate: boolean;
}) {
  await args.ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
    schoolId: args.schoolId,
    actorUserId: args.userId,
    actorRole: "admin",
    eventType: args.isCreate ? "created" : "overridden",
    entityType: "instructionTemplate",
    templateId: args.templateId,
    changeSummary: `${args.isCreate ? "Created" : "Updated"} ${args.outputType} template \"${args.title}\" for ${args.templateScope}${args.subjectId ? ` (${String(args.subjectId)})` : ""}${args.level ? ` / ${args.level}` : ""}${args.isActive ? " [active]" : " [inactive]"}`,
  });
}

export const listInstructionTemplates = query({
  args: {
    outputType: instructionTemplateOutputTypeValidator,
    searchQuery: v.optional(v.string()),
  },
  returns: instructionTemplateListResponseValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const templates = await loadInstructionTemplateRows(ctx, schoolId, args.outputType, args.searchQuery ?? null);
    const subjectIds = [
      ...new Set(
        templates
          .map((template) => template.subjectId)
          .filter((subjectId): subjectId is Id<"subjects"> => Boolean(subjectId))
          .map((subjectId) => subjectId)
      ),
    ];
    const subjectMap = await fetchSubjectsById(ctx, subjectIds);

    const mappedTemplates = templates
      .slice()
      .sort(sortInstructionTemplates)
      .filter((template): template is InstructionTemplateDoc & { outputType: SupportedInstructionTemplateOutputType } =>
        supportedOutputTypeSet.has(template.outputType as SupportedInstructionTemplateOutputType)
      )
      .map((template) =>
        mapTemplateRecord({
          template,
          subject: template.subjectId ? subjectMap.get(String(template.subjectId)) ?? null : null,
        })
      );

    return {
      summary: {
        total: mappedTemplates.length,
        active: mappedTemplates.filter((template) => template.isActive).length,
        defaultCount: mappedTemplates.filter((template) => template.isActive && template.isSchoolDefault).length,
        inactive: mappedTemplates.filter((template) => !template.isActive).length,
      },
      templates: mappedTemplates,
    };
  },
});

export const saveInstructionTemplate = mutation({
  args: instructionTemplateDraftValidator,
  returns: v.id("instructionTemplates"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    assertSupportedOutputType(args.outputType);

    const title = normalizeRequiredInstructionTemplateText(args.title, "Template title");
    const description = normalizeOptionalInstructionTemplateText(args.description ?? null);
    const existing = args.templateId ? await ctx.db.get(args.templateId) : null;

    if (args.templateId && (!existing || existing.schoolId !== schoolId)) {
      throw new ConvexError("Instruction template not found");
    }

    const subject = args.subjectId ? await ctx.db.get(args.subjectId) : null;
    if (args.subjectId && (!subject || subject.schoolId !== schoolId || subject.isArchived)) {
      throw new ConvexError("Subject not found");
    }

    const applicability = normalizeApplicabilityForRecord({
      outputType: args.outputType,
      templateScope: args.templateScope,
      subjectId: args.subjectId ?? null,
      level: args.level ?? null,
      isSchoolDefault: args.isSchoolDefault,
    });

    const normalizedSections = normalizeSections({
      outputType: args.outputType,
      sections: args.sectionDefinitions,
    });
    const objectiveMinimums = normalizeObjectiveMinimums(args.objectiveMinimums, normalizedSections.requiredSectionIds.length);

    await ensureUniqueApplicability({
      ctx,
      schoolId,
      templateId: existing?._id ?? null,
      outputType: args.outputType,
      templateScope: args.templateScope,
      subjectId: applicability.subjectId,
      level: applicability.level,
      isActive: args.isActive,
    });

    const payload: NormalizedInstructionTemplatePayload = {
      title,
      description,
      outputType: args.outputType,
      templateScope: applicability.templateScope,
      subjectId: applicability.subjectId ?? undefined,
      level: applicability.level ?? undefined,
      isSchoolDefault: applicability.isSchoolDefault,
      isActive: args.isActive,
      sectionDefinitions: normalizedSections.sectionDefinitions.map((section) => ({
        id: section.id,
        label: section.label,
        order: section.order,
        required: section.required,
        ...(section.minimumWordCount !== undefined ? { minimumWordCount: section.minimumWordCount } : {}),
      })),
      requiredSectionIds: normalizedSections.requiredSectionIds,
      objectiveMinimums,
      searchText: buildInstructionTemplateSearchText({
        title,
        description: description ?? undefined,
        outputType: args.outputType,
        templateScope: applicability.templateScope,
        subjectName: subject?.name ?? null,
        subjectCode: subject?.code ?? null,
        level: applicability.level,
        objectiveMinimums,
        sectionDefinitions: normalizedSections.sectionDefinitions.map((section) => ({
          label: section.label,
          required: section.required,
          minimumWordCount: section.minimumWordCount ?? null,
        })),
      }),
      templateKey: applicability.templateKey,
      applicabilityLabel: applicability.applicabilityLabel,
      templateKeyLabel: applicability.templateKeyLabel,
    };

    const replacement = buildInstructionTemplateRecord({
      schoolId,
      userId,
      existing,
      payload,
      subject,
    });

    let templateId: Id<"instructionTemplates">;
    if (existing) {
      await ctx.db.replace(existing._id, replacement);
      templateId = existing._id;
    } else {
      templateId = await ctx.db.insert("instructionTemplates", replacement);
    }

    await writeTemplateAuditEvent({
      ctx,
      schoolId,
      userId,
      templateId,
      outputType: args.outputType,
      templateScope: applicability.templateScope,
      title,
      subjectId: applicability.subjectId,
      level: applicability.level,
      isActive: args.isActive,
      isCreate: !existing,
    });

    return templateId;
  },
});
