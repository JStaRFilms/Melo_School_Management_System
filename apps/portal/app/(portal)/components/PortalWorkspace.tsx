"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { ArrowRight, Bell, CalendarDays, ChevronRight, FileText, GraduationCap, Landmark, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getUserFacingErrorMessage, ReportCardPreview, ReportCardToolbar } from "@school/shared";
import { isConvexConfigured } from "@/convex-runtime";
import type {
  PortalBillingData,
  PortalBillingInvoice,
  PortalHistoryItem,
  PortalNotificationItem,
  PortalWorkspaceData,
  PortalWorkspaceMode,
} from "@/portal-types";

const MODE_COPY: Record<
  PortalWorkspaceMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    primaryLabel: string;
    primaryHref: (studentId: string | null, sessionId: string | null, termId: string | null) => string;
    secondaryLabel: string;
    secondaryHref: (studentId: string | null, sessionId: string | null, termId: string | null) => string;
  }
> = {
  dashboard: {
    eyebrow: "Parent / student portal",
    title: "Academic dashboard",
    description: "Review the latest report card, historical term results, and school notices in one place.",
    primaryLabel: "Open report card",
    primaryHref: (studentId, sessionId, termId) => buildPortalHref("/report-cards", { studentId, sessionId, termId }),
    secondaryLabel: "View result history",
    secondaryHref: (studentId) => buildPortalHref("/results", { studentId }),
  },
  "report-cards": {
    eyebrow: "Report card view",
    title: "Printable report cards",
    description: "Switch between terms and open the full academic sheet for the active child.",
    primaryLabel: "Open history",
    primaryHref: (studentId) => buildPortalHref("/results", { studentId }),
    secondaryLabel: "See notices",
    secondaryHref: (studentId) => buildPortalHref("/notifications", { studentId }),
  },
  results: {
    eyebrow: "Result history",
    title: "Academic progress timeline",
    description: "Track recent term snapshots and jump straight back into the report card view.",
    primaryLabel: "Open report card",
    primaryHref: (studentId, sessionId, termId) => buildPortalHref("/report-cards", { studentId, sessionId, termId }),
    secondaryLabel: "View notifications",
    secondaryHref: (studentId) => buildPortalHref("/notifications", { studentId }),
  },
  notifications: {
    eyebrow: "Academic notices",
    title: "School updates",
    description: "Keep track of published results, term reminders, and upcoming academic events.",
    primaryLabel: "Open dashboard",
    primaryHref: (studentId) => buildPortalHref("/", { studentId }),
    secondaryLabel: "Open history",
    secondaryHref: (studentId) => buildPortalHref("/results", { studentId }),
  },
  billing: {
    eyebrow: "Portal billing",
    title: "Fees, balances, and receipts",
    description: "Review outstanding invoices, payment history, and launch online payment for the active child.",
    primaryLabel: "Open dashboard",
    primaryHref: (studentId) => buildPortalHref("/", { studentId }),
    secondaryLabel: "View notices",
    secondaryHref: (studentId) => buildPortalHref("/notifications", { studentId }),
  },
};

function PortalPreview({ mode }: { mode: PortalWorkspaceMode }) {
  const copy = MODE_COPY[mode];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 px-5 py-6 text-white sm:px-6 sm:py-7">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            {copy.description}
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Connect Convex to load live portal data. This fallback keeps the portal build
            stable until the environment is configured.
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-[28rem]">
            <Link
              href={copy.primaryHref(null, null, null)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
            >
              {copy.primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={copy.secondaryHref(null, null, null)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {copy.secondaryLabel}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildPortalHref(
  pathname: string,
  params: Record<string, string | null | undefined>
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatScore(value: number | null) {
  if (value === null) {
    return "-";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildQueryArgs(
  studentId: string | null,
  sessionId: string | null,
  termId: string | null,
  historyLimit: number
) {
  const args: {
    studentId?: string | null;
    sessionId?: string | null;
    termId?: string | null;
    historyLimit: number;
  } = { historyLimit };

  if (studentId) {
    args.studentId = studentId;
  }
  if (sessionId) {
    args.sessionId = sessionId;
  }
  if (termId) {
    args.termId = termId;
  }

  return args;
}

export function PortalWorkspace({ mode }: { mode: PortalWorkspaceMode }) {
  if (!isConvexConfigured()) {
    return <PortalPreview mode={mode} />;
  }

  return <PortalWorkspaceContent mode={mode} />;
}

function PortalWorkspaceContent({ mode }: { mode: PortalWorkspaceMode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializePortalPayment = useAction(
    "functions/billing:initializePortalOnlinePayment" as never
  );

  const studentId = searchParams.get("studentId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const historyLimit = mode === "results" ? 8 : mode === "report-cards" ? 6 : 4;

  const workspace = useQuery(
    "functions/portal:getWorkspaceData" as never,
    buildQueryArgs(studentId, sessionId, termId, historyLimit) as never
  ) as PortalWorkspaceData | undefined;
  const billing = useQuery(
    "functions/portal:getBillingData" as never,
    mode === "billing"
      ? ({ studentId: studentId ? (studentId as never) : (null as never) } as never)
      : ("skip" as never)
  ) as PortalBillingData | undefined;

  const resolvedStudentId = workspace?.selectedStudentId ?? null;
  const resolvedSessionId = workspace?.selectedSessionId ?? null;
  const resolvedTermId = workspace?.selectedTermId ?? null;

  const selectedStudent = workspace?.selectedStudent ?? null;
  const activeHistoryItem = useMemo(() => {
    if (!workspace?.history.length) {
      return null;
    }

    return (
      workspace.history.find(
        (item) =>
          item.sessionId === resolvedSessionId && item.termId === resolvedTermId
      ) ?? workspace.history[0]
    );
  }, [resolvedSessionId, resolvedTermId, workspace]);

  if (workspace === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded-full bg-slate-100" />
            <div className="h-8 w-2/3 rounded-2xl bg-slate-100" />
            <div className="h-16 rounded-3xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  const copy = MODE_COPY[mode];
  const primaryHref = copy.primaryHref(resolvedStudentId, resolvedSessionId, resolvedTermId);
  const secondaryHref = copy.secondaryHref(resolvedStudentId, resolvedSessionId, resolvedTermId);

  const handleSelectStudent = (nextStudentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", nextStudentId);
    params.delete("sessionId");
    params.delete("termId");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const handleSelectHistoryItem = (item: PortalHistoryItem) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextStudentId = resolvedStudentId ?? workspace.students[0]?.studentId ?? null;

    if (nextStudentId) {
      params.set("studentId", nextStudentId);
    } else {
      params.delete("studentId");
    }

    params.set("sessionId", item.sessionId);
    params.set("termId", item.termId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleStartPortalPayment = async (invoice: PortalBillingInvoice) => {
    try {
      setBillingNotice(null);
      setPayingInvoiceId(invoice.invoiceId);
      const callbackUrl = `${window.location.origin}/payments/paystack/return?studentId=${encodeURIComponent(invoice.studentId)}`;
      const result = (await initializePortalPayment({
        invoiceId: invoice.invoiceId,
        callbackUrl,
      } as never)) as {
        authorizationUrl: string | null;
      };

      if (!result.authorizationUrl) {
        throw new Error("Paystack did not return a checkout URL.");
      }

      window.location.href = result.authorizationUrl;
    } catch (error) {
      setBillingNotice(getUserFacingErrorMessage(error, "Unable to start online payment."));
      setPayingInvoiceId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 px-5 py-6 text-white sm:px-6 sm:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                {copy.eyebrow}
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                  {copy.description}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[28rem]">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-950/20 transition hover:bg-slate-100"
              >
                {copy.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                {copy.secondaryLabel}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {workspace.school.name}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                {selectedStudent ? selectedStudent.name : "No linked student found"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedStudent
                  ? `${selectedStudent.className} · ${selectedStudent.admissionNumber}`
                  : "Ask the school to link a parent or student account before using the portal."}
              </p>
            </div>

            {workspace.students.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {workspace.students.map((student) => (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => handleSelectStudent(student.studentId)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      student.isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-black uppercase">
                      {student.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join("")}
                    </span>
                    <span className="max-w-[8rem] truncate">{student.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {workspace.activeSession || workspace.activeTerm ? (
            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {workspace.activeSession && (
                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  {workspace.activeSession.name}
                </span>
              )}
              {workspace.activeTerm && (
                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  {workspace.activeTerm.name}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {mode === "dashboard" && <DashboardView workspace={workspace} activeHistoryItem={activeHistoryItem} onSelectHistoryItem={handleSelectHistoryItem} />}
      {mode === "report-cards" && <ReportCardView workspace={workspace} activeHistoryItem={activeHistoryItem} onSelectHistoryItem={handleSelectHistoryItem} />}
      {mode === "results" && <ResultsView workspace={workspace} activeHistoryItem={activeHistoryItem} onSelectHistoryItem={handleSelectHistoryItem} />}
      {mode === "notifications" && <NotificationsView workspace={workspace} />}
      {mode === "billing" && (
        <BillingView
          workspace={workspace}
          billing={billing}
          billingNotice={billingNotice}
          payingInvoiceId={payingInvoiceId}
          onPayNow={handleStartPortalPayment}
        />
      )}
    </div>
  );
}

function DashboardView({
  workspace,
  activeHistoryItem,
  onSelectHistoryItem,
}: {
  workspace: PortalWorkspaceData;
  activeHistoryItem: PortalHistoryItem | null;
  onSelectHistoryItem: (item: PortalHistoryItem) => void;
}) {
  const summary = workspace.selectedReportCard?.summary ?? activeHistoryItem;
  const reportCard = workspace.selectedReportCard;

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="Recorded subjects"
            value={summary ? String(summary.recordedSubjects) : "-"}
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Average score"
            value={summary ? formatScore(summary.averageScore) : "-"}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Pending subjects"
            value={summary ? String(summary.pendingSubjects) : "-"}
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Updates"
            value={workspace.notifications.length.toString()}
          />
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Latest report card
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">
                {reportCard?.termName ?? activeHistoryItem?.termName ?? "No report card yet"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {reportCard?.className ?? activeHistoryItem?.className ?? "Results will appear here when the school publishes them."}
              </p>
            </div>
            {workspace.selectedReportCard && (
              <Link
                href={buildPortalHref("/report-cards", {
                  studentId: workspace.selectedStudentId,
                  sessionId: workspace.selectedSessionId,
                  termId: workspace.selectedTermId,
                })}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Open full card
              </Link>
            )}
          </div>

          {reportCard ? (
            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid grid-cols-3 gap-px bg-slate-200 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <div className="bg-white px-3 py-2">Subject</div>
                <div className="bg-white px-3 py-2">Total</div>
                <div className="bg-white px-3 py-2">Grade</div>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {reportCard.results.slice(0, 4).map((result) => (
                  <div key={result.subjectId} className="grid grid-cols-3 gap-px text-sm">
                    <div className="px-3 py-3 font-medium text-slate-700">{result.subjectName}</div>
                    <div className="px-3 py-3 font-semibold text-slate-950">{formatScore(result.total)}</div>
                    <div className="px-3 py-3 font-semibold text-slate-700">{result.gradeLetter}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              The selected report card is not available yet.
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-6 xl:col-span-4">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Recent term snapshots
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Result history</h3>
            </div>
            <Link
              href={buildPortalHref("/results", { studentId: workspace.selectedStudentId })}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {workspace.history.slice(0, 3).map((item) => (
              <button
                key={`${item.sessionId}-${item.termId}`}
                type="button"
                onClick={() => onSelectHistoryItem(item)}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {item.sessionName} · {item.termName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.className}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {formatScore(item.averageScore)}
                  </span>
                </div>
                {item.note && <p className="mt-2 text-xs text-amber-700">{item.note}</p>}
              </button>
            ))}
            {workspace.history.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No result history is available yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Academic notifications
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Recent updates</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {workspace.notifications.slice(0, 3).map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ReportCardView({
  workspace,
  activeHistoryItem,
  onSelectHistoryItem,
}: {
  workspace: PortalWorkspaceData;
  activeHistoryItem: PortalHistoryItem | null;
  onSelectHistoryItem: (item: PortalHistoryItem) => void;
}) {
  const selectedStudentId = workspace.selectedStudentId;
  const selectedReportCard = workspace.selectedReportCard;

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <aside className="space-y-6 xl:col-span-4">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Term selector
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Choose a snapshot</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {workspace.history.map((item) => {
              const isActive =
                item.sessionId === workspace.selectedSessionId &&
                item.termId === workspace.selectedTermId;

              return (
                <button
                  key={`${item.sessionId}-${item.termId}`}
                  type="button"
                  onClick={() => onSelectHistoryItem(item)}
                  className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.sessionName} · {item.termName}</p>
                      <p className={`mt-1 text-xs ${isActive ? "text-white/70" : "text-slate-500"}`}>{item.className}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                      isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {formatScore(item.averageScore)}
                    </span>
                  </div>
                </button>
              );
            })}
            {workspace.history.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Report cards will appear here when the school publishes them.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Quick links
          </p>
          <div className="mt-4 grid gap-2">
            <Link
              href={buildPortalHref("/results", { studentId: selectedStudentId })}
              className="inline-flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
            >
              Open result history
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={buildPortalHref("/notifications", { studentId: selectedStudentId })}
              className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View notifications
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </aside>

      <main className="space-y-6 xl:col-span-8">
        <ReportCardToolbar
          studentName={selectedReportCard?.student.name ?? ""}
          backHref={buildPortalHref("/results", {
            studentId: selectedStudentId,
            sessionId: workspace.selectedSessionId,
            termId: workspace.selectedTermId,
          })}
        />
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          {selectedReportCard ? (
            <ReportCardPreview
              reportCard={selectedReportCard}
              backHref={buildPortalHref("/results", {
                studentId: selectedStudentId,
                sessionId: workspace.selectedSessionId,
                termId: workspace.selectedTermId,
              })}
              hideToolbar
            />
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No report card is available for the selected child and term yet.
            </div>
          )}
        </section>

        {activeHistoryItem && (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Selected snapshot
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">
                  {activeHistoryItem.sessionName} · {activeHistoryItem.termName}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeHistoryItem.className}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectHistoryItem(activeHistoryItem)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Open term
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ResultsView({
  workspace,
  activeHistoryItem,
  onSelectHistoryItem,
}: {
  workspace: PortalWorkspaceData;
  activeHistoryItem: PortalHistoryItem | null;
  onSelectHistoryItem: (item: PortalHistoryItem) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        {workspace.history.length > 0 ? (
          workspace.history.map((item) => {
            const isActive =
              item.sessionId === workspace.selectedSessionId &&
              item.termId === workspace.selectedTermId;

            return (
              <button
                key={`${item.sessionId}-${item.termId}`}
                type="button"
                onClick={() => onSelectHistoryItem(item)}
                className={`w-full rounded-[1.75rem] border p-5 text-left shadow-sm transition sm:p-6 ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? "text-white/55" : "text-slate-400"}`}>
                      {item.sessionName} · {item.termName}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{item.className}</h3>
                    <p className={`mt-1 text-sm ${isActive ? "text-white/75" : "text-slate-500"}`}>
                      {item.totalSubjects} subjects · {item.recordedSubjects} recorded · {item.pendingSubjects} pending
                    </p>
                  </div>

                  <div className={`rounded-2xl px-4 py-3 text-center ${isActive ? "bg-white/10" : "bg-slate-50"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isActive ? "text-white/55" : "text-slate-400"}`}>
                      Average
                    </p>
                    <p className="mt-1 text-2xl font-black">{formatScore(item.averageScore)}</p>
                  </div>
                </div>

                {item.note ? (
                  <p className={`mt-4 text-sm ${isActive ? "text-white/75" : "text-amber-700"}`}>
                    {item.note}
                  </p>
                ) : (
                  <p className={`mt-4 text-sm ${isActive ? "text-white/75" : "text-slate-500"}`}>
                    Open the snapshot to review the full printable report card.
                  </p>
                )}
              </button>
            );
          })
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Result history will appear here once the school publishes term results.
          </div>
        )}
      </div>

      <aside className="space-y-6 xl:col-span-4">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Current selection
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">
            {activeHistoryItem ? `${activeHistoryItem.sessionName} · ${activeHistoryItem.termName}` : "No result selected"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {activeHistoryItem?.className ?? "Use the timeline to open a term result."}
          </p>

          <div className="mt-4 grid gap-2">
            <Link
              href={buildPortalHref("/report-cards", {
                studentId: workspace.selectedStudentId,
                sessionId: workspace.selectedSessionId,
                termId: workspace.selectedTermId,
              })}
              className="inline-flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
            >
              Open report card
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={buildPortalHref("/notifications", { studentId: workspace.selectedStudentId })}
              className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View notifications
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Child profile
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">
                {workspace.selectedStudent?.name ?? "No child selected"}
              </h3>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>{workspace.selectedStudent?.className ?? "Linked class unavailable"}</p>
            <p>{workspace.selectedStudent?.admissionNumber ?? "Admission number unavailable"}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function BillingView({
  workspace,
  billing,
  billingNotice,
  payingInvoiceId,
  onPayNow,
}: {
  workspace: PortalWorkspaceData;
  billing: PortalBillingData | undefined;
  billingNotice: string | null;
  payingInvoiceId: string | null;
  onPayNow: (invoice: PortalBillingInvoice) => Promise<void>;
}) {
  if (billing === undefined) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading billing details...
      </div>
    );
  }

  const summaryCurrency = billing.invoices[0]?.currency ?? billing.settings.defaultCurrency;

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Landmark className="h-4 w-4" />}
            label="Outstanding"
            value={formatMoney(billing.studentSummary.outstandingBalance, summaryCurrency)}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Invoices"
            value={String(billing.studentSummary.invoiceCount)}
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Paid"
            value={formatMoney(billing.studentSummary.totalPaid, summaryCurrency)}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Household children"
            value={String(billing.householdSummary.studentCount)}
          />
        </section>

        {billingNotice ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            {billingNotice}
          </div>
        ) : null}

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Billing overview
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Outstanding invoices</h3>
              <p className="mt-1 text-sm text-slate-500">
                Review balances for {workspace.selectedStudent?.name ?? "the selected child"} and pay eligible invoices online.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {billing.settings.allowOnlinePayments ? "Online payments enabled" : "Online payments unavailable"}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {billing.invoices.length > 0 ? (
              billing.invoices.map((invoice) => (
                <div key={invoice.invoiceId} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {invoice.invoiceNumber} · {invoice.feePlanName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueDate)} · {invoice.status}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total</p>
                          <p className="mt-1 font-semibold text-slate-950">{formatMoney(invoice.totalAmount, invoice.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Paid</p>
                          <p className="mt-1 font-semibold text-emerald-700">{formatMoney(invoice.amountPaid, invoice.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Balance</p>
                          <p className="mt-1 font-semibold text-amber-700">{formatMoney(invoice.balanceDue, invoice.currency)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:min-w-[13rem]">
                      <button
                        type="button"
                        onClick={() => void onPayNow(invoice)}
                        disabled={!invoice.canPayOnline || payingInvoiceId === invoice.invoiceId}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ArrowRight className="h-4 w-4" />
                        {payingInvoiceId === invoice.invoiceId ? "Opening checkout..." : "Pay now"}
                      </button>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                        {invoice.canPayOnline
                          ? "This launches Paystack with the current outstanding balance."
                          : "Online payment is not available for this invoice right now."}
                      </div>
                    </div>
                  </div>

                  {invoice.lineItems.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="grid grid-cols-[1fr_auto] gap-px bg-slate-200 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        <div className="bg-white px-3 py-2">Charge</div>
                        <div className="bg-white px-3 py-2 text-right">Amount</div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {invoice.lineItems.map((item) => (
                          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 px-3 py-3 text-sm">
                            <span className="text-slate-700">{item.label}</span>
                            <span className="font-semibold text-slate-950">{formatMoney(item.amount, invoice.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No invoices are available for the selected child yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-6 xl:col-span-4">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Payment history
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Receipts and status</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {billing.payments.length > 0 ? (
              billing.payments.map((payment) => (
                <div key={payment.paymentId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">{payment.invoiceNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {payment.reference} · {payment.provider ?? payment.paymentMethod}
                  </p>
                  <p className="mt-3 text-lg font-black text-emerald-700">
                    {formatMoney(payment.amountApplied, summaryCurrency)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Received {formatDate(payment.receivedAt)} · {payment.reconciliationStatus}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No payment receipts are available yet for this child.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function NotificationsView({ workspace }: { workspace: PortalWorkspaceData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        {workspace.notifications.length > 0 ? (
          workspace.notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Academic notifications will appear here when the school posts them.
          </div>
        )}
      </div>

      <aside className="space-y-6 xl:col-span-4">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Portal context
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">
                {workspace.school.name}
              </h3>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>{workspace.selectedStudent?.name ?? "No child selected"}</p>
            <p>{workspace.activeTerm?.name ?? "Active term unavailable"}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
          {icon}
        </div>
      </div>
    </div>
  );
}

function NotificationCard({ notification }: { notification: PortalNotificationItem }) {
  const toneClasses = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  const card = (
    <div className={`rounded-[1.5rem] border p-4 shadow-sm ${toneClasses[notification.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{notification.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{notification.body}</p>
        </div>
        <Bell className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />
      </div>
    </div>
  );

  if (!notification.href) {
    return card;
  }

  return (
    <Link href={notification.href} className="block transition hover:scale-[0.99]">
      {card}
    </Link>
  );
}
