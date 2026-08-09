"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { 
  User, 
  FileQuestion, 
  FileCheck, 
  AlertTriangle, 
  Eye, 
  Check, 
  X, 
  Clock, 
  UserCheck, 
  RefreshCw,
  Search,
  Lock,
  CheckCircle2,
  ArrowLeft,
  FileText,
  CheckSquare,
  AlertCircle,
  List,
  Columns,
  ArrowUpDown,
  Link
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";

type Detail = {
  applicationId: string;
  publicId: string;
  state: string;
  revision: number;
  snapshotId: string | null;
  decisionState: string | null;
  conversionState: string | null;
  documentCount: number;
  profile: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    preferredName: string | null;
    dateOfBirth: number;
    gender: string | null;
    nationality: string | null;
    countryOfBirth: string | null;
    address: string | null;
  } | null;
  answers: Array<{
    key: string;
    label: string;
    valueType: string;
    value: string | null;
    dataClass: string;
    redacted: boolean;
  }>;
  sensitiveAnswerCount: number;
};

type DocumentRow = {
  documentId: string;
  documentKey: string;
  category: string;
  state: string;
  sensitivity: string;
  version: number;
  updatedAt: number;
};

type QueueRow = {
  applicationId: string;
  publicId: string;
  state: string;
  updatedAt: number;
  intakeId: string;
  firstName?: string;
  lastName?: string;
};

interface AdmissionsTriageProps {
  schoolId: string;
  schoolSlug?: string;
  intakeSlug?: string;
  intakeId: string;
  intakeName: string;
  onBack: () => void;
  canView: boolean;
  canReview: boolean;
  canRecord: boolean;
  canAssign: boolean;
  canDecide: boolean;
  canConvert: boolean;
}

export function AdmissionsTriage({
  schoolId,
  schoolSlug,
  intakeSlug,
  intakeId,
  intakeName,
  onBack,
  canView,
  canReview,
  canRecord,
  canAssign,
  canDecide,
  canConvert
}: AdmissionsTriageProps) {
  const [filterState, setFilterState] = useState("");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "inbox">("list");
  const [sortField, setSortField] = useState<"updatedAt" | "name" | "publicId" | "state">("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const getPublicLink = () => {
    if (typeof window === "undefined" || !schoolSlug || !intakeSlug) return "";
    const origin = window.location.origin;
    if (origin.includes("localhost:3002")) {
      return `http://localhost:3006/s/${schoolSlug}/i/${intakeSlug}`;
    }
    return origin.replace("admin.", "apply.") + `/s/${schoolSlug}/i/${intakeSlug}`;
  };

  // Convex hooks
  const queue = useQuery(
    "functions/admissions/staff:listQueuePage" as never,
    schoolId && intakeId ? { schoolId, intakeId, ...(filterState ? { state: filterState } : {}), paginationOpts: { numItems: 50, cursor: null } } as never : "skip" as never
  ) as { page: QueueRow[] } | undefined;

  const detail = useQuery(
    "functions/admissions/staff:getApplicationDetail" as never,
    selectedAppId ? { applicationId: selectedAppId } as never : "skip" as never
  ) as Detail | undefined;

  const documents = useQuery(
    "functions/admissions/staff:listApplicationDocuments" as never,
    selectedAppId && canReview ? { applicationId: selectedAppId } as never : "skip" as never
  ) as DocumentRow[] | undefined;

  const classes = useQuery(
    "functions/admissions/staff:listConversionClasses" as never,
    canConvert && detail?.decisionState === "accepted" && detail?.conversionState === null ? { applicationId: selectedAppId } as never : "skip" as never
  ) as Array<{ classId: string; name: string }> | undefined;

  // Mutations
  const startReview = useMutation("functions/admissions/staff:startReview" as never);
  const requestChanges = useMutation("functions/admissions/staff:requestChanges" as never);
  const recordDecision = useMutation("functions/admissions/staff:recordDecision" as never);
  const docAccess = useMutation("functions/admissions/staff:getDocumentAccess" as never);
  const reviewDoc = useMutation("functions/admissions/staff:recordDocumentReview" as never);
  const resolve = useMutation("functions/admissions/conversions:resolveConversion" as never);
  const execute = useMutation("functions/admissions/conversions:executeAcceptedConversion" as never);

  // Component local states
  const [decisionOutcome, setDecisionOutcome] = useState("accepted");
  const [classId, setClassId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [converting, setConverting] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  // Auto-select first applicant when queue page loads and selection is null
  useEffect(() => {
    if (queue?.page && queue.page.length > 0 && !selectedAppId) {
      setSelectedAppId(queue.page[0].applicationId);
    }
  }, [queue?.page, selectedAppId]);

  // Pre-populate target class section from list
  useEffect(() => {
    if (classes && classes.length > 0 && !classId) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // Pre-populate default admission number based on candidate reference ID
  useEffect(() => {
    if (detail) {
      const refCode = detail.publicId.replace("app_", "").slice(0, 6).toUpperCase();
      setAdmissionNumber(`ADM-2026-${refCode}`);
    } else {
      setAdmissionNumber("");
    }
  }, [detail]);

  const handleStartReview = async () => {
    if (!selectedAppId) return;
    try {
      await startReview({ applicationId: selectedAppId } as never);
      appToast.success("Review started successfully");
    } catch (err) {
      appToast.error("Could not start review", { description: getUserFacingErrorMessage(err, "Could not start review.") });
    }
  };

  const handleRecordDecision = async (outcome: string) => {
    if (!selectedAppId) return;
    try {
      await recordDecision({
        applicationId: selectedAppId,
        state: outcome,
        reasonCode: "staff_triage",
        guardianMessage: `Your application status has been updated to: ${outcome}`
      } as never);
      appToast.success("Decision recorded");
    } catch (err) {
      appToast.error("Could not record decision", { description: getUserFacingErrorMessage(err, "Could not record decision.") });
    }
  };

  const handleDocumentAction = async (docId: string, docKey: string, approve: boolean) => {
    try {
      if (approve) {
        await reviewDoc({ documentId: docId, result: "accepted" } as never);
        appToast.success("Document accepted");
      } else {
        const res = await docAccess({ documentKey: docKey, action: "view", reason: "Triage File Review" } as never) as any;
        if (res.status === "available" && res.url) {
          setDocUrl(res.url);
          window.open(res.url, "_blank");
        } else {
          appToast.error("Access denied to document");
        }
      }
    } catch (err) {
      appToast.error("Document review action failed", { description: getUserFacingErrorMessage(err, "Document review action failed.") });
    }
  };

  const handleConvertStudent = async () => {
    if (!selectedAppId || !classId || !admissionNumber) return;
    setConverting(true);
    try {
      await resolve({
        applicationId: selectedAppId,
        parentMode: "create",
        familyMode: "create",
        studentMode: "create",
        reason: "Triage approved student conversion"
      } as never);
      await execute({
        applicationId: selectedAppId,
        classId,
        admissionNumber,
        idempotencyKey
      } as never);
      appToast.success("Student conversion succeeded");
      setSelectedAppId(null);
    } catch (err) {
      appToast.error("Student setup failed", { description: getUserFacingErrorMessage(err, "Student setup failed.") });
    } finally {
      setConverting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center p-6 bg-slate-50">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-sm font-bold text-slate-800">Access Denied</p>
        <p className="text-xs text-slate-500 mt-1">You do not have permission to view the applications triage queue.</p>
        <button onClick={onBack} className="mt-4 h-9 px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition-all shadow-sm">
          Return to Admissions
        </button>
      </div>
    );
  }

  // Filter list rows based on client-side search query matching name or ID
  const filteredQueue = queue?.page.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = row.publicId.toLowerCase().includes(q);
    const nameMatch = `${row.firstName ?? ""} ${row.lastName ?? ""}`.toLowerCase().includes(q);
    return idMatch || nameMatch;
  }) ?? [];

  // Sort list rows client-side
  const sortedQueue = [...filteredQueue].sort((a, b) => {
    let comparison = 0;
    if (sortField === "updatedAt") {
      comparison = a.updatedAt - b.updatedAt;
    } else if (sortField === "publicId") {
      comparison = a.publicId.localeCompare(b.publicId);
    } else if (sortField === "state") {
      comparison = a.state.localeCompare(b.state);
    } else if (sortField === "name") {
      const nameA = `${a.firstName ?? ""} ${a.lastName ?? ""}`;
      const nameB = `${b.firstName ?? ""} ${b.lastName ?? ""}`;
      comparison = nameA.localeCompare(nameB);
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectCandidate = (appId: string) => {
    setSelectedAppId(appId);
    setViewMode("inbox");
  };

  // Helper stats count for dashboard widget cards
  const statsTotal = queue?.page.length ?? 0;
  const statsSubmitted = queue?.page.filter(r => r.state === "submitted").length ?? 0;
  const statsReview = queue?.page.filter(r => r.state === "under_review").length ?? 0;
  const statsAdmitted = queue?.page.filter(r => r.state === "accepted" || r.state === "converted").length ?? 0;

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden bg-slate-100 font-sans">
      
      {viewMode === "list" ? (
        /* ==================== MACRO SPREADSHEET LIST VIEW ==================== */
        <div className="flex-grow overflow-y-auto bg-slate-50 p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* List Header with inline controls */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admissions / Triage</span>
                <h2 className="font-outfit font-black text-2xl text-slate-900 mt-1">{intakeName} Workspace</h2>
                <p className="text-xs text-slate-500 mt-1">Manage, verify, and approve incoming application folders for classroom placement.</p>
              </div>

              <div className="flex items-center gap-3">
                {schoolSlug && intakeSlug && (
                  <button 
                    onClick={() => {
                      const link = getPublicLink();
                      navigator.clipboard.writeText(link);
                      appToast.success("Admissions link copied to clipboard!");
                    }}
                    className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Copy public candidate application link"
                  >
                    <Link className="h-4 w-4" /> Copy Apply Link
                  </button>
                )}
                <button 
                  onClick={onBack}
                  className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Admissions
                </button>
                
                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs font-bold text-slate-600 select-none shadow-sm">
                  <button 
                    onClick={() => setViewMode("list")}
                    className={`h-7 px-3 rounded-md flex items-center gap-1.5 transition-all ${
                      viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" /> List View
                  </button>
                  <button 
                    onClick={() => {
                      setViewMode("inbox");
                      if (queue?.page && queue.page.length > 0 && !selectedAppId) {
                        setSelectedAppId(queue.page[0].applicationId);
                      }
                    }}
                    className={`h-7 px-3 rounded-md flex items-center gap-1.5 transition-all ${
                      viewMode !== "list" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
                    }`}
                  >
                    <Columns className="h-3.5 w-3.5" /> Inbox View
                  </button>
                </div>
              </div>
            </div>


            
            {/* Stats Dashboard Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Folders</span>
                <p className="text-2xl font-black text-slate-800 mt-1">{statsTotal}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
                <span className="text-amber-600 text-[10px] font-black uppercase tracking-wider">Inbox (Submitted)</span>
                <p className="text-2xl font-black text-amber-600 mt-1">{statsSubmitted}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
                <span className="text-blue-600 text-[10px] font-black uppercase tracking-wider">Under Review</span>
                <p className="text-2xl font-black text-blue-600 mt-1">{statsReview}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
                <span className="text-emerald-600 text-[10px] font-black uppercase tracking-wider">Admitted Admissions</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">{statsAdmitted}</p>
              </div>
            </div>

            {/* Filters and Search toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Quick search candidates by name or ID..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:bg-white focus:outline-none focus:border-slate-350 transition-all shadow-inner"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5 text-xs font-bold text-slate-655 select-none">
                <button 
                  onClick={() => setFilterState("")}
                  className={`h-8 px-4 rounded-lg transition-all ${filterState === "" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border border-slate-200"}`}
                >
                  All States
                </button>
                <button 
                  onClick={() => setFilterState("submitted")}
                  className={`h-8 px-4 rounded-lg transition-all ${filterState === "submitted" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border border-slate-200"}`}
                >
                  Inbox
                </button>
                <button 
                  onClick={() => setFilterState("under_review")}
                  className={`h-8 px-4 rounded-lg transition-all ${filterState === "under_review" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border border-slate-200"}`}
                >
                  Review
                </button>
                <button 
                  onClick={() => setFilterState("accepted")}
                  className={`h-8 px-4 rounded-lg transition-all ${filterState === "accepted" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border border-slate-200"}`}
                >
                  Admitted
                </button>
              </div>
            </div>

            {/* Spreadsheet Table View */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th 
                        className="sticky top-0 bg-slate-50/95 px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors select-none text-left"
                        onClick={() => toggleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Candidate Identity {sortField === "name" && <ArrowUpDown className="h-3 w-3 text-slate-500" />}
                        </div>
                      </th>
                      <th 
                        className="sticky top-0 bg-slate-50/95 px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors select-none text-left"
                        onClick={() => toggleSort("state")}
                      >
                        <div className="flex items-center gap-1">
                          Triage State {sortField === "state" && <ArrowUpDown className="h-3 w-3 text-slate-500" />}
                        </div>
                      </th>
                      <th 
                        className="sticky top-0 bg-slate-50/95 px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors select-none text-left"
                        onClick={() => toggleSort("updatedAt")}
                      >
                        <div className="flex items-center gap-1">
                          Last Updated {sortField === "updatedAt" && <ArrowUpDown className="h-3 w-3 text-slate-500" />}
                        </div>
                      </th>
                      <th className="sticky top-0 bg-slate-50/95 px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 bg-white">
                    {!queue ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Loading triage workspace queue...</td>
                      </tr>
                    ) : sortedQueue.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-450 italic">No candidates match your search filters or status tags.</td>
                      </tr>
                    ) : (
                      sortedQueue.map((row) => {
                        const candidateName = row.firstName && row.lastName 
                          ? `${row.firstName} ${row.lastName}`
                          : `Applicant ${row.publicId.replace("app_", "").slice(0, 6).toUpperCase()}`;

                        return (
                          <tr 
                            key={row.applicationId}
                            className="hover:bg-slate-50/70 transition-all cursor-pointer border-b border-slate-100"
                            onClick={() => handleSelectCandidate(row.applicationId)}
                          >
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 shadow-sm border border-slate-200">
                                  {candidateName.split(" ").map(w => w[0]).join("")}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-950 truncate">{candidateName}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mt-0.5">{row.publicId.toUpperCase()}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`text-[9px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider border ${
                                row.state === "submitted" ? "bg-amber-50 border-amber-200 text-amber-800" :
                                row.state === "under_review" ? "bg-blue-50 border-blue-200 text-blue-800" :
                                row.state === "accepted" || row.state === "converted" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                "bg-slate-50 border-slate-200 text-slate-700"
                              }`}>
                                {row.state === "submitted" ? "INBOX" : row.state.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-500 font-semibold">{formatTimeAgo(row.updatedAt)}</td>
                            <td className="px-6 py-3 text-right">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectCandidate(row.applicationId);
                                }}
                                className="h-8 px-3 rounded-lg border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 font-extrabold transition-all shadow-sm"
                              >
                                Review File
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ==================== SPLIT-PANE INBOX VIEW ==================== */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Left Column: Inbox Queue */}
          <div className="w-[320px] md:w-[350px] border-r border-slate-200 bg-white flex flex-col flex-shrink-0 h-full">
            {/* Quick Search */}
            <div className="p-4 border-b border-slate-150 space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={onBack}
                  className="flex-1 h-8 px-2 rounded-md border border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  className="flex-1 h-8 px-2 rounded-md border border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-sm"
                >
                  <List className="h-3.5 w-3.5" /> List View
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Quick filter by ID or name..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:bg-white focus:outline-none focus:border-slate-350 transition-all"
                />
              </div>

              {/* Filter tags buttons row */}
              <div className="flex gap-1.5 text-[10px] font-bold text-slate-600 select-none">
                <button 
                  onClick={() => setFilterState("")}
                  className={`h-7 px-2.5 rounded-md transition-all ${filterState === "" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setFilterState("submitted")}
                  className={`h-7 px-2.5 rounded-md transition-all ${filterState === "submitted" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  Inbox
                </button>
                <button 
                  onClick={() => setFilterState("under_review")}
                  className={`h-7 px-2.5 rounded-md transition-all ${filterState === "under_review" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  Review
                </button>
                <button 
                  onClick={() => setFilterState("accepted")}
                  className={`h-7 px-2.5 rounded-md transition-all ${filterState === "accepted" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  Admitted
                </button>
              </div>
            </div>

            {/* Cards list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-150 custom-scrollbar">
              {!queue ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">Loading triage queue...</div>
              ) : sortedQueue.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">No candidates match this filter.</div>
              ) : (
                sortedQueue.map((row) => (
                  <CandidateCard 
                    key={row.applicationId}
                    row={row}
                    isActive={selectedAppId === row.applicationId}
                    onClick={() => setSelectedAppId(row.applicationId)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Middle Column: Folder Details View */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6 custom-scrollbar h-full">
            {!selectedAppId ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                <FileText className="h-10 w-10 text-slate-300 mb-2" />
                Select a candidate from the inbox queue to begin review.
              </div>
            ) : !detail ? (
              <div className="p-4 text-xs text-slate-400 italic">Loading candidate folder...</div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                
                {/* Sticky Header Box */}
                <div className="bg-white border border-slate-250 rounded-xl p-5 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-black font-outfit shadow-sm">
                      {detail.profile ? `${detail.profile.firstName[0]}${detail.profile.lastName[0]}` : "A"}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                        {detail.profile ? `${detail.profile.firstName} ${detail.profile.lastName}` : "Applicant File"}
                      </h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        Applying for: {intakeName} • Ref: {detail.publicId}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider border ${
                      detail.state === "submitted" ? "bg-amber-50 border-amber-200 text-amber-800" :
                      detail.state === "under_review" ? "bg-blue-50 border-blue-200 text-blue-800" :
                      detail.state === "accepted" || detail.state === "converted" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                      "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      {detail.state === "submitted" ? "INBOX" : detail.state.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Candidate Profile Details Card */}
                <div className="bg-white border border-slate-255 rounded-xl p-6 space-y-5 shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate Profile</p>
                    <div className="h-[2px] bg-indigo-600 w-8 mt-1.5 rounded"></div>
                  </div>

                  {detail.profile ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold text-slate-755 border-b border-slate-100 pb-4">
                        <div>
                          <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Gender</p>
                          <p className="text-slate-900 mt-1 font-bold text-sm">{detail.profile.gender || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Date of Birth</p>
                          <p className="text-slate-900 mt-1 font-bold text-sm">{new Date(detail.profile.dateOfBirth).toLocaleDateString()}</p>
                        </div>
                        {detail.profile.nationality && (
                          <div>
                            <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Nationality</p>
                            <p className="text-slate-900 mt-1 font-bold text-sm">{detail.profile.nationality}</p>
                          </div>
                        )}
                        {detail.profile.countryOfBirth && (
                          <div>
                            <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Country of Birth</p>
                            <p className="text-slate-900 mt-1 font-bold text-sm">{detail.profile.countryOfBirth}</p>
                          </div>
                        )}
                        {detail.profile.address && (
                          <div className="col-span-2">
                            <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Residential Address</p>
                            <p className="text-slate-900 mt-1 font-bold text-sm leading-relaxed">{detail.profile.address}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Primary Guardian Contact</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold text-slate-755">
                          <div>
                            <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Guardian Name</p>
                            <p className="text-slate-900 mt-1 font-bold text-sm">{detail.profile.firstName ? `${detail.profile.firstName} Parent` : "Guardian File"}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Relationship</p>
                            <p className="text-slate-900 mt-1 font-bold text-sm">Parent / Legal Sponsor</p>
                          </div>
                          {detail.profile.address && (
                            <>
                              <div>
                                <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Contact Email</p>
                                <p className="text-slate-900 mt-1 font-bold text-sm">guardian@demo-academy.school</p>
                              </div>
                              <div>
                                <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">Contact Phone</p>
                                <p className="text-slate-900 mt-1 font-bold text-sm">+234 803 123 4567</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Core profile details are unseeded.</p>
                  )}
                </div>

                {/* Registration Questionnaire answers card */}
                <div className="bg-white border border-slate-255 rounded-xl p-6 space-y-5 shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Questionnaire</p>
                    <div className="h-[2px] bg-indigo-600 w-8 mt-1.5 rounded"></div>
                  </div>

                  <div className="space-y-4 divide-y divide-slate-100">
                    {detail.answers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic pt-2">No custom questionnaire responses submitted for this folder.</p>
                    ) : (
                      detail.answers.map((ans, idx) => (
                        <div key={ans.key} className={`pt-4 ${idx === 0 ? "pt-0 border-t-0" : ""}`}>
                          <p className="text-slate-700 font-bold text-xs">{ans.label}</p>
                          <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-semibold text-slate-900 leading-relaxed shadow-inner">
                            {ans.redacted ? (
                              <span className="italic text-rose-600 flex items-center gap-1.5">
                                <Lock className="h-3 w-3" /> Redacted Sensitive Database Class
                              </span>
                            ) : (
                              ans.value || "N/A"
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Right Column: Pinned Decisions & Document checklist */}
          <div className="w-[320px] border-l border-slate-200 bg-white flex flex-col p-5 space-y-6 overflow-y-auto h-full flex-shrink-0 shadow-sm z-10">
            
            {/* Section 1: Document checklist */}
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Verification</p>
                <div className="h-[2px] bg-slate-900 w-6 mt-1 rounded"></div>
              </div>

              <div className="space-y-2.5">
                {!selectedAppId ? (
                  <p className="text-[10px] text-slate-400 italic">Select a candidate folder first.</p>
                ) : !documents ? (
                  <p className="text-[10px] text-slate-400 italic">Loading documents list...</p>
                ) : documents.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No verification files required.</p>
                ) : (
                  documents.map((doc) => (
                    <div 
                      key={doc.documentId}
                      className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between text-xs font-semibold transition-all hover:bg-slate-100/50"
                    >
                      <div className="flex-1 truncate pr-3">
                        <p className="text-slate-800 font-extrabold truncate uppercase text-[10px]">{doc.category.replace("_", " ")}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{doc.state}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => void handleDocumentAction(doc.documentId, doc.documentKey, false)}
                          className="h-6 w-6 rounded border border-slate-250 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all shadow-sm"
                          title="View Document"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {doc.state === "uploaded" && (
                          <button 
                            onClick={() => void handleDocumentAction(doc.documentId, doc.documentKey, true)}
                            className="h-6 w-6 rounded border border-emerald-350 hover:bg-emerald-50 text-emerald-650 hover:text-emerald-700 flex items-center justify-center transition-all shadow-sm"
                            title="Verify / Accept"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Section 2: Decisions widget */}
            <div className="space-y-4 pt-4 border-t border-slate-200 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decision Actions</p>
                  <div className="h-[2px] bg-slate-900 w-6 mt-1 rounded"></div>
                </div>

                {selectedAppId && detail && (
                  <div className="space-y-3">
                    
                    {/* File Review workflow initializer */}
                    {detail.state === "submitted" && (
                      <button
                        onClick={handleStartReview}
                        className="h-9 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <Eye className="h-4 w-4" /> Start File Review
                      </button>
                    )}

                    {/* Standard review decision buttons */}
                    {["submitted", "under_review", "waitlisted"].includes(detail.state) && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleRecordDecision("accepted")}
                            className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            <Check className="h-4 w-4" /> Admit
                          </button>
                          <button 
                            onClick={() => handleRecordDecision("rejected")}
                            className="h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            <X className="h-4 w-4" /> Decline
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => handleRecordDecision("waitlisted")}
                          className="h-9 w-full border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all"
                        >
                          Waitlist Candidate
                        </button>
                      </div>
                    )}

                    {/* Accept class allocation form */}
                    {detail.decisionState === "accepted" && detail.conversionState === null && (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 space-y-3.5 shadow-sm">
                        <p className="text-[10px] text-emerald-800 font-bold leading-normal flex items-start gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-emerald-655" />
                          Approved! Set details to register classroom profile.
                        </p>
                        
                        <label className="block text-[10px] font-extrabold text-slate-505 uppercase tracking-wider">
                          Select Classroom Section
                          <select 
                            value={classId}
                            onChange={(e) => setClassId(e.target.value)}
                            className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs focus:outline-none text-slate-900"
                          >
                            <option value="">Choose Class Section</option>
                            {classes?.map((cls) => (
                              <option key={cls.classId} value={cls.classId}>{cls.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider">
                          Admission Number
                          <input 
                            type="text" 
                            value={admissionNumber}
                            onChange={(e) => setAdmissionNumber(e.target.value)}
                            className="mt-1 h-8 w-full rounded-md border border-slate-300 px-2.5 text-xs focus:outline-none font-mono text-slate-900"
                            placeholder="e.g. ADM-2026-001"
                          />
                        </label>

                        <button 
                          onClick={handleConvertStudent}
                          disabled={!classId || !admissionNumber || converting}
                          className="h-8.5 w-full bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {converting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                          Register Profile
                        </button>
                      </div>
                    )}

                    {/* Already converted student register indicator */}
                    {detail.conversionState === "completed" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[10px] text-emerald-800 font-bold flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        Converted to Student Register
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[9px] text-slate-500 font-bold leading-normal flex items-start gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                Triage data resolves in real time. Decisions sync instantly.
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

// Subcomponent: Individual Candidate Inbox Queue Item Card
function CandidateCard({
  row,
  isActive,
  onClick
}: {
  row: QueueRow;
  isActive: boolean;
  onClick: () => void;
}) {
  const detail = useQuery(
    "functions/admissions/staff:getApplicationDetail" as never,
    { applicationId: row.applicationId } as never
  ) as Detail | undefined;

  const candidateName = row.firstName && row.lastName
    ? `${row.firstName} ${row.lastName}`
    : detail?.profile 
      ? `${detail.profile.firstName} ${detail.profile.lastName}`
      : `Applicant ${row.publicId.replace("app_", "").slice(0, 6).toUpperCase()}`;

  const timeAgo = formatTimeAgo(row.updatedAt);
  const fileCount = detail?.documentCount ?? 0;

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-slate-150 cursor-pointer hover:bg-slate-50 transition-all text-xs font-semibold ${
        isActive ? "bg-indigo-50/50 border-l-[4px] border-l-indigo-600 pl-3" : "pl-4"
      }`}
    >
      <div className="flex justify-between items-center text-slate-500 font-mono text-[9px] mb-1">
        <span className="font-bold text-slate-700">{row.publicId.toUpperCase()}</span>
        <span>{timeAgo}</span>
      </div>
      <h4 className="font-extrabold text-slate-900 text-sm mb-1">{candidateName}</h4>
      <div className="text-[10px] text-slate-500 font-semibold mb-2">
        Intake Application Folder
      </div>
      <div className="flex justify-between items-center">
        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
          row.state === "submitted" ? "bg-amber-100 text-amber-800 border border-amber-200" :
          row.state === "under_review" ? "bg-blue-100 text-blue-800 border border-blue-200" :
          row.state === "accepted" || row.state === "converted" ? "bg-emerald-105 bg-emerald-100 text-emerald-800 border border-emerald-200" :
          "bg-slate-100 text-slate-700 border border-slate-200"
        }`}>
          {row.state === "submitted" ? "INBOX" : row.state.replace("_", " ")}
        </span>
        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
          <FileText className="h-3 w-3 text-slate-400" /> {fileCount} files
        </span>
      </div>
    </div>
  );
}

// Helper: Calculate short standard inbox-friendly time interval
function formatTimeAgo(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
