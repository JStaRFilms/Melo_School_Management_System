"use client";

import { type ReactNode, useState, useRef, useEffect, useMemo } from "react";
import {
  getWorkspaceDefinition,
  getWorkspaceSections,
  isWorkspaceSectionActive,
  type WorkspaceKey,
  type WorkspaceSection,
} from "../workspace-navigation";
import { 
  ChevronDown,
  LogOut,
  Menu,
  X,
  Layers,
  GraduationCap,
  ClipboardCheck,
  ChevronRight,
  LayoutDashboard,
  Landmark,
  BookOpenText,
  Lock,
  Users,
  UserCheck,
  Calendar,
  CalendarRange,
  ClipboardPenLine,
  FileText,
  Sliders,
  TrendingUp,
  PlusCircle,
  SlidersHorizontal,
  Upload,
  CheckCircle2,
  BookOpen,
  FileCode,
  BadgePercent,
  CreditCard,
  Settings,
  ShieldCheck,
  Archive,
  History,
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

/* ─── Types ──────────────────────────────────────────────────── */

interface LinkRenderProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export interface WorkspaceSchoolFeatures {
  billing?: boolean;
  curriculum?: boolean;
  knowledgeLibrary?: boolean;
  admissions?: boolean;
}

export interface WorkspaceSchoolBranding {
  name: string;
  logoUrl?: string | null;
  theme?: {
    primaryColor: string;
    accentColor: string;
  } | null;
  features?: WorkspaceSchoolFeatures | null;
}

export interface WorkspaceNavbarProps {
  workspace: WorkspaceKey;
  currentPath: string;
  fullBleed?: boolean;
  userName?: string | null;
  userRole?: string | null;
  schoolBranding?: WorkspaceSchoolBranding | null;
  onSignOut?: () => void;
  onChangePassword?: (args: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean;
  }) => Promise<{ error?: { message?: string } | null } | void>;
  renderLink: (props: LinkRenderProps) => ReactNode;
  children: ReactNode;
}

/* ─── Component ──────────────────────────────────────────────── */

function hexToRgba(hex: string, alpha: number) {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c, 16);
  if (Number.isNaN(num) || c.length !== 6) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WorkspaceNavbar({
  workspace,
  currentPath,
  fullBleed = false,
  userName,
  userRole,
  schoolBranding,
  onSignOut,
  onChangePassword,
  renderLink,
  children,
}: WorkspaceNavbarProps) {
  const def = getWorkspaceDefinition(workspace);
  const sections = getWorkspaceSections(workspace);
  const initials =
    userName?.trim().charAt(0).toUpperCase() ?? def.label.charAt(0);
  const schoolName = schoolBranding?.name?.trim() || null;
  const schoolInitials = buildSchoolInitials(schoolName ?? def.label);
  const primaryColor = schoolBranding?.theme?.primaryColor || "#0f172a";
  const accentColor = schoolBranding?.theme?.accentColor || "#2563eb";
  const workspaceTitle = schoolName
    ? `${schoolName} · ${def.label}`
    : `${def.label} Portal`;

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Dynamically synchronize document tab title and school logo favicon
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (schoolName) {
      document.title = `${def.label} · ${schoolName}`;
    }
    if (schoolBranding?.logoUrl) {
      let iconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "shortcut icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = schoolBranding.logoUrl;
    }
  }, [schoolName, def.label, schoolBranding?.logoUrl]);

  const isStudentPortalUser = userRole === "student";

  const groups =
    workspace === "portal"
      ? {
          overview: {
            label: "Overview",
            icon: <LayoutDashboard className="h-4 w-4" />,
            links: sections.filter((section) => section.href === "/"),
          },
          records: {
            label: "Academic Records",
            icon: <GraduationCap className="h-4 w-4" />,
            links: sections.filter((section) => ["/report-cards", "/results"].includes(section.href)),
          },
          learning: {
            label: "Learning",
            icon: <BookOpenText className="h-4 w-4" />,
            links: isStudentPortalUser
              ? sections.filter((section) => section.href === "/learning/topics")
              : [],
          },
          alerts: {
            label: "Alerts",
            icon: <ClipboardCheck className="h-4 w-4" />,
            links: sections.filter((section) => section.href === "/notifications"),
          },
          finance: {
            label: "Finance",
            icon: <Landmark className="h-4 w-4" />,
            links: sections.filter((section) => section.href === "/billing"),
          },
        }
      : workspace === "teacher"
        ? {
            planning: {
              label: "Planning Studio",
              icon: <BookOpenText className="h-4 w-4" />,
              links: sections.filter((section) => section.href.startsWith("/planning")),
            },
            classroom: {
              label: "Classroom Ops",
              icon: <ClipboardCheck className="h-4 w-4" />,
              links: sections.filter((section) => section.href.startsWith("/assessments")),
            },
            enrollment: {
              label: "Enrollment",
              icon: <GraduationCap className="h-4 w-4" />,
              links: sections.filter((section) => section.href.startsWith("/enrollment")),
            },
          }
        : {
            main: {
              label: "Overview",
              icon: <LayoutDashboard className="h-4 w-4" />,
              links: sections.filter((s) => s.href === "/admin/dashboard"),
            },
            people: {
              label: "People & Operations",
              icon: <Users className="h-4 w-4" />,
              links: sections.filter((s) =>
                ["/academic/students", "/academic/teachers", "/academic/events"].includes(s.href)
              ),
            },
            academics: {
              label: "Academic & Grading",
              icon: <GraduationCap className="h-4 w-4" />,
              links: sections.filter((s) => {
                if (
                  [
                    "/assessments/results/entry",
                    "/assessments/report-card-extras",
                    "/assessments/setup/exam-recording",
                    "/assessments/setup/grading-bands",
                    "/assessments/setup/report-card-bundles",
                    "/assessments/report-cards/manual-adjustments",
                  ].includes(s.href)
                ) {
                  return true;
                }
                if (
                  s.href === "/academic/knowledge/curriculum-import" ||
                  s.href === "/academic/knowledge/curriculum-readiness"
                ) {
                  return schoolBranding?.features?.curriculum !== false;
                }
                if (s.href === "/academic/knowledge/library") {
                  return schoolBranding?.features?.knowledgeLibrary !== false;
                }
                if (
                  s.href === "/academic/knowledge/templates" ||
                  s.href === "/academic/knowledge/assessment-profiles"
                ) {
                  return true;
                }
                return false;
              }),
            },
            finance: {
              label: "Finance & Invoicing",
              icon: <Landmark className="h-4 w-4" />,
              links: schoolBranding?.features?.billing !== false
                ? sections.filter((s) => s.href === "/billing")
                : [],
            },
            settings: {
              label: "Setup & Settings",
              icon: <Settings className="h-4 w-4" />,
              links: sections.filter((s) =>
                [
                  "/academic/sessions",
                  "/academic/classes",
                  "/academic/subjects",
                  "/admin/settings",
                  "/admin",
                  "/academic/archived-records",
                  "/assessments/report-cards/backfill",
                ].includes(s.href)
              ),
            },
          };

  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Dynamic Navigation Layout Preference (default: 'grouped' aka Option 1)
  const [navLayout, setNavLayout] = useState<"grouped" | "accordion" | "domain_tabs">("grouped");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncLayout = () => {
      const saved = localStorage.getItem("melo_nav_layout");
      if (saved === "grouped" || saved === "accordion" || saved === "domain_tabs") {
        setNavLayout(saved);
      } else {
        setNavLayout("grouped");
      }
    };
    syncLayout();
    window.addEventListener("melo-nav-layout-changed", syncLayout);
    window.addEventListener("storage", syncLayout);
    return () => {
      window.removeEventListener("melo-nav-layout-changed", syncLayout);
      window.removeEventListener("storage", syncLayout);
    };
  }, []);

  const activeSection =
    sections
      .filter((section) => isWorkspaceSectionActive(section, currentPath))
      .sort((a, b) => {
        const aLength = Math.max(...a.matchers.map((matcher) => matcher.length));
        const bLength = Math.max(...b.matchers.map((matcher) => matcher.length));
        return bLength - aLength;
      })[0] ?? null;

  // Auto-expand the active section's group in accordion mode
  useEffect(() => {
    if (activeSection && navLayout === "accordion") {
      for (const [key, group] of Object.entries(groups)) {
        if (group.links.some((s: WorkspaceSection) => s.href === activeSection.href)) {
          setExpandedGroups((prev) => ({ ...prev, [key]: true }));
          break;
        }
      }
    }
  }, [activeSection?.href, navLayout]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Active domain calculation for domain_tabs mode
  const activeDomainKey = useMemo(() => {
    if (!activeSection) return Object.keys(groups)[0] ?? "";
    for (const [key, group] of Object.entries(groups)) {
      if (group.links.some((s: WorkspaceSection) => s.href === activeSection.href)) {
        return key;
      }
    }
    return Object.keys(groups)[0] ?? "";
  }, [activeSection?.href, groups]);

  const activeGroup =
    (groups as unknown as Record<string, { label: string; icon: ReactNode; links: WorkspaceSection[] }>)[activeDomainKey] ??
    Object.values(groups)[0] ?? {
      label: def.label,
      icon: <LayoutDashboard className="h-4 w-4" />,
      links: sections,
    };

  // Robust auto-scroll into view when active item changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      // 1. Desktop sidebar scroll
      if (desktopNavRef.current) {
        const activeEl = desktopNavRef.current.querySelector<HTMLElement>('[data-sidebar-active="true"]');
        if (activeEl) {
          const nav = desktopNavRef.current;
          const navRect = nav.getBoundingClientRect();
          const elRect = activeEl.getBoundingClientRect();
          if (elRect.top < navRect.top + 20 || elRect.bottom > navRect.bottom - 20) {
            activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }

      // 2. Mobile drawer scroll
      if (mobileNavRef.current) {
        const activeEl = mobileNavRef.current.querySelector<HTMLElement>('[data-sidebar-active="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeSection?.href, open, navLayout]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (open && menuRef.current && !menuRef.current.contains(target) &&
          toggleRef.current && !toggleRef.current.contains(target)) {
        setOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, profileOpen]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [currentPath]);

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans"
      style={{
        "--school-primary": primaryColor,
        "--school-accent": accentColor,
        "--school-primary-light": hexToRgba(primaryColor, 0.06),
        "--school-primary-border": hexToRgba(primaryColor, 0.15),
        "--school-accent-light": hexToRgba(accentColor, 0.10),
      } as React.CSSProperties}
    >
      
      {/* ═══ DESKTOP SIDEBAR (Pinned) ═══════════════════════════ */}
      <aside className="hidden h-full w-72 flex-col border-r border-slate-200 bg-white xl:flex shrink-0 z-30">
        <div className="flex h-16 items-center gap-4 px-6 border-b border-slate-100/60">
          <SchoolBrandMark
            name={schoolName ?? def.label}
            logoUrl={schoolBranding?.logoUrl ?? null}
            initials={schoolInitials}
            primaryColor={primaryColor}
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-bold tracking-tight text-slate-950 leading-none">
              {workspaceTitle}
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-1 leading-none">
              {schoolName ? "Active school workspace" : "Academic Engine"}
            </p>
          </div>
        </div>

        <nav ref={desktopNavRef} className="flex-1 overflow-y-auto px-3.5 py-3 custom-scrollbar scroll-smooth">
          
          {/* 1. Straight Grouped List Mode (Option 1 - Default) */}
          {navLayout === "grouped" && (
            <div className="space-y-5 py-1">
              {Object.entries(groups)
                .filter(([, group]) => group.links.length > 0)
                .map(([key, group]) => (
                <div key={key} className="space-y-1">
                  <h3 className="sticky top-0 z-10 -mx-1 bg-white/95 backdrop-blur-sm px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    {group.label}
                  </h3>
                  <div className="grid gap-0.5">
                    {group.links.map((s: WorkspaceSection) => (
                      <SidebarLink 
                        key={s.href} 
                        section={s} 
                        active={activeSection?.href === s.href} 
                        renderLink={renderLink}
                        primaryColor={primaryColor}
                        accentColor={accentColor}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. 2-Tier Collapsible Accordion Mode (Option 2) */}
          {navLayout === "accordion" && (
            <div className="space-y-1.5 py-1">
              {Object.entries(groups)
                .filter(([, group]) => group.links.length > 0)
                .map(([key, group]) => {
                  if (group.links.length === 1) {
                    const singleSection = group.links[0];
                    const isLinkActive = activeSection?.href === singleSection.href;
                    return (
                      <SidebarLink
                        key={singleSection.href}
                        section={singleSection}
                        active={isLinkActive}
                        renderLink={renderLink}
                        primaryColor={primaryColor}
                        accentColor={accentColor}
                      />
                    );
                  }

                  const isGroupExpanded = expandedGroups[key] ?? false;
                  const isGroupActive = group.links.some((s: WorkspaceSection) => s.href === activeSection?.href);

                  return (
                    <div key={key} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(key)}
                        className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-all duration-150 group cursor-pointer ${
                          isGroupActive
                            ? "bg-slate-100/90 text-slate-950 font-extrabold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            style={isGroupActive && accentColor ? { color: accentColor } : undefined}
                            className={`transition-colors ${isGroupActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-700"}`}
                          >
                            {group.icon}
                          </span>
                          <span className="truncate">{group.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/60 text-slate-500">
                            {group.links.length}
                          </span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                              isGroupExpanded ? "rotate-180 text-slate-700" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isGroupExpanded && (
                        <div className="ml-5 pl-2.5 border-l-2 border-slate-100 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          {group.links.map((s: WorkspaceSection) => (
                            <SidebarLink
                              key={s.href}
                              section={s}
                              active={activeSection?.href === s.href}
                              renderLink={renderLink}
                              isNested
                              primaryColor={primaryColor}
                              accentColor={accentColor}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* 3. Top Domain Switcher Mode (Option 3) */}
          {navLayout === "domain_tabs" && (
            <div className="space-y-4 py-1">
              <div className="px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 shrink-0"
                  >
                    {activeGroup.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-950 truncate uppercase tracking-wider">
                      {activeGroup.label}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400">
                      {activeGroup.links.length} {activeGroup.links.length === 1 ? "section" : "sections"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {activeGroup.links.map((s: WorkspaceSection) => (
                  <SidebarLink
                    key={s.href}
                    section={s}
                    active={activeSection?.href === s.href}
                    renderLink={renderLink}
                    primaryColor={primaryColor}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </div>
          )}

        </nav>

      </aside>

      {/* ═══ RIGHT SIDE (Header + Main) ════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full relative">
        
        {/* ── TOP HEADER (Pinned) ── */}
        <header className="rc-no-print sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-4 min-w-0">
            <div className="xl:hidden">
              <SchoolBrandMark
                name={schoolName ?? def.label}
                logoUrl={schoolBranding?.logoUrl ?? null}
                initials={schoolInitials}
                primaryColor={primaryColor}
              />
            </div>
            <div className="flex items-center gap-2 overflow-hidden">
               <span className="hidden text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 sm:block">
                {def.label}
              </span>
              <ChevronRight className="hidden h-3 w-3 text-slate-300 sm:block" />
              <h2 className="truncate font-display text-sm font-bold tracking-tight text-slate-950 xl:text-base">
                {activeSection?.label ?? "Dashboard"}
              </h2>
              {schoolName && (
                <span className="hidden truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 md:block">
                  {schoolName}
                </span>
              )}
            </div>
          </div>

          {/* ── TOP DOMAIN SWITCHER TABS (Rendered only when navLayout === 'domain_tabs') ── */}
          {navLayout === "domain_tabs" && (
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs">
              {Object.entries(groups)
                .filter(([, group]) => group.links.length > 0)
                .map(([key, group]) => {
                  const isDomainActive = key === activeDomainKey;
                  const targetHref = group.links[0]?.href ?? "#";
                  return renderLink({
                    href: targetHref,
                    children: (
                      <span
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isDomainActive
                            ? "bg-white text-slate-950 shadow-xs border border-slate-200/80 font-extrabold"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                      >
                        <span className={isDomainActive ? "text-indigo-600" : "text-slate-400"}>
                          {group.icon}
                        </span>
                        {group.label}
                      </span>
                    ),
                  });
                })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white transition-colors"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                </div>
                <div className="hidden text-left leading-none sm:block">
                  <p className="text-xs font-bold text-slate-900">{userName?.split(' ')[0]}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Session</p>
                </div>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-300 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5">
                  <div className="mb-1 rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authenticated as</p>
                    <p className="text-sm font-bold text-slate-950 truncate mt-0.5">{userName}</p>
                    <p className="text-[10px] font-medium text-slate-500 mt-0.5">{userRole}</p>
                  </div>
                  {onChangePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setIsPasswordModalOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 mb-0.5"
                    >
                      <Lock className="h-4 w-4 text-slate-400" />
                      Change password
                    </button>
                  )}
                  <button
                    onClick={onSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              ref={toggleRef}
              onClick={() => setOpen(!open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ── MAIN SCROLL AREA ── */}
        <main
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full relative custom-scrollbar scrollbar-hide ${
            fullBleed ? "" : "p-4 sm:p-6 lg:p-8"
          }`}
        >
          <div className={fullBleed ? "w-full min-h-full" : "mx-auto max-w-[1600px]"}>
            {children}
          </div>
        </main>

        {/* ═══ MOBILE DRAWER ═══════════════════════════════════ */}
        {open && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-white xl:hidden transition-all duration-300 animate-in fade-in slide-in-from-right-5">
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-100">
               <div className="flex items-center gap-3">
                  <SchoolBrandMark
                    name={schoolName ?? def.label}
                    logoUrl={schoolBranding?.logoUrl ?? null}
                    initials={schoolInitials}
                    primaryColor={primaryColor}
                  />
                  <span className="truncate font-display text-sm font-bold text-slate-950">
                    {schoolName ?? "Navigation"}
                  </span>
               </div>
               <button 
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-950"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            <div ref={mobileNavRef} className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide pb-32 scroll-smooth">
              <div className="mb-8 flex items-center gap-4 px-2">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-white shadow-xl shadow-slate-950/20"
                  style={{ backgroundColor: accentColor }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight text-slate-950">{userName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{userRole}</p>
                </div>
              </div>

              {/* Mobile Domain Tabs for domain_tabs mode */}
              {navLayout === "domain_tabs" && (
                <div className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                  {Object.entries(groups)
                    .filter(([, group]) => group.links.length > 0)
                    .map(([key, group]) => {
                      const isDomainActive = key === activeDomainKey;
                      const targetHref = group.links[0]?.href ?? "#";
                      return renderLink({
                        href: targetHref,
                        children: (
                          <span
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                              isDomainActive
                                ? "bg-slate-950 text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {group.icon}
                            {group.label}
                          </span>
                        ),
                      });
                    })}
                </div>
              )}

              {/* Mobile Straight Grouped List */}
              {navLayout === "grouped" && (
                <div className="space-y-8">
                  {Object.entries(groups)
                    .filter(([, group]) => group.links.length > 0)
                    .map(([key, group]) => (
                    <div key={key} className="space-y-3">
                      <h3 className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{group.label}</h3>
                      <div className="grid gap-1">
                        {group.links.map((s: WorkspaceSection) => (
                           <MobileLink 
                              key={s.href} 
                              section={s} 
                              active={activeSection?.href === s.href} 
                              renderLink={renderLink}
                              primaryColor={primaryColor}
                              accentColor={accentColor}
                            />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mobile Accordion Mode */}
              {navLayout === "accordion" && (
                <div className="space-y-2">
                  {Object.entries(groups)
                    .filter(([, group]) => group.links.length > 0)
                    .map(([key, group]) => {
                      if (group.links.length === 1) {
                        const singleSection = group.links[0];
                        const isLinkActive = activeSection?.href === singleSection.href;
                        return (
                          <MobileLink
                            key={singleSection.href}
                            section={singleSection}
                            active={isLinkActive}
                            renderLink={renderLink}
                            primaryColor={primaryColor}
                            accentColor={accentColor}
                          />
                        );
                      }

                      const isGroupExpanded = expandedGroups[key] ?? false;
                      const isGroupActive = group.links.some((s: WorkspaceSection) => s.href === activeSection?.href);

                      return (
                        <div key={key} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleGroup(key)}
                            className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                              isGroupActive ? "bg-slate-100 text-slate-950 font-extrabold" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                style={isGroupActive && accentColor ? { color: accentColor } : undefined}
                                className={`transition-colors ${isGroupActive ? "text-indigo-600" : "text-slate-400"}`}
                              >
                                {group.icon}
                              </span>
                              <span className="truncate">{group.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/60 text-slate-500">
                                {group.links.length}
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                                  isGroupExpanded ? "rotate-180 text-slate-700" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {isGroupExpanded && (
                            <div className="ml-5 pl-2.5 border-l-2 border-slate-100 space-y-1">
                              {group.links.map((s: WorkspaceSection) => (
                                <MobileLink
                                  key={s.href}
                                  section={s}
                                  active={activeSection?.href === s.href}
                                  renderLink={renderLink}
                                  isNested
                                  primaryColor={primaryColor}
                                  accentColor={accentColor}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Mobile Domain Tabs Focused Links */}
              {navLayout === "domain_tabs" && (
                <div className="space-y-1.5">
                  {activeGroup.links.map((s: WorkspaceSection) => (
                    <MobileLink
                      key={s.href}
                      section={s}
                      active={activeSection?.href === s.href}
                      renderLink={renderLink}
                      primaryColor={primaryColor}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              )}

            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-md space-y-2">
              {onChangePassword && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 shadow-sm"
                >
                  <Lock className="h-4 w-4 text-slate-400" />
                  Change password
                </button>
              )}
              <button
                onClick={onSignOut}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/20"
              >
                <LogOut className="h-4 w-4" />
                Sign out secure session
              </button>
            </div>
          </div>
        )}

        {onChangePassword && (
          <ChangePasswordModal
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
            onChangePassword={onChangePassword}
          />
        )}
      </div>
    </div>
  );
}

function buildSchoolInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SCH";
}

function SchoolBrandMark({
  name,
  logoUrl,
  initials,
  primaryColor,
}: {
  name: string;
  logoUrl: string | null;
  initials: string;
  primaryColor: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  if (logoUrl && !logoFailed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <img
          src={logoUrl}
          alt={`${name} logo`}
          loading="lazy"
          onError={() => setLogoFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black tracking-tighter text-white shadow-lg shadow-slate-950/20"
      style={{ backgroundColor: primaryColor }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

function getSectionIcon(href: string) {
  switch (href) {
    case "/":
    case "/admin/dashboard":
      return <LayoutDashboard className="h-4 w-4 shrink-0" />;
    case "/academic/students":
      return <Users className="h-4 w-4 shrink-0" />;
    case "/academic/teachers":
      return <UserCheck className="h-4 w-4 shrink-0" />;
    case "/academic/events":
      return <Calendar className="h-4 w-4 shrink-0" />;
    case "/assessments/results/entry":
    case "/assessments/exams/entry":
      return <ClipboardPenLine className="h-4 w-4 shrink-0" />;
    case "/assessments/report-card-extras":
    case "/assessments/report-card-workbench":
    case "/report-cards":
      return <FileText className="h-4 w-4 shrink-0" />;
    case "/assessments/setup/exam-recording":
      return <Sliders className="h-4 w-4 shrink-0" />;
    case "/assessments/setup/grading-bands":
      return <TrendingUp className="h-4 w-4 shrink-0" />;
    case "/assessments/setup/report-card-bundles":
      return <PlusCircle className="h-4 w-4 shrink-0" />;
    case "/assessments/report-cards/manual-adjustments":
      return <SlidersHorizontal className="h-4 w-4 shrink-0" />;
    case "/academic/knowledge/library":
    case "/planning/library":
      return <BookOpen className="h-4 w-4 shrink-0" />;
    case "/academic/knowledge/curriculum-import":
      return <Upload className="h-4 w-4 shrink-0" />;
    case "/academic/knowledge/curriculum-readiness":
      return <CheckCircle2 className="h-4 w-4 shrink-0" />;
    case "/academic/knowledge/templates":
    case "/planning":
      return <FileCode className="h-4 w-4 shrink-0" />;
    case "/academic/knowledge/assessment-profiles":
      return <BadgePercent className="h-4 w-4 shrink-0" />;
    case "/billing":
      return <CreditCard className="h-4 w-4 shrink-0" />;
    case "/academic/sessions":
      return <CalendarRange className="h-4 w-4 shrink-0" />;
    case "/academic/classes":
    case "/enrollment/subjects":
      return <GraduationCap className="h-4 w-4 shrink-0" />;
    case "/academic/subjects":
    case "/learning/topics":
      return <BookOpenText className="h-4 w-4 shrink-0" />;
    case "/admin/settings":
      return <Settings className="h-4 w-4 shrink-0" />;
    case "/admin":
      return <ShieldCheck className="h-4 w-4 shrink-0" />;
    case "/academic/archived-records":
      return <Archive className="h-4 w-4 shrink-0" />;
    case "/assessments/report-cards/backfill":
    case "/results":
      return <History className="h-4 w-4 shrink-0" />;
    case "/notifications":
      return <ClipboardCheck className="h-4 w-4 shrink-0" />;
    default:
      return <ChevronRight className="h-4 w-4 shrink-0" />;
  }
}

function SidebarLink({
  section,
  active,
  renderLink,
  isNested = false,
  primaryColor,
  accentColor,
}: {
  section: any;
  active: boolean;
  renderLink: any;
  isNested?: boolean;
  primaryColor?: string;
  accentColor?: string;
}) {
  return renderLink({
    href: section.href,
    children: (
      <span
        data-sidebar-active={active ? "true" : undefined}
        style={active && primaryColor ? { backgroundColor: primaryColor } : undefined}
        className={`flex items-center justify-between rounded-xl transition-all duration-150 group ${
          isNested ? "px-3 py-2 text-[12.5px]" : "px-3.5 py-2.5 text-[13px]"
        } font-bold ${
          active 
            ? "text-white shadow-sm" 
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            style={active && accentColor ? { color: accentColor } : undefined}
            className={`transition-colors ${active ? "text-blue-300" : "text-slate-400 group-hover:text-slate-700"}`}
          >
            {getSectionIcon(section.href)}
          </span>
          <span className="truncate">{section.label}</span>
        </div>
        <ChevronRight
          style={active && accentColor ? { color: accentColor } : undefined}
          className={`h-3.5 w-3.5 shrink-0 transition-all ${
            active ? "opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
          }`}
        />
      </span>
    ),
  });
}

function MobileLink({
  section,
  active,
  renderLink,
  isNested = false,
  primaryColor,
  accentColor,
}: {
  section: any;
  active: boolean;
  renderLink: any;
  isNested?: boolean;
  primaryColor?: string;
  accentColor?: string;
}) {
  return renderLink({
    href: section.href,
    children: (
      <span
        data-sidebar-active={active ? "true" : undefined}
        style={active && primaryColor ? { backgroundColor: primaryColor } : undefined}
        className={`flex items-center justify-between rounded-xl transition-all ${
          isNested ? "px-3.5 py-2.5 text-[13px]" : "px-4 py-3.5 text-sm"
        } font-bold ${
          active 
            ? "text-white shadow-lg shadow-slate-950/10" 
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            style={active && accentColor ? { color: accentColor } : undefined}
            className={`transition-colors ${active ? "text-blue-300" : "text-slate-400"}`}
          >
            {getSectionIcon(section.href)}
          </span>
          <span className="truncate">{section.label}</span>
        </div>
        {active && (
          <div
            className="h-1.5 w-1.5 rounded-full shadow-xs"
            style={{ backgroundColor: accentColor || "#60a5fa" }}
          />
        )}
      </span>
    ),
  });
}
