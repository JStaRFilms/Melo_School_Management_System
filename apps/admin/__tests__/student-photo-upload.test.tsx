import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StudentPhotoPanel } from "../app/academic/students/components/StudentPhotoPanel";
import { uploadStudentPhoto } from "../app/academic/students/components/studentPhotoUpload";
import { StudentProfileEditor } from "../app/academic/students/components/StudentProfileEditor";
import { DepartureGuardProvider } from "@school/shared/drafts";

const mocks = vi.hoisted(() => ({
  updateStudent: vi.fn(),
  archiveStudent: vi.fn(),
  saveStudentPhoto: vi.fn(),
  getStudentProfile: {
    _id: "student-123",
    userId: "user-123",
    email: "student@example.test",
    name: "Alex Doe",
    displayName: "Alex Doe",
    firstName: "Alex",
    lastName: "Doe",
    admissionNumber: "ADM-100",
    classId: "class-1",
    className: "Grade 1",
    houseName: "Blue",
    gender: "Male",
    dateOfBirth: Date.UTC(2015, 4, 15),
    guardianName: "Jane Doe",
    guardianPhone: "+2348012345678",
    address: "123 Main St",
    photoUrl: "https://example.test/photo.jpg",
    photoFileName: "existing.jpg",
    photoContentType: "image/jpeg",
  },
}));

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: "school-1" },
      effectiveCapabilities: [],
    },
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    if (typeof reference === "string" && reference.endsWith(":getStudentProfile")) {
      return mocks.getStudentProfile;
    }
    return undefined;
  },
  useMutation: (reference: string) => {
    if (reference.endsWith(":updateStudent")) return mocks.updateStudent;
    if (reference.endsWith(":archiveStudent")) return mocks.archiveStudent;
    return vi.fn();
  },
  useAction: (reference: string) => {
    if (reference.endsWith(":saveStudentPhoto")) return mocks.saveStudentPhoto;
    return vi.fn();
  },
}));

vi.mock("../app/academic/students/components/studentPhotoCrop", () => ({
  cropStudentPhotoFile: vi.fn(async (file: File) => file),
}));

if (typeof File !== "undefined" && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = async function () {
    return new ArrayBuffer(this.size || 4);
  };
}

// Mock URL.createObjectURL and URL.revokeObjectURL
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
}

describe("Student Photo Upload & Controls", () => {
  it("uploadStudentPhoto validates file, extracts arrayBuffer, and calls saveStudentPhoto with expected args", async () => {
    const mockSave = vi.fn().mockResolvedValue(null);
    const content = new Uint8Array([1, 2, 3, 4]);
    const file = new File([content], "portrait.png", { type: "image/png" });
    if (!file.arrayBuffer) {
      file.arrayBuffer = async () => content.buffer;
    }

    await uploadStudentPhoto(file, "student-999", mockSave);

    expect(mockSave).toHaveBeenCalledOnce();
    const callArgs = mockSave.mock.calls[0][0];
    expect(callArgs.studentId).toBe("student-999");
    expect(callArgs.photoFileName).toBe("portrait.png");
    expect(callArgs.photoContentType).toBe("image/png");
    expect(callArgs.bytes).toBeDefined();
  });

  it("uploadStudentPhoto throws if file is invalid (e.g. non-image or oversized)", async () => {
    const mockSave = vi.fn();
    const file = new File(["not an image"], "document.pdf", { type: "application/pdf" });

    await expect(uploadStudentPhoto(file, "student-999", mockSave)).rejects.toThrow(
      "Student photo must be an image file.",
    );
    expect(mockSave).not.toHaveBeenCalled();

    const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], "large.png", { type: "image/png" });
    await expect(uploadStudentPhoto(largeFile, "student-999", mockSave)).rejects.toThrow(
      "Student photo must be 5 MB or smaller.",
    );
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("StudentPhotoPanel renders upload controls and does NOT show unavailable notice when uploadAvailable=true", () => {
    render(
      <StudentPhotoPanel
        name="John Doe"
        uploadAvailable={true}
        previewUrl={null}
        onPhotoChange={vi.fn()}
        onRemovePhoto={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Photo upload unavailable/i)).toBeNull();
    expect(screen.getByText("Upload Photo")).toBeDefined();
  });

  it("StudentPhotoPanel shows unavailable notice when uploadAvailable=false", () => {
    render(
      <StudentPhotoPanel
        name="John Doe"
        uploadAvailable={false}
        previewUrl={null}
        onPhotoChange={vi.fn()}
        onRemovePhoto={vi.fn()}
      />,
    );

    expect(screen.getByText(/Photo upload unavailable/i)).toBeDefined();
  });

  it("persisted photos without local source file do NOT show clear/remove trash button", () => {
    render(
      <StudentPhotoPanel
        name="John Doe"
        uploadAvailable={true}
        previewUrl="https://example.test/persisted.jpg"
        onPhotoChange={vi.fn()}
        onRemovePhoto={vi.fn()}
      />,
    );

    expect(screen.queryByTitle("Clear Selection")).toBeNull();
  });

  it("local unsaved photo selection DOES show Clear Selection button and clicking it clears local file", async () => {
    const onRemove = vi.fn();
    const file = new File([new Uint8Array([1, 2])], "local.png", { type: "image/png" });

    render(
      <StudentPhotoPanel
        name="John Doe"
        uploadAvailable={true}
        previewUrl={null}
        onPhotoChange={vi.fn()}
        onRemovePhoto={onRemove}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const clearBtn = await screen.findByTitle("Clear Selection");
    expect(clearBtn).toBeDefined();
    fireEvent.click(clearBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("StudentProfileEditor saves student without photo storage metadata, then uploads photo via saveStudentPhoto", async () => {
    mocks.updateStudent.mockResolvedValue(undefined);
    mocks.saveStudentPhoto.mockResolvedValue(null);
    const onNotice = vi.fn();

    render(
      <DepartureGuardProvider>
        <StudentProfileEditor
          studentId="student-123"
          classes={[{ _id: "class-1", name: "Grade 1", level: "P1" }]}
          onNotice={onNotice}
        />
      </DepartureGuardProvider>,
    );

    // Wait for student profile to load
    await screen.findByDisplayValue("Alex");

    // Select a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    const file = new File([new Uint8Array([1, 2, 3])], "new-photo.jpg", { type: "image/jpeg" });
    if (!file.arrayBuffer) {
      file.arrayBuffer = async () => new ArrayBuffer(3);
    }
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for crop/preparation to finish and Save button to be ready
    const saveButton = await screen.findByText("Save Identity");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.updateStudent).toHaveBeenCalledOnce();
    });

    const updatePayload = mocks.updateStudent.mock.calls[0][0];
    expect(updatePayload.photoStorageId).toBeUndefined();
    expect(updatePayload.photoFileName).toBeUndefined();
    expect(updatePayload.photoContentType).toBeUndefined();

    await waitFor(() => {
      expect(mocks.saveStudentPhoto).toHaveBeenCalledOnce();
    });
    const photoPayload = mocks.saveStudentPhoto.mock.calls[0][0];
    expect(photoPayload.studentId).toBe("student-123");
    expect(photoPayload.photoFileName).toBe("new-photo.jpg");
    expect(photoPayload.photoContentType).toBe("image/jpeg");
    expect(photoPayload.bytes).toBeDefined();

    expect(onNotice).toHaveBeenCalledWith({
      tone: "success",
      message: "Alex Doe updated.",
    });
  });
});
