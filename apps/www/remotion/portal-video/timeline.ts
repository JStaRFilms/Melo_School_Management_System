import { interpolate } from "remotion";
import type { PortalWorkspaceMode } from "../../../portal/lib/portal-types";
import type { VideoTargetId } from "./targets";

export type PortalVideoScene = {
  mode: PortalWorkspaceMode;
  path: string;
  studentId: string | null;
  sessionId: string | null;
  termId: string | null;
  billingNotice: string | null;
  payingInvoiceId: string | null;
};

export type CursorPoint = {
  frame: number;
  x: number;
  y: number;
  targetId?: VideoTargetId;
};

export type VideoClick = {
  id: string;
  label: string;
  target: CursorPoint & { targetId: VideoTargetId };
  downFrame: number;
  upFrame: number;
  /**
   * The first frame where UI state is allowed to change. Keep this after
   * upFrame so the rendered click visually lands before the app reacts.
   */
  commitFrame: number;
};

export const portalClicks = {
  openReportCard: {
    id: "open-report-card",
    label: "Open full report",
    target: { frame: 80, targetId: "portal-full-report", x: 1115, y: 216 },
    downFrame: 86,
    upFrame: 90,
    commitFrame: 98,
  },
  switchChild: {
    id: "switch-child",
    label: "Switch child",
    target: { frame: 127, targetId: "portal-child-david", x: 382, y: 315 },
    downFrame: 132,
    upFrame: 136,
    commitFrame: 144,
  },
  openBilling: {
    id: "open-billing",
    label: "Open billing",
    target: { frame: 164, targetId: "portal-nav-billing", x: 142, y: 504 },
    downFrame: 168,
    upFrame: 172,
    commitFrame: 180,
  },
  payInvoice: {
    id: "pay-invoice",
    label: "Start payment",
    target: { frame: 202, targetId: "portal-pay-now", x: 1028, y: 758 },
    downFrame: 206,
    upFrame: 210,
    commitFrame: 216,
  },
} as const satisfies Record<string, VideoClick>;

export const portalVideoClicks = Object.values(portalClicks);
export const portalVideoTargetIds = portalVideoClicks.map((click) => click.target.targetId);

export function getPortalScene(frame: number): PortalVideoScene {
  const hasOpenedReport = frame >= portalClicks.openReportCard.commitFrame;
  const hasSwitchedChild = frame >= portalClicks.switchChild.commitFrame;
  const hasOpenedBilling = frame >= portalClicks.openBilling.commitFrame;
  const paymentStarted = frame >= portalClicks.payInvoice.commitFrame;
  const paymentSettled = frame >= portalClicks.payInvoice.commitFrame + 22;

  if (!hasOpenedReport) {
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

  if (!hasOpenedBilling) {
    return {
      mode: "report-cards",
      path: "/report-cards",
      studentId: hasSwitchedChild ? "student_david_sunday" : "student_sarah_sunday",
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
    billingNotice: paymentSettled
      ? "Secure checkout is ready. Your payment status will update shortly."
      : null,
    payingInvoiceId: paymentStarted && !paymentSettled ? "invoice_sarah_term_2" : null,
  };
}

export function getCursorKeyframes(): CursorPoint[] {
  return [
    { frame: 0, x: 1050, y: 188 },
    { frame: 64, x: 1090, y: 198 },
    portalClicks.openReportCard.target,
    {
      frame: portalClicks.openReportCard.upFrame + 8,
      x: portalClicks.openReportCard.target.x,
      y: portalClicks.openReportCard.target.y,
      targetId: portalClicks.openReportCard.target.targetId,
    },
    portalClicks.switchChild.target,
    {
      frame: portalClicks.switchChild.upFrame + 8,
      x: portalClicks.switchChild.target.x,
      y: portalClicks.switchChild.target.y,
      targetId: portalClicks.switchChild.target.targetId,
    },
    portalClicks.openBilling.target,
    {
      frame: portalClicks.openBilling.upFrame + 8,
      x: portalClicks.openBilling.target.x,
      y: portalClicks.openBilling.target.y,
      targetId: portalClicks.openBilling.target.targetId,
    },
    portalClicks.payInvoice.target,
    {
      frame: portalClicks.payInvoice.upFrame + 16,
      x: portalClicks.payInvoice.target.x + 12,
      y: portalClicks.payInvoice.target.y - 10,
      targetId: portalClicks.payInvoice.target.targetId,
    },
    { frame: 268, x: 1080, y: 700 },
  ];
}

export function getCursorPosition(
  frame: number,
  measuredCenters: Partial<Record<VideoTargetId, { x: number; y: number }>> = {}
) {
  const keyframes = getCursorKeyframes().map((point) => {
    if (!point.targetId) {
      return point;
    }

    const measuredCenter = measuredCenters[point.targetId];
    return measuredCenter
      ? { ...point, x: measuredCenter.x, y: measuredCenter.y }
      : point;
  });

  const frames = keyframes.map((point) => point.frame);
  const xValues = keyframes.map((point) => point.x);
  const yValues = keyframes.map((point) => point.y);

  return {
    x: interpolate(frame, frames, xValues, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    y: interpolate(frame, frames, yValues, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
}

export function getActiveClick(frame: number) {
  return portalVideoClicks.find(
    (click) => frame >= click.downFrame && frame <= click.upFrame
  ) ?? null;
}

export function getLastReleasedClick(frame: number) {
  return [...portalVideoClicks]
    .reverse()
    .find((click) => frame >= click.upFrame && frame <= click.upFrame + 18) ?? null;
}

export function getSceneTransitionOpacity(frame: number) {
  const commits = portalVideoClicks.map((click) => click.commitFrame);

  return Math.max(
    0,
    ...commits.map((commitFrame) => {
      const distance = Math.abs(frame - commitFrame);
      if (distance > 8) return 0;
      return interpolate(distance, [0, 8], [0.16, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    })
  );
}
