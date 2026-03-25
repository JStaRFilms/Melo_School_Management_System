"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpenText, Plus, Shapes } from "lucide-react";
import { humanNameFinal, humanNameTyping } from "@/human-name";

type SubjectRecord = {
  _id: string;
  name: string;
  code: string;
  createdAt: number;
};

export default function SubjectsPage() {
  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as SubjectRecord[] | undefined;

  const createSubject = useMutation(
    "functions/academic/academicSetup:createSubject" as never
  );
  const updateSubject = useMutation(
    "functions/academic/academicSetup:updateSubject" as never
  );

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const selectedSubject =
    subjects?.find((subject) => subject._id === selectedSubjectId) ?? null;

  useEffect(() => {
    if (!selectedSubject) {
      return;
    }

    setEditName(selectedSubject.name);
    setEditCode(selectedSubject.code);
  }, [selectedSubject]);

  const subjectStats = useMemo(() => {
    if (!subjects) {
      return { total: 0, recent: 0 };
    }

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: subjects.length,
      recent: subjects.filter((subject) => subject.createdAt >= oneWeekAgo).length,
    };
  }, [subjects]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSubjectName = humanNameFinal(name);
    if (!normalizedSubjectName || !code.trim()) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await createSubject({
        name: normalizedSubjectName,
        code: code.trim().toUpperCase(),
      } as never);
      setName("");
      setCode("");
      setSuccessMessage("Subject catalog updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSubject) {
      return;
    }

    const normalizedName = humanNameFinal(editName);
    const normalizedCode = editCode.trim().toUpperCase();
    if (!normalizedName || !normalizedCode) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsUpdating(true);

    try {
      await updateSubject({
        subjectId: selectedSubject._id,
        name: normalizedName,
        code: normalizedCode,
      } as never);
      setSuccessMessage("Subject updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subject");
    } finally {
      setIsUpdating(false);
    }
  };

  if (subjects === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 py-6 pb-28 sm:px-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={<BookOpenText className="h-4 w-4" />}
          label="Catalog Entries"
          value={String(subjectStats.total)}
          tone="bg-[#0f172a] text-white"
          helper="School-wide subjects available for class offerings."
        />
        <StatCard
          icon={<Shapes className="h-4 w-4" />}
          label="Added This Week"
          value={String(subjectStats.recent)}
          tone="border border-[#e2e8f0] bg-white text-[#0f172a]"
          helper="Recently added subjects that can now be attached to classes."
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
              Subject Catalog
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
              Define the subject list used across sessions and classes.
            </p>
          </div>
          <span className="rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-[#64748b]">
            Step 1 of Setup
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                Subject Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(humanNameTyping(event.target.value))}
                onBlur={(event) => setName(humanNameFinal(event.target.value))}
                className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                placeholder="Mathematics"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                Subject Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold uppercase text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                placeholder="MAT"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !code.trim()}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-lg shadow-[#4f46e5]/10 transition-all hover:bg-[#4338ca] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 text-white/50" />
              {isSubmitting ? "Creating..." : "Add Subject"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
              Live Catalog
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
              Reused by class blueprints and student selection grids.
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">
            {subjects.length} subjects
          </span>
        </div>

        {subjects.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#94a3b8]">
            No subjects yet. Add your first subject above.
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {subjects.map((subject) => (
              <div
                key={subject._id}
                onClick={() => setSelectedSubjectId(subject._id)}
                className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-4 transition-colors sm:px-5 ${
                  selectedSubjectId === subject._id ? "bg-[#eef2ff]" : "hover:bg-[#f8fafc]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0f172a]">
                    {subject.name}
                  </p>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                    {subject.code}
                  </p>
                </div>
                <div className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-[#64748b]">
                  {new Date(subject.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedSubject ? (
        <section className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
              Edit Subject
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
              Changes update the catalog used by class offerings and enrollment selectors.
            </p>
          </div>

          <form onSubmit={handleUpdateSubject} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(humanNameTyping(event.target.value))}
                  onBlur={(event) => setEditName(humanNameFinal(event.target.value))}
                  className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(event) => setEditCode(event.target.value.toUpperCase())}
                  className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold uppercase text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdating || !editName.trim() || !editCode.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-xl transition-all hover:bg-[#1e293b] disabled:opacity-50"
            >
              <Shapes className="h-4 w-4 text-white/50" />
              {isUpdating ? "Saving..." : "Save Subject"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
  helper: string;
}) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${tone}`}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
        {icon}
      </div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-3 text-xs font-medium opacity-70">{helper}</p>
    </div>
  );
}
