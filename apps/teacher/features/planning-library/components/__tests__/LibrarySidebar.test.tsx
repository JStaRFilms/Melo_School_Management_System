import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("note")).toHaveTextContent("do not have permission to upload");
    expect(screen.queryByRole("button", { name: "Choose material file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload material" })).not.toBeInTheDocument();
  });

  it("renders upload controls only when upload authority is present", () => {
    render(<LibrarySidebar {...props} canUpload />);

    expect(screen.getByRole("button", { name: "Choose material file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload material" })).toBeDisabled();
  });

  it("submits a validated file through the shared upload form", async () => {
    const onUpload = vi.fn(async () => undefined);
    const { container } = render(
      <LibrarySidebar
        {...props}
        canUpload
        subjectsReady={[{ id: "subject-1", name: "Mathematics", code: "MTH" }]}
        levelOptions={[{ value: "JSS 1", label: "JSS 1" }]}
        onUpload={onUpload}
      />,
    );
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("File input was not rendered");
    const file = new File(["%PDF-test"], "assigned-source.pdf", {
      type: "application/octet-stream",
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
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        contentType: "application/pdf",
        title: "assigned source",
        subjectId: "subject-1",
        level: "JSS 1",
        topicLabel: "Algebra",
        uploadIntent: "private_draft",
      }),
    );
  });
});
