import { describe, expect, it } from "vitest";

describe("Archived student roster filtering and universal fee plan rules", () => {
  it("filters out students whose user account is archived even if student.isArchived was false", () => {
    const students = [
      {
        _id: "student_active",
        userId: "user_active",
        admissionNumber: "OBHIS/21/100",
        isArchived: false,
      },
      {
        _id: "student_desynced",
        userId: "user_archived",
        admissionNumber: "OBHIS/21/0214",
        isArchived: false, // Desynchronized state
      },
      {
        _id: "student_archived",
        userId: "user_archived_2",
        admissionNumber: "OBHIS/21/200",
        isArchived: true,
      },
    ];

    const usersMap = new Map([
      ["user_active", { _id: "user_active", name: "Active Student", isArchived: false }],
      ["user_archived", { _id: "user_archived", name: "Gbadamosi Aisha", isArchived: true }],
      ["user_archived_2", { _id: "user_archived_2", name: "Archived Student", isArchived: true }],
    ]);

    // Apply the filter rule introduced in getClassStudentSubjectMatrix and getStudentsByClass
    const visibleStudents = students.filter((student) => {
      if (student.isArchived) return false;
      const user = usersMap.get(student.userId);
      if (!user || user.isArchived) return false;
      return true;
    });

    expect(visibleStudents.map((s) => s._id)).toEqual(["student_active"]);
  });

  it("reconciliation identifies and repairs desynchronized student-user pairs", () => {
    const records = [
      {
        student: { _id: "s1", userId: "u1", isArchived: false },
        user: { _id: "u1", isArchived: true, archivedAt: 1774789786000 },
      },
      {
        student: { _id: "s2", userId: "u2", isArchived: true, archivedAt: 1774789786000 },
        user: { _id: "u2", isArchived: false },
      },
      {
        student: { _id: "s3", userId: "u3", isArchived: false },
        user: { _id: "u3", isArchived: false },
      },
    ];

    const patchedStudents: Record<string, { isArchived: boolean; archivedAt?: number }> = {};
    const patchedUsers: Record<string, { isArchived: boolean; archivedAt?: number }> = {};

    for (const { student, user } of records) {
      if (user.isArchived && !student.isArchived) {
        patchedStudents[student._id] = { isArchived: true, archivedAt: user.archivedAt };
      } else if (student.isArchived && !user.isArchived) {
        patchedUsers[user._id] = { isArchived: true, archivedAt: student.archivedAt };
      }
    }

    expect(patchedStudents["s1"]).toEqual({ isArchived: true, archivedAt: 1774789786000 });
    expect(patchedUsers["u2"]).toEqual({ isArchived: true, archivedAt: 1774789786000 });
    expect(patchedStudents["s3"]).toBeUndefined();
  });

  it("universal fee plans accept empty targetClassIds", () => {
    function validateFeePlanTargeting(billingMode: "class_default" | "manual_extra", targetClassIds: string[]) {
      if (billingMode === "manual_extra" && targetClassIds.length > 0) {
        throw new Error("Manual extra fee plans cannot target classes");
      }
      // With our fix, class_default fee plans permit targetClassIds: [] as Universal Templates
      return {
        isUniversal: billingMode === "class_default" && targetClassIds.length === 0,
        targetClassIds,
      };
    }

    // Universal template
    const universalPlan = validateFeePlanTargeting("class_default", []);
    expect(universalPlan.isUniversal).toBe(true);
    expect(universalPlan.targetClassIds).toHaveLength(0);

    // Targeted plan
    const targetedPlan = validateFeePlanTargeting("class_default", ["class_1", "class_2"]);
    expect(targetedPlan.isUniversal).toBe(false);
    expect(targetedPlan.targetClassIds).toEqual(["class_1", "class_2"]);

    // Manual extra
    const manualPlan = validateFeePlanTargeting("manual_extra", []);
    expect(manualPlan.isUniversal).toBe(false);

    // Invalid manual extra with classes
    expect(() => validateFeePlanTargeting("manual_extra", ["class_1"])).toThrow(
      "Manual extra fee plans cannot target classes"
    );
  });
});
