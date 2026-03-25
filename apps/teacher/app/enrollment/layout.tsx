"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
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
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* HEADER - Exact match from teacher mockup */}
      <header className="bg-white border-b border-[#e2e8f0] py-3.5 px-4 sm:px-6 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center text-[#94a3b8]">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-[10px] tracking-tight text-[#0f172a] uppercase">Subject Enrollment</span>
            <span className="text-[8px] font-bold text-[#94a3b8] uppercase tracking-[0.15em] mt-0.5">Teacher Edit Mode</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f8fafc] flex items-center justify-center font-bold text-[10px] text-[#475569] border border-[#e2e8f0] uppercase">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? "T"}
          </div>
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b] hover:bg-[#e2e8f0] transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub Navigation */}
      <nav className="bg-white border-b border-[#f1f5f9] px-4 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
          <Link
            href="/assessments/exams"
            className="hover:text-[#0f172a] transition-colors whitespace-nowrap"
          >
            Exams
          </Link>
          <Link
            href="/enrollment/subjects"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/enrollment/subjects") ? "text-[#0f172a]" : ""
            }`}
          >
            Subject Selection
          </Link>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
