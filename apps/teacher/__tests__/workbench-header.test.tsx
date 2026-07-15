import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchHeader } from "@/app/assessments/report-card-workbench/components/WorkbenchHeader";

describe("WorkbenchHeader", () => {
  it("shows session and term selectors and reports term changes", () => {
    const onTermChange = vi.fn();

    render(
      <WorkbenchHeader
        sessionName="2025/2026 Academic Session"
        termName="Third Term"
        sessionOptions={[{ id: "session-1", name: "2025/2026" }]}
        termOptions={[
          { id: "term-1", name: "First Term" },
          { id: "term-3", name: "Third Term" },
        ]}
        classOptions={[{ id: "class-1", name: "JSS 1" }]}
        studentOptions={[
          {
            id: "student-1",
            name: "Adamu Zainab",
            admissionNumber: "OBCA/25/0007",
          },
        ]}
        selectedSessionId="session-1"
        selectedTermId="term-3"
        selectedClassId="class-1"
        selectedStudentId="student-1"
        isLoadingSessions={false}
        isLoadingTerms={false}
        isLoadingClasses={false}
        isLoadingStudents={false}
        onSessionChange={vi.fn()}
        onTermChange={onTermChange}
        onClassChange={vi.fn()}
        onStudentChange={vi.fn()}
        onNextStudent={vi.fn()}
        printHref="/assessments/report-cards?termId=term-3"
      />
    );

    expect(screen.getByRole("combobox", { name: "Session" })).toHaveValue(
      "session-1"
    );
    expect(screen.getByRole("combobox", { name: "Term" })).toHaveValue(
      "term-3"
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Term" }), {
      target: { value: "term-1" },
    });

    expect(onTermChange).toHaveBeenCalledWith("term-1");
    expect(screen.getByRole("link", { name: "Print view" })).toHaveAttribute(
      "href",
      "/assessments/report-cards?termId=term-3"
    );
  });
});
