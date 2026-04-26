"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import {
  BookOpenText,
  Clock3,
  EyeOff,
  FileUp,
  Info,
  Loader2,
  PencilLine,
  Search,
  Send,
  Shield,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  applyPlanningSourceIdsToReturnTo,
  buildTeacherLessonPlanHref,
  buildTeacherPlanningWorkspaceHref,
  getUserFacingErrorMessage,
  parsePlanningContextFromSearchParams,
  parseTeacherLessonPlanSourceIds,
} from "@school/shared";

interface TeacherLibrarySummary {
  loaded: number;
  privateOwner: number;
  staffVisible: number;
  readyToSelect: number;
  publishable: number;
  needsAttention: number;
}

interface TeacherLibraryMaterial {
  _id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  ownerRole: "teacher" | "admin" | "student" | "system";
  sourceType:
    | "file_upload"
    | "text_entry"
    | "youtube_link"
    | "generated_draft"
    | "student_upload"
    | "imported_curriculum";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  processingStatus: "awaiting_upload" | "queued" | "extracting" | "ocr_needed" | "ready" | "failed";
  searchStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  level: string;
  topicLabel: string;
  topicId: string | null;
  topicTitle: string | null;
  labelSuggestions: string[];
  chunkCount: number;
  externalUrl: string | null;
  indexedAt: number | null;
  ingestionErrorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  isOwnedByMe: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canSelectAsSource: boolean;
}

interface TeacherKnowledgeTopic {
  _id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  level: string;
  termId: string;
  status: "draft" | "active" | "retired";
}

interface TeacherLibraryResponse {
  summary: TeacherLibrarySummary;
  materials: TeacherLibraryMaterial[];
}

interface TeacherLibrarySubject {
  id: string;
  name: string;
  code: string;
}

interface TeacherLibraryClassSummary {
  _id: string;
  name: string;
  gradeName?: string;
  classLabel?: string;
}

interface LevelOption {
  value: string;
  label: string;
}

interface UploadNotice {
  tone: "success" | "error";
  message: string;
}

interface MaterialDraft {
  materialId: string;
  title: string;
  description: string;
  subjectId: string;
  level: string;
  topicLabel: string;
  topicId: string;
}

interface TeacherKnowledgeMaterialSourceProof {
  originalFileState: "available" | "missing" | "orphaned";
  originalFileUrl: string | null;
  originalFileContentType: string | null;
  originalFileSize: number | null;
  originalFileNotice: string | null;
  extractedTextPreview: string | null;
  extractedTextChunkCount: number;
}

interface TeacherKnowledgeMaterialSourceProofResponse {
  materialId: string;
  sourceProof: TeacherKnowledgeMaterialSourceProof;
}

type UploadIntent = "private_draft" | "request_review" | "staff_shared";

const DEFAULT_FILTERS = {
  searchQuery: "",
  visibility: "all" as const,
  reviewStatus: "all" as const,
  sourceType: "all" as const,
  processingStatus: "all" as const,
};

const PROCESSING_STATUS_HELP = [
  {
    status: "extracting",
    label: "Extracting",
    description: "The file is being read and native text extraction is in progress.",
  },
  {
    status: "ocr_needed",
    label: "OCR needed",
    description: "The file looks scanned or image-heavy, and this workflow cannot read enough text yet.",
  },
  {
    status: "failed",
    label: "Failed",
    description: "Ingestion stopped because the file was unsupported, too weak, or hit a hard limit.",
  },
  {
    status: "ready",
    label: "Ready",
    description: "Text extraction succeeded and the source can be reviewed or selected for planning.",
  },
] as const;

function LoadingShell() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-44 rounded-full bg-slate-100" />
          <div className="h-12 rounded-2xl bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-24 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="h-44 rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
          <div className="h-28 rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
          <div className="space-y-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="h-6 w-28 rounded-full bg-slate-100" />
            <div className="h-10 rounded-2xl bg-slate-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="h-[600px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      </div>
    </div>
  );
}

function badgeTone(kind: "visible" | "visibility" | "review" | "processing", value: string) {
  if (kind === "visibility") {
    switch (value) {
      case "private_owner":
        return "border-slate-200 bg-slate-950 text-white";
      case "staff_shared":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "student_approved":
        return "border-blue-100 bg-blue-50 text-blue-700";
      case "class_scoped":
        return "border-amber-100 bg-amber-50 text-amber-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  if (kind === "review") {
    switch (value) {
      case "approved":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "pending_review":
      case "draft":
        return "border-amber-100 bg-amber-50 text-amber-700";
      case "rejected":
        return "border-rose-100 bg-rose-50 text-rose-700";
      case "archived":
        return "border-slate-200 bg-slate-100 text-slate-500";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  if (kind === "processing") {
    switch (value) {
      case "ready":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "extracting":
        return "border-blue-100 bg-blue-50 text-blue-700";
      case "queued":
      case "awaiting_upload":
        return "border-amber-100 bg-amber-50 text-amber-700";
      case "ocr_needed":
      case "failed":
        return "border-rose-100 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  return value === "yes"
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-500";
}

function normalizeFileTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatSubjectLabel(subject: TeacherLibrarySubject) {
  return subject.code ? `${subject.name} • ${subject.code}` : subject.name;
}

function buildLevelOptions(classes: TeacherLibraryClassSummary[] | undefined): LevelOption[] {
  const seen = new Set<string>();
  const options: LevelOption[] = [];

  for (const classDoc of classes ?? []) {
    const level = (classDoc.gradeName ?? classDoc.name).trim();
    if (!level || seen.has(level)) {
      continue;
    }

    seen.add(level);
    options.push({ value: level, label: level });
  }

  return options;
}

function buildLevelOptionsWithCurrentValue(
  options: LevelOption[],
  currentValue: string
): LevelOption[] {
  const trimmed = currentValue.trim();
  if (!trimmed) {
    return options;
  }

  if (options.some((option) => option.value === trimmed)) {
    return options;
  }

  return [{ value: trimmed, label: `Legacy: ${trimmed}` }, ...options];
}

function buildTopicOptionsWithCurrentValue(
  topics: TeacherKnowledgeTopic[],
  currentTopicId: string,
  currentTopicTitle: string | null
): LevelOption[] {
  const options = topics.map((topic) => ({
    value: topic._id,
    label: `${topic.title} • ${topic.subjectName} • ${topic.level}`,
  }));
  const trimmed = currentTopicId.trim();
  if (!trimmed) {
    return options;
  }

  if (options.some((option) => option.value === trimmed)) {
    return options;
  }

  return [{ value: trimmed, label: currentTopicTitle ? `Attached: ${currentTopicTitle}` : `Attached topic: ${trimmed}` }, ...options];
}

function uploadIntentLabel(intent: UploadIntent) {
  switch (intent) {
    case "private_draft":
      return "Private draft";
    case "request_review":
      return "Request staff review";
    case "staff_shared":
      return "Start as staff shared";
    default:
      return intent;
  }
}

function uploadIntentActionLabel(intent: UploadIntent) {
  switch (intent) {
    case "private_draft":
      return "Save private draft";
    case "request_review":
      return "Request staff review";
    case "staff_shared":
      return "Start as staff shared";
    default:
      return "Upload source material";
  }
}

function uploadIntentSuccessMessage(intent: UploadIntent) {
  switch (intent) {
    case "private_draft":
      return "Saved privately. It will stay hidden until you publish it to staff.";
    case "request_review":
      return "Saved privately and flagged for staff review.";
    case "staff_shared":
      return "Uploaded as staff shared.";
    default:
      return "Upload complete.";
  }
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const STALE_EXTRACTION_MS = 2 * 60 * 1000;

function inferUploadContentType(file: File) {
  const explicitType = file.type.trim().toLowerCase();
  if (explicitType) {
    return explicitType;
  }

  const fileName = file.name.trim().toLowerCase();
  if (fileName.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (fileName.endsWith(".md")) {
    return "text/markdown";
  }
  if (fileName.endsWith(".txt")) {
    return "text/plain";
  }

  return "application/octet-stream";
}

function isSupportedUploadContentType(contentType: string) {
  return contentType.startsWith("text/") || contentType === "application/pdf" || contentType === "application/x-pdf" || contentType.endsWith("+pdf");
}

export default function TeacherLibraryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [visibility, setVisibility] = useState<(typeof DEFAULT_FILTERS)["visibility"]>(
    DEFAULT_FILTERS.visibility
  );
  const [reviewStatus, setReviewStatus] = useState<(typeof DEFAULT_FILTERS)["reviewStatus"]>(
    DEFAULT_FILTERS.reviewStatus
  );
  const [sourceType, setSourceType] = useState<(typeof DEFAULT_FILTERS)["sourceType"]>(
    DEFAULT_FILTERS.sourceType
  );
  const [processingStatus, setProcessingStatus] = useState<
    (typeof DEFAULT_FILTERS)["processingStatus"]
  >(DEFAULT_FILTERS.processingStatus);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [contextFitFilter, setContextFitFilter] = useState<"all" | "topic_bound" | "broad_reference">("all");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploadLevel, setUploadLevel] = useState("");
  const [uploadTopicLabel, setUploadTopicLabel] = useState("");
  const [isCurriculumReference, setIsCurriculumReference] = useState(false);
  const [uploadIntent, setUploadIntent] = useState<UploadIntent>("private_draft");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [savingMaterialId, setSavingMaterialId] = useState<string | null>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [proofMaterialId, setProofMaterialId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const sourceIdsParam = searchParams.get("sourceIds");
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/planning/") ? returnTo : null;
  const selectedSourceIds = useMemo(
    () => parseTeacherLessonPlanSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );
  const attachPlanningContext = useMemo(
    () => (safeReturnTo ? parsePlanningContextFromSearchParams(new URL(safeReturnTo, "https://planning.local").searchParams) : null),
    [safeReturnTo]
  );
  const selectedSourceIdSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  const queryArgs = useMemo(
    () => ({
      searchQuery: deferredSearch.trim() || undefined,
      visibility,
      reviewStatus,
      sourceType,
      processingStatus,
      limit: 90,
    }),
    [deferredSearch, processingStatus, reviewStatus, sourceType, visibility]
  );

  const materialsData = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeLibraryMaterials" as never,
    queryArgs as never
  ) as TeacherLibraryResponse | undefined;
  const subjects = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherLibrarySubjects" as never
  ) as TeacherLibrarySubject[] | undefined;
  const assignableClasses = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as TeacherLibraryClassSummary[] | undefined;

  const levelOptions = useMemo(() => buildLevelOptions(assignableClasses), [assignableClasses]);
  const isAdmin = session?.user?.role === "admin";
  const uploadIntentOptions = useMemo(
    () => [
      { value: "private_draft", label: uploadIntentLabel("private_draft") },
      { value: "request_review", label: uploadIntentLabel("request_review") },
      ...(isAdmin ? [{ value: "staff_shared", label: uploadIntentLabel("staff_shared") }] : []),
    ],
    [isAdmin]
  );

  const requestUploadUrl = useMutation(
    "functions/academic/lessonKnowledgeIngestion:requestKnowledgeMaterialUploadUrl" as never
  );
  const finalizeUpload = useMutation(
    "functions/academic/lessonKnowledgeIngestion:finalizeKnowledgeMaterialUpload" as never
  );
  const updateMaterial = useMutation(
    "functions/academic/lessonKnowledgeTeacher:updateTeacherKnowledgeMaterialDetails" as never
  );
  const createTopic = useMutation(
    "functions/academic/lessonKnowledgeTeacher:createTeacherKnowledgeTopic" as never
  );
  const publishMaterial = useMutation(
    "functions/academic/lessonKnowledgeTeacher:publishTeacherKnowledgeMaterialToStaff" as never
  );
  const promoteStudentUpload = useMutation(
    "functions/academic/lessonKnowledgePortal:promotePortalStudentUpload" as never
  );
  const retryMaterialIngestion = useMutation(
    "functions/academic/lessonKnowledgeIngestion:retryKnowledgeMaterialIngestion" as never
  );

  const materials = useMemo(() => materialsData?.materials ?? [], [materialsData]);
  const filteredMaterials = useMemo(
    () =>
      materials.filter((material) => {
        if (subjectFilter !== "all" && material.subjectId !== subjectFilter) {
          return false;
        }
        if (levelFilter !== "all" && material.level !== levelFilter) {
          return false;
        }
        if (contextFitFilter === "topic_bound") {
          return material.sourceType !== "imported_curriculum" && Boolean(material.topicId);
        }
        if (contextFitFilter === "broad_reference") {
          return material.sourceType === "imported_curriculum";
        }
        return true;
      }),
    [contextFitFilter, levelFilter, materials, subjectFilter]
  );
  const editingMaterial = useMemo(
    () => (editingMaterialId ? materials.find((material) => material._id === editingMaterialId) ?? null : null),
    [editingMaterialId, materials]
  );
  const topicQueryArgs = useMemo(
    () =>
      draft && draft.subjectId && draft.level
        ? ({ subjectId: draft.subjectId as never, level: draft.level, limit: 50 } as never)
        : ("skip" as never),
    [draft]
  );
  const topicCandidates = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeTopics" as never,
    topicQueryArgs
  ) as TeacherKnowledgeTopic[] | undefined;
  const summary = materialsData?.summary ?? {
    loaded: 0,
    privateOwner: 0,
    staffVisible: 0,
    readyToSelect: 0,
    publishable: 0,
    needsAttention: 0,
  };
  const readySubjects = useMemo(() => subjects ?? [], [subjects]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material._id, material])), [materials]);
  const selectedMaterials = useMemo(
    () => selectedSourceIds.map((materialId) => materialMap.get(materialId)).filter(Boolean) as TeacherLibraryMaterial[],
    [materialMap, selectedSourceIds]
  );
  const proofMaterial = useMemo(
    () => materials.find((material) => material._id === proofMaterialId) ?? null,
    [materials, proofMaterialId]
  );
  const sourceProofData = useQuery(
    "functions/academic/lessonKnowledgeTeacher:getTeacherKnowledgeMaterialSourceProof" as never,
    proofMaterialId ? ({ materialId: proofMaterialId } as never) : ("skip" as never)
  ) as TeacherKnowledgeMaterialSourceProofResponse | undefined;
  const topicOptions = useMemo(
    () => buildTopicOptionsWithCurrentValue(topicCandidates ?? [], draft?.topicId ?? "", editingMaterial?.topicTitle ?? null),
    [draft?.topicId, editingMaterial?.topicTitle, topicCandidates]
  );

  useEffect(() => {
    if (!proofMaterialId) {
      return;
    }

    if (materials.some((material) => material._id === proofMaterialId)) {
      return;
    }

    setProofMaterialId(null);
  }, [materials, proofMaterialId]);

  const lessonPlanHref = buildTeacherLessonPlanHref({
    sourceIds: selectedSourceIds,
    sourceOrigin: "library",
  });
  const questionBankHref = buildTeacherPlanningWorkspaceHref({
    route: "question-bank",
    mode: "practice_quiz",
    sourceIds: selectedSourceIds,
    sourceOrigin: "library",
  });
  const attachedReturnHref = useMemo(
    () => (safeReturnTo ? applyPlanningSourceIdsToReturnTo(safeReturnTo, selectedSourceIds) : null),
    [safeReturnTo, selectedSourceIds]
  );

  useEffect(() => {
    if (!uploadSubjectId && readySubjects.length > 0) {
      setUploadSubjectId(readySubjects[0].id);
    }
  }, [readySubjects, uploadSubjectId]);

  useEffect(() => {
    if (!uploadLevel && levelOptions.length > 0) {
      setUploadLevel(levelOptions[0].value);
    }
  }, [levelOptions, uploadLevel]);

  useEffect(() => {
    if (!editingMaterialId) {
      setDraft(null);
      return;
    }

    const material = materials.find((item) => item._id === editingMaterialId);
    if (!material) {
      return;
    }

    setDraft({
      materialId: material._id,
      title: material.title,
      description: material.description ?? "",
      subjectId: material.subjectId,
      level: material.level,
      topicLabel: material.topicLabel,
      topicId: material.topicId ?? "",
    });
  }, [editingMaterialId, materials]);

  useEffect(() => {
    if (uploadTitle || !uploadFile) {
      return;
    }

    const derived = normalizeFileTitle(uploadFile.name);
    if (derived) {
      setUploadTitle(derived);
      if (!uploadTopicLabel) {
        setUploadTopicLabel(derived);
      }
    }
  }, [uploadFile, uploadTitle, uploadTopicLabel]);

  const updateSelectedSourceIds = useCallback(
    (nextIds: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextIds.length > 0) {
        params.set("sourceIds", nextIds.join(","));
      } else {
        params.delete("sourceIds");
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const toggleSourceSelection = useCallback(
    (materialId: string) => {
      const nextIds = selectedSourceIds.includes(materialId)
        ? selectedSourceIds.filter((value) => value !== materialId)
        : [...selectedSourceIds, materialId];
      updateSelectedSourceIds(nextIds);
    },
    [selectedSourceIds, updateSelectedSourceIds]
  );

  const handleUploadFileChange = useCallback((file: File | null) => {
    setUploadFile(file);
    if (!file) {
      return;
    }

    const derived = normalizeFileTitle(file.name);
    if (derived && !uploadTitle) {
      setUploadTitle(derived);
    }
    if (derived && !uploadTopicLabel) {
      setUploadTopicLabel(derived);
    }
  }, [uploadTitle, uploadTopicLabel]);

  const clearUploadForm = useCallback(() => {
    setUploadTitle("");
    setUploadDescription("");
    setUploadTopicLabel("");
    setIsCurriculumReference(false);
    setUploadIntent("private_draft");
    setUploadFile(null);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleUploadSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setNotice(null);

      if (!uploadFile) {
        setNotice({ tone: "error", message: "Choose a file to upload." });
        return;
      }

      if (uploadFile.size > MAX_UPLOAD_BYTES) {
        setNotice({
          tone: "error",
          message: "Files must be 12 MB or smaller for the planning library.",
        });
        return;
      }

      const uploadContentType = inferUploadContentType(uploadFile);
      if (!isSupportedUploadContentType(uploadContentType)) {
        setNotice({
          tone: "error",
          message: "Only PDF and text-based files are supported in the planning library right now.",
        });
        return;
      }

      if (!uploadSubjectId) {
        setNotice({ tone: "error", message: "Choose a subject before uploading." });
        return;
      }

      const subject = readySubjects.find((item) => item.id === uploadSubjectId);
      if (!subject) {
        setNotice({ tone: "error", message: "Choose a valid subject before uploading." });
        return;
      }

      const title = uploadTitle.trim() || normalizeFileTitle(uploadFile.name);
      const topicLabel = uploadTopicLabel.trim() || (isCurriculumReference ? "Curriculum / cross-topic planning reference" : title);
      const description = uploadDescription.trim();
      const level = uploadLevel.trim();

      if (!title) {
        setNotice({ tone: "error", message: "Add a title for the material." });
        return;
      }
      if (!topicLabel) {
        setNotice({ tone: "error", message: "Add a topic label for the material." });
        return;
      }
      if (!level) {
        setNotice({ tone: "error", message: "Choose a level before uploading." });
        return;
      }

      setUploading(true);

      try {
        const uploadShell = (await requestUploadUrl({
          title,
          description: description || null,
          subjectId: subject.id as never,
          level,
          topicLabel,
          sourceType: isCurriculumReference ? "imported_curriculum" : "file_upload",
          uploadIntent,
        } as never)) as {
          materialId: string;
          uploadUrl: string;
        };

        const uploadResponse = await fetch(uploadShell.uploadUrl, {
          method: "POST",
          headers: { "Content-Type": uploadContentType },
          body: uploadFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed.");
        }

        const uploadPayload = (await uploadResponse.json()) as { storageId?: string };
        if (!uploadPayload.storageId) {
          throw new Error("Upload failed.");
        }

        await finalizeUpload({
          materialId: uploadShell.materialId as never,
          storageId: uploadPayload.storageId as never,
        } as never);

        setNotice({
          tone: "success",
          message: uploadIntentSuccessMessage(uploadIntent),
        });
        clearUploadForm();
      } catch (error) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(error, "Upload failed."),
        });
      } finally {
        setUploading(false);
      }
    },
    [
      clearUploadForm,
      finalizeUpload,
      readySubjects,
      requestUploadUrl,
      uploadDescription,
      uploadFile,
      uploadIntent,
      uploadLevel,
      isCurriculumReference,
      uploadSubjectId,
      uploadTitle,
      uploadTopicLabel,
    ]
  );

  const beginEditing = useCallback((material: TeacherLibraryMaterial) => {
    setNotice(null);
    setEditingMaterialId(material._id);
    setDraft({
      materialId: material._id,
      title: material.title,
      description: material.description ?? "",
      subjectId: material.subjectId,
      level: material.level,
      topicLabel: material.topicLabel,
      topicId: material.topicId ?? "",
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMaterialId(null);
    setDraft(null);
  }, []);

  const saveDraft = useCallback(async () => {
    if (!draft) {
      return;
    }

    setSavingMaterialId(draft.materialId);
    setNotice(null);

    try {
      await updateMaterial({
        materialId: draft.materialId as never,
        title: draft.title,
        description: draft.description || null,
        subjectId: draft.subjectId as never,
        level: draft.level,
        topicLabel: draft.topicLabel,
        topicId: draft.topicId || undefined,
      } as never);

      setNotice({
        tone: "success",
        message: "Changes saved and the search snapshot was refreshed.",
      });
      cancelEditing();
    } catch (error) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Could not save the labels."),
      });
    } finally {
      setSavingMaterialId(null);
    }
  }, [cancelEditing, draft, updateMaterial]);

  const createTopicAndAttach = useCallback(async () => {
    if (!draft) {
      return;
    }

    setSavingMaterialId(draft.materialId);
    setNotice(null);

    try {
      const createdTopic = (await createTopic({
        title: draft.topicLabel,
        summary: draft.description.trim() ? draft.description : null,
        subjectId: draft.subjectId as never,
        level: draft.level,
        termId: attachPlanningContext?.termId,
        attachMaterialId: draft.materialId as never,
      } as never)) as { _id: string };

      setDraft((current) =>
        current && current.materialId === draft.materialId
          ? { ...current, topicId: createdTopic._id }
          : current
      );
      setNotice({ tone: "success", message: "Real topic created and attached to this material." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Could not create and attach the topic."),
      });
    } finally {
      setSavingMaterialId(null);
    }
  }, [createTopic, draft]);

  const publishToStaff = useCallback(
    async (material: TeacherLibraryMaterial) => {
      setSavingMaterialId(material._id);
      setNotice(null);

      try {
        await publishMaterial({ materialId: material._id as never } as never);
        setNotice({
          tone: "success",
          message: "Published to staff sharing.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(error, "Publish failed."),
        });
      } finally {
        setSavingMaterialId(null);
      }
    },
    [publishMaterial]
  );

  const promoteStudentUploadToTopic = useCallback(
    async (material: TeacherLibraryMaterial) => {
      setSavingMaterialId(material._id);
      setNotice(null);

      try {
        await promoteStudentUpload({ materialId: material._id as never } as never);
        setNotice({
          tone: "success",
          message: "Student upload promoted to approved topic content.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(error, "Promotion failed."),
        });
      } finally {
        setSavingMaterialId(null);
      }
    },
    [promoteStudentUpload]
  );

  const retryIngestion = useCallback(
    async (material: TeacherLibraryMaterial) => {
      setSavingMaterialId(material._id);
      setNotice(null);

      try {
        await retryMaterialIngestion({ materialId: material._id as never } as never);
        setNotice({
          tone: "success",
          message:
            material.processingStatus === "extracting"
              ? "The stuck extraction was re-queued. Give it a few seconds and refresh if needed."
              : "The material was re-queued for extraction.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(error, "Retry failed."),
        });
      } finally {
        setSavingMaterialId(null);
      }
    },
    [retryMaterialIngestion]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setVisibility(DEFAULT_FILTERS.visibility);
    setReviewStatus(DEFAULT_FILTERS.reviewStatus);
    setSourceType(DEFAULT_FILTERS.sourceType);
    setProcessingStatus(DEFAULT_FILTERS.processingStatus);
    setSubjectFilter("all");
    setLevelFilter("all");
    setContextFitFilter("all");
  }, []);

  const isLoading = !materialsData || !subjects || !assignableClasses;

  if (isLoading) {
    return <LoadingShell />;
  }

  const selectedPreview = selectedMaterials.slice(0, 3).map((material) => material.title);
  const selectedPreviewSuffix = selectedSourceIds.length > 3 ? ` +${selectedSourceIds.length - 3} more` : "";

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.14),_transparent_36%)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-200 backdrop-blur-sm">
                <BookOpenText className="h-3.5 w-3.5" />
                Planning Library
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                  Planning sources, private-first by default.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Upload source material, keep it private while you refine the labels, and choose whether it should stay private, request review, or start shared with staff. Free-text topic labels stay separate from real topic attachments, and the next lesson-plan workspace receives selected sources through a stable query string handoff.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:max-w-2xl xl:flex-1">
              <StatPill label="Private" value={summary.privateOwner} accent="slate" />
              <StatPill label="Staff" value={summary.staffVisible} accent="emerald" />
              <StatPill label="Selectable" value={summary.readyToSelect} accent="blue" />
              <StatPill label="Needs help" value={summary.needsAttention} accent="amber" />
            </div>
          </div>
        </div>
      </section>

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">
                  Search and filter
                </p>
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Find private drafts, review requests, and staff-visible sources fast.
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ProcessingStatusHelp />
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Reset filters
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Search
                </span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-500 focus-within:border-slate-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-950/5">
                  <Search className="h-4 w-4" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Title, owner, topic, label, or description"
                    className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <FilterSelect
                label="Visibility"
                value={visibility}
                onChange={(value) => setVisibility(value as typeof visibility)}
                options={[
                  { value: "all", label: "All" },
                  { value: "private_owner", label: "Private" },
                  { value: "staff_shared", label: "Staff shared" },
                  { value: "student_approved", label: "Student approved" },
                  { value: "class_scoped", label: "Class scoped" },
                ]}
              />

              <FilterSelect
                label="Review"
                value={reviewStatus}
                onChange={(value) => setReviewStatus(value as typeof reviewStatus)}
                options={[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "pending_review", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "archived", label: "Archived" },
                ]}
              />

              <FilterSelect
                label="Source"
                value={sourceType}
                onChange={(value) => setSourceType(value as typeof sourceType)}
                options={[
                  { value: "all", label: "All" },
                  { value: "file_upload", label: "File upload" },
                  { value: "text_entry", label: "Text entry" },
                  { value: "youtube_link", label: "YouTube" },
                  { value: "generated_draft", label: "Generated" },
                  { value: "student_upload", label: "Student upload" },
                  { value: "imported_curriculum", label: "Curriculum" },
                ]}
              />

              <FilterSelect
                label="Processing"
                value={processingStatus}
                onChange={(value) => setProcessingStatus(value as typeof processingStatus)}
                options={[
                  { value: "all", label: "All" },
                  { value: "awaiting_upload", label: "Awaiting upload" },
                  { value: "queued", label: "Queued" },
                  { value: "extracting", label: "Extracting" },
                  { value: "ocr_needed", label: "OCR needed" },
                  { value: "ready", label: "Ready" },
                  { value: "failed", label: "Failed" },
                ]}
              />

              <FilterSelect
                label="Subject"
                value={subjectFilter}
                onChange={setSubjectFilter}
                options={[
                  { value: "all", label: "All" },
                  ...readySubjects.map((subject) => ({ value: subject.id, label: formatSubjectLabel(subject) })),
                ]}
              />

              <FilterSelect
                label="Level"
                value={levelFilter}
                onChange={setLevelFilter}
                options={[
                  { value: "all", label: "All" },
                  ...levelOptions.map((level) => ({ value: level.value, label: level.label })),
                ]}
              />

              <FilterSelect
                label="Repository fit"
                value={contextFitFilter}
                onChange={(value) => setContextFitFilter(value as typeof contextFitFilter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "topic_bound", label: "Topic-bound" },
                  { value: "broad_reference", label: "Broad references" },
                ]}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Source handoff
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                  {selectedSourceIds.length > 0 ? `${selectedSourceIds.length} source${selectedSourceIds.length === 1 ? "" : "s"} selected` : safeReturnTo ? "Attach repository sources to your workspace" : "Select repository sources for a planning workspace"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPreview.length > 0
                    ? `${selectedPreview.join(" • ")}${selectedPreviewSuffix}`
                    : safeReturnTo
                      ? "Use the checkboxes on each source card, then return to the same lesson or assessment workspace with the updated selection."
                      : "Use the checkboxes on each source card to prepare a lesson or assessment workspace."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {attachedReturnHref ? (
                  <Link
                    href={attachedReturnHref}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Return with selection
                  </Link>
                ) : null}
                {selectedSourceIds.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateSelectedSourceIds([])}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Clear selection
                    </button>
                    {lessonPlanHref ? (
                      <Link
                        href={lessonPlanHref}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        <Send className="h-4 w-4" />
                        Open lesson plan workspace
                      </Link>
                    ) : null}
                    <Link
                      href={questionBankHref}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Send className="h-4 w-4" />
                      Open question bank workspace
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <div className="space-y-4">
            {attachPlanningContext ? (
              <section className="rounded-[2rem] border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700">Attach mode</p>
                <p className="mt-2 leading-6">
                  Returning to {attachPlanningContext.kind === "topic" ? "a topic workspace" : "an exam workspace"} after you update this repository selection. This changes the workspace source set, not the draft identity.
                </p>
              </section>
            ) : null}
            {filteredMaterials.length === 0 ? (
              <EmptyState onPromptUpload={() => fileInputRef.current?.click()} />
            ) : (
              filteredMaterials.map((material) => (
                <LibraryMaterialCard
                  key={material._id}
                  material={material}
                  isSelected={selectedSourceIdSet.has(material._id)}
                  isEditing={editingMaterialId === material._id}
                  draft={draft?.materialId === material._id ? draft : null}
                  subjects={readySubjects}
                  levelOptions={levelOptions}
                  topicOptions={topicOptions}
                  isBusy={savingMaterialId === material._id}
                  onToggleSelection={() => toggleSourceSelection(material._id)}
                  onBeginEdit={() => beginEditing(material)}
                  onCancelEdit={cancelEditing}
                  onChangeDraft={setDraft}
                  onSaveDraft={saveDraft}
                  onCreateTopicAndAttach={createTopicAndAttach}
                  onPublish={() => publishToStaff(material)}
                  onPromoteStudentUpload={() => promoteStudentUploadToTopic(material)}
                  onRetryIngestion={() => retryIngestion(material)}
                  onOpenProof={() => setProofMaterialId(material._id)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Upload source material
                </p>
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Add new source material
                </h2>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleUploadSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  File
                </span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
                  <FileUp className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700">
                    {uploadFile ? uploadFile.name : "Choose a PDF or text file"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    className="hidden"
                    onChange={(event) => handleUploadFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Supported now: PDF or text-based files only. Keep uploads at or under 12 MB. PDF files over 80 pages are rejected. Image-only PDFs are marked OCR needed because OCR is not enabled in this workflow yet.
                </p>
              </label>

              <div className="grid gap-3">
                <TextField
                  label="Title"
                  value={uploadTitle}
                  placeholder="Community Safety Lesson Notes"
                  onChange={setUploadTitle}
                />
                <TextField
                  label={isCurriculumReference ? "Planning reference label (optional)" : "Topic label (free text)"}
                  value={uploadTopicLabel}
                  placeholder={isCurriculumReference ? "Year 7 Mathematics Curriculum" : "Community Safety"}
                  onChange={setUploadTopicLabel}
                />
                <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={isCurriculumReference}
                    onChange={(event) => setIsCurriculumReference(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-500"
                  />
                  <span>
                    <span className="block font-bold">Curriculum / cross-topic planning reference</span>
                    <span className="mt-1 block text-xs leading-5 text-amber-900/80">
                      Store this as a planning-only curriculum source that can be reused across multiple topics. It does not need a real topic attachment.
                    </span>
                  </span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Subject"
                    value={uploadSubjectId}
                    onChange={setUploadSubjectId}
                    options={readySubjects.map((subject) => ({ value: subject.id, label: formatSubjectLabel(subject) }))}
                  />
                  <SelectField
                    label="Level"
                    value={uploadLevel}
                    onChange={setUploadLevel}
                    options={levelOptions}
                    placeholder="Choose level"
                    disabled={levelOptions.length === 0}
                  />
                </div>
                <SelectField
                  label="Upload intent"
                  value={uploadIntent}
                  onChange={(value) => setUploadIntent(value as UploadIntent)}
                  options={uploadIntentOptions}
                />
                <p className="text-xs leading-5 text-slate-500">
                  Private draft is the safe default. Request staff review keeps the file private but marked for review. The topic label is only a label here; attach a real topic from the material editor when needed. {isAdmin ? "Admins can also start a file as staff shared." : ""}
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Description
                  </span>
                  <textarea
                    value={uploadDescription}
                    onChange={(event) => setUploadDescription(event.target.value)}
                    rows={4}
                    placeholder="Short note for the planning library"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 text-slate-400" />
                  <p>
                    Private-first keeps planning uploads hidden by default. Choose request review if you want the item queued for staff approval, or start as staff shared when you are an admin and want the file visible to staff as soon as processing finishes.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || readySubjects.length === 0 || levelOptions.length === 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading" : uploadIntentActionLabel(uploadIntent)}
              </button>
            </form>
          </section>

          <KnowledgeMaterialSourceProofPanel
            material={proofMaterial}
            sourceProof={sourceProofData?.sourceProof ?? null}
            isLoading={Boolean(proofMaterialId) && sourceProofData === undefined}
            onClose={() => setProofMaterialId(null)}
          />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Library health
                </p>
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Keep the shelf tidy
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <MiniStat label="Loaded on screen" value={summary.loaded} />
              <MiniStat label="Ready to select" value={summary.readyToSelect} />
              <MiniStat label="Publishable now" value={summary.publishable} />
              <MiniStat label="Needs attention" value={summary.needsAttention} tone="warn" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ onPromptUpload }: { onPromptUpload: () => void }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <BookOpenText className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
        No sources yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Upload a source, refine the labels, and then publish it when the staff-ready version is approved.
      </p>
      <button
        type="button"
        onClick={onPromptUpload}
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
      >
        <Upload className="h-4 w-4" />
        Add first source
      </button>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
        tone === "warn" ? "border-amber-100 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <span className="text-base font-black tracking-tight text-slate-950">{value}</span>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "slate" | "emerald" | "blue" | "amber";
}) {
  const classes =
    accent === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : accent === "blue"
        ? "border-sky-400/20 bg-sky-400/10 text-sky-100"
        : accent === "amber"
          ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
          : "border-white/10 bg-white/10 text-white";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function ProcessingStatusHelp() {
  return (
    <details className="group relative">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Info className="h-4 w-4" />
        Processing help
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
          Status legend
        </p>
        <h3 className="mt-1 text-sm font-black tracking-tight text-slate-950">
          What the processing badge means
        </h3>
        <div className="mt-3 space-y-2.5">
          {PROCESSING_STATUS_HELP.map((item) => (
            <div key={item.status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Badge tone={badgeTone("processing", item.status)} icon={<Clock3 className="h-3.5 w-3.5" />}>
                {item.label}
              </Badge>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function KnowledgeMaterialSourceProofPanel({
  material,
  sourceProof,
  isLoading,
  onClose,
}: {
  material: TeacherLibraryMaterial | null;
  sourceProof: TeacherKnowledgeMaterialSourceProof | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  if (!material) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Source proof
            </p>
            <h2 className="text-lg font-black tracking-tight text-slate-950">
              Pick a material to inspect its proof
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Open any source card to view the original file link and the extracted text proof that backs it.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded-full bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-44 rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Source proof
          </p>
          <h2 className="truncate text-lg font-black tracking-tight text-slate-950">
            {material.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {material.sourceType.replace(/_/g, " ")} • {material.visibility.replace(/_/g, " ")} • {material.processingStatus.replace(/_/g, " ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Original file
          </p>
          <p className="mt-1 text-sm font-bold tracking-tight text-slate-950">
            {sourceProof?.originalFileState === "available"
              ? "Available"
              : sourceProof?.originalFileState === "orphaned"
                ? "Missing from storage"
                : "Not stored"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {sourceProof?.originalFileNotice ?? "No original file access is available for this material."}
          </p>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
            {sourceProof?.originalFileContentType ? `${sourceProof.originalFileContentType} • ` : ""}
            {sourceProof?.originalFileSize ? `${Math.max(1, Math.round(sourceProof.originalFileSize / 1024))} KB` : "No file size recorded"}
          </p>
          {sourceProof?.originalFileUrl ? (
            <a
              href={sourceProof.originalFileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <BookOpenText className="h-4 w-4" />
              Open original file
            </a>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Extracted proof
          </p>
          <p className="mt-1 text-sm font-bold tracking-tight text-slate-950">
            {sourceProof?.extractedTextChunkCount ?? 0} chunk(s)
          </p>
          {sourceProof?.extractedTextPreview ? (
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-[12px] leading-6 text-slate-700">
              {sourceProof.extractedTextPreview}
            </pre>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              No extracted text proof is available yet. Once ingestion finishes, the proof preview will appear here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-950/5"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose...",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LibraryMaterialCard({
  material,
  isSelected,
  isEditing,
  draft,
  subjects,
  levelOptions,
  topicOptions,
  isBusy,
  onToggleSelection,
  onBeginEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveDraft,
  onCreateTopicAndAttach,
  onPublish,
  onPromoteStudentUpload,
  onRetryIngestion,
  onOpenProof,
}: {
  material: TeacherLibraryMaterial;
  isSelected: boolean;
  isEditing: boolean;
  draft: MaterialDraft | null;
  subjects: TeacherLibrarySubject[];
  levelOptions: Array<{ value: string; label: string }>;
  topicOptions: Array<{ value: string; label: string }>;
  isBusy: boolean;
  onToggleSelection: () => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onChangeDraft: (draft: MaterialDraft) => void;
  onSaveDraft: () => void;
  onCreateTopicAndAttach: () => void;
  onPublish: () => void;
  onPromoteStudentUpload: () => void;
  onRetryIngestion: () => void;
  onOpenProof: () => void;
}) {
  const isStaleExtracting =
    material.processingStatus === "extracting" && Date.now() - material.updatedAt >= STALE_EXTRACTION_MS;
  const canRetryIngestion =
    material.processingStatus === "failed" ||
    material.processingStatus === "ocr_needed" ||
    isStaleExtracting;
  const canPromoteStudentUpload =
    material.sourceType === "student_upload" &&
    material.visibility === "class_scoped" &&
    material.reviewStatus === "pending_review" &&
    material.processingStatus === "ready" &&
    material.searchStatus === "indexed";
  const updatedLabel = formatTimestamp(material.updatedAt);
  const canSaveDraft = Boolean(draft && draft.title.trim() && draft.topicLabel.trim() && draft.level.trim() && draft.subjectId);

  return (
    <article className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm transition ${isSelected ? "border-slate-400 shadow-[0_14px_40px_rgba(15,23,42,0.08)]" : "border-slate-200"}`}>
      <div className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={badgeTone("visibility", material.visibility)} icon={<Shield className="h-3.5 w-3.5" />}>
                {material.visibility.replace(/_/g, " ")}
              </Badge>
              <Badge tone={badgeTone("review", material.reviewStatus)} icon={<Sparkles className="h-3.5 w-3.5" />}>
                {material.reviewStatus.replace(/_/g, " ")}
              </Badge>
              <Badge tone={badgeTone("processing", material.processingStatus)} icon={<Clock3 className="h-3.5 w-3.5" />}>
                {material.processingStatus.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                {material.title}
              </h3>
              <div className="mt-1 space-y-2 text-sm leading-6 text-slate-500">
                <p className="line-clamp-2">
                  {material.description ?? "No description added yet."}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-500">
                    {material.sourceType === "imported_curriculum" ? "Planning label" : "Free-text label"}: {material.topicLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-500">
                    {material.sourceType === "imported_curriculum"
                      ? "Real topic: not required"
                      : `Real topic: ${material.topicId ? material.topicTitle ?? "Attached topic" : "Not attached yet"}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                {material.subjectName} • {material.level}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                {material.ownerName}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                Updated {updatedLabel}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-48">
            <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${material.canSelectAsSource ? "border-slate-200 bg-slate-50 text-slate-800" : "border-slate-200 bg-slate-100 text-slate-400"}`}>
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!material.canSelectAsSource}
                  onChange={onToggleSelection}
                  className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-950"
                />
                Source
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                {material.canSelectAsSource ? "Ready" : "Locked"}
              </span>
            </label>

            <button
              type="button"
              onClick={onBeginEdit}
              disabled={!material.canEdit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
            >
              <PencilLine className="h-4 w-4" />
              Edit labels & topic
            </button>
            <button
              type="button"
              onClick={onOpenProof}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <BookOpenText className="h-4 w-4" />
              View proof
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {material.labelSuggestions.slice(0, 4).map((label) => (
            <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {label}
            </span>
          ))}
          {material.labelSuggestions.length === 0 ? (
            <span className="rounded-full border border-dashed border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              No label suggestions yet
            </span>
          ) : null}
        </div>

        {isEditing && draft ? (
          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Title"
                value={draft.title}
                placeholder="Lesson title"
                onChange={(value) => onChangeDraft({ ...draft, title: value })}
              />
              <SelectField
                label="Subject"
                value={draft.subjectId}
                onChange={(value) => onChangeDraft({ ...draft, subjectId: value })}
                options={subjects.map((subject) => ({ value: subject.id, label: formatSubjectLabel(subject) }))}
              />
              <SelectField
                label="Level"
                value={draft.level}
                onChange={(value) => onChangeDraft({ ...draft, level: value })}
                options={buildLevelOptionsWithCurrentValue(levelOptions, draft.level)}
                placeholder="Choose level"
              />
              <TextField
                label="Topic label (free text)"
                value={draft.topicLabel}
                placeholder="Community Safety"
                onChange={(value) => onChangeDraft({ ...draft, topicLabel: value })}
              />
            </div>

            {material.sourceType === "imported_curriculum" ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                  Cross-topic planning reference
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-900/80">
                  This material is stored as a broad planning source. It does not need a real topic attachment and can be reused later with a target topic inside the lesson-plan or question-bank workspace.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Real topic attachment
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    The free-text label above does not create a portal topic. Pick an existing topic or create one from this material when you are ready.
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <SelectField
                    label="Attached topic"
                    value={draft.topicId}
                    onChange={(value) => onChangeDraft({ ...draft, topicId: value })}
                    options={topicOptions}
                    placeholder="No real topic attached"
                    disabled={topicOptions.length === 0}
                  />
                  <button
                    type="button"
                    onClick={onCreateTopicAndAttach}
                    disabled={isBusy || !draft.topicLabel.trim() || !draft.subjectId || !draft.level.trim()}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300"
                  >
                    <BookOpenText className="h-4 w-4" />
                    Create topic & attach
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Attachments stay bounded to the material&apos;s subject and level so the approval flow can keep portal exposure safe.
                </p>
              </div>
            )}
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Description
              </span>
              <textarea
                value={draft.description}
                onChange={(event) => onChangeDraft({ ...draft, description: event.target.value })}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-950/5"
              />
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={!canSaveDraft || isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </div>
        ) : null}

        {material.processingStatus === "ocr_needed" || material.processingStatus === "failed" || isStaleExtracting ? (
          <div className={`mt-5 rounded-2xl border p-4 text-sm ${isStaleExtracting ? "border-amber-100 bg-amber-50 text-amber-900" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
            <p className="font-bold">
              {isStaleExtracting
                ? "Extraction looks stuck"
                : material.processingStatus === "ocr_needed"
                  ? "OCR needed"
                  : "Ingestion failed"}
            </p>
            <p className="mt-1 leading-6">
              {isStaleExtracting
                ? "This file has been stuck on extracting for more than two minutes. You can safely retry it now."
                : material.ingestionErrorMessage ??
                  (material.processingStatus === "ocr_needed"
                    ? "This looks like a scanned or image-only PDF. OCR is not enabled in this workflow yet, so upload a text-based PDF or TXT file instead."
                    : "This upload could not be processed. Check the file type, size, and page count before trying again.")}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              <EyeOff className="h-3.5 w-3.5" />
              {material.isOwnedByMe ? "Owned by you" : material.ownerRole}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
              {material.chunkCount} chunks
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
              {material.canSelectAsSource ? "Selectable source" : "Not selectable yet"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {material.canPublish ? (
              <button
                type="button"
                onClick={onPublish}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish to staff
              </button>
            ) : canPromoteStudentUpload ? (
              <button
                type="button"
                onClick={onPromoteStudentUpload}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Promote to topic
              </button>
            ) : canRetryIngestion ? (
              <button
                type="button"
                onClick={onRetryIngestion}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                {isStaleExtracting ? "Retry stuck extraction" : "Retry extraction"}
              </button>
            ) : (
              <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-500">
                {material.processingStatus === "failed"
                  ? "Needs attention"
                  : material.processingStatus === "ocr_needed"
                    ? "OCR needed"
                    : material.visibility === "private_owner"
                      ? "Wait for processing"
                      : "Already shared"}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${tone}`}>
      {icon}
      {children}
    </span>
  );
}
