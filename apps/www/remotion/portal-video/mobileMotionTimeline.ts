import { interpolate } from "remotion";
import type { PortalWorkspaceMode } from "../../../portal/lib/portal-types";
import type { CursorPoint, VideoClick } from "./timeline";
import type { VideoTargetId } from "./targets";

export type PortalMobileMotionScene = {
  mode: PortalWorkspaceMode;
  path: string;
  studentId: string | null;
  sessionId: string | null;
  termId: string | null;
  mobileMenuOpen: boolean;
};

export const portalMobileMotionClicks = {
  openMenu: {
    id: "open-mobile-menu",
    label: "Open mobile navigation",
    target: { frame: 28, targetId: "portal-mobile-menu", x: 344, y: 58 },
    downFrame: 34,
    upFrame: 38,
    commitFrame: 48,
  },
  openResults: {
    id: "open-mobile-results",
    label: "Open result history",
    target: { frame: 82, targetId: "portal-mobile-nav-results", x: 190, y: 310 },
    downFrame: 88,
    upFrame: 92,
    commitFrame: 106,
  },
  selectPriorTerm: {
    id: "select-mobile-prior-term",
    label: "Select prior term",
    target: { frame: 148, targetId: "portal-mobile-history-third-term", x: 194, y: 446 },
    downFrame: 154,
    upFrame: 158,
    commitFrame: 172,
  },
  openReportCard: {
    id: "open-mobile-report-card",
    label: "Open report card",
    target: { frame: 212, targetId: "portal-open-report-card", x: 245, y: 325 },
    downFrame: 218,
    upFrame: 222,
    commitFrame: 236,
  },
} as const satisfies Record<string, VideoClick>;

export const portalMobileMotionClickList = Object.values(portalMobileMotionClicks);
export const portalMobileMotionTargetIds = portalMobileMotionClickList.map(
  (click) => click.target.targetId
);

export function getPortalMobileMotionScene(frame: number): PortalMobileMotionScene {
  const menuOpened = frame >= portalMobileMotionClicks.openMenu.commitFrame;
  const resultsOpened = frame >= portalMobileMotionClicks.openResults.commitFrame;
  const priorTermSelected = frame >= portalMobileMotionClicks.selectPriorTerm.commitFrame;
  const reportCardOpened = frame >= portalMobileMotionClicks.openReportCard.commitFrame;

  if (!resultsOpened) {
    return {
      mode: "dashboard",
      path: "/",
      studentId: "student_sarah_sunday",
      sessionId: "session_2025_2026",
      termId: "term_first",
      mobileMenuOpen: menuOpened,
    };
  }

  if (!reportCardOpened) {
    return {
      mode: "results",
      path: "/results",
      studentId: "student_sarah_sunday",
      sessionId: priorTermSelected ? "session_2024_2025" : "session_2025_2026",
      termId: priorTermSelected ? "term_third" : "term_first",
      mobileMenuOpen: false,
    };
  }

  return {
    mode: "report-cards",
    path: "/report-cards",
    studentId: "student_sarah_sunday",
    sessionId: "session_2024_2025",
    termId: "term_third",
    mobileMenuOpen: false,
  };
}

export function getPortalMobileMotionScrollY(frame: number) {
  const scene = getPortalMobileMotionScene(frame);

  if (scene.mobileMenuOpen) {
    return 0;
  }

  if (scene.mode === "results") {
    return interpolate(frame, [108, 136, 174], [0, 86, 86], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (scene.mode === "report-cards") {
    return interpolate(frame, [236, 268, 286], [0, 210, 260], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return interpolate(frame, [0, 26], [0, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function getPortalMobileMotionCursorKeyframes(): CursorPoint[] {
  return [
    { frame: 0, x: 316, y: 63 },
    portalMobileMotionClicks.openMenu.target,
    {
      frame: portalMobileMotionClicks.openMenu.upFrame + 10,
      x: portalMobileMotionClicks.openMenu.target.x,
      y: portalMobileMotionClicks.openMenu.target.y,
      targetId: portalMobileMotionClicks.openMenu.target.targetId,
    },
    portalMobileMotionClicks.openResults.target,
    {
      frame: portalMobileMotionClicks.openResults.upFrame + 10,
      x: portalMobileMotionClicks.openResults.target.x,
      y: portalMobileMotionClicks.openResults.target.y,
      targetId: portalMobileMotionClicks.openResults.target.targetId,
    },
    { frame: 126, x: 210, y: 380 },
    portalMobileMotionClicks.selectPriorTerm.target,
    {
      frame: portalMobileMotionClicks.selectPriorTerm.upFrame + 10,
      x: portalMobileMotionClicks.selectPriorTerm.target.x,
      y: portalMobileMotionClicks.selectPriorTerm.target.y,
      targetId: portalMobileMotionClicks.selectPriorTerm.target.targetId,
    },
    portalMobileMotionClicks.openReportCard.target,
    {
      frame: portalMobileMotionClicks.openReportCard.upFrame + 16,
      x: portalMobileMotionClicks.openReportCard.target.x,
      y: portalMobileMotionClicks.openReportCard.target.y,
      targetId: portalMobileMotionClicks.openReportCard.target.targetId,
    },
    { frame: 282, x: 260, y: 430 },
  ];
}

export function getPortalMobileMotionCursorPosition(
  frame: number,
  measuredCenters: Partial<Record<VideoTargetId, { x: number; y: number }>> = {}
) {
  const keyframes = getPortalMobileMotionCursorKeyframes().map((point) => {
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

export function getPortalMobileMotionActiveClick(frame: number) {
  return portalMobileMotionClickList.find(
    (click) => frame >= click.downFrame && frame <= click.upFrame
  ) ?? null;
}

export function getPortalMobileMotionLastReleasedClick(frame: number) {
  return [...portalMobileMotionClickList]
    .reverse()
    .find((click) => frame >= click.upFrame && frame <= click.upFrame + 18) ?? null;
}

export function getPortalMobileMotionTransitionOpacity(frame: number) {
  const commits = portalMobileMotionClickList.map((click) => click.commitFrame);

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
