export type ArchiveRecordType = "session" | "class" | "teacher" | "subject";

export interface ArchivedRecordItem {
  id: string;
  type: ArchiveRecordType;
  typeLabel: string;
  recordId: string;
  name: string;
  subtitle: string | null;
  archivedAt: number;
  createdAt: number;
  archivedById: string | null;
  archivedByName: string | null;
  statusNote: string;
  linkedHistory: string;
  detailFields: Array<{
    label: string;
    value: string;
  }>;
}

export interface ArchivedRecordsSummary {
  totalArchived: number;
  archivedSessions: number;
  archivedClasses: number;
  archivedTeachers: number;
  archivedSubjects: number;
}
