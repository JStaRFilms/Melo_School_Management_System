export interface TeacherLibrarySummary {
  loaded: number;
  privateOwner: number;
  staffVisible: number;
  readyToSelect: number;
  publishable: number;
  needsAttention: number;
}

export interface TeacherLibraryMaterial {
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
  subjectId: string | null;
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
  selectedPageRanges: string | null;
  selectedPageNumbers: number[] | null;
  pdfPageCount: number | null;
  sourceFileMode: "original" | "selected_pages" | null;
  sourcePdfPageCount: number | null;
  createdAt: number;
  updatedAt: number;
  isOwnedByMe: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canSelectAsSource: boolean;
}

export interface TeacherKnowledgeTopic {
  _id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  level: string;
  termId: string;
  status: "draft" | "active" | "retired";
}

export interface TeacherLibraryResponse {
  summary: TeacherLibrarySummary;
  materials: TeacherLibraryMaterial[];
}

export interface TeacherLibrarySubject {
  id: string;
  name: string;
  code: string;
}

export interface TeacherLibraryClassSummary {
  _id: string;
  name: string;
  gradeName?: string;
  classLabel?: string;
}

export interface LevelOption {
  value: string;
  label: string;
}

export interface UploadNotice {
  tone: "success" | "error";
  message: string;
}

export interface MaterialDraft {
  materialId: string;
  title: string;
  description: string;
  subjectId: string | null;
  level: string;
  topicLabel: string;
  topicId: string | null;
}

export interface TeacherKnowledgeMaterialSourceProof {
  originalFileState: "available" | "missing" | "orphaned";
  originalFileUrl: string | null;
  originalFileContentType: string | null;
  originalFileSize: number | null;
  originalFileNotice: string | null;
  extractedTextPreview: string | null;
  extractedTextChunkCount: number;
  indexedPageSummary: string | null;
}

export interface TeacherKnowledgeMaterialSourceProofResponse {
  materialId: string;
  sourceProof: TeacherKnowledgeMaterialSourceProof;
}

export type UploadIntent = "private_draft" | "request_review" | "staff_shared";
