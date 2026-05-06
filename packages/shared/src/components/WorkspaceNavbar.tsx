"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
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
  ShieldCheck,
  LayoutDashboard,
  Landmark,
  BookOpenText,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */

interface LinkRenderProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export interface WorkspaceSchoolBranding {
  name: string;
  logoUrl?: string | null;
  theme?: {
    primaryColor: string;
    accentColor: string;
  } | null;
}

export interface WorkspaceNavbarProps {
  workspace: WorkspaceKey;
  currentPath: string;
  fullBleed?: boolean;
  userName?: string | null;
  userRole?: string | null;
  schoolBranding?: WorkspaceSchoolBranding | null;
  onSignOut?: () => void;
  renderLink: (props: LinkRenderProps) => ReactNode;
  children: ReactNode;
}

/* ─── Component ──────────────────────────────────────────────── */

export function WorkspaceNavbar({
  workspace,
  currentPath,
  fullBleed = false,
  userName,
  userRole,
  schoolBranding,
  onSignOut,
  renderLink,
  children,
}: WorkspaceNavbarProps) {
  const def = getWorkspaceDefinition(workspace);
  const sections = getWorkspaceSections(workspace);
  const initials =
    userName?.trim().charAt(0).toUpperCase() ?? def.label.charAt(0);
  const schoolName = schoolBranding?.name?.trim() || null;
  const schoolInitials = buildSchoolInitials(schoolName ?? def.label);
  const primaryColor = schoolBranding?.theme?.primaryColor || "#020617";
  const accentColor = schoolBranding?.theme?.accentColor || "#2563eb";
  const workspaceTitle = schoolName
    ? `${schoolName} · ${def.label}`
    : `${def.label} Portal`;

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
            management: {
              label: "Management",
              icon: <LayoutDashboard className="h-4 w-4" />,
              links: sections.filter((section) =>
                ["/academic/teachers", "/admin", "/academic/archived-records"].includes(section.href)
              ),
            },
            academic: {
              label: "Academic Operations",
              icon: <GraduationCap className="h-4 w-4" />,
              links: sections.filter((section) =>
                [
                  "/academic/sessions",
                  "/academic/events",
                  "/academic/subjects",
                  "/academic/classes",
                  "/academic/students",
                  "/academic/knowledge/library",
                  "/academic/knowledge/templates",
                  "/academic/knowledge/assessment-profiles",
                ].includes(section.href)
              ),
            },
            finance: {
              label: "Finance",
              icon: <Landmark className="h-4 w-4" />,
              links: sections.filter((section) => section.href === "/billing"),
            },
            assessments: {
              label: "Assessments & Exams",
              icon: <ClipboardCheck className="h-4 w-4" />,
              links: sections.filter((section) => section.href.startsWith("/assessments")),
            },
          };

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

  useEffect(() => {
    if (schoolName) {
      document.title = workspaceTitle;
    }
  }, [schoolName, workspaceTitle]);

  const activeSection =
    sections
      .filter((section) => isWorkspaceSectionActive(section, currentPath))
      .sort((a, b) => {
        const aLength = Math.max(...a.matchers.map((matcher) => matcher.length));
        const bLength = Math.max(...b.matchers.map((matcher) => matcher.length));
        return bLength - aLength;
      })[0] ?? null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      
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

        <nav className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
          <div className="space-y-7 py-3">
            {Object.entries(groups)
              .filter(([, group]) => group.links.length > 0)
              .map(([key, group]) => (
              <div key={key} className="space-y-2.5">
                <h3 className="sticky top-0 z-10 -mx-1 bg-white/95 backdrop-blur-sm px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  {group.label}
                </h3>
                <div className="grid gap-0.5">
                  {group.links.map((s: WorkspaceSection) => (
                    <SidebarLink 
                      key={s.href} 
                      section={s} 
                      active={activeSection?.href === s.href} 
                      renderLink={renderLink} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 shrink-0">
           <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Node Status</p>
                <p className="text-[11px] font-bold text-slate-900 mt-0.5">Production Core</p>
              </div>
           </div>
        </div>
      </aside>

      {/* ═══ RIGHT SIDE (Header + Main) ════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        
        {/* ── TOP HEADER (Pinned) ── */}
        <header className="rc-no-print sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-4">
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
          className={`flex-1 overflow-y-auto overflow-x-hidden w-full relative custom-scrollbar scrollbar-hide ${
            fullBleed ? "" : "p-4 sm:p-6 lg:p-8"
          }`}
        >
          <div className={fullBleed ? "w-full" : "mx-auto max-w-[1600px]"}>
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

            <div ref={menuRef} className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide pb-32">
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
                            active={isWorkspaceSectionActive(s, currentPath)} 
                            renderLink={renderLink} 
                          />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-md">
               <button
                onClick={onSignOut}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 text-sm font-bold text-white shadow-lg shadow-slate-950/20"
              >
                <LogOut className="h-4 w-4" />
                Sign out secure session
              </button>
            </div>
          </div>
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
  if (logoUrl) {
    return (
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-1" />
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

function SidebarLink({ section, active, renderLink }: { section: any, active: boolean, renderLink: any }) {
  return renderLink({
    href: section.href,
    children: (
      <span
        className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-200 group ${
          active 
            ? "bg-slate-950 text-white shadow-md shadow-slate-950/10" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
        }`}
      >
        {section.label}
        <ChevronRight className={`h-3.5 w-3.5 transition-all ${
          active ? "text-blue-400 translate-x-0" : "text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
        }`} />
      </span>
    ),
  });
}

function MobileLink({ section, active, renderLink }: { section: any, active: boolean, renderLink: any }) {
  return renderLink({
    href: section.href,
    children: (
      <span
        className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-bold transition-all ${
          active 
            ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" 
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        {section.label}
        {active && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
      </span>
    ),
  });
}
