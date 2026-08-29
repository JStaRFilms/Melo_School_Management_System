import { describe, expect, it } from "vitest";

describe("student graduation lifecycle and attestation rules", () => {
  const session2025 = {
    _id: "session_2025_2026",
    name: "2025/2026 Academic Session",
    startDate: new Date(2025, 8, 1).getTime(),
    endDate: new Date(2026, 6, 20).getTime(),
    isActive: true,
  };

  const session2026 = {
    _id: "session_2026_2027",
    name: "2026/2027 Academic Session",
    startDate: new Date(2026, 8, 1).getTime(),
    endDate: new Date(2027, 6, 20).getTime(),
    isActive: true,
  };

  const graduatingClass = {
    _id: "class_sss3_gold",
    name: "SSS 3 Gold",
  };

  const mockGraduatedStudent = {
    _id: "student_001",
    admissionNumber: "ADM/2020/084",
    classId: graduatingClass._id,
    enrollmentStatus: "graduated",
    graduatedAt: new Date(2026, 6, 20).getTime(),
    graduatingSessionId: session2025._id,
    graduatingClassId: graduatingClass._id,
    isArchived: false,
  };

  const mockActiveStudent = {
    _id: "student_002",
    admissionNumber: "ADM/2023/112",
    classId: graduatingClass._id,
    enrollmentStatus: "active",
    isArchived: false,
  };

  function filterBaselineRosterForSession(
    students: typeof mockGraduatedStudent[],
    targetSession: typeof session2025,
    sessionMap: Record<string, typeof session2025>
  ) {
    return students.filter((student) => {
      if (student.isArchived) return false;
      if (student.enrollmentStatus === "graduated" && student.graduatingSessionId) {
        const gradSession = sessionMap[student.graduatingSessionId];
        if (gradSession && targetSession.startDate > gradSession.startDate) {
          // Exclude graduated students in any subsequent academic sessions
          return false;
        }
      }
      return true;
    });
  }

  it("retains graduated student in the graduating session roster (2025/2026)", () => {
    const sessionMap = {
      [session2025._id]: session2025,
      [session2026._id]: session2026,
    };

    const roster2025 = filterBaselineRosterForSession(
      [mockGraduatedStudent, mockActiveStudent as any],
      session2025,
      sessionMap
    );

    expect(roster2025.map((s) => s._id)).toContain("student_001");
    expect(roster2025.map((s) => s._id)).toContain("student_002");
    expect(roster2025).toHaveLength(2);
  });

  it("automatically excludes graduated student from subsequent session rosters (2026/2027)", () => {
    const sessionMap = {
      [session2025._id]: session2025,
      [session2026._id]: session2026,
    };

    const roster2026 = filterBaselineRosterForSession(
      [mockGraduatedStudent, mockActiveStudent as any],
      session2026,
      sessionMap
    );

    expect(roster2026.map((s) => s._id)).not.toContain("student_001");
    expect(roster2026.map((s) => s._id)).toContain("student_002");
    expect(roster2026).toHaveLength(1);
  });

  it("formats attestation reference codes consistently", () => {
    const schoolSlug = "green-valley-high";
    const admissionNumber = "GVH/2020/0042";
    const issuedAt = new Date(2026, 7, 15).getTime();

    const cleanSlug = schoolSlug.toUpperCase().slice(0, 4);
    const cleanAdm = admissionNumber.replace(/[^A-Za-z0-9]/g, "");
    const year = new Date(issuedAt).getFullYear();

    const referenceCode = `ATT-${cleanSlug}-${cleanAdm}-${year}`;

    expect(referenceCode).toBe("ATT-GREE-GVH20200042-2026");
  });
});
