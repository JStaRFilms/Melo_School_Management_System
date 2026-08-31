"use client";

import React, { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { DataMigrationWorkbench, MeloLoader } from "@school/shared";
import { Id } from "@school/convex/_generated/dataModel";

function PlatformMigrationContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.schoolId || params?.id) as string;

  if (!rawId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <MeloLoader message="Locating school..." />
      </div>
    );
  }

  const schoolId = rawId as Id<"schools">;

  return (
    <DataMigrationWorkbench
      schoolId={schoolId}
      mode="super_admin"
      onSuccess={() => {
        router.push("/schools");
      }}
    />
  );
}

export default function PlatformSchoolMigrationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <MeloLoader message="Preparing platform migration workbench..." />
        </div>
      }
    >
      <PlatformMigrationContent />
    </Suspense>
  );
}
