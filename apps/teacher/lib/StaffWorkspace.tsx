"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  AuthoritativeForbiddenView, BranchSwitcher, MeloLoader, WorkspaceNavbar,
  getBranchScopedWorkspaceAccess, getLegacyWorkspaceAccess, getWorkspaceModuleDenial,
  getWorkspaceCapabilityDenial, isWorkspaceBranchScopedRoute, LEGACY_BRANCH_SWITCH_REASON,
} from "@school/shared";
import { useDepartureGuard } from "@school/shared/drafts";
import { useAuth } from "@/lib/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { isConvexConfigured } from "@/lib/convex-runtime";

/** Selected-school context is mounted only for fully explicit, assignment-checked teacher routes. */
export function StaffWorkspace({ children, fullBleed = false }: { children: ReactNode; fullBleed?: boolean }) {
  const {
    session, workspaceAccess, availableBranches, selectedSchoolId, selectSchool,
    clearSelectedSchool, isAuthenticated, isLoading, signOut,
  } = useAuth();
  const { requestDeparture } = useDepartureGuard();
  const pathname = usePathname();
  const router = useRouter();
  const configured = isConvexConfigured();
  const access = !isLoading && !isAuthenticated ? { state: "unauthenticated" as const } : workspaceAccess;
  const branchScopedRoute = isWorkspaceBranchScopedRoute("teacher", pathname);
  const shellDecision = selectedSchoolId
    ? getBranchScopedWorkspaceAccess("teacher", pathname, access)
    : getLegacyWorkspaceAccess("teacher", access);
  const capabilityDecision = shellDecision.state === "allowed" && !selectedSchoolId
    ? getWorkspaceCapabilityDenial("teacher", pathname, access) ?? shellDecision
    : shellDecision;
  const activeSchoolId = access?.state === "ready" ? access.branch.schoolId as Id<"schools"> : undefined;
  const canLoad = configured && !isLoading && isAuthenticated && capabilityDecision.state === "allowed";
  const assignedClasses = useQuery(
    api.functions.academic.teacherSelectors.getTeacherAssignableClasses,
    canLoad && branchScopedRoute && activeSchoolId ? { schoolId: activeSchoolId } : "skip",
  );
  const assignmentDenied = branchScopedRoute && assignedClasses !== undefined && assignedClasses.length === 0;
  const schoolBranding = useQuery(
    api.functions.academic.schoolBranding.getCurrentSchoolBranding,
    canLoad && activeSchoolId ? (branchScopedRoute ? { schoolId: activeSchoolId } : {}) : "skip",
  );

  useEffect(() => {
    if (configured && !isLoading && capabilityDecision.state === "unauthenticated") {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [configured, isLoading, capabilityDecision.state, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    window.location.assign("/sign-in");
  };

  if (configured && (isLoading || capabilityDecision.state === "loading" ||
    (branchScopedRoute && capabilityDecision.state === "allowed" && assignedClasses === undefined) ||
    (capabilityDecision.state === "allowed" && schoolBranding === undefined))) {
    return <MeloLoader message="Checking workspace access…" />;
  }
  if (configured && capabilityDecision.state !== "allowed" && capabilityDecision.state !== "loading") {
    const canReturnToDefault = Boolean(selectedSchoolId);
    return <AuthoritativeForbiddenView
      moduleTitle="Teacher workspace"
      state={capabilityDecision.state}
      message={capabilityDecision.message}
      returnLabel={canReturnToDefault ? "Return to default branch" : "Sign out / use another account"}
      onReturnToDashboard={() => canReturnToDefault ? clearSelectedSchool() : void handleSignOut()}
    />;
  }
  if (configured && (!schoolBranding || access?.state !== "ready" || schoolBranding.schoolId !== access.branch.schoolId || schoolBranding.status !== "active")) {
    return <AuthoritativeForbiddenView moduleTitle="Teacher workspace" state="reconciliation_required" message="The active school context could not be verified. No workspace data has been opened. Retry after your school administrator reviews access." returnLabel="Retry access check" onReturnToDashboard={() => window.location.reload()} />;
  }
  const moduleDenial = getWorkspaceModuleDenial("teacher", pathname, schoolBranding?.features);
  return (
    <WorkspaceNavbar
      key={`${session?.user.id ?? "demo"}:${access?.state === "ready" ? access.branch.schoolId : "default"}`}
      workspace="teacher"
      currentPath={pathname}
      fullBleed={fullBleed}
      userName={session?.user.name}
      userRole={session?.user.role}
      workspaceAccess={access}
      branchScopedOnly={Boolean(selectedSchoolId)}
      teacherHasAssignments={!assignmentDenied}
      schoolBranding={schoolBranding ?? null}
      requestDeparture={requestDeparture}
      onSignOut={handleSignOut}
      onNavigate={href => router.push(href)}
      onChangePassword={authClient.changePassword}
      branchSwitcher={access?.state === "ready" ? <BranchSwitcher
        currentBranch={availableBranches?.find(branch => branch.schoolId === access.branch.schoolId) ?? { ...access.branch, status: "active", isHeadquarters: false }}
        availableBranches={availableBranches ?? []}
        onSelectBranch={branchScopedRoute ? async target => {
          if (!await requestDeparture({ kind: "branch", schoolId: target.schoolId })) return false;
          selectSchool(target.schoolId);
          router.replace(pathname);
          return true;
        } : undefined}
        disabled={!branchScopedRoute}
        disabledReason={branchScopedRoute ? undefined : LEGACY_BRANCH_SWITCH_REASON}
      /> : undefined}
      renderLink={props => <Link key={props.href} href={props.href} className={props.className}>{props.children}</Link>}
    >
      {assignmentDenied ? <AuthoritativeForbiddenView
        moduleTitle="Teacher workspace"
        state="forbidden"
        message="This branch has no active class assignment for your teacher account. No class, student, or assessment data was opened."
        returnLabel={selectedSchoolId ? "Return to default branch" : "Sign out / use another account"}
        onReturnToDashboard={() => selectedSchoolId ? clearSelectedSchool() : void handleSignOut()}
      /> : moduleDenial?.state === "module_disabled" ? <AuthoritativeForbiddenView moduleTitle="This module" state="module_disabled" message={moduleDenial.message} onReturnToDashboard={() => router.push("/assessments/exams/entry")} /> : children}
    </WorkspaceNavbar>
  );
}
