"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { api } from "@school/convex/_generated/api";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { WorkspaceNavbar, MeloLoader } from "@school/shared";
import { authClient } from "@/auth-client";
import { Lock } from "lucide-react";

export default function AcademicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, signOut, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!isConvexConfigured() || isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (session?.user?.role !== "admin") {
      router.replace("/sign-in?error=unauthorized");
    }
  }, [isAuthenticated, isLoading, pathname, router, session]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };


  if (isConvexConfigured() && (isLoading || !isAuthenticated || session?.user?.role !== "admin")) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] w-full">
        <MeloLoader message="Preparing your academic workspace..." />
      </div>
    );
  }

  if (!isConvexConfigured()) {
    return (
      <WorkspaceNavbar
        workspace="admin"
        currentPath={pathname}
        fullBleed={true}
        userName={session?.user?.name}
        userRole={session?.user?.role}
        schoolBranding={null}
        onSignOut={handleSignOut}
        renderLink={(props) => (
          <Link key={props.href} href={props.href} className={props.className}>
            {props.children}
          </Link>
        )}
      >
        {children}
      </WorkspaceNavbar>
    );
  }

  return (
    <AcademicWorkspaceNavbar
      currentPath={pathname}
      userName={session?.user?.name}
      userRole={session?.user?.role}
      onSignOut={handleSignOut}
    >
      {children}
    </AcademicWorkspaceNavbar>
  );
}

function AcademicWorkspaceNavbar({
  children,
  currentPath,
  userName,
  userRole,
  onSignOut,
}: {
  children: ReactNode;
  currentPath: string;
  userName?: string | null;
  userRole?: string | null;
  onSignOut: () => void;
}) {
  const schoolBranding = useQuery(
    api.functions.academic.schoolBranding.getCurrentSchoolBranding,
    {}  );

  const isCurriculumDisabled =
    currentPath.startsWith("/academic/knowledge/curriculum") &&
    schoolBranding?.features &&
    schoolBranding.features.curriculum === false;

  const isKnowledgeLibraryDisabled =
    currentPath.startsWith("/academic/knowledge/library") &&
    schoolBranding?.features &&
    schoolBranding.features.knowledgeLibrary === false;

  const isModuleDisabled = isCurriculumDisabled || isKnowledgeLibraryDisabled;

  return (
    <WorkspaceNavbar
      workspace="admin"
      currentPath={currentPath}
      fullBleed={true}
      userName={userName}
      userRole={userRole}
      schoolBranding={schoolBranding ?? null}
      onSignOut={onSignOut}
      onChangePassword={authClient.changePassword}
      renderLink={(props) => (
        <Link key={props.href} href={props.href} className={props.className}>
          {props.children}
        </Link>
      )}
    >
      {isModuleDisabled ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100 shadow-xs">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {isCurriculumDisabled ? "Curriculum Planning Module Inactive" : "AI Knowledge Library Inactive"}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
            This module is currently turned off on your school's workspace configuration. Contact your platform manager if you require access.
          </p>
          <Link
            href="/admin/dashboard"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : (
        children
      )}
    </WorkspaceNavbar>
  );
}
