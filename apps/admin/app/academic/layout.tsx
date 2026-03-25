"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

export default function AcademicLayout({
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
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  const getHeaderTitle = () => {
    if (pathname.includes("/teachers")) return "Staff Directory";
    if (pathname.includes("/sessions")) return "Academic Config";
    if (pathname.includes("/subjects")) return "Academic Config";
    if (pathname.includes("/classes")) return "Architecture";
    if (pathname.includes("/students")) return "Student Enrollment";
    return "Academic Setup";
  };

  const getHeaderSubtitle = () => {
    if (pathname.includes("/teachers")) return "Teacher Management";
    if (pathname.includes("/sessions")) return "Sessions, Terms & Subjects";
    if (pathname.includes("/subjects")) return "Sessions, Terms & Subjects";
    if (pathname.includes("/classes")) return "Class & Subject Offerings";
    if (pathname.includes("/students")) return "Academic Enrollment Matrix";
    return "";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* HEADER - Exact match from mockup */}
      <header className="bg-white border-b border-[#e2e8f0] py-3.5 px-4 sm:px-6 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center text-[#94a3b8]">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-[10px] tracking-tight text-[#0f172a] uppercase">{getHeaderTitle()}</span>
            <span className="text-[8px] font-bold text-[#94a3b8] uppercase tracking-[0.15em] mt-0.5">{getHeaderSubtitle()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f8fafc] flex items-center justify-center font-bold text-[10px] text-[#475569] border border-[#e2e8f0] uppercase">AD</div>
        </div>
      </header>

      {/* Sub Navigation - Matching mockup style */}
      <nav className="bg-white border-b border-[#f1f5f9] px-4 sm:px-6 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.15em] text-[#94a3b8] overflow-x-auto">
          <Link
            href="/academic/teachers"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/academic/teachers") ? "text-[#0f172a]" : ""
            }`}
          >
            Teachers
          </Link>
          <Link
            href="/academic/sessions"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/academic/sessions") ? "text-[#0f172a]" : ""
            }`}
          >
            Sessions
          </Link>
          <Link
            href="/academic/subjects"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/academic/subjects") ? "text-[#0f172a]" : ""
            }`}
          >
            Subjects
          </Link>
          <Link
            href="/academic/classes"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/academic/classes") ? "text-[#0f172a]" : ""
            }`}
          >
            Classes
          </Link>
          <Link
            href="/academic/students"
            className={`hover:text-[#0f172a] transition-colors whitespace-nowrap ${
              pathname.includes("/academic/students") ? "text-[#0f172a]" : ""
            }`}
          >
            Students
          </Link>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
