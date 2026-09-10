import React, { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import {
  Users,
  FileSpreadsheet,
  Home,
  GraduationCap,
  Database,
  Plus,
  ArrowLeft,
  Loader2,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { WorkspaceUploadCard } from "./WorkspaceUploadCard";
import { RosterReviewTab, StagedStudentRow } from "./Tabs/RosterReviewTab";
import { HouseholdReviewTab } from "./Tabs/HouseholdReviewTab";
import { ResultsReviewTab } from "./Tabs/ResultsReviewTab";
import { ClashResolutionModal } from "./Modals/ClashResolutionModal";
import {
  ImportRowReviewDialog,
  type ImportReviewOptions,
  type ImportRowReviewInput,
} from "./Modals/ImportRowReviewDialog";
import { ColumnMappingDialog } from "./Modals/ColumnMappingDialog";
import {
  ImportConfirmationModal,
  type ImportConfirmationStat,
} from "./Modals/ImportConfirmationModal";
import { StagingActionBar } from "./StagingActionBar";
import { appToast, getErrorMessage } from "../../toast";
import { type SpreadsheetParseResult } from "../../migration";

interface MigrationPromptContext {
  schoolName: string;
  classes: Array<{ name: string; level: string }>;
  subjects: string[];
  sessions: Array<{ name: string; terms: string[] }>;
}

export function buildMigrationPrompt(context: MigrationPromptContext): string {
  const classList = context.classes.map((item) => `- ${item.name} (level: ${item.level})`).join("\n") || "- No classes configured";
  const subjectList = context.subjects.map((item) => `- ${item}`).join("\n") || "- No subjects configured";
  const sessionList = context.sessions.map((item) => `- ${item.name}: ${item.terms.join(", ") || "no terms"}`).join("\n") || "- No sessions configured";
  return `You are preparing existing school documents for import into ${context.schoolName}. Do not generate sample or random data. Use only facts present in the documents I upload or paste after this prompt. Never guess a missing student, identifier, class, subject, score, date, or contact detail. Leave unknown values blank and describe any uncertainty in Migration Note.\n\nCreate separate UTF-8 CSV outputs for student rosters and academic results when both are present. Return each CSV in its own fenced csv block with one header row and one record per row. Preserve admission IDs exactly, including leading zeroes. Use YYYY-MM-DD dates and plain text phone numbers. Do not merge people merely because they share a surname, class, address, or guardian.\n\nSTUDENT ROSTER HEADERS\nFirst Name,Middle Name,Last Name,Class,Admission ID,Gender,Date of Birth,Guardian Name,Guardian Phone,Guardian Email,Address,Migration Note\n\nRESULT HEADERS\nFirst Name,Last Name,Admission ID,Class,Subject,CA1,CA2,Exam,Session,Term,Migration Note\n\nUse every underlying class name exactly as listed below, character for character. Preserve punctuation, hyphens, spacing, and class-arm wording. Do not shorten a class name and do not append its parenthesized level; the level shown after each class below is explanatory only and must not appear in the Class cell. If a source class cannot be matched to exactly one listed class, leave Class blank and put the original source value in Migration Note. Apply the same no-guessing rule to subjects, sessions, and terms. Preserve supplied admission IDs exactly, but never invent an admission ID; leave it blank so the school system can generate it.\n\nCLASSES\n${classList}\n\nSUBJECTS\n${subjectList}\n\nSESSIONS AND TERMS\n${sessionList}\n\nBefore producing CSV, briefly list any source pages or fields you could not interpret. Do not invent replacements.`;
}

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
  const [isApproving, setIsApproving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ processed: number; total: number } | null>(null);

  // Modal States
  const [clashModalRecord, setClashModalRecord] = useState<StagedStudentRow | null>(null);
  const [reviewRecord, setReviewRecord] = useState<StagedStudentRow | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isColumnMappingOpen, setIsColumnMappingOpen] = useState(false);
  const [isResolvingClash, setIsResolvingClash] = useState(false);
  const [isReviewingReadyRows, setIsReviewingReadyRows] = useState(false);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // Confirmation Modal State (replaces browser confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    badge?: string;
    description: string;
    stats?: ImportConfirmationStat[];
    infoNotice?: string;
    customDetails?: React.ReactNode;
    confirmLabel?: string;
    confirmVariant?: "primary" | "danger" | "warning" | "emerald";
    onConfirm: () => Promise<void> | void;
  } | null>(null);

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
        reviewedAt?: number;
      }
    | null
    | undefined;

  const stagedPage = usePaginatedQuery(
    "functions/academic/migrationWorkspace:getWorkspaceRecordsPage" as never,
    activeWorkspaceId ? ({ schoolId, workspaceId: activeWorkspaceId } as never) : ("skip" as never),
    { initialNumItems: 200 },
  ) as { results: StagedStudentRow[]; status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"; loadMore: (count: number) => void };
  const stagedRecords = stagedPage.results;

  const reviewOptions = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceReviewOptions" as never,
    activeWorkspaceId ? ({ schoolId, workspaceId: activeWorkspaceId } as never) : ("skip" as never)
  ) as ImportReviewOptions | undefined;

  const promptContext = useQuery(
    "functions/academic/migrationWorkspace:getMigrationPromptContext" as never,
    { schoolId } as never,
  ) as MigrationPromptContext | undefined;

  const counterRecommendations = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceCounterRecommendations" as never,
    activeWorkspaceId ? ({ schoolId, workspaceId: activeWorkspaceId } as never) : ("skip" as never),
  ) as Array<{ counterKey: string; currentNextSequence: number; recommendedNextSequence: number; compatibleRows: number }> | undefined;

  const featureSignals = useQuery(
    "functions/academic/migrationWorkspace:getWorkspaceFeatureSignals" as never,
    { schoolId, workspaceId: activeWorkspaceId ?? undefined } as never
  ) as Array<{ rawHeader: string; sampleValue?: string; detectedType: string; status: "new" | "reviewed" | "adopted" }> | undefined;

  // Mutations
  const createWorkspace = useMutation("functions/academic/migrationWorkspace:createWorkspace" as never);
  const deleteWorkspace = useMutation("functions/academic/migrationWorkspace:deleteWorkspace" as never);
  const stageRecordsBatch = useMutation("functions/academic/migrationIngest:stageRecordsBatch" as never);
  const patchStagedRecord = useMutation("functions/academic/migrationAutosave:patchStagedRecord" as never);
  const resolveRecordClash = useMutation("functions/academic/migrationAutosave:resolveRecordClash" as never);
  const reviewStagedRecord = useMutation("functions/academic/migrationAutosave:reviewStagedRecord" as never);
  const assignStudentClassBatch = useMutation("functions/academic/migrationAutosave:assignStudentClassBatch" as never);
  const resolveStagedClassesBatch = useMutation("functions/academic/migrationAutosave:resolveStagedClassesBatch" as never);
  const applyWorkspaceCounterRecommendations = useMutation("functions/academic/migrationAutosave:applyWorkspaceCounterRecommendations" as never);
  const approveImportWorkspace = useMutation("functions/academic/migrationMerge:approveImportWorkspace" as never);
  const reopenIncompleteImportReview = useMutation("functions/academic/migrationMerge:reopenIncompleteImportReview" as never);
  const commitImportWorkspace = useMutation("functions/academic/migrationMerge:commitImportWorkspace" as never);

  // Handlers
  const handleCopyAiPrompt = async () => {
    if (!promptContext) return;
    const prompt = buildMigrationPrompt(promptContext);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = prompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2000);
      appToast.success("AI formatting prompt copied");
    } catch {
      appToast.error("Could not copy the AI formatting prompt");
    }
  };

  const handleStartIngest = async ({
    workspaceName,
    parseResult,
  }: {
    workspaceName: string;
    parseResult: SpreadsheetParseResult;
  }) => {
    setIsUploading(true);
    try {
      const workspaceId = (await createWorkspace({
        schoolId,
        name: workspaceName,
        mode,
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

  const handlePatchField = async (recordId: string, patch: Record<string, unknown>) => {
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
    action: "create_new" | "merge_existing" | "ignore"
  ) => {
    if (!clashModalRecord) return;
    if (action === "create_new") {
      setReviewRecord(clashModalRecord);
      setClashModalRecord(null);
      return;
    }
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

  const handleDeleteWorkspace = (workspaceId: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Import Workspace",
      badge: "Permanent Deletion",
      confirmVariant: "danger",
      confirmLabel: "Delete Workspace",
      description: `Delete the abandoned import workspace "${name}" and all of its staged rows?`,
      infoNotice:
        "All uploaded spreadsheet rows and draft decisions in this workspace will be permanently removed. This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingWorkspaceId(workspaceId);
        try {
          let done = false;
          while (!done) {
            const result = (await deleteWorkspace({
              schoolId,
              workspaceId,
              confirmation: "DELETE",
            } as never)) as { done: boolean };
            done = result.done;
          }
          appToast.success(`Deleted import workspace "${name}"`);
        } catch (error) {
          appToast.error(getErrorMessage(error, "Could not delete import workspace"));
        } finally {
          setDeletingWorkspaceId(null);
        }
      },
    });
  };

  const handleReviewRow = async (input: ImportRowReviewInput) => {
    if (!reviewRecord) return;
    setIsReviewing(true);
    try {
      await reviewStagedRecord({
        schoolId,
        recordId: reviewRecord._id,
        expectedRowRevision: reviewRecord.rowRevision ?? 1,
        ...input,
      } as never);
      setReviewRecord(null);
      appToast.success(`Row #${reviewRecord.rowNumber} reviewed`);
    } catch (error) {
      appToast.error(getErrorMessage(error, "Row review failed"));
    } finally {
      setIsReviewing(false);
    }
  };

  const createEligibleStudentRows = stagedRecords.filter((record) => {
    const hasDuplicateCandidate =
      record.validationStatus === "warning" &&
      record.clashConfidence !== undefined &&
      Boolean(record.clashCandidateId || record.existingStudentId);
    if (
      record.entityType !== "student" ||
      record.reviewStatus === "approved" ||
      (record.validationStatus !== "valid" && !hasDuplicateCandidate) ||
      !record.parsedData.matchedClassId
    ) {
      return false;
    }
    const classOption = reviewOptions?.classes.find(
      (item) => item.id === record.parsedData.matchedClassId,
    );
    if (!classOption) return false;
    if (record.parsedData.admissionNumber?.trim()) return true;
    return reviewOptions?.numberingByLevel?.find((item) => item.level === classOption.level)
      ?.numbering.available ?? reviewOptions?.numbering.available ?? false;
  });

  const readyStudentRows = createEligibleStudentRows.filter(
    (record) => record.validationStatus === "valid",
  );

  const handleCreateRecords = async (recordIds: string[], admissionMode: "preserve" | "official_all") => {
    if (!reviewOptions) return;
    const selectedRows = createEligibleStudentRows.filter((record) => recordIds.includes(record._id));
    if (selectedRows.length !== recordIds.length) {
      appToast.error("Resolve class placement or invalid data before creating the selected records");
      return;
    }
    const suppliedCount = selectedRows.filter((record) =>
      record.parsedData.admissionNumber?.trim(),
    ).length;
    const missingNumbering = selectedRows.some((record) => {
      const selectedClass = reviewOptions.classes.find((item) => item.id === record.parsedData.matchedClassId);
      const numbering = reviewOptions.numberingByLevel?.find((item) => item.level === selectedClass?.level)?.numbering ?? reviewOptions.numbering;
      return (admissionMode === "official_all" || !record.parsedData.admissionNumber?.trim()) && !numbering.available;
    });
    if (missingNumbering) {
      appToast.error("Configure official admission numbering for every selected class before generating IDs");
      return;
    }
    const duplicateCount = selectedRows.filter(
      (record) => record.validationStatus === "warning",
    ).length;

    const executeCreateRecords = async () => {
      setConfirmDialog(null);
      setIsReviewingReadyRows(true);
      try {
        for (const record of selectedRows) {
          const classOption = reviewOptions.classes.find(
            (item) => item.id === record.parsedData.matchedClassId,
          );
          if (!classOption) continue;
          const numbering = reviewOptions.numberingByLevel?.find(
            (item) => item.level === classOption.level,
          )?.numbering ?? reviewOptions.numbering;
          const supplied = Boolean(record.parsedData.admissionNumber?.trim());
          const generateOfficial = admissionMode === "official_all" || !supplied;
          await reviewStagedRecord({
            schoolId,
            recordId: record._id,
            expectedRowRevision: record.rowRevision ?? 1,
            resolutionAction: "create_new",
            selectedClassId: classOption.id,
            admissionNumberMode: generateOfficial ? "official_generated" : "supplied",
            manualNumberConfirmed: !generateOfficial ? true : undefined,
            manualNumberReason: !generateOfficial
              ? "Historical identifier preserved during reviewed bulk import"
              : undefined,
            expectedNumberPolicyVersion:
              generateOfficial && numbering.available ? numbering.policyVersion : undefined,
            expectedNumberFormatVersion:
              generateOfficial && numbering.available ? numbering.formatVersion : undefined,
            expectedNumberCounterKey:
              generateOfficial && numbering.available ? numbering.counterKey : undefined,
            expectedNumberCounterVersion:
              generateOfficial && numbering.available ? numbering.counterVersion : undefined,
            expectedNumberSessionId:
              generateOfficial && numbering.available ? numbering.sessionId : undefined,
            expectedNumberResetPeriod:
              generateOfficial && numbering.available ? numbering.resetPeriod : undefined,
          } as never);
        }
        appToast.success(`Added ${selectedRows.length} new student records to the import plan`);
      } catch (error) {
        appToast.error(getErrorMessage(error, "Bulk row review stopped; completed decisions remain saved"));
      } finally {
        setIsReviewingReadyRows(false);
      }
    };

    const stats: ImportConfirmationStat[] = [
      {
        label: "Students Selected",
        value: `${selectedRows.length} ${selectedRows.length === 1 ? "record" : "records"}`,
        variant: "info",
      },
      {
        label: "ID Strategy",
        value:
          admissionMode === "official_all"
            ? suppliedCount > 0
              ? `Official IDs (${suppliedCount} replaced)`
              : "Official Auto-ID"
            : `${suppliedCount} Preserved IDs`,
        variant: admissionMode === "official_all" ? "default" : "success",
      },
    ];

    if (duplicateCount > 0) {
      stats.push({
        label: "Duplicates Flagged",
        value: `${duplicateCount} proceeding`,
        variant: "warning",
      });
    }

    setConfirmDialog({
      isOpen: true,
      title: `Prepare ${selectedRows.length} Student ${selectedRows.length === 1 ? "Record" : "Records"}`,
      badge: "Reviewed Import Plan",
      confirmVariant: "primary",
      confirmLabel: `Stage ${selectedRows.length} in Plan`,
      description: `Create ${selectedRows.length} separate student ${selectedRows.length === 1 ? "record" : "records"} in the import plan. ${
        admissionMode === "official_all"
          ? `Official IDs will replace ${suppliedCount} supplied spreadsheet IDs.`
          : `${suppliedCount} supplied admission IDs will be kept after backend uniqueness checks.`
      }${
        duplicateCount
          ? ` Note: You are proceeding past ${duplicateCount} potential duplicate warnings.`
          : ""
      }`,
      stats,
      infoNotice:
        "Nothing is committed to the live school roster yet. This action updates the reviewed staging plan so you can verify each record before final batch approval.",
      onConfirm: executeCreateRecords,
    });
  };

  const handleAssignClass = async (recordIds: string[], classId: string) => {
    if (!activeWorkspaceId) return;
    setIsReviewingReadyRows(true);
    try {
      await assignStudentClassBatch({ schoolId, workspaceId: activeWorkspaceId, recordIds, classId } as never);
      appToast.success(`Assigned ${recordIds.length} rows to the selected class`);
    } catch (error) {
      appToast.error(getErrorMessage(error, "Could not assign the selected class"));
    } finally {
      setIsReviewingReadyRows(false);
    }
  };

  const handleSkipRecords = async (recordIds: string[]) => {
    setConfirmDialog({
      isOpen: true,
      title: `Skip ${recordIds.length} Spreadsheet ${recordIds.length === 1 ? "Row" : "Rows"}`,
      badge: "Exclude from Import",
      confirmVariant: "warning",
      confirmLabel: `Skip ${recordIds.length} ${recordIds.length === 1 ? "Row" : "Rows"}`,
      description: `Skip ${recordIds.length} selected spreadsheet ${recordIds.length === 1 ? "row" : "rows"}? They will be marked as ignored and will not create student records or change school data when committed.`,
      stats: [
        {
          label: "Rows to Skip",
          value: `${recordIds.length}`,
          variant: "warning",
        },
      ],
      infoNotice:
        "Skipped rows remain in your staging workspace. You can un-skip or review them at any time before the final plan commit.",
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsReviewingReadyRows(true);
        try {
          for (const record of stagedRecords.filter((item) => recordIds.includes(item._id))) {
            await reviewStagedRecord({
              schoolId,
              recordId: record._id,
              expectedRowRevision: record.rowRevision ?? 1,
              resolutionAction: "ignore",
            } as never);
          }
          appToast.success(`Skipped ${recordIds.length} rows`);
        } catch (error) {
          appToast.error(getErrorMessage(error, "Bulk skip stopped; completed decisions remain saved"));
        } finally {
          setIsReviewingReadyRows(false);
        }
      },
    });
  };

  const handleRecheckClasses = async () => {
    if (!activeWorkspaceId) return;
    setIsReviewingReadyRows(true);
    try {
      const result = await resolveStagedClassesBatch({ schoolId, workspaceId: activeWorkspaceId } as never) as { resolved: number };
      appToast.success(result.resolved ? `Resolved ${result.resolved} class placements` : "No additional exact class matches found");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Could not recheck class placements"));
    } finally { setIsReviewingReadyRows(false); }
  };

  const handleApplyCounterRecommendations = () => {
    if (!activeWorkspaceId || !counterRecommendations?.length) return;
    const summary = counterRecommendations
      .map((item) => `${item.counterKey}: ${item.currentNextSequence} → ${item.recommendedNextSequence}`)
      .join("\n");

    setConfirmDialog({
      isOpen: true,
      title: "Apply Sequence Counter Recommendations",
      badge: "Admission Alignment",
      confirmVariant: "primary",
      confirmLabel: "Apply Recommendations",
      description:
        "Update the planned next-number sequence for the classes below based on historical spreadsheet records:",
      customDetails: summary,
      infoNotice:
        "This changes only the reviewed import plan; official counter sequences will only advance when the batch is committed.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const result = (await applyWorkspaceCounterRecommendations({
            schoolId,
            workspaceId: activeWorkspaceId,
          } as never)) as { applied: number };
          appToast.success(`Applied ${result.applied} counter recommendations`);
        } catch (error) {
          appToast.error(getErrorMessage(error, "Could not apply counter recommendations"));
        }
      },
    });
  };

  const handleApprovePlan = async () => {
    if (!activeWorkspaceId) return;
    setIsApproving(true);
    try {
      let done = false;
      let skippedOccupiedNumbers = 0;
      while (!done) {
        const result = await approveImportWorkspace({ schoolId, workspaceId: activeWorkspaceId } as never) as {
          done: boolean;
          processedRecords: number;
          totalRecords: number;
          skippedOccupiedNumbers?: number;
          restartRequired?: boolean;
          message?: string;
        };
        setCommitProgress({ processed: result.processedRecords, total: result.totalRecords });
        if (result.restartRequired) {
          appToast.error(result.message ?? "Numbering changed during approval. Reload recommendations and approve again.");
          return;
        }
        skippedOccupiedNumbers += result.skippedOccupiedNumbers ?? 0;
        done = result.done;
      }
      appToast.success(skippedOccupiedNumbers
        ? `Import plan approved. Skipped ${skippedOccupiedNumbers} previously used admission ${skippedOccupiedNumbers === 1 ? "ID" : "IDs"}.`
        : "Reviewed import plan approved. Commit will revalidate every row.");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Plan approval failed"));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReopenReview = async () => {
    if (!activeWorkspaceId) return;
    setIsReopening(true);
    try {
      const result = await reopenIncompleteImportReview({ schoolId, workspaceId: activeWorkspaceId } as never) as { firstIncompleteRow: number };
      appToast.success(`Reopened incomplete review at row #${result.firstIncompleteRow}. Committed receipts remain immutable.`);
    } catch (error) {
      appToast.error(getErrorMessage(error, "Could not reopen incomplete review"));
    } finally {
      setIsReopening(false);
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
          processedRecords?: number;
          totalRecords?: number;
        };

        setCommitProgress({ processed: res.processedRecords ?? 0, total: res.totalRecords ?? 0 });
        if (res.done) {
          isDone = true;
          totalMerged = res.processedRecords ?? 0;
        }
      }
      appToast.success(`Committed ${totalMerged} reviewed records with audited batch receipts.`);
      onSuccess?.();
    } catch (err) {
      appToast.error(getErrorMessage(err, "Batch failed. Earlier successful batches remain saved; retry resumes incomplete work."));
    } finally {
      setIsMerging(false);
    }
  };

  const clashCandidateRecord = clashModalRecord?.clashCandidateId
    ? stagedRecords.find((record) => record._id === clashModalRecord.clashCandidateId)
    : undefined;
  const existingStudentOption = clashModalRecord?.existingStudentId
    ? reviewOptions?.students.find(
        (student) => student.id === clashModalRecord.existingStudentId,
      )
    : undefined;
  const existingStudentMatch = existingStudentOption
    ? {
        fullName: existingStudentOption.name,
        admissionNumber: existingStudentOption.admissionNumber,
        className: reviewOptions?.classes.find(
          (classOption) => classOption.id === existingStudentOption.classId,
        )?.name,
      }
    : undefined;

  if (workspaces === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 w-full bg-slate-50/60 overflow-hidden">
      {/* Top Header */}
      <div className="shrink-0 border-b border-slate-200/90 bg-white px-6 py-5 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            {activeWorkspaceId && (
              <button
                type="button"
                onClick={() => { setActiveWorkspaceId(null); setCommitProgress(null); }}
                disabled={isMerging || isUploading || isApproving || isReopening}
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
            <button
              type="button"
              disabled={!promptContext}
              onClick={handleCopyAiPrompt}
              title="Copy a prompt that tells an AI how to format your existing documents for this school"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {promptCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{promptCopied ? "Prompt copied" : "Copy migration prompt"}</span>
            </button>
            {featureSignals && featureSignals.length > 0 && (
              <button
                type="button"
                onClick={() => setIsColumnMappingOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
              >
                <Database className="h-3.5 w-3.5 text-indigo-600" />
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

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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
        <div className="mx-auto max-w-7xl px-6 py-6 pb-24 space-y-6">
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
                        {["draft", "analyzing", "reviewing", "failed", "cancelled"].includes(ws.status) && (
                          <button
                            type="button"
                            disabled={deletingWorkspaceId !== null}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteWorkspace(ws._id, ws.name);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50"
                          >
                            {deletingWorkspaceId === ws._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            {deletingWorkspaceId === ws._id ? "Deleting…" : "Delete workspace"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isReviewingReadyRows} onClick={handleRecheckClasses} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Recheck class matches</button>
                {counterRecommendations && counterRecommendations.length > 0 && <button type="button" onClick={handleApplyCounterRecommendations} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Apply recommended next numbers ({counterRecommendations.length})</button>}
              </div>
              {(stagedRecords ?? []).some((record) => record.reviewStatus === "approved") && (
                <section aria-labelledby="approved-plan-heading" className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 id="approved-plan-heading" className="text-sm font-bold text-slate-900">Approved row decisions and placement</h2>
                  <ul className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                    {(stagedRecords ?? []).filter((record) => record.reviewStatus === "approved").slice(0, 50).map((record) => {
                      const selectedClass = reviewOptions?.classes.find((item) => item.id === record.selectedClassId)?.name;
                      const selectedSubject = reviewOptions?.subjects.find((item) => item.id === record.selectedSubjectId)?.name;
                      const selectedStudent = reviewOptions?.students.find((item) => item.id === record.selectedStudentId)?.name;
                      return (
                        <li key={record._id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <span className="font-bold">Row #{record.rowNumber}: {record.resolutionAction?.replace(/_/g, " ")}</span>
                          {selectedStudent && <span> • {selectedStudent}</span>}
                          {selectedClass && <span> • Class {selectedClass}</span>}
                          {selectedSubject && <span> • {selectedSubject}</span>}
                          {record.proposedAdmissionNumber && <span> • ID {record.proposedAdmissionNumber}</span>}
                          {record.commitReceiptId && <span> • Receipt {record.commitReceiptId}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {(stagedRecords ?? []).filter((record) => record.reviewStatus === "approved").length > 50 && (
                    <p className="mt-2 text-xs text-slate-500">Showing the first 50 approved decisions in this loaded review window.</p>
                  )}
                </section>
              )}
              {stagedPage.status !== "Exhausted" && (
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <span>Load every row to review and approve the complete workspace. Commit remains gated while rows are outside this window.</span>
                  <button type="button" disabled={stagedPage.status !== "CanLoadMore"} onClick={() => stagedPage.loadMore(200)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold disabled:opacity-50">
                    {stagedPage.status === "LoadingMore" || stagedPage.status === "LoadingFirstPage" ? "Loading…" : "Load 200 more rows"}
                  </button>
                </div>
              )}
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
                  onReview={setReviewRecord}
                  readyRecordIds={readyStudentRows.map((record) => record._id)}
                  createRecordIds={createEligibleStudentRows.map((record) => record._id)}
                  classes={reviewOptions?.classes ?? []}
                  isApplyingBulkAction={isReviewingReadyRows}
                  onAssignClass={handleAssignClass}
                  onCreateRecords={handleCreateRecords}
                  onSkipRecords={handleSkipRecords}
                />
              )}

              {activeTab === "household" && (
                <HouseholdReviewTab records={(stagedRecords ?? []) as StagedStudentRow[]} />
              )}

              {activeTab === "results" && (
                <ResultsReviewTab
                  records={stagedRecords ?? []}
                  onPatchField={handlePatchField}
                  onReview={setReviewRecord}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Bottom Bar */}
      {activeWorkspaceId && summary && summary.status !== "merged" && (
        <div className="shrink-0">
          <StagingActionBar
            status={summary.status}
            totalRecords={summary.totalRecords}
            reviewedRecords={(stagedRecords ?? []).filter((record) => record.reviewStatus === "approved").length}
            validRecords={summary.validRecords}
            warningRecords={summary.warningRecords}
            errorRecords={summary.errorRecords}
            isMerging={isMerging}
            isApproving={isApproving}
            isReopening={isReopening}
            onApprovePlan={handleApprovePlan}
            onCommitMerge={handleCommitMerge}
            onReopenReview={handleReopenReview}
          />
        </div>
      )}

      {/* Modals */}
      {clashModalRecord && (
        <ClashResolutionModal
          record={clashModalRecord}
          candidateRecord={clashCandidateRecord}
          existingStudentMatch={existingStudentMatch}
          onClose={() => setClashModalRecord(null)}
          onResolve={handleResolveClash}
          isResolving={isResolvingClash}
        />
      )}

      {reviewRecord && reviewOptions && (
        <ImportRowReviewDialog
          record={reviewRecord}
          options={reviewOptions}
          saving={isReviewing}
          onClose={() => setReviewRecord(null)}
          onSave={handleReviewRow}
        />
      )}

      {isColumnMappingOpen && (
        <ColumnMappingDialog
          signals={(featureSignals ?? []) as any}
          onClose={() => setIsColumnMappingOpen(false)}
        />
      )}

      {confirmDialog && confirmDialog.isOpen && (
        <ImportConfirmationModal
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          badge={confirmDialog.badge}
          description={confirmDialog.description}
          stats={confirmDialog.stats}
          infoNotice={confirmDialog.infoNotice}
          customDetails={confirmDialog.customDetails}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
          isLoading={isReviewingReadyRows || deletingWorkspaceId !== null}
        />
      )}
    </div>
  );
}
