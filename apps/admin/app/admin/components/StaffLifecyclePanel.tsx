"use client";

import Link from "next/link";
import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { useAuth } from "@/AuthProvider";
import { LifecycleEvents, LifecycleLoadMore, LifecyclePeriods } from "@/components/lifecycle/LifecycleHistory";
import { lifecycleButton } from "@/components/lifecycle/LifecycleContextFields";
import { StaffLifecycleActionModal } from "./StaffLifecycleActionModal";

const staff = api.functions.academic.academicSetup;
export function StaffLifecyclePanel({ schoolId, userId }: { schoolId: Id<"schools">; userId: Id<"users"> }) {
  const { workspaceAccess } = useAuth();
  const allowed = hasEffectiveCapability(workspaceAccess, "staff.list.view");
  const profile = useQuery(staff.getStaffServiceProfile, allowed ? { schoolId, userId } : "skip");
  const history = usePaginatedQuery(staff.getStaffServiceHistory, allowed ? { schoolId, userId } : "skip", { initialNumItems: 25 });
  const periods = usePaginatedQuery(staff.getStaffServicePeriods, allowed ? { schoolId, userId } : "skip", { initialNumItems: 25 });
  const [action, setAction] = useState<"depart" | "rehire">();
  const [saved, setSaved] = useState("");
  if (!allowed) return null;
  if (!profile) return <p role="status">Loading service record...</p>;
  const blockers = profile.status === "departed" ? profile.rehireBlockers : profile.departureBlockers;
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Staff service">
    <h2 className="font-semibold">{profile.name} • Service {profile.status}</h2>
    <p className="text-sm">{profile.role} • {profile.email}{profile.isArchived ? " • Archived" : ""}</p>
    <div className="flex flex-wrap gap-2">
      {profile.canDepart && <button type="button" className={lifecycleButton} disabled={blockers.length > 0} onClick={() => setAction("depart")}>Record departure</button>}
      {profile.canReviewRehire && <button type="button" className={lifecycleButton} disabled={blockers.length > 0 || profile.isArchived} onClick={() => setAction("rehire")}>Review access and rehire</button>}
    </div>
    {blockers.length > 0 && <div role="alert" className="text-sm"><p>Resolve these restrictions before continuing:</p><ul className="list-disc pl-5">{blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul><p className="mt-2">Reassign teaching/form links in <Link className="underline" href="/academic/classes">Classes</Link> and <Link className="underline" href="/academic/subjects">Subjects</Link>. Transfer leadership and direct reports in <Link className="underline" href="/admin">Admins</Link>. Independent identity or membership restrictions need their existing access-review process.</p></div>}
    {profile.isArchived && <p className="text-sm">Restore removes the archive restriction only. It does not rehire or override independent access restrictions.</p>}
    {saved && <p role="status">{saved}</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Service periods and history</summary><div className="space-y-4 pt-3">
      <LifecyclePeriods periods={periods.results} events={history.results} inactive={profile.status === "departed"} />
      <LifecycleLoadMore status={periods.status} loadMore={periods.loadMore} label="Load older service periods" />
      <LifecycleEvents events={history.results} />
      <LifecycleLoadMore status={history.status} loadMore={history.loadMore} label="Load older service events" />
    </div></details>
    {action && <StaffLifecycleActionModal key={`${userId}-${action}`} profile={profile} schoolId={schoolId} action={action} onClose={() => setAction(undefined)} onSaved={() => { setAction(undefined); setSaved("Service change confirmed. Current status comes from the refreshed record. Other-school access is unchanged."); }} />}
  </section>;
}
