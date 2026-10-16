"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import { LifecycleLoadMore } from "@/components/lifecycle/LifecycleHistory";
import { lifecycleButton, lifecycleInput } from "@/components/lifecycle/LifecycleContextFields";

type Status = FunctionArgs<typeof api.functions.academic.studentEnrollment.listStudentEnrollmentDirectory>["status"];
export function StudentEnrollmentDirectory({ status, onStatusChange, selectedStudentId, onSelect }: {
  status: Status; onStatusChange: (status: Status) => void; selectedStudentId: string | null; onSelect: (studentId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const directory = usePaginatedQuery(api.functions.academic.studentEnrollment.listStudentEnrollmentDirectory, { status }, { initialNumItems: 25 });
  const options: { value: Status; label: string }[] = [{ value: "active", label: "Active" }, { value: "suspended", label: "Inactive • Suspended" }, { value: "withdrawn", label: "Inactive • Withdrawn" }, { value: "graduated", label: "Inactive • Graduated" }, { value: "transferred_out", label: "Inactive • Transferred out" }];
  const query = search.trim().toLowerCase();
  const rows = directory.results.filter(row => `${row.studentName} ${row.admissionNumber}`.toLowerCase().includes(query));
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Student directory">
    <h2 className="font-semibold">Student directory</h2>
    <p className="text-sm text-slate-600">Find active or inactive students independently of the class and session matrix. Search covers loaded pages; load more to continue.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Enrollment filter<select className={lifecycleInput} value={status} onChange={e => { const next = options.find(o => o.value === e.target.value); if (next) onStatusChange(next.value); }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="text-sm">Search students<input type="search" className={lifecycleInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or admission number" /></label>
    </div>
    <ul className="grid gap-2 sm:grid-cols-2">{rows.map(row => <li key={row.studentId}><button type="button" className={`${lifecycleButton} w-full text-left`} aria-pressed={row.studentId === selectedStudentId} onClick={() => onSelect(row.studentId)}>{row.studentName} • {row.admissionNumber}<span className="block text-xs font-normal">{row.status.replaceAll("_", " ")}</span></button></li>)}</ul>
    {directory.status === "LoadingFirstPage" ? <p role="status">Loading students...</p> : rows.length === 0 && <p>No matching students in loaded pages.{directory.status !== "Exhausted" ? " Continue loading, including empty pages." : ""}</p>}
    <LifecycleLoadMore status={directory.status} loadMore={directory.loadMore} label="Load more students" />
  </section>;
}
