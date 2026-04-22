import type { SubjectRecord } from "@/types";

export type InstructionTemplateOutputType =
  | "lesson_plan"
  | "student_note"
  | "assignment";

export type InstructionTemplateScope =
  | "subject_and_level"
  | "subject_only"
  | "level_only"
  | "school_default";

export interface InstructionTemplateObjectiveMinimumsDraft {
  minimumObjectives: string;
  minimumSourceMaterials: string;
  minimumSections: string;
}

export interface InstructionTemplateSectionDraft {
  key: string;
  id: string | null;
  label: string;
  required: boolean;
  minimumWordCount: string;
}

export interface InstructionTemplateDraft {
  templateId: string | null;
  outputType: InstructionTemplateOutputType;
  title: string;
  description: string;
  templateScope: InstructionTemplateScope;
  subjectId: string | null;
  level: string;
  isSchoolDefault: boolean;
  isActive: boolean;
  objectiveMinimums: InstructionTemplateObjectiveMinimumsDraft;
  sections: InstructionTemplateSectionDraft[];
}

export interface InstructionTemplateListItem {
  _id: string;
  templateKey: string;
  outputType: InstructionTemplateOutputType;
  title: string;
  description: string | null;
  templateScope: InstructionTemplateScope;
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
  isSchoolDefault: boolean;
  requiredSectionIds: string[];
  sectionDefinitions: Array<{
    id: string;
    label: string;
    order: number;
    required: boolean;
    minimumWordCount: number | null;
  }>;
  objectiveMinimums: {
    minimumObjectives: number;
    minimumSourceMaterials: number;
    minimumSections: number;
  };
  searchText: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
  sectionCount: number;
  requiredSectionCount: number;
  applicabilityLabel: string;
  templateKeyLabel: string;
  resolutionRank: number;
}

export interface InstructionTemplateSummary {
  total: number;
  active: number;
  defaultCount: number;
  inactive: number;
}

export interface InstructionTemplateListResponse {
  summary: InstructionTemplateSummary;
  templates: InstructionTemplateListItem[];
}

export interface InstructionTemplateStudioScreenProps {
  subjects: SubjectRecord[];
  levelOptions: Array<{ value: string; label: string }>;
  templates: InstructionTemplateListItem[];
  summary: InstructionTemplateSummary;
  outputType: InstructionTemplateOutputType;
  searchQuery: string;
  onOutputTypeChange: (outputType: InstructionTemplateOutputType) => void;
  onSearchQueryChange: (value: string) => void;
  onSaveTemplate: (draft: InstructionTemplateDraft) => Promise<string>;
}
