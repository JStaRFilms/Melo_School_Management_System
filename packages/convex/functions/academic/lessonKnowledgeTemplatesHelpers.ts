import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";

export const instructionTemplateOutputTypeValidator = v.union(
  v.literal("lesson_plan"),
  v.literal("student_note"),
  v.literal("assignment")
);

export const instructionTemplateScopeValidator = v.union(
  v.literal("subject_and_level"),
  v.literal("subject_only"),
  v.literal("level_only"),
  v.literal("school_default")
);

export const instructionTemplateSectionInputValidator = v.object({
  id: v.optional(v.union(v.string(), v.null())),
  label: v.string(),
  required: v.boolean(),
  minimumWordCount: v.optional(v.union(v.number(), v.null())),
});

export const instructionTemplateObjectiveMinimumsInputValidator = v.object({
  minimumObjectives: v.number(),
  minimumSourceMaterials: v.number(),
  minimumSections: v.number(),
});

export const instructionTemplateDraftValidator = v.object({
  templateId: v.optional(v.union(v.id("instructionTemplates"), v.null())),
  outputType: instructionTemplateOutputTypeValidator,
  title: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  templateScope: instructionTemplateScopeValidator,
  subjectId: v.optional(v.union(v.id("subjects"), v.null())),
  level: v.optional(v.union(v.string(), v.null())),
  isSchoolDefault: v.boolean(),
  isActive: v.boolean(),
  sectionDefinitions: v.array(instructionTemplateSectionInputValidator),
  objectiveMinimums: instructionTemplateObjectiveMinimumsInputValidator,
});

export const instructionTemplateListItemValidator = v.object({
  _id: v.id("instructionTemplates"),
  templateKey: v.string(),
  outputType: instructionTemplateOutputTypeValidator,
  title: v.string(),
  description: v.union(v.string(), v.null()),
  templateScope: instructionTemplateScopeValidator,
  subjectId: v.union(v.id("subjects"), v.null()),
  subjectName: v.union(v.string(), v.null()),
  subjectCode: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  isSchoolDefault: v.boolean(),
  requiredSectionIds: v.array(v.string()),
  sectionDefinitions: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      order: v.number(),
      required: v.boolean(),
      minimumWordCount: v.union(v.number(), v.null()),
    })
  ),
  objectiveMinimums: instructionTemplateObjectiveMinimumsInputValidator,
  searchText: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
  sectionCount: v.number(),
  requiredSectionCount: v.number(),
  applicabilityLabel: v.string(),
  templateKeyLabel: v.string(),
  resolutionRank: v.number(),
});

export const instructionTemplateListResponseValidator = v.object({
  summary: v.object({
    total: v.number(),
    active: v.number(),
    defaultCount: v.number(),
    inactive: v.number(),
  }),
  templates: v.array(instructionTemplateListItemValidator),
});

export type SupportedInstructionTemplateOutputType =
  | "lesson_plan"
  | "student_note"
  | "assignment";

export type InstructionTemplateScope =
  | "subject_and_level"
  | "subject_only"
  | "level_only"
  | "school_default";

export type InstructionTemplateSectionInput = {
  id?: string | null;
  label: string;
  required: boolean;
  minimumWordCount?: number | null;
};

export type InstructionTemplateObjectiveMinimums = {
  minimumObjectives: number;
  minimumSourceMaterials: number;
  minimumSections: number;
};

export type NormalizedInstructionTemplateSection = {
  id: string;
  label: string;
  order: number;
  required: boolean;
  minimumWordCount?: number;
};

export type NormalizedInstructionTemplateApplicability = {
  templateScope: InstructionTemplateScope;
  subjectId: Id<"subjects"> | null;
  level: string | null;
  isSchoolDefault: boolean;
  templateKey: string;
  applicabilityLabel: string;
  templateKeyLabel: string;
};

export type NormalizedInstructionTemplatePayload = {
  title: string;
  description: string | undefined;
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectId: Id<"subjects"> | undefined;
  level: string | undefined;
  isSchoolDefault: boolean;
  isActive: boolean;
  sectionDefinitions: NormalizedInstructionTemplateSection[];
  requiredSectionIds: string[];
  objectiveMinimums: InstructionTemplateObjectiveMinimums;
  searchText: string;
  templateKey: string;
  applicabilityLabel: string;
  templateKeyLabel: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOptionalInstructionTemplateText(value?: string | null) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized ? normalized : undefined;
}

export function normalizeRequiredInstructionTemplateText(value: string, label: string) {
  const normalized = normalizeOptionalInstructionTemplateText(value);
  if (!normalized) {
    throw new ConvexError(`${label} is required`);
  }

  return normalized;
}

function normalizeWholeNumber(value: number, label: string, minimum: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum) {
    throw new ConvexError(`${label} must be a whole number of ${minimum} or more`);
  }

  return value;
}

function slugify(value: string) {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

function buildScopedKey(args: {
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
}) {
  const subjectKey = args.subjectId ? String(args.subjectId) : "school";
  const levelKey = args.level ? normalizeText(args.level).toLowerCase() : "all";

  switch (args.templateScope) {
    case "subject_and_level":
      return `${args.outputType}:subject_and_level:${subjectKey}:${levelKey}`;
    case "subject_only":
      return `${args.outputType}:subject_only:${subjectKey}`;
    case "level_only":
      return `${args.outputType}:level_only:${levelKey}`;
    case "school_default":
      return `${args.outputType}:school_default`;
  }
}

export function normalizeInstructionTemplateApplicability(args: {
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectId?: Id<"subjects"> | null;
  level?: string | null;
  isSchoolDefault: boolean;
}): NormalizedInstructionTemplateApplicability {
  const level = normalizeOptionalInstructionTemplateText(args.level) ?? null;
  const subjectId = args.subjectId ?? null;

  switch (args.templateScope) {
    case "subject_and_level": {
      if (!subjectId) {
        throw new ConvexError("Select a subject for subject + level templates");
      }
      if (!level) {
        throw new ConvexError("Select a level for subject + level templates");
      }
      if (args.isSchoolDefault) {
        throw new ConvexError("School default must be disabled for subject + level templates");
      }

      return {
        templateScope: args.templateScope,
        subjectId,
        level,
        isSchoolDefault: false,
        templateKey: buildScopedKey({
          outputType: args.outputType,
          templateScope: args.templateScope,
          subjectId,
          level,
        }),
        applicabilityLabel: `${subjectId} + ${level}`,
        templateKeyLabel: `${args.outputType}:subject_and_level:${subjectId}:${level.toLowerCase()}`,
      };
    }
    case "subject_only": {
      if (!subjectId) {
        throw new ConvexError("Select a subject for subject-only templates");
      }
      if (level) {
        throw new ConvexError("Subject-only templates must not set a level");
      }
      if (args.isSchoolDefault) {
        throw new ConvexError("School default must be disabled for subject-only templates");
      }

      return {
        templateScope: args.templateScope,
        subjectId,
        level: null,
        isSchoolDefault: false,
        templateKey: buildScopedKey({
          outputType: args.outputType,
          templateScope: args.templateScope,
          subjectId,
          level: null,
        }),
        applicabilityLabel: `${subjectId}`,
        templateKeyLabel: `${args.outputType}:subject_only:${subjectId}`,
      };
    }
    case "level_only": {
      if (subjectId) {
        throw new ConvexError("Level-only templates must not set a subject");
      }
      if (!level) {
        throw new ConvexError("Select a level for level-only templates");
      }
      if (args.isSchoolDefault) {
        throw new ConvexError("School default must be disabled for level-only templates");
      }

      return {
        templateScope: args.templateScope,
        subjectId: null,
        level,
        isSchoolDefault: false,
        templateKey: buildScopedKey({
          outputType: args.outputType,
          templateScope: args.templateScope,
          subjectId: null,
          level,
        }),
        applicabilityLabel: level,
        templateKeyLabel: `${args.outputType}:level_only:${level.toLowerCase()}`,
      };
    }
    case "school_default": {
      if (subjectId) {
        throw new ConvexError("School default templates must not set a subject");
      }
      if (level) {
        throw new ConvexError("School default templates must not set a level");
      }
      if (!args.isSchoolDefault) {
        throw new ConvexError("School default templates must enable the school default flag");
      }

      return {
        templateScope: args.templateScope,
        subjectId: null,
        level: null,
        isSchoolDefault: true,
        templateKey: buildScopedKey({
          outputType: args.outputType,
          templateScope: args.templateScope,
          subjectId: null,
          level: null,
        }),
        applicabilityLabel: "School default",
        templateKeyLabel: `${args.outputType}:school_default`,
      };
    }
  }
}

export function normalizeInstructionTemplateSections(args: {
  outputType: SupportedInstructionTemplateOutputType;
  sections: InstructionTemplateSectionInput[];
}) {
  if (args.sections.length === 0) {
    throw new ConvexError("Add at least one section");
  }

  const seenLabels = new Set<string>();
  const seenIds = new Set<string>();
  const sectionDefinitions: NormalizedInstructionTemplateSection[] = [];
  const requiredSectionIds: string[] = [];

  args.sections.forEach((section, index) => {
    const label = normalizeRequiredInstructionTemplateText(section.label, `Section ${index + 1} label`);
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      throw new ConvexError("Section labels must be unique");
    }
    seenLabels.add(labelKey);

    const minimumWordCount = section.minimumWordCount ?? undefined;
    if (minimumWordCount !== undefined) {
      normalizeWholeNumber(minimumWordCount, `Minimum word count for \"${label}\"`, 1);
    }
    if (section.required && minimumWordCount === undefined) {
      throw new ConvexError(`Required section \"${label}\" needs a minimum word count rule`);
    }

    const generatedId = `${args.outputType}-${slugify(label)}-${index + 1}`;
    const id = normalizeOptionalInstructionTemplateText(section.id) ?? generatedId;
    const idKey = id.toLowerCase();
    if (seenIds.has(idKey)) {
      throw new ConvexError("Section IDs must be unique");
    }
    seenIds.add(idKey);

    sectionDefinitions.push({
      id,
      label,
      order: index,
      required: section.required,
      ...(minimumWordCount !== undefined ? { minimumWordCount } : {}),
    });

    if (section.required) {
      requiredSectionIds.push(id);
    }
  });

  if (requiredSectionIds.length === 0) {
    throw new ConvexError("Add at least one required section");
  }

  return { sectionDefinitions, requiredSectionIds };
}

export function normalizeInstructionTemplateObjectiveMinimums(args: {
  objectiveMinimums: InstructionTemplateObjectiveMinimums;
  requiredSectionCount: number;
}) {
  const minimumObjectives = normalizeWholeNumber(args.objectiveMinimums.minimumObjectives, "Minimum objectives", 1);
  const minimumSourceMaterials = normalizeWholeNumber(
    args.objectiveMinimums.minimumSourceMaterials,
    "Minimum source materials",
    0
  );
  const minimumSections = normalizeWholeNumber(
    args.objectiveMinimums.minimumSections,
    "Minimum sections",
    args.requiredSectionCount
  );

  if (minimumSections < args.requiredSectionCount) {
    throw new ConvexError("Minimum sections must cover every required section");
  }

  return {
    minimumObjectives,
    minimumSourceMaterials,
    minimumSections,
  };
}

export function buildInstructionTemplateSearchText(args: {
  title: string;
  description?: string;
  outputType: SupportedInstructionTemplateOutputType;
  templateScope: InstructionTemplateScope;
  subjectName?: string | null;
  subjectCode?: string | null;
  level?: string | null;
  objectiveMinimums: InstructionTemplateObjectiveMinimums;
  sectionDefinitions: Array<{
    label: string;
    required: boolean;
    minimumWordCount: number | null;
  }>;
}) {
  const parts = [
    args.title,
    args.description,
    args.outputType,
    args.templateScope,
    args.subjectName ?? undefined,
    args.subjectCode ?? undefined,
    args.level ?? undefined,
    `objectives ${args.objectiveMinimums.minimumObjectives}`,
    `sources ${args.objectiveMinimums.minimumSourceMaterials}`,
    `sections ${args.objectiveMinimums.minimumSections}`,
    ...args.sectionDefinitions.flatMap((section) => [
      section.label,
      section.required ? "required" : "optional",
      section.minimumWordCount !== undefined ? `min ${section.minimumWordCount}` : undefined,
    ]),
  ].filter((part): part is string => Boolean(part));

  const seen = new Set<string>();
  const uniqueParts: string[] = [];
  for (const part of parts) {
    const normalized = normalizeText(part);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueParts.push(normalized);
  }

  const searchText = uniqueParts.join(" ");
  return searchText.length > 6000 ? searchText.slice(0, 6000) : searchText;
}

export function getInstructionTemplateScopeRank(scope: InstructionTemplateScope) {
  switch (scope) {
    case "subject_and_level":
      return 1;
    case "subject_only":
      return 2;
    case "level_only":
      return 3;
    case "school_default":
      return 4;
  }
}

export function getInstructionTemplateApplicabilityLabel(args: {
  templateScope: InstructionTemplateScope;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
}) {
  switch (args.templateScope) {
    case "subject_and_level":
      return `${args.subjectName ?? args.subjectCode ?? "Subject"} • ${args.level ?? "Level"}`;
    case "subject_only":
      return `${args.subjectName ?? args.subjectCode ?? "Subject"} only`;
    case "level_only":
      return `${args.level ?? "Level"} only`;
    case "school_default":
      return "School default";
  }
}

export function getInstructionTemplateResolutionLabel(template: {
  templateScope: InstructionTemplateScope;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
}) {
  switch (template.templateScope) {
    case "subject_and_level":
      return `subject + level (${template.subjectName ?? template.subjectCode ?? "subject"}, ${template.level ?? "level"})`;
    case "subject_only":
      return `subject only (${template.subjectName ?? template.subjectCode ?? "subject"})`;
    case "level_only":
      return `level only (${template.level ?? "level"})`;
    case "school_default":
      return "school default";
  }
}

export function matchesInstructionTemplateApplicability(
  template: Pick<
    Doc<"instructionTemplates">,
    "templateScope" | "subjectId" | "level" | "isSchoolDefault"
  >,
  context: { subjectId: Id<"subjects"> | null; level: string | null }
) {
  switch (template.templateScope) {
    case "subject_and_level":
      return (
        template.isSchoolDefault === false &&
        template.subjectId !== undefined &&
        template.subjectId !== null &&
        context.subjectId !== null &&
        String(template.subjectId) === String(context.subjectId) &&
        template.level !== undefined &&
        template.level !== null &&
        normalizeText(template.level).toLowerCase() === normalizeText(context.level ?? "").toLowerCase()
      );
    case "subject_only":
      return (
        template.isSchoolDefault === false &&
        template.subjectId !== undefined &&
        template.subjectId !== null &&
        context.subjectId !== null &&
        String(template.subjectId) === String(context.subjectId)
      );
    case "level_only":
      return (
        template.isSchoolDefault === false &&
        template.level !== undefined &&
        template.level !== null &&
        context.level !== null &&
        normalizeText(template.level).toLowerCase() === normalizeText(context.level).toLowerCase()
      );
    case "school_default":
      return template.isSchoolDefault === true;
  }
}

export function sortInstructionTemplates(
  a: { templateScope: InstructionTemplateScope; isActive: boolean; updatedAt: number; title: string },
  b: { templateScope: InstructionTemplateScope; isActive: boolean; updatedAt: number; title: string }
) {
  const scopeDiff = getInstructionTemplateScopeRank(a.templateScope) - getInstructionTemplateScopeRank(b.templateScope);
  if (scopeDiff !== 0) {
    return scopeDiff;
  }

  if (a.isActive !== b.isActive) {
    return a.isActive ? -1 : 1;
  }

  if (b.updatedAt !== a.updatedAt) {
    return b.updatedAt - a.updatedAt;
  }

  return a.title.localeCompare(b.title);
}

export function toTemplateSearchKey(value: string) {
  return normalizeText(value).toLowerCase();
}
