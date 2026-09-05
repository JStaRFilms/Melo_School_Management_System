"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { LeadershipAlerts } from "../app/admin/audit/LeadershipAlerts";
import {
  AuthoritativeForbiddenView, BranchSwitcher, MeloLoader, WorkspaceNavbar,
  getBranchScopedWorkspaceAccess, getLegacyWorkspaceAccess, getWorkspaceModuleDenial, getWorkspaceCapabilityDenial,
  isWorkspaceBranchScopedRoute, LEGACY_BRANCH_SWITCH_REASON,
} from "@school/shared";
import { useDepartureGuard } from "@school/shared/drafts";
import { useAuth } from "@/AuthProvider";
import { authClient } from "@/auth-client";
import { isConvexConfigured } from "@/convex-runtime";
import type { Id } from "@school/convex/_generated/dataModel";

/** Selected-school context is mounted only for the audited branch-scoped route allowlist. */
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
  const branchScopedRoute = isWorkspaceBranchScopedRoute("admin", pathname);
  const shellDecision = selectedSchoolId
    ? getBranchScopedWorkspaceAccess("admin", pathname, access)
    : getLegacyWorkspaceAccess("admin", access);
  const decision = shellDecision.state === "allowed" && !selectedSchoolId
    ? getWorkspaceCapabilityDenial("admin", pathname, access) ?? shellDecision
    : shellDecision;
  const canLoad = configured && !isLoading && isAuthenticated && decision.state === "allowed";
  const activeSchoolId = access?.state === "ready" ? access.branch.schoolId as Id<"schools"> : undefined;
  const schoolBranding = useQuery(
    api.functions.academic.schoolBranding.getCurrentSchoolBranding,
    canLoad && activeSchoolId ? (branchScopedRoute ? { schoolId: activeSchoolId } : {}) : "skip",
  );

  useEffect(() => {
    if (configured && !isLoading && decision.state === "unauthenticated") {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [configured, isLoading, decision.state, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    window.location.assign("/sign-in");
  };

  if (configured && (isLoading || decision.state === "loading" || (decision.state === "allowed" && schoolBranding === undefined))) {
    return <MeloLoader message="Checking workspace access…" />;
  }
  if (configured && decision.state !== "allowed" && decision.state !== "loading") {
    const canReturnToDefault = Boolean(selectedSchoolId);
    return <AuthoritativeForbiddenView
      moduleTitle="Admin workspace"
      state={decision.state}
      message={decision.message}
      returnLabel={canReturnToDefault ? "Return to default branch" : "Sign out / use another account"}
      onReturnToDashboard={() => canReturnToDefault ? clearSelectedSchool() : void handleSignOut()}
    />;
  }
  if (configured && (!schoolBranding || access?.state !== "ready" || schoolBranding.schoolId !== access.branch.schoolId || schoolBranding.status !== "active")) {
    return <AuthoritativeForbiddenView moduleTitle="Admin workspace" state="reconciliation_required" message="The default-school context could not be verified. No workspace data has been opened. Retry after your school administrator reviews access." returnLabel="Retry access check" onReturnToDashboard={() => window.location.reload()} />;
  }
  const moduleDenial = getWorkspaceModuleDenial("admin", pathname, schoolBranding?.features);
  return (
    <WorkspaceNavbar
      key={`${session?.user.id ?? "demo"}:${access?.state === "ready" ? access.branch.schoolId : "default"}`}
      workspace="admin"
      currentPath={pathname}
      fullBleed={fullBleed}
      userName={session?.user.name}
      userRole={session?.user.role}
      workspaceAccess={access}
      branchScopedOnly={Boolean(selectedSchoolId)}
      schoolBranding={schoolBranding ?? null}
      requestDeparture={requestDeparture}
      onSignOut={handleSignOut}
      onNavigate={href => router.push(href)}
      onChangePassword={authClient.changePassword}
      leadershipAlerts={configured && schoolBranding && access?.state === "ready" && (access.effectiveCapabilities.includes("audit.branch.view") || access.effectiveCapabilities.includes("audit.view")) ? <LeadershipAlerts schoolId={schoolBranding.schoolId} compact /> : undefined}
      branchSwitcher={access?.state === "ready" ? <BranchSwitcher
        currentBranch={availableBranches?.find(branch => branch.schoolId === access.branch.schoolId) ?? { ...access.branch, status: "active", isHeadquarters: false }}
        availableBranches={availableBranches ?? []}
        onSelectBranch={branchScopedRoute ? async target => {
          if (!await requestDeparture({ kind: "branch", schoolId: target.schoolId })) return false;
          selectSchool(target.schoolId);
          return true;
        } : undefined}
        disabled={!branchScopedRoute}
        disabledReason={branchScopedRoute ? undefined : LEGACY_BRANCH_SWITCH_REASON}
      /> : undefined}
      renderLink={props => <Link key={props.href} href={props.href} className={props.className}>{props.children}</Link>}
    >
      {moduleDenial?.state === "module_disabled" ? <AuthoritativeForbiddenView moduleTitle="This module" state="module_disabled" message={moduleDenial.message} onReturnToDashboard={() => router.push("/admin/dashboard")} /> : children}
    </WorkspaceNavbar>
  );
}
