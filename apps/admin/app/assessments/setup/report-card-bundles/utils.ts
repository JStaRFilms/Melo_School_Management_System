import type {
  BundleDraft,
  BundleFieldDraft,
  BundleFieldRecord,
  BundleRecord,
  BundleSectionDraft,
  ClassAssignmentRecord,
  FieldSource,
  FieldType,
  ScaleOptionDraft,
  ScaleTemplateDraft,
  ScaleTemplateRecord,
  SystemKey,
} from "./types";

let localCounter = 0;

export const fieldTypeOptions: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Free text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "scale", label: "Reusable scale" },
];

export const fieldSourceOptions: Array<{ value: FieldSource; label: string }> = [
  { value: "teacher_manual", label: "Teacher entered" },
  { value: "admin_manual", label: "Admin entered" },
  { value: "system_term", label: "Term value" },
  { value: "system_attendance", label: "Attendance value" },
];

export const systemTermFieldOptions: Array<{ value: SystemKey; label: string }> = [
  { value: "next_term_begins", label: "Next term begins" },
];

export const systemAttendanceFieldOptions: Array<{ value: SystemKey; label: string }> = [
  { value: "attendance_code", label: "Attendance code" },
  { value: "times_school_opened", label: "Number of times opened" },
  { value: "times_present", label: "Number of times present" },
  { value: "times_absent", label: "Number of times absent" },
];

const canonicalFieldConfig: Record<SystemKey, { label: string; type: FieldType }> = {
  next_term_begins: { label: "Next Term Begins", type: "text" },
  attendance_code: { label: "Attendance Code", type: "text" },
  times_school_opened: { label: "Number Of Times Opened", type: "number" },
  times_present: { label: "Number Of Times Present", type: "number" },
  times_absent: { label: "Number Of Times Absent", type: "number" },
};

export function createEmptyScaleDraft(): ScaleTemplateDraft {
  return {
    templateId: null,
    name: "",
    description: "",
    options: [createEmptyScaleOption()],
  };
}

export function createScaleDraft(template?: ScaleTemplateRecord | null): ScaleTemplateDraft {
  if (!template) {
    return createEmptyScaleDraft();
  }

  return {
    templateId: template._id,
    name: template.name,
    description: template.description ?? "",
    options: template.options
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((option) => ({
        key: nextLocalId("scale-option"),
        id: option.id,
        label: option.label,
        shortLabel: option.shortLabel ?? "",
      })),
  };
}

export function createEmptyBundleDraft(): BundleDraft {
  return {
    bundleId: null,
    name: "",
    description: "",
    sections: [createEmptySection()],
  };
}

export function createBundleDraft(bundle?: BundleRecord | null): BundleDraft {
  if (!bundle) {
    return createEmptyBundleDraft();
  }

  return {
    bundleId: bundle._id,
    name: bundle.name,
    description: bundle.description ?? "",
    sections: bundle.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        key: nextLocalId("bundle-section"),
        id: section.id,
        label: section.label,
        fields: section.fields
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((field) => ({
            key: nextLocalId("bundle-field"),
            id: field.id,
            label: field.label,
            type: field.type,
            scaleTemplateId: field.scaleTemplateId ?? null,
            printable: field.printable,
            source: field.source,
            systemKey: field.systemKey ?? null,
          })),
      })),
  };
}

export function createEmptyScaleOption(): ScaleOptionDraft {
  return {
    key: nextLocalId("scale-option"),
    id: null,
    label: "",
    shortLabel: "",
  };
}

export function createEmptyField(type: FieldType = "text"): BundleFieldDraft {
  return {
    key: nextLocalId("bundle-field"),
    id: null,
    label: "",
    type,
    scaleTemplateId: null,
    printable: true,
    source: "teacher_manual",
    systemKey: null,
  };
}

export function createEmptySection(): BundleSectionDraft {
  return {
    key: nextLocalId("bundle-section"),
    id: null,
    label: "",
    fields: [createEmptyField()],
  };
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

export function validateScaleDraft(draft: ScaleTemplateDraft): string | null {
  if (!draft.name.trim()) {
    return "Scale template name is required.";
  }
  if (draft.options.length === 0) {
    return "Add at least one scale option.";
  }

  const seenLabels = new Set<string>();
  for (const option of draft.options) {
    const label = option.label.trim();
    if (!label) {
      return "Each scale option needs a label.";
    }
    const key = label.toLowerCase();
    if (seenLabels.has(key)) {
      return "Scale option labels must be unique.";
    }
    seenLabels.add(key);
  }

  return null;
}

export function validateBundleDraft(
  draft: BundleDraft,
  scaleTemplates: ScaleTemplateRecord[]
): string | null {
  if (!draft.name.trim()) {
    return "Bundle name is required.";
  }
  if (draft.sections.length === 0) {
    return "Add at least one section to this bundle.";
  }

  const availableTemplateIds = new Set(scaleTemplates.map((template) => template._id));
  const seenSectionLabels = new Set<string>();
  const seenLabels = new Set<string>();

  for (const section of draft.sections) {
    const sectionLabel = section.label.trim();
    if (!sectionLabel) {
      return "Each section needs a label.";
    }
    const sectionKey = sectionLabel.toLowerCase();
    if (seenSectionLabels.has(sectionKey)) {
      return "Section labels must be unique within a bundle.";
    }
    seenSectionLabels.add(sectionKey);

    if (section.fields.length === 0) {
      return `Add at least one field to \"${sectionLabel}\".`;
    }

    for (const field of section.fields) {
      const label = field.label.trim();
      if (!label) {
        return `Each field in \"${sectionLabel}\" needs a label.`;
      }
      const key = label.toLowerCase();
      if (seenLabels.has(key)) {
        return "Field labels must be unique within a bundle.";
      }
      seenLabels.add(key);

      if (field.type === "scale") {
        if (!field.scaleTemplateId) {
          return `Choose a reusable scale for \"${label}\".`;
        }
        if (!availableTemplateIds.has(field.scaleTemplateId)) {
          return `The reusable scale for \"${label}\" is no longer available.`;
        }
      }

      if (
        (field.source === "system_term" || field.source === "system_attendance") &&
        !field.systemKey
      ) {
        return `Choose a canonical value for "${label}".`;
      }
    }
  }

  return null;
}

export function serializeScaleDraft(draft: ScaleTemplateDraft) {
  return JSON.stringify({
    templateId: draft.templateId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    options: draft.options.map((option) => ({
      id: option.id,
      label: option.label.trim(),
      shortLabel: option.shortLabel.trim(),
    })),
  });
}

export function serializeBundleDraft(draft: BundleDraft) {
  return JSON.stringify({
    bundleId: draft.bundleId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    sections: draft.sections.map((section) => ({
      id: section.id,
      label: section.label.trim(),
      fields: section.fields.map((field) => ({
        id: field.id,
        label: field.label.trim(),
        type: field.type,
        scaleTemplateId: field.type === "scale" ? field.scaleTemplateId : null,
        printable: field.printable,
        source: field.source,
        systemKey: field.systemKey,
      })),
    })),
  });
}

export function getBundlePreviewValue(
  field: BundleFieldDraft,
  templates: ScaleTemplateRecord[]
) {
  if (
    field.source === "system_term" ||
    field.source === "system_attendance"
  ) {
    return field.systemKey ? canonicalFieldConfig[field.systemKey].label : "System value";
  }
  if (field.type === "text") {
    return "Example narrative entry";
  }
  if (field.type === "number") {
    return "12";
  }
  if (field.type === "boolean") {
    return "Yes";
  }

  const template = templates.find((entry) => entry._id === field.scaleTemplateId);
  return template?.options[0]?.label ?? "Select an option";
}

export function getCanonicalFieldConfig(systemKey: SystemKey | null) {
  return systemKey ? canonicalFieldConfig[systemKey] : null;
}

export function buildAssignmentMap(
  entries: Array<ClassAssignmentRecord>
): Record<string, ClassAssignmentRecord> {
  return Object.fromEntries(entries.map((entry) => [entry.classId, entry]));
}

export function countBundleFields(bundle: Pick<BundleRecord, "sections"> | BundleDraft) {
  return bundle.sections.reduce((total, section) => total + section.fields.length, 0);
}

export function getSectionPrintableFields(section: Pick<BundleSectionDraft, "fields">) {
  return section.fields.filter((field) => field.printable);
}

export function getSectionInternalFields(section: Pick<BundleSectionDraft, "fields">) {
  return section.fields.filter((field) => !field.printable);
}

export function flattenSectionFields(bundle: Pick<BundleDraft, "sections">) {
  return bundle.sections.flatMap((section) => section.fields);
}

export function buildNextAssignedBundleIds(
  assignment: ClassAssignmentRecord | undefined,
  selectedBundleId: string,
  includeSelected: boolean
) {
  const currentIds = assignment?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
  const nextIds = includeSelected
    ? Array.from(new Set([...currentIds, selectedBundleId]))
    : currentIds.filter((bundleId) => bundleId !== selectedBundleId);
  return nextIds;
}

export function findBundleField(bundle: BundleRecord, fieldId: string): BundleFieldRecord | null {
  for (const section of bundle.sections) {
    for (const field of section.fields) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  return null;
}

function nextLocalId(prefix: string) {
  localCounter += 1;
  return `${prefix}-${localCounter}`;
}
