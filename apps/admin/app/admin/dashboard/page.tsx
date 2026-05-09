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
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AdminHeader } from "@/components/ui/AdminHeader";

type TeacherRecord = { _id: string; isArchived?: boolean };
type ClassRecord = { _id: string; isArchived?: boolean };
type SubjectRecord = { _id: string; isArchived?: boolean };
type SessionRecord = { _id: string; isActive?: boolean; isArchived?: boolean };
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
    description: "Review printable report cards, comments, and add-on fields.",
    icon: ShieldCheck,
  },
  {
    href: "/academic/knowledge/library",
    title: "Knowledge Library",
    description: "Review resources, approve learning materials, and manage archived content.",
    icon: BookOpenText,
  },
];

const setup = [
  { href: "/academic/sessions", label: "Sessions" },
  { href: "/academic/classes", label: "Classes" },
  { href: "/academic/subjects", label: "Subjects" },
  { href: "/academic/events", label: "Events" },
  { href: "/assessments/setup/exam-recording", label: "Exam Setup" },
  { href: "/assessments/setup/grading-bands", label: "Grading Bands" },
  { href: "/assessments/setup/report-card-bundles", label: "Report Add-ons" },
  { href: "/academic/knowledge/templates", label: "Lesson/Notes Templates" },
  { href: "/academic/knowledge/assessment-profiles", label: "Assessment Profiles" },
  { href: "/admin", label: "Admin Users" },
  { href: "/academic/archived-records", label: "Archive Audit" },
  { href: "/assessments/report-cards/backfill", label: "Historical Backfill" },
];

function formatMoney(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminHeader
          label="School command center"
          title="Admin Dashboard"
          description="Start with the daily work first. Setup, recovery, and advanced configuration are still available below."
          actions={
            <Link
              href="/academic/students"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
            >
              Open Students <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active session" value={activeSession ? "Ready" : "Not set"} detail={activeSession ? "Session is active" : "Set one before term work"} />
          <MetricCard label="Teachers" value={teachers === undefined ? "..." : String(teachers.filter((t) => !t.isArchived).length)} detail="Active staff records" />
          <MetricCard label="Classes / Subjects" value={classes === undefined || subjects === undefined ? "..." : `${classes.filter((c) => !c.isArchived).length} / ${subjects.filter((s) => !s.isArchived).length}`} detail="Academic setup" />
          <MetricCard label="Outstanding" value={billing === undefined ? "..." : formatMoney(billing.summary.outstandingBalance, currency)} detail={`${billing?.summary.overdueInvoices ?? 0} overdue invoices`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Daily operations</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Most-used admin workflows</h2>
              </div>
              <School className="h-5 w-5 text-slate-300" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {operations.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 transition group-hover:bg-slate-950 group-hover:text-white">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Setup and admin tools</p>
                <h2 className="text-lg font-black text-slate-950">Less frequent work</h2>
              </div>
            </div>
            <div className="grid gap-2">
              {setup.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                >
                  {item.label}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </Link>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}
