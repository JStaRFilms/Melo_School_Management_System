import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterGrid } from "../components/RosterGrid";
import type {
  StudentRosterEntry,
  GradingBandResponse,
  ValidationErrors,
  Id,
} from "@/lib/types";

// Mock data
function createStudent(
  id: string,
  name: string,
  scores?: { ca1: number; ca2: number; ca3: number; examRawScore: number }
): StudentRosterEntry {
  return {
    studentId: id as Id<"students">,
    studentName: name,
    assessmentRecord: scores
      ? ({
          _id: `rec_${id}` as Id<"assessmentRecords">,
          _creationTime: 0,
          schoolId: "school1" as Id<"schools">,
          sessionId: "session1" as Id<"academicSessions">,
          termId: "term1" as Id<"academicTerms">,
          classId: "class1" as Id<"classes">,
          subjectId: "subj1" as Id<"subjects">,
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
          status: "draft" as const,
          enteredBy: "user1" as Id<"users">,
          updatedBy: "user1" as Id<"users">,
          createdAt: 0,
          updatedAt: 0,
        } as never)
      : null,
  };
}

const standardBands: GradingBandResponse[] = [
  {
    _id: "band1" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 0,
    maxScore: 39,
    gradeLetter: "F",
    remark: "Fail",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band2" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 40,
    maxScore: 49,
    gradeLetter: "D",
    remark: "Pass",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band3" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 50,
    maxScore: 59,
    gradeLetter: "C",
    remark: "Good",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band4" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 60,
    maxScore: 69,
    gradeLetter: "B",
    remark: "Very Good",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band5" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 70,
    maxScore: 100,
    gradeLetter: "A",
    remark: "Excellent",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
];

const mockOnScoreChange = () => {};

describe("RosterGrid", () => {
  describe("renders correct number of rows", () => {
    it("shows one row per student in roster", () => {
      const roster = [
        createStudent("s1", "Adebayo Ogunlesi"),
        createStudent("s2", "Chioma Okafor"),
        createStudent("s3", "John Aminu"),
      ];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      expect(screen.getAllByText("Adebayo Ogunlesi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Chioma Okafor").length).toBeGreaterThan(0);
      expect(screen.getAllByText("John Aminu").length).toBeGreaterThan(0);
    });
  });

  describe("raw40 mode", () => {
    it("renders without Scaled column", () => {
      const roster = [createStudent("s1", "Student One")];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      expect(screen.getByText(/Exam \/40/)).toBeDefined();
      // Scaled column should not exist
      expect(screen.queryByText(/Scaled/)).toBeNull();
    });

    it("shows raw40 mode indicator badge", () => {
      const roster = [createStudent("s1", "Student One")];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      expect(screen.getByText(/ExamRawMode=raw40/)).toBeDefined();
    });
  });

  describe("raw60 mode", () => {
    it("renders Scaled /40 column", () => {
      const roster = [createStudent("s1", "Student One")];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw60_scaled_to_40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      expect(screen.getByText(/Exam \/60/)).toBeDefined();
      expect(screen.getAllByText(/Scaled/).length).toBeGreaterThan(0);
    });

    it("shows raw60 mode indicator badge", () => {
      const roster = [createStudent("s1", "Student One")];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw60_scaled_to_40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      expect(screen.getByText(/raw60_scaled/)).toBeDefined();
    });
  });

  describe("displays existing scores", () => {
    it("pre-filled scores from assessmentRecord appear in grid", () => {
      const roster = [
        createStudent("s1", "Adebayo Ogunlesi", {
          ca1: 18,
          ca2: 15,
          ca3: 19,
          examRawScore: 34,
        }),
      ];

      render(
        <RosterGrid
          roster={roster}
          examInputMode="raw40"
          gradingBands={standardBands}
          draftScores={new Map()}
          validationErrors={new Map()}
          onScoreChange={mockOnScoreChange}
        />
      );

      // Total should be 18+15+19+34 = 86
      expect(screen.getAllByText("86.00").length).toBeGreaterThan(0);
      // Grade A
      expect(screen.getAllByText("A").length).toBeGreaterThan(0);
      // Remark
      expect(screen.getAllByText("Excellent").length).toBeGreaterThan(0);
    });
  });
});

describe("ScoreInput validation", () => {
  it("shows error state for out-of-range values", () => {
    const studentId = "s1" as Id<"students">;
    const validationErrors: ValidationErrors = new Map([
      [
        studentId,
        {
          ca1: "CA1 must be between 0 and 20",
        },
      ],
    ]);

    const roster = [createStudent("s1", "Test Student")];

    render(
      <RosterGrid
        roster={roster}
        examInputMode="raw40"
        gradingBands={standardBands}
        draftScores={new Map()}
        validationErrors={validationErrors}
        onScoreChange={mockOnScoreChange}
      />
    );

    expect(
      screen.getByText("CA1 must be between 0 and 20")
    ).toBeDefined();
  });
});
