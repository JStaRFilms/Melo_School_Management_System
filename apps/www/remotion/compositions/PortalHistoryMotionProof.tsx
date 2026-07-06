import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getMockPortalWorkspaceData } from "../../../portal/lib/mock-portal-data";
import type { PortalBillingInvoice, PortalHistoryItem } from "../../../portal/lib/portal-types";
import { PortalWorkspaceView } from "../../../portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent";
import { PortalVideoShell } from "../portal-video/PortalVideoShell";
import {
  getPortalHistoryMotionActiveClick,
  getPortalHistoryMotionCursorPosition,
  getPortalHistoryMotionLastReleasedClick,
  getPortalHistoryMotionScene,
  getPortalHistoryMotionTransitionOpacity,
  portalHistoryMotionTargetIds,
} from "../portal-video/historyMotionTimeline";
import { TimelineCursor } from "../portal-video/VideoCursor";
import { VideoTargetDebugOverlay } from "../portal-video/targets";

type PortalHistoryMotionProofProps = {
  showDebugTargets?: boolean;
};

export const PortalHistoryMotionProof: React.FC<PortalHistoryMotionProofProps> = ({
  showDebugTargets = false,
}) => {
  const frame = useCurrentFrame();
  const scene = getPortalHistoryMotionScene(frame);
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
      data-video-coordinate-root="portal-history-motion-proof"
      className="bg-slate-100 font-sans text-slate-900"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff)]" />
      <PortalVideoShell
        scene={{
          ...scene,
          billingNotice: null,
          payingInvoiceId: null,
        }}
        transitionOpacity={getPortalHistoryMotionTransitionOpacity(frame)}
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
        <VideoTargetDebugOverlay ids={portalHistoryMotionTargetIds} showGrid />
      ) : null}
      <TimelineCursor
        targetIds={portalHistoryMotionTargetIds}
        getPosition={getPortalHistoryMotionCursorPosition}
        getActiveClickForFrame={getPortalHistoryMotionActiveClick}
        getLastReleasedClickForFrame={getPortalHistoryMotionLastReleasedClick}
      />
    </AbsoluteFill>
  );
};
