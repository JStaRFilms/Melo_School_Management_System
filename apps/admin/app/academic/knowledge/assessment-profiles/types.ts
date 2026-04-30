export type QuestionStyle = "balanced" | "open_ended_heavy" | "mixed_open_ended" | "objective_heavy";

export type QuestionMix = {
  multiple_choice: number;
  short_answer: number;
  essay: number;
  true_false: number;
  fill_in_the_blank: number;
};

export interface Profile {
  _id: string;
  name: string;
  description: string | null;
  questionStyle: QuestionStyle;
  totalQuestions: number;
  questionMix: QuestionMix;
  allowTeacherOverrides: boolean;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: number;
}

export interface AssessmentProfileDraft extends Omit<Profile, "_id" | "updatedAt"> {
  profileId: string | null;
}
