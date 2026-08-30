import { describe, expect, it } from "vitest";
import type { Id, TableNames } from "../../../_generated/dataModel";
import { listTeacherArchiveBlockers } from "../archiveGuardrails";

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}

function createCtx(options: {
  activeSession?: {
    _id: Id<"academicSessions">;
    schoolId: Id<"schools">;
    name: string;
    isActive: boolean;
  } | null;
  classes?: Array<{
    _id: Id<"classes">;
    schoolId: Id<"schools">;
    name: string;
    level: string;
    formTeacherId?: Id<"users"> | null;
    isArchived?: boolean;
  }>;
  classSessionFormTeachers?: Array<{
    _id: Id<"classSessionFormTeachers">;
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
    formTeacherId: Id<"users">;
  }>;
  classSubjects?: Array<{
    _id: Id<"classSubjects">;
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    subjectId: Id<"subjects">;
    teacherId?: Id<"users"> | null;
  }>;
  teacherAssignments?: Array<{
    _id: Id<"teacherAssignments">;
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    subjectId: Id<"subjects">;
    teacherId: Id<"users">;
  }>;
  subjects?: Array<{
    _id: Id<"subjects">;
    schoolId: Id<"schools">;
    name: string;
    code: string;
    isArchived?: boolean;
  }>;
}) {
  const activeSession = options.activeSession ?? null;
  const classes = options.classes ?? [];
  const classSessionFormTeachers = options.classSessionFormTeachers ?? [];
  const classSubjects = options.classSubjects ?? [];
  const teacherAssignments = options.teacherAssignments ?? [];
  const subjects = options.subjects ?? [];

  return {
    db: {
      query: (tableName: string) => {
        if (tableName === "academicSessions") {
          return {
            withIndex: (_indexName: string, _builder: any) => ({
              first: async () => activeSession,
            }),
          };
        }
        if (tableName === "classes") {
          return {
            withIndex: (_indexName: string, _builder: any) => ({
              collect: async () => classes,
            }),
          };
        }
        if (tableName === "classSessionFormTeachers") {
          return {
            withIndex: (_indexName: string, builder?: any) => {
              let filtered = classSessionFormTeachers;
              const q = {
                eq: (field: string, value: any) => {
                  filtered = filtered.filter((item: any) => String(item[field]) === String(value));
                  return q;
                },
              };
              if (builder) builder(q);
              return {
                collect: async () => filtered,
              };
            },
          };
        }
        if (tableName === "classSubjects") {
          return {
            withIndex: (_indexName: string, _builder: any) => ({
              collect: async () => classSubjects,
            }),
          };
        }
        if (tableName === "teacherAssignments") {
          return {
            withIndex: (_indexName: string, _builder: any) => ({
              collect: async () => teacherAssignments,
            }),
          };
        }
        if (tableName === "subjects") {
          return {
            withIndex: (_indexName: string, _builder: any) => ({
              collect: async () => subjects,
            }),
          };
        }
        return {
          withIndex: () => ({ collect: async () => [] }),
        };
      },
    },
  } as any;
}

describe("session-scoped form teacher archiving guardrails", () => {
  const schoolId = asId<"schools">("school-1");
  const teacherPast = asId<"users">("teacher-past");
  const teacherActive = asId<"users">("teacher-active");
  const class1 = asId<"classes">("class-1");
  const session2024 = asId<"academicSessions">("session-2024");
  const session2025 = asId<"academicSessions">("session-2025");

  it("blocks archiving if teacher is form teacher in active session", async () => {
    const ctx = createCtx({
      activeSession: {
        _id: session2025,
        schoolId,
        name: "2025/2026",
        isActive: true,
      },
      classes: [
        {
          _id: class1,
          schoolId,
          name: "Primary 1",
          level: "Primary",
          formTeacherId: teacherActive,
        },
      ],
      classSessionFormTeachers: [
        {
          _id: asId<"classSessionFormTeachers">("ft-1"),
          schoolId,
          classId: class1,
          sessionId: session2025,
          formTeacherId: teacherActive,
        },
      ],
    });

    const blockers = await listTeacherArchiveBlockers(ctx, {
      schoolId,
      teacherId: teacherActive,
    });

    expect(blockers.get(String(teacherActive))).toEqual([
      "form teacher for Primary 1 (2025/2026)",
    ]);
  });

  it("allows archiving if teacher only has assignments in past sessions", async () => {
    const ctx = createCtx({
      activeSession: {
        _id: session2025,
        schoolId,
        name: "2025/2026",
        isActive: true,
      },
      classes: [
        {
          _id: class1,
          schoolId,
          name: "Primary 1",
          level: "Primary",
          formTeacherId: teacherActive,
        },
      ],
      classSessionFormTeachers: [
        {
          _id: asId<"classSessionFormTeachers">("ft-past"),
          schoolId,
          classId: class1,
          sessionId: session2024,
          formTeacherId: teacherPast,
        },
        {
          _id: asId<"classSessionFormTeachers">("ft-active"),
          schoolId,
          classId: class1,
          sessionId: session2025,
          formTeacherId: teacherActive,
        },
      ],
    });

    const blockers = await listTeacherArchiveBlockers(ctx, {
      schoolId,
      teacherId: teacherPast,
    });

    expect(blockers.get(String(teacherPast))).toBeUndefined();
  });
});
