import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClashResolutionModal, type StagedRecordItem } from "../Modals/ClashResolutionModal";
import { RosterReviewTab, type StagedStudentRow } from "../Tabs/RosterReviewTab";
import { ImportRowReviewDialog, type ImportReviewOptions } from "../Modals/ImportRowReviewDialog";

const importedRecord: StagedRecordItem = {
  _id: "imported",
  rowNumber: 7,
  parsedData: {
    firstName: "Hauwa",
    middleName: "Ayo",
    lastName: "Ibrahim",
    gender: "Female",
    className: "Secondary 3",
    guardianPhone: "+234800000105",
  },
  clashConfidence: 59,
  clashReason: 'Staged duplicate (Row #4): Same class: "Secondary 3"',
  isResolved: false,
};

describe("ImportRowReviewDialog", () => {
  it("explains new profile creation and preselects the matched existing class", () => {
    const record: StagedStudentRow = {
      _id: "row-5",
      rowNumber: 5,
      entityType: "student",
      parsedData: {
        firstName: "Emeka",
        lastName: "Eze",
        gender: "Female",
        className: "Nursery 1",
        matchedClassId: "class-1",
      },
      validationStatus: "valid",
      validationErrors: [],
      isResolved: false,
    };
    const options: ImportReviewOptions = {
      classes: [{ id: "class-1", name: "Nursery 1", level: "Nursery 1" }],
      subjects: [],
      families: [],
      students: [],
      availableStudentUsers: [],
      sessions: [],
      numbering: {
        available: true,
        nextNumber: "MCAA_MAIN-2026-1001",
        nextSequence: 1001,
        policyVersion: 1,
        formatVersion: "v1",
        counterKey: "default",
        counterVersion: 1,
        sessionId: "session-1",
        resetPeriod: "session",
      },
    };

    const html = renderToStaticMarkup(
      <ImportRowReviewDialog
        record={record}
        options={options}
        saving={false}
        onClose={vi.fn()}
        onSave={async () => undefined}
      />,
    );

    expect(html).toContain('value="class-1" selected=""');
    expect(html).toContain("A new internal student profile will be created");
    expect(html).not.toContain("Prepared student identity");
    expect(html).toContain("Save decision for final import");
  });
});

describe("ClashResolutionModal", () => {
  it("shows the actual staged candidate and does not offer an existing-student merge", () => {
    const candidateRecord: StagedRecordItem = {
      _id: "candidate",
      rowNumber: 4,
      parsedData: {
        firstName: "Damilola",
        middleName: "Chukwu",
        lastName: "Bello",
        gender: "Male",
        className: "Secondary 3",
        guardianPhone: "+234800000102",
      },
      isResolved: false,
    };

    const html = renderToStaticMarkup(
      <ClashResolutionModal
        record={importedRecord}
        candidateRecord={candidateRecord}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(html).toContain("Matched Row #4");
    expect(html).toContain("Damilola Chukwu Bello");
    expect(html).toContain("+234800000102");
    expect(html).not.toContain("Database Match");
    expect(html).not.toContain("Merge with Existing");
  });

  it("does not present a warning without a candidate as a zero-percent clash", () => {
    const warningRecord: StagedStudentRow = {
      ...importedRecord,
      entityType: "student",
      validationStatus: "warning",
      validationErrors: [],
      clashConfidence: undefined,
    };
    const html = renderToStaticMarkup(
      <RosterReviewTab
        records={[warningRecord]}
        onPatchField={async () => undefined}
        onOpenClashModal={vi.fn()}
        onReview={vi.fn()}
      />,
    );

    expect(html).toContain("Review needed");
    expect(html).not.toContain("Possible duplicate (");
    expect(html).not.toContain("Clash (");
  });

  it("offers bulk review for clean resolved roster rows", () => {
    const cleanRecord: StagedStudentRow = {
      ...importedRecord,
      entityType: "student",
      validationStatus: "valid",
      validationErrors: [],
      clashConfidence: undefined,
      clashReason: undefined,
    };
    const html = renderToStaticMarkup(
      <RosterReviewTab
        records={[cleanRecord]}
        onPatchField={async () => undefined}
        onOpenClashModal={vi.fn()}
        onReview={vi.fn()}
        readyRowCount={1}
        onReviewReadyRows={vi.fn()}
      />,
    );

    expect(html).toContain("Review 1 clean row");
    expect(html).toContain("No detected issues");
  });

  it("shows only known live-student details without copying the imported phone", () => {
    const html = renderToStaticMarkup(
      <ClashResolutionModal
        record={importedRecord}
        existingStudentMatch={{
          fullName: "Existing Student",
          className: "Secondary 3",
          admissionNumber: "OBCA/25/0042",
        }}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(html).toContain("Existing Student");
    expect(html).toContain("OBCA/25/0042");
    expect(html).toContain("Merge with Existing");
    expect(html.match(/\+234800000105/g)).toHaveLength(1);
    expect(html).toContain("Not available");
  });
});
