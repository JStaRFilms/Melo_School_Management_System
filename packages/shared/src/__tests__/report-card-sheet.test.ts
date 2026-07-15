import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "../components/ReportCardSheet";

function buildCumulativeReportCard(): ReportCardSheetData {
  return {
    schoolName: "Test Academy",
    sessionName: "2025/2026 Academic Session",
    termName: "Third Term",
    classId: "class-1",
    className: "Primary 4",
    generatedAt: 0,
    assessmentConfig: {
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examMax: 40,
    },
    resultCalculationMode: "cumulative_annual",
    student: {
      _id: "student-1",
      name: "Test Student",
      displayName: "Test Student",
      firstName: "Test",
      lastName: "Student",
      admissionNumber: "TEST/001",
      gender: null,
      dateOfBirth: null,
      guardianName: null,
      guardianPhone: null,
      address: null,
      houseName: null,
      nextTermBegins: null,
      photoUrl: null,
    },
    summary: {
      totalSubjects: 1,
      recordedSubjects: 1,
      pendingSubjects: 0,
      averageScore: 80,
      totalScore: 80,
    },
    results: [
      {
        subjectId: "subject-1",
        subjectName: "Basic Science & Technology",
        subjectCode: "BST",
        ca1: 18,
        ca2: 17,
        ca3: 20,
        examScore: 35,
        total: 90,
        gradeLetter: "A",
        remark: "Excellent",
        isRecorded: true,
        calculationMode: "standalone",
        currentTermTotal: 90,
        firstTermTotal: null,
        secondTermTotal: null,
        annualAverage: null,
        isCumulativeComplete: true,
        missingHistoricalTerms: [],
      },
    ],
  };
}

describe("ReportCardSheet cumulative layout", () => {
  it("omits internal mode labels and stacks narrow assessment headings", () => {
    const markup = renderToStaticMarkup(
      createElement(ReportCardSheet, {
        reportCard: buildCumulativeReportCard(),
        backHref: "/report-cards",
      })
    );

    expect(markup).not.toContain("Standalone");
    expect(markup).not.toContain("In cumulative annual mode");
    expect(markup).toContain("flex-direction:column");
    expect(markup).toContain("CA1</span><span");
    expect(markup).toContain("(20%)");
    expect(markup).toContain("Exam</span><span");
    expect(markup).toContain("Total</span><span");
  });

  it("keeps the print-blocking warning for incomplete cumulative rows", () => {
    const reportCard = buildCumulativeReportCard();
    reportCard.results[0] = {
      ...reportCard.results[0],
      calculationMode: "cumulative_annual",
      isCumulativeComplete: false,
      missingHistoricalTerms: ["first"],
    };

    const markup = renderToStaticMarkup(
      createElement(ReportCardSheet, {
        reportCard,
        backHref: "/report-cards",
      })
    );

    expect(markup).toContain("Rows marked * are incomplete");
    expect(markup).toContain("Printing stays blocked");
  });
});
