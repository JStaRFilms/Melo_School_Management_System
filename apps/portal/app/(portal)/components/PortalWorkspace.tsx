"use client";

import { isConvexConfigured } from "@/convex-runtime";
import type {
PortalBillingData,
PortalBillingInvoice,
PortalHistoryItem,
PortalNotificationItem,
PortalWorkspaceData,
PortalWorkspaceMode,
} from "@/portal-types";
import { getUserFacingErrorMessage,ReportCardPreview,ReportCardToolbar } from "@school/shared";
import { useAction,useQuery } from "convex/react";
import { ArrowRight,ChevronRight,ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { useEffect,useMemo,useState } from "react";

/* ─── Helpers ──────────────────────────────────────────────── */

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
    return "—";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

/* ─── Preview (No Convex) ──────────────────────────────────── */

function PortalPreview({ mode }: { mode: PortalWorkspaceMode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-400">{getGreeting()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {mode === "dashboard" && "Your academic overview"}
            {mode === "results" && "Academic history"}
            {mode === "report-cards" && "Report cards"}
            {mode === "notifications" && "School updates"}
            {mode === "billing" && "Fees & payments"}
          </h1>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Connect Convex to load live portal data. This fallback keeps the
          portal build stable until the environment is configured.
        </div>
      </div>
    </div>
  );
}

/* ─── Entry Point ──────────────────────────────────────────── */

export function PortalWorkspace({ mode }: { mode: PortalWorkspaceMode }) {
  if (!isConvexConfigured()) {
    return <PortalPreview mode={mode} />;
  }

  return <PortalWorkspaceContent mode={mode} />;
}

/* ─── Main Workspace Content ───────────────────────────────── */

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

  useEffect(() => {
    if (workspace?.school?.name) {
      document.title = `${workspace.school.name} · Portal`;
    }
  }, [workspace?.school?.name]);

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
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-48 rounded bg-slate-100" />
          <div className="h-8 w-72 rounded bg-slate-100" />
          <div className="h-32 rounded-2xl bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

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

  /* Report cards get their own full-bleed layout */
  if (mode === "report-cards") {
    return (
      <PortalReportCardLayout
        workspace={workspace}

        onSelectHistoryItem={handleSelectHistoryItem}
        onSelectStudent={handleSelectStudent}
      />
    );
  }

  /* All other modes share the greeting bar + mode-specific body */
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      {/* ── Greeting Bar ── */}
      <PortalGreetingBar
        workspace={workspace}
        selectedStudent={selectedStudent}
        onSelectStudent={handleSelectStudent}
      />

      {/* ── Mode-Specific Content ── */}
      <div className="mt-8">
        {mode === "dashboard" && (
          <DashboardView
            workspace={workspace}
            activeHistoryItem={activeHistoryItem}
            onSelectHistoryItem={handleSelectHistoryItem}
          />
        )}
        {mode === "results" && (
          <ResultsView
            workspace={workspace}
            activeHistoryItem={activeHistoryItem}
            onSelectHistoryItem={handleSelectHistoryItem}
          />
        )}
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
    </div>
  );
}

/* ─── Greeting Bar ─────────────────────────────────────────── */

function PortalGreetingBar({
  workspace,
  selectedStudent,
  onSelectStudent,
}: {
  workspace: PortalWorkspaceData;
  selectedStudent: PortalWorkspaceData["selectedStudent"];
  onSelectStudent: (studentId: string) => void;
}) {
  const viewerFirstName = workspace.viewer.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">
            {getGreeting()}, {viewerFirstName}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            {selectedStudent?.name ?? "No child linked"}
          </h1>
          {selectedStudent && (
            <p className="mt-1 text-sm text-slate-500">
              {selectedStudent.className} · {selectedStudent.admissionNumber} · {selectedStudent.schoolName}
            </p>
          )}
        </div>

        {workspace.students.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {workspace.students.map((student) => (
              <button
                key={student.studentId}
                type="button"
                onClick={() => onSelectStudent(student.studentId)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                  student.isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{student.name.split(" ")[0]}</span>
                {student.schoolName !== workspace.school.name && (
                  <span className="ml-1 text-[10px] opacity-80">· {student.schoolName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {(workspace.activeSession || workspace.activeTerm) && (
        <p className="text-xs font-medium text-slate-400">
          {workspace.activeSession?.name}
          {workspace.activeSession && workspace.activeTerm && " · "}
          {workspace.activeTerm?.name}
          {" · "}
          {workspace.school.name}
        </p>
      )}
    </div>
  );
}

/* ─── Dashboard View ───────────────────────────────────────── */

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
  const studentFirstName = workspace.selectedStudent?.name.split(" ")[0] ?? "Your child";

  return (
    <div className="space-y-10">
      {/* ── Term Snapshot ── */}
      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Term snapshot</h2>
            {summary ? (
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                {studentFirstName} scored an average of{" "}
                <span className="font-bold text-slate-900">{formatScore(summary.averageScore)}%</span>
                {" "}across{" "}
                <span className="font-bold text-slate-900">{summary.recordedSubjects}</span>
                {" "}subjects
                {activeHistoryItem ? ` in ${activeHistoryItem.termName}` : ""}.
                {summary.pendingSubjects > 0 && (
                  <span className="text-amber-600">
                    {" "}{summary.pendingSubjects} subject{summary.pendingSubjects > 1 ? "s" : ""} still pending.
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Results will appear here when the school publishes them.
              </p>
            )}
          </div>
          {workspace.selectedReportCard && (
            <Link
              href={buildPortalHref("/report-cards", {
                studentId: workspace.selectedStudentId,
                sessionId: workspace.selectedSessionId,
                termId: workspace.selectedTermId,
              })}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
            >
              Full report
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Mini subject table */}
        {reportCard && reportCard.results.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Subject</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Score</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportCard.results.slice(0, 5).map((result) => (
                  <tr key={result.subjectId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{result.subjectName}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatScore(result.total)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-500">{result.gradeLetter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportCard.results.length > 5 && (
              <div className="border-t border-slate-100 px-4 py-2 text-center">
                <Link
                  href={buildPortalHref("/report-cards", {
                    studentId: workspace.selectedStudentId,
                    sessionId: workspace.selectedSessionId,
                    termId: workspace.selectedTermId,
                  })}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  +{reportCard.results.length - 5} more subjects →
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Bottom Two-Column ── */}
      <div className="grid gap-10 lg:grid-cols-2">
        {/* Recent Results */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent results</h2>
            <Link
              href={buildPortalHref("/results", { studentId: workspace.selectedStudentId })}
              className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              See all →
            </Link>
          </div>
          <div className="space-y-1">
            {workspace.history.slice(0, 3).map((item) => (
              <button
                key={`${item.sessionId}-${item.termId}`}
                type="button"
                onClick={() => onSelectHistoryItem(item)}
                className="group flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 group-hover:bg-slate-200 transition-colors tabular-nums">
                    {formatScore(item.averageScore)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.termName}</p>
                    <p className="text-xs text-slate-500">{item.sessionName}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>
            ))}
            {workspace.history.length === 0 && (
              <p className="py-4 text-sm text-slate-400 text-center">No results available yet.</p>
            )}
          </div>
        </section>

        {/* Updates */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Updates</h2>
            {workspace.notifications.length > 3 && (
              <Link
                href={buildPortalHref("/notifications", { studentId: workspace.selectedStudentId })}
                className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                See all →
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {workspace.notifications.slice(0, 3).map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
            {workspace.notifications.length === 0 && (
              <p className="py-4 text-sm text-slate-400 text-center">No updates yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  Report Card Layout (PRESERVED — approved in prior session) */
/* ──────────────────────────────────────────────────────────── */

function PortalReportCardLayout({
  workspace,
  onSelectHistoryItem,
  onSelectStudent,
}: {
  workspace: PortalWorkspaceData;
  onSelectHistoryItem: (item: PortalHistoryItem) => void;
  onSelectStudent: (studentId: string) => void;
}) {
  const selectedReportCard = workspace.selectedReportCard;

  return (
    <div className="lg:h-[calc(100vh-64px)] lg:overflow-hidden flex flex-col bg-surface-200">
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar Bucket - Management & Navigation */}
        <aside className="lg:w-[460px] lg:h-full lg:overflow-y-auto border-r border-slate-200/60 bg-white custom-scrollbar flex flex-col lg:order-1 pt-6 pb-10">
          <div className="space-y-8">
            <div className="space-y-6 px-5">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">Report Cards</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Select a child and term to view their academic records.
                </p>
              </div>

              {workspace.students.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                    Select Child
                  </p>
                  <div className="grid gap-2">
                    {workspace.students.map((student) => (
                      <button
                        key={student.studentId}
                        onClick={() => onSelectStudent(student.studentId)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition text-sm ${
                          student.isActive
                            ? "border-slate-300 bg-slate-50 font-bold text-slate-900 shadow-sm"
                            : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span>
                          <span className="block">{student.name}</span>
                          <span className="mt-0.5 block text-xs font-medium text-slate-500">
                            {student.schoolName} · {student.className}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Result History
                </p>
                <div className="grid gap-2">
                  {workspace.history.map((item) => {
                    const isActive =
                      item.sessionId === workspace.selectedSessionId &&
                      item.termId === workspace.selectedTermId;

                    return (
                      <button
                        key={`${item.sessionId}-${item.termId}`}
                        onClick={() => onSelectHistoryItem(item)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition text-sm ${
                          isActive
                            ? "border-slate-300 bg-slate-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <p className={`font-bold ${isActive ? "text-slate-900" : "text-slate-700"}`}>
                            {item.sessionName} · {item.termName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.className}
                          </p>
                        </div>
                        <span className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold ${
                          isActive ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {formatScore(item.averageScore)}
                        </span>
                      </button>
                    );
                  })}
                  {workspace.history.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      No report cards available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Bucket - The Report Card Sheet */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-12 lg:order-2">
          <div className="mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {selectedReportCard ? (
              <>
                <ReportCardToolbar
                  studentName={selectedReportCard.student.name}
                  backHref={buildPortalHref("/results", {
                    studentId: workspace.selectedStudentId,
                  })}
                />
                <ReportCardPreview
                  reportCard={selectedReportCard}
                  backHref={buildPortalHref("/results", {
                    studentId: workspace.selectedStudentId,
                  })}
                  hideToolbar
                />
              </>
            ) : (
              <div className="mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Select a term to view the report card.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Results View ─────────────────────────────────────────── */

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">Academic history</h2>
        {activeHistoryItem && (
          <Link
            href={buildPortalHref("/report-cards", {
              studentId: workspace.selectedStudentId,
              sessionId: workspace.selectedSessionId,
              termId: workspace.selectedTermId,
            })}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
          >
            Open report card
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {workspace.history.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {/* Desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Session</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Term</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Class</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Average</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Subjects</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.history.map((item) => {
                const isActive =
                  item.sessionId === workspace.selectedSessionId &&
                  item.termId === workspace.selectedTermId;

                return (
                  <tr
                    key={`${item.sessionId}-${item.termId}`}
                    onClick={() => onSelectHistoryItem(item)}
                    className={`transition-colors cursor-pointer ${
                      isActive
                        ? "bg-emerald-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-600">{item.sessionName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.termName}</td>
                    <td className="px-4 py-3 text-slate-600">{item.className}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                      {formatScore(item.averageScore)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{item.totalSubjects}</td>
                    <td className="px-4 py-3 text-right">
                      {isActive && (
                        <div className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile list — stacked rows */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {workspace.history.map((item) => {
              const isActive =
                item.sessionId === workspace.selectedSessionId &&
                item.termId === workspace.selectedTermId;

              return (
                <button
                  key={`m-${item.sessionId}-${item.termId}`}
                  type="button"
                  onClick={() => onSelectHistoryItem(item)}
                  className={`flex w-full items-center justify-between px-4 py-4 text-left transition-colors cursor-pointer ${
                    isActive ? "bg-emerald-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.termName} · {item.sessionName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.className} · {item.totalSubjects} subjects
                    </p>
                    {item.note && (
                      <p className="mt-1 text-xs font-medium text-amber-600">{item.note}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-slate-900 tabular-nums">
                    {formatScore(item.averageScore)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Result history will appear here once the school publishes term results.
        </div>
      )}
    </div>
  );
}

/* ─── Billing View ─────────────────────────────────────────── */

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
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const summaryCurrency = billing.invoices[0]?.currency ?? billing.settings.defaultCurrency;
  const studentName = workspace.selectedStudent?.name ?? "your child";

  return (
    <div className="space-y-8">
      {/* Summary line */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Fees & payments</h2>
        <p className="mt-2 text-[15px] text-slate-600">
          {billing.studentSummary.outstandingBalance > 0 ? (
            <>
              {studentName} has{" "}
              <span className="font-bold text-amber-600">
                {formatMoney(billing.studentSummary.outstandingBalance, summaryCurrency)}
              </span>{" "}
              outstanding across {billing.studentSummary.invoiceCount} invoice
              {billing.studentSummary.invoiceCount !== 1 ? "s" : ""}.
              {billing.studentSummary.totalPaid > 0 && (
                <span className="text-slate-500">
                  {" "}
                  {formatMoney(billing.studentSummary.totalPaid, summaryCurrency)} paid so far.
                </span>
              )}
            </>
          ) : (
            <>
              All fees for {studentName} are settled.{" "}
              <span className="text-emerald-600 font-semibold">No outstanding balance.</span>
            </>
          )}
        </p>
      </div>

      {billingNotice && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {billingNotice}
        </div>
      )}

      {/* Invoices */}
      {billing.invoices.length > 0 ? (
        <div className="space-y-6">
          {billing.invoices.map((invoice) => (
            <div key={invoice.invoiceId} className="overflow-hidden rounded-xl border border-slate-200">
              {/* Invoice header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{invoice.feePlanName}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {invoice.invoiceNumber} · Due {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  invoice.status === "paid"
                    ? "bg-emerald-50 text-emerald-700"
                    : invoice.status === "overdue"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {invoice.status}
                </span>
              </div>

              {/* Line items — receipt style */}
              {invoice.lineItems.length > 0 && (
                <div className="divide-y divide-slate-100 px-5">
                  {invoice.lineItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatMoney(item.amount, invoice.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatMoney(invoice.totalAmount, invoice.currency)}
                  </span>
                </div>
                {invoice.amountPaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Paid</span>
                    <span className="font-semibold text-emerald-600 tabular-nums">
                      −{formatMoney(invoice.amountPaid, invoice.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[15px] pt-2 border-t border-dashed border-slate-200">
                  <span className="font-semibold text-slate-700">Balance due</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatMoney(invoice.balanceDue, invoice.currency)}
                  </span>
                </div>
              </div>

              {/* Pay button */}
              {invoice.canPayOnline && invoice.balanceDue > 0 && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void onPayNow(invoice)}
                    disabled={payingInvoiceId === invoice.invoiceId}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {payingInvoiceId === invoice.invoiceId
                      ? "Opening Paystack..."
                      : `Pay ${formatMoney(invoice.balanceDue, invoice.currency)} now`}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No invoices for {studentName} right now.
        </div>
      )}

      {/* Payment history */}
      {billing.payments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Payment history</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Invoice</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Method</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billing.payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td className="px-4 py-3 font-medium text-slate-700">{payment.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{payment.provider ?? payment.paymentMethod}</td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{formatDate(payment.receivedAt)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                      {formatMoney(payment.amountApplied, summaryCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Notifications View ───────────────────────────────────── */

function NotificationsView({ workspace }: { workspace: PortalWorkspaceData }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900">School updates</h2>

      {workspace.notifications.length > 0 ? (
        <div className="space-y-1">
          {workspace.notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Notifications will appear here when the school posts them.
        </div>
      )}
    </div>
  );
}

/* ─── Shared: Notification Row ─────────────────────────────── */

function NotificationRow({ notification }: { notification: PortalNotificationItem }) {
  const dotColor = {
    info: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
  } as const;

  const content = (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50">
      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor[notification.tone]}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{notification.body}</p>
      </div>
      {notification.href && (
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
      )}
    </div>
  );

  if (!notification.href) {
    return content;
  }

  return (
    <Link href={notification.href} className="block cursor-pointer">
      {content}
    </Link>
  );
}
