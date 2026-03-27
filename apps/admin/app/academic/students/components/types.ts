export type ClassSummary = {
  _id: string;
  name: string;
  level: string;
};

export type SessionSummary = {
  _id: string;
  name: string;
  isActive: boolean;
};

export type EnrollmentMatrix = {
  subjects: Array<{ _id: string; name: string; code: string }>;
  students: Array<{
    _id: string;
    studentName: string;
    admissionNumber: string;
    selectedSubjectIds: string[];
  }>;
};

export type EnrollmentNotice = {
  tone: "success" | "error" | "warning";
  message: string;
};
