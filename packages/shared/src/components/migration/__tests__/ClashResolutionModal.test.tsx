import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClashResolutionModal, type StagedRecordItem } from "../Modals/ClashResolutionModal";

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
