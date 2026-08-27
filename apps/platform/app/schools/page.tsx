"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";
import {
  SlidersHorizontal,
  KeyRound,
  UserCheck,
  Building2,
  CheckCircle2,
  Clock,
  Radio,
  Search,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { ManageFeaturesModal, type SchoolFeatureSet } from "./ManageFeaturesModal";
import { ResetSchoolAdminPasswordModal } from "./ResetSchoolAdminPasswordModal";

interface SchoolItem {
  _id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: number;
  adminName: string | null;
  adminEmail: string | null;
  features: SchoolFeatureSet;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SchoolsTable({
  schools,
  onManageFeatures,
  onResetPassword,
}: {
  schools: SchoolItem[];
  onManageFeatures: (school: SchoolItem) => void;
  onResetPassword: (school: SchoolItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs hidden md:block">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/75">
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">School</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Slug Identifier</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Admin</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Modules</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Created</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {schools.map((school) => {
            const isPending = school.status === "pending";

            return (
              <tr key={school._id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="font-bold text-sm text-slate-900">{school.name}</div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 border border-slate-200/60">
                    {school.slug}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {isPending ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Pending Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {school.adminName ? (
                    <div>
                      <div className="font-semibold text-xs text-slate-900">{school.adminName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {school.adminEmail}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not assigned</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {school.features?.billing !== false && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Billing
                      </span>
                    )}
                    {school.features?.curriculum !== false && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        Curriculum
                      </span>
                    )}
                    {school.features?.knowledgeLibrary !== false && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                        AI Library
                      </span>
                    )}
                    {school.features?.admissions === true && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                        Admissions
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                  {formatDate(school.createdAt)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isPending ? (
                      <Link
                        href={`/schools/${school._id}/assign-admin`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Assign Admin
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onManageFeatures(school)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                          Features
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetPassword(school)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                          Password
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SchoolsCards({
  schools,
  onManageFeatures,
  onResetPassword,
}: {
  schools: SchoolItem[];
  onManageFeatures: (school: SchoolItem) => void;
  onResetPassword: (school: SchoolItem) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {schools.map((school) => {
        const isPending = school.status === "pending";

        return (
          <div
            key={school._id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{school.name}</h3>
                <span className="inline-block mt-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                  {school.slug}
                </span>
              </div>
              {isPending ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                  Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Active
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Administrator</span>
                {school.adminName ? (
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{school.adminName}</span>
                    <div className="text-[10px] text-slate-400 font-mono">{school.adminEmail}</div>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Not assigned</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Created</span>
                <span className="text-slate-600 font-medium">{formatDate(school.createdAt)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              {isPending ? (
                <Link
                  href={`/schools/${school._id}/assign-admin`}
                  className="block w-full text-center py-2 px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  Assign Admin
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onManageFeatures(school)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                    Features
                  </button>
                  <button
                    type="button"
                    onClick={() => onResetPassword(school)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                    Password
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricStrip({ schools }: { schools: SchoolItem[] }) {
  const total = schools.length;
  const active = schools.filter((s) => s.status === "active").length;
  const pending = schools.filter((s) => s.status === "pending").length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Schools</span>
          <Building2 className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-950 tracking-tight">{total}</span>
          <span className="text-[11px] font-medium text-slate-400">Registered</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Tenants</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-950 tracking-tight">{active}</span>
          <span className="text-[11px] font-medium text-emerald-600">Active</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Setup</span>
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-950 tracking-tight">{pending}</span>
          <span className="text-[11px] font-medium text-amber-600">Awaiting Admin</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cloud Engine</span>
          <Radio className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-bold text-slate-900">Convex Dev</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            100% Online
          </span>
        </div>
      </div>
    </div>
  );
}

function SchoolsListPageWithConvex() {
  const [featureModalSchool, setFeatureModalSchool] = useState<SchoolItem | null>(null);
  const [resetPasswordSchool, setResetPasswordSchool] = useState<SchoolItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");

  const schools = useQuery(
    "functions/platform/index:listSchools" as never,
    {} as never
  ) as SchoolItem[] | undefined;

  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    return schools.filter((s) => {
      const matchesStatus =
        statusFilter === "all" ? true : s.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.adminEmail && s.adminEmail.toLowerCase().includes(q)) ||
        (s.adminName && s.adminName.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [schools, searchQuery, statusFilter]);

  if (schools === undefined) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <p className="text-sm text-slate-500 font-medium">Loading platform schools...</p>
      </div>
    );
  }

  return (
    <>
      <MetricStrip schools={schools} />

      {/* Control Bar: Search, Status Filter & Create Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by school, slug, or admin email..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none shadow-2xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                statusFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({schools.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                statusFilter === "active" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({schools.filter((s) => s.status === "active").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                statusFilter === "pending" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending ({schools.filter((s) => s.status === "pending").length})
            </button>
          </div>

          <Link
            href="/schools/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Create School
          </Link>
        </div>
      </div>

      {/* Empty States */}
      {filteredSchools.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Building2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <h3 className="text-sm font-bold text-slate-900">No schools matching filter</h3>
          <p className="text-xs text-slate-500 mt-1">Try refining your search query or clear the filter.</p>
        </div>
      ) : (
        <>
          <SchoolsTable
            schools={filteredSchools}
            onManageFeatures={(school) => setFeatureModalSchool(school)}
            onResetPassword={(school) => setResetPasswordSchool(school)}
          />
          <SchoolsCards
            schools={filteredSchools}
            onManageFeatures={(school) => setFeatureModalSchool(school)}
            onResetPassword={(school) => setResetPasswordSchool(school)}
          />
        </>
      )}

      {/* Modals */}
      <ManageFeaturesModal
        isOpen={Boolean(featureModalSchool)}
        onClose={() => setFeatureModalSchool(null)}
        school={featureModalSchool}
      />

      <ResetSchoolAdminPasswordModal
        isOpen={Boolean(resetPasswordSchool)}
        onClose={() => setResetPasswordSchool(null)}
        school={resetPasswordSchool}
      />
    </>
  );
}

function ConvexNotConfiguredNotice() {
  return (
    <div className="bg-white rounded-xl border border-amber-200 p-8 text-center shadow-xs">
      <h2 className="text-base font-bold text-slate-900 mb-1">Convex Not Configured</h2>
      <p className="text-xs text-slate-600">
        Set <code>NEXT_PUBLIC_CONVEX_URL</code> in <code>.env.local</code> to connect.
      </p>
    </div>
  );
}

export default function SchoolsListPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">School Tenants</h1>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          Manage tenant provisioning, administrator credentials, and modular workspace features.
        </p>
      </div>

      {isConvexConfigured() ? (
        <SchoolsListPageWithConvex />
      ) : (
        <ConvexNotConfiguredNotice />
      )}
    </div>
  );
}
