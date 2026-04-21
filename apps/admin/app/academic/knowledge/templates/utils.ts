import type { SubjectRecord } from "@/types";
import type {
  InstructionTemplateDraft,
  InstructionTemplateListItem,
  InstructionTemplateObjectiveMinimumsDraft,
  InstructionTemplateOutputType,
  InstructionTemplateScope,
  InstructionTemplateSectionDraft,
} from "./types";

let localCounter = 0;

export const instructionTemplateOutputTypeOptions: Array<{
  value: InstructionTemplateOutputType;
  label: string;
  description: string;
}> = [
  { value: "lesson_plan", label: "Lesson plan", description: "Teacher-facing lesson structure" },
  { value: "student_note", label: "Student note", description: "Learner-facing note template" },
  { value: "assignment", label: "Assignment", description: "Practice and submission template" },
];

export const instructionTemplateScopeOptions: Array<{
  value: InstructionTemplateScope;
  label: string;
  description: string;
}> = [
  { value: "subject_and_level", label: "Subject + level", description: "Most specific fallback bucket" },
  { value: "subject_only", label: "Subject only", description: "Fallback when level is unknown" },
  { value: "level_only", label: "Level only", description: "Fallback when subject-specific template is unavailable" },
  { value: "school_default", label: "School default", description: "Final fallback for the school" },
];

export function createEmptyInstructionTemplateDraft(outputType: InstructionTemplateOutputType): InstructionTemplateDraft {
  return {
    templateId: null,
    outputType,
    title: "",
    description: "",
    templateScope: "school_default",
    subjectId: null,
    level: "",
    isSchoolDefault: true,
    isActive: true,
    objectiveMinimums: {
      minimumObjectives: "1",
      minimumSourceMaterials: "0",
      minimumSections: "1",
    },
    sections: [createEmptyInstructionTemplateSectionDraft()],
  };
}

export function createInstructionTemplateDraft(template: InstructionTemplateListItem | null | undefined): InstructionTemplateDraft {
  if (!template) {
    return createEmptyInstructionTemplateDraft("lesson_plan");
  }

  return {
    templateId: template._id,
    outputType: template.outputType,
    title: template.title,
    description: template.description ?? "",
    templateScope: template.templateScope,
    subjectId: template.subjectId,
    level: template.level ?? "",
    isSchoolDefault: template.isSchoolDefault,
    isActive: template.isActive,
    objectiveMinimums: {
      minimumObjectives: String(template.objectiveMinimums.minimumObjectives),
      minimumSourceMaterials: String(template.objectiveMinimums.minimumSourceMaterials),
      minimumSections: String(template.objectiveMinimums.minimumSections),
    },
    sections: template.sectionDefinitions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        key: nextLocalId("template-section"),
        id: section.id,
        label: section.label,
        required: section.required,
        minimumWordCount: section.minimumWordCount === null ? "" : String(section.minimumWordCount),
      })),
  };
}

export function createEmptyInstructionTemplateSectionDraft(): InstructionTemplateSectionDraft {
  return {
    key: nextLocalId("template-section"),
    id: null,
    label: "",
    required: true,
    minimumWordCount: "80",
  };
}

export function createInstructionTemplateSectionDraftFromLabel(label: string): InstructionTemplateSectionDraft {
  return {
    key: nextLocalId("template-section"),
    id: null,
    label,
    required: true,
    minimumWordCount: "80",
  };
}

export function createInstructionTemplateObjectiveMinimumsDraft(): InstructionTemplateObjectiveMinimumsDraft {
  return {
    minimumObjectives: "1",
    minimumSourceMaterials: "0",
    minimumSections: "1",
  };
}

export function createInstructionTemplateSectionDraftFromExisting(section: {
  id: string;
  label: string;
  required: boolean;
  minimumWordCount: number | null;
}): InstructionTemplateSectionDraft {
  return {
    key: nextLocalId("template-section"),
    id: section.id,
    label: section.label,
    required: section.required,
    minimumWordCount: section.minimumWordCount === null ? "" : String(section.minimumWordCount),
  };
}

export function moveTemplateItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

export function serializeInstructionTemplateDraft(draft: InstructionTemplateDraft) {
  return JSON.stringify({
    templateId: draft.templateId,
    outputType: draft.outputType,
    title: draft.title.trim(),
    description: draft.description.trim(),
    templateScope: draft.templateScope,
    subjectId: draft.subjectId,
    level: draft.level.trim(),
    isSchoolDefault: draft.isSchoolDefault,
    isActive: draft.isActive,
    objectiveMinimums: {
      minimumObjectives: draft.objectiveMinimums.minimumObjectives.trim(),
      minimumSourceMaterials: draft.objectiveMinimums.minimumSourceMaterials.trim(),
      minimumSections: draft.objectiveMinimums.minimumSections.trim(),
    },
    sections: draft.sections.map((section) => ({
      id: section.id,
      label: section.label.trim(),
      required: section.required,
      minimumWordCount: section.minimumWordCount.trim(),
    })),
  });
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseWholeNumber(value: string, label: string, minimum: number) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  const next = Number(normalized);
  if (!Number.isFinite(next) || !Number.isInteger(next) || next < minimum) {
    throw new Error(`${label} must be a whole number of ${minimum} or more`);
  }

  return next;
}

function normalizeSectionWordCount(value: string, required: boolean, label: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    if (required) {
      throw new Error(`Required section \"${label}\" needs a minimum word count rule`);
    }
    return null;
  }

  const next = Number(normalized);
  if (!Number.isFinite(next) || !Number.isInteger(next) || next < 1) {
    throw new Error(`Minimum word count for \"${label}\" must be a whole number of 1 or more`);
  }

  return next;
}

export function validateInstructionTemplateDraft(
  draft: InstructionTemplateDraft,
  templates: InstructionTemplateListItem[]
): string | null {
  try {
    if (!normalizeText(draft.title)) {
      return "Template title is required.";
    }

    const normalizedLevel = normalizeText(draft.level);
    const normalizedSubjectId = draft.subjectId ? String(draft.subjectId) : null;
    const scope = draft.templateScope;

    switch (scope) {
      case "subject_and_level":
        if (!normalizedSubjectId) return "Select a subject for subject + level templates.";
        if (!normalizedLevel) return "Select a level for subject + level templates.";
        if (draft.isSchoolDefault) return "School default must be disabled for subject + level templates.";
        break;
      case "subject_only":
        if (!normalizedSubjectId) return "Select a subject for subject-only templates.";
        if (normalizedLevel) return "Subject-only templates must not set a level.";
        if (draft.isSchoolDefault) return "School default must be disabled for subject-only templates.";
        break;
      case "level_only":
        if (normalizedSubjectId) return "Level-only templates must not set a subject.";
        if (!normalizedLevel) return "Select a level for level-only templates.";
        if (draft.isSchoolDefault) return "School default must be disabled for level-only templates.";
        break;
      case "school_default":
        if (normalizedSubjectId) return "School default templates must not set a subject.";
        if (normalizedLevel) return "School default templates must not set a level.";
        if (!draft.isSchoolDefault) return "School default templates must enable the school default flag.";
        break;
    }

    if (draft.sections.length === 0) {
      return "Add at least one section.";
    }

    const seenSectionLabels = new Set<string>();
    const seenSectionIds = new Set<string>();
    let requiredSectionCount = 0;

    for (const section of draft.sections) {
      const label = normalizeText(section.label);
      if (!label) {
        return "Each section needs a label.";
      }

      const labelKey = label.toLowerCase();
      if (seenSectionLabels.has(labelKey)) {
        return "Section labels must be unique.";
      }
      seenSectionLabels.add(labelKey);

      const sectionId = normalizeText(section.id ?? "") || `${draft.outputType}-${labelKey}-${requiredSectionCount + 1}`;
      if (seenSectionIds.has(sectionId.toLowerCase())) {
        return "Section IDs must be unique.";
      }
      seenSectionIds.add(sectionId.toLowerCase());

      const minimumWordCount = normalizeSectionWordCount(section.minimumWordCount, section.required, label);
      if (section.required) {
        requiredSectionCount += 1;
        if (minimumWordCount === null) {
          return `Required section \"${label}\" needs a minimum word count rule.`;
        }
      }
    }

    if (requiredSectionCount === 0) {
      return "Add at least one required section.";
    }

    const minimumObjectives = parseWholeNumber(draft.objectiveMinimums.minimumObjectives, "Minimum objectives", 1);
    const minimumSourceMaterials = parseWholeNumber(
      draft.objectiveMinimums.minimumSourceMaterials,
      "Minimum source materials",
      0
    );
    const minimumSections = parseWholeNumber(draft.objectiveMinimums.minimumSections, "Minimum sections", requiredSectionCount);
    if (minimumSections < requiredSectionCount) {
      return "Minimum sections must cover every required section.";
    }

    if (!minimumObjectives || minimumObjectives < 1) {
      return "Minimum objectives must be at least 1.";
    }
    if (minimumSourceMaterials < 0) {
      return "Minimum source materials cannot be negative.";
    }

    const conflict = templates.find((template) => {
      if (template.isActive === false) {
        return false;
      }
      if (draft.templateId && template._id === draft.templateId) {
        return false;
      }
      if (template.outputType !== draft.outputType) {
        return false;
      }
      if (template.templateScope !== draft.templateScope) {
        return false;
      }

      switch (draft.templateScope) {
        case "subject_and_level":
          return String(template.subjectId) === normalizedSubjectId && normalizeText(template.level ?? "").toLowerCase() === normalizedLevel.toLowerCase();
        case "subject_only":
          return String(template.subjectId) === normalizedSubjectId;
        case "level_only":
          return normalizeText(template.level ?? "").toLowerCase() === normalizedLevel.toLowerCase();
        case "school_default":
          return template.isSchoolDefault;
      }
    });

    if (conflict) {
      return `An active ${draft.templateScope.replace(/_/g, " ")} template already exists for this applicability.`;
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Template validation failed.";
  }
}

export function getInstructionTemplateScopeLabel(
  template: Pick<InstructionTemplateListItem, "templateScope" | "subjectName" | "subjectCode" | "level">
) {
  switch (template.templateScope) {
    case "subject_and_level":
      return `${template.subjectName ?? template.subjectCode ?? "Subject"} • ${template.level ?? "Level"}`;
    case "subject_only":
      return `${template.subjectName ?? template.subjectCode ?? "Subject"} only`;
    case "level_only":
      return `${template.level ?? "Level"} only`;
    case "school_default":
      return "School default";
  }
}

export function getInstructionTemplateResolutionPathLabel(
  template: Pick<InstructionTemplateListItem, "templateScope" | "subjectName" | "subjectCode" | "level">
) {
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

export function getInstructionTemplateApplicabilitySummary(
  draft: InstructionTemplateDraft,
  subjects: SubjectRecord[]
) {
  const subject = draft.subjectId ? subjects.find((entry) => entry._id === draft.subjectId) : null;
  switch (draft.templateScope) {
    case "subject_and_level":
      return `${subject?.name ?? "Subject"} • ${draft.level.trim() || "Level"}`;
    case "subject_only":
      return `${subject?.name ?? "Subject"} only`;
    case "level_only":
      return `${draft.level.trim() || "Level"} only`;
    case "school_default":
      return "School default";
  }
}

export function getInstructionTemplateDraftResolutionRank(draft: InstructionTemplateDraft) {
  switch (draft.templateScope) {
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

export function getInstructionTemplateDraftApplicabilityMessage(
  draft: InstructionTemplateDraft,
  subjects: SubjectRecord[]
) {
  return `${getInstructionTemplateApplicabilitySummary(draft, subjects)} • ${draft.isActive ? "active" : "inactive"}`;
}

export function nextLocalId(prefix: string) {
  localCounter += 1;
  return `${prefix}-${localCounter}`;
}
