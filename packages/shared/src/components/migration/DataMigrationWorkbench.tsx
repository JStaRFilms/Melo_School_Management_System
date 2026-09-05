import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Users,
  FileSpreadsheet,
  Home,
  GraduationCap,
  Sparkles,
  Plus,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { WorkspaceUploadCard } from "./WorkspaceUploadCard";
import { RosterReviewTab, StagedStudentRow } from "./Tabs/RosterReviewTab";
import { HouseholdReviewTab } from "./Tabs/HouseholdReviewTab";
import { ResultsReviewTab } from "./Tabs/ResultsReviewTab";
import { ClashResolutionModal } from "./Modals/ClashResolutionModal";
import { ColumnMappingDialog } from "./Modals/ColumnMappingDialog";
import { StagingActionBar } from "./StagingActionBar";
import { appToast, getErrorMessage } from "../../toast";
import { type SpreadsheetParseResult } from "../../migration";

export interface DataMigrationWorkbenchProps {
  schoolId: string;
  mode: "school_admin" | "super_admin";
  onSuccess?: () => void;
}

export function DataMigrationWorkbench({
  schoolId,
  mode,
  onSuccess,
}: DataMigrationWorkbenchProps) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"roster" | "household" | "results">("roster");
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAdm, setIsGeneratingAdm] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ processed: number; total: number } | null>(null);

  // Modal States
  const [clashModalRecord, setClashModalRecord] = useState<StagedStudentRow | null>(null);
  const [isColumnMappingOpen, setIsColumnMappingOpen] = useState(false);
  const [isResolvingClash, setIsResolvingClash] = useState(false);

  // Queries
  const workspaces = useQuery(
    "functions/academic/migrationWorkspace:listWorkspaces" as never,
    { schoolId } as never
  ) as Array<{ _id: string; name: string; status: string; totalRecords: number; createdAt: number }> | undefined;

  const summary = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceSummary" as never,
    activeWorkspaceId ? ({ schoolId, workspaceId: activeWorkspaceId } as never) : ("skip" as never)
  ) as
    | {
        name: string;
        status: string;
        totalRecords: number;
        validRecords: number;
        warningRecords: number;
        errorRecords: number;
      }
    | null
    | undefined;

  const stagedRecords = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceRecords" as never,
    activeWorkspaceId
      ? ({ schoolId, workspaceId: activeWorkspaceId, limit: 1000 } as never)
      : ("skip" as never)
  ) as StagedStudentRow[] | undefined;

  const featureSignals = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceFeatureSignals" as never,
    { schoolId, workspaceId: activeWorkspaceId ?? undefined } as never
  ) as Array<{ rawHeader: string; sampleValue?: string; detectedType: string; status: "new" | "reviewed" | "adopted" }> | undefined;

  // Mutations
  const createWorkspace = useMutation("functions/academic/migrationWorkspace:createWorkspace" as never);
  const stageRecordsBatch = useMutation("functions/academic/migrationIngest:stageRecordsBatch" as never);
  const patchStagedRecord = useMutation("functions/academic/migrationAutosave:patchStagedRecord" as never);
  const resolveRecordClash = useMutation("functions/academic/migrationAutosave:resolveRecordClash" as never);
  const bulkResolveAdmissionNumbers = useMutation(
    "functions/academic/migrationAutosave:bulkResolveAdmissionNumbers" as never
  );
  const commitImportWorkspace = useMutation("functions/academic/migrationMerge:commitImportWorkspace" as never);

  // Handlers
  const handleStartIngest = async ({
    workspaceName,
    admissionPrefix,
    nextSequence,
    parseResult,
  }: {
    workspaceName: string;
    admissionPrefix: string;
    nextSequence: number;
    parseResult: SpreadsheetParseResult;
  }) => {
    setIsUploading(true);
    try {
      const workspaceId = (await createWorkspace({
        schoolId,
        name: workspaceName,
        mode,
        admissionNumberPrefix: admissionPrefix,
        nextAdmissionSequence: nextSequence,
      } as never)) as string;

      // Retain the created workspace if a later staging batch fails.
      setActiveWorkspaceId(workspaceId);
      const BATCH_SIZE = 50;
      for (let i = 0; i < parseResult.rows.length; i += BATCH_SIZE) {
        const batch = parseResult.rows.slice(i, i + BATCH_SIZE);
        await stageRecordsBatch({
          schoolId,
          workspaceId,
          records: batch.map((r) => ({
            rowNumber: r.rowNumber,
            rawPayload: r.rawPayload,
            parsedData: r.parsedData,
            entityType: r.entityType,
            unrecognizedHeaders: r.unrecognizedHeaders,
          })),
        } as never);
      }

      setActiveWorkspaceId(workspaceId);
      appToast.success(`Staged ${parseResult.totalRows} records successfully`);
    } catch (err) {
      appToast.error(getErrorMessage(err, "Failed to stage spreadsheet"));
    } finally {
      setIsUploading(false);
    }
  };

  const handlePatchField = async (recordId: string, patch: Record<string, any>) => {
    try {
      await patchStagedRecord({
        schoolId,
        recordId,
        parsedDataPatch: patch,
      } as never);
      appToast.success("Saved", { duration: 1200 });
    } catch (err) {
      appToast.error(getErrorMessage(err, "Autosave failed"));
    }
  };

  const handleResolveClash = async (
    action: "create_new" | "merge_existing" | "link_as_sibling" | "ignore"
  ) => {
    if (!clashModalRecord) return;
    setIsResolvingClash(true);
    try {
      await resolveRecordClash({
        schoolId,
        recordId: clashModalRecord._id,
        resolutionAction: action,
      } as never);
      appToast.success(`Resolved as "${action.replace(/_/g, " ")}"`);
      setClashModalRecord(null);
    } catch (err) {
      appToast.error(getErrorMessage(err, "Failed to resolve clash"));
    } finally {
      setIsResolvingClash(false);
    }
  };

  const handleAutoGenerateAdmission = async () => {
    if (!activeWorkspaceId) return;
    setIsGeneratingAdm(true);
    try {
      const res = (await bulkResolveAdmissionNumbers({
        schoolId,
        workspaceId: activeWorkspaceId,
      } as never)) as { assignedCount: number };
      appToast.success(`Assigned admission numbers to ${res.assignedCount} students`);
    } catch (err) {
      appToast.error(getErrorMessage(err, "Failed to generate admission numbers"));
    } finally {
      setIsGeneratingAdm(false);
    }
  };

  const handleCommitMerge = async () => {
    if (!activeWorkspaceId) return;
    setIsMerging(true);
    try {
      let isDone = false;
      let totalMerged = 0;
      while (!isDone) {
        const res = (await commitImportWorkspace({
          schoolId,
          workspaceId: activeWorkspaceId,
        } as never)) as {
          done?: boolean;
          success?: boolean;
          mergedStudents?: number;
          processedRecords?: number;
          totalRecords?: number;
        };

        setCommitProgress({ processed: res.processedRecords ?? 0, total: res.totalRecords ?? 0 });
        if (res.done) {
          isDone = true;
          totalMerged = res.mergedStudents ?? res.processedRecords ?? 0;
        }
      }
      appToast.success(`Successfully merged ${totalMerged} records to live school database!`);
      onSuccess?.();
    } catch (err) {
      appToast.error(getErrorMessage(err, "Batch failed. Earlier successful batches remain saved; retry resumes incomplete work."));
    } finally {
      setIsMerging(false);
    }
  };

  if (workspaces === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Header */}
      <div className="border-b border-slate-200/90 bg-white px-6 py-5 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            {activeWorkspaceId && (
              <button
                type="button"
                onClick={() => { setActiveWorkspaceId(null); setCommitProgress(null); }}
                disabled={isMerging || isUploading}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                title="Back to workspace list"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                {summary?.name || "School Data Migration Engine"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeWorkspaceId
                  ? `Staging Workspace • Mode: ${mode === "super_admin" ? "Platform Super Admin" : "School Admin"}`
                  : "Stage and review private school records before committing to the school database."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {featureSignals && featureSignals.length > 0 && (
              <button
                type="button"
                onClick={() => setIsColumnMappingOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Product Attic ({featureSignals.length})</span>
              </button>
            )}

            {!activeWorkspaceId && (
              <button
                type="button"
                onClick={() => setActiveWorkspaceId(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Spreadsheet Import</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <p role="status" className="mx-auto max-w-7xl px-6 pt-4 text-sm text-slate-600">
        AI interpretation unavailable: no reviewed provider is connected. Column parsing and duplicate scores are deterministic, not AI output.
        Institutional email approval is separate; this workbench does not provision mailboxes.
      </p>
      {commitProgress && (
        <p role="status" className="mx-auto max-w-7xl px-6 pt-2 text-sm text-slate-600">
          Server-confirmed progress: {commitProgress.processed} / {commitProgress.total} records processed.
        </p>
      )}
      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {!activeWorkspaceId ? (
          <div className="space-y-8">
            <WorkspaceUploadCard onStartIngest={handleStartIngest} isIngesting={isUploading} />

            {workspaces.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Historical Import Workspaces</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workspaces.map((ws) => (
                    <div
                      key={ws._id}
                      onClick={() => { setActiveWorkspaceId(ws._id); setCommitProgress(null); }}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{ws.name}</h4>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            ws.status === "merged"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : ws.status === "cancelled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          {ws.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>{ws.totalRecords} Records</span>
                        <span className="font-mono text-[11px]">
                          {new Date(ws.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 gap-6">
              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === "roster"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Roster & Clash Review</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-mono">
                  {summary?.totalRecords ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("household")}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === "household"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Household & Siblings</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("results")}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === "results"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Academic Results</span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === "roster" && (
              <RosterReviewTab
                records={(stagedRecords ?? []) as StagedStudentRow[]}
                onPatchField={handlePatchField}
                onOpenClashModal={(rec) => setClashModalRecord(rec)}
              />
            )}

            {activeTab === "household" && (
              <HouseholdReviewTab records={(stagedRecords ?? []) as StagedStudentRow[]} />
            )}

            {activeTab === "results" && (
              <ResultsReviewTab
                records={(stagedRecords ?? []) as any}
                onPatchField={handlePatchField}
              />
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {activeWorkspaceId && summary && summary.status !== "merged" && (
        <StagingActionBar
          totalRecords={summary.totalRecords}
          validRecords={summary.validRecords}
          warningRecords={summary.warningRecords}
          errorRecords={summary.errorRecords}
          isMerging={isMerging}
          isGeneratingAdm={isGeneratingAdm}
          onAutoGenerateAdmission={handleAutoGenerateAdmission}
          onCommitMerge={handleCommitMerge}
        />
      )}

      {/* Modals */}
      {clashModalRecord && (
        <ClashResolutionModal
          record={clashModalRecord}
          onClose={() => setClashModalRecord(null)}
          onResolve={handleResolveClash}
          isResolving={isResolvingClash}
        />
      )}

      {isColumnMappingOpen && (
        <ColumnMappingDialog
          signals={(featureSignals ?? []) as any}
          onClose={() => setIsColumnMappingOpen(false)}
        />
      )}
    </div>
  );
}
