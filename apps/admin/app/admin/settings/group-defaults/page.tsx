"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import GroupDomainDefaults from "../../group/GroupDomainDefaults";
import { SettingsNavigationTabs } from "../components/SettingsNavigationTabs";

export default function BranchGroupDefaultsPage() {
  const memberships = useQuery(api.functions.academic.groups.listUserBranches, {});
  const linked = (memberships ?? []).filter(
    (membership): membership is typeof membership & { groupId: Id<"schoolGroups"> } =>
      membership.groupId !== null,
  );
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const selected = linked.find((membership) => membership.schoolId === schoolId) ?? linked[0];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 pb-20">
      <div className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch settings</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Group default choices</h1>
            <p className="mt-1 text-xs text-slate-500">
              Review effective origin and explicitly inherit, override or reset settings for a branch where you hold the required capability.
            </p>
          </div>
          <Link
            href="/admin/permissions"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shrink-0"
          >
            Review Permissions
          </Link>
        </div>
        <SettingsNavigationTabs />
      </div>
      {!memberships ? <p role="status">Loading authorized branches…</p> : linked.length === 0 ? (
        <p>No active linked branch membership is available. A group link alone does not grant access.</p>
      ) : (
        <>
          <label className="block max-w-xl text-sm font-medium">
            Authorized linked branch
            <select className="mt-1 w-full rounded border p-2" value={selected?.schoolId ?? ""} onChange={(event) => setSchoolId(linked.find((item) => item.schoolId === event.target.value)?.schoolId)}>
              {linked.map((membership) => <option key={membership.schoolId} value={membership.schoolId}>{membership.name} · {membership.groupName}</option>)}
            </select>
          </label>
          {selected && (
            <GroupDomainDefaults
              key={`${selected.groupId}:${selected.schoolId}`}
              groupId={selected.groupId}
              branches={[{ schoolId: selected.schoolId, name: selected.name }]}
              branchOnly
              initialSchoolId={selected.schoolId}
            />
          )}
        </>
      )}
    </main>
  );
}
