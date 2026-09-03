"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  ClipboardList, 
  FileText, 
  LayoutGrid, 
  Search, 
  Sparkles, 
  BookOpen, 
  FolderOpen,
  X,
  History,
  Plus
} from "lucide-react";
import { buildTeacherPlanningWorkspaceHref } from "@school/shared";
import { TeacherHeader } from "@/lib/components/ui/TeacherHeader";
import { StatGroup } from "@/lib/components/ui/StatGroup";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
import { cn } from "@/lib/utils";
import { 
  PlanningWorkCard, 
  SelectField, 
  CreatableTopicField 
} from "./components/PlanningComponents";

export type ClassOption = {
  _id: string;
  name: string;
  gradeName?: string;
  classLabel?: string;
};

export type TermOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type SubjectOption = {
  id: string;
  name: string;
};

export type TopicOption = {
  _id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  level: string;
  termId: string;
  status: "draft" | "active" | "retired";
};

export type PlanningWorkItem = {
  topicId: string;
  topicTitle: string;
  topicSummary: string | null;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  level: string;
  termId: string;
  termName: string;
  preferredClassId: string | null;
  preferredClassName: string | null;
  sourceIds: string[];
  sourceCount: number;
  readySourceCount: number;
  lessonCount: number;
  questionBankCount: number;
  latestUpdatedAt: number;
  outputs: Array<{
    kind: "lesson" | "question_bank";
    id: string;
    title: string;
    outputType: "lesson_plan" | "student_note" | "assignment" | "question_bank_draft" | "cbt_draft";
    draftMode: string | null;
    updatedAt: number;
  }>;
};

function readClassLevel(classDoc: ClassOption | null) {
  return (classDoc?.gradeName ?? classDoc?.name ?? "").trim();
}

function normalizeTopicTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function PlanningIndexPage() {
  const classes = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as ClassOption[] | undefined;
  const terms = useQuery(
    "functions/academic/teacherSelectors:getTeacherActiveTerms" as never
  ) as TermOption[] | undefined;

  const [topicClassId, setTopicClassId] = useState("");
  const [topicTermId, setTopicTermId] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicNotice, setTopicNotice] = useState<string | null>(null);

  const [examClassId, setExamClassId] = useState("");
  const [examTermId, setExamTermId] = useState("");
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examScopeKind, setExamScopeKind] = useState<"full_subject_term" | "topic_subset">("full_subject_term");
  const [examTopicIds, setExamTopicIds] = useState<string[]>([]);
  const [workSearchQuery, setWorkSearchQuery] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  
  const [isMobile, setIsMobile] = useState(false);
  const [activeForm, setActiveForm] = useState<"topic" | "exam" | null>(null);

  const topicClass = useMemo(
    () => classes?.find((item) => item._id === topicClassId) ?? null,
    [classes, topicClassId]
  );
  const topicLevel = readClassLevel(topicClass);

  const examClass = useMemo(
    () => classes?.find((item) => item._id === examClassId) ?? null,
    [classes, examClassId]
  );
  const examLevel = readClassLevel(examClass);

  const topicSubjects = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableSubjectsByClass" as never,
    topicClassId ? ({ classId: topicClassId } as never) : ("skip" as never)
  ) as SubjectOption[] | undefined;
  const examSubjects = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableSubjectsByClass" as never,
    examClassId ? ({ classId: examClassId } as never) : ("skip" as never)
  ) as SubjectOption[] | undefined;

  const topicOptions = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeTopics" as never,
    topicSubjectId && topicLevel && topicTermId
      ? ({ subjectId: topicSubjectId, level: topicLevel, termId: topicTermId, limit: 80 } as never)
      : ("skip" as never)
  ) as TopicOption[] | undefined;
  
  const createTopic = useMutation(
    "functions/academic/lessonKnowledgeTeacher:createTeacherKnowledgeTopic" as never
  );
  
  const examTopics = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeTopics" as never,
    examSubjectId && examLevel && examTermId
      ? ({ subjectId: examSubjectId, level: examLevel, termId: examTermId, limit: 80 } as never)
      : ("skip" as never)
  ) as TopicOption[] | undefined;
  
  const planningWork = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherPlanningTopicWork" as never,
    {
      searchQuery: workSearchQuery.trim() || undefined,
      limit: 18,
    } as never
  ) as PlanningWorkItem[] | undefined;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!topicClassId && classes?.[0]) {
      setTopicClassId(classes[0]._id);
    }
    if (!examClassId && classes?.[0]) {
      setExamClassId(classes[0]._id);
    }
  }, [classes, examClassId, topicClassId]);

  useEffect(() => {
    if (!topicTermId && terms?.[0]) {
      setTopicTermId(terms[0].id);
    }
    if (!examTermId && terms?.[0]) {
      setExamTermId(terms[0].id);
    }
  }, [examTermId, terms, topicTermId]);

  useEffect(() => {
    if (topicSubjects && !topicSubjects.some((subject) => subject.id === topicSubjectId)) {
      setTopicSubjectId(topicSubjects[0]?.id ?? "");
      setTopicId("");
      setTopicInput("");
    }
  }, [topicSubjectId, topicSubjects]);

  useEffect(() => {
    if (topicOptions && topicId && !topicOptions.some((topic) => topic._id === topicId)) {
      setTopicId("");
      setTopicInput("");
    }
  }, [topicId, topicOptions]);

  useEffect(() => {
    if (examSubjects && !examSubjects.some((subject) => subject.id === examSubjectId)) {
      setExamSubjectId(examSubjects[0]?.id ?? "");
      setExamTopicIds([]);
    }
  }, [examSubjectId, examSubjects]);

  useEffect(() => {
    if (!examTopics) {
      setExamTopicIds([]);
      return;
    }
    setExamTopicIds((prev) => prev.filter((id) => examTopics.some((topic) => topic._id === id)));
  }, [examTopics]);

  const classOptions = useMemo(
    () => (classes ?? []).map((item) => ({ value: item._id, label: item.name })),
    [classes]
  );
  const termOptions = useMemo(
    () => (terms ?? []).map((item) => ({ value: item.id, label: item.name })),
    [terms]
  );
  const topicSubjectOptions = useMemo(
    () => (topicSubjects ?? []).map((item) => ({ value: item.id, label: item.name })),
    [topicSubjects]
  );
  const examSubjectOptions = useMemo(
    () => (examSubjects ?? []).map((item) => ({ value: item.id, label: item.name })),
    [examSubjects]
  );

  const handleTopicInputChange = (nextValue: string) => {
    setTopicInput(nextValue);
    setTopicNotice(null);
    const exactTopic = (topicOptions ?? []).find(
      (topic) => topic.title.trim().toLowerCase() === normalizeTopicTitle(nextValue).toLowerCase()
    );
    setTopicId(exactTopic?._id ?? "");
  };

  const handleSelectTopic = (topic: TopicOption) => {
    setTopicId(topic._id);
    setTopicInput(topic.title);
    setTopicNotice(null);
  };

  const handleCreateTopic = async () => {
    const title = normalizeTopicTitle(topicInput);
    if (!title || !topicSubjectId || !topicLevel || !topicTermId) {
      setTopicNotice("Missing context. Choose class, term, and subject first.");
      return;
    }

    setCreatingTopic(true);
    setTopicNotice(null);
    try {
      const created = (await createTopic({
        title,
        subjectId: topicSubjectId as never,
        level: topicLevel,
        termId: topicTermId as never,
      } as never)) as { topicId: string; title: string; duplicateOf?: string | null };
      setTopicId(created.topicId);
      setTopicInput(created.title);
      setTopicNotice(created.duplicateOf ? "Existing topic selected." : "Topic created.");
    } catch (error) {
      setTopicNotice(error instanceof Error ? error.message : "Creation failed.");
    } finally {
      setCreatingTopic(false);
    }
  };

  const topicContext =
    topicClassId && topicTermId && topicSubjectId && topicLevel && topicId
      ? {
          kind: "topic" as const,
          classId: topicClassId,
          termId: topicTermId,
          subjectId: topicSubjectId,
          level: topicLevel,
          topicId,
        }
      : null;
  const topicSourceIds = planningWork?.find((item) => item.topicId === topicId)?.sourceIds ?? [];

  const lessonHref = topicContext
    ? buildTeacherPlanningWorkspaceHref({
        route: "lesson-plans",
        context: topicContext,
        outputType: "lesson_plan",
        sourceIds: topicSourceIds,
        sourceOrigin: "topic_workspace",
      })
    : null;
    
  const assessmentHref = topicContext
    ? buildTeacherPlanningWorkspaceHref({
        route: "question-bank",
        mode: "practice_quiz",
        context: topicContext,
        sourceIds: topicSourceIds,
        sourceOrigin: "topic_workspace",
      })
    : null;

  const examContext =
    examClassId && examTermId && examSubjectId && examLevel
      ? {
          kind: "exam_scope" as const,
          classId: examClassId,
          termId: examTermId,
          subjectId: examSubjectId,
          level: examLevel,
          scopeKind: examScopeKind,
          topicIds: examScopeKind === "topic_subset" ? examTopicIds : [],
        }
      : null;

  const examHref =
    examContext && (examScopeKind === "full_subject_term" || examTopicIds.length > 0)
      ? buildTeacherPlanningWorkspaceHref({
          route: "question-bank",
          mode: "exam_draft",
          context: examContext,
        })
      : null;

  if (classes === undefined || terms === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
        <div className="animate-pulse space-y-10">
          <div className="h-10 w-64 rounded-xl bg-slate-100" />
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8 h-96 rounded-2xl bg-slate-50" />
            <div className="h-96 rounded-2xl bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  const creationSidebar = (
    <div className="space-y-8">
      {/* Topic Creation Section */}
      <div className="rounded-lg bg-white border border-slate-200/60 p-5 shadow-sm ring-1 ring-slate-950/5">
        <div className="mb-4 space-y-1">
          <h3 className="font-display text-lg font-black tracking-tight text-slate-950 uppercase">Topic Workspace</h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Initialize planning context</p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Class" value={topicClassId} onChange={setTopicClassId} options={classOptions} />
            <SelectField label="Term" value={topicTermId} onChange={setTopicTermId} options={termOptions} />
          </div>
          <SelectField
            label="Subject"
            value={topicSubjectId}
            onChange={setTopicSubjectId}
            options={topicSubjectOptions}
            disabled={!topicClassId}
          />
          <CreatableTopicField
            value={topicId}
            inputValue={topicInput}
            topics={topicOptions ?? []}
            disabled={!topicSubjectId || !topicTermId || !topicLevel}
            isCreating={creatingTopic}
            onInputChange={handleTopicInputChange}
            onSelectTopic={handleSelectTopic}
            onCreateTopic={handleCreateTopic}
          />
          
          {topicNotice && (
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
              {topicNotice}
            </p>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={lessonHref ?? "#"}
              className={cn(
                "w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm",
                lessonHref ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-300 shadow-none"
              )}
            >
              <FileText className="h-4 w-4" />
              Open Lesson Flow
            </Link>
            <Link
              href={assessmentHref ?? "#"}
              className={cn(
                "w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-black uppercase tracking-widest transition-all",
                assessmentHref ? "bg-white text-slate-950 hover:bg-slate-50" : "cursor-not-allowed bg-slate-50 text-slate-300"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Topic Assessment
            </Link>
          </div>
        </div>
      </div>

      {/* Exam Creation Section */}
      <div className="rounded-lg bg-white border border-slate-200/60 p-5 shadow-sm ring-1 ring-slate-950/5">
        <div className="mb-4 space-y-1">
          <h3 className="font-display text-lg font-black tracking-tight text-slate-950 uppercase">Exam Drafting</h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Broad scope assessment</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Class" value={examClassId} onChange={setExamClassId} options={classOptions} />
            <SelectField label="Term" value={examTermId} onChange={setExamTermId} options={termOptions} />
          </div>
          <SelectField
            label="Subject"
            value={examSubjectId}
            onChange={setExamSubjectId}
            options={examSubjectOptions}
            disabled={!examClassId}
          />
          <SelectField
            label="Scope"
            value={examScopeKind}
            onChange={(value) => setExamScopeKind(value as "full_subject_term" | "topic_subset")}
            options={[
              { value: "full_subject_term", label: "Full subject term" },
              { value: "topic_subset", label: "Topic subset" },
            ]}
          />

          {examScopeKind === "topic_subset" && (
             <div className="mt-2 space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                {(examTopics ?? []).map((topic) => (
                  <label key={topic._id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-[12px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={examTopicIds.includes(topic._id)}
                      onChange={(e) => setExamTopicIds(prev => e.target.checked ? [...prev, topic._id] : prev.filter(id => id !== topic._id))}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-slate-950 focus:ring-slate-950/5"
                    />
                    <span className="truncate">{topic.title}</span>
                  </label>
                ))}
             </div>
          )}

          <Link
            href={examHref ?? "#"}
            className={cn(
              "w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              examHref ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-300"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Launch Exam Studio
          </Link>
        </div>
      </div>

      {/* Global Actions */}
      <div className="pt-4 border-t border-slate-200/60">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Knowledge Surfaces</h4>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href="/planning/library" className="flex flex-col items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
            <FolderOpen className="h-5 w-5 text-slate-400 group-hover:text-slate-950 transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-950">Library</span>
          </Link>
          <Link href="/planning/videos" className="flex flex-col items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
            <BookOpen className="h-5 w-5 text-slate-400 group-hover:text-slate-950 transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-950">Videos</span>
          </Link>
        </div>
      </div>
    </div>
  );

  const availableSubjects = useMemo(() => {
    const subjectMap = new Map<string, { id: string; name: string; count: number }>();
    (planningWork ?? []).forEach((item) => {
      const existing = subjectMap.get(item.subjectId);
      if (existing) {
        existing.count += 1;
      } else {
        subjectMap.set(item.subjectId, {
          id: item.subjectId,
          name: item.subjectName,
          count: 1,
        });
      }
    });
    return Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [planningWork]);

  const filteredPlanningWork = useMemo(() => {
    return (planningWork ?? []).filter((item) => {
      if (selectedSubjectFilter !== "all" && item.subjectId !== selectedSubjectFilter) {
        return false;
      }
      if (workSearchQuery.trim()) {
        const q = workSearchQuery.toLowerCase().trim();
        const matchTitle = item.topicTitle.toLowerCase().includes(q);
        const matchSummary = (item.topicSummary ?? "").toLowerCase().includes(q);
        const matchSubject = item.subjectName.toLowerCase().includes(q) || item.subjectCode.toLowerCase().includes(q);
        const matchLevel = item.level.toLowerCase().includes(q);
        const matchTerm = item.termName.toLowerCase().includes(q);
        const matchOutputs = item.outputs.some((o) => o.title.toLowerCase().includes(q));
        if (!matchTitle && !matchSummary && !matchSubject && !matchLevel && !matchTerm && !matchOutputs) {
          return false;
        }
      }
      return true;
    });
  }, [planningWork, selectedSubjectFilter, workSearchQuery]);

  return (
    <div className="relative min-h-screen lg:h-[calc(100vh-64px)] lg:overflow-hidden flex flex-col bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Mobile Drawer */}
      <TeacherSheet
        isOpen={Boolean(activeForm) && isMobile}
        onClose={() => setActiveForm(null)}
        title={activeForm === "topic" ? "Topic Workspace" : "Exam Drafting"}
      >
        {creationSidebar}
      </TeacherSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 lg:overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full lg:h-full lg:overflow-y-auto px-4 py-6 md:px-6 md:py-8 custom-scrollbar">
          <div className="w-full max-w-[1200px] mx-auto space-y-6">
            <TeacherHeader
              title="Planning Studio"
              label="Academic Engine"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Active Topics",
                      value: planningWork?.length ?? 0,
                      icon: <LayoutGrid className="h-4 w-4" />,
                    },
                    {
                      label: "Recent Lessons",
                      value: planningWork?.reduce((acc, curr) => acc + curr.lessonCount, 0) ?? 0,
                      icon: <FileText className="h-4 w-4" />,
                    },
                  ]}
                />
              }
            />

            {/* Work Grid Header & Filters */}
            <div className="space-y-3 border-b border-slate-950/5 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">Active Workspace</h3>
                    <div className="px-2 py-0.5 rounded-full bg-slate-950 text-white text-[9px] font-bold tracking-widest uppercase italic">LIVE</div>
                  </div>
                  <p className="text-xs font-medium text-slate-400">
                    Jump back into your recent teaching contexts and drafts.
                  </p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={workSearchQuery}
                    onChange={(e) => setWorkSearchQuery(e.target.value)}
                    placeholder="Search topics, subjects, classes..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-400 shadow-2xs"
                  />
                  {workSearchQuery && (
                    <button
                      onClick={() => setWorkSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subject Filter Tabs */}
              {availableSubjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectFilter("all")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSubjectFilter === "all"
                        ? "bg-slate-950 text-white shadow-2xs font-extrabold"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span>All Subjects</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${selectedSubjectFilter === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"}`}>
                      {planningWork?.length ?? 0}
                    </span>
                  </button>

                  {availableSubjects.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubjectFilter(sub.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedSubjectFilter === sub.id
                          ? "bg-slate-950 text-white shadow-2xs font-extrabold"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span>{sub.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${selectedSubjectFilter === sub.id ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"}`}>
                        {sub.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Work Grid */}
            <div className="grid w-full min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPlanningWork.map((item) => {
                const itemContext = item.preferredClassId
                  ? {
                      kind: "topic" as const,
                      classId: item.preferredClassId,
                      termId: item.termId,
                      subjectId: item.subjectId,
                      level: item.level,
                      topicId: item.topicId,
                    }
                  : null;
                const lHref = itemContext
                  ? buildTeacherPlanningWorkspaceHref({ route: "lesson-plans", outputType: "lesson_plan", context: itemContext, sourceIds: item.sourceIds, sourceOrigin: "topic_workspace" })
                  : null;
                const qHref = itemContext
                  ? buildTeacherPlanningWorkspaceHref({ route: "question-bank", mode: "practice_quiz", context: itemContext, sourceIds: item.sourceIds, sourceOrigin: "topic_workspace" })
                  : null;
                  
                return (
                  <PlanningWorkCard 
                    key={item.topicId} 
                    item={item} 
                    lessonHref={lHref} 
                    questionHref={qHref} 
                  />
                );
              })}
              
              {filteredPlanningWork.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                  <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-100">
                    <History className="h-5 w-5 text-slate-300" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      {workSearchQuery || selectedSubjectFilter !== "all" ? "No matching workspace items" : "Empty Workspace"}
                    </p>
                    <p className="text-xs font-medium text-slate-400 max-w-[280px]">
                      {workSearchQuery || selectedSubjectFilter !== "all"
                        ? "Try changing your search term or subject filter."
                        : "Select a context in the sidebar to initialize your first teaching topic."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar Bucket - Independent Scroll */}
        <aside className="hidden lg:block w-[400px] lg:h-full lg:overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl px-8 py-10 custom-scrollbar z-10">
          {creationSidebar}
        </aside>

        {/* Mobile FAB for Sidebar */}
        <div className="lg:hidden fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setActiveForm("topic")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl active:scale-95 transition-transform"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
