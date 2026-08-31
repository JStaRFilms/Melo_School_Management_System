"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
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
  Ban,
  Play,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { ManageFeaturesModal, type SchoolFeatureSet } from "./ManageFeaturesModal";
import { ResetSchoolAdminPasswordModal } from "./ResetSchoolAdminPasswordModal";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { useAutoAnimate } from "@school/shared";

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
  onToggleStatus,
}: {
  schools: SchoolItem[];
  onManageFeatures: (school: SchoolItem) => void;
  onResetPassword: (school: SchoolItem) => void;
  onToggleStatus: (school: SchoolItem) => void;
}) {
  const [tableBodyRef] = useAutoAnimate<HTMLTableSectionElement>({
    duration: 200,
    easing: "ease-out",
  });

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs hidden md:block">
      <table className="w-full text-left border-collapse min-w-[1080px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className="min-w-[240px] px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">School</th>
            <th className="min-w-[130px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Slug</th>
            <th className="min-w-[100px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
            <th className="min-w-[200px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin Account</th>
            <th className="min-w-[170px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Modules</th>
            <th className="min-w-[100px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Created</th>
            <th className="min-w-[240px] px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody ref={tableBodyRef} className="divide-y divide-slate-100/90">
          {schools.map((school) => {
            const isPending = school.status === "pending";
            const isSuspended = school.status === "suspended";

            return (
              <tr key={school._id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-bold text-sm text-slate-900 leading-snug">{school.name}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 border border-slate-200/70">
                    {school.slug}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {isPending ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Pending
                    </span>
                  ) : isSuspended ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {school.adminEmail ? (
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-800 leading-tight">{school.adminName || "Admin User"}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{school.adminEmail}</div>
                    </div>
                  ) : (
                    <span className="text-xs italic text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    {school.features?.billing !== false && (
                      <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        Billing
                      </span>
                    )}
                    {school.features?.curriculum !== false && (
                      <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 whitespace-nowrap">
                        Curriculum
                      </span>
                    )}
                    {school.features?.knowledgeLibrary !== false && (
                      <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 whitespace-nowrap">
                        AI Library
                      </span>
                    )}
                    {school.features?.admissions === true && (
                      <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 whitespace-nowrap">
                        Admissions
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                  {formatDate(school.createdAt)}
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Link
                      href={`/schools/${school._id}/migration`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors border border-indigo-200/80"
                      title="Data Migration Workbench"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                      Migration
                    </Link>
                    <button
                      type="button"
                      onClick={() => onManageFeatures(school)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      title="Manage Features"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Features
                    </button>
                    {isPending ? (
                      <Link
                        href={`/schools/${school._id}/assign-admin`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Assign Admin
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onResetPassword(school)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Reset Admin Password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(school)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                            isSuspended
                              ? "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          }`}
                          title={isSuspended ? "Reactivate School" : "Suspend School"}
                        >
                          {isSuspended ? (
                            <>
                              <Play className="h-3.5 w-3.5 text-emerald-600" />
                              Reactivate
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5 text-rose-500" />
                              Suspend
                            </>
                          )}
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
  onToggleStatus,
}: {
  schools: SchoolItem[];
  onManageFeatures: (school: SchoolItem) => void;
  onResetPassword: (school: SchoolItem) => void;
  onToggleStatus: (school: SchoolItem) => void;
}) {
  const [cardsRef] = useAutoAnimate<HTMLDivElement>({
    duration: 200,
    easing: "ease-out",
  });

  return (
    <div ref={cardsRef} className="md:hidden space-y-4">
      {schools.map((school) => {
        const isPending = school.status === "pending";
        const isSuspended = school.status === "suspended";
        const initials = school.name
          .split(" ")
          .map((n) => n[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase() || "SC";

        return (
          <div
            key={school._id}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4"
          >
            {/* Header: Avatar, Name & Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/70 shadow-2xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{school.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200/60 truncate max-w-[160px]">
                      {school.slug}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatDate(school.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {isPending ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Pending
                  </span>
                ) : isSuspended ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Suspended
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
            </div>

            {/* Admin Info & Modules Strip */}
            <div className="rounded-xl bg-slate-50/75 p-3.5 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Admin</span>
                {school.adminEmail ? (
                  <div className="text-right truncate">
                    <span className="font-bold text-slate-800 block truncate">{school.adminName || "Admin User"}</span>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">{school.adminEmail}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Modules</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {school.features?.billing !== false && (
                    <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      Billing
                    </span>
                  )}
                  {school.features?.curriculum !== false && (
                    <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                      Curriculum
                    </span>
                  )}
                  {school.features?.knowledgeLibrary !== false && (
                    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                      AI Library
                    </span>
                  )}
                  {school.features?.admissions === true && (
                    <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                      Admissions
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons Grid with Proper Spacing */}
            <div className="pt-2 border-t border-slate-100/90">
              {isPending ? (
                <Link
                  href={`/schools/${school._id}/assign-admin`}
                  className="block w-full text-center py-2.5 px-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  Assign Admin
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link
                    href={`/schools/${school._id}/migration`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors border border-indigo-200"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Data Migration
                  </Link>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onManageFeatures(school)}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                      Features
                    </button>
                    <button
                      type="button"
                      onClick={() => onResetPassword(school)}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(school)}
                      className={`inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-xs font-bold transition-colors shadow-2xs ${
                        isSuspended
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      }`}
                    >
                    {isSuspended ? (
                      <>
                        <Play className="h-3.5 w-3.5 text-emerald-600" />
                        Reactivate
                      </>
                    ) : (
                      <>
                        <Ban className="h-3.5 w-3.5 text-rose-500" />
                        Suspend
                      </>
                    )}
                  </button>
                  </div>
                </div>
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
  const suspended = schools.filter((s) => s.status === "suspended").length;

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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {suspended > 0 ? "Suspended" : "Cloud Engine"}
          </span>
          {suspended > 0 ? (
            <Ban className="h-4 w-4 text-rose-500" />
          ) : (
            <Radio className="h-4 w-4 text-indigo-500" />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {suspended > 0 ? (
            <>
              <span className="text-2xl font-bold text-rose-600 tracking-tight">{suspended}</span>
              <span className="text-[11px] font-medium text-rose-500">Disabled</span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-slate-900">Convex Dev</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                100% Online
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusConfirmModal({
  school,
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: {
  school: SchoolItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}) {
  if (!isOpen || !school) return null;

  const isSuspending = school.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSuspending ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isSuspending ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              {isSuspending ? "Suspend School Tenant?" : "Reactivate School Tenant?"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">{school.name}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {isSuspending
            ? "Suspending this school will immediately block all administrators, teachers, parents, and students from accessing their dashboards and data."
            : "Reactivating this school will immediately restore full workspace access for all associated staff, students, and parents."}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors shadow-xs ${
              isSuspending
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </>
            ) : isSuspending ? (
              "Confirm Suspension"
            ) : (
              "Confirm Reactivation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SchoolsListPageWithConvex() {
  const [featureModalSchool, setFeatureModalSchool] = useState<SchoolItem | null>(null);
  const [resetPasswordSchool, setResetPasswordSchool] = useState<SchoolItem | null>(null);
  const [statusModalSchool, setStatusModalSchool] = useState<SchoolItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");

  const schools = useQuery(
    "functions/platform/index:listSchools" as never,
    {} as never
  ) as SchoolItem[] | undefined;

  const setStatus = useMutation("functions/platform/index:setSchoolStatus" as never);

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

  const handleConfirmStatusToggle = async () => {
    if (!statusModalSchool) return;

    const nextStatus = statusModalSchool.status === "active" ? "suspended" : "active";
    setIsUpdatingStatus(true);
    try {
      await setStatus({
        schoolId: statusModalSchool._id as never,
        status: nextStatus as never,
      } as never);

      appToast.success(
        nextStatus === "suspended" ? "School suspended" : "School reactivated",
        {
          description: `${statusModalSchool.name} is now ${nextStatus}.`,
        }
      );
      setStatusModalSchool(null);
    } catch (err) {
      appToast.error("Failed to update status", {
        description: getErrorMessage(err, "Could not change school status."),
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

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

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
            {schools.some((s) => s.status === "suspended") && (
              <button
                type="button"
                onClick={() => setStatusFilter("suspended")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  statusFilter === "suspended" ? "bg-white text-rose-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Suspended ({schools.filter((s) => s.status === "suspended").length})
              </button>
            )}
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
            onToggleStatus={(school) => setStatusModalSchool(school)}
          />
          <SchoolsCards
            schools={filteredSchools}
            onManageFeatures={(school) => setFeatureModalSchool(school)}
            onResetPassword={(school) => setResetPasswordSchool(school)}
            onToggleStatus={(school) => setStatusModalSchool(school)}
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

      <StatusConfirmModal
        school={statusModalSchool}
        isOpen={Boolean(statusModalSchool)}
        onClose={() => setStatusModalSchool(null)}
        onConfirm={handleConfirmStatusToggle}
        isProcessing={isUpdatingStatus}
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
