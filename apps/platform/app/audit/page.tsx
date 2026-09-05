"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  AuditExplorerView,
  EMPTY_AUDIT_FILTERS,
  exportAudit,
  type AuditFilters,
} from "@school/shared";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

const audit = api.functions.academic.audit;
export default function PlatformAuditPage() {
  const auth = useAuth();
  if (!isConvexConfigured())
    return (
      <p className="p-6">Audit governance requires a configured backend.</p>
    );
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Checking platform access…
      </p>
    );
  if (!auth.isPlatformAdmin)
    return (
      <main className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">Permission denied</h1>
        <p role="alert">Active Platform authority is required.</p>
        <Link className="underline" href="/schools">
          Return to schools
        </Link>
      </main>
    );
  return <PlatformAuditWorkspace />;
}
function PlatformAuditWorkspace() {
  const schools = usePaginatedQuery(
    api.functions.academic.groups.listLinkableSchools,
    {},
    { initialNumItems: 25 },
  );
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/schools">
          Schools
        </Link>
        <Link className="underline" href="/groups">
          School groups
        </Link>
        <span aria-current="page">Audit</span>
      </nav>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Platform governance
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Audit explorer</h1>
        <p className="mt-2 text-sm text-slate-600">
          Platform actions across schools. Tenant operational audit access
          requires separately verified support authorization and is not enabled
          here.
        </p>
      </header>
      <label className="block max-w-xl text-sm font-medium">
        School filter
        <select
          className="mt-1 w-full rounded-lg border bg-white p-3"
          value={schoolId ?? ""}
          onChange={(e) =>
            setSchoolId(
              schools.results.find((s) => s.schoolId === e.target.value)
                ?.schoolId,
            )
          }
        >
          <option value="">All schools — Platform actions only</option>
          {schools.results.map((s) => (
            <option key={s.schoolId} value={s.schoolId}>
              {s.name} · {s.status}
            </option>
          ))}
        </select>
      </label>
      {schools.status === "CanLoadMore" && (
        <button
          className="text-sm underline"
          onClick={() => schools.loadMore(25)}
        >
          Load more schools
        </button>
      )}
      <PlatformAuditResults key={schoolId ?? "all"} schoolId={schoolId} />
    </main>
  );
}
function PlatformAuditResults({ schoolId }: { schoolId?: Id<"schools"> }) {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const scope = { kind: "platform" as const };
  const access = useQuery(audit.getAuditAccess, { scope });
  const client = useConvex();
  const journal = useMutation(audit.recordAuditExport);
  const args = {
    scope,
    branchId: schoolId,
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
  if (!access) return <p role="status">Loading authorized Platform scope…</p>;
  return (
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
      scopeNote="Backend scope: only actorKind=platform_admin. Selecting a school does not unlock student, finance or departmental records. The same restriction applies to CSV and printable PDF."
      onExport={(format) => {
        const correlationId = crypto.randomUUID();
        const endDate = Math.min(args.endDate ?? Date.now(), Date.now());
        const journalSchoolId = schoolId ?? events.results[0]?.schoolId;
        if (!journalSchoolId)
          return Promise.reject(
            new Error(
              "Select an explicit school filter to provide the export journal context, then retry.",
            ),
          );
        return exportAudit({
          format,
          label: "Platform audit history — Platform actions only",
          fetchPage: (cursor) =>
            client.query(audit.queryAuditPage, {
              ...args,
              endDate,
              exportFormat: format,
              paginationOpts: { cursor, numItems: 100 },
            }),
          record: (stage, rowCount) =>
            journal({
              scope,
              format,
              stage,
              correlationId,
              rowCount,
              journalSchoolId,
            }),
        });
      }}
    />
  );
}
