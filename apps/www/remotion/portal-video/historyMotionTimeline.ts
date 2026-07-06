import { interpolate } from "remotion";
import type { PortalWorkspaceMode } from "../../../portal/lib/portal-types";
import type { CursorPoint, VideoClick } from "./timeline";
import type { VideoTargetId } from "./targets";

export type PortalHistoryMotionScene = {
  mode: PortalWorkspaceMode;
  path: string;
  studentId: string | null;
  sessionId: string | null;
  termId: string | null;
};

export const portalHistoryMotionClicks = {
  seeAllResults: {
    id: "see-all-results",
    label: "Open academic history",
    target: { frame: 48, targetId: "portal-see-results", x: 826, y: 774 },
    downFrame: 54,
    upFrame: 58,
    commitFrame: 70,
  },
  selectPriorTerm: {
    id: "select-prior-term",
    label: "Select prior term",
    target: { frame: 112, targetId: "portal-history-third-term", x: 430, y: 515 },
    downFrame: 118,
    upFrame: 122,
    commitFrame: 134,
  },
  openReportCard: {
    id: "open-report-card-from-history",
    label: "Open report card",
    target: { frame: 166, targetId: "portal-open-report-card", x: 1246, y: 150 },
    downFrame: 172,
    upFrame: 176,
    commitFrame: 188,
  },
  exportPrint: {
    id: "export-print-report-card",
    label: "Export or print",
    target: { frame: 226, targetId: "portal-export-print", x: 1285, y: 190 },
    downFrame: 232,
    upFrame: 236,
    commitFrame: 248,
  },
} as const satisfies Record<string, VideoClick>;

export const portalHistoryMotionClickList = Object.values(portalHistoryMotionClicks);
export const portalHistoryMotionTargetIds = portalHistoryMotionClickList.map(
  (click) => click.target.targetId
);

export function getPortalHistoryMotionScene(frame: number): PortalHistoryMotionScene {
  const hasOpenedResults = frame >= portalHistoryMotionClicks.seeAllResults.commitFrame;
  const hasSelectedPriorTerm = frame >= portalHistoryMotionClicks.selectPriorTerm.commitFrame;
  const hasOpenedReportCard = frame >= portalHistoryMotionClicks.openReportCard.commitFrame;

  if (!hasOpenedResults) {
    return {
      mode: "dashboard",
      path: "/",
      studentId: "student_sarah_sunday",
      sessionId: "session_2025_2026",
      termId: "term_first",
    };
  }

  if (!hasOpenedReportCard) {
    return {
      mode: "results",
      path: "/results",
      studentId: "student_sarah_sunday",
      sessionId: hasSelectedPriorTerm ? "session_2024_2025" : "session_2025_2026",
      termId: hasSelectedPriorTerm ? "term_third" : "term_first",
    };
  }

  return {
    mode: "report-cards",
    path: "/report-cards",
    studentId: "student_sarah_sunday",
    sessionId: "session_2024_2025",
    termId: "term_third",
  };
}

export function getPortalHistoryMotionCursorKeyframes(): CursorPoint[] {
  return [
    { frame: 0, x: 950, y: 720 },
    { frame: 28, x: 875, y: 760 },
    portalHistoryMotionClicks.seeAllResults.target,
    {
      frame: portalHistoryMotionClicks.seeAllResults.upFrame + 10,
      x: portalHistoryMotionClicks.seeAllResults.target.x,
      y: portalHistoryMotionClicks.seeAllResults.target.y,
      targetId: portalHistoryMotionClicks.seeAllResults.target.targetId,
    },
    portalHistoryMotionClicks.selectPriorTerm.target,
    {
      frame: portalHistoryMotionClicks.selectPriorTerm.upFrame + 10,
      x: portalHistoryMotionClicks.selectPriorTerm.target.x,
      y: portalHistoryMotionClicks.selectPriorTerm.target.y,
      targetId: portalHistoryMotionClicks.selectPriorTerm.target.targetId,
    },
    portalHistoryMotionClicks.openReportCard.target,
    {
      frame: portalHistoryMotionClicks.openReportCard.upFrame + 10,
      x: portalHistoryMotionClicks.openReportCard.target.x,
      y: portalHistoryMotionClicks.openReportCard.target.y,
      targetId: portalHistoryMotionClicks.openReportCard.target.targetId,
    },
    portalHistoryMotionClicks.exportPrint.target,
    {
      frame: portalHistoryMotionClicks.exportPrint.upFrame + 18,
      x: portalHistoryMotionClicks.exportPrint.target.x - 8,
      y: portalHistoryMotionClicks.exportPrint.target.y + 6,
      targetId: portalHistoryMotionClicks.exportPrint.target.targetId,
    },
    { frame: 300, x: 1210, y: 225 },
  ];
}

export function getPortalHistoryMotionCursorPosition(
  frame: number,
  measuredCenters: Partial<Record<VideoTargetId, { x: number; y: number }>> = {}
) {
  const keyframes = getPortalHistoryMotionCursorKeyframes().map((point) => {
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

export function getPortalHistoryMotionActiveClick(frame: number) {
  return portalHistoryMotionClickList.find(
    (click) => frame >= click.downFrame && frame <= click.upFrame
  ) ?? null;
}

export function getPortalHistoryMotionLastReleasedClick(frame: number) {
  return [...portalHistoryMotionClickList]
    .reverse()
    .find((click) => frame >= click.upFrame && frame <= click.upFrame + 18) ?? null;
}

export function getPortalHistoryMotionTransitionOpacity(frame: number) {
  const commits = portalHistoryMotionClickList.map((click) => click.commitFrame);

  return Math.max(
    0,
    ...commits.map((commitFrame) => {
      const distance = Math.abs(frame - commitFrame);
      if (distance > 8) return 0;
      return interpolate(distance, [0, 8], [0.14, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    })
  );
}
