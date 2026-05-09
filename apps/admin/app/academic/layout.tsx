"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { api } from "@school/convex/_generated/api";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { WorkspaceNavbar } from "@school/shared";

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
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
        <div className="text-[#64748b]">Loading...</div>
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

  return (
    <WorkspaceNavbar
      workspace="admin"
      currentPath={currentPath}
      fullBleed={true}
      userName={userName}
      userRole={userRole}
      schoolBranding={schoolBranding ?? null}
      onSignOut={onSignOut}
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
