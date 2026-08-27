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
import { Lock } from "lucide-react";

export default function BillingLayout({
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
    features?: { billing: boolean; curriculum: boolean; knowledgeLibrary: boolean; admissions: boolean };
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

  if (
    isConvexConfigured() &&
    (isLoading || !isAuthenticated || session?.user?.role !== "admin")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 w-full">
        <MeloLoader message="Preparing your billing panel..." />
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

  if (schoolBranding?.features && schoolBranding.features.billing === false) {
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100 shadow-xs">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Finance & Invoicing Module Inactive</h2>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
            The Billing module is currently disabled for this school tenant. Please contact your platform administrator to activate this workspace feature.
          </p>
          <Link
            href="/admin/dashboard"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      </WorkspaceNavbar>
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
