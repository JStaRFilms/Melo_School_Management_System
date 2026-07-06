import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getMockPortalWorkspaceData } from "../../../portal/lib/mock-portal-data";
import type { PortalBillingInvoice, PortalHistoryItem } from "../../../portal/lib/portal-types";
import { PortalWorkspaceView } from "../../../portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent";
import { PortalVideoShell } from "../portal-video/PortalVideoShell";
import {
  getPortalMobileMotionActiveClick,
  getPortalMobileMotionCursorPosition,
  getPortalMobileMotionLastReleasedClick,
  getPortalMobileMotionScene,
  getPortalMobileMotionScrollY,
  getPortalMobileMotionTransitionOpacity,
  portalMobileMotionTargetIds,
} from "../portal-video/mobileMotionTimeline";
import { TimelineTouchIndicator } from "../portal-video/VideoTouchIndicator";
import { VideoTargetDebugOverlay } from "../portal-video/targets";

type PortalMobileMotionProofProps = {
  showDebugTargets?: boolean;
};

export const PortalMobileMotionProof: React.FC<PortalMobileMotionProofProps> = ({
  showDebugTargets = false,
}) => {
  const frame = useCurrentFrame();
  const scene = getPortalMobileMotionScene(frame);
  const workspace = useMemo(
    () => getMockPortalWorkspaceData({
      studentId: scene.studentId,
      sessionId: scene.sessionId,
      termId: scene.termId,
      historyLimit: scene.mode === "dashboard" ? 4 : 8,
    }),
    [scene.studentId, scene.sessionId, scene.termId, scene.mode]
  );

  return (
    <AbsoluteFill
      data-video-coordinate-root="portal-mobile-motion-proof"
      className="bg-slate-100 font-sans text-slate-900"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_38%),linear-gradient(135deg,#f8fafc,#e0e7ff)]" />
      <PortalVideoShell
        scene={{
          ...scene,
          billingNotice: null,
          payingInvoiceId: null,
        }}
        forceMobileMenuOpen={scene.mobileMenuOpen}
        presentation="mobile"
        contentScrollY={getPortalMobileMotionScrollY(frame)}
        transitionOpacity={getPortalMobileMotionTransitionOpacity(frame)}
      >
        <PortalWorkspaceView
          mode={scene.mode}
          workspace={workspace}
          billing={undefined}
          billingNotice={null}
          payingInvoiceId={null}
          onSelectHistoryItem={async (_item: PortalHistoryItem) => undefined}
          onSelectStudent={async (_studentId: string) => undefined}
          onPayNow={async (_invoice: PortalBillingInvoice) => undefined}
        />
      </PortalVideoShell>
      {showDebugTargets ? (
        <VideoTargetDebugOverlay ids={portalMobileMotionTargetIds} showGrid />
      ) : null}
      <TimelineTouchIndicator
        targetIds={portalMobileMotionTargetIds}
        getPosition={getPortalMobileMotionCursorPosition}
        getActiveClickForFrame={getPortalMobileMotionActiveClick}
        getLastReleasedClickForFrame={getPortalMobileMotionLastReleasedClick}
      />
    </AbsoluteFill>
  );
};
