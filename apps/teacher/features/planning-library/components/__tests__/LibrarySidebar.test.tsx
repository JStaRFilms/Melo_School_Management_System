import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibrarySidebar } from "../LibrarySidebar";

const props = {
  searchQuery: "",
  onSearchChange: vi.fn(),
  subjectFilter: "all",
  onSubjectFilterChange: vi.fn(),
  levelFilter: "all",
  onLevelFilterChange: vi.fn(),
  subjects: [],
  levelOptions: [],
  subjectsReady: [],
  onUpload: vi.fn(async () => undefined),
  isUploading: false,
  isAdmin: false,
  view: "upload" as const,
};

describe("LibrarySidebar upload availability", () => {
  it("shows the secure transport gate instead of upload controls", () => {
    render(<LibrarySidebar {...props} canUpload={false} />);

    expect(screen.getByRole("note")).toHaveTextContent("current storage transport cannot prove school/caller ownership");
    expect(screen.queryByRole("button", { name: "Choose material file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish Material" })).not.toBeInTheDocument();
  });

  it("renders upload controls only when upload authority is present", () => {
    render(<LibrarySidebar {...props} canUpload />);

    expect(screen.getByRole("button", { name: "Choose material file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Material" })).toBeDisabled();
  });
});
