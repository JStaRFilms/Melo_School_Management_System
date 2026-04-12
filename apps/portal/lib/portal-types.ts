import type { ReportCardSheetData } from "@school/shared";

export type PortalViewerRole = "parent" | "student";

export interface PortalStudentOption {
  studentId: string;
  userId: string;
  name: string;
  admissionNumber: string;
  classId: string;
  className: string;
  relationship: string | null;
  photoUrl: string | null;
  isActive: boolean;
}

export interface PortalHistoryItem {
  sessionId: string;
  termId: string;
  sessionName: string;
  termName: string;
  classId: string;
  className: string;
  generatedAt: number;
  totalSubjects: number;
  recordedSubjects: number;
  pendingSubjects: number;
  averageScore: number | null;
  totalScore: number;
  resultCalculationMode: "standalone" | "cumulative_annual";
  href: string;
  note: string | null;
}

export interface PortalNotificationItem {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning";
  href: string | null;
}

export interface PortalWorkspaceData {
  school: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  viewer: {
    userId: string;
    name: string;
    role: PortalViewerRole;
    schoolId: string;
  };
  students: PortalStudentOption[];
  selectedStudentId: string | null;
  selectedSessionId: string | null;
  selectedTermId: string | null;
  selectedStudent: PortalStudentOption | null;
  activeSession: {
    id: string;
    name: string;
  } | null;
  activeTerm: {
    id: string;
    name: string;
  } | null;
  selectedReportCard: ReportCardSheetData | null;
  history: PortalHistoryItem[];
  notifications: PortalNotificationItem[];
}

export interface PortalWorkspaceArgs {
  studentId?: string | null;
  sessionId?: string | null;
  termId?: string | null;
  historyLimit?: number;
}

export type PortalWorkspaceMode =
  | "dashboard"
  | "report-cards"
  | "results"
  | "notifications";
