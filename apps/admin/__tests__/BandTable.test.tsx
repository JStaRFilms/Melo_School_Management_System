import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BandTable } from "../app/assessments/setup/grading-bands/components/BandTable";
import type { GradingBandDraft, BandValidationError } from "../lib/types";

describe("BandTable", () => {
  const mockBands: GradingBandDraft[] = [
    { minScore: 0, maxScore: 39, gradeLetter: "F", remark: "Fail" },
    { minScore: 70, maxScore: 100, gradeLetter: "A", remark: "Excellent" },
  ];

  it("renders the table with bands", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={[]}
        onValidationChange={onValidationChange}
      />
    );

    expect(screen.getByText("Grading Bands")).toBeInTheDocument();
    expect(screen.getByDisplayValue("F")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A")).toBeInTheDocument();
  });

  it("renders Add Tier button", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={[]}
        onValidationChange={onValidationChange}
      />
    );

    expect(screen.getByText("Add Tier")).toBeInTheDocument();
    expect(screen.getByText("Append Pass Tier")).toBeInTheDocument();
  });

  it("calls onBandsChange when adding a tier", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={[]}
        onValidationChange={onValidationChange}
      />
    );

    const addButton = screen.getByText("Add Tier");
    fireEvent.click(addButton);

    expect(onBandsChange).toHaveBeenCalledWith([
      ...mockBands,
      { minScore: null, maxScore: null, gradeLetter: "", remark: "" },
    ]);
  });

  it("updates the grade letter when edited", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={[]}
        onValidationChange={onValidationChange}
      />
    );

    fireEvent.change(screen.getByDisplayValue("F"), {
      target: { value: "g" },
    });

    expect(onBandsChange).toHaveBeenCalledWith([
      { ...mockBands[0], gradeLetter: "G" },
      mockBands[1],
    ]);
  });

  it("shows validation errors when provided", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();
    const errors: BandValidationError[] = [
      {
        type: "overlap",
        message: "Bands overlap for Grade A and B",
        bandIndices: [0, 1],
      },
    ];

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={errors}
        onValidationChange={onValidationChange}
      />
    );

    // Error rows should have error styling
    const rows = document.querySelectorAll(".bg-red-50\\/10");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("renders subtitle text", () => {
    const onBandsChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <BandTable
        bands={mockBands}
        onBandsChange={onBandsChange}
        validationErrors={[]}
        onValidationChange={onValidationChange}
      />
    );

    expect(
      screen.getByText("Define result derivation tiers for the session.")
    ).toBeInTheDocument();
  });
});
