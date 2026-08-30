"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ClipboardCheck, FileCheck2, FileText, ListChecks, NotebookPen, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { ReadinessContextBar } from "./components/ReadinessContextBar";
import { ReadinessEvidenceTable } from "./components/ReadinessEvidenceTable";
import { buildReadinessSummary, type ReadinessSummaryIcon } from "./components/readinessSummary";
import type { CurriculumReadinessResponse, SelectOption } from "./components/types";

interface Subject { _id: string; name: string; }
interface ClassRecord { _id: string; name: string; gradeName: string; }
interface Session { _id: string; name: string; isActive: boolean; }
interface Term { _id: string; name: string; isActive: boolean; }

function uniqueLevels(classes: ClassRecord[] | undefined): SelectOption[] {
  const values = new Set<string>();
  return (classes ?? []).flatMap((item) => {
    const value = (item.gradeName || item.name).trim();
    if (!value || values.has(value)) return [];
    values.add(value);
    return [{ value, label: value }];
  });
}

export default function CurriculumReadinessPage() {
  const subjects = useQuery(api.functions.academic.academicSetup.listSubjects) as Subject[] | undefined;
  const classes = useQuery(api.functions.academic.academicSetup.listClasses) as ClassRecord[] | undefined;
  const sessions = useQuery(api.functions.academic.academicSetup.listSessions) as Session[] | undefined;
  const activeSession = sessions?.find((session) => session.isActive);
  const terms = useQuery(
    api.functions.academic.academicSetup.listTermsBySession,
    activeSession ? { sessionId: activeSession._id } : "skip",
  ) as Term[] | undefined;
  const activeTerm = terms?.find((term) => term.isActive);
  const subjectOptions = useMemo(() => (subjects ?? []).map((subject) => ({ value: subject._id, label: subject.name })), [subjects]);
  const levelOptions = useMemo(() => uniqueLevels(classes), [classes]);
  const termOptions = useMemo(() => (terms ?? []).map((term) => ({ value: term._id, label: term.name })), [terms]);
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("");
  const [termId, setTermId] = useState("");

  useEffect(() => { if (!subjectId && subjectOptions[0]) setSubjectId(subjectOptions[0].value); }, [subjectId, subjectOptions]);
  useEffect(() => { if (!level && levelOptions[0]) setLevel(levelOptions[0].value); }, [level, levelOptions]);
  useEffect(() => {
    if (!termId && terms?.length) setTermId(activeTerm?._id ?? terms[0]._id);
  }, [activeTerm?._id, termId, terms]);

  const readiness = useQuery(
    api.functions.academic.curriculumReadiness.getAdminCurriculumReadiness,
    subjectId && level && termId ? { subjectId, level: level.trim(), termId } : "skip",
  ) as CurriculumReadinessResponse | undefined;
  const isLoading = Boolean(subjectId && level && termId) && readiness === undefined;
  const contextReady = Boolean(subjectId && level && termId);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8">
      <AdminHeader
        label="Curriculum intelligence"
        title="Readiness map"
        description="See preparation evidence for approved curriculum topics in any term of the active session."
      />
      <ReadinessContextBar
        subjects={subjectOptions}
        levels={levelOptions}
        terms={termOptions}
        subjectId={subjectId}
        level={level}
        termId={termId}
        onSubjectChange={setSubjectId}
        onLevelChange={setLevel}
        onTermChange={setTermId}
      />
      {!activeSession || !termOptions.length ? <ContextNotice message="Set an active session with at least one term before reviewing curriculum readiness." /> : null}
      {termOptions.length && (!subjectOptions.length || !levelOptions.length) ? <ContextNotice message="Add at least one subject and class before viewing a readiness map." /> : null}
      {isLoading ? <LoadingState /> : null}
      {contextReady && readiness ? <ReadinessContent data={readiness} /> : null}
    </div>
  );
}

function ContextNotice({ message }: { message: string }) {
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{message}</div>;
}

function LoadingState() {
  return <div className="animate-pulse space-y-4"><div className="h-20 rounded-2xl bg-slate-100" /><div className="h-64 rounded-2xl bg-slate-100" /></div>;
}

function ReadinessContent({ data }: { data: CurriculumReadinessResponse }) {
  const icons: Record<ReadinessSummaryIcon, JSX.Element> = {
    topics: <BookOpenCheck />, sources: <FileCheck2 />, plans: <ListChecks />, notes: <NotebookPen />,
    assignments: <ClipboardCheck />, assessments: <Sparkles />, published: <FileText />,
  };
  const stats = buildReadinessSummary(data.counts).map((item) => ({ ...item, icon: icons[item.icon] }));
  if (!data.rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><h2 className="font-display text-lg font-bold text-slate-900">No approved topics in this context</h2><p className="mt-2 text-sm text-slate-500">Approve curriculum units or create topics for this subject, class, and term first.</p></div>;
  return <div className="space-y-4"><StatGroup stats={stats} variant="grid" /><div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-medium text-sky-950">{data.evidenceNotice}</div><ReadinessEvidenceTable rows={data.rows} /></div>;
}
