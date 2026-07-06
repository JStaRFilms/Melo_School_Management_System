import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { WorkspaceNavbar } from "@school/shared";
import { getMockPortalBillingData, getMockPortalWorkspaceData, mockPortalSchoolBranding, mockPortalSession } from "../../../portal/lib/mock-portal-data";
import type { PortalBillingInvoice, PortalHistoryItem, PortalWorkspaceMode } from "../../../portal/lib/portal-types";
import { PortalWorkspaceView } from "../../../portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent";

function getScene(frame: number): {
  mode: PortalWorkspaceMode;
  path: string;
  studentId: string | null;
  sessionId: string | null;
  termId: string | null;
  billingNotice: string | null;
  payingInvoiceId: string | null;
} {
  if (frame < 96) {
    return {
      mode: "dashboard",
      path: "/",
      studentId: null,
      sessionId: null,
      termId: null,
      billingNotice: null,
      payingInvoiceId: null,
    };
  }

  if (frame < 174) {
    return {
      mode: "report-cards",
      path: "/report-cards",
      studentId: frame > 136 ? "student_david_sunday" : "student_sarah_sunday",
      sessionId: "session_2025_2026",
      termId: "term_first",
      billingNotice: null,
      payingInvoiceId: null,
    };
  }

  return {
    mode: "billing",
    path: "/billing",
    studentId: "student_sarah_sunday",
    sessionId: null,
    termId: null,
    billingNotice: frame > 228 ? "Secure checkout is ready. Your payment status will update shortly." : null,
    payingInvoiceId: frame > 204 && frame <= 228 ? "invoice_sarah_term_2" : null,
  };
}

function Cursor() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clickPulse = spring({ frame: frame - 88, fps, config: { damping: 16, stiffness: 180 } });
  const clickPulse2 = spring({ frame: frame - 202, fps, config: { damping: 16, stiffness: 180 } });

  const x = interpolate(
    frame,
    [0, 70, 88, 120, 154, 190, 202, 250],
    [1050, 1115, 1115, 410, 382, 960, 960, 1040],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const y = interpolate(
    frame,
    [0, 70, 88, 120, 154, 190, 202, 250],
    [188, 216, 216, 312, 315, 742, 742, 690],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const pulse = Math.max(clickPulse, clickPulse2);

  return (
    <div
      className="pointer-events-none absolute z-[100]"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <div
        className="absolute -left-5 -top-5 h-10 w-10 rounded-full border-2 border-blue-500"
        style={{ opacity: Math.max(0, 0.55 - pulse * 0.55), transform: `scale(${0.35 + pulse * 1.7})` }}
      />
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" className="drop-shadow-[0_8px_14px_rgba(15,23,42,0.28)]">
        <path d="M5 3L23 16.5L14.5 18.2L10.5 26L5 3Z" fill="#0f172a" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export const PortalComponentProof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = getScene(frame);
  const workspace = useMemo(
    () => getMockPortalWorkspaceData({
      studentId: scene.studentId,
      sessionId: scene.sessionId,
      termId: scene.termId,
      historyLimit: scene.mode === "report-cards" ? 6 : 4,
    }),
    [scene.studentId, scene.sessionId, scene.termId, scene.mode]
  );
  const billing = useMemo(
    () => scene.mode === "billing" ? getMockPortalBillingData(workspace.selectedStudentId) : undefined,
    [scene.mode, workspace.selectedStudentId]
  );
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const cameraX = interpolate(frame, [0, 95, 174, 270], [0, -16, 0, -10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 70, 96, 174, 260], [0.985, 1, 1.018, 0.992, 1.01], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill className="bg-slate-100 font-sans text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff)]" />
      <div
        className="absolute inset-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/15"
        style={{
          opacity: entrance,
          transform: `translateX(${cameraX}px) scale(${cameraScale})`,
        }}
      >
        <WorkspaceNavbar
          workspace="portal"
          currentPath={scene.path}
          fullBleed
          userName={mockPortalSession.user.name}
          userRole={mockPortalSession.user.role}
          schoolBranding={mockPortalSchoolBranding}
          onSignOut={() => undefined}
          renderLink={(props) => (
            <a key={props.href} href={props.href} className={props.className}>
              {props.children}
            </a>
          )}
        >
          <PortalWorkspaceView
            mode={scene.mode}
            workspace={workspace}
            billing={billing}
            billingNotice={scene.billingNotice}
            payingInvoiceId={scene.payingInvoiceId}
            onSelectHistoryItem={async (_item: PortalHistoryItem) => undefined}
            onSelectStudent={async (_studentId: string) => undefined}
            onPayNow={async (_invoice: PortalBillingInvoice) => undefined}
          />
        </WorkspaceNavbar>
      </div>
      <Cursor />
    </AbsoluteFill>
  );
};
