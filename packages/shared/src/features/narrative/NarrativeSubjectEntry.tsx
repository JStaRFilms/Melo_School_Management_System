"use client";

import { useEffect, useState } from "react";

export type EntrySelection = { sessionId: string | null; termId: string | null; classId: string | null; subjectId: string | null };
export type EntryOption = { id: string; name: string };
export type CommentRow = { studentId: string; studentName: string; comment: string; issued: boolean };

export function NarrativeSubjectEntry({ selection, sessions, terms, classes, subjects, rows, subjectUnavailable = false, onSelect, onSave }: {
  selection: EntrySelection;
  sessions: EntryOption[]; terms: EntryOption[]; classes: EntryOption[]; subjects: EntryOption[];
  rows?: CommentRow[];
  subjectUnavailable?: boolean;
  onSelect: (field: keyof EntrySelection, value: string) => void;
  onSave: (studentId: string, comment: string) => Promise<void>;
}) {
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const fields = [
    { key: "sessionId", label: "Session", options: sessions },
    { key: "termId", label: "Term", options: terms },
    { key: "classId", label: "Class", options: classes },
    { key: "subjectId", label: "Subject", options: subjects },
  ] as const;
  return <main className="mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-8">
    <h1 className="text-2xl font-bold">Subject comments</h1>
    <p className="text-sm text-slate-600">Save one comment for each student in this subject. Drafts are not visible to families until an admin publishes the report.</p>
    <p className="text-sm text-slate-600">If a selected subject is missing, ask a school admin to restore its class offering and teacher assignment, or update the pupil's subject selections in Academic / Students.</p>
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="block text-sm font-semibold">{field.label}
      <select className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2 focus-visible:ring-2 focus-visible:ring-slate-900" value={selection[field.key] ?? ""} onChange={e => { if (dirtyIds.length && !window.confirm("Discard unsaved comments and change selection?")) return; setDirtyIds([]); onSelect(field.key, e.target.value); }}>
        <option value="">Select {field.label.toLowerCase()}</option>{field.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select></label>)}</div>
    {subjectUnavailable ? <p role="alert">Subject unavailable. Choose another subject from the list.</p> : !selection.subjectId ? <p role="status">Choose a subject to load its student roster.</p> : rows === undefined ? <p role="status">Loading comments...</p> : rows.length === 0 ? <p role="status">No enrolled students are assigned this subject. Check class subject assignments and student selections.</p> :
      <div className="space-y-4">{rows.map(row => <CommentEditor key={`${selection.sessionId}-${selection.termId}-${selection.classId}-${selection.subjectId}-${row.studentId}`} row={row} onSave={onSave} onDirtyChange={dirty => setDirtyIds(ids => dirty ? (ids.includes(row.studentId) ? ids : [...ids, row.studentId]) : ids.filter(id => id !== row.studentId))} />)}</div>}
  </main>;
}

function CommentEditor({ row, onSave, onDirtyChange }: { row: CommentRow; onSave: (studentId: string, comment: string) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [comment, setComment] = useState(row.comment);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = comment !== row.comment;
  useEffect(() => { if (!dirty) setComment(row.comment); }, [row.comment, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <label htmlFor={`comment-${row.studentId}`} className="mb-2 block font-semibold">{row.studentName} - subject comment</label>
    <textarea id={`comment-${row.studentId}`} className="min-h-28 w-full rounded-lg border border-slate-300 p-3 focus-visible:ring-2 focus-visible:ring-slate-900 disabled:bg-slate-100" maxLength={10000} value={comment} disabled={row.issued || saving} onChange={e => { setComment(e.target.value); onDirtyChange(e.target.value !== row.comment); setMessage(""); }} />
    <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" disabled={row.issued || saving || !dirty} className="min-h-11 rounded-lg bg-slate-900 px-4 text-white disabled:opacity-50" onClick={async () => {
      setSaving(true); setMessage("");
      try { await onSave(row.studentId, comment); onDirtyChange(false); setMessage("Draft saved. Not visible to families until published."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Please retry."); }
      finally { setSaving(false); }
    }}>{saving ? "Saving..." : "Save draft"}</button><span role="status" aria-live="polite" className="text-sm text-slate-700">{row.issued ? "Published - read only" : message || (dirty ? "Unsaved changes" : "Draft")}</span></div>
  </section>;
}
