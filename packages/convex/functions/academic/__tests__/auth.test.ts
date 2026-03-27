import { describe, expect, it } from "vitest";
import type { Id, TableNames } from "../../../_generated/dataModel";

import {
  assertAdminForSchool,
  assertSchoolBoundary,
  assertTeacherAssignment,
  getTeacherAssignableClassIds,
  getTeacherAssignableSubjectIds,
  teacherHasClassAccess,
  getAuthenticatedSchoolMembership,
} from "../auth";

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}

function createCtx(options?: {
  identity?: { subject: string } | null;
  user?: {
    _id: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    email?: string;
    isArchived?: boolean;
  } | null;
  teacherAssignments?: Array<{
    schoolId: Id<"schools">;
    teacherId: Id<"users">;
    classId: Id<"classes">;
    subjectId: Id<"subjects">;
  }>;
  classSubjects?: Array<{
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    subjectId: Id<"subjects">;
    teacherId?: Id<"users"> | null;
  }>;
  classes?: Array<{
    _id: Id<"classes">;
    schoolId: Id<"schools">;
    formTeacherId?: Id<"users"> | null;
    isArchived?: boolean;
  }>;
  subjects?: Array<{
    _id: Id<"subjects">;
    schoolId: Id<"schools">;
    isArchived?: boolean;
  }>;
  schoolUsers?: Array<{
    _id: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    email: string;
  }>;
}) {
  const identity =
    options && "identity" in options ? options.identity : { subject: "auth-user-1" };
  const user =
    options && "user" in options
      ? options.user
      : ({
          _id: asId<"users">("user-1"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          email: "teacher@example.com",
        } as const);
  const teacherAssignments = options?.teacherAssignments ?? [
    {
      schoolId: asId<"schools">("school-1"),
      teacherId: asId<"users">("user-1"),
      classId: asId<"classes">("class-1"),
      subjectId: asId<"subjects">("subject-1"),
    },
  ];
  const classSubjects = options?.classSubjects ?? [];
  const explicitClasses = options?.classes ?? [
    {
      _id: asId<"classes">("class-1"),
      schoolId: asId<"schools">("school-1"),
      formTeacherId: null,
      isArchived: false,
    },
  ];
  const explicitSubjects = options?.subjects ?? [
    {
      _id: asId<"subjects">("subject-1"),
      schoolId: asId<"schools">("school-1"),
      isArchived: false,
    },
  ];
  const schoolUsers = options?.schoolUsers ?? [
    {
      _id: user?._id ?? asId<"users">("user-1"),
      schoolId: user?.schoolId ?? asId<"schools">("school-1"),
      role: user?.role ?? "teacher",
      email: "teacher@example.com",
    },
  ];
  const classMap = new Map(
    explicitClasses.map((classDoc) => [classDoc._id, classDoc])
  );
  const subjectMap = new Map(
    explicitSubjects.map((subjectDoc) => [subjectDoc._id, subjectDoc])
  );

  for (const assignment of teacherAssignments) {
    if (!classMap.has(assignment.classId)) {
      classMap.set(assignment.classId, {
        _id: assignment.classId,
        schoolId: assignment.schoolId,
        formTeacherId: null,
        isArchived: false,
      });
    }

    if (!subjectMap.has(assignment.subjectId)) {
      subjectMap.set(assignment.subjectId, {
        _id: assignment.subjectId,
        schoolId: assignment.schoolId,
        isArchived: false,
      });
    }
  }

  for (const offering of classSubjects) {
    if (!classMap.has(offering.classId)) {
      classMap.set(offering.classId, {
        _id: offering.classId,
        schoolId: offering.schoolId,
        formTeacherId: null,
        isArchived: false,
      });
    }

    if (!subjectMap.has(offering.subjectId)) {
      subjectMap.set(offering.subjectId, {
        _id: offering.subjectId,
        schoolId: offering.schoolId,
        isArchived: false,
      });
    }
  }

  const classes = [...classMap.values()];
  const subjects = [...subjectMap.values()];

  return {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query: (table: string) => ({
        withIndex: (indexName?: string, indexFilter?: (q: any) => any) => {
          const criteria: Record<string, unknown> = {};
          const query = {
            eq(field: string, value: unknown) {
              criteria[field] = value;
              return query;
            },
          };

          indexFilter?.(query);

          const matchesCriteria = (row: Record<string, unknown>) =>
            Object.entries(criteria).every(([field, value]) => row[field] === value);

          const filterRows = () => {
            if (table === "teacherAssignments") {
              return teacherAssignments.filter(matchesCriteria);
            }

            if (table === "classSubjects") {
              return classSubjects.filter(matchesCriteria);
            }

            if (table === "classes") {
              return classes.filter(matchesCriteria);
            }

            if (table === "subjects") {
              return subjects.filter(matchesCriteria);
            }

            if (table === "users") {
              return schoolUsers.filter(matchesCriteria);
            }

            return [];
          };

          return {
            collect: async () => filterRows(),
            unique: async () => {
              if (table === "users") return user;
              if (table === "classes") {
                const rows = filterRows();
                return rows[0] ?? null;
              }
              if (table === "subjects") {
                const rows = filterRows();
                return rows[0] ?? null;
              }
              const rows = filterRows();
              return rows[0] ?? null;
            },
          };
        },
      }),
      get: async (id: string) => {
        if (user && id === user._id) {
          return user;
        }

        const schoolUser = schoolUsers.find((candidate) => candidate._id === id);
        if (schoolUser) {
          return schoolUser;
        }

        const classDoc = classes.find((candidate) => candidate._id === id);
        if (classDoc) {
          return classDoc;
        }

        const subjectDoc = subjects.find((candidate) => candidate._id === id);
        if (subjectDoc) {
          return subjectDoc;
        }

        return null;
      },
    },
  };
}

describe("getAuthenticatedSchoolMembership", () => {
  it("returns userId, schoolId, and role for an authenticated user", async () => {
    const ctx = createCtx();
    await expect(getAuthenticatedSchoolMembership(ctx)).resolves.toEqual({
      userId: "user-1",
      schoolId: "school-1",
      role: "teacher",
    });
  });

  it("throws when the request is unauthenticated", async () => {
    const ctx = createCtx({ identity: null });

    await expect(getAuthenticatedSchoolMembership(ctx)).rejects.toMatchObject({
      message: "Unauthorized",
    });
  });

  it("throws when the auth user has no matching school membership", async () => {
    const ctx = createCtx({ user: null });

    await expect(getAuthenticatedSchoolMembership(ctx)).rejects.toMatchObject({
      message: "School membership not found",
    });
  });
});

describe("assertTeacherAssignment", () => {
  it("passes when an assignment exists", async () => {
    const ctx = createCtx();

    await expect(
      assertTeacherAssignment(
        ctx,
        asId<"users">("user-1"),
        asId<"classes">("class-1"),
        asId<"subjects">("subject-1")
      )
    ).resolves.toBeUndefined();
  });

  it("passes when the matching class-subject offering stores the teacher id", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-1"),
          teacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      assertTeacherAssignment(
        ctx,
        asId<"users">("user-1"),
        asId<"classes">("class-1"),
        asId<"subjects">("subject-1")
      )
    ).resolves.toBeUndefined();
  });

  it("passes when the teacher is the form teacher for the class and the subject is offered", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-1"),
        },
      ],
      classes: [
        {
          _id: asId<"classes">("class-1"),
          schoolId: asId<"schools">("school-1"),
          formTeacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      assertTeacherAssignment(
        ctx,
        asId<"users">("user-1"),
        asId<"classes">("class-1"),
        asId<"subjects">("subject-1")
      )
    ).resolves.toBeUndefined();
  });

  it("throws when no assignment exists", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-1"),
          teacherId: asId<"users">("user-2"),
        },
      ],
    });

    await expect(
      assertTeacherAssignment(
        ctx,
        asId<"users">("user-1"),
        asId<"classes">("class-1"),
        asId<"subjects">("subject-1")
      )
    ).rejects.toMatchObject({
      message: "Not assigned to this class-subject",
    });
  });
});

describe("teacher assignment helpers", () => {
  it("merges teacherAssignments and classSubjects when building class ids", async () => {
    const ctx = createCtx({
      teacherAssignments: [
        {
          schoolId: asId<"schools">("school-1"),
          teacherId: asId<"users">("user-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-1"),
        },
      ],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-2"),
          subjectId: asId<"subjects">("subject-2"),
          teacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      getTeacherAssignableClassIds(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1")
      )
    ).resolves.toEqual([
      asId<"classes">("class-1"),
      asId<"classes">("class-2"),
    ]);
  });

  it("includes form teacher classes when building class ids", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [],
      classes: [
        {
          _id: asId<"classes">("class-4"),
          schoolId: asId<"schools">("school-1"),
          formTeacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      getTeacherAssignableClassIds(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1")
      )
    ).resolves.toEqual([asId<"classes">("class-4")]);
  });

  it("merges teacherAssignments and classSubjects when building subject ids", async () => {
    const ctx = createCtx({
      teacherAssignments: [
        {
          schoolId: asId<"schools">("school-1"),
          teacherId: asId<"users">("user-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-1"),
        },
      ],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-2"),
          teacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      getTeacherAssignableSubjectIds(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1"),
        asId<"classes">("class-1")
      )
    ).resolves.toEqual([
      asId<"subjects">("subject-1"),
      asId<"subjects">("subject-2"),
    ]);
  });

  it("includes all offered subjects for a form teacher class", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-7"),
        },
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-1"),
          subjectId: asId<"subjects">("subject-8"),
        },
      ],
      classes: [
        {
          _id: asId<"classes">("class-1"),
          schoolId: asId<"schools">("school-1"),
          formTeacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      getTeacherAssignableSubjectIds(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1"),
        asId<"classes">("class-1")
      )
    ).resolves.toEqual([
      asId<"subjects">("subject-7"),
      asId<"subjects">("subject-8"),
    ]);
  });

  it("reports class access when the teacher is linked through classSubjects", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [
        {
          schoolId: asId<"schools">("school-1"),
          classId: asId<"classes">("class-3"),
          subjectId: asId<"subjects">("subject-3"),
          teacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      teacherHasClassAccess(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1"),
        asId<"classes">("class-3")
      )
    ).resolves.toBe(true);
  });

  it("reports class access when the teacher is the form teacher", async () => {
    const ctx = createCtx({
      teacherAssignments: [],
      classSubjects: [],
      classes: [
        {
          _id: asId<"classes">("class-5"),
          schoolId: asId<"schools">("school-1"),
          formTeacherId: asId<"users">("user-1"),
        },
      ],
    });

    await expect(
      teacherHasClassAccess(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1"),
        asId<"classes">("class-5")
      )
    ).resolves.toBe(true);
  });

  it("matches equivalent teacher rows with the same email in the same school", async () => {
    const ctx = createCtx({
      user: {
        _id: asId<"users">("user-1"),
        schoolId: asId<"schools">("school-1"),
        role: "teacher",
        email: "dorcas@school.test",
      },
      teacherAssignments: [],
      classSubjects: [],
      classes: [
        {
          _id: asId<"classes">("class-6"),
          schoolId: asId<"schools">("school-1"),
          formTeacherId: asId<"users">("legacy-teacher"),
        },
      ],
      schoolUsers: [
        {
          _id: asId<"users">("user-1"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          email: "dorcas@school.test",
        },
        {
          _id: asId<"users">("legacy-teacher"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          email: "dorcas@school.test",
        },
      ],
    });

    await expect(
      getTeacherAssignableClassIds(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1")
      )
    ).resolves.toEqual([asId<"classes">("class-6")]);
  });
});

describe("assertAdminForSchool", () => {
  it("passes for an admin in the same school", async () => {
    const ctx = createCtx({
      user: {
        _id: asId<"users">("admin-1"),
        schoolId: asId<"schools">("school-1"),
        role: "admin",
      },
    });

    await expect(
      assertAdminForSchool(
        ctx,
        asId<"users">("admin-1"),
        asId<"schools">("school-1"),
        "admin"
      )
    ).resolves.toBeUndefined();
  });

  it("throws when role is not admin", async () => {
    const ctx = createCtx();

    await expect(
      assertAdminForSchool(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1"),
        "teacher"
      )
    ).rejects.toMatchObject({
      message: "Admin access required",
    });
  });

  it("throws on cross-school access", async () => {
    const ctx = createCtx({
      user: {
        _id: asId<"users">("admin-1"),
        schoolId: asId<"schools">("school-1"),
        role: "admin",
      },
    });

    await expect(
      assertAdminForSchool(
        ctx,
        asId<"users">("admin-1"),
        asId<"schools">("school-2"),
        "admin"
      )
    ).rejects.toMatchObject({
      message: "Cross-school access denied",
    });
  });
});

describe("assertSchoolBoundary", () => {
  it("passes when the user belongs to the school", async () => {
    const ctx = createCtx();

    await expect(
      assertSchoolBoundary(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-1")
      )
    ).resolves.toBeUndefined();
  });

  it("throws when the user belongs to a different school", async () => {
    const ctx = createCtx();

    await expect(
      assertSchoolBoundary(
        ctx,
        asId<"users">("user-1"),
        asId<"schools">("school-2")
      )
    ).rejects.toMatchObject({
      message: "Cross-school access denied",
    });
  });
});
