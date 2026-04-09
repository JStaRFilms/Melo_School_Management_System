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

    expect(screen.getByText("Grade")).toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();
    expect(screen.getByText("Remark")).toBeInTheDocument();
    expect(screen.getByDisplayValue("F")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A")).toBeInTheDocument();
  });

  it("renders the add-tier button", () => {
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

    expect(screen.getByText("Add New Tier")).toBeInTheDocument();
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

    const addButton = screen.getByText("Add New Tier");
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

    const rows = document.querySelectorAll(".bg-rose-50\\/30");
    const fields = document.querySelectorAll(".border-rose-500");

    expect(rows.length).toBeGreaterThan(0);
    expect(fields.length).toBeGreaterThan(0);
  });

  it("renders table headers", () => {
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

    expect(screen.getByText("Grade")).toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();
    expect(screen.getByText("Remark")).toBeInTheDocument();
  });
});
