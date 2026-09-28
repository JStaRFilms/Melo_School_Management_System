"use client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { NarrativeSubjectEntry, type CommentRow } from "@school/shared";
import type { SelectionState } from "@/types";

export function LiveNarrativeEntry({ selection }: { selection: SelectionState }) {
  const router = useRouter();
  const sessions = useQuery("functions/academic/adminSelectors:getAdminSessions" as never, {} as never) as { id: string; name: string }[] | undefined;
  const terms = useQuery("functions/academic/adminSelectors:getTermsBySession" as never, selection.sessionId ? { sessionId: selection.sessionId } as never : "skip") as { id: string; name: string }[] | undefined;
  const classes = useQuery("functions/academic/adminSelectors:getAllClasses" as never, {} as never) as { id: string; name: string }[] | undefined;
  const subjects = useQuery("functions/academic/narrativeEntrySheet:getSubjectOptions" as never, selection.classId && selection.sessionId && selection.termId ? { classId: selection.classId, sessionId: selection.sessionId, termId: selection.termId } as never : "skip") as { id: string; name: string }[] | undefined;
  const validSubject = subjects === undefined || subjects.some(s => s.id === selection.subjectId);
  const ready = selection.sessionId && selection.termId && selection.classId && selection.subjectId && validSubject;
  const rows = useQuery("functions/academic/narrativeEntrySheet:getSheet" as never, ready ? { sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId, subjectId: selection.subjectId } as never : "skip") as CommentRow[] | undefined;
  const save = useMutation("functions/academic/narrativeReports:saveDraft" as never);
  return <NarrativeSubjectEntry selection={selection} sessions={sessions ?? []} terms={terms ?? []} classes={classes ?? []} subjects={subjects ?? []} rows={ready ? rows : undefined} onSelect={(field, value) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(field, value); else params.delete(field);
    if (field === "sessionId") { params.delete("termId"); params.delete("classId"); params.delete("subjectId"); }
    if (field === "termId") { params.delete("classId"); params.delete("subjectId"); }
    if (field === "classId") params.delete("subjectId");
    router.replace(`?${params.toString()}`);
  }} onSave={async (studentId, comment) => { if (!ready) throw new Error("Select a subject first"); await save({ studentId, comment, sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId, subjectId: selection.subjectId } as never); }} />;
}
