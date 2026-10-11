"use client";

import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  AuthoritativeForbiddenView,
  WorkspaceNavbar,
  MeloLoader,
  SchoolSuspendedLockScreen,
  getWorkspaceModuleDenial,
} from "@school/shared";
import { authClient } from "@/auth-client";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

function withStudentContext(href: string, studentId: Id<"students">) {
  const url = new URL(href, "http://portal.local");
  url.searchParams.set("studentId", String(studentId));
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-slate-50"><MeloLoader message="Preparing your portal..." /></div>}>
      <PortalLayoutContent>{children}</PortalLayoutContent>
    </Suspense>
  );
}

function PortalLayoutContent({ children }: { children: ReactNode }) {
  const { signOut, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("studentId");
  const canAccessPortal = useQuery(api.functions.portal.canAccessPortal,
    isConvexConfigured() && isAuthenticated ? {} : "skip");
  const shellContext = useQuery(api.functions.portal.getPortalShellContext,
    isConvexConfigured() && isAuthenticated && canAccessPortal === true
      ? { studentId: selectedStudentId ? selectedStudentId as Id<"students"> : null }
      : "skip");
  const authorizedWorkspace = useQuery(api.functions.portal.getWorkspaceData,
    isConvexConfigured() && isAuthenticated && shellContext ? { studentId: shellContext.selectedStudentId } : "skip");
  const schoolBranding = useQuery(api.functions.academic.schoolBranding.getCurrentSchoolBranding,
    isConvexConfigured() && isAuthenticated && shellContext ? { schoolId: shellContext.schoolId } : "skip");

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
      shellContext === undefined ||
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

  const moduleDenial = getWorkspaceModuleDenial(
    "portal",
    pathname,
    schoolBranding?.features,
  );

  return (
    <WorkspaceNavbar
      workspace="portal"
      currentPath={pathname}
      fullBleed={true}
      userName={authorizedWorkspace?.viewer.name}
      userRole={authorizedWorkspace?.viewer.role}
      schoolBranding={schoolBranding ?? null}
      onSignOut={handleSignOut}
      onNavigate={href => router.push(href)}
      onChangePassword={authClient.changePassword}
      renderLink={(props) => {
        const href = shellContext
          ? withStudentContext(props.href, shellContext.selectedStudentId)
          : props.href;
        return (
          <Link key={href} href={href} className={props.className}>
            {props.children}
          </Link>
        );
      }}
    >
      {moduleDenial?.state === "module_disabled" ? (
        <AuthoritativeForbiddenView
          moduleTitle="This module"
          state="module_disabled"
          message={moduleDenial.message}
          onReturnToDashboard={() => router.push("/")}
        />
      ) : (
        children
      )}
    </WorkspaceNavbar>
  );
}
