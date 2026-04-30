"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Link2, 
  Loader2, 
  ShieldCheck, 
  Sparkles, 
  Upload, 
  Search,
  ExternalLink,
  AlertTriangle,
  History,
  Plus,
  X
} from "lucide-react";

import { getUserFacingErrorMessage } from "@school/shared";
import { TeacherHeader } from "@/lib/components/ui/TeacherHeader";
import { StatGroup } from "@/lib/components/ui/StatGroup";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
import { cn } from "@/lib/utils";

interface TeacherVideoSubject {
  id: string;
  name: string;
  code: string;
}

interface TeacherVideoClassSummary {
  _id: string;
  name: string;
  gradeName?: string;
}

interface LevelOption {
  value: string;
  label: string;
}

interface TeacherVideoMaterial {
  _id: string;
  title: string;
  description: string | null;
  ownerName: string;
  sourceType: "youtube_link";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  processingStatus: "awaiting_upload" | "queued" | "extracting" | "ocr_needed" | "ready" | "failed";
  subjectName: string;
  subjectCode: string;
  level: string;
  topicLabel: string;
  externalUrl: string | null;
  createdAt: number;
  updatedAt: number;
  isOwnedByMe: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canSelectAsSource: boolean;
}

interface TeacherVideoResponse {
  summary: {
    loaded: number;
    privateOwner: number;
    staffVisible: number;
    readyToSelect: number;
    publishable: number;
    needsAttention: number;
  };
  materials: TeacherVideoMaterial[];
}

function badgeTone(kind: "visibility" | "review" | "processing", value: string) {
  if (kind === "visibility") {
    return value === "student_approved"
      ? "border-blue-100 bg-blue-50 text-blue-700"
      : value === "staff_shared"
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (kind === "review") {
    return value === "approved"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : value === "rejected"
        ? "border-rose-100 bg-rose-50 text-rose-700"
        : "border-amber-100 bg-amber-50 text-amber-700";
  }
  return value === "ready"
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : value === "failed"
      ? "border-rose-100 bg-rose-50 text-rose-700"
      : "border-amber-100 bg-amber-50 text-amber-700";
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeYouTubeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isYouTubeHost = host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be";
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && isYouTubeHost) {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function buildLevelOptions(classes: TeacherVideoClassSummary[] | undefined): LevelOption[] {
  const seen = new Set<string>();
  const options: LevelOption[] = [];

  for (const classDoc of classes ?? []) {
    const level = (classDoc.gradeName ?? classDoc.name).trim();
    if (!level || seen.has(level)) {
      continue;
    }

    seen.add(level);
    options.push({ value: level, label: level });
  }

  return options;
}

export default function TeacherVideosPage() {
  const subjects = useQuery("functions/academic/lessonKnowledgeTeacher:listTeacherLibrarySubjects" as never) as TeacherVideoSubject[] | undefined;
  const assignableClasses = useQuery("functions/academic/teacherSelectors:getTeacherAssignableClasses" as never) as TeacherVideoClassSummary[] | undefined;
  const videosData = useQuery("functions/academic/lessonKnowledgeTeacher:listTeacherYoutubeSubmissions" as never, { limit: 100 } as never) as TeacherVideoResponse | undefined;
  const submitVideo = useMutation("functions/academic/lessonKnowledgeIngestion:registerKnowledgeMaterialLink" as never);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [activeForm, setActiveForm] = useState<"submit" | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const subjectOptions = useMemo(() => subjects ?? [], [subjects]);
  const levelOptions = useMemo(() => buildLevelOptions(assignableClasses), [assignableClasses]);
  const videos = useMemo(() => videosData?.materials ?? [], [videosData]);
  const summary = videosData?.summary ?? { loaded: 0, privateOwner: 0, staffVisible: 0, readyToSelect: 0, publishable: 0, needsAttention: 0 };

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter(v => 
      v.title.toLowerCase().includes(query) || 
      v.subjectName.toLowerCase().includes(query) ||
      v.topicLabel.toLowerCase().includes(query)
    );
  }, [search, videos]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const normalizedUrl = normalizeYouTubeUrl(externalUrl);
    if (!title.trim() || !normalizedUrl || !subjectId || !level.trim() || !topicLabel.trim()) {
      setNotice({ tone: "error", message: "All fields are required for submission." });
      return;
    }

    setBusy(true);
    try {
      await submitVideo({
        title: title.trim(),
        externalUrl: normalizedUrl,
        description: description.trim() ? description.trim() : null,
        subjectId,
        level: level.trim(),
        topicLabel: topicLabel.trim(),
        uploadIntent: "request_review",
      } as never);
      setNotice({ tone: "success", message: "Video link submitted for review." });
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setTopicLabel("");
      setActiveForm(null);
    } catch (error) {
      setNotice({ tone: "error", message: getUserFacingErrorMessage(error, "Could not submit the link.") });
    } finally {
      setBusy(false);
    }
  }, [description, externalUrl, level, submitVideo, subjectId, title, topicLabel]);

  useEffect(() => {
    if (!level && levelOptions.length > 0) {
      setLevel(levelOptions[0].value);
    }
  }, [level, levelOptions]);

  if (!subjects || !assignableClasses || !videosData) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 bg-surface-200">
        <div className="animate-pulse space-y-10">
          <div className="h-10 w-64 rounded-xl bg-slate-100" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-slate-100" />)}
            </div>
            <div className="h-96 rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  const submissionForm = (
    <section className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[15px] font-black tracking-tight text-slate-950 uppercase">New Submission</h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Add YouTube lesson link</p>
        </div>
      </div>
      
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="YouTube URL" value={externalUrl} onChange={setExternalUrl} placeholder="https://www.youtube.com/..." />
        <Field label="Video Title" value={title} onChange={setTitle} placeholder="Fractions for Beginners" />
        <Field label="Topic Label" value={topicLabel} onChange={setTopicLabel} placeholder="Fractions introduction" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` }))} />
          <Select label="Level" value={level} onChange={setLevel} options={levelOptions} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 opacity-80">Description</span>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows={3} 
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300" 
            placeholder="What should teachers know?" 
          />
        </label>
        <button 
          type="submit" 
          disabled={busy || subjectOptions.length === 0 || levelOptions.length === 0} 
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 shadow-sm"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Submitting" : "Request review"}
        </button>
      </form>
    </section>
  );

  const submissionStats = (
    <section className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[15px] font-black tracking-tight text-slate-950 uppercase">Submission Stats</h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current review queue</p>
        </div>
      </div>
      <div className="grid gap-2.5">
        <MiniStat label="Pending" value={videos.filter((v) => v.reviewStatus === "pending_review").length} />
        <MiniStat label="Approved" value={videos.filter((v) => v.reviewStatus === "approved").length} />
        <MiniStat label="Needs Attention" value={summary.needsAttention} tone="warn" />
      </div>
    </section>
  );

  return (
    <div className="relative min-h-screen lg:h-[calc(100vh-64px)] lg:overflow-hidden flex flex-col bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      <TeacherSheet
        isOpen={Boolean(activeForm) && isMobile}
        onClose={() => setActiveForm(null)}
        title="Submit Video"
      >
        {submissionForm}
      </TeacherSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 lg:overflow-hidden">
        <main className="flex-1 min-w-0 w-full lg:h-full lg:overflow-y-auto px-4 py-6 md:px-8 md:py-10 custom-scrollbar">
          <div className="w-full max-w-[1200px] mx-auto space-y-8">
            <TeacherHeader
              title="Videos"
              label="Academic Engine"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Loaded",
                      value: summary.loaded,
                      icon: <Link2 className="h-4 w-4" />,
                    },
                    {
                      label: "Needs Review",
                      value: summary.needsAttention,
                      icon: <AlertTriangle className="h-4 w-4" />,
                    },
                  ]}
                />
              }
            />

            {notice && (
              <div className={cn(
                "group relative overflow-hidden rounded-lg border-l-4 p-4 shadow-sm transition-all bg-white",
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              )}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  <button onClick={() => setNotice(null)} className="rounded-full p-1 hover:bg-slate-50 opacity-30 hover:opacity-100 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">Submissions</h3>
                <p className="text-xs font-medium text-slate-400">Track and manage your video resources.</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter videos..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-[13px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300 shadow-sm"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {filteredVideos.map((video) => (
                <article key={video._id} className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-slate-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <StatusBadge kind="review" value={video.reviewStatus} />
                        <StatusBadge kind="processing" value={video.processingStatus} />
                      </div>
                      <h2 className="truncate text-base font-black tracking-tight text-slate-950 group-hover:text-sky-700 transition-colors">
                        {video.title}
                      </h2>
                      <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {video.subjectName} • {video.level}
                      </p>
                    </div>
                    {normalizeYouTubeUrl(video.externalUrl ?? "") && (
                      <a
                        href={normalizeYouTubeUrl(video.externalUrl ?? "")}
                        target="_blank" 
                        rel="noreferrer"
                        aria-label={`Open ${video.title} on YouTube`}
                        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-100 transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <div className="space-y-3 border-y border-slate-50 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Topic Context</span>
                      <span className="text-[11px] font-bold text-slate-950">{video.topicLabel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submission Date</span>
                      <span className="text-[11px] font-bold text-slate-500">{formatDate(video.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-medium text-slate-400 italic">By {video.ownerName}</p>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      badgeTone("visibility", video.visibility)
                    )}>
                      {video.visibility.replace(/_/g, " ")}
                    </span>
                  </div>
                </article>
              ))}

              {filteredVideos.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                  <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    <History className="h-6 w-6 text-slate-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-black text-slate-950 uppercase tracking-wider">No Submissions Found</p>
                    <p className="text-[12px] font-medium text-slate-400 max-w-[240px]">
                      {search ? (
                        "Adjust your search to find what you're looking for."
                      ) : (
                        <>
                          <span className="inline sm:hidden">Tap the + button to submit your first YouTube link.</span>
                          <span className="hidden sm:inline">Start by submitting your first YouTube link on the right.</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden lg:block w-[420px] lg:h-full lg:overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl px-8 py-10 custom-scrollbar z-10">
          <div className="space-y-8">
            {submissionForm}
            {submissionStats}
          </div>
        </aside>

        <div className="lg:hidden fixed bottom-6 right-6 z-50">
          <button
            type="button"
            aria-label="Submit video"
            onClick={() => setActiveForm("submit")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl active:scale-95 transition-transform"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.1);
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ kind, value }: { kind: "review" | "processing"; value: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
      badgeTone(kind, value)
    )}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 opacity-80">{label}</span>
      <input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300" 
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 opacity-80">{label}</span>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
      >
        <option value="">Choose...</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn"; }) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm transition-all",
      tone === "warn" ? "border-amber-100 bg-amber-50/50" : "border-slate-100 bg-slate-50/30 hover:bg-white"
    )}>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="text-[15px] font-black tracking-tight text-slate-950">{value}</span>
    </div>
  );
}
