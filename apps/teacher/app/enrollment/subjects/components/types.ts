export type SessionSummary = {
  _id: string;
  name: string;
};

export type ClassSummary = {
  _id: string;
  name: string;
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
