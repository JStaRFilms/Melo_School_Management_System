import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";

import {
  assertAdminForSchool,
  assertSchoolBoundary,
  assertTeacherAssignment,
  getAuthenticatedSchoolMembership,
} from "../auth";

function createCtx(options?: {
  identity?: { subject: string } | null;
  user?: { _id: string; schoolId: string; role: string } | null;
  assignmentExists?: boolean;
}) {
  const identity =
    options && "identity" in options ? options.identity : { subject: "auth-user-1" };
  const user =
    options && "user" in options
      ? options.user
      : ({
          _id: "user-1",
          schoolId: "school-1",
          role: "teacher",
        } as const);
  const assignmentExists = options?.assignmentExists ?? true;

  return {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query: (table: string) => ({
        withIndex: () => ({
          unique: async () => {
            if (table === "users") return user;
            if (table === "teacherAssignments") {
              return assignmentExists ? { _id: "assignment-1" } : null;
            }
            return null;
          },
        }),
      }),
      get: async (id: string) => {
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
    const ctx = createCtx({ assignmentExists: true });

    await expect(
      assertTeacherAssignment(ctx, "user-1", "class-1", "subject-1")
    ).resolves.toBeUndefined();
  });

  it("throws when no assignment exists", async () => {
    const ctx = createCtx({ assignmentExists: false });

    await expect(
      assertTeacherAssignment(ctx, "user-1", "class-1", "subject-1")
    ).rejects.toMatchObject({
      message: "Not assigned to this class-subject",
    });
  });
});

describe("assertAdminForSchool", () => {
  it("passes for an admin in the same school", async () => {
    const ctx = createCtx({
      user: { _id: "admin-1", schoolId: "school-1", role: "admin" },
    });

    await expect(
      assertAdminForSchool(ctx, "admin-1", "school-1", "admin")
    ).resolves.toBeUndefined();
  });

  it("throws when role is not admin", async () => {
    const ctx = createCtx();

    await expect(
      assertAdminForSchool(ctx, "user-1", "school-1", "teacher")
    ).rejects.toMatchObject({
      message: "Admin access required",
    });
  });

  it("throws on cross-school access", async () => {
    const ctx = createCtx({
      user: { _id: "admin-1", schoolId: "school-1", role: "admin" },
    });

    await expect(
      assertAdminForSchool(ctx, "admin-1", "school-2", "admin")
    ).rejects.toMatchObject({
      message: "Cross-school access denied",
    });
  });
});

describe("assertSchoolBoundary", () => {
  it("passes when the user belongs to the school", async () => {
    const ctx = createCtx();

    await expect(
      assertSchoolBoundary(ctx, "user-1", "school-1")
    ).resolves.toBeUndefined();
  });

  it("throws when the user belongs to a different school", async () => {
    const ctx = createCtx();

    await expect(
      assertSchoolBoundary(ctx, "user-1", "school-2")
    ).rejects.toMatchObject({
      message: "Cross-school access denied",
    });
  });
});
