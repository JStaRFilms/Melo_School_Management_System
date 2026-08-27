"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Banknote,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Plus,
  School,
  Users,
  AlertCircle,
  Clock,
  X,
  ExternalLink,
} from "lucide-react";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";

type TeacherRecord = {
  _id: string;
  isArchived?: boolean;
  name?: string;
  email?: string;
  role?: string;
};

type ClassRecord = {
  _id: string;
  isArchived?: boolean;
  name: string;
  level: string;
  gradeName?: string;
  classLabel?: string;
  formTeacherId?: string;
  formTeacherName?: string;
  subjectNames: string[];
  studentCount: number;
};

type SubjectRecord = {
  _id: string;
  isArchived?: boolean;
  name: string;
  code?: string;
};

type SessionRecord = {
  _id: string;
  isActive?: boolean;
  isArchived?: boolean;
  name: string;
  startDate?: number;
  endDate?: number;
};

type SchoolEvent = {
  _id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  createdAt: number;
};

type TimelineAuditEvent = {
  _id: string;
  eventType:
    | "session_dates_updated"
    | "term_dates_updated"
    | "term_activated"
    | "unused_timeline_deleted"
    | "production_timeline_repair";
  entityType: "session" | "term";
  entityName: string;
  actorName: string;
  actorLabel: string;
  createdAt: number;
  before: string;
  after: string;
};

type BillingDashboard = {
  summary: {
    totalInvoiceAmount: number;
    amountCollected: number;
    outstandingBalance: number;
    invoiceCount: number;
    paymentCount: number;
    overdueInvoices: number;
  };
  settings: { defaultCurrency: string } | null;
};

function formatMoney(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatEventDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function AdminDashboardPage() {
  const teachers = useQuery("functions/academic/academicSetup:listTeachers" as never) as TeacherRecord[] | undefined;
  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as ClassRecord[] | undefined;
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as SubjectRecord[] | undefined;
  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as SessionRecord[] | undefined;
  const billing = useQuery("functions/billing:getBillingDashboard" as never, {} as never) as BillingDashboard | undefined;
  const events = useQuery("functions/academic/events:listEvents" as never) as SchoolEvent[] | undefined;
  const auditEvents = useQuery(
    "functions/academic/academicSetup:listAcademicTimelineAuditEvents" as never
  ) as TimelineAuditEvent[] | undefined;

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(true);

  // Derived real database metrics
  const activeSession = useMemo(
    () => sessions?.find((session) => session.isActive && !session.isArchived) ?? null,
    [sessions]
  );
  const activeTeachers = useMemo(() => teachers?.filter((t) => !t.isArchived) ?? [], [teachers]);
  const activeClasses = useMemo(() => classes?.filter((c) => !c.isArchived) ?? [], [classes]);
  const activeSubjects = useMemo(() => subjects?.filter((s) => !s.isArchived) ?? [], [subjects]);

  const totalEnrolledStudents = useMemo(
    () => activeClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0),
    [activeClasses]
  );
  const unassignedClasses = useMemo(
    () => activeClasses.filter((c) => !c.formTeacherId),
    [activeClasses]
  );

  const currency = billing?.settings?.defaultCurrency ?? "NGN";
  const outstandingBalance = billing?.summary?.outstandingBalance ?? 0;
  const overdueInvoices = billing?.summary?.overdueInvoices ?? 0;

  // 100% Real Setup Readiness Milestones
  const setupMilestones = useMemo(() => {
    return [
      {
        id: "session",
        title: "Academic Session & Terms",
        description: activeSession ? `Active: ${activeSession.name}` : "No active session set",
        status: Boolean(activeSession),
        href: "/academic/sessions",
        actionLabel: "Configure Session",
      },
      {
        id: "classes",
        title: "Classrooms & Grade Arms",
        description: activeClasses.length > 0 ? `${activeClasses.length} classes created` : "0 classrooms configured",
        status: activeClasses.length > 0,
        href: "/academic/classes",
        actionLabel: "Create Classes",
      },
      {
        id: "subjects",
        title: "Subject Curriculum Catalog",
        description: activeSubjects.length > 0 ? `${activeSubjects.length} subjects registered` : "0 subjects configured",
        status: activeSubjects.length > 0,
        href: "/academic/subjects",
        actionLabel: "Add Subjects",
      },
      {
        id: "teachers",
        title: "Teaching Faculty Roster",
        description:
          activeTeachers.length > 0
            ? `${activeTeachers.length} staff (${unassignedClasses.length} unassigned classes)`
            : "0 teachers registered",
        status: activeTeachers.length > 0,
        href: "/academic/teachers",
        actionLabel: "Add Teachers",
      },
      {
        id: "students",
        title: "Student Body Enrollment",
        description:
          totalEnrolledStudents > 0
            ? `${totalEnrolledStudents} students enrolled`
            : "0 students enrolled",
        status: totalEnrolledStudents > 0,
        href: "/academic/students",
        actionLabel: "Enroll Students",
      },
    ];
  }, [activeSession, activeClasses, activeSubjects, activeTeachers, unassignedClasses, totalEnrolledStudents]);

  const completedMilestones = setupMilestones.filter((m) => m.status).length;
  const setupPercentage = Math.round((completedMilestones / setupMilestones.length) * 100);
  const isSetupFullyComplete = completedMilestones === setupMilestones.length;

  // 30-Day Expiry & Local Dismissal Tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isSetupFullyComplete) {
      const storedCompletedAt = localStorage.getItem("melo_setup_completed_at");
      let completedAt = storedCompletedAt ? parseInt(storedCompletedAt, 10) : null;
      if (!completedAt) {
        completedAt = Date.now();
        localStorage.setItem("melo_setup_completed_at", String(completedAt));
      }

      const dismissed = localStorage.getItem("melo_setup_banner_dismissed") === "true";
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const isExpired = Date.now() - completedAt > THIRTY_DAYS_MS;

      setIsBannerDismissed(dismissed || isExpired);
    }
  }, [isSetupFullyComplete]);

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("melo_setup_banner_dismissed", "true");
    }
  };

  const isLoaded =
    teachers !== undefined &&
    classes !== undefined &&
    subjects !== undefined &&
    sessions !== undefined &&
    billing !== undefined;

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* ═══ COMMAND CENTER HEADER ═══════════════════════════ */}
        <AdminHeader
          label="School command center"
          title="Admin Dashboard"
          description="Operational pulse, institution setup progress, and real-time academic workflows."
          actions={
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {isSetupFullyComplete && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer text-xs font-bold shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Review Setup</span>
                </button>
              )}

              {activeSession ? (
                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 border border-slate-200 shadow-xs shrink-0">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900">
                    Active: <span className="font-extrabold text-brand-primary">{activeSession.name}</span>
                  </span>
                </div>
              ) : (
                <Link
                  href="/academic/sessions"
                  className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 border border-amber-200 shadow-xs hover:bg-amber-100/70 transition shrink-0"
                >
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Action Req: Set Active Session
                  </span>
                </Link>
              )}
            </div>
          }
        />

        {/* ═══ SECTION 1: SETUP CHECKLIST (Flat, Breathable, Unboxed) ═══ */}
        {!isSetupFullyComplete ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-primary text-white text-[10px] font-black">
                    {completedMilestones}
                  </span>
                  <h3 className="font-display text-sm font-bold text-slate-950">
                    School Setup & Launch Checklist
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Complete these 5 core foundation steps to activate full grading, attendance, and billing.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                <div className="w-28 sm:w-36 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${setupPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-900">{setupPercentage}%</span>
              </div>
            </div>

            {/* Desktop: 5-Column Grid */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-3 pt-1">
              {setupMilestones.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                    m.status
                      ? "bg-slate-50/50 border-slate-200/60"
                      : "bg-amber-50/30 border-amber-200/60 ring-1 ring-amber-500/10"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      {m.status ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                          <Check className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                          <AlertCircle className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-950 leading-snug">{m.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">{m.description}</p>
                  </div>

                  {!m.status && (
                    <Link
                      href={m.href}
                      className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xs hover:bg-brand-primary transition-colors"
                    >
                      <span>{m.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile / Tablet View: Flat, Space-Efficient List */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {setupMilestones.map((m) => (
                <div
                  key={m.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 rounded-lg px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                        m.status
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {m.status ? (
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-950 truncate">{m.title}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{m.description}</p>
                    </div>
                  </div>

                  {m.status ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      Done
                    </span>
                  ) : (
                    <Link
                      href={m.href}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand-primary active:scale-95 transition shrink-0 shadow-2xs"
                    >
                      <span>
                        {m.actionLabel
                          .replace("Configure ", "")
                          .replace("Create ", "")
                          .replace("Add ", "")
                          .replace("Enroll ", "")}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !isBannerDismissed ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs shrink-0">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-emerald-950 truncate">All Core School Systems Operational</h4>
                <p className="text-[11px] text-emerald-700 truncate">
                  Sessions, classrooms, subjects, staff roster, and student body are configured.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
              >
                Review Setup
              </button>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-100/60 hover:text-emerald-900 transition-colors cursor-pointer"
                title="Dismiss banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* ═══ REVIEW SETUP MODAL ═══════════════════════════════ */}
        {isReviewModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setIsReviewModalOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-950">
                      School Foundation & Launch Readiness
                    </h3>
                    <p className="text-xs text-slate-500">
                      All 5 core foundation milestones are fully configured.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2.5">
                {setupMilestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                        <p className="text-[11px] text-slate-500">{m.description}</p>
                      </div>
                    </div>

                    <Link
                      href={m.href}
                      onClick={() => setIsReviewModalOpen(false)}
                      className="text-xs font-bold text-brand-primary hover:opacity-80 flex items-center gap-1"
                    >
                      <span>Manage</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SECTION 2: LIVE OPERATIONAL PULSE (Real Data) ════ */}
        <section className="w-full">
          <StatGroup
            variant="scroll"
            stats={[
              {
                label: "Student Roll",
                value: String(totalEnrolledStudents),
                icon: <GraduationCap />,
                description: `${activeClasses.length} Classes Populated`,
              },
              {
                label: "Teaching Staff",
                value: String(activeTeachers.length),
                icon: <Users />,
                description:
                  unassignedClasses.length === 0
                    ? "Full Coverage"
                    : `${unassignedClasses.length} Unassigned Arm${unassignedClasses.length > 1 ? "s" : ""}`,
              },
              {
                label: "Academic Structure",
                value: `${activeClasses.length} / ${activeSubjects.length}`,
                icon: <BookOpenText />,
                description: "Classes / Subjects",
              },
              {
                label: "Fee Balances",
                value: formatMoney(outstandingBalance, currency),
                icon: <Banknote />,
                description: `${overdueInvoices} Overdue Invoices`,
              },
            ]}
          />
        </section>

        {/* ═══ SECTION 3: 1-CLICK DAILY ACTIONS STRIP ═══════════ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Quick Administrative Triggers
            </span>
            <span className="text-[11px] font-bold text-slate-600">Daily Operations</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            <Link
              href="/academic/students"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">Enroll Student</span>
            </Link>

            <Link
              href="/academic/teachers"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">Add Teacher</span>
            </Link>

            <Link
              href="/assessments/results/entry"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">Enter Scores</span>
            </Link>

            <Link
              href="/billing"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <Banknote className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">Billing Hub</span>
            </Link>

            <Link
              href="/academic/events"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group sm:col-span-2 md:col-span-1"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">School Events</span>
            </Link>
          </div>
        </div>

        {/* ═══ SECTION 4: CLASSROOM CAPACITY & AUDIT STREAM ═════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
          
          {/* Left Panel: Classroom Roll & Capacity Breakdown */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-950">Classroom Roll & Faculty</h3>
                <p className="text-xs text-slate-500">Active class arms, student rolls, and assigned form teachers.</p>
              </div>
              <Link
                href="/academic/classes"
                className="text-xs font-bold text-brand-primary hover:opacity-80 flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {activeClasses.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mx-auto">
                  <School className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-950">No classes configured yet</p>
                  <p className="text-[11px] text-slate-500">Create classes to begin enrolling students and assigning teachers.</p>
                </div>
                <Link
                  href="/academic/classes"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Class
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeClasses.slice(0, 6).map((c) => (
                  <div key={c._id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-lg px-1 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-xs shrink-0">
                        {c.name.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-950 truncate">{c.name}</h4>
                          <span className="text-[10px] font-medium text-slate-400">({c.level})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {c.formTeacherName ? (
                            <span>Form Teacher: <span className="font-semibold text-slate-700">{c.formTeacherName}</span></span>
                          ) : (
                            <span className="text-amber-600 font-semibold">⚠️ No Form Teacher Assigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900">{c.studentCount}</span>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Students</p>
                      </div>
                      <Link
                        href="/academic/students"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                        title="View students in this class"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Recent Activity & Calendar Timeline */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-950">Recent Audit & Events</h3>
                <p className="text-xs text-slate-500">Live operational timeline and school calendar events.</p>
              </div>
              <Link
                href="/academic/events"
                className="text-xs font-bold text-brand-primary hover:opacity-80 flex items-center gap-1"
              >
                <span>Calendar</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Combined Timeline & Event Stream */}
            <div className="space-y-3">
              {/* Upcoming Events */}
              {events && events.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Upcoming Events
                  </span>
                  {events.slice(0, 2).map((ev) => (
                    <div
                      key={ev._id}
                      className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <CalendarDays className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-950 truncate">{ev.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{formatEventDate(ev.startDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Real Academic Audit Stream */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recent Administrative Actions
                </span>

                {auditEvents && auditEvents.length > 0 ? (
                  <div className="space-y-2">
                    {auditEvents.slice(0, 5).map((log) => (
                      <div key={log._id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-slate-50">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-800 font-medium">
                            <span className="font-bold text-slate-950">{log.actorName || "Admin"}</span>{" "}
                            {log.eventType.replace(/_/g, " ")} for{" "}
                            <span className="font-semibold">{log.entityName}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <p>No recent administrative audit records logged yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Actions and timeline changes stream here live.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

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

        <div className="h-36 rounded-2xl bg-white border border-slate-200/60 p-6 space-y-3" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white border border-slate-200/60 p-4 space-y-2" />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 h-64" />
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 h-64" />
        </div>
      </div>
    </main>
  );
}

