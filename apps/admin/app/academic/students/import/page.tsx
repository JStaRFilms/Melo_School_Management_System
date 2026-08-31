"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { DataMigrationWorkbench, MeloLoader } from "@school/shared";
import { useRouter } from "next/navigation";

export default function AcademicStudentImportPage() {
  const router = useRouter();
  const schoolBranding = useQuery(
    api.functions.academic.schoolBranding.getCurrentSchoolBranding,
    {}
  );

  if (schoolBranding === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <MeloLoader message="Loading school migration engine..." />
      </div>
    );
  }

  if (!schoolBranding) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
        <h2 className="text-base font-bold text-slate-800">School Membership Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          You must be an active school admin to access the data migration workbench.
        </p>
      </div>
    );
  }

  return (
    <DataMigrationWorkbench
      schoolId={schoolBranding.schoolId}
      mode="school_admin"
      onSuccess={() => {
        router.push("/academic/students");
      }}
    />
  );
}
