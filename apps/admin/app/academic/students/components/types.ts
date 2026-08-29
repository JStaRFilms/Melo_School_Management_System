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

export type GraduationStatus = {
  isGraduated: boolean;
  graduationDate?: number;
  certificateNumber?: string;
  honorsOrRemarks?: string;
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
    graduationStatus?: GraduationStatus;
  }>;
};

export type EnrollmentNotice = {
  tone: "success" | "error" | "warning";
  message: string;
};

export type PromotionSubjectMode =
  | "all_target_class_subjects"
  | "matching_previous_subjects"
  | "none";

export type AttestationData = {
  student: {
    _id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    admissionNumber: string;
    gender: string | null;
    dateOfBirth: number | null;
    enrollmentDate: number;
    enrollmentStatus: string;
    photoUrl: string | null;
    className: string;
    gradeName: string | null;
  };
  graduation: {
    graduationDate: number;
    certificateNumber: string | null;
    honorsOrRemarks: string | null;
    graduatingClassName: string;
    graduatingSessionName: string;
  } | null;
  school: {
    name: string;
    slug: string;
    motto: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    principalName: string | null;
  };
  issuedAt: number;
  referenceCode: string;
};

