"use client";

import { redirect } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";
import { MeloLoader } from "@school/shared";

export default function HomePage() {
  const { isAuthenticated, isLoading, session, workspaceAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <MeloLoader message="Preparing your teacher workspace..." />
      </div>
    );
  }

  if (!isConvexConfigured) {
    redirect("/planning");
  }

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  if (session?.user?.role !== "teacher" && session?.user?.role !== "admin") {
    redirect("/sign-in?error=unauthorized");
  }

  if (workspaceAccess?.state === "ready") {
    const capabilities = workspaceAccess.effectiveCapabilities;
    if (capabilities.includes("academic.assessments.enter")) redirect("/assessments/exams/entry");
    if (capabilities.includes("academic.report_cards.preview")) redirect("/assessments/report-cards");
    if (
      capabilities.includes("academic.planning.use") ||
      capabilities.includes("academic.curriculum.manage")
    ) redirect("/planning");
    if (capabilities.includes("enrollment.intakes.manage")) redirect("/enrollment/subjects");
    if (workspaceAccess.compatibility.permissionManaged === false) {
      redirect("/planning");
    }
  }

  redirect("/sign-in?error=unauthorized");
}
