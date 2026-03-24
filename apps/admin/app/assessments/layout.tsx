"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

export default function AssessmentsLayout({
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - exact match from mockup */}
      <header className="bg-white border-b border-slate-200 py-4 px-4 sm:px-8 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center text-slate-500 lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-[10px]">
              OS
            </div>
            <span className="font-extrabold text-[12px] tracking-tight text-slate-900 hidden sm:inline">
              SCHOOL ADMIN
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600 border border-slate-200">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? "AD"}
          </div>
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub Navigation */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-8 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-6 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          <Link
            href="/assessments/setup/exam-recording"
            className="hover:text-slate-900 transition-colors"
          >
            Exam Recording
          </Link>
          <Link
            href="/assessments/setup/grading-bands"
            className="hover:text-slate-900 transition-colors"
          >
            Grading Bands
          </Link>
          <Link
            href="/assessments/results/entry"
            className="hover:text-slate-900 transition-colors"
          >
            Score Entry
          </Link>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
