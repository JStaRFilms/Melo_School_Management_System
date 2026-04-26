"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link2, Loader2, ShieldCheck, Sparkles, Upload } from "lucide-react";

import { getUserFacingErrorMessage } from "@school/shared";

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
        : "border-slate-200 bg-slate-950 text-white";
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
  return trimmed;
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


  const subjectOptions = useMemo(() => subjects ?? [], [subjects]);
  const levelOptions = useMemo(() => buildLevelOptions(assignableClasses), [assignableClasses]);
  const videos = useMemo(() => videosData?.materials ?? [], [videosData]);
  const summary = videosData?.summary ?? { loaded: 0, privateOwner: 0, staffVisible: 0, readyToSelect: 0, publishable: 0, needsAttention: 0 };

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const normalizedUrl = normalizeYouTubeUrl(externalUrl);
    if (!title.trim() || !normalizedUrl || !subjectId || !level.trim() || !topicLabel.trim()) {
      setNotice({ tone: "error", message: "Add a title, YouTube link, subject, level, and topic context." });
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
      setNotice({ tone: "success", message: "YouTube link submitted for review." });
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setTopicLabel("");
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
    return <div className="p-6 text-sm text-slate-500">Loading videos...</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-200">
              <Link2 className="h-3.5 w-3.5" />
              Video submissions
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Submit YouTube links for approval.</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Keep video resources inside the lesson knowledge hub. Submit a link with its lesson context, then track whether it is still pending, approved, rejected, or ready for topic attachment.
            </p>
          </div>
        </div>
      </section>

      {notice ? <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>{notice.message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {videos.map((video) => (
            <article key={video._id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeTone("visibility", video.visibility)}`}>{video.visibility.replace(/_/g, " ")}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeTone("review", video.reviewStatus)}`}>{video.reviewStatus.replace(/_/g, " ")}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeTone("processing", video.processingStatus)}`}>{video.processingStatus.replace(/_/g, " ")}</span>
              </div>
              <h2 className="mt-3 text-lg font-black tracking-tight text-slate-950">{video.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{video.description ?? video.topicLabel}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Meta label="Subject" value={`${video.subjectName} • ${video.subjectCode}`} />
                <Meta label="Level" value={video.level} />
                <Meta label="Topic" value={video.topicLabel} />
                <Meta label="Owner" value={video.ownerName} />
              </div>
              {video.externalUrl ? <a className="mt-4 inline-flex text-sm font-bold text-sky-700 underline decoration-sky-200 underline-offset-4" href={video.externalUrl} target="_blank" rel="noreferrer">Open YouTube link</a> : null}
              <p className="mt-3 text-xs font-medium text-slate-400">Updated {formatDate(video.updatedAt)} • Created {formatDate(video.createdAt)}</p>
            </article>
          ))}

          {videos.length === 0 ? <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">No video submissions yet.</div> : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white"><Upload className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Submit video</p>
                <h2 className="text-lg font-black tracking-tight text-slate-950">Add a YouTube lesson link</h2>
              </div>
            </div>
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <Field label="YouTube URL" value={externalUrl} onChange={setExternalUrl} placeholder="https://www.youtube.com/watch?v=..." />
              <Field label="Title" value={title} onChange={setTitle} placeholder="Fractions for beginners" />
              <Field label="Topic context" value={topicLabel} onChange={setTopicLabel} placeholder="Fractions introduction" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` }))} />
                <Select label="Level" value={level} onChange={setLevel} options={levelOptions} />
              </div>
              <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5" placeholder="What should teachers know about the video?" /></label>
              <button type="submit" disabled={busy || subjectOptions.length === 0 || levelOptions.length === 0} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? "Submitting" : "Request review"}</button>
              <p className="text-xs leading-5 text-slate-500">Submitted links stay hidden from student topic pages until they are approved and attached to a topic by an admin.</p>
            </form>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Review state</p><h2 className="text-lg font-black tracking-tight text-slate-950">Approval remains school-aware</h2></div></div>
            <div className="mt-5 grid gap-3">
              <MiniStat label="Pending" value={videos.filter((video) => video.reviewStatus === "pending_review").length} />
              <MiniStat label="Approved" value={videos.filter((video) => video.reviewStatus === "approved").length} />
              <MiniStat label="Rejected" value={videos.filter((video) => video.reviewStatus === "rejected").length} tone="warn" />
              <MiniStat label="Needs attention" value={summary.needsAttention} tone="warn" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-950">{value}</p></div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5"><option value="">Choose...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn"; }) {
  return <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${tone === "warn" ? "border-amber-100 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span><span className="text-base font-black tracking-tight text-slate-950">{value}</span></div>;
}
