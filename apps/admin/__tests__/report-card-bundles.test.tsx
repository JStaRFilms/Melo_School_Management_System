import { describe, expect, it } from "vitest";
import {
  STARTER_BUNDLE_PRESETS,
  getShortPresetName,
  createBundleDraftFromPreset,
  createEmptyBundleDraft,
  createEmptySection,
  createSectionDraftFromPreset,
  createSectionDraftsFromPreset,
  validateBundleDraft,
} from "../app/assessments/setup/report-card-bundles/utils";
import type { BundleDraft, ScaleTemplateRecord } from "../app/assessments/setup/report-card-bundles/types";

const mockScaleTemplates: ScaleTemplateRecord[] = [
  {
    _id: "scale_1",
    schoolId: "school_1" as any,
    name: "5-Point Scale",
    description: "Standard scale",
    options: [
      { id: "5", label: "Excellent", shortLabel: "5", order: 0 },
      { id: "4", label: "Very Good", shortLabel: "4", order: 1 },
      { id: "3", label: "Good", shortLabel: "3", order: 2 },
      { id: "2", label: "Fair", shortLabel: "2", order: 3 },
      { id: "1", label: "Poor", shortLabel: "1", order: 4 },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  },
];

describe("Report Card Add-on Multi-Preset Bundles", () => {
  it("provides all essential curriculum presets including Remarks & Resumption", () => {
    const names = STARTER_BUNDLE_PRESETS.map((p) => p.name);
    expect(names).toContain("Affective & Behavioral Traits");
    expect(names).toContain("Psychomotor & Practical Skills");
    expect(names).toContain("Attendance & Physical Measurements");
    expect(names).toContain("Teacher Remarks & Term Summary");
  });

  it("provides clean, concise short preset names for chips and menu labels", () => {
    expect(getShortPresetName(0)).toBe("Affective & Behavioral");
    expect(getShortPresetName(1)).toBe("Psychomotor Skills");
    expect(getShortPresetName(2)).toBe("Attendance & Health");
    expect(getShortPresetName(3)).toBe("Teacher Remarks");
  });

  it("creates section drafts with unique keys from presets", () => {
    const preset = STARTER_BUNDLE_PRESETS[0];
    const section1 = createSectionDraftFromPreset(preset, "scale_1");
    const section2 = createSectionDraftFromPreset(preset, "scale_1");

    expect(section1.key).not.toEqual(section2.key);
    expect(section1.label).toBe("Affective Development");
    expect(section1.fields.length).toBeGreaterThan(0);
    expect(section1.fields[0].key).not.toEqual(section2.fields[0].key);
    expect(section1.fields[0].scaleTemplateId).toBe("scale_1");
  });

  it("supports combining multiple presets into one bundle without overwriting earlier sections", () => {
    let draft: BundleDraft = createEmptyBundleDraft();
    expect(draft.sections.length).toBe(1);

    // Initial load: Affective Traits
    const affectivePreset = STARTER_BUNDLE_PRESETS.find((p) => p.name.includes("Affective"))!;
    draft = createBundleDraftFromPreset(affectivePreset, "scale_1");

    expect(draft.name).toBe("Affective & Behavioral Traits");
    expect(draft.sections.length).toBe(1);
    expect(draft.sections[0].label).toBe("Affective Development");
    expect(draft.sections[0].fields.length).toBe(6);

    // Append second preset: Psychomotor Skills
    const psychomotorPreset = STARTER_BUNDLE_PRESETS.find((p) => p.name.includes("Psychomotor"))!;
    const psychomotorSections = createSectionDraftsFromPreset(psychomotorPreset, "scale_1");
    draft = {
      ...draft,
      sections: [...draft.sections, ...psychomotorSections],
    };

    expect(draft.sections.length).toBe(2);
    expect(draft.sections[0].label).toBe("Affective Development");
    expect(draft.sections[1].label).toBe("Psychomotor Skills");
    expect(draft.sections[1].fields.length).toBe(5);

    // Append third preset: Attendance & Measurements
    const attendancePreset = STARTER_BUNDLE_PRESETS.find((p) => p.name.includes("Attendance"))!;
    const attendanceSections = createSectionDraftsFromPreset(attendancePreset, "scale_1");
    draft = {
      ...draft,
      sections: [...draft.sections, ...attendanceSections],
    };

    expect(draft.sections.length).toBe(3);
    expect(draft.sections[0].label).toBe("Affective Development");
    expect(draft.sections[1].label).toBe("Psychomotor Skills");
    expect(draft.sections[2].label).toBe("Attendance & Health");
    expect(draft.sections[2].fields.some((f) => f.systemKey === "times_school_opened")).toBe(true);

    // Bundle validates cleanly with multiple distinct sections
    const error = validateBundleDraft(draft, mockScaleTemplates);
    expect(error).toBeNull();
  });

  it("replaces only the target section when applying a preset at section level", () => {
    // Start with 2 blank sections
    const sec1 = createEmptySection(false);
    sec1.label = "Custom Section 1";
    const sec2 = createEmptySection(false);
    sec2.label = "Section to be Replaced";

    const draft: BundleDraft = {
      bundleId: null,
      sourceUpdatedAt: null,
      name: "Multi-Domain Report",
      description: "",
      sections: [sec1, sec2],
    };

    // Apply Psychomotor preset to Section #2 only
    const psychomotorPreset = STARTER_BUNDLE_PRESETS.find((p) => p.name.includes("Psychomotor"))!;
    const newSec2 = createSectionDraftFromPreset(psychomotorPreset, "scale_1");

    const updatedSections = draft.sections.map((section, idx) => {
      if (idx !== 1) return section;
      return {
        ...section,
        label: newSec2.label,
        fields: newSec2.fields,
      };
    });

    expect(updatedSections[0].label).toBe("Custom Section 1");
    expect(updatedSections[1].label).toBe("Psychomotor Skills");
    expect(updatedSections[1].fields.length).toBe(5);
  });
});
