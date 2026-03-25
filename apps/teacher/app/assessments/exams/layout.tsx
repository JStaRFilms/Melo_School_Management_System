"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceNavbar } from "@school/shared";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";

export default function ExamLayout({ children }: { children: ReactNode }) {
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

    if (session?.user?.role !== "teacher" && session?.user?.role !== "admin") {
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
      (session?.user?.role !== "teacher" && session?.user?.role !== "admin"))
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fbfbfc]">
        <div className="text-obsidian-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <WorkspaceNavbar
        workspace="teacher"
        currentPath={pathname}
        userName={session?.user?.name}
        userRole={session?.user?.role}
        onSignOut={handleSignOut}
        renderLink={(props) => (
          <Link key={props.href} href={props.href} className={props.className}>
            {props.children}
          </Link>
        )}
      />

      <main className="max-w-screen-xl mx-auto p-4 md:p-10">{children}</main>
    </div>
  );
}
