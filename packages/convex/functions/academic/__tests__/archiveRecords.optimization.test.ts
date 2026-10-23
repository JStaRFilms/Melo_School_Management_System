import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../_generated/dataModel";
import { listArchivedRecords } from "../archiveRecords";
import type { QueryCtx } from "../../../_generated/server";
import { queryHandler } from "./readMetrics";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const adminIdentity = {
  subject: "archive-opt-admin",
  tokenIdentifier: "https://auth.school.test|archive-opt-admin",
};

const teacherIdentity = {
  subject: "archive-opt-teacher",
  tokenIdentifier: "https://auth.school.test|archive-opt-teacher",
};

/** Test-only query/get calls and returned documents, not scanned rows or billing metrics. */
type ReadLog = {
  queries: Record<string, number>;
  gets: Record<string, number>;
  docsRead: Record<string, number>;
};

const TERMINAL_METHODS = new Set(["collect", "take", "unique", "first", "get"]);

function createReadLog(): ReadLog {
  return { queries: {}, gets: {}, docsRead: {} };
}

function queryCount(log: ReadLog, table: string): number {
  return log.queries[table] ?? 0;
}

function getCallCount(log: ReadLog, table: string): number {
  return log.gets[table] ?? 0;
}

function docsRead(log: ReadLog, table: string): number {
  return log.docsRead[table] ?? 0;
}

function bump(bucket: Record<string, number>, table: string) {
  bucket[table] = (bucket[table] ?? 0) + 1;
}

function wrapQueryObject(member: object, table: string, log: ReadLog): unknown {
  return new Proxy(member, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return wrapReadResult(result, table, log, String(prop));
      };
    },
  });
}

function wrapReadResult(result: unknown, table: string, log: ReadLog, method: string): unknown {
  if (result instanceof Promise) {
    if (!TERMINAL_METHODS.has(method)) return result;
    return result.then((rows) => {
      if (Array.isArray(rows)) {
        log.docsRead[table] = (log.docsRead[table] ?? 0) + rows.length;
      } else if (rows !== null && rows !== undefined) {
        bump(log.docsRead, table);
      }
      return rows;
    });
  }
  if (typeof result === "object" && result !== null) return wrapQueryObject(result, table, log);
  return result;
}

const archiveHandler = queryHandler(listArchivedRecords);
type ArchiveResult = Awaited<ReturnType<typeof archiveHandler>>;

function withSpiedDb(ctx: QueryCtx, log: ReadLog): QueryCtx {
  const rawDb = ctx.db;
  const spyDb = new Proxy(rawDb, {
    get(target, prop, receiver) {
      if (prop === "query") {
        return (table: string, ...args: unknown[]) => {
          bump(log.queries, table);
          const run: unknown = Reflect.get(target, prop);
          if (typeof run !== "function") throw Error("Missing database query method");
          return wrapReadResult(Reflect.apply(run, target, [table, ...args]), table, log, "query");
        };
      }
      if (prop === "get") {
        return (table: string, id: string) => {
          bump(log.gets, table);
          const run: unknown = Reflect.get(target, prop);
          if (typeof run !== "function") throw Error("Missing database get method");
          return wrapReadResult(Reflect.apply(run, target, [table, id]), table, log, "get");
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return new Proxy(ctx, {
    get(target, prop, receiver) {
      if (prop === "db") return spyDb;
      return Reflect.get(target, prop, receiver);
    },
  });
}

async function listWithReadLog(
  t: ReturnType<typeof convexTest>,
  identity: { subject: string; tokenIdentifier: string },
) {
  return await t.withIdentity(identity).run(async (ctx) => {
    const log = createReadLog();
    let failureMessage: string | null = null;
    let outcome: ArchiveResult | undefined;
    try {
      outcome = await archiveHandler(withSpiedDb(ctx, log), {});
    } catch (error) {
      failureMessage = error instanceof Error ? error.message : String(error);
    }
    return { outcome, failureMessage, log };
  });
}

async function seedSchoolWithAdmin(ctx: Parameters<Parameters<ReturnType<typeof convexTest>["run"]>[0]>[0], slug: string) {
  const now = 1000;
  const schoolId = await ctx.db.insert("schools", {
    name: "Archive Opt School",
    slug,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const adminId = await ctx.db.insert("users", {
    schoolId,
    authId: adminIdentity.subject,
    authTokenIdentifier: adminIdentity.tokenIdentifier,
    name: "Archive Opt Admin",
    email: "admin@archive-opt.test",
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });
  return { schoolId, adminId, now };
}

describe("listArchivedRecords read scoping", () => {
  it("an empty archive reads only the base datasets and skips all history collections", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await seedSchoolWithAdmin(ctx, "archive-opt-empty");
    });
    const { outcome, failureMessage, log } = await listWithReadLog(t, adminIdentity);

    expect(failureMessage).toBeNull();
    expect(outcome).toEqual({
      summary: {
        totalArchived: 0,
        archivedAdmins: 0,
        archivedSessions: 0,
        archivedClasses: 0,
        archivedTeachers: 0,
        archivedSubjects: 0,
        archivedStudents: 0,
        archivedEvents: 0,
        archivedKnowledgeMaterials: 0,
      },
      records: [],
    });

    expect(queryCount(log, "academicSessions")).toBe(1);
    expect(queryCount(log, "classes")).toBe(1);
    expect(queryCount(log, "subjects")).toBe(1);
    expect(queryCount(log, "schoolEvents")).toBe(1);
    expect(queryCount(log, "students")).toBe(1);
    expect(queryCount(log, "knowledgeMaterials")).toBe(1);
    expect(queryCount(log, "users")).toBeGreaterThanOrEqual(1);

    expect(queryCount(log, "academicTerms")).toBe(0);
    expect(queryCount(log, "classSubjects")).toBe(0);
    expect(queryCount(log, "teacherAssignments")).toBe(0);
    expect(queryCount(log, "studentSubjectSelections")).toBe(0);
    expect(queryCount(log, "assessmentRecords")).toBe(0);
    expect(getCallCount(log, "knowledgeTopics")).toBe(0);
  });

  it("an event-only archive avoids every supporting-collection read", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { schoolId, adminId, now } = await seedSchoolWithAdmin(ctx, "archive-opt-events");
      await ctx.db.insert("schoolEvents", {
        schoolId,
        title: "Prize Giving",
        startDate: 1100,
        endDate: 1200,
        isAllDay: true,
        isArchived: true,
        archivedAt: 900,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
    });
    const { outcome, failureMessage, log } = await listWithReadLog(t, adminIdentity);

    expect(failureMessage).toBeNull();
    expect(outcome?.summary.archivedEvents).toBe(1);
    expect(outcome?.summary.totalArchived).toBe(1);
    expect(outcome?.records[0].type).toBe("event");
    expect(outcome?.records[0].name).toBe("Prize Giving");

    expect(queryCount(log, "academicTerms")).toBe(0);
    expect(queryCount(log, "classSubjects")).toBe(0);
    expect(queryCount(log, "teacherAssignments")).toBe(0);
    expect(queryCount(log, "studentSubjectSelections")).toBe(0);
    expect(queryCount(log, "assessmentRecords")).toBe(0);
    expect(getCallCount(log, "knowledgeTopics")).toBe(0);
  });

  it("a material-only archive dedupes topic reads and falls back to topicLabel across schools", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { schoolId, adminId, now } = await seedSchoolWithAdmin(ctx, "archive-opt-materials");
      const otherSchoolId = await ctx.db.insert("schools", {
        name: "Other Archive School",
        slug: "other-archive-opt-materials",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const subjectA = await ctx.db.insert("subjects", {
        schoolId,
        name: "Subject A",
        code: "SUB-A",
        createdAt: now,
        updatedAt: now,
      });
      const subjectB = await ctx.db.insert("subjects", {
        schoolId: otherSchoolId,
        name: "Other School Subject",
        code: "SUB-B",
        createdAt: now,
        updatedAt: now,
      });
      const ownerUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-owner",
        authTokenIdentifier: "https://auth.school.test|archive-opt-owner",
        name: "Archive Opt Owner",
        email: "owner@archive-opt.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      const sessionA = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "Active Session",
        startDate: 1100,
        endDate: 1200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termA = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: sessionA,
        name: "Active Term",
        startDate: 1100,
        endDate: 1200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const sessionB = await ctx.db.insert("academicSessions", {
        schoolId: otherSchoolId,
        name: "Other Session",
        startDate: 1100,
        endDate: 1200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termB = await ctx.db.insert("academicTerms", {
        schoolId: otherSchoolId,
        sessionId: sessionB,
        name: "Other Term",
        startDate: 1100,
        endDate: 1200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const topicHere = await ctx.db.insert("knowledgeTopics", {
        schoolId,
        subjectId: subjectA,
        level: "JSS 1",
        termId: termA,
        title: "Photosynthesis core",
        slug: "photosynthesis-core",
        searchText: "photosynthesis core",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      const topicOtherSchool = await ctx.db.insert("knowledgeTopics", {
        schoolId: otherSchoolId,
        subjectId: subjectB,
        level: "JSS 1",
        termId: termB,
        title: "Foreign topic",
        slug: "foreign-topic",
        searchText: "foreign topic",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });

      const insertMaterial = (
        title: string,
        reviewStatus: "archived" | "approved",
        topicId?: Id<"knowledgeTopics">,
        topicLabel = "Fallback label",
        updatedAt = now,
      ) =>
        ctx.db.insert("knowledgeMaterials", {
          schoolId,
          ownerUserId,
          ownerRole: "teacher",
          sourceType: "text_entry",
          visibility: "private_owner",
          reviewStatus,
          title,
          level: "JSS 1",
          topicLabel,
          topicId,
          searchStatus: "not_indexed",
          searchText: title,
          processingStatus: "ready",
          ingestionErrorMessage: null,
          ingestionAttemptCount: 0,
          labelSuggestions: [],
          chunkCount: 2,
          indexedAt: null,
          createdAt: now,
          updatedAt,
          createdBy: ownerUserId,
          updatedBy: ownerUserId,
        });

      await insertMaterial("Archived one", "archived", topicHere, "Primary topic", 900);
      await insertMaterial("Archived two", "archived", topicHere, "Primary topic", 901);
      await insertMaterial("Archived cross", "archived", topicOtherSchool, "Cross label", 902);
      await insertMaterial("Still approved", "approved", undefined, "Approved label", 903);
    });

    const { outcome, failureMessage, log } = await listWithReadLog(t, adminIdentity);

    expect(failureMessage).toBeNull();
    expect(outcome?.summary.archivedKnowledgeMaterials).toBe(3);
    expect(outcome?.summary.totalArchived).toBe(3);
    expect(outcome?.records.map((record) => record.type)).toEqual([
      "knowledgeMaterial",
      "knowledgeMaterial",
      "knowledgeMaterial",
    ]);

    // Three archived materials share two distinct topics: exactly one point
    // read per distinct id (naive per-material reads would be three), and the
    // school-scoped topic query is gone. The cross-school topic is read and
    // filtered away in memory, after which the label falls back to topicLabel.
    expect(queryCount(log, "knowledgeTopics")).toBe(0);
    expect(getCallCount(log, "knowledgeTopics")).toBe(2);
    expect(docsRead(log, "knowledgeTopics")).toBe(2);

    const topicFields = outcome?.records.map(
      (record) =>
        record.detailFields.find((field) => field.label === "Topic")?.value,
    );
    expect(topicFields).toEqual(["Cross label", "Photosynthesis core", "Photosynthesis core"]);

    expect(queryCount(log, "academicTerms")).toBe(0);
    expect(queryCount(log, "classSubjects")).toBe(0);
    expect(queryCount(log, "teacherAssignments")).toBe(0);
    expect(queryCount(log, "studentSubjectSelections")).toBe(0);
    expect(queryCount(log, "assessmentRecords")).toBe(0);
  });

  it("a mixed archive skips nothing useful, isolates corrupt cross-school rows, and redacts locked scoring sessions", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { schoolId, adminId, now } = await seedSchoolWithAdmin(ctx, "archive-opt-mixed");
      const otherSchoolId = await ctx.db.insert("schools", {
        name: "Archive Opt Other School",
        slug: "other-archive-opt-mixed",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const teacherArchived = await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-teacher-archived",
        authTokenIdentifier: "https://auth.school.test|archive-opt-teacher-archived",
        name: "Teacher T1",
        email: "t1@archive-opt.test",
        role: "teacher",
        isArchived: true,
        archivedAt: 400,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-teacher-active",
        authTokenIdentifier: "https://auth.school.test|archive-opt-teacher-active",
        name: "Teacher T2",
        email: "t2@archive-opt.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      const ownerUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-material-owner",
        authTokenIdentifier: "https://auth.school.test|archive-opt-material-owner",
        name: "Archive Opt Owner",
        email: "owner@archive-opt.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      const studentUser1 = await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-student-1",
        authTokenIdentifier: "https://auth.school.test|archive-opt-student-1",
        name: "Student One",
        email: "s1@archive-opt.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const studentUser2 = await ctx.db.insert("users", {
        schoolId,
        authId: "archive-opt-student-2",
        authTokenIdentifier: "https://auth.school.test|archive-opt-student-2",
        name: "Student Two",
        email: "s2@archive-opt.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });

      const lockedSession = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "Locked Archived Session",
        startDate: 1700000000000,
        endDate: 1710000000000,
        isActive: false,
        isArchived: true,
        archivedAt: 700,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      const openArchivedSession = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "Open Archived Session",
        startDate: 1700000000000,
        endDate: 1710000000000,
        isActive: false,
        isArchived: true,
        archivedAt: 800,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("academicSessions", {
        schoolId,
        name: "Active Session",
        startDate: 1700000000000,
        endDate: 1710000000000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const termLocked = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: lockedSession,
        name: "Term One",
        startDate: 1700000000000,
        endDate: 1702000000000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termOpen = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: openArchivedSession,
        name: "Term Two",
        startDate: 1700000000000,
        endDate: 1702000000000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      // Same linked sessionId, wrong tenant: only the reader's filter keeps this out.
      await ctx.db.insert("academicTerms", {
        schoolId: otherSchoolId,
        sessionId: lockedSession,
        name: "Foreign term sharing a linked session",
        startDate: 1700000000000,
        endDate: 1702000000000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const classLocked = await ctx.db.insert("classes", {
        schoolId,
        name: "Class Locked",
        level: "JSS 1",
        formTeacherId: teacherArchived,
        isArchived: true,
        archivedAt: 600,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      const classOpen = await ctx.db.insert("classes", {
        schoolId,
        name: "Class Open",
        level: "JSS 2",
        isArchived: true,
        archivedAt: 650,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("classes", {
        schoolId,
        name: "Class Active",
        level: "JSS 3",
        createdAt: now,
        updatedAt: now,
      });

      const subjectArchived = await ctx.db.insert("subjects", {
        schoolId,
        name: "Subject A",
        code: "SUB-A",
        isArchived: true,
        archivedAt: 500,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      const subjectOpen = await ctx.db.insert("subjects", {
        schoolId,
        name: "Subject B",
        code: "SUB-B",
        createdAt: now,
        updatedAt: now,
      });

      const student1 = await ctx.db.insert("students", {
        schoolId,
        classId: classOpen,
        userId: studentUser1,
        admissionNumber: "ADM-001",
        isArchived: true,
        archivedAt: 300,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      const student2 = await ctx.db.insert("students", {
        schoolId,
        classId: classLocked,
        userId: studentUser2,
        admissionNumber: "ADM-002",
        isArchived: true,
        archivedAt: 350,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("classSubjects", {
        schoolId,
        classId: classOpen,
        subjectId: subjectArchived,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("classSubjects", {
        schoolId,
        classId: classOpen,
        subjectId: subjectOpen,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("classSubjects", {
        schoolId,
        classId: classLocked,
        subjectId: subjectOpen,
        teacherId: teacherArchived,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("teacherAssignments", {
        schoolId,
        teacherId: teacherArchived,
        classId: classOpen,
        subjectId: subjectOpen,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("teacherAssignments", {
        schoolId: otherSchoolId,
        teacherId: teacherArchived,
        classId: classLocked,
        subjectId: subjectArchived,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId: student1,
        classId: classOpen,
        subjectId: subjectOpen,
        sessionId: openArchivedSession,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId: student2,
        classId: classLocked,
        subjectId: subjectOpen,
        sessionId: lockedSession,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId: otherSchoolId,
        studentId: student1,
        classId: classOpen,
        subjectId: subjectOpen,
        sessionId: lockedSession,
        createdAt: now,
        updatedAt: now,
      });

      const assessment = (
        sessionId: Id<"academicSessions">,
        termId: Id<"academicTerms">,
        classId: Id<"classes">,
        subjectId: Id<"subjects">,
        studentId: Id<"students">,
      ) =>
        ctx.db.insert("assessmentRecords", {
          schoolId,
          sessionId,
          termId,
          classId,
          subjectId,
          studentId,
          ca1: 20,
          ca2: 10,
          ca3: 5,
          examRawScore: 30,
          examScaledScore: 30,
          total: 65,
          gradeLetter: "A",
          remark: "Great",
          examInputModeSnapshot: "raw40",
          examRawMaxSnapshot: 40,
          status: "draft",
          enteredBy: adminId,
          updatedBy: adminId,
          createdAt: now,
          updatedAt: now,
        });
      await assessment(lockedSession, termLocked, classLocked, subjectArchived, student2);
      await assessment(openArchivedSession, termOpen, classOpen, subjectOpen, student1);
      await assessment(openArchivedSession, termOpen, classOpen, subjectArchived, student1);

      await ctx.db.insert("sessionScoringRegradeJobs", {
        schoolId,
        sessionId: lockedSession,
        phase: "regrading",
        policy: { ca1Max: 20, ca2Max: 10, ca3Max: 10, examRawMax: 60, examContributionMax: 40 },
        before: { ca1Max: 20, ca2Max: 10, ca3Max: 10, examRawMax: 40, examContributionMax: 40 },
        expectedVersion: 1,
        scanned: 0,
        batchSize: 10,
        invalidCount: 0,
        invalidExamples: [],
        updated: now,
        startedAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });

      await ctx.db.insert("schoolEvents", {
        schoolId,
        title: "Prize Giving",
        startDate: 1100,
        endDate: 1200,
        isAllDay: true,
        isArchived: true,
        archivedAt: 900,
        archivedBy: adminId,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });

      const knowledgeTopic = await ctx.db.insert("knowledgeTopics", {
        schoolId,
        subjectId: subjectOpen,
        level: "JSS 1",
        termId: termOpen,
        title: "Photosynthesis core",
        slug: "photosynthesis-core",
        searchText: "photosynthesis core",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      await ctx.db.insert("knowledgeMaterials", {
        schoolId,
        ownerUserId,
        ownerRole: "teacher",
        sourceType: "text_entry",
        visibility: "private_owner",
        reviewStatus: "archived",
        title: "Archived Material",
        level: "JSS 1",
        topicLabel: "Primary topic",
        topicId: knowledgeTopic,
        searchStatus: "not_indexed",
        searchText: "Archived Material",
        processingStatus: "ready",
        ingestionErrorMessage: null,
        ingestionAttemptCount: 0,
        labelSuggestions: [],
        chunkCount: 2,
        indexedAt: null,
        createdAt: now,
        updatedAt: 200,
        createdBy: ownerUserId,
        updatedBy: ownerUserId,
      });
    });

    const { outcome, failureMessage, log } = await listWithReadLog(t, adminIdentity);

    expect(failureMessage).toBeNull();
    expect(outcome?.summary).toEqual({
      totalArchived: 10,
      archivedAdmins: 0,
      archivedSessions: 2,
      archivedClasses: 2,
      archivedTeachers: 1,
      archivedSubjects: 1,
      archivedStudents: 2,
      archivedEvents: 1,
      archivedKnowledgeMaterials: 1,
    });

    const records = outcome?.records ?? [];
    expect(records.map((record) => [record.type, record.name, record.archivedAt])).toEqual([
      ["event", "Prize Giving", 900],
      ["session", "Open Archived Session", 800],
      ["session", "Locked Archived Session", 700],
      ["class", "Class Open", 650],
      ["class", "Class Locked", 600],
      ["subject", "Subject A", 500],
      ["teacher", "Teacher T1", 400],
      ["student", "Student Two", 350],
      ["student", "Student One", 300],
      ["knowledgeMaterial", "Archived Material", 200],
    ]);

    const field = (index: number, label: string) =>
      records[index]?.detailFields.find((candidate) => candidate.label === label)?.value;

    // Open session keeps full derived history.
    expect(records[1]?.linkedHistory).toBe(
      "1 term, 1 selection row, and 2 assessment rows remain tied to this session.",
    );
    expect(field(1, "Assessment records")).toBe("2");

    // Locked session redacts assessment-derived counts only.
    expect(records[2]?.linkedHistory).toBe(
      "Assessment count unavailable while this session's scoring job is locked.",
    );
    expect(field(2, "Assessment records")).toBe("Unavailable during scoring job");
    expect(field(2, "Terms")).toBe("1");
    expect(field(2, "Subject selections")).toBe("1");

    expect(records[3]?.linkedHistory).toBe(
      "2 subject offerings, 2 assessment rows, and 1 student row still reference this class.",
    );
    expect(records[4]?.linkedHistory).toContain(
      "Assessment count unavailable while a linked session's scoring job is locked",
    );

    // Corrupt cross-school assignment rows never reach the aggregate.
    expect(field(6, "Form classes")).toBe("1");
    expect(field(6, "Class-subject links")).toBe("1");
    expect(field(6, "Assignments")).toBe("1");

    expect(field(8, "Subject selections")).toBe("1");
    expect(field(8, "Assessment records")).toBe("2");
    expect(field(7, "Assessment records")).toBe(
      "Unavailable while a linked session's scoring job is locked",
    );

    expect(field(9, "Topic")).toBe("Photosynthesis core");
    expect(field(9, "Owner")).toBe("Archive Opt Owner");

    // Narrow reads: one per archived session / archived teacher, and school-wide reads only where gated.
    expect(queryCount(log, "academicTerms")).toBe(2);
    expect(docsRead(log, "academicTerms")).toBe(2);
    expect(queryCount(log, "teacherAssignments")).toBe(1);
    // The corrupt cross-school assignment row is scanned by by_teacher and
    // dropped inside the school filter, so only own-tenant rows are returned.
    expect(docsRead(log, "teacherAssignments")).toBe(1);
    expect(queryCount(log, "classSubjects")).toBe(1);
    expect(queryCount(log, "studentSubjectSelections")).toBe(1);
    expect(queryCount(log, "assessmentRecords")).toBe(1);
    expect(queryCount(log, "knowledgeMaterials")).toBe(1);
    expect(queryCount(log, "academicSessions")).toBe(1);
    expect(queryCount(log, "classes")).toBe(1);
    expect(queryCount(log, "subjects")).toBe(1);
    expect(queryCount(log, "schoolEvents")).toBe(1);
    expect(queryCount(log, "students")).toBe(1);
    expect(queryCount(log, "knowledgeTopics")).toBe(0);
    expect(getCallCount(log, "knowledgeTopics")).toBe(1);
    expect(docsRead(log, "knowledgeTopics")).toBe(1);
  });

  it("non-admin roles are rejected before any archive-table scan", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { schoolId, adminId, now } = await seedSchoolWithAdmin(ctx, "archive-opt-nonadmin");
      await ctx.db.insert("users", {
        schoolId,
        authId: teacherIdentity.subject,
        authTokenIdentifier: teacherIdentity.tokenIdentifier,
        name: "Archive Opt Teacher",
        email: "teacher@archive-opt.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("schoolEvents", {
        schoolId,
        title: "Prize Giving",
        startDate: 1100,
        endDate: 1200,
        isAllDay: true,
        isArchived: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
    });
    const { outcome, failureMessage, log } = await listWithReadLog(t, teacherIdentity);

    expect(outcome).toBeUndefined();
    expect(failureMessage).toContain("Admin access required");

    // Auth path reads ids/tokens first; no tracked archive table was scanned at all.
    expect(queryCount(log, "academicSessions")).toBe(0);
    expect(queryCount(log, "classes")).toBe(0);
    expect(queryCount(log, "subjects")).toBe(0);
    expect(queryCount(log, "schoolEvents")).toBe(0);
    expect(queryCount(log, "students")).toBe(0);
    expect(queryCount(log, "knowledgeMaterials")).toBe(0);
    expect(queryCount(log, "academicTerms")).toBe(0);
    expect(queryCount(log, "classSubjects")).toBe(0);
    expect(queryCount(log, "teacherAssignments")).toBe(0);
    expect(queryCount(log, "studentSubjectSelections")).toBe(0);
    expect(queryCount(log, "assessmentRecords")).toBe(0);
    expect(queryCount(log, "knowledgeTopics")).toBe(0);
    expect(getCallCount(log, "knowledgeTopics")).toBe(0);
  });
});
