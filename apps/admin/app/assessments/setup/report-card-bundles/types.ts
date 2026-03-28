import type { ReactNode } from "react";

export type FieldType = "text" | "number" | "boolean" | "scale";

export interface ScaleOptionRecord {
  id: string;
  label: string;
  shortLabel: string | null;
  order: number;
}

export interface ScaleTemplateRecord {
  _id: string;
  name: string;
  description: string | null;
  options: ScaleOptionRecord[];
}

export interface BundleFieldRecord {
  id: string;
  label: string;
  type: FieldType;
  scaleTemplateId: string | null;
  printable: boolean;
  order: number;
}

export interface BundleSectionRecord {
  id: string;
  label: string;
  order: number;
  fields: BundleFieldRecord[];
}

export interface BundleRecord {
  _id: string;
  name: string;
  description: string | null;
  sections: BundleSectionRecord[];
}

export interface ClassSummary {
  id: string;
  name: string;
}

export interface ClassAssignmentRecord {
  classId: string;
  bundleAssignments: Array<{
    bundleId: string;
    bundleName: string;
    order: number;
  }>;
}

export interface ScaleOptionDraft {
  key: string;
  id: string | null;
  label: string;
  shortLabel: string;
}

export interface ScaleTemplateDraft {
  templateId: string | null;
  name: string;
  description: string;
  options: ScaleOptionDraft[];
}

export interface BundleFieldDraft {
  key: string;
  id: string | null;
  label: string;
  type: FieldType;
  scaleTemplateId: string | null;
  printable: boolean;
}

export interface BundleSectionDraft {
  key: string;
  id: string | null;
  label: string;
  fields: BundleFieldDraft[];
}

export interface BundleDraft {
  bundleId: string | null;
  name: string;
  description: string;
  sections: BundleSectionDraft[];
}

export interface ScreenProps {
  scaleTemplates: ScaleTemplateRecord[];
  bundles: BundleRecord[];
  onSaveScaleTemplate: (draft: ScaleTemplateDraft) => Promise<string>;
  onSaveBundle: (draft: BundleDraft) => Promise<string>;
  renderAssignmentPanel: (selectedBundleId: string | null) => ReactNode;
}
