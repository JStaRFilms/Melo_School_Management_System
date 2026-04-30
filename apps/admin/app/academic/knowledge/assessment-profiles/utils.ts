import type { AssessmentProfileDraft, Profile, QuestionMix, QuestionStyle } from "./types";

export const mixFields: Array<{ key: keyof QuestionMix; label: string }> = [
  { key: "multiple_choice", label: "Multiple choice" },
  { key: "short_answer", label: "Short answer" },
  { key: "essay", label: "Essay" },
  { key: "true_false", label: "True/false" },
  { key: "fill_in_the_blank", label: "Fill blank" },
];

export function mixTotal(mix: QuestionMix) {
  return Object.values(mix).reduce((sum, value) => sum + value, 0);
}

export function getQuestionMixForStyle(questionStyle: QuestionStyle): QuestionMix {
  switch (questionStyle) {
    case "objective_heavy":
      return { multiple_choice: 16, true_false: 2, fill_in_the_blank: 2, short_answer: 0, essay: 0 };
    case "open_ended_heavy":
      return { multiple_choice: 1, true_false: 0, fill_in_the_blank: 1, short_answer: 6, essay: 2 };
    case "balanced":
      return { multiple_choice: 4, true_false: 2, fill_in_the_blank: 2, short_answer: 4, essay: 1 };
    case "mixed_open_ended":
    default:
      return { multiple_choice: 3, short_answer: 4, essay: 1, true_false: 1, fill_in_the_blank: 1 };
  }
}

export function createEmptyAssessmentProfileDraft(): AssessmentProfileDraft {
  const blankMix = getQuestionMixForStyle("mixed_open_ended");
  return {
    profileId: null,
    name: "New Profile",
    description: "",
    questionStyle: "mixed_open_ended",
    totalQuestions: mixTotal(blankMix),
    questionMix: blankMix,
    allowTeacherOverrides: true,
    isDefault: false,
    isActive: true,
  };
}

export function createAssessmentProfileDraft(profile: Profile): AssessmentProfileDraft {
  return {
    profileId: profile._id,
    name: profile.name,
    description: profile.description ?? "",
    questionStyle: profile.questionStyle,
    totalQuestions: profile.totalQuestions,
    questionMix: { ...profile.questionMix },
    allowTeacherOverrides: profile.allowTeacherOverrides,
    isDefault: profile.isDefault,
    isActive: profile.isActive,
  };
}

export function serializeAssessmentProfileDraft(draft: AssessmentProfileDraft) {
  return JSON.stringify({
    name: draft.name,
    description: draft.description,
    questionStyle: draft.questionStyle,
    questionMix: draft.questionMix,
    allowTeacherOverrides: draft.allowTeacherOverrides,
    isDefault: draft.isDefault,
    isActive: draft.isActive,
  });
}
