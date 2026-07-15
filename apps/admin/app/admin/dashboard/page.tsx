"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Banknote,
  BookOpenText,
  ClipboardCheck,
  GraduationCap,
  School,
  ShieldCheck,
  Users,
  CalendarDays,
  Sparkles,
} from "lucide-react";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { StatGroup } from "@/components/ui/StatGroup";

type TeacherRecord = { _id: string; isArchived?: boolean };
type ClassRecord = { _id: string; isArchived?: boolean };
type SubjectRecord = { _id: string; isArchived?: boolean };
type SessionRecord = { _id: string; isActive?: boolean; isArchived?: boolean; name: string };
type BillingDashboard = {
  summary: {
    outstandingBalance: number;
    invoiceCount: number;
    paymentCount: number;
    overdueInvoices: number;
  };
  settings: { defaultCurrency: string } | null;
};

const operations = [
  {
    href: "/academic/students",
    title: "Students",
    description: "Enroll, edit records, link parents, promote students, and manage subject selection.",
    icon: GraduationCap,
  },
  {
    href: "/academic/teachers",
    title: "Teachers",
    description: "Create teachers, update profiles, and keep classroom assignments clean.",
    icon: Users,
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Track invoices, payments, balances, statements, and payment links.",
    icon: Banknote,
  },
  {
    href: "/assessments/results/entry",
    title: "Score Entry",
    description: "Enter and moderate CA and exam scores for the active term.",
    icon: ClipboardCheck,
  },
  {
    href: "/assessments/report-card-extras",
    title: "Report Cards",
    description: "Review printable report cards, comments, and add-on field values.",
    icon: ShieldCheck,
  },
  {
    href: "/academic/knowledge/library",
    title: "Knowledge Library",
    description: "Review resources, approve learning materials, and manage archived content.",
    icon: BookOpenText,
  },
];

const academicSetup = [
  { href: "/academic/sessions", label: "Sessions" },
  { href: "/academic/classes", label: "Classes" },
  { href: "/academic/subjects", label: "Subjects" },
  { href: "/academic/events", label: "Events" },
];

const gradingSetup = [
  { href: "/assessments/setup/exam-recording", label: "Exam Setup" },
  { href: "/assessments/setup/grading-bands", label: "Grading Bands" },
  { href: "/assessments/setup/report-card-bundles", label: "Report Add-ons" },
  { href: "/academic/knowledge/templates", label: "Templates" },
  { href: "/academic/knowledge/assessment-profiles", label: "Profiles" },
];

const systemSetup = [
  { href: "/admin", label: "Admin Users" },
  { href: "/academic/archived-records", label: "Archive Audit" },
  { href: "/assessments/report-cards/manual-adjustments", label: "Manual Adjustments" },
  { href: "/assessments/report-cards/backfill", label: "Historical Backfill" },
];

function formatMoney(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-slate-50 bg-slate-50/20 px-3.5 py-2.5 text-xs font-bold text-slate-600 transition-all duration-200 hover:border-slate-200 hover:bg-white hover:text-slate-950 active:scale-[0.98]"
    >
      <span className="truncate group-hover:translate-x-0.5 transition-transform">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-650 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

export default function AdminDashboardPage() {
  const teachers = useQuery("functions/academic/academicSetup:listTeachers" as never) as TeacherRecord[] | undefined;
  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as ClassRecord[] | undefined;
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as SubjectRecord[] | undefined;
  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as SessionRecord[] | undefined;
  const billing = useQuery("functions/billing:getBillingDashboard" as never, {} as never) as BillingDashboard | undefined;

  const activeSession = useMemo(
    () => sessions?.find((session) => session.isActive && !session.isArchived) ?? null,
    [sessions]
  );
  const currency = billing?.settings?.defaultCurrency ?? "NGN";

  const isLoaded = teachers !== undefined && classes !== undefined && subjects !== undefined && sessions !== undefined && billing !== undefined;

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminHeader
          label="School command center"
          title="Admin Dashboard"
          description="Start with the daily work first. Setup, recovery, and advanced configuration are still available below."
          actions={
            activeSession ? (
              <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 border border-slate-200/60 shadow-sm shadow-slate-200/30">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Active: {activeSession.name}
                </span>
              </div>
            ) : (
              <Link
                href="/academic/sessions"
                className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2 border border-amber-200/60 shadow-sm shadow-amber-100/30 hover:bg-amber-100/40 transition"
              >
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Setup Active Session</span>
              </Link>
            )
          }
        />

        <section className="w-full">
          <StatGroup
            variant="scroll"
            stats={[
              {
                label: "Active Session",
                value: activeSession ? activeSession.name : "Not Set",
                icon: <CalendarDays />,
                description: activeSession ? "Active" : "Action Req",
              },
              {
                label: "Teachers",
                value: String(teachers.filter((t) => !t.isArchived).length),
                icon: <Users />,
                description: "Staff Members",
              },
              {
                label: "Classes / Subjects",
                value: `${classes.filter((c) => !c.isArchived).length} / ${subjects.filter((s) => !s.isArchived).length}`,
                icon: <BookOpenText />,
                description: "Academic Setup",
              },
              {
                label: "Outstanding",
                value: formatMoney(billing.summary.outstandingBalance, currency),
                icon: <Banknote />,
                description: `${billing.summary.overdueInvoices} Overdue`,
              },
            ]}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
          <AdminSurface intensity="medium" rounded="2xl" className="p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Daily Operations</p>
                <h2 className="mt-0.5 text-base font-black text-slate-950">Most-Used Admin Workflows</h2>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100">
                <School className="h-4.5 w-4.5" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {operations.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 border border-slate-150 shadow-sm transition-all duration-300 group-hover:bg-slate-950 group-hover:text-white group-hover:border-slate-950 group-hover:rotate-3">
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-display text-xs font-black tracking-tight text-slate-950">{item.title}</h3>
                      <p className="text-[10px] font-medium leading-normal text-slate-400 group-hover:text-slate-500 transition-colors line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-2.5">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-350 group-hover:text-indigo-650 transition-colors">
                      Launch Action
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </AdminSurface>

          <aside className="space-y-4">
            <AdminSurface intensity="medium" rounded="2xl" className="p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Academic Structure</h4>
                  <h3 className="text-xs font-black text-slate-950 mt-0.5">Core Setup Operations</h3>
                </div>
              </div>
              <div className="grid gap-2">
                {academicSetup.map((item) => (
                  <SidebarLink key={item.href} {...item} />
                ))}
              </div>
            </AdminSurface>

            <AdminSurface intensity="medium" rounded="2xl" className="p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Grading & Exams</h4>
                  <h3 className="text-xs font-black text-slate-950 mt-0.5">Assessment Configurations</h3>
                </div>
              </div>
              <div className="grid gap-2">
                {gradingSetup.map((item) => (
                  <SidebarLink key={item.href} {...item} />
                ))}
              </div>
            </AdminSurface>

            <AdminSurface intensity="medium" rounded="2xl" className="p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">System & Security</h4>
                  <h3 className="text-xs font-black text-slate-950 mt-0.5">Audits & System Control</h3>
                </div>
              </div>
              <div className="grid gap-2">
                {systemSetup.map((item) => (
                  <SidebarLink key={item.href} {...item} />
                ))}
              </div>
            </AdminSurface>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between pb-2">
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="h-6.5 w-64 rounded bg-slate-200" />
            <div className="h-3 w-96 rounded bg-slate-200" />
          </div>
          <div className="h-9 w-40 rounded-xl bg-slate-200" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white border border-slate-200/60 p-4 space-y-2" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-50">
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-5 w-48 rounded bg-slate-200" />
              </div>
              <div className="h-6 w-6 rounded bg-slate-100" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl border border-slate-100 bg-slate-50/40 p-4" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-[2rem] border border-slate-200/60 bg-white p-5 h-44" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
