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
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />
      
      <div className="relative mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:space-y-6 md:px-8 md:py-10">
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
            className={`group relative overflow-hidden rounded-lg border-l-4 p-4 shadow-lg shadow-slate-200/5 transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${
              notice.tone === "success"
                ? "border-emerald-500 bg-white text-emerald-950"
                : "border-rose-500 bg-white text-rose-950"
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

        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start lg:justify-between">
          <aside className="w-full lg:w-80 lg:shrink-0 space-y-4 md:space-y-6">
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

            <div className="pt-4 border-t border-slate-200/60 space-y-4 md:space-y-6">
              <LeadProtectionSection leadAdmin={leadAdmin} />

              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Audit Trail
                </h4>
                <p className="mt-1 text-[10px] leading-relaxed font-medium text-slate-400">
                  Actions are logged and immutable.
                </p>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-6 md:space-y-8">
            <AdminDirectorySection
              admins={data.admins}
              viewerUserId={viewerUserId}
              viewerIsLead={viewerIsLead}
              leadAdminId={leadAdmin?._id ?? null}
              onRunAction={runAdminAction}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
