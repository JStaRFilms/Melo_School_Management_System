"use client";

import { useEffect, useState } from "react";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { StudentProfileEditor } from "./StudentProfileEditor";
import type { EnrollmentMatrix, ClassSummary, EnrollmentNotice } from "./types";

interface StudentUnifiedEditorSheetProps {
  activeStudent: EnrollmentMatrix["students"][number] | null;
  subjects: EnrollmentMatrix["subjects"];
  totalSubjects: number;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
  onStudentArchived?: (studentId: string) => void;
  onViewAttestation?: (studentId: string) => void;
  initialTab?: "subjects" | "profile" | "family";
  canEditSubjects?: boolean;
}

export function StudentUnifiedEditorSheet({ activeStudent, subjects, totalSubjects, isOpen, onClose, onToggle, onSetStudentSubjects, classes, onNotice, onStudentArchived, onViewAttestation, initialTab = "profile", canEditSubjects = false }: StudentUnifiedEditorSheetProps) {
  const [tab, setTab] = useState<"subjects" | "profile" | "family">(initialTab);
  useEffect(() => { if (isOpen) setTab(initialTab); }, [isOpen, initialTab]);
  return <AdminSheet isOpen={isOpen && Boolean(activeStudent)} onClose={onClose} title={activeStudent?.studentName ?? "Student profile"} description={activeStudent ? `Admission number ${activeStudent.admissionNumber}` : undefined}>
    {activeStudent && <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2" aria-label="Student editor sections">{(["profile", "family", "subjects"] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} className="min-h-11 rounded-lg border px-3 text-sm capitalize" onClick={() => setTab(value)}>{value}</button>)}</div>
      {tab === "subjects" && canEditSubjects ? <div className="space-y-3">
        <p className="text-sm">Active roster subjects, {activeStudent.selectedSubjectIds.length} of {totalSubjects}. Changes save immediately.</p>
        <div className="flex gap-2"><button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => onSetStudentSubjects(activeStudent._id, subjects.map(s => s._id))}>Select all</button><button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => onSetStudentSubjects(activeStudent._id, [])}>Clear selection</button></div>
        {subjects.map(subject => <label key={subject._id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={activeStudent.selectedSubjectIds.includes(subject._id)} onChange={() => onToggle(activeStudent._id, subject._id)} />{subject.name}</label>)}
      </div> : <>
        {tab === "subjects" && <p className="text-sm">Subject editing requires the selected student&apos;s active class/session roster. Inactive students review placement and subjects through Reinstate or Re-enroll below.</p>}
        <StudentProfileEditor studentId={activeStudent._id} classes={classes} onNotice={onNotice} onStudentArchived={onStudentArchived} onViewAttestation={onViewAttestation} variant="sheet" activeTab={tab === "family" ? "family" : "profile"} onTabChange={setTab} />
      </>}
    </div>}
  </AdminSheet>;
}
