import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeMaterialUploadForm,
  type KnowledgeMaterialUploadReadiness,
} from "@school/shared";

const readiness: KnowledgeMaterialUploadReadiness = {
  isLoading: false,
  hasPlanningPermission: true,
  hasUploadPermission: true,
  hasAssignedContext: true,
  supportsDuplicateProtection: true,
  storageStatus: "ready",
  availableBytes: 12 * 1024 * 1024,
  allocatedBytes: 12 * 1024 * 1024,
  maxFileSizeBytes: 12 * 1024 * 1024,
  maxPagesPerOperation: 80,
};

function renderUploadForm() {
  return render(
    <KnowledgeMaterialUploadForm
      subjects={[]}
      levelOptions={[]}
      isAdmin
      isUploading={false}
      readiness={readiness}
      checkDuplicate={vi.fn().mockResolvedValue(false)}
      onUpload={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

describe("KnowledgeMaterialUploadForm drag and drop", () => {
  it("accepts a supported dropped file and derives its title", () => {
    renderUploadForm();
    const dropTarget = screen.getByRole("button", { name: "Choose material file" });
    const file = new File(["lesson notes"], "motion-and-forces.txt", { type: "text/plain" });

    fireEvent.dragEnter(dropTarget, { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText("Drop the file here")).toBeInTheDocument();

    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [file], types: ["Files"] },
    });

    expect(screen.getByText("motion-and-forces.txt")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("motion and forces");
  });

  it("resets the picker so a previously chosen file can be selected again after a drop", () => {
    renderUploadForm();
    const dropTarget = screen.getByRole("button", { name: "Choose material file" });
    const input = dropTarget.querySelector<HTMLInputElement>("input[type=file]");
    if (!input) throw new Error("Missing file input");
    const first = new File(["first"], "first.txt", { type: "text/plain" });
    const second = new File(["second"], "second.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [first] } });
    Object.defineProperty(input, "value", { configurable: true, writable: true, value: "C:\\fakepath\\first.txt" });
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [second], types: ["Files"] },
    });

    expect(input.value).toBe("");
    expect(screen.getByText("second.txt")).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [first] } });
    expect(screen.getByText("first.txt")).toBeInTheDocument();
  });

  it("shows the existing validation error for an unsupported dropped file", () => {
    renderUploadForm();
    const dropTarget = screen.getByRole("button", { name: "Choose material file" });
    const file = new File(["data"], "archive.zip", { type: "application/zip" });

    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [file], types: ["Files"] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a supported PDF, Office document, text file, or image.",
    );
  });

  it("ignores non-file drops without clearing the selected file", () => {
    renderUploadForm();
    const dropTarget = screen.getByRole("button", { name: "Choose material file" });
    const file = new File(["lesson notes"], "motion.txt", { type: "text/plain" });

    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [], types: ["text/plain"] },
    });

    expect(screen.getByText("motion.txt")).toBeInTheDocument();
  });
});
