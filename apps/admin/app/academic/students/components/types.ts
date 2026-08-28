export type ClassSummary = {
  _id: string;
  name: string;
  level: string;
};

export type SessionSummary = {
  _id: string;
  name: string;
  startDate?: number;
  endDate?: number;
  isActive: boolean;
};

export type TermSummary = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  reportCardCalculationMode: "standalone" | "cumulative_annual";
};

export type PromotionStatus = {
  isPromoted: boolean;
  targetClassId?: string;
  targetClassName?: string;
  targetSessionId?: string;
  targetSessionName?: string;
  promotedAt?: number;
} | null;

export type EnrollmentMatrix = {
  subjects: Array<{ _id: string; name: string; code: string }>;
  students: Array<{
    _id: string;
    studentName: string;
    admissionNumber: string;
    photoUrl: string | null;
    selectedSubjectIds: string[];
    promotionStatus?: PromotionStatus;
  }>;
};

export type EnrollmentNotice = {
  tone: "success" | "error" | "warning";
  message: string;
};
