"use client";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

type Option = { id: string; name: string };
type ModeRow = { classId: string; mode: "graded" | "narrative"; locked: boolean };
export default function ReportingModesPage() {
  const sessions = useQuery("functions/academic/adminSelectors:getAdminSessions" as never) as Option[] | undefined;
  const classes = useQuery("functions/academic/adminSelectors:getAllClasses" as never) as Option[] | undefined;
  const [sessionId, setSessionId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"graded" | "narrative">("narrative");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useQuery("functions/academic/narrativeReports:listClassModes" as never, sessionId ? { sessionId } as never : "skip") as ModeRow[] | undefined;
  const setModes = useMutation("functions/academic/narrativeReports:setClassModes" as never);
  return <main className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-8">
    <h1 className="text-2xl font-bold">Reporting modes</h1>
    <p className="text-sm text-slate-600">Choose how selected classes report for this session. Classes use scores and grades unless changed here. Issued reports lock that class for the session.</p>
    <Link href="/academic/subjects" className="underline">Manage subjects and class assignments in Academic Structure</Link>
    <label className="block font-semibold">Academic session<select className="mt-1 block min-h-11 w-full rounded border p-2" value={sessionId} onChange={e => { setSessionId(e.target.value); setSelected([]); setMessage(""); }}><option value="">Select session</option>{sessions?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {!sessionId ? <p>Select a session to see classes.</p> : !rows || !classes ? <p role="status">Loading classes...</p> : <>
      <fieldset className="space-y-2"><legend className="font-semibold">Classes ({selected.length} selected)</legend>{rows.length === 0 ? <p>No active classes found.</p> : rows.map(row => <label key={row.classId} className="flex min-h-11 items-center gap-3 rounded border p-3"><input type="checkbox" disabled={row.locked} checked={selected.includes(row.classId)} onChange={e => setSelected(old => e.target.checked ? [...old, row.classId] : old.filter(id => id !== row.classId))} /><span>{classes.find(c => c.id === row.classId)?.name ?? "Class"} - {row.mode === "narrative" ? "Comments" : "Scores and grades"}{row.locked ? " (locked: report issued)" : ""}</span></label>)}</fieldset>
      <fieldset className="space-y-2"><legend className="font-semibold">Set selected classes to</legend><label className="mr-4 inline-flex min-h-11 items-center gap-2"><input type="radio" checked={mode === "narrative"} onChange={() => setMode("narrative")} />Comments</label><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" checked={mode === "graded"} onChange={() => setMode("graded")} />Scores and grades</label></fieldset>
      <button type="button" disabled={!selected.length || saving} className="min-h-11 rounded bg-slate-900 px-5 text-white disabled:opacity-50" onClick={async () => {
        if (!window.confirm(`Switch ${selected.length} class(es) to ${mode === "narrative" ? "Comments" : "Scores and grades"} for this session? Unpublished work in the previous mode stays saved but will not be active. This does not change enrollment or subjects.`)) return;
        setSaving(true); setMessage("");
        try { await setModes({ sessionId, classIds: selected, mode } as never); setSelected([]); setMessage("Reporting modes saved."); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Try again."); }
        finally { setSaving(false); }
      }}>{saving ? "Saving..." : "Save choices"}</button><p role="status" aria-live="polite">{message}</p>
    </>}
  </main>;
}
