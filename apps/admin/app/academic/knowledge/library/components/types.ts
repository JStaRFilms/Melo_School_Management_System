import type { SubjectRecord } from "@/types";

export type KnowledgeMaterialVisibility =
  | "private_owner"
  | "staff_shared"
  | "class_scoped"
  | "student_approved";

export type KnowledgeMaterialReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";

export type KnowledgeMaterialProcessingStatus =
  | "awaiting_upload"
  | "queued"
  | "extracting"
  | "ocr_needed"
  | "ready"
  | "failed";

export type KnowledgeMaterialSourceType =
  | "file_upload"
  | "text_entry"
  | "youtube_link"
  | "generated_draft"
  | "student_upload"
  | "imported_curriculum";

export type KnowledgeMaterialOwnerRole =
  | "teacher"
  | "admin"
  | "student"
  | "system";

export interface KnowledgeLibraryFilterState {
  searchQuery: string;
  visibility: KnowledgeMaterialVisibility | "all";
  reviewStatus: KnowledgeMaterialReviewStatus | "all";
  sourceType: KnowledgeMaterialSourceType | "all";
  processingStatus: KnowledgeMaterialProcessingStatus | "all";
  ownerRole: KnowledgeMaterialOwnerRole | "all";
  subjectId: string | "all";
  level: string | "all";
}

export interface KnowledgeLibrarySummary {
  loaded: number;
  approved: number;
  pendingReview: number;
  archived: number;
  studentApproved: number;
  needsAttention: number;
}

export interface KnowledgeLibraryMaterialListItem {
  _id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  ownerRole: KnowledgeMaterialOwnerRole;
  sourceType: KnowledgeMaterialSourceType;
  visibility: KnowledgeMaterialVisibility;
  reviewStatus: KnowledgeMaterialReviewStatus;
  processingStatus: KnowledgeMaterialProcessingStatus;
  searchStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  subjectId: string;
  subjectName: string;
  level: string;
  topicLabel: string;
  topicId: string | null;
  labelSuggestions: string[];
  chunkCount: number;
  externalUrl: string | null;
  indexedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeMaterialSourceProof {
  originalFileState: "available" | "missing" | "orphaned";
  originalFileUrl: string | null;
  originalFileContentType: string | null;
  originalFileSize: number | null;
  originalFileNotice: string | null;
  extractedTextPreview: string | null;
  extractedTextChunkCount: number;
  indexedPageSummary: string | null;
}

export interface KnowledgeLibraryMaterialDetail extends KnowledgeLibraryMaterialListItem {
  schoolId: string;
  storageId: string | null;
  createdBy: string;
  updatedBy: string;
  searchText: string;
  ownerEmail: string | null;
  subjectCode: string | null;
  sourceProof: KnowledgeMaterialSourceProof;
}

export interface KnowledgeLibraryDetailResponse {
  material: KnowledgeLibraryMaterialDetail;
  storage: {
    _id: string;
    contentType: string | null;
    sha256: string;
    size: number;
  } | null;
  classBindings: Array<{
    _id: string;
    classId: string;
    className: string;
    bindingPurpose: "review_queue" | "supplemental_upload" | "topic_attachment";
    bindingStatus: "active" | "revoked";
    updatedAt: number;
  }>;
  auditEvents: Array<{
    _id: string;
    eventType:
      | "approved"
      | "promoted"
      | "published"
      | "rejected"
      | "archived"
      | "overridden"
      | "topic_attached"
      | "class_bound"
      | "visibility_changed"
      | "created"
      | "ingestion_started"
      | "extraction_completed"
      | "ocr_needed"
      | "ingestion_failed"
      | "retry_requested";
    changeSummary: string;
    createdAt: number;
    actorUserId: string;
    actorName: string;
    actorRole: KnowledgeMaterialOwnerRole;
    beforeVisibility: KnowledgeMaterialVisibility | null;
    afterVisibility: KnowledgeMaterialVisibility | null;
    beforeReviewStatus: KnowledgeMaterialReviewStatus | null;
    afterReviewStatus: KnowledgeMaterialReviewStatus | null;
    beforeTopicId: string | null;
    afterTopicId: string | null;
  }>;
}

export interface KnowledgeLibraryListResponse {
  summary: KnowledgeLibrarySummary;
  materials: KnowledgeLibraryMaterialListItem[];
}

export type KnowledgeLibrarySubject = SubjectRecord;
