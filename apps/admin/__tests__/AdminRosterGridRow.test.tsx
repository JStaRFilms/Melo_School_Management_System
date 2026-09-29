import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminRosterGridRow } from "../app/assessments/results/entry/components/AdminRosterGridRow";
import type {
  DraftScores,
  Id,
  StudentRosterEntry,
  ValidationErrors,
} from "../lib/types";

const studentId = "students-precision-fixture" as Id<"students">;

function renderRow(examInputMode: "raw40" | "raw60_scaled_to_40", draftScores: DraftScores) {
  const student: StudentRosterEntry = {
    studentId,
    studentName: "Ada Nwosu",
    assessmentRecord: null,
  };
  const validationErrors: ValidationErrors = new Map();

  return render(
    <table>
      <tbody>
        <AdminRosterGridRow
          student={student}
          examInputMode={examInputMode}
          gradingBands={[]}
          draftScores={draftScores}
          validationErrors={validationErrors}
          sessionId={"sessions-precision" as Id<"academicSessions">}
          termId={"terms-precision" as Id<"academicTerms">}
          classId={"classes-precision" as Id<"classes">}
          isEditable={false}
          onScoreChange={vi.fn()}
        />
      </tbody>
    </table>
  );
}

describe("AdminRosterGridRow score precision", () => {
  it("prints the total at two decimal places", () => {
    const draftScores: DraftScores = new Map([
      [studentId, { ca1: 10.5, ca2: 10, ca3: 10, examRawScore: 30 }],
    ]);

    renderRow("raw40", draftScores);

    expect(screen.getByText("60.50")).toBeInTheDocument();
  });

  it("prints the scaled exam score at two decimal places", () => {
    const draftScores: DraftScores = new Map([
      [studentId, { ca1: 10.5, ca2: 10, ca3: 10, examRawScore: 50 }],
    ]);

    renderRow("raw60_scaled_to_40", draftScores);

    expect(screen.getByText("33.33")).toBeInTheDocument();
    expect(screen.getByText("63.83")).toBeInTheDocument();
  });
});
