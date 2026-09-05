"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { AuthoritativeForbiddenView, WorkspaceNavbar, MeloLoader, SchoolSuspendedLockScreen } from "@school/shared";
import { authClient } from "@/auth-client";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

export default function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, signOut, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const canAccessPortal = useQuery(
    "functions/portal:canAccessPortal" as never,
    isConvexConfigured() && isAuthenticated ? ({} as never) : ("skip" as never)
  ) as boolean | undefined;
  const schoolBranding = useQuery(
    "functions/academic/schoolBranding:getCurrentSchoolBranding" as never,
    isConvexConfigured() && isAuthenticated && canAccessPortal === true ? ({} as never) : ("skip" as never)
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
  }, [isAuthenticated, isLoading, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  if (isConvexConfigured() && !isLoading && isAuthenticated && canAccessPortal === false) {
    return <AuthoritativeForbiddenView moduleTitle="Family portal" message="This account is not linked to an accessible student or family. Staff branch membership does not grant family portal access." returnLabel="Sign out / use another account" onReturnToDashboard={() => void handleSignOut()} />;
  }

  if (
    isConvexConfigured() &&
    (isLoading ||
      !isAuthenticated ||
      canAccessPortal === undefined ||
      !canAccessPortal ||
      schoolBranding === undefined)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 w-full">
        <MeloLoader message="Preparing your portal..." />
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
      workspace="portal"
      currentPath={pathname}
      fullBleed={true}
      userName={session?.user?.name}
      userRole={session?.user?.role}
      schoolBranding={schoolBranding ?? null}
      onSignOut={handleSignOut}
      onNavigate={href => router.push(href)}
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
