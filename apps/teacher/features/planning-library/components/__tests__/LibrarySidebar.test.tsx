import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { validateKnowledgeMaterialPdfSelection } from "@school/shared";
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
  uploadReadiness: {
    isLoading: false,
    hasPlanningPermission: true,
    hasUploadPermission: true,
    hasAssignedContext: true,
    supportsDuplicateProtection: true,
    storageStatus: "ready" as const,
    availableBytes: 100 * 1024 * 1024,
    allocatedBytes: 100 * 1024 * 1024,
    maxFileSizeBytes: 12 * 1024 * 1024,
  },
  checkDuplicate: vi.fn(async () => false),
  onUpload: vi.fn(async () => undefined),
  isUploading: false,
  isAdmin: false,
  view: "upload" as const,
};

describe("LibrarySidebar upload availability", () => {
  it("shows missing upload authority while keeping readiness visible", () => {
    render(
      <LibrarySidebar
        {...props}
        canUpload={false}
        uploadReadiness={{ ...props.uploadReadiness, hasUploadPermission: false }}
      />,
    );

    expect(screen.getByText("! Upload permission")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose material file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload material" })).toBeDisabled();
  });

  it("renders upload controls only when upload authority is present", () => {
    render(<LibrarySidebar {...props} canUpload />);

    expect(screen.getByRole("button", { name: "Choose material file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload material" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("file, title, level, topic label, subject");
  });

  it("shows an exhausted storage quota before submission", () => {
    render(
      <LibrarySidebar
        {...props}
        canUpload
        uploadReadiness={{
          ...props.uploadReadiness,
          storageStatus: "exhausted",
          availableBytes: 0,
        }}
      />,
    );

    expect(screen.getByText("! Storage quota exhausted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload material" })).toBeDisabled();
  });

  it("submits a validated, fingerprinted file through the shared upload form", async () => {
    const onUpload = vi.fn(async () => undefined);
    const checkDuplicate = vi.fn(async () => false);
    const { container } = render(
      <LibrarySidebar
        {...props}
        canUpload
        checkDuplicate={checkDuplicate}
        subjectsReady={[{ id: "subject-1", name: "Mathematics", code: "MTH" }]}
        levelOptions={[{ value: "JSS 1", label: "JSS 1" }]}
        onUpload={onUpload}
      />,
    );
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("File input was not rendered");
    const file = new File(["assigned source"], "assigned-source.txt", {
      type: "text/plain",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "subject-1" } });
    fireEvent.change(selects[1], { target: { value: "JSS 1" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Motion and forces"), {
      target: { value: "Algebra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload material" }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(checkDuplicate).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        contentType: "text/plain",
        title: "assigned source",
        subjectId: "subject-1",
        level: "JSS 1",
        topicLabel: "Algebra",
        uploadIntent: "private_draft",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("uses one 80-page PDF policy before upload", () => {
    expect(validateKnowledgeMaterialPdfSelection({ pageCount: 81, selectedPageRanges: "" }))
      .toContain("at most 80 pages");
    expect(validateKnowledgeMaterialPdfSelection({ pageCount: 81, selectedPageRanges: "1-80" }))
      .toBeNull();
    expect(validateKnowledgeMaterialPdfSelection({ pageCount: 81, selectedPageRanges: "1-81" }))
      .toContain("at most 80 PDF pages");
  });
});
