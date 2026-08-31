import React from "react";
import { Users, Phone, Mail, CheckCircle2, User } from "lucide-react";
import { StagedStudentRow } from "./RosterReviewTab";

export interface HouseholdReviewTabProps {
  records: StagedStudentRow[];
}

interface FamilyGroup {
  clusterKey: string;
  guardianPhone?: string;
  guardianName?: string;
  guardianEmail?: string;
  students: StagedStudentRow[];
}

export function HouseholdReviewTab({ records }: HouseholdReviewTabProps) {
  // Group students by familyClusterKey
  const familyMap = new Map<string, FamilyGroup>();
  const unassignedStudents: StagedStudentRow[] = [];

  records.forEach((rec) => {
    if (rec.parsedData.guardianPhone) {
      const key = rec.parsedData.guardianPhone;
      if (!familyMap.has(key)) {
        familyMap.set(key, {
          clusterKey: key,
          guardianPhone: rec.parsedData.guardianPhone,
          guardianName: rec.parsedData.guardianName || `${rec.parsedData.lastName} Household`,
          guardianEmail: rec.parsedData.guardianEmail,
          students: [],
        });
      }
      familyMap.get(key)!.students.push(rec);
    } else {
      unassignedStudents.push(rec);
    }
  });

  const families = Array.from(familyMap.values());
  const multiStudentFamilies = families.filter((f) => f.students.length > 1);
  const singleStudentFamilies = families.filter((f) => f.students.length === 1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Detected Sibling Households
          </span>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">
            {multiStudentFamilies.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Groups of 2+ students sharing guardian contacts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Single Student Households
          </span>
          <div className="text-2xl font-extrabold text-slate-800 mt-1">
            {singleStudentFamilies.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Individual student households</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Missing Guardian Phone
          </span>
          <div className="text-2xl font-extrabold text-slate-500 mt-1">
            {unassignedStudents.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Students with no phone clustering</p>
        </div>
      </div>

      {/* Sibling Clusters Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Sibling Households ({multiStudentFamilies.length})
          </h3>
        </div>

        {multiStudentFamilies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No multiple-student sibling households detected in this dataset.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {multiStudentFamilies.map((fam, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-indigo-100 bg-indigo-50/20 p-5 shadow-xs space-y-3.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{fam.guardianName}</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {fam.students.length} Siblings
                      </span>
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      {fam.guardianPhone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {fam.guardianPhone}
                        </span>
                      )}
                      {fam.guardianEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {fam.guardianEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Auto-Linked
                  </span>
                </div>

                <div className="divide-y divide-indigo-100/60 rounded-xl border border-indigo-100/80 bg-white">
                  {fam.students.map((student) => (
                    <div
                      key={student._id}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {student.parsedData.firstName}{" "}
                            {student.parsedData.middleName ? `${student.parsedData.middleName} ` : ""}
                            {student.parsedData.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Row #{student.rowNumber} • Class:{" "}
                            <span className="font-semibold text-slate-700">
                              {student.parsedData.className}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-[11px] text-slate-500">
                          {student.parsedData.admissionNumber || "Auto-ID"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
