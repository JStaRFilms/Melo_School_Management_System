"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import {
  getWorkspaceDefinition,
  getWorkspaceSections,
  isWorkspaceSectionActive,
  type WorkspaceKey,
} from "../workspace-navigation";

/* ─── Types ──────────────────────────────────────────────────── */

interface LinkRenderProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export interface WorkspaceNavbarProps {
  workspace: WorkspaceKey;
  currentPath: string;
  userName?: string | null;
  userRole?: string | null;
  onSignOut?: () => void;
  renderLink: (props: LinkRenderProps) => ReactNode;
}

/* ─── Palette ────────────────────────────────────────────────── */

const C = {
  bg: "#ffffff",
  bgHover: "#f8fafc",
  bgActive: "#f1f5f9",
  border: "#e8ecf1",
  borderSubtle: "#f1f5f9",
  ink: "#0f172a",
  inkMuted: "#64748b",
  inkFaint: "#94a3b8",
  inkGhost: "#cbd5e1",
} as const;

/* ─── Component ──────────────────────────────────────────────── */

export function WorkspaceNavbar({
  workspace,
  currentPath,
  userName,
  userRole,
  onSignOut,
  renderLink,
}: WorkspaceNavbarProps) {
  const def = getWorkspaceDefinition(workspace);
  const sections = getWorkspaceSections(workspace);
  const initials =
    userName?.trim().charAt(0).toUpperCase() ?? def.label.charAt(0);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        toggleRef.current && !toggleRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* Close on navigate */
  useEffect(() => setOpen(false), [currentPath]);

  const activeSection = sections.find((s) =>
    isWorkspaceSectionActive(s, currentPath)
  );

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* ═══ BAR ═══════════════════════════════════════════════ */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 16px",
          height: 52,
        }}
      >
        {/* ── Logo + label ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: C.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.14em",
            }}
          >
            OS
          </div>

          {/* Desktop workspace label */}
          <div className="ws-d">
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
              {def.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.inkFaint, marginLeft: 6 }}>
              {def.audience}
            </span>
          </div>

          {/* Mobile: active section name */}
          <div className="ws-m">
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
              {activeSection?.label ?? def.label}
            </span>
          </div>
        </div>

        {/* ── Section tabs (desktop) ── */}
        <nav className="ws-d" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
          {sections.map((section) => {
            const active = isWorkspaceSectionActive(section, currentPath);
            return renderLink({
              href: section.href,
              children: (
                <span
                  key={section.href}
                  className="ws-tab"
                  data-active={active || undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: active ? 650 : 500,
                    color: active ? C.ink : C.inkMuted,
                    whiteSpace: "nowrap",
                    borderRadius: 6,
                    background: active ? C.bgActive : "transparent",
                    transition: "all 0.15s ease",
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  {section.label}
                </span>
              ),
            });
          })}
        </nav>

        {/* ── Right controls ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
          {/* Desktop user info */}
          <div className="ws-d" style={{ textAlign: "right", marginRight: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.2, margin: 0 }}>
              {userName ?? "User"}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, lineHeight: 1.2, margin: 0 }}>
              {userRole ?? def.label}
            </p>
          </div>

          {/* Avatar */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: C.bgActive,
              border: `1.5px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: C.inkMuted,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          {/* Sign out (desktop) */}
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="ws-d ws-ghost"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.inkFaint,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 4,
                transition: "color 0.15s ease",
              }}
            >
              Sign out
            </button>
          ) : null}

          {/* Hamburger (mobile) */}
          <button
            ref={toggleRef}
            type="button"
            className="ws-m"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: `1.5px solid ${open ? C.inkMuted : C.border}`,
              background: open ? C.bgActive : C.bg,
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={C.inkMuted} strokeWidth="1.5" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </>
              ) : (
                <>
                  <line x1="3" y1="4.5" x2="13" y2="4.5" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                  <line x1="3" y1="11.5" x2="13" y2="11.5" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ MOBILE DRAWER ═════════════════════════════════════ */}
      {open && (
        <div
          ref={menuRef}
          className="ws-mb"
          style={{
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            padding: 16,
            boxShadow: "0 8px 24px -4px rgba(0,0,0,0.08)",
          }}
        >
          {/* User context */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>
              {userName ?? "User"}
              <span style={{ color: C.inkFaint, fontWeight: 500, marginLeft: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {userRole ?? def.label}
              </span>
            </p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.inkFaint, margin: "2px 0 0" }}>
              {def.label} · {def.audience}
            </p>
          </div>

          {/* Section links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {sections.map((section) => {
              const active = isWorkspaceSectionActive(section, currentPath);
              return renderLink({
                href: section.href,
                children: (
                  <span
                    key={section.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      color: active ? C.ink : C.inkMuted,
                      borderRadius: 8,
                      background: active ? C.bgActive : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    {active && (
                      <span style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: C.ink,
                        flexShrink: 0,
                      }} />
                    )}
                    {section.label}
                  </span>
                ),
              });
            })}
          </div>

          {/* Sign out */}
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "10px 0",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.inkFaint,
                background: C.bgHover,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      )}

      {/* ═══ RESPONSIVE CSS ════════════════════════════════════ */}
      <style>{`
        .ws-d  { display: none !important; }
        .ws-m  { display: flex !important; }
        .ws-mb { display: block !important; }
        @media (min-width: 768px) {
          .ws-d  { display: flex !important; }
          .ws-m  { display: none !important; }
          .ws-mb { display: none !important; }
        }
        .ws-tab:hover {
          background: ${C.bgHover} !important;
          color: ${C.ink} !important;
        }
        .ws-tab[data-active]:hover {
          background: ${C.bgActive} !important;
        }
        .ws-ghost:hover {
          color: ${C.ink} !important;
        }
      `}</style>
    </header>
  );
}
