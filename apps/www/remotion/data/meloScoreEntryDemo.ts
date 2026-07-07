import type {
  DraftScores,
  GradingBandResponse,
  Id,
  SelectionState,
  SelectorOption,
  StudentRosterEntry,
  ValidationErrors,
} from "../../../../apps/admin/lib/types";

const now = Date.UTC(2026, 0, 12);

export const meloIds = {
  session: "session-2025-2026" as Id<"academicSessions">,
  term: "term-first" as Id<"academicTerms">,
  class: "class-primary-5-gold" as Id<"classes">,
  subject: "subject-mathematics" as Id<"subjects">,
  school: "school-crescent" as Id<"schools">,
  user: "user-registrar" as Id<"users">,
  amina: "student-amina-bello" as Id<"students">,
};

export const meloSelection: SelectionState = {
  sessionId: meloIds.session,
  termId: meloIds.term,
  classId: meloIds.class,
  subjectId: meloIds.subject,
};

export const meloSelectorOptions: {
  sessions: SelectorOption[];
  terms: SelectorOption[];
  classes: SelectorOption[];
  subjects: SelectorOption[];
} = {
  sessions: [{ id: meloIds.session, name: "2025/2026 Session" }],
  terms: [{ id: meloIds.term, name: "First Term" }],
  classes: [{ id: meloIds.class, name: "Primary 5 Gold" }],
  subjects: [{ id: meloIds.subject, name: "Mathematics" }],
};

export const meloGradingBands: GradingBandResponse[] = [
  makeBand("band-a", 80, 100, "A", "Excellent"),
  makeBand("band-b", 70, 79, "B", "Very Good"),
  makeBand("band-c", 60, 69, "C", "Good"),
  makeBand("band-d", 50, 59, "D", "Fair"),
  makeBand("band-f", 0, 49, "F", "Needs Improvement"),
];

export function getMeloRoster(examScore: number | null): StudentRosterEntry[] {
  return [
    makeStudent("student-amina-bello", "Amina Bello", 17, 17, 17, examScore),
    makeStudent("student-chinedu-okafor", "Chinedu Okafor", 16, 16, 15, 39),
    makeStudent("student-zara-musa", "Zara Musa", 15, 16, 16, 37),
    makeStudent("student-david-eze", "David Eze", 14, 15, 16, 35),
  ];
}

export function getMeloDraftScores(examScore: number | null): DraftScores {
  return new Map([
    [meloIds.amina, { examRawScore: examScore }],
  ]);
}

export const emptyValidationErrors: ValidationErrors = new Map();

function makeBand(
  id: string,
  minScore: number,
  maxScore: number,
  gradeLetter: string,
  remark: string,
): GradingBandResponse {
  return {
    _id: id as Id<"gradingBands">,
    _creationTime: now,
    schoolId: meloIds.school,
    minScore,
    maxScore,
    gradeLetter,
    remark,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    updatedBy: meloIds.user,
  };
}

function makeStudent(
  id: string,
  studentName: string,
  ca1: number,
  ca2: number,
  ca3: number,
  examRawScore: number | null,
): StudentRosterEntry {
  const recordedExamScore = examRawScore ?? 0;

  return {
    studentId: id as Id<"students">,
    studentName,
    assessmentRecord: {
            _id: `record-${id}` as Id<"assessmentRecords">,
            _creationTime: now,
            schoolId: meloIds.school,
            sessionId: meloIds.session,
            termId: meloIds.term,
            classId: meloIds.class,
            subjectId: meloIds.subject,
            studentId: id as Id<"students">,
            ca1,
            ca2,
            ca3,
            examRawScore: recordedExamScore,
            examScaledScore: recordedExamScore,
            total: ca1 + ca2 + ca3 + recordedExamScore,
            gradeLetter: ca1 + ca2 + ca3 + recordedExamScore >= 80 ? "A" : "B",
            remark: ca1 + ca2 + ca3 + recordedExamScore >= 90 ? "Excellent" : "Very Good",
            examInputModeSnapshot: "raw60_scaled_to_40",
            examRawMaxSnapshot: 60,
            status: "draft",
            enteredBy: meloIds.user,
            updatedBy: meloIds.user,
            createdAt: now,
            updatedAt: now,
          },
  };
}
