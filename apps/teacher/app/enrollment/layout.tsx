"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceNavbar } from "@school/shared";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";

export default function EnrollmentLayout({
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
  ) as { name: string; logoUrl: string | null; theme: { primaryColor: string; accentColor: string } } | undefined;

  useEffect(() => {
    if (!isConvexConfigured() || isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (
      session?.user?.role !== "teacher" &&
      session?.user?.role !== "admin"
    ) {
      router.replace("/sign-in?error=unauthorized");
    }
  }, [isAuthenticated, isLoading, pathname, router, session]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };


  if (
    isConvexConfigured() &&
    (isLoading ||
      !isAuthenticated ||
      (session?.user?.role !== "teacher" &&
        session?.user?.role !== "admin"))
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  return (
    <WorkspaceNavbar
      workspace="teacher"
      currentPath={pathname}
      userName={session?.user?.name}
      userRole={session?.user?.role}
      schoolBranding={schoolBranding ?? null}
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
