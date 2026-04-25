"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

type QuestionStyle = "balanced" | "open_ended_heavy" | "mixed_open_ended" | "objective_heavy";
type QuestionMix = {
  multiple_choice: number;
  short_answer: number;
  essay: number;
  true_false: number;
  fill_in_the_blank: number;
};
type Profile = {
  _id: string;
  name: string;
  description: string | null;
  questionStyle: QuestionStyle;
  totalQuestions: number;
  questionMix: QuestionMix;
  allowTeacherOverrides: boolean;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: number;
};

const blankMix: QuestionMix = { multiple_choice: 3, short_answer: 4, essay: 1, true_false: 1, fill_in_the_blank: 1 };
const mixFields: Array<{ key: keyof QuestionMix; label: string }> = [
  { key: "multiple_choice", label: "Multiple choice" },
  { key: "short_answer", label: "Short answer" },
  { key: "essay", label: "Essay" },
  { key: "true_false", label: "True/false" },
  { key: "fill_in_the_blank", label: "Fill blank" },
];

function mixTotal(mix: QuestionMix) {
  return Object.values(mix).reduce((sum, value) => sum + value, 0);
}

function defaultDraft(): Omit<Profile, "_id" | "updatedAt"> & { profileId: string | null } {
  return {
    profileId: null,
    name: "Open-ended mixed profile",
    description: "Reusable assessment authoring defaults for teacher generation.",
    questionStyle: "mixed_open_ended",
    totalQuestions: mixTotal(blankMix),
    questionMix: blankMix,
    allowTeacherOverrides: true,
    isDefault: false,
    isActive: true,
  };
}

export default function AssessmentGenerationProfilesPage() {
  const profiles = useQuery(
    "functions/academic/lessonKnowledgeAssessmentProfiles:listAssessmentGenerationProfiles" as never,
    { includeInactive: true } as never
  ) as Profile[] | undefined;
  const saveProfile = useMutation(
    "functions/academic/lessonKnowledgeAssessmentProfiles:saveAssessmentGenerationProfile" as never
  );
  const [draft, setDraft] = useState(defaultDraft());
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const sortedProfiles = useMemo(() => profiles ?? [], [profiles]);

  const updateMix = (key: keyof QuestionMix, value: number) => {
    setDraft((current) => {
      const questionMix = { ...current.questionMix, [key]: Math.max(0, Math.min(60, value)) };
      return { ...current, questionMix, totalQuestions: mixTotal(questionMix) };
    });
  };

  const editProfile = (profile: Profile) => {
    setDraft({
      profileId: profile._id,
      name: profile.name,
      description: profile.description,
      questionStyle: profile.questionStyle,
      totalQuestions: profile.totalQuestions,
      questionMix: profile.questionMix,
      allowTeacherOverrides: profile.allowTeacherOverrides,
      isDefault: profile.isDefault,
      isActive: profile.isActive,
    });
  };

  const submit = async () => {
    try {
      await saveProfile({ ...draft } as never);
      setNotice({ tone: "success", message: "Assessment generation profile saved." });
    } catch (error) {
      setNotice({ tone: "error", message: getUserFacingErrorMessage(error, "Failed to save profile.") });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Lesson Knowledge Hub</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Assessment generation profiles</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Manage reusable school-scoped question mix and open-ended direction defaults for teacher assessment drafting.
        </p>
      </div>

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {(sortedProfiles.length ? sortedProfiles : []).map((profile) => (
            <button key={profile._id} type="button" onClick={() => editProfile(profile)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-950">{profile.name}</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{profile.isDefault ? "Default" : profile.isActive ? "Active" : "Inactive"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{profile.totalQuestions} questions • {profile.questionStyle.replace(/_/g, " ")}</p>
            </button>
          ))}
          <button type="button" onClick={() => setDraft(defaultDraft())} className="h-11 w-full rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-700">New profile</button>
        </aside>

        <main className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">Name
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="text-sm font-bold text-slate-700">Question style
              <select value={draft.questionStyle} onChange={(event) => setDraft((current) => ({ ...current, questionStyle: event.target.value as QuestionStyle }))} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm">
                <option value="balanced">Balanced</option>
                <option value="mixed_open_ended">Mixed open-ended</option>
                <option value="open_ended_heavy">Open-ended heavy</option>
                <option value="objective_heavy">Objective heavy</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-bold text-slate-700">Description
            <textarea value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 p-3 text-sm" />
          </label>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {mixFields.map((field) => (
              <label key={field.key} className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{field.label}
                <input type="number" min={0} max={60} value={draft.questionMix[field.key]} onChange={(event) => updateMix(field.key, Number.parseInt(event.target.value || "0", 10))} className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-right text-sm" />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-4">
            <span className="text-sm font-black text-slate-800">Total: {draft.totalQuestions}</span>
            <label className="text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.allowTeacherOverrides} onChange={(event) => setDraft((current) => ({ ...current, allowTeacherOverrides: event.target.checked }))} className="mr-2" /> Teachers may override mix</label>
            <label className="text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))} className="mr-2" /> School default</label>
            <label className="text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} className="mr-2" /> Active</label>
          </div>
          <button type="button" onClick={submit} className="mt-5 h-11 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white">Save profile</button>
        </main>
      </div>
    </div>
  );
}
