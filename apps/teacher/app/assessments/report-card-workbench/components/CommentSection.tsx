"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportCardSheetData } from "@school/shared";

export function CommentSection({
  reportCard,
  isLoading,
  canEditHeadTeacherComment,
  onSave,
}: {
  reportCard?: ReportCardSheetData;
  isLoading: boolean;
  canEditHeadTeacherComment: boolean;
  onSave: (payload: {
    classTeacherComment: string | null;
    headTeacherComment?: string | null;
  }) => Promise<void>;
}) {
  const [classDraft, setClassDraft] = useState("");
  const [headDraft, setHeadDraft] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "saving" }
    | { type: "success" }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const initialClassVal = reportCard?.classTeacherComment || "";
  const initialHeadVal = reportCard?.headTeacherComment || "";
  const txRef = useRef<number | null>(null);

  useEffect(() => {
    setClassDraft(initialClassVal);
    setHeadDraft(initialHeadVal);
    setStatus({ type: "idle" });
  }, [
    initialClassVal,
    initialHeadVal,
    reportCard?.student._id,
    reportCard?.sessionName,
    reportCard?.termName,
  ]);

  const handleChange = (type: "class" | "head", value: string) => {
    const next = value.slice(0, 1000);
    if (type === "class") setClassDraft(next);
    if (type === "head") setHeadDraft(next);

    if (txRef.current) clearTimeout(txRef.current);

    setStatus({ type: "saving" });
    txRef.current = window.setTimeout(async () => {
      try {
        await onSave({
          classTeacherComment:
            type === "class" ? next || null : classDraft || null,
          headTeacherComment:
            type === "head" ? next || null : headDraft || null,
        });
        setStatus({ type: "success" });
        setTimeout(() => setStatus({ type: "idle" }), 2000);
      } catch (err) {
        setStatus({
          type: "error",
          message:
            err instanceof Error ? err.message : "Failed to save comment",
        });
      }
    }, 1200);
  };

  /* ---- Loading state ---- */
  if (isLoading || !reportCard) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
        Select a student above to write comments.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* ---- Head Teacher Comment ---- */}
      {canEditHeadTeacherComment ? (
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Head Teacher Comment
            </label>

            {/* Inline Saving Status */}
            <div className="text-[10px] h-4 font-bold uppercase tracking-wider">
              {status.type === "saving" && (
                <span className="animate-pulse text-slate-500">Saving...</span>
              )}
              {status.type === "success" && (
                <span className="text-emerald-600">Saved</span>
              )}
              {status.type === "error" && (
                <span className="text-rose-600" title={status.message}>
                  Error
                </span>
              )}
            </div>
          </div>

          <textarea
            value={headDraft}
            onChange={(e) => handleChange("head", e.target.value)}
            placeholder="Enter head teacher comments..."
            className="min-h-[120px] w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-[13px] font-medium leading-relaxed text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none"
          />

          {/* Action bar / Character count */}
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`text-[10px] font-bold tracking-widest ${
                headDraft.length >= 1000 ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {headDraft.length}/1000
            </span>
            {headDraft !== initialHeadVal && status.type !== "saving" && (
              <button
                type="button"
                onClick={() => {
                  setHeadDraft(initialHeadVal);
                  setStatus({ type: "idle" });
                }}
                className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-800"
              >
                Revert
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="absolute left-0 top-0 h-full w-1 bg-slate-300" />
          <label className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Head Teacher Comment
          </label>
          <p className="text-[13px] font-medium leading-relaxed text-slate-500">
            {reportCard.headTeacherComment ||
              "No comment provided yet by the head teacher."}
          </p>
        </div>
      )}

      {/* ---- Class Teacher Comment ---- */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Class Teacher Comment
          </label>

          {/* Inline Saving Status */}
          <div className="text-[10px] h-4 font-bold uppercase tracking-wider">
            {status.type === "saving" && (
              <span className="animate-pulse text-slate-500">Saving...</span>
            )}
            {status.type === "success" && (
              <span className="text-emerald-600">Saved</span>
            )}
            {status.type === "error" && (
              <span className="text-rose-600" title={status.message}>
                Error Saving
              </span>
            )}
          </div>
        </div>

        <textarea
          value={classDraft}
          onChange={(e) => handleChange("class", e.target.value)}
          placeholder="Enter comments about this student's performance..."
          className="min-h-[120px] w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-[13px] font-medium leading-relaxed text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none"
        />

        {/* Action bar / Character count */}
        <div className="mt-3 flex items-center justify-between">
          <span
            className={`text-[10px] font-bold tracking-widest ${
              classDraft.length >= 1000 ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {classDraft.length}/1000
          </span>
          {classDraft !== initialClassVal && status.type !== "saving" && (
            <button
              type="button"
              onClick={() => {
                setClassDraft(initialClassVal);
                setStatus({ type: "idle" });
              }}
              className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-800"
            >
              Revert
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
