import type {
  ExamEntrySheetResponse,
  GradingBandResponse,
  Id,
  SelectorOption,
  StudentRosterEntry,
  SchoolSettingsResponse,
  AssessmentEditingStateResponse,
} from "@/types";

const baseBands: GradingBandResponse[] = [
  createBand("band_f", 0, 39, "F", "Fail"),
  createBand("band_d", 40, 49, "D", "Pass"),
  createBand("band_c", 50, 59, "C", "Good"),
  createBand("band_b", 60, 69, "B", "Very Good"),
  createBand("band_a", 70, 100, "A", "Excellent"),
];

export const mockSessions: SelectorOption[] = [
  { id: "session_2025_2026", name: "2025/2026" },
];

export const mockTermsBySession: Record<string, SelectorOption[]> = {
  session_2025_2026: [
    { id: "term_1", name: "Term 1" },
    { id: "term_2", name: "Term 2" },
  ],
};

export const mockClasses: SelectorOption[] = [
  { id: "class_primary_4a", name: "Primary 4A" },
  { id: "class_primary_5a", name: "Primary 5A" },
  { id: "class_primary_6a", name: "Primary 6A" },
];

export const mockSubjectsByClass: Record<string, SelectorOption[]> = {
  class_primary_4a: [
    { id: "subject_math", name: "Mathematics" },
    { id: "subject_english", name: "English Language" },
    { id: "subject_science", name: "Basic Science" },
  ],
  class_primary_5a: [
    { id: "subject_math", name: "Mathematics" },
    { id: "subject_english", name: "English Language" },
  ],
  class_primary_6a: [{ id: "subject_basic_science", name: "Basic Science" }],
};

export const mockSettings: SchoolSettingsResponse = createSettings("raw40");

export const mockGradingBands: GradingBandResponse[] = baseBands;

const mockSheets: Record<string, ExamEntrySheetResponse> = {
  [buildSheetKey(
    "session_2025_2026",
    "term_1",
    "class_primary_4a",
    "subject_math"
  )]: {
    roster: [
      createStudent("student_adebayo", "Adebayo Ogunlesi", {
        ca1: 18,
        ca2: 15,
        ca3: 19,
        examRawScore: 34,
      }),
      createStudent("student_chioma", "Chioma Okafor", {
        ca1: 16,
        ca2: 17,
        ca3: 18,
        examRawScore: 32,
      }),
      createStudent("student_john", "John Aminu"),
      createStudent("student_morenike", "Morenike Balogun", {
        ca1: 14,
        ca2: 13,
        ca3: 15,
        examRawScore: 28,
      }),
      createStudent("student_emeka", "Emeka Eze", {
        ca1: 19,
        ca2: 18,
        ca3: 20,
        examRawScore: 38,
      }),
      createStudent("student_fatima", "Fatima Ibrahim"),
      createStudent("student_obi", "Obi Nwankwo", {
        ca1: 12,
        ca2: 14,
        ca3: 11,
        examRawScore: 22,
      }),
      createStudent("student_amina", "Amina Yusuf", {
        ca1: 17,
        ca2: 16,
        ca3: 18,
        examRawScore: 30,
      }),
    ],
    settings: createSettings("raw40"),
    gradingBands: baseBands,
    editingState: createEditingState(),
  },
  [buildSheetKey(
    "session_2025_2026",
    "term_1",
    "class_primary_4a",
    "subject_english"
  )]: {
    roster: [
      createStudent("student_adebayo", "Adebayo Ogunlesi", {
        ca1: 16,
        ca2: 18,
        ca3: 17,
        examRawScore: 51,
      }),
      createStudent("student_chioma", "Chioma Okafor"),
      createStudent("student_john", "John Aminu", {
        ca1: 15,
        ca2: 14,
        ca3: 16,
        examRawScore: 45,
      }),
    ],
    settings: createSettings("raw60_scaled_to_40"),
    gradingBands: baseBands,
    editingState: createEditingState(),
  },
  [buildSheetKey(
    "session_2025_2026",
    "term_2",
    "class_primary_6a",
    "subject_basic_science"
  )]: {
    roster: [
      createStudent("student_ife", "Ife Okonkwo"),
      createStudent("student_sodiq", "Sodiq Musa"),
    ],
    settings: createSettings("raw40"),
    gradingBands: baseBands,
    editingState: createEditingState(),
  },
};

export function getMockSheet(
  sessionId: string,
  termId: string,
  classId: string,
  subjectId: string
): ExamEntrySheetResponse {
  return (
    mockSheets[buildSheetKey(sessionId, termId, classId, subjectId)] ?? {
      roster: [],
      settings: createSettings("raw40"),
      gradingBands: baseBands,
      editingState: createEditingState(),
    }
  );
}

export function getMockSettings(): SchoolSettingsResponse {
  return mockSettings;
}

export function getMockGradingBands(): GradingBandResponse[] {
  return baseBands;
}

function buildSheetKey(
  sessionId: string,
  termId: string,
  classId: string,
  subjectId: string
): string {
  return `${sessionId}:${termId}:${classId}:${subjectId}`;
}

function createStudent(
  id: string,
  name: string,
  scores?: { ca1: number; ca2: number; ca3: number; examRawScore: number }
): StudentRosterEntry {
  return {
    studentId: id as Id<"students">,
    studentName: name,
    assessmentRecord: scores
      ? {
          _id: `record_${id}` as Id<"assessmentRecords">,
          _creationTime: Date.now(),
          schoolId: "school_demo" as Id<"schools">,
          sessionId: "session_2025_2026" as Id<"academicSessions">,
          termId: "term_1" as Id<"academicTerms">,
          classId: "class_primary_4a" as Id<"classes">,
          subjectId: "subject_math" as Id<"subjects">,
          studentId: id as Id<"students">,
          ca1: scores.ca1,
          ca2: scores.ca2,
          ca3: scores.ca3,
          examRawScore: scores.examRawScore,
          examScaledScore: scores.examRawScore,
          total: scores.ca1 + scores.ca2 + scores.ca3 + scores.examRawScore,
          gradeLetter: "A",
          remark: "Excellent",
          examInputModeSnapshot: "raw40",
          examRawMaxSnapshot: 40,
          status: "draft",
          enteredBy: "user_demo" as Id<"users">,
          updatedBy: "user_demo" as Id<"users">,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : null,
  };
}

function createSettings(
  examInputMode: "raw40" | "raw60_scaled_to_40"
): SchoolSettingsResponse {
  return {
    _id: "settings_demo" as Id<"schoolAssessmentSettings">,
    _creationTime: Date.now(),
    schoolId: "school_demo" as Id<"schools">,
    examInputMode,
    ca1Max: 20,
    ca2Max: 20,
    ca3Max: 20,
    examContributionMax: 40,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    updatedBy: "user_demo" as Id<"users">,
  };
}

function createBand(
  id: string,
  minScore: number,
  maxScore: number,
  gradeLetter: string,
  remark: string
): GradingBandResponse {
  return {
    _id: id as Id<"gradingBands">,
    _creationTime: Date.now(),
    schoolId: "school_demo" as Id<"schools">,
    minScore,
    maxScore,
    gradeLetter,
    remark,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    updatedBy: "user_demo" as Id<"users">,
  };
}

function createEditingState(): AssessmentEditingStateResponse {
  return {
    hasPolicy: false,
    canEdit: true,
    lockReason: null,
    message: "Editing is open because no exam access policy has been set.",
    isWithinEditingWindow: true,
    isFinalized: false,
    evaluatedAt: Date.now(),
  };
}
