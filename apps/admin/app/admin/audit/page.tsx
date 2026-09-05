"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  AuditExplorerView,
  EMPTY_AUDIT_FILTERS,
  exportAudit,
  type AuditFilters,
} from "@school/shared";
import { useAuth } from "@/AuthProvider";
import { LeadershipAlerts } from "./LeadershipAlerts";
import { AuditScopeEditor } from "./AuditScopeEditor";

const audit = api.functions.academic.audit;
type Scope = FunctionArgs<typeof audit.queryAuditPage>["scope"];

export default function AuditPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "audit.branch.view" } : "skip",
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="underline">
          Administration
        </Link>
        <Link href="/admin/group" className="underline">
          School group
        </Link>
        <Link href="/admin/permissions" className="underline">
          Permissions
        </Link>
      </nav>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Institutional history
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Audit explorer</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search immutable history, inspect safe changes and review leadership
          alerts.
        </p>
      </header>
      {allowed === undefined ? (
        <p role="status">Checking audit access…</p>
      ) : !allowed ? (
        <section role="alert" className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Permission denied</h2>
          <p className="mt-2 text-sm">
            Audit visibility requires explicit audit access and module scope,
            not merely an administrator title.
          </p>
        </section>
      ) : (
        schoolId && (
          <AuditWorkspace
            key={schoolId}
            schoolId={schoolId}
            canonical={Boolean(
              workspaceAccess?.state === "ready" && workspaceAccess.membership,
            )}
          />
        )
      )}
    </main>
  );
}

function AuditWorkspace({
  schoolId,
  canonical,
}: {
  schoolId: Id<"schools">;
  canonical: boolean;
}) {
  const [scope, setScope] = useState<Scope>({ kind: "branch", schoolId });
  const [branchId, setBranchId] = useState<Id<"schools">>();
  const groups = usePaginatedQuery(
    api.functions.academic.groups.listGroups,
    canonical ? {} : "skip",
    { initialNumItems: 25 },
  );
  const overview = useQuery(
    api.functions.academic.groups.getGroupOverview,
    scope.kind === "group" ? { groupId: scope.groupId } : "skip",
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Audit context
          <select
            className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"
            value={scope.kind === "group" ? scope.groupId : "branch"}
            onChange={(e) => {
              const group = groups.results.find(
                (g) => g._id === e.target.value,
              );
              setScope(
                group
                  ? { kind: "group", groupId: group._id }
                  : { kind: "branch", schoolId },
              );
              setBranchId(undefined);
            }}
          >
            <option value="branch">Current branch</option>
            {groups.results
              .filter((g) => g.status === "active")
              .map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name} — owned group
                </option>
              ))}
          </select>
        </label>
        {scope.kind === "group" && (
          <label className="block text-sm font-medium">
            Branch filter
            <select
              className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"
              value={branchId ?? ""}
              onChange={(e) =>
                setBranchId(
                  overview?.branches.find((b) => b.schoolId === e.target.value)
                    ?.schoolId,
                )
              }
            >
              <option value="">All group branches</option>
              {overview?.branches.map((b) => (
                <option key={b.schoolId} value={b.schoolId}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {groups.status === "CanLoadMore" && (
        <button
          className="text-sm underline"
          onClick={() => groups.loadMore(25)}
        >
          Load more owned groups
        </button>
      )}
      <AuditResults
        key={`${JSON.stringify(scope)}:${branchId ?? "all"}`}
        scope={scope}
        branchId={branchId}
      />
      {scope.kind === "branch" && <LeadershipAlerts schoolId={schoolId} />}
    </>
  );
}

function AuditResults({
  scope,
  branchId,
}: {
  scope: Scope;
  branchId?: Id<"schools">;
}) {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const access = useQuery(audit.getAuditAccess, { scope });
  const client = useConvex();
  const journal = useMutation(audit.recordAuditExport);
  const args = {
    scope,
    branchId,
    search: filters.search || undefined,
    module: filters.module || undefined,
    action: filters.action || undefined,
    actor: filters.actor || undefined,
    target: filters.target || undefined,
    startDate: filters.startDate
      ? Date.parse(`${filters.startDate}T00:00:00Z`)
      : undefined,
    endDate: filters.endDate
      ? Date.parse(`${filters.endDate}T23:59:59.999Z`)
      : undefined,
  };
  const events = usePaginatedQuery(audit.queryAuditPage, args, {
    initialNumItems: 50,
  });
  if (!access) return <p role="status">Loading authorized audit scope…</p>;
  return (
    <>
      <AuditExplorerView
        rows={events.results}
        loading={events.status === "LoadingFirstPage"}
        canLoadMore={events.status === "CanLoadMore"}
        loadingMore={events.status === "LoadingMore"}
        onLoadMore={() => events.loadMore(50)}
        modules={access.modules}
        onApply={setFilters}
        canCsv={access.canCsv}
        canPdf={access.canPdf}
        scopeConfigured={access.scopeConfigured}
        scopeNote={
          scope.kind === "group"
            ? "Recorded proprietor: audit metadata across linked branches, including historical events without a group snapshot. This does not switch your operational workspace."
            : "Current branch only. Department visibility is enforced on the backend for every page and export."
        }
        onExport={(format) => {
          const correlationId = crypto.randomUUID();
          const endDate = Math.min(args.endDate ?? Date.now(), Date.now());
          return exportAudit({
            format,
            label: `Audit history — ${scope.kind} scope`,
            fetchPage: (cursor) =>
              client.query(audit.queryAuditPage, {
                ...args,
                endDate,
                exportFormat: format,
                paginationOpts: { cursor, numItems: 100 },
              }),
            record: (stage, rowCount) =>
              journal({ scope, format, stage, correlationId, rowCount }),
          });
        }}
      />
      {access.canConfigureScope && scope.kind === "branch" && (
        <AuditScopeEditor schoolId={scope.schoolId} modules={access.modules} />
      )}
    </>
  );
}
