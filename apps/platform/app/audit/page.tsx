"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { ShieldCheck, School, Filter, Sparkles } from "lucide-react";

const audit = api.functions.academic.audit;

export default function PlatformAuditPage() {
  const auth = useAuth();

  if (!isConvexConfigured()) {
    return (
      <div className="p-8 text-center text-slate-600">
        Audit log requires a configured backend.
      </div>
    );
  }

  if (auth.isLoading) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm">
        Loading audit workspace…
      </div>
    );
  }

  if (!auth.isPlatformAdmin) {
    return (
      <main className="p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Permission Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Super Admin platform authority is required to view the platform audit log.
        </p>
        <Link
          className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline"
          href="/schools"
        >
          Return to Schools
        </Link>
      </main>
    );
  }

  return <PlatformAuditWorkspace />;
}

function PlatformAuditWorkspace() {
  const schools = usePaginatedQuery(
    api.functions.academic.groups.listLinkableSchools,
    {},
    { initialNumItems: 50 },
  );

  const [schoolId, setSchoolId] = useState<Id<"schools">>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Governance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Audit Explorer
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Append-only audit trail tracking administrative operations, tenant provisioning, and security events across Melo.
          </p>
        </div>
      </div>

      {/* School Scope Filter Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">School Filter Scope</div>
            <div className="text-[11px] text-slate-500">
              Filter audit events to a specific school tenant, or view platform-wide events.
            </div>
          </div>
        </div>

        <div className="w-full md:w-80">
          <select
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            value={schoolId ?? ""}
            onChange={(e) =>
              setSchoolId(
                schools.results.find((s) => s.schoolId === e.target.value)
                  ?.schoolId,
              )
            }
          >
            <option value="">All Schools (Platform Actions)</option>
            {schools.results.map((s) => (
              <option key={s.schoolId} value={s.schoolId}>
                {s.name} ({s.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {schools.status === "CanLoadMore" && (
        <div className="text-center">
          <button
            type="button"
            className="text-xs font-semibold text-indigo-600 hover:underline"
            onClick={() => schools.loadMore(25)}
          >
            Load more schools into filter
          </button>
        </div>
      )}

      {/* Audit Log Results */}
      <PlatformAuditResults key={schoolId ?? "all"} schoolId={schoolId} />
    </div>
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

  useEffect(() => {
    if (events.status === "CanLoadMore" && events.results.length < 50)
      events.loadMore(50);
  }, [events.status, events.results.length, events.loadMore]);

  if (!access) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading authorized platform scope…
      </div>
    );
  }

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
      scopeNote="Platform Audit Trail · Monitoring platform-level administrative events. School operational records remain confidential to their respective tenants."
      onExport={(format) => {
        const correlationId = crypto.randomUUID();
        const endDate = Math.min(args.endDate ?? Date.now(), Date.now());
        const journalSchoolId = schoolId ?? events.results[0]?.schoolId;
        if (!journalSchoolId)
          return Promise.reject(
            new Error(
              "Select a specific school from the filter above to export this audit journal.",
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
