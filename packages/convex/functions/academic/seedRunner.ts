import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";

const DEFAULT_ADMIN = {
  name: "Admin User",
  email: "admin@demo-academy.school",
  password: "Admin123!Pass",
  origin: "http://localhost:3002",
  role: "admin",
} as const;

const DEFAULT_TEACHER = {
  name: "Teacher User",
  email: "teacher@demo-academy.school",
  password: "Teacher123!Pass",
  origin: "http://localhost:3001",
  role: "teacher",
} as const;

type SeedIds = {
  schoolId: Id<"schools">;
  adminUserId: Id<"users">;
  teacherUserId: Id<"users">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  classId: Id<"classes">;
  subjectIds: Id<"subjects">[];
  studentIds: Id<"students">[];
  settingsId: Id<"schoolAssessmentSettings">;
  gradingBandIds: Id<"gradingBands">[];
  assessmentRecordIds: Id<"assessmentRecords">[];
};

type SeedAuthUser = {
  name: string;
  email: string;
  password: string;
  origin: string;
};

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensureAuthUser(
  authBaseUrl: string,
  user: SeedAuthUser
): Promise<string> {
  const signUpResponse = await fetch(`${authBaseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: user.origin,
    },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        password: user.password,
      }),
  });
  const signUpPayload = await readJsonSafe(signUpResponse);

  if (signUpResponse.ok && signUpPayload?.user?.id) {
    return signUpPayload.user.id;
  }

  if (
    signUpResponse.status === 422 &&
    signUpPayload?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    const signInResponse = await fetch(`${authBaseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: user.origin,
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
      }),
    });
    const signInPayload = await readJsonSafe(signInResponse);

    if (signInResponse.ok && signInPayload?.user?.id) {
      return signInPayload.user.id;
    }

    throw new ConvexError(
      `Existing auth user for ${user.email} could not sign in.`
    );
  }

  throw new ConvexError(
    `Failed to create auth user for ${user.email}: ${
      signUpPayload?.message ?? signUpResponse.statusText
    }`
  );
}

export const seedExamRecordingData = action({
  args: {
    adminName: v.optional(v.string()),
    adminEmail: v.optional(v.string()),
    adminPassword: v.optional(v.string()),
    teacherName: v.optional(v.string()),
    teacherEmail: v.optional(v.string()),
    teacherPassword: v.optional(v.string()),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    adminUserId: v.id("users"),
    teacherUserId: v.id("users"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectIds: v.array(v.id("subjects")),
    studentIds: v.array(v.id("students")),
    settingsId: v.id("schoolAssessmentSettings"),
    gradingBandIds: v.array(v.id("gradingBands")),
    assessmentRecordIds: v.array(v.id("assessmentRecords")),
    adminAuthId: v.string(),
    teacherAuthId: v.string(),
    adminEmail: v.string(),
    teacherEmail: v.string(),
    adminPassword: v.string(),
    teacherPassword: v.string(),
  }),
  handler: async (ctx, args) => {
    const authBaseUrl = process.env.CONVEX_SITE_URL?.trim();
    if (!authBaseUrl) {
      throw new ConvexError(
        "CONVEX_SITE_URL is not configured on the Convex deployment."
      );
    }

    const admin = {
      name: args.adminName ?? DEFAULT_ADMIN.name,
      email: args.adminEmail ?? DEFAULT_ADMIN.email,
      password: args.adminPassword ?? DEFAULT_ADMIN.password,
      origin: DEFAULT_ADMIN.origin,
    };
    const teacher = {
      name: args.teacherName ?? DEFAULT_TEACHER.name,
      email: args.teacherEmail ?? DEFAULT_TEACHER.email,
      password: args.teacherPassword ?? DEFAULT_TEACHER.password,
      origin: DEFAULT_TEACHER.origin,
    };

    const adminAuthId = await ensureAuthUser(authBaseUrl, admin);
    const teacherAuthId = await ensureAuthUser(authBaseUrl, teacher);

    const seeded: SeedIds = await ctx.runMutation(
      internal.functions.academic.seed.seedExamRecordingDataInternal,
      {
        adminAuthId,
        teacherAuthId,
      }
    );

    return {
      ...seeded,
      adminAuthId,
      teacherAuthId,
      adminEmail: admin.email,
      teacherEmail: teacher.email,
      adminPassword: admin.password,
      teacherPassword: teacher.password,
    };
  },
});
