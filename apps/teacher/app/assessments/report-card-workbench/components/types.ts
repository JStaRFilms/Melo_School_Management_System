export type SelectorOption = {
  id: string;
  name: string;
};

export type StudentOption = {
  id: string;
  name: string;
  admissionNumber: string;
};

export type WorkbenchSelection = {
  sessionId: string | null;
  termId: string | null;
  classId: string | null;
  studentId: string | null;
};

export type SubjectMatrix = {
  subjects: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  students: Array<{
    _id: string;
    studentName: string;
    admissionNumber: string;
    selectedSubjectIds: string[];
  }>;
};
