"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { MeloLoader, ChangePasswordModal } from "@school/shared";
import { authClient } from "@/auth-client";
import { School, Layers, ShieldCheck, KeyRound, LogOut, CreditCard, Menu, X, Plus } from "lucide-react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  // Close the mobile sheet on route change.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Always open a route at the top — never tucked under the sticky nav
  // (browser scroll restoration can otherwise land mid-page on reload).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Animate the bottom sheet: mount, slide up; unmount after slide down.
  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsSheetVisible(false);
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setIsSheetVisible(true)),
      );
      return () => cancelAnimationFrame(frame);
    }
    setIsSheetVisible(false);
    return undefined;
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

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
    {
      label: "Commercial",
      href: "/commercial",
      icon: CreditCard,
      active: pathname === "/commercial" || pathname.startsWith("/commercial/"),
    },
  ];

  const userLabel = session?.user?.name ?? session?.user?.email ?? "Super Admin";

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-slate-900">
      {/* Universal Super Admin Top Navigation Bar */}
      <nav aria-label="Super admin" className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="w-full px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Left: Platform Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm shrink-0">
                SA
              </div>
              <div className="min-w-0">
                <div className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                  Melo Platform
                </div>
                <div className="text-sm font-bold text-slate-900 leading-none truncate">
                  Super Admin
                </div>
              </div>
            </div>

            {/* Center: Unified Navigation Tabs (desktop) */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
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
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline-block max-w-44 truncate text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                {userLabel}
              </span>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xl:inline">Change Password</span>
                <span className="xl:hidden">Password</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Sign Out</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open super admin menu"
                aria-expanded={isMobileMenuOpen}
                className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: horizontally scrollable tabs — no wrapping, 44px targets */}
        <div className="md:hidden border-t border-slate-100">
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                    item.active
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.active ? "text-white" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/schools/create"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-600 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              New School
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile bottom sheet — full-screen, animated slide-up */}
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Super admin menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeMobileMenu}
            className={`absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 ${
              isSheetVisible ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-x-0 bottom-0 top-[3.5dvh] flex flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
              isSheetVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="pt-3 pb-1 flex justify-center shrink-0" aria-hidden="true">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                  SA
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 leading-none truncate">Super Admin</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{userLabel}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close super admin menu"
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-bold transition-colors ${
                      item.active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.active ? "bg-white/10" : "bg-white border border-slate-200"}`}>
                      <Icon className={`w-4 h-4 ${item.active ? "text-white" : "text-slate-500"}`} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/schools/create"
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-3.5 text-[15px] font-bold text-slate-700"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200">
                  <Plus className="w-4 h-4 text-slate-500" />
                </span>
                Create School
              </Link>
            </div>

            <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 shrink-0 bg-white rounded-b-none">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  setIsPasswordModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-700"
              >
                <KeyRound className="w-4 h-4 text-slate-500" />
                Change Password
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-bold text-rose-700"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main className="w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8 max-w-7xl mx-auto">{children}</main>

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
