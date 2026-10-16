"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import { LifecycleLoadMore } from "@/components/lifecycle/LifecycleHistory";
import { lifecycleButton, lifecycleInput } from "@/components/lifecycle/LifecycleContextFields";

type DirectoryArgs = FunctionArgs<typeof api.functions.academic.academicSetup.listStaffServiceDirectory>;
export function StaffServiceDirectory({ schoolId, role, selectedUserId, onSelect, onStatusChange }: {
  schoolId: DirectoryArgs["schoolId"]; role: DirectoryArgs["role"]; selectedUserId: string | null; onSelect: (id: DirectoryRowId) => void; onStatusChange?: (status: DirectoryArgs["status"]) => void;
}) {
  const [status, setStatus] = useState<DirectoryArgs["status"]>("active");
  const [search, setSearch] = useState("");
  const directory = usePaginatedQuery(api.functions.academic.academicSetup.listStaffServiceDirectory, { schoolId, role, status }, { initialNumItems: 25 });
  const query = search.trim().toLowerCase();
  const rows = directory.results.filter(row => `${row.name} ${row.email}`.toLowerCase().includes(query));
  return <section className="space-y-3" aria-label={`${role ?? "Staff"} service directory`}>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Service filter<select className={lifecycleInput} value={status} onChange={e => { const next = e.target.value === "departed" ? "departed" : "active"; setStatus(next); onStatusChange?.(next); }}><option value="active">Active</option><option value="departed">Departed</option></select></label>
      <label className="text-sm">Search service directory<input type="search" className={lifecycleInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" /></label>
    </div>
    <p className="text-xs text-slate-600">Search covers loaded pages. Empty source pages may still have a continuation. Archive is separate from departure.</p>
    <ul className="grid gap-2 sm:grid-cols-2">{rows.map(row => <li key={row.userId}><button type="button" className={`${lifecycleButton} w-full text-left`} aria-pressed={selectedUserId === row.userId} onClick={() => onSelect(row.userId)}>{row.name}<span className="block text-xs font-normal">{row.email} • {row.status} • {row.role}</span></button></li>)}</ul>
    {directory.status === "LoadingFirstPage" ? <p role="status">Loading staff...</p> : rows.length === 0 && <p>No matching staff in loaded pages.</p>}
    <LifecycleLoadMore status={directory.status} loadMore={directory.loadMore} label="Load more staff" />
  </section>;
}

type DirectoryRowId = FunctionArgs<typeof api.functions.academic.academicSetup.getStaffServiceProfile>["userId"];
