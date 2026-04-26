"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, FileText, FolderOpen, GraduationCap, Plus, Search } from "lucide-react";
import { buildTeacherPlanningWorkspaceHref } from "@school/shared";

type ClassOption = {
  _id: string;
  name: string;
  gradeName?: string;
  classLabel?: string;
};

type TermOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type SubjectOption = {
  id: string;
  name: string;
};

type TopicOption = {
  _id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  level: string;
  termId: string;
  status: "draft" | "active" | "retired";
};

function readClassLevel(classDoc: ClassOption | null) {
  return (classDoc?.gradeName ?? classDoc?.name ?? "").trim();
}

function SectionCard({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
          <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{placeholder ?? `Choose ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeTopicTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function topicSimilarityWarning(input: string, topics: TopicOption[]) {
  const normalizedInput = normalizeTopicTitle(input).toLowerCase();
  if (!normalizedInput) {
    return null;
  }

  const closeTopic = topics.find((topic) => {
    const title = topic.title.trim().toLowerCase();
    return title !== normalizedInput && (title.includes(normalizedInput) || normalizedInput.includes(title));
  });

  return closeTopic ?? null;
}

function CreatableTopicField({
  value,
  inputValue,
  topics,
  disabled,
  isCreating,
  onInputChange,
  onSelectTopic,
  onCreateTopic,
}: {
  value: string;
  inputValue: string;
  topics: TopicOption[];
  disabled?: boolean;
  isCreating?: boolean;
  onInputChange: (value: string) => void;
  onSelectTopic: (topic: TopicOption) => void;
  onCreateTopic: () => void;
}) {
  const normalizedInput = normalizeTopicTitle(inputValue);
  const exactMatch = topics.find((topic) => topic.title.trim().toLowerCase() === normalizedInput.toLowerCase());
  const closeMatch = exactMatch ? null : topicSimilarityWarning(inputValue, topics);
  const visibleTopics = topics
    .filter((topic) => !normalizedInput || topic.title.toLowerCase().includes(normalizedInput.toLowerCase()))
    .slice(0, 8);
  const canCreate = Boolean(normalizedInput && !exactMatch && !disabled);

  return (
    <div className="block md:col-span-2">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        Topic
      </span>
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/5">
        <div className="flex items-center gap-2 px-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={disabled}
            placeholder={disabled ? "Choose class, term, and subject first" : "Type a topic or choose an existing one"}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
          {value ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              selected
            </span>
          ) : null}
        </div>

        {closeMatch ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Similar topic found: <button type="button" onClick={() => onSelectTopic(closeMatch)} className="font-black underline">{closeMatch.title}</button>. Select it if that is what you meant, or create a new topic if this is genuinely different.
            </span>
          </div>
        ) : null}

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {visibleTopics.map((topic) => (
            <button
              key={topic._id}
              type="button"
              onClick={() => onSelectTopic(topic)}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${value === topic._id ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"}`}
            >
              {topic.title}
            </button>
          ))}
          {!disabled && topics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              No topics yet for this subject/term. Type one and create it.
            </div>
          ) : null}
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={onCreateTopic}
            disabled={isCreating}
            className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            {isCreating ? "Creating topic..." : `Create “${normalizedInput}”`}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Topics are no longer library-only. Type a new topic here, select an existing close match, then open the workspace from that teaching context.
      </p>
    </div>
  );
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

  const topicClass = useMemo(
    () => classes?.find((item) => item._id === topicClassId) ?? null,
    [classes, topicClassId]
  );
  const examClass = useMemo(
    () => classes?.find((item) => item._id === examClassId) ?? null,
    [classes, examClassId]
  );
  const topicLevel = readClassLevel(topicClass);
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
    if (examSubjects && !examSubjects.some((subject) => subject.id === examSubjectId)) {
      setExamSubjectId(examSubjects[0]?.id ?? "");
    }
  }, [examSubjectId, examSubjects]);

  useEffect(() => {
    if (topicOptions && topicId && !topicOptions.some((topic) => topic._id === topicId)) {
      setTopicId("");
    }
  }, [topicId, topicOptions]);

  useEffect(() => {
    if (examScopeKind === "full_subject_term") {
      setExamTopicIds([]);
      return;
    }

    if (!examTopics) {
      return;
    }

    setExamTopicIds((current) => current.filter((topicIdValue) => examTopics.some((topic) => topic._id === topicIdValue)));
  }, [examScopeKind, examTopics]);

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
      setTopicNotice("Choose class, term, and subject, then type the new topic name.");
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
      setTopicNotice(created.duplicateOf ? "That topic already existed, so I selected it for you." : "Topic created and selected.");
    } catch (error) {
      setTopicNotice(error instanceof Error ? error.message : "Could not create the topic. Please try again.");
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

  const lessonHref = topicContext
    ? buildTeacherPlanningWorkspaceHref({
        route: "lesson-plans",
        context: topicContext,
        outputType: "lesson_plan",
      })
    : null;
  const assessmentHref = topicContext
    ? buildTeacherPlanningWorkspaceHref({
        route: "question-bank",
        mode: "practice_quiz",
        context: topicContext,
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

  const isLoading = !classes || !terms;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.14),_transparent_36%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-200 backdrop-blur-sm">
                <GraduationCap className="h-3.5 w-3.5" />
                Planning Hub
              </div>
              <h1 className="font-display text-3xl font-black tracking-tight">Start from context, not from files.</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Launch topic work for lesson plans and class assessments, or open exam drafting with an explicit subject, class, and term scope. The library stays available as your source repository and compatibility surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/planning/library"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
              >
                <FolderOpen className="h-4 w-4" />
                Open library
              </Link>
              <Link
                href="/planning/videos"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
              >
                <BookOpen className="h-4 w-4" />
                Video submissions
              </Link>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading planning launcher...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            icon={<FileText className="h-5 w-5" />}
            eyebrow="Topic work"
            title="One topic, multiple outputs"
            description="Choose class, term, subject, and topic first. Then branch into lesson writing or topic-level assessment drafting without losing your planning context."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                label="Class"
                value={topicClassId}
                onChange={(value) => {
                  setTopicClassId(value);
                  setTopicId("");
                  setTopicInput("");
                }}
                options={classOptions}
              />
              <SelectField
                label="Term"
                value={topicTermId}
                onChange={(value) => {
                  setTopicTermId(value);
                  setTopicId("");
                  setTopicInput("");
                }}
                options={termOptions}
              />
              <SelectField
                label="Subject"
                value={topicSubjectId}
                onChange={(value) => {
                  setTopicSubjectId(value);
                  setTopicId("");
                  setTopicInput("");
                }}
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
            </div>

            {topicNotice ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {topicNotice}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <strong className="text-slate-900">Current level:</strong> {topicLevel || "Select a class"}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={lessonHref ?? "#"}
                aria-disabled={!lessonHref}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${lessonHref ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}
              >
                <FileText className="h-4 w-4" />
                Open lesson workspace
              </Link>
              <Link
                href={assessmentHref ?? "#"}
                aria-disabled={!assessmentHref}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${assessmentHref ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
              >
                <ClipboardList className="h-4 w-4" />
                Open topic assessment
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            icon={<ClipboardList className="h-5 w-5" />}
            eyebrow="Exam work"
            title="Subject-scope exam drafting"
            description="Keep exam drafting distinct from topic work. Use the same class and term context, then choose either the full subject term or a curated topic subset."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Class" value={examClassId} onChange={setExamClassId} options={classOptions} />
              <SelectField label="Term" value={examTermId} onChange={setExamTermId} options={termOptions} />
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
            </div>

            {examScopeKind === "topic_subset" ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Topics in scope</p>
                <div className="mt-3 grid gap-2">
                  {(examTopics ?? []).map((topic) => {
                    const checked = examTopicIds.includes(topic._id);
                    return (
                      <label
                        key={topic._id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setExamTopicIds((current) =>
                              event.target.checked
                                ? [...current, topic._id]
                                : current.filter((value) => value !== topic._id)
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-500"
                        />
                        <span>{topic.title}</span>
                      </label>
                    );
                  })}
                  {examTopics && examTopics.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                      No active topics found for this class, subject, and term yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <strong className="text-slate-900">Current level:</strong> {examLevel || "Select a class"}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={examHref ?? "#"}
                aria-disabled={!examHref}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${examHref ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}
              >
                <ClipboardList className="h-4 w-4" />
                Open exam workspace
              </Link>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
