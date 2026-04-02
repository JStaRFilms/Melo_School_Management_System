import { Archive, ArrowRightLeft, Crown, Sparkles } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

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
    <AdminSurface
      as="article"
      intensity={admin.isLeadAdmin ? "high" : "medium"}
      rounded="lg"
      className={`relative p-3 sm:p-4 transition-all duration-300 group ${
        admin.isArchived ? "opacity-60 grayscale-[0.3]" : "hover:shadow-md hover:shadow-slate-200/40"
      }`}
    >
      <div className="flex items-center sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-sm sm:text-base font-bold tracking-tight text-slate-950 truncate">
              {admin.name}
            </h3>
            {admin.isLeadAdmin && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-950 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest text-white ring-1 ring-slate-950/20">
                <Crown className="h-2 w-2" />
                Lead
              </span>
            )}
          </div>
          <p className="text-[10px] font-medium text-slate-400 truncate">
            {admin.email}
          </p>
        </div>
        
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Since
          </p>
          <p className="font-display text-[10px] font-bold text-slate-500">
            {new Date(admin.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 flex flex-col sm:block space-y-3">
          <div className="flex items-center gap-4 border-t border-slate-50 pt-2.5 sm:pt-3">
          <Meta label="Reporting">
            {admin.isLeadAdmin ? "Board" : admin.managerName ?? "None"}
          </Meta>
          <div className="hidden sm:flex h-4 w-px bg-slate-100 md:hidden" />
          <Meta label="Role" className="hidden sm:block md:hidden">
            {admin.isLeadAdmin ? "Root" : admin.isArchived ? "Revoked" : "Admin"}
          </Meta>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {canPromote && (
            <button
              type="button"
              onClick={onPromote}
              disabled={busyAdminId === admin._id}
              className="group/btn inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <Sparkles className="h-2.5 w-2.5 text-slate-300 group-hover/btn:text-brand-accent transition-colors" />
              Promote
            </button>
          )}

          {canTransfer && (
            <button
              type="button"
              onClick={onTransferLeadership}
              disabled={busyAdminId === admin._id}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-950 px-2 text-[9px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              <ArrowRightLeft className="h-2.5 w-2.5 text-white/50" />
              Transfer
            </button>
          )}

          {canArchive && (
            <button
              type="button"
              onClick={onArchive}
              disabled={busyAdminId === admin._id}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-100 bg-white px-2 text-[9px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:border-rose-100 hover:bg-rose-50 disabled:opacity-50"
            >
              <Archive className="h-2.5 w-2.5 opacity-60" />
              Archive
            </button>
          )}
        </div>
      </div>
    </AdminSurface>
  );
}

function Meta({
  label,
  children,
  className = "",
}: {
  label: string;
  children: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex-1 ${className}`}>
      <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-300">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600 tracking-tight">
        {children}
      </p>
    </div>
  );
}

