"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { MeloLoader, ChangePasswordModal } from "@school/shared";
import { authClient } from "@/auth-client";
import { School, Layers, ShieldCheck, KeyRound, LogOut } from "lucide-react";

export function PlatformLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const { session, signOut, isAuthenticated, isLoading, isPlatformAdmin } = useAuth();
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

    if (!isPlatformAdmin) {
      router.replace("/sign-in?error=unauthorized");
    }
  }, [isAuthenticated, isLoading, pathname, router, isPlatformAdmin]);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  if (isConvexConfigured() && (isLoading || !isAuthenticated || !isPlatformAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] w-full">
        <MeloLoader message="Preparing your platform workspace..." />
      </div>
    );
  }

  const navItems = [
    {
      label: "Schools",
      href: "/schools",
      icon: School,
      active: pathname === "/schools" || pathname.startsWith("/schools/"),
    },
    {
      label: "School Groups",
      href: "/groups",
      icon: Layers,
      active: pathname === "/groups" || pathname.startsWith("/groups/"),
    },
    {
      label: "Audit Explorer",
      href: "/audit",
      icon: ShieldCheck,
      active: pathname === "/audit" || pathname.startsWith("/audit/"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-slate-900">
      {/* Universal Super Admin Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="w-full px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Left: Platform Identity */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm">
                SA
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                  Melo Platform
                </div>
                <div className="text-sm font-bold text-slate-900 leading-none">
                  Super Admin
                </div>
              </div>
            </div>

            {/* Center: Unified Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      item.active
                        ? "bg-white text-slate-900 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.active ? "text-indigo-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right: User Status & Actions */}
            <div className="flex items-center gap-2.5">
              <span className="hidden md:inline-block text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                {session?.user?.name ?? session?.user?.email}
              </span>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Change Password</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="w-full px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto">{children}</main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onChangePassword={async ({ currentPassword, newPassword, revokeOtherSessions }) => {
          return await authClient.changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions,
          });
        }}
      />
    </div>
  );
}
