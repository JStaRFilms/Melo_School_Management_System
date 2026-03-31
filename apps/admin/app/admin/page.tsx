"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import {
  ArrowRightLeft,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminCreationForm } from "./components/AdminCreationForm";
import { LeadProtectionSection } from "./components/LeadProtectionSection";
import { TeacherPromotionSection } from "./components/TeacherPromotionSection";
import { AdminDirectorySection } from "./components/AdminDirectorySection";

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

type AdminDashboardData = {
  viewerUserId: string;
  leadAdmin: {
    _id: string;
    name: string;
    email: string;
  } | null;
  admins: AdminRecord[];
};

type TeacherRecord = {
  _id: string;
  name: string;
  email: string;
  createdAt: number;
};

export default function AdminManagementPage() {
  const data = useQuery(
    "functions/academic/adminLeadership:listSchoolAdmins" as never
  ) as AdminDashboardData | undefined;
  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as TeacherRecord[] | undefined;

  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const activeAdmins = data?.admins.filter((admin) => !admin.isArchived) ?? [];
  const leadAdmin = data?.leadAdmin ?? null;
  const viewerUserId = data?.viewerUserId ?? null;
  const viewerIsLead = Boolean(viewerUserId && leadAdmin && viewerUserId === leadAdmin._id);
  const viewerDirectReports =
    activeAdmins.filter((admin) => admin.managerUserId === viewerUserId).length;

  const runAdminAction = async (
    adminId: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failureTitle: string,
    fallbackMessage: string
  ) => {
    setNotice(null);
    try {
      await action();
      setNotice({
        tone: "success",
        title: successMessage,
        message: "Updated successfully.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: failureTitle,
        message: getUserFacingErrorMessage(error, fallbackMessage),
      });
    }
  };

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="animate-pulse space-y-12">
          <div className="space-y-4">
            <div className="h-10 w-48 rounded-lg bg-slate-100" />
          </div>
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-12">
              <div className="h-64 rounded-xl bg-slate-50" />
              <div className="h-96 rounded-xl bg-slate-50" />
            </div>
            <div className="space-y-10">
              <div className="h-48 rounded-xl bg-slate-50" />
              <div className="h-48 rounded-xl bg-slate-50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-[#f8fafc]">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
          border-radius: 10px;
        }
      `}} />

      <div className="flex-1 flex flex-col lg:flex-row-reverse lg:overflow-hidden">
        {/* Sidebar Bucket */}
        <aside className="w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0">
          <div className="p-4 py-6 md:p-8 space-y-4 md:space-y-6">
            <AdminCreationForm
              onSuccess={(msg) =>
                setNotice({ tone: "success", title: "Success", message: msg })
              }
              onError={(title, msg) =>
                setNotice({ tone: "error", title, message: msg })
              }
            />

            <TeacherPromotionSection
              teachers={teachers ?? []}
              onSuccess={(msg) =>
                setNotice({ tone: "success", title: "Success", message: msg })
              }
              onError={(title, msg) =>
                setNotice({ tone: "error", title, message: msg })
              }
            />

            <div className="pt-4 border-t border-slate-200/60 p-1">
              <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Audit Trail
              </h4>
              <p className="mt-1 text-[10px] leading-relaxed font-medium text-slate-400">
                Actions are logged and immutable.
              </p>
            </div>
            
            <LeadProtectionSection leadAdmin={leadAdmin} />
          </div>
        </aside>

        {/* Main Bucket */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10 space-y-6 md:space-y-8">
            <AdminHeader
              title="Admins"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Total",
                      value: data.admins.length,
                      icon: <ShieldAlert />,
                    },
                    {
                      label: "Active",
                      value: activeAdmins.length,
                      icon: <Sparkles />,
                    },
                    {
                      label: "Reports",
                      value: viewerDirectReports,
                      icon: <ArrowRightLeft />,
                    },
                  ]}
                />
              }
            />

            {notice && (
              <div
                className={`group relative overflow-hidden rounded-xl border-l-4 p-4 shadow-sm transition-all duration-500 animate-in fade-in slide-in-from-top-4 bg-white ${
                  notice.tone === "success"
                    ? "border-emerald-500 text-emerald-950"
                    : "border-rose-500 text-rose-950"
                }`}
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-xs font-bold tracking-tight">{notice.message}</p>
                  </div>
                  <button
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <AdminDirectorySection
              admins={data.admins}
              viewerUserId={viewerUserId}
              viewerIsLead={viewerIsLead}
              leadAdminId={leadAdmin?._id ?? null}
              onRunAction={runAdminAction}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
