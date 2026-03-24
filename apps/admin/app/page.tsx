"use client";

import { redirect } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

export default function HomePage() {
  const { isAuthenticated, isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isConvexConfigured()) {
    redirect("/assessments/setup/exam-recording");
  }

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  if (session?.user?.role !== "admin") {
    redirect("/sign-in?error=unauthorized");
  }

  redirect("/assessments/setup/exam-recording");
}
