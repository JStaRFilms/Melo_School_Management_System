import type { Prompt } from "ai";

import type { DocumentOutputType } from "./contracts";

export interface DocumentSourceMaterialSummary {
  readonly id: string;
  readonly title: string;
  readonly sourceType?: string;
  readonly visibility?: string;
  readonly description?: string;
  readonly topicLabel?: string;
}

export interface DocumentTemplateSectionSummary {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly required: boolean;
  readonly minimumWordCount?: number | null;
}

export interface DocumentPromptContext {
  readonly schoolName?: string;
  readonly subject?: string;
  readonly level?: string;
  readonly topic?: string;
  readonly templateName?: string;
  readonly templateSections?: DocumentTemplateSectionSummary[];
  readonly sourceMaterials?: DocumentSourceMaterialSummary[];
  readonly revisionNotes?: string;
  readonly constraints?: string[];
}

const documentGenerationSystemPrompt = [
  "You are a school document-generation assistant for Lesson Knowledge Hub.",
  "Return only the requested structured draft.",
  "Do not write chatty commentary, preambles, or markdown fences.",
  "A resolved school template is mandatory: if template details are missing or unclear, do not invent a replacement structure.",
  "Strictly follow the resolved template section names, order, required flags, and minimum word-count guidance.",
  "Stay faithful to the selected sources and template constraints.",
  "Prefer concise, school-appropriate language that a teacher can edit later.",
].join(" ");

function formatContextLines(context: DocumentPromptContext) {
  const lines: string[] = [];

  if (context.schoolName) lines.push(`School: ${context.schoolName}`);
  if (context.subject) lines.push(`Subject: ${context.subject}`);
  if (context.level) lines.push(`Level: ${context.level}`);
  if (context.topic) lines.push(`Topic: ${context.topic}`);
  if (context.templateName) lines.push(`Template: ${context.templateName}`);

  if (context.templateSections?.length) {
    lines.push("Template sections to follow exactly:");
    for (const section of [...context.templateSections].sort((a, b) => a.order - b.order)) {
      const details = [
        section.required ? "required" : "optional",
        section.minimumWordCount ? `minimum ${section.minimumWordCount} words` : null,
      ]
        .filter(Boolean)
        .join("; ");
      lines.push(`- sectionId: ${section.id}; label: ${section.label}${details ? ` (${details})` : ""}`);
    }
  } else {
    lines.push("Template sections: MISSING. Generation must fail before calling the model.");
  }

  if (context.revisionNotes) lines.push(`Revision notes: ${context.revisionNotes}`);

  if (context.constraints?.length) {
    lines.push("Constraints:");
    for (const constraint of context.constraints) {
      lines.push(`- ${constraint}`);
    }
  }

  if (context.sourceMaterials?.length) {
    lines.push("Selected source materials:");
    for (const material of context.sourceMaterials) {
      const details = [material.sourceType, material.visibility, material.topicLabel]
        .filter(Boolean)
        .join(" | ");
      lines.push(
        `- ${material.title}${details ? ` (${details})` : ""}${
          material.description ? ` — ${material.description}` : ""
        }`
      );
    }
  }

  return lines.join("\n");
}

function buildDocumentPrompt(args: {
  kind: DocumentOutputType;
  purpose: string;
  context: DocumentPromptContext;
  extraInstructions?: string[];
}): Prompt {
  const promptLines = [
    `Generate the ${args.kind} draft as a single JSON object that matches the contract.`,
    args.purpose,
    "The JSON must include title, subject, level, topic, sections, and sourceNotes.",
    "For sections, return one item for every required template section listed below, using the exact sectionId and label values provided.",
    "Include optional template sections when they are useful; if included, keep their exact sectionId and label values.",
    "Do not add unknown sections, rename sections, merge sections, or nest sections inside other sections.",
    "Write each section's content directly for that section; do not nest a complete document inside a section.",
    "Keep the JSON compact: content should be useful but concise, and never repeat the whole draft inside a section.",
    "",
    "Context:",
    formatContextLines(args.context) || "(none provided)",
  ];

  if (args.extraInstructions?.length) {
    promptLines.push("", "Additional instructions:");
    for (const instruction of args.extraInstructions) {
      promptLines.push(`- ${instruction}`);
    }
  }

  return {
    system: documentGenerationSystemPrompt,
    prompt: promptLines.join("\n"),
  };
}

export function buildLessonPlanPrompt(
  context: DocumentPromptContext
): Prompt {
  return buildDocumentPrompt({
    kind: "lesson_plan",
    purpose:
      "Draft a teacher-facing lesson plan with objectives, lesson flow, assessment, and homework.",
    context,
    extraInstructions: [
      "Make the lesson flow usable in a single class period.",
      "Keep the language practical for a teacher editor to refine later.",
    ],
  });
}

export function buildStudentNotePrompt(
  context: DocumentPromptContext
): Prompt {
  return buildDocumentPrompt({
    kind: "student_note",
    purpose:
      "Draft a learner-facing note that explains the topic clearly and can be approved for topic-page use later.",
    context,
    extraInstructions: [
      "Use student-friendly explanations.",
      "Avoid teacher-only shorthand and keep the tone instructional.",
    ],
  });
}

export function buildTemplateRepairPrompt(args: {
  originalPrompt: string;
  previousDraft: unknown;
  validationErrors: string[];
  templateSections: DocumentTemplateSectionSummary[];
}): Prompt {
  const allowedSections = args.templateSections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const details = [section.required ? "required" : "optional", section.minimumWordCount ? `minimum ${section.minimumWordCount} words` : null]
        .filter(Boolean)
        .join("; ");
      return `- sectionId: ${section.id}; label: ${section.label}${details ? ` (${details})` : ""}`;
    })
    .join("\n");

  return {
    system: documentGenerationSystemPrompt,
    prompt: [
      "Your previous JSON draft did not satisfy the school's resolved template.",
      "Return a complete corrected JSON object only. Do not return a patch, markdown, commentary, or code fence.",
      "Rewrite the full object using the same contract: title, subject, level, topic, sections, and sourceNotes.",
      "Use only the allowed section IDs and exact labels below. Required sections must be present and non-empty.",
      "Optional sections may be present when useful; omitted optional sections will be left blank by the app.",
      "Do not duplicate section IDs. Do not add unknown section IDs. Do not nest a complete document inside any section.",
      "Keep the corrected JSON compact and concise. Do not repeat the whole draft inside any section.",
      "",
      "Allowed template sections:",
      allowedSections,
      "",
      "Validation errors to fix:",
      ...args.validationErrors.map((error) => `- ${error}`),
      "",
      "Original generation prompt:",
      args.originalPrompt,
      "",
      "Previous draft JSON:",
      JSON.stringify(args.previousDraft),
    ].join("\n"),
  };
}

export function buildAssignmentPrompt(
  context: DocumentPromptContext
): Prompt {
  return buildDocumentPrompt({
    kind: "assignment",
    purpose:
      "Draft an assignment with clear tasks, expected responses, and marking guidance.",
    context,
    extraInstructions: [
      "Make the tasks progressively more challenging.",
      "Keep the assignment editable and school appropriate.",
    ],
  });
}

export function buildQuestionBankDraftPrompt(
  context: DocumentPromptContext
): Prompt {
  return buildDocumentPrompt({
    kind: "question_bank_draft",
    purpose:
      "Draft a structured question bank with answers, explanations, difficulty tags, and marks.",
    context,
    extraInstructions: [
      "Balance recall, understanding, and application questions.",
      "Make the answer key explicit and concise.",
    ],
  });
}

export function buildCbtDraftPrompt(context: DocumentPromptContext): Prompt {
  return buildDocumentPrompt({
    kind: "cbt_draft",
    purpose:
      "Draft an exam-style CBT set with sections, questions, and answer key notes.",
    context,
    extraInstructions: [
      "Keep the structure suitable for later moderation and review.",
      "Avoid adding any live test-taking workflow details.",
    ],
  });
}
