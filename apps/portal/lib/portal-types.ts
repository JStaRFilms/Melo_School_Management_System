import type { ReportCardSheetData } from "@school/shared";

export type PortalViewerRole = "parent" | "student";

export interface PortalStudentOption {
  studentId: string;
  userId: string;
  name: string;
  admissionNumber: string;
  classId: string;
  className: string;
  schoolId: string;
  schoolName: string;
  schoolLogoUrl: string | null;
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
    theme: {
      primaryColor: string;
      accentColor: string;
    };
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

export interface PortalBillingInvoice {
  invoiceId: string;
  studentId: string;
  invoiceNumber: string;
  feePlanName: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: number;
  issuedAt: number;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "waived" | "cancelled";
  canPayOnline: boolean;
  lineItems: Array<{
    id: string;
    label: string;
    amount: number;
    category: string;
    order: number;
  }>;
  notes: string | null;
}

export interface PortalBillingPayment {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  reference: string;
  gatewayReference: string | null;
  provider: string | null;
  paymentMethod: string;
  amountApplied: number;
  amountReceived: number;
  status: string;
  reconciliationStatus: string;
  receivedAt: number;
  notes: string | null;
}

export interface PortalBillingData {
  selectedStudentId: string | null;
  school: {
    id: string;
    name: string;
  };
  settings: {
    allowOnlinePayments: boolean;
    preferredProvider: string | null;
    defaultCurrency: string;
  };
  householdSummary: {
    studentCount: number;
    invoiceCount: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
  };
  studentSummary: {
    invoiceCount: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
  };
  invoices: PortalBillingInvoice[];
  payments: PortalBillingPayment[];
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
  | "notifications"
  | "billing";
