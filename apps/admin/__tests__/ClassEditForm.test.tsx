import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClassEditForm } from "../app/academic/classes/components/ClassEditForm";

describe("ClassEditForm", () => {
  const mockClassDoc = {
    _id: "class-1",
    name: "JSS 1A",
    level: "Secondary",
    gradeName: "JSS 1A",
    classLabel: "Olive Treasure",
    formTeacherId: "teacher-1",
    formTeacherName: "Mr. Ade",
    subjectNames: ["Mathematics", "English Language"],
    studentCount: 25,
    createdAt: Date.now(),
  };

  const mockSubjects = [
    { _id: "subj-1", name: "Mathematics", code: "MTH" },
    { _id: "subj-2", name: "English Language", code: "ENG" },
    { _id: "subj-3", name: "Basic Science", code: "BSC" },
  ];

  const mockTeachers = [
    { _id: "teacher-1", name: "Mr. Ade", email: "ade@school.test" },
    { _id: "teacher-2", name: "Mrs. Okon", email: "okon@school.test" },
  ];

  const mockOfferings = [
    { _id: "off-1", subjectId: "subj-1", subjectName: "Mathematics", subjectCode: "MTH" },
    { _id: "off-2", subjectId: "subj-2", subjectName: "English Language", subjectCode: "ENG" },
  ];

  it("initializes subjectIds from currentOfferings and preserves them when updating scalar fields", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn();
    const onClose = vi.fn();
    const onAssignTeacher = vi.fn().mockResolvedValue(undefined);

    render(
      <ClassEditForm
        classDoc={mockClassDoc}
        allSubjects={mockSubjects}
        allTeachers={mockTeachers}
        currentOfferings={mockOfferings}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onClose={onClose}
        onAssignTeacher={onAssignTeacher}
        isSaving={false}
      />
    );

    // Verify 2 subjects are selected
    expect(screen.getByText("2 Selected")).toBeInTheDocument();

    // Modify scalar field (Class Label)
    const labelInput = screen.getByDisplayValue("Olive Treasure");
    fireEvent.change(labelInput, { target: { value: "Olive Blossom" } });

    // Click save button
    const saveButton = screen.getByText("Save Blueprint Changes");
    fireEvent.click(saveButton);

    // Verify onUpdate received the preserved subjectIds (subj-1 and subj-2) and the new label
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      gradeName: "JSS 1A",
      classLabel: "Olive Blossom",
      level: "Secondary",
      formTeacherId: "teacher-1",
      subjectIds: ["subj-1", "subj-2"],
    });
  });

  it("initializes subjectIds asynchronously when currentOfferings resolves after scalar fields", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn();
    const onClose = vi.fn();
    const onAssignTeacher = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <ClassEditForm
        classDoc={mockClassDoc}
        allSubjects={mockSubjects}
        allTeachers={mockTeachers}
        currentOfferings={undefined}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onClose={onClose}
        onAssignTeacher={onAssignTeacher}
        isSaving={false}
      />
    );

    // Initially 0 selected before offerings resolve
    expect(screen.getByText("0 Selected")).toBeInTheDocument();

    // Offerings resolve
    rerender(
      <ClassEditForm
        classDoc={mockClassDoc}
        allSubjects={mockSubjects}
        allTeachers={mockTeachers}
        currentOfferings={mockOfferings}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onClose={onClose}
        onAssignTeacher={onAssignTeacher}
        isSaving={false}
      />
    );

    // Now 2 selected after offerings resolved
    expect(screen.getByText("2 Selected")).toBeInTheDocument();
  });
});
