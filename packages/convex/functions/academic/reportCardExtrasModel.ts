import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { normalizeHumanName } from "@school/shared/name-format";

export const reportCardExtraFieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("boolean"),
  v.literal("scale")
);

export const reportCardExtraScaleOptionInputValidator = v.object({
  id: v.optional(v.union(v.string(), v.null())),
  label: v.string(),
  shortLabel: v.optional(v.union(v.string(), v.null())),
});

export const reportCardExtraBundleFieldInputValidator = v.object({
  id: v.optional(v.union(v.string(), v.null())),
  label: v.string(),
  type: reportCardExtraFieldTypeValidator,
  scaleTemplateId: v.optional(v.union(v.id("reportCardExtraScaleTemplates"), v.null())),
  printable: v.optional(v.union(v.boolean(), v.null())),
});

export const reportCardExtraBundleSectionInputValidator = v.object({
  id: v.optional(v.union(v.string(), v.null())),
  label: v.string(),
  fields: v.array(reportCardExtraBundleFieldInputValidator),
});

export const reportCardExtraValueInputValidator = v.object({
  fieldId: v.string(),
  textValue: v.optional(v.union(v.string(), v.null())),
  numberValue: v.optional(v.union(v.number(), v.null())),
  booleanValue: v.optional(v.union(v.boolean(), v.null())),
  scaleOptionId: v.optional(v.union(v.string(), v.null())),
});

export const reportCardExtraEditorFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: reportCardExtraFieldTypeValidator,
  printable: v.boolean(),
  scaleTemplateId: v.union(v.id("reportCardExtraScaleTemplates"), v.null()),
  scaleOptions: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      shortLabel: v.union(v.string(), v.null()),
    })
  ),
  value: v.object({
    textValue: v.union(v.string(), v.null()),
    numberValue: v.union(v.number(), v.null()),
    booleanValue: v.union(v.boolean(), v.null()),
    scaleOptionId: v.union(v.string(), v.null()),
    printValue: v.union(v.string(), v.null()),
  }),
});

export const reportCardExtraEditorSectionValidator = v.object({
  id: v.string(),
  label: v.string(),
  fields: v.array(reportCardExtraEditorFieldValidator),
});

export const reportCardExtraEditorBundleValidator = v.object({
  _id: v.id("reportCardExtraBundles"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  sections: v.array(reportCardExtraEditorSectionValidator),
});

export const reportCardExtraPrintableValidator = v.array(
  v.object({
    bundleId: v.id("reportCardExtraBundles"),
    bundleName: v.string(),
    sections: v.array(
      v.object({
        sectionId: v.string(),
        sectionLabel: v.string(),
        items: v.array(
          v.object({
            fieldId: v.string(),
            label: v.string(),
            type: reportCardExtraFieldTypeValidator,
            printValue: v.union(v.string(), v.null()),
          })
        ),
      })
    ),
  })
);

type StoredFieldValue = {
  fieldId: string;
  textValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  scaleOptionId?: string;
};

type BundleField = {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "scale";
  scaleTemplateId?: Id<"reportCardExtraScaleTemplates">;
  printable: boolean;
  order: number;
};

type BundleSection = {
  id: string;
  label: string;
  order: number;
  fields: BundleField[];
};

type BundleDoc = {
  _id: Id<"reportCardExtraBundles">;
  schoolId: Id<"schools">;
  name: string;
  description?: string;
  sections: BundleSection[];
};

export function normalizeScaleTemplateOptions(
  options: Array<{ id?: string | null; label: string; shortLabel?: string | null }>
) {
  const usedIds = new Set<string>();
  const normalized = options.map((option, index) => ({
    id: getStableId(option.id, option.label, index, usedIds, "scale"),
    label: normalizeRequiredText(option.label, "Scale option label is required"),
    ...(normalizeOptionalText(option.shortLabel)
      ? { shortLabel: normalizeOptionalText(option.shortLabel) }
      : {}),
    order: index,
  }));

  if (normalized.length === 0) {
    throw new ConvexError("At least one scale option is required");
  }

  return normalized;
}

export async function normalizeBundleSections(
  ctx: any,
  schoolId: Id<"schools">,
  sections: Array<{
    id?: string | null;
    label: string;
    fields: Array<{
      id?: string | null;
      label: string;
      type: "text" | "number" | "boolean" | "scale";
      scaleTemplateId?: Id<"reportCardExtraScaleTemplates"> | null;
      printable?: boolean | null;
    }>;
  }>
) {
  if (sections.length === 0) {
    throw new ConvexError("At least one bundle section is required");
  }

  const usedSectionIds = new Set<string>();
  const usedFieldIds = new Set<string>();
  const normalizedSections: BundleSection[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const label = normalizeRequiredText(section.label, "Bundle section label is required");
    if (section.fields.length === 0) {
      throw new ConvexError(`Bundle section \"${label}\" requires at least one field`);
    }

    const normalizedFields: BundleField[] = [];
    for (let fieldIndex = 0; fieldIndex < section.fields.length; fieldIndex += 1) {
      const field = section.fields[fieldIndex];
      const fieldLabel = normalizeRequiredText(field.label, "Extra field label is required");
      let scaleTemplateId: Id<"reportCardExtraScaleTemplates"> | undefined;

      if (field.type === "scale") {
        if (!field.scaleTemplateId) {
          throw new ConvexError(`Scale field \"${fieldLabel}\" requires a scale template`);
        }
        const template = await ctx.db.get(field.scaleTemplateId);
        if (!template || template.schoolId !== schoolId) {
          throw new ConvexError(`Scale template for \"${fieldLabel}\" was not found`);
        }
        scaleTemplateId = field.scaleTemplateId;
      }

      normalizedFields.push({
        id: getStableId(field.id, fieldLabel, fieldIndex, usedFieldIds, "field"),
        label: fieldLabel,
        type: field.type,
        ...(scaleTemplateId ? { scaleTemplateId } : {}),
        printable: field.printable ?? true,
        order: fieldIndex,
      });
    }

    normalizedSections.push({
      id: getStableId(section.id, label, sectionIndex, usedSectionIds, "section"),
      label,
      order: sectionIndex,
      fields: normalizedFields,
    });
  }

  return normalizedSections;
}

export async function buildExtrasCollectionView(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    studentId: Id<"students">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
  }
) {
  const assignments = await ctx.db
    .query("reportCardExtraClassAssignments")
    .withIndex("by_class", (q: any) => q.eq("classId", args.classId))
    .collect();

  const scopedAssignments = assignments
    .filter((assignment: any) => assignment.schoolId === args.schoolId)
    .sort((a: any, b: any) => a.order - b.order || a.createdAt - b.createdAt);

  if (scopedAssignments.length === 0) {
    return { bundles: [], printableBundles: [] };
  }

  const bundleDocs = (
    await Promise.all(scopedAssignments.map((assignment: any) => ctx.db.get(assignment.bundleId)))
  ).filter((bundle): bundle is BundleDoc => Boolean(bundle && bundle.schoolId === args.schoolId));

  const storedValues = await ctx.db
    .query("reportCardExtraStudentValues")
    .withIndex("by_student_session_term", (q: any) =>
      q.eq("studentId", args.studentId).eq("sessionId", args.sessionId).eq("termId", args.termId)
    )
    .collect();

  const valueDocsByBundleId = new Map<string, { values: StoredFieldValue[] }>();
  for (const doc of storedValues) {
    if (
      String(doc.schoolId) === String(args.schoolId) &&
      String(doc.classId) === String(args.classId)
    ) {
      valueDocsByBundleId.set(String(doc.bundleId), { values: doc.values as StoredFieldValue[] });
    }
  }

  const templateIds = bundleDocs.flatMap((bundle) =>
    bundle.sections.flatMap((section) =>
      section.fields
        .map((field) => field.scaleTemplateId)
        .filter(
          (templateId): templateId is Id<"reportCardExtraScaleTemplates"> => Boolean(templateId)
        )
    )
  );
  const templates = await Promise.all(
    templateIds.map((templateId) => ctx.db.get(templateId))
  );
  const templateMap = new Map(
    templates
      .filter((template): template is NonNullable<typeof template> => Boolean(template && template.schoolId === args.schoolId))
      .map((template) => [String(template._id), template] as const)
  );

  const bundleViews = bundleDocs.map((bundle) => {
    const valueMap = new Map(
      (valueDocsByBundleId.get(String(bundle._id))?.values ?? []).map(
        (value) => [value.fieldId, value] as const
      )
    );

    const sections = bundle.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        id: section.id,
        label: section.label,
        fields: section.fields
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((field) => {
            const template = field.scaleTemplateId
              ? templateMap.get(String(field.scaleTemplateId))
              : null;
            const value = valueMap.get(field.id);
            return {
              id: field.id,
              label: field.label,
              type: field.type,
              printable: field.printable,
              scaleTemplateId: field.scaleTemplateId ?? null,
              scaleOptions: (template?.options ?? [])
                .slice()
                .sort((a: any, b: any) => a.order - b.order)
                .map((option: any) => ({
                  id: option.id,
                  label: option.label,
                  shortLabel: option.shortLabel ?? null,
                })),
              value: {
                textValue: value?.textValue ?? null,
                numberValue: value?.numberValue ?? null,
                booleanValue: value?.booleanValue ?? null,
                scaleOptionId: value?.scaleOptionId ?? null,
                printValue: formatExtraPrintValue(field.type, value, template),
              },
            };
          }),
      }));

    return {
      _id: bundle._id,
      name: bundle.name,
      description: bundle.description ?? null,
      sections,
    };
  });

  const printableBundles = bundleViews.map((bundle) => ({
    bundleId: bundle._id,
    bundleName: bundle.name,
    sections: bundle.sections.map((section) => ({
      sectionId: section.id,
      sectionLabel: section.label,
      items: section.fields
        .filter((field) => field.printable)
        .map((field) => ({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          printValue: field.value.printValue,
        })),
    })),
  }));

  return {
    bundles: bundleViews,
    printableBundles,
  };
}

export function normalizeStoredExtraValues(
  values: Array<{
    fieldId: string;
    textValue?: string | null;
    numberValue?: number | null;
    booleanValue?: boolean | null;
    scaleOptionId?: string | null;
  }>,
  bundle: BundleDoc,
  templateMap: Map<string, { options: Array<{ id: string; label: string }> }>
) {
  const fieldMap = new Map(
    bundle.sections.flatMap((section) => section.fields.map((field) => [field.id, field] as const))
  );
  const normalized = [] as StoredFieldValue[];

  for (const rawValue of values) {
    const field = fieldMap.get(rawValue.fieldId);
    if (!field) continue;

    const nextValue: StoredFieldValue = { fieldId: field.id };
    if (field.type === "text") {
      const textValue = normalizeOptionalText(rawValue.textValue);
      if (textValue) nextValue.textValue = textValue;
    } else if (field.type === "number") {
      if (rawValue.numberValue !== undefined && rawValue.numberValue !== null) {
        nextValue.numberValue = rawValue.numberValue;
      }
    } else if (field.type === "boolean") {
      if (rawValue.booleanValue !== undefined && rawValue.booleanValue !== null) {
        nextValue.booleanValue = rawValue.booleanValue;
      }
    } else {
      const scaleOptionId = normalizeOptionalText(rawValue.scaleOptionId);
      if (scaleOptionId) {
        const template = field.scaleTemplateId
          ? templateMap.get(String(field.scaleTemplateId))
          : null;
        const isValid = template?.options.some((option) => option.id === scaleOptionId);
        if (!isValid) {
          throw new ConvexError(`Scale value for \"${field.label}\" is invalid`);
        }
        nextValue.scaleOptionId = scaleOptionId;
      }
    }

    if (
      nextValue.textValue !== undefined ||
      nextValue.numberValue !== undefined ||
      nextValue.booleanValue !== undefined ||
      nextValue.scaleOptionId !== undefined
    ) {
      normalized.push(nextValue);
    }
  }

  return normalized;
}

function formatExtraPrintValue(
  fieldType: BundleField["type"],
  value: StoredFieldValue | undefined,
  template?: { options: Array<{ id: string; label: string }> } | null
) {
  if (!value) return null;
  if (fieldType === "text") return value.textValue ?? null;
  if (fieldType === "number") {
    return value.numberValue === undefined ? null : String(value.numberValue);
  }
  if (fieldType === "boolean") {
    return value.booleanValue === undefined ? null : value.booleanValue ? "Yes" : "No";
  }
  return template?.options.find((option) => option.id === value.scaleOptionId)?.label ?? null;
}

function normalizeRequiredText(value: string, message: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) throw new ConvexError(message);
  return normalizeHumanName(normalized);
}

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getStableId(
  preferredId: string | null | undefined,
  label: string,
  index: number,
  usedIds: Set<string>,
  prefix: string
) {
  const preferred = slugifyId(preferredId);
  if (preferred && !usedIds.has(preferred)) {
    usedIds.add(preferred);
    return preferred;
  }

  const base = slugifyId(label) ?? `${prefix}-${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function slugifyId(value?: string | null) {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}
