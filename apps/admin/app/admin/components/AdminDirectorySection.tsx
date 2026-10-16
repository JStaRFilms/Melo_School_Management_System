"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { StaffLifecyclePanel } from "./StaffLifecyclePanel";
import { Search } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { AdminCard } from "./AdminCard";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";

type AdminRecord = FunctionReturnType<typeof api.functions.academic.adminLeadership.listSchoolAdmins>["admins"][number];

interface AdminDirectorySectionProps {
  admins: AdminRecord[];
  schoolId?: Id<"schools">;
  viewerUserId: string | null;
  viewerIsLead: boolean;
  leadAdminId: string | null;
  canManagePermissions: boolean;
  canSuspendAdmins: boolean;
  onRunAction: (
    adminId: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failureTitle: string,
    fallbackMessage: string
  ) => Promise<void>;
}

export function AdminDirectorySection({
  admins,
  schoolId,
  viewerUserId,
  viewerIsLead,
  leadAdminId,
  canManagePermissions,
  canSuspendAdmins,
  onRunAction,
}: AdminDirectorySectionProps) {
  const promoteSchoolAdmin = useMutation(
    api.functions.academic.adminLeadership.promoteSchoolAdmin
  );
  const demoteAdminToTeacher = useMutation(
    api.functions.academic.adminLeadership.demoteAdminToTeacher
  );
  const archiveSchoolAdmin = useMutation(
    api.functions.academic.adminLeadership.archiveSchoolAdmin
  );
  const restoreSchoolAdmin = useMutation(
    api.functions.academic.adminLeadership.restoreSchoolAdmin
  );
  const transferSchoolAdminLeadership = useMutation(
    api.functions.academic.adminLeadership.transferSchoolAdminLeadership
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "departed" | "archived">("active");
  const [selectedUserId, setSelectedUserId] = useState<Id<"users">>();
  const isMobile = useIsMobile();
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filteredAdmins = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const visible = admins.filter(admin => filter === "archived" ? admin.isArchived : !admin.isArchived && (admin.employmentStatus ?? "active") === filter);
    if (!query) return visible;

    return visible.filter(
      (admin) =>
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query) ||
        (admin.managerName ?? "").toLowerCase().includes(query)
    );
  }, [admins, deferredSearch, filter]);

  const handleAction = async (
    adminId: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failureTitle: string,
    fallbackMessage: string
  ) => {
    setBusyAdminId(adminId);
    try {
      await onRunAction(adminId, action, successMessage, failureTitle, fallbackMessage);
    } finally {
      setBusyAdminId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-950">
            Directory
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            {admins.length} registered administrative accounts.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <label className="block text-sm">Admin service filter<select className="mb-2 min-h-11 w-full rounded-lg border px-3" value={filter} onChange={e => setFilter(e.target.value === "departed" ? "departed" : e.target.value === "archived" ? "archived" : "active")}><option value="active">Active</option><option value="departed">Departed</option><option value="archived">Archived, separate restriction</option></select></label>
          <input
            aria-label="Search admins"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-950 focus:outline-none transition-all shadow-none"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredAdmins.map((admin) => (
          <div key={admin._id} className="space-y-2">
          <AdminCard
            key={admin._id}
            admin={admin}
            viewerUserId={viewerUserId}
            viewerIsLead={viewerIsLead}
            leadAdminId={leadAdminId}
            busyAdminId={busyAdminId}
            canManagePermissions={canManagePermissions}
            canSuspendAdmins={canSuspendAdmins}
            onPromote={() =>
              void handleAction(
                admin._id,
                () => promoteSchoolAdmin({ adminId: admin._id as Id<"users"> }),
                "Admin re-parented",
                "Promotion failed",
                "We could not re-parent this admin right now."
              )
            }
            onDemote={() =>
              void handleAction(
                admin._id,
                () => demoteAdminToTeacher({ adminId: admin._id as Id<"users"> }),
                "Admin downgraded to Teacher",
                "Downgrade failed",
                "We could not downgrade this admin right now."
              )
            }
            onArchive={() =>
              void handleAction(
                admin._id,
                () => archiveSchoolAdmin({ adminId: admin._id as Id<"users"> }),
                "Admin archived",
                "Archive failed",
                "We could not archive this admin right now."
              )
            }
            onRestore={() =>
              void handleAction(
                admin._id,
                () => restoreSchoolAdmin({ adminId: admin._id as Id<"users"> }),
                "Admin restored",
                "Restore failed",
                "We could not restore this admin right now."
              )
            }
            onTransferLeadership={() =>
              void handleAction(
                admin._id,
                () => transferSchoolAdminLeadership({ adminId: admin._id as Id<"users"> }),
                "Leadership transferred",
                "Transfer failed",
                "We could not transfer leadership right now."
              )
            }
          />
          {schoolId && <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setSelectedUserId(admin._id)}>Service history and actions for {admin.name}</button>}
          </div>
        ))}

        {filteredAdmins.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3 py-16">
            <AdminSurface intensity="low" rounded="lg" className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
              <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
                <Search className="h-6 w-6" />
              </div>
              <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                No Identities Found
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400 max-w-[200px]">
                Try adjusting your search terms or identity filters.
              </p>
            </AdminSurface>
          </div>
        )}
      </div>
      {schoolId && selectedUserId && !isMobile && <div className="space-y-3"><StaffLifecyclePanel key={selectedUserId} schoolId={schoolId} userId={selectedUserId} /><button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setSelectedUserId(undefined)}>Close service profile</button></div>}
      <AdminSheet isOpen={isMobile && Boolean(selectedUserId)} onClose={() => setSelectedUserId(undefined)} title="Admin service history">{schoolId && selectedUserId && <StaffLifecyclePanel key={selectedUserId} schoolId={schoolId} userId={selectedUserId} />}</AdminSheet>
    </section>
  );
}
