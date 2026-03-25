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
  user?: { _id: Id<"users">; schoolId: Id<"schools">; role: string } | null;
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

            return [];
          };

          return {
            collect: async () => filterRows(),
            unique: async () => {
              if (table === "users") return user;
              const rows = filterRows();
              return rows[0] ?? null;
            },
          };
        },
      }),
      get: async (id: Id<"users">) => {
        if (!user || id !== user._id) return null;
        return user;
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
