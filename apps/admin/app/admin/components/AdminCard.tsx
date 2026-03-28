"use client";

import { Archive, ArrowRightLeft, BadgeCheck, Crown, Sparkles } from "lucide-react";

type AdminRecord = {
  _id: string;
  name: string;
  email: string;
  isArchived: boolean;
  isLeadAdmin: boolean;
  managerUserId: string | null;
  managerName: string | null;
  createdAt: number;
};

export function AdminCard({
  admin,
  viewerUserId,
  viewerIsLead,
  leadAdminId,
  busyAdminId,
  onPromote,
  onArchive,
  onTransferLeadership,
}: {
  admin: AdminRecord;
  viewerUserId: string | null;
  viewerIsLead: boolean;
  leadAdminId: string | null;
  busyAdminId: string | null;
  onPromote: () => void;
  onArchive: () => void;
  onTransferLeadership: () => void;
}) {
  const isViewerSelf = admin._id === viewerUserId;
  const canPromote = !admin.isArchived && !isViewerSelf;
  const canArchive = !admin.isArchived && !admin.isLeadAdmin && !isViewerSelf;
  const canTransfer =
    viewerIsLead &&
    leadAdminId === viewerUserId &&
    !admin.isArchived &&
    !admin.isLeadAdmin &&
    admin.managerUserId === leadAdminId;

  return (
    <article
      className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
        admin.isLeadAdmin
          ? "border-slate-900/15 ring-1 ring-slate-900/5"
          : admin.isArchived
            ? "border-slate-200 opacity-70"
            : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{admin.name}</h3>
            {admin.isLeadAdmin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                <Crown className="h-3 w-3 text-white/70" />
                Lead
              </span>
            ) : null}
            {admin.isArchived ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-900">
                <BadgeCheck className="h-3 w-3 text-amber-700" />
                Archived
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500">{admin.email}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
            Created
          </p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {new Date(admin.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Meta label="Manager">
          {admin.isLeadAdmin ? "School lead" : admin.managerName ?? "No manager"}
        </Meta>
        <Meta label="Position">
          {admin.isLeadAdmin
            ? "Protected lead"
            : admin.isArchived
              ? "Inactive"
              : "Active admin"}
        </Meta>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {canPromote ? (
          <button
            type="button"
            onClick={onPromote}
            disabled={busyAdminId === admin._id}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.08em] text-slate-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-slate-400" />
            Promote
          </button>
        ) : null}

        {canTransfer ? (
          <button
            type="button"
            onClick={onTransferLeadership}
            disabled={busyAdminId === admin._id}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-900 disabled:opacity-50"
          >
            <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
            Transfer lead
          </button>
        ) : null}

        {canArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={busyAdminId === admin._id}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black uppercase tracking-[0.08em] text-rose-700 disabled:opacity-50"
          >
            <Archive className="h-4 w-4 text-rose-500" />
            Archive
          </button>
        ) : null}

        {admin.isLeadAdmin ? (
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            <Crown className="h-4 w-4 text-slate-400" />
            Lead protected
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-700">{children}</p>
    </div>
  );
}
