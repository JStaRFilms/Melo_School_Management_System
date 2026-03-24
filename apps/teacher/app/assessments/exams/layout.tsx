"use client";

import { ReactNode, useEffect } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isConvexConfigured } from "@/lib/convex-runtime";

export default function ExamLayout({ children }: { children: ReactNode }) {
  const { session, signOut, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isConvexConfigured || isLoading) {
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
    isConvexConfigured &&
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
      {/* Compact Top Nav - exact match from mockup */}
      <nav className="compact-nav sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-obsidian-950 rounded flex items-center justify-center text-white text-[10px] font-black italic">
              OS
            </div>
            <span className="text-sm font-bold tracking-tight">OS/SCHOOL</span>
          </div>
          <div className="h-4 w-[1px] bg-obsidian-200" />
          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold editorial-spacing text-obsidian-400">
            <span className="hover:text-indigo-600 cursor-pointer">Teacher</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-obsidian-900">Exam Recording</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold editorial-spacing text-obsidian-400 leading-none">
              {session?.user?.role ?? "Teacher"}
            </p>
            <p className="text-xs font-bold text-obsidian-900 leading-none mt-1">
              {session?.user?.name ?? "User"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-obsidian-100 flex items-center justify-center font-bold text-xs">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? "T"}
          </div>
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-obsidian-100 flex items-center justify-center text-obsidian-500 hover:bg-obsidian-200 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto p-4 md:p-10">{children}</main>
    </div>
  );
}
