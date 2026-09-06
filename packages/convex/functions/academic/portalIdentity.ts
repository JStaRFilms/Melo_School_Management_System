import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { resolveTokenFirstTrustedLegacyRow } from "./identityResolver";

export type PortalMembership = {
  user: Doc<"users">;
  role: "parent" | "student";
  membershipId: Id<"branchMemberships"> | null;
  isDefaultBranch: boolean;
};

export type PortalAuth = {
  memberships: PortalMembership[];
  canonicalPersonId: Id<"persons"> | null;
};

export type PortalStudentAccess = {
  student: Doc<"students">;
  relationship: string | null;
  portalMembership: PortalMembership;
};

function identityError(
  code: "FORBIDDEN" | "RECONCILIATION_REQUIRED",
  message: string,
) {
  return new ConvexError({ code, message });
}

async function getPortalRole(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<"parent" | "student" | null> {
  if (user.role === "student") return "student";
  if (user.role !== "parent") return null;
  const link = await ctx.db
    .query("familyMembers")
    .withIndex("by_parent_user", (q) => q.eq("parentUserId", user._id))
    .first();
  return link && link.schoolId === user.schoolId ? "parent" : null;
}

/** Canonical token -> person -> explicit active branch membership -> linked user. */
export async function resolvePortalMemberships(
  ctx: QueryCtx,
): Promise<PortalAuth> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw identityError("FORBIDDEN", "Unauthorized");

  const people = await ctx.db
    .query("persons")
    .withIndex("by_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  if (people.length > 1) {
    throw identityError(
      "RECONCILIATION_REQUIRED",
      "Ambiguous canonical identity; reviewed repair required",
    );
  }

  const person = people[0];
  if (person) {
    if (person.status !== "active") {
      throw identityError("FORBIDDEN", "Canonical account is inactive");
    }
    if (person.identityReconciliationState === "reconciliation_required") {
      throw identityError(
        "RECONCILIATION_REQUIRED",
        "Identity reconciliation required",
      );
    }
    const rows = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_status", (q) =>
        q.eq("personId", person._id).eq("status", "active"),
      )
      .take(101);
    if (rows.length > 100) {
      throw identityError(
        "RECONCILIATION_REQUIRED",
        "Portal branch memberships exceed supported bounds",
      );
    }

    const memberships: PortalMembership[] = [];
    for (const membership of rows) {
      if (!membership.legacyUserId) continue;
      const [school, user] = await Promise.all([
        ctx.db.get(membership.schoolId),
        ctx.db.get(membership.legacyUserId),
      ]);
      if (!school || school.status !== "active") continue;
      if (
        !user ||
        user.isArchived ||
        user.schoolId !== membership.schoolId ||
        user.personId !== person._id ||
        user.authTokenIdentifier !== identity.tokenIdentifier
      ) {
        throw identityError(
          "RECONCILIATION_REQUIRED",
          "Portal branch projection requires reviewed identity repair",
        );
      }
      const role = await getPortalRole(ctx, user);
      if (role) {
        memberships.push({
          user,
          role,
          membershipId: membership._id,
          isDefaultBranch: membership.isDefaultBranch,
        });
      }
    }
    if (!memberships.length) {
      throw identityError("FORBIDDEN", "No active family portal membership");
    }
    return { memberships, canonicalPersonId: person._id };
  }

  const legacy = await resolveTokenFirstTrustedLegacyRow<Doc<"users">>(
    identity,
    {
      byTokenIdentifier: (token) =>
        ctx.db
          .query("users")
          .withIndex("by_auth_token_identifier", (q) =>
            q.eq("authTokenIdentifier", token),
          )
          .take(2),
      bySubject: (subject) =>
        ctx.db
          .query("users")
          .withIndex("by_auth", (q) => q.eq("authId", subject))
          .take(2),
    },
  );
  if (!legacy || legacy.isArchived) {
    throw identityError("FORBIDDEN", "Unauthorized");
  }
  const role = await getPortalRole(ctx, legacy);
  if (!role) throw identityError("FORBIDDEN", "Unauthorized");
  const school = await ctx.db.get(legacy.schoolId);
  if (!school || school.status !== "active") {
    throw identityError("FORBIDDEN", "School workspace is inactive");
  }
  return {
    memberships: [
      {
        user: legacy,
        role,
        membershipId: null,
        isDefaultBranch: true,
      },
    ],
    canonicalPersonId: null,
  };
}

export async function getPortalStudentAccess(
  ctx: QueryCtx,
  portalAuth: PortalAuth,
): Promise<PortalStudentAccess[]> {
  const accessible: PortalStudentAccess[] = [];
  for (const membership of portalAuth.memberships) {
    if (membership.role === "student") {
      const students = await ctx.db
        .query("students")
        .withIndex("by_school_and_user", (q) =>
          q
            .eq("schoolId", membership.user.schoolId)
            .eq("userId", membership.user._id),
        )
        .take(101);
      if (students.length > 100) {
        throw identityError(
          "RECONCILIATION_REQUIRED",
          "Student enrollment history exceeds supported bounds",
        );
      }
      for (const student of students) {
        if (!student.isArchived) {
          accessible.push({
            student,
            relationship: null,
            portalMembership: membership,
          });
        }
      }
      continue;
    }

    const familyLinks = await ctx.db
      .query("familyMembers")
      .withIndex("by_parent_user", (q) =>
        q.eq("parentUserId", membership.user._id),
      )
      .take(101);
    if (familyLinks.length > 100) {
      throw identityError(
        "RECONCILIATION_REQUIRED",
        "Parent family links exceed supported bounds",
      );
    }
    for (const familyLink of familyLinks) {
      if (familyLink.schoolId !== membership.user.schoolId) continue;
      const familyStudents = await ctx.db
        .query("students")
        .withIndex("by_family", (q) => q.eq("familyId", familyLink.familyId))
        .take(101);
      if (familyStudents.length > 100) {
        throw identityError(
          "RECONCILIATION_REQUIRED",
          "Family student list exceeds supported bounds",
        );
      }
      for (const student of familyStudents) {
        if (
          student.schoolId === membership.user.schoolId &&
          !student.isArchived
        ) {
          accessible.push({
            student,
            relationship: familyLink.relationship ?? null,
            portalMembership: membership,
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  return accessible
    .filter((entry) => {
      const key = String(entry.student._id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const activeDifference =
        Number(right.student.enrollmentStatus === "active") -
        Number(left.student.enrollmentStatus === "active");
      if (activeDifference) return activeDifference;
      return (
        Number(right.portalMembership.isDefaultBranch) -
        Number(left.portalMembership.isDefaultBranch)
      );
    });
}

export async function resolvePortalStudentContext(
  ctx: QueryCtx,
  args: { studentId?: Id<"students"> | null } = {},
) {
  const portalAuth = await resolvePortalMemberships(ctx);
  const students = await getPortalStudentAccess(ctx, portalAuth);
  const selected = args.studentId
    ? students.find((entry) => entry.student._id === args.studentId)
    : students[0];
  if (!selected) throw new ConvexError("Student record not found");
  return {
    userId: selected.portalMembership.user._id,
    schoolId: selected.student.schoolId,
    role: selected.portalMembership.role,
    isSchoolAdmin: false as const,
    student: selected.student,
  };
}
