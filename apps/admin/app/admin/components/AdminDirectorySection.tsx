"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Search } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { AdminCard } from "./AdminCard";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";

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

interface AdminDirectorySectionProps {
  admins: AdminRecord[];
  viewerUserId: string | null;
  viewerIsLead: boolean;
  leadAdminId: string | null;
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
  viewerUserId,
  viewerIsLead,
  leadAdminId,
  onRunAction,
}: AdminDirectorySectionProps) {
  const promoteSchoolAdmin = useMutation(
    api.functions.academic.adminLeadership.promoteSchoolAdmin
  );
  const archiveSchoolAdmin = useMutation(
    api.functions.academic.adminLeadership.archiveSchoolAdmin
  );
  const transferSchoolAdminLeadership = useMutation(
    api.functions.academic.adminLeadership.transferSchoolAdminLeadership
  );

  const [search, setSearch] = useState("");
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filteredAdmins = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return admins;

    return admins.filter(
      (admin) =>
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query) ||
        (admin.managerName ?? "").toLowerCase().includes(query)
    );
  }, [admins, deferredSearch]);

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
      <div className="flex flex-col gap-4 border-b border-slate-950/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="font-display text-lg font-bold tracking-tight text-slate-950">
            Directory
          </h3>
          <p className="text-[10px] font-medium text-slate-500">
            {admins.length} registered administrative accounts.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300 transition-colors group-focus-within:text-slate-950" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredAdmins.map((admin) => (
          <AdminCard
            key={admin._id}
            admin={admin}
            viewerUserId={viewerUserId}
            viewerIsLead={viewerIsLead}
            leadAdminId={leadAdminId}
            busyAdminId={busyAdminId}
            onPromote={() =>
              void handleAction(
                admin._id,
                () => promoteSchoolAdmin({ adminId: admin._id as Id<"users"> }),
                "Admin re-parented",
                "Promotion failed",
                "We could not re-parent this admin right now."
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
    </section>
  );
}
