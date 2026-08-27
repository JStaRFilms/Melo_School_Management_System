"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { WorkspaceNavbar, MeloLoader, SchoolSuspendedLockScreen } from "@school/shared";
import { authClient } from "@/auth-client";

export default function AssessmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, signOut, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const schoolBranding = useQuery(
    "functions/academic/schoolBranding:getCurrentSchoolBranding" as never,
    isConvexConfigured() && isAuthenticated ? ({} as never) : ("skip" as never)
  ) as {
    name: string;
    logoUrl: string | null;
    status?: string;
    motto?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    theme: { primaryColor: string; accentColor: string };
  } | undefined;

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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 w-full">
        <MeloLoader message="Preparing your assessments workbench..." />
      </div>
    );
  }

  if (schoolBranding?.status === "suspended") {
    return (
      <SchoolSuspendedLockScreen
        school={schoolBranding}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <WorkspaceNavbar
      workspace="admin"
      currentPath={pathname}
      fullBleed={true}
      userName={session?.user?.name}
      userRole={session?.user?.role}
      schoolBranding={schoolBranding ?? null}
      onSignOut={handleSignOut}
      onChangePassword={authClient.changePassword}
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
