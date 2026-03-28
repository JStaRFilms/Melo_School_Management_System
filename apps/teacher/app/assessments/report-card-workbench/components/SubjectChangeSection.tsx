"use client";

import { useEffect, useMemo, useState } from "react";

import type { SubjectMatrix } from "./types";

export function SubjectSection({
  matrix,
  selectedStudentId,
  isLoading,
  onSave,
}: {
  matrix?: SubjectMatrix;
  selectedStudentId: string | null;
  isLoading: boolean;
  onSave: (subjectIds: string[]) => Promise<void>;
}) {
  const selectedStudent = useMemo(
    () => matrix?.students.find((s) => s._id === selectedStudentId),
    [matrix?.students, selectedStudentId]
  );
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "saving" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  useEffect(() => {
    setDraftIds(selectedStudent?.selectedSubjectIds ?? []);
    setStatus({ type: "idle" });
  }, [selectedStudent?.selectedSubjectIds, selectedStudentId]);

  const toggle = (id: string) => {
    setDraftIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
    if (status.type !== "idle" && status.type !== "saving") {
      setStatus({ type: "idle" });
    }
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    setStatus({ type: "saving" });
    try {
      await onSave(draftIds);
      setStatus({
        type: "success",
        message: `Saved for ${selectedStudent.studentName}.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Unable to save subject changes right now.",
      });
    }
  };

  /* ---- Empty / loading ---- */
  if ((isLoading && !matrix) || !matrix || !selectedStudent) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-center text-sm text-slate-500">
        {isLoading && !matrix
          ? "Loading subject matrix..."
          : !matrix
            ? "Select a class to load subjects."
            : "Select a student above."}
      </div>
    );
  }

  if (matrix.subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-center text-sm text-slate-500">
        No subjects configured for this class yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
      {/* ---- Accordion pill ---- */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 cursor-pointer flex items-center justify-between outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900 transition-colors border-none"
      >
        <div className="flex items-center gap-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : "rotate-0"}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
            Subjects
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-900">
          <span className="font-bold">{draftIds.length}</span> of {matrix.subjects.length} selected
        </span>
      </button>

      {/* ---- Subject chips (Collapsible) ---- */}
      {isExpanded ? (
        <div className="border-t border-slate-100 bg-white">
          <div className="flex flex-wrap gap-2 px-5 py-5">
            {matrix.subjects.map((sub) => {
              const on = draftIds.includes(sub._id);
              return (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => toggle(sub._id)}
                  disabled={status.type === "saving"}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    on
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>

          {/* ---- Status + save ---- */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50/50">
            <div className="text-[11px]">
              {status.type === "success" ? (
                <span className="font-semibold text-emerald-600">
                  OK {status.message}
                </span>
              ) : status.type === "error" ? (
                <span className="font-semibold text-rose-600">
                  {status.message}
                </span>
              ) : null}
            </div>
            <button
              onClick={handleSave}
              disabled={status.type === "saving"}
              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.type === "saving" ? "Saving..." : "Save subjects"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
