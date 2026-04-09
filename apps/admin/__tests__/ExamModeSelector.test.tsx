import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExamModeSelector } from "../app/assessments/setup/exam-recording/components/ExamModeSelector";

describe("ExamModeSelector", () => {
  it("renders both mode options", () => {
    const onModeChange = vi.fn();
    render(<ExamModeSelector currentMode="raw40" onModeChange={onModeChange} />);

    expect(screen.getByText("Direct /40 Entry")).toBeInTheDocument();
    expect(screen.getByText("Scaled /60 Entry")).toBeInTheDocument();
  });

  it("highlights the selected mode", () => {
    const onModeChange = vi.fn();
    const { container } = render(
      <ExamModeSelector currentMode="raw40" onModeChange={onModeChange} />
    );

    // The selected card should have a blue border
    const selectedCard = container.querySelector(".border-blue-600");
    expect(selectedCard).toBeInTheDocument();
  });

  it("calls onModeChange when selecting raw40", () => {
    const onModeChange = vi.fn();
    render(
      <ExamModeSelector
        currentMode="raw60_scaled_to_40"
        onModeChange={onModeChange}
      />
    );

    const directOption = screen.getByText("Direct /40 Entry");
    fireEvent.click(directOption);

    expect(onModeChange).toHaveBeenCalledWith("raw40");
  });

  it("calls onModeChange when selecting raw60_scaled_to_40", () => {
    const onModeChange = vi.fn();
    render(<ExamModeSelector currentMode="raw40" onModeChange={onModeChange} />);

    const scaledOption = screen.getByText("Scaled /60 Entry");
    fireEvent.click(scaledOption);

    expect(onModeChange).toHaveBeenCalledWith("raw60_scaled_to_40");
  });

  it("shows plain language descriptions", () => {
    const onModeChange = vi.fn();
    render(<ExamModeSelector currentMode="raw40" onModeChange={onModeChange} />);

    expect(
      screen.getByText(/Scores entered directly out of 40\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Scores entered out of 60, scaled down to 40\./)
    ).toBeInTheDocument();
  });
});
