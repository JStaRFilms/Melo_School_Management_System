"use client";

import Link from "next/link";
import GroupBranding from "./GroupBranding";
import OperationalOverview from "./OperationalOverview";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { useDepartureGuard } from "@school/shared/drafts";

export default function GroupPage() {
  const { selectSchool } = useAuth();
  const { requestDeparture } = useDepartureGuard();
  const router = useRouter();
  const groups = usePaginatedQuery(
    api.functions.academic.groups.listGroups,
    {},
    { initialNumItems: 25 },
  );
  const [groupId, setGroupId] = useState<Id<"schoolGroups">>();
  const overview = useQuery(
    api.functions.academic.groups.getGroupOverview,
    groupId ? { groupId } : "skip",
  );
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="underline">
          Administration
        </Link>
        <Link href="/admin/permissions" className="underline">
          Permissions
        </Link>
        <Link href="/admin/audit" className="underline">
          Audit
        </Link>
      </nav>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Proprietor workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold">School group</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ownership and branch directory. Group links do not grant operational
          access to another school.
        </p>
      </header>
      {groups.status === "LoadingFirstPage" ? (
        <p role="status">Loading owned groups…</p>
      ) : groups.results.length === 0 ? (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold">No owned groups</h2>
          <p className="mt-2 text-sm text-slate-600">
            Only the recorded canonical proprietor can view this directory. Ask
            Platform support to review ownership; job titles do not establish
            authority.
          </p>
        </section>
      ) : (
        <label className="block max-w-xl text-sm font-medium">
          Owned group
          <select
            className="mt-2 w-full rounded-lg border bg-white p-3"
            value={groupId ?? ""}
            onChange={(e) =>
              setGroupId(
                groups.results.find((g) => g._id === e.target.value)?._id,
              )
            }
          >
            <option value="">Select a group</option>
            {groups.results.map((g) => (
              <option
                key={g._id}
                value={g._id}
                disabled={g.status !== "active"}
              >
                {g.name} · {g.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {groups.status === "CanLoadMore" && (
        <button className="underline" onClick={() => groups.loadMore(25)}>
          Load more groups
        </button>
      )}
      {groupId && !overview && <p role="status">Loading branch metadata…</p>}
      {overview && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">{overview.group.name}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Group identifier</dt>
              <dd className="break-all">{overview.group._id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Canonical proprietor</dt>
              <dd className="break-all">{overview.group.proprietorPersonId}</dd>
            </div>
          </dl>
          <ul className="mt-5 divide-y border-t">
            {overview.branches.map((b) => (
              <li key={b.schoolId} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{b.name}</h3>
                  {b.isHeadquarters && (
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                      Headquarters
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{b.status}</span>
                </div>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {b.schoolId} · Linked{" "}
                  {new Date(b.linkedAt).toLocaleDateString()}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Operational branch switching remains unavailable until scoped
                  routes are approved.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {overview && groupId && (
        <>
          <GroupBranding
            key={`branding:${groupId}`}
            groupId={groupId}
            branches={overview.branches}
          />
          <OperationalOverview
            key={`operations:${groupId}`}
            groupId={groupId}
            branches={overview.branches}
            onOpenBranchAudit={async (schoolId) => {
              if (!(await requestDeparture({ kind: "branch", schoolId })))
                return;
              selectSchool(schoolId);
              router.push("/admin/audit");
            }}
          />
        </>
      )}
    </main>
  );
}
