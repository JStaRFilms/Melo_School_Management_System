"use client";

import { redirect } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";
import { MeloLoader } from "@school/shared";

export default function HomePage() {
  const { isAuthenticated, isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <MeloLoader message="Preparing your teacher workspace..." />
      </div>
    );
  }

  if (!isConvexConfigured) {
    redirect("/assessments/exams/entry");
  }

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  if (session?.user?.role !== "teacher" && session?.user?.role !== "admin") {
    redirect("/sign-in?error=unauthorized");
  }

  redirect("/assessments/exams/entry");
}
