"use client";

import { redirect } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";
import { StaffWorkspace } from "@/lib/StaffWorkspace";
import { MeloLoader } from "@school/shared";

export default function HomePage() {
  const { isAuthenticated, isLoading, session, workspaceAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
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

  const userName = session.user.name?.trim() || "Teacher";
  const schoolName = workspaceAccess?.state === "ready"
    ? workspaceAccess.branch.name
    : "your school";

  return (
    <StaffWorkspace>
      <section className="mx-auto w-full max-w-5xl px-6 py-10" aria-labelledby="teacher-dashboard-title">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--school-primary)]">
          Teacher workspace
        </p>
        <h1 id="teacher-dashboard-title" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Welcome, {userName}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          You are logged in to {schoolName}. Use the navigation to open the tools currently available to your account.
        </p>
      </section>
    </StaffWorkspace>
  );
}
