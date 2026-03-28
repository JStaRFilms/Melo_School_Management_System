"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReportCardSheetData } from "@school/shared";
import { useAuth } from "@/lib/AuthProvider";

import { CommentSection } from "./components/CommentSection";
import { ExtrasSection } from "./components/ExtrasSection";
import { ResultsSummary } from "./components/ResultsSummary";
import { SubjectSection } from "./components/SubjectChangeSection";
import { WorkbenchHeader } from "./components/WorkbenchHeader";
import type {
  SelectorOption,
  StudentOption,
  SubjectMatrix,
  WorkbenchSelection,
} from "./components/types";

interface LegacySelectorOption {
  _id: string;
  name: string;
}

interface BatchStudentRecord {
  studentId: string;
  studentName: string;
  admissionNumber: string;
}

function normalizeLegacyOptions(
  options: LegacySelectorOption[] | undefined
): SelectorOption[] {
  return options?.map((option) => ({
    id: option._id,
    name: option.name,
  })) ?? [];
}

export default function TeacherReportCardWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const selection = useMemo<WorkbenchSelection>(
    () => ({
      sessionId: searchParams.get("sessionId"),
      termId: searchParams.get("termId"),
      classId: searchParams.get("classId"),
      studentId: searchParams.get("studentId"),
    }),
    [searchParams]
  );

  const sessions = useQuery(
    "functions/academic/teacherSelectors:getTeacherSessions" as never
  ) as LegacySelectorOption[] | undefined;
  const terms = useQuery(
    "functions/academic/teacherSelectors:getTermsBySession" as never,
    selection.sessionId
      ? ({ sessionId: selection.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const classes = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as LegacySelectorOption[] | undefined;

  const normalizedSessions = normalizeLegacyOptions(sessions);
  const normalizedClasses = normalizeLegacyOptions(classes);

  // â”€â”€ URL param helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const replaceSelection = useCallback(
    (next: Partial<WorkbenchSelection>) => {
      const params = new URLSearchParams(searchParams.toString());
      const apply = (key: keyof WorkbenchSelection) => {
        const value = next[key];
        if (value === undefined) return;
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      };

      apply("sessionId");
      apply("termId");
      apply("classId");
      apply("studentId");

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  // â”€â”€ Auto-select defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (!selection.sessionId && normalizedSessions.length > 0) {
      replaceSelection({
        sessionId: normalizedSessions[0].id,
        termId: null,
        classId: null,
        studentId: null,
      });
    }
  }, [normalizedSessions, replaceSelection, selection.sessionId]);

  useEffect(() => {
    if (selection.sessionId && !selection.termId && terms && terms.length > 0) {
      replaceSelection({
        termId: terms[0].id,
        classId: null,
        studentId: null,
      });
    }
  }, [replaceSelection, selection.sessionId, selection.termId, terms]);

  useEffect(() => {
    if (!selection.classId && normalizedClasses.length > 0) {
      replaceSelection({
        classId: normalizedClasses[0].id,
        studentId: null,
      });
    }
  }, [normalizedClasses, replaceSelection, selection.classId]);

  // â”€â”€ Student roster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const hasClassAndSession = Boolean(
    selection.sessionId && selection.termId && selection.classId
  );

  const rosterRows = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    hasClassAndSession
      ? ({
          classId: selection.classId,
          sessionId: selection.sessionId,
          termId: selection.termId,
        } as never)
      : ("skip" as never)
  ) as BatchStudentRecord[] | undefined;

  const roster = useMemo<StudentOption[]>(
    () =>
      rosterRows?.map((student) => ({
        id: student.studentId,
        name: student.studentName,
        admissionNumber: student.admissionNumber,
      })) ?? [],
    [rosterRows]
  );

  useEffect(() => {
    if (!hasClassAndSession || roster.length === 0) return;

    const studentIsValid =
      selection.studentId &&
      roster.some((student) => student.id === selection.studentId);

    if (!studentIsValid) {
      replaceSelection({ studentId: roster[0].id });
    }
  }, [hasClassAndSession, replaceSelection, roster, selection.studentId]);

  // â”€â”€ Report card data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    selection.studentId && selection.sessionId && selection.termId
      ? ({
          studentId: selection.studentId,
          sessionId: selection.sessionId,
          termId: selection.termId,
        } as never)
      : ("skip" as never)
  ) as ReportCardSheetData | undefined;

  const resolvedClassId = selection.classId ?? reportCard?.classId ?? null;
  const printHref =
    selection.studentId && selection.sessionId && selection.termId
      ? `/assessments/report-cards?studentId=${selection.studentId}&sessionId=${selection.sessionId}&termId=${selection.termId}${resolvedClassId ? `&classId=${resolvedClassId}` : ""}`
      : undefined;

  // â”€â”€ Subject matrix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const subjectMatrix = useQuery(
    "functions/academic/studentEnrollment:getClassStudentSubjectMatrix" as never,
    selection.classId && selection.sessionId
      ? ({
          classId: selection.classId,
          sessionId: selection.sessionId,
        } as never)
      : ("skip" as never)
  ) as SubjectMatrix | undefined;

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const saveComment = useMutation(
    "functions/academic/reportCards:saveStudentReportCardComments" as never
  );
  const extrasEntry = useQuery(
    "functions/academic/reportCardExtras:getStudentReportCardExtrasEntry" as never,
    selection.studentId && selection.sessionId && selection.termId && resolvedClassId
      ? ({
          studentId: selection.studentId,
          sessionId: selection.sessionId,
          termId: selection.termId,
          classId: resolvedClassId,
        } as never)
      : ("skip" as never)
  ) as
    | {
        canEdit: boolean;
        bundles: Array<{
          _id: string;
          name: string;
          description: string | null;
          sections: Array<{
            id: string;
            label: string;
            fields: Array<{
              id: string;
              label: string;
              type: "text" | "number" | "boolean" | "scale";
              printable: boolean;
              scaleOptions: Array<{
                id: string;
                label: string;
                shortLabel: string | null;
              }>;
              value: {
                textValue: string | null;
                numberValue: number | null;
                booleanValue: boolean | null;
                scaleOptionId: string | null;
                printValue: string | null;
              };
            }>;
          }>;
        }>;
      }
    | undefined;
  const saveExtras = useMutation(
    "functions/academic/reportCardExtras:saveStudentReportCardExtrasEntry" as never
  );
  const saveSubjectSelections = useMutation(
    "functions/academic/studentEnrollment:setStudentSubjectSelections" as never
  );

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const selectedStudent = useMemo(
    () =>
      roster?.find((s) => s.id === selection.studentId) ??
      roster?.[0] ??
      null,
    [roster, selection.studentId]
  );

  const handleClassChange = useCallback(
    (nextClassId: string | null) => {
      replaceSelection({ classId: nextClassId, studentId: null });
    },
    [replaceSelection]
  );

  const handleStudentChange = useCallback(
    (nextStudentId: string | null) => {
      replaceSelection({ studentId: nextStudentId });
    },
    [replaceSelection]
  );

  const handleNextStudent = useCallback(() => {
    if (!roster || roster.length === 0) return;

    if (!selection.studentId) {
      handleStudentChange(roster[0].id);
      return;
    }

    const idx = roster.findIndex((s) => s.id === selection.studentId);
    const next = roster[(idx + 1) % roster.length];
    if (next) handleStudentChange(next.id);
  }, [handleStudentChange, roster, selection.studentId]);

  const isAdmin = session?.user?.role === "admin";

  const handleSaveComment = useCallback(
    async (payload: { classTeacherComment: string | null; headTeacherComment?: string | null }) => {
      if (!selection.studentId || !selection.sessionId || !selection.termId)
        return;

      const args: Record<string, any> = {
        studentId: selection.studentId,
        sessionId: selection.sessionId,
        termId: selection.termId,
        classTeacherComment: payload.classTeacherComment,
      };

      if (isAdmin && payload.headTeacherComment !== undefined) {
        args.headTeacherComment = payload.headTeacherComment;
      }

      await saveComment(args as never);
    },
    [isAdmin, saveComment, selection.sessionId, selection.studentId, selection.termId]
  );

  const handleSaveSubjects = useCallback(
    async (subjectIds: string[]) => {
      if (!selection.studentId || !selection.classId || !selection.sessionId)
        return;

      await saveSubjectSelections({
        studentId: selection.studentId,
        classId: selection.classId,
        sessionId: selection.sessionId,
        subjectIds,
      } as never);
    },
    [
      saveSubjectSelections,
      selection.classId,
      selection.sessionId,
      selection.studentId,
    ]
  );

  const handleSaveExtras = useCallback(
    async (
      bundleValues: Array<{
        bundleId: string;
        values: Array<{
          fieldId: string;
          textValue: string | null;
          numberValue: number | null;
          booleanValue: boolean | null;
          scaleOptionId: string | null;
        }>;
      }>
    ) => {
      if (!selection.studentId || !selection.sessionId || !selection.termId || !resolvedClassId) {
        return;
      }

      await saveExtras({
        studentId: selection.studentId,
        classId: resolvedClassId,
        sessionId: selection.sessionId,
        termId: selection.termId,
        bundleValues,
      } as never);
    },
    [resolvedClassId, saveExtras, selection.sessionId, selection.studentId, selection.termId]
  );

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const isSelectionReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.studentId
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-0 sm:py-8 pb-24">
      <WorkbenchHeader
        sessionName={
          normalizedSessions.find((o) => o.id === selection.sessionId)?.name ??
          "Session pending"
        }
        termName={
          terms?.find((o) => o.id === selection.termId)?.name ?? "Term pending"
        }
        classOptions={normalizedClasses}
        studentOptions={roster ?? []}
        selectedClassId={selection.classId}
        selectedStudentId={selection.studentId}
        isLoadingClasses={classes === undefined}
        isLoadingStudents={hasClassAndSession && rosterRows === undefined}
        onClassChange={handleClassChange}
        onStudentChange={handleStudentChange}
        onNextStudent={handleNextStudent}
        printHref={printHref}
      />

      {!isSelectionReady ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500">
          Pick a class and student above to get started.
        </div>
      ) : reportCard === undefined ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500">
          Loading report card...
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <ResultsSummary reportCard={reportCard} />

            <SubjectSection
              matrix={subjectMatrix}
              selectedStudentId={selectedStudent?.id ?? selection.studentId}
              isLoading={hasClassAndSession && subjectMatrix === undefined}
              onSave={handleSaveSubjects}
            />

            <ExtrasSection
              reportCard={reportCard}
              entry={extrasEntry}
              isLoading={Boolean(
                selection.studentId &&
                  selection.sessionId &&
                  selection.termId &&
                  resolvedClassId &&
                  extrasEntry === undefined
              )}
              onSave={handleSaveExtras}
            />
          </div>

          <div className="space-y-6 pt-4">
          <CommentSection
            reportCard={reportCard}
            isLoading={reportCard === undefined}
            canEditHeadTeacherComment={isAdmin}
            onSave={handleSaveComment}
          />
          </div>
        </>
      )}
    </main>
  );
}
