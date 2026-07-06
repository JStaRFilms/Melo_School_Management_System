import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getMockPortalBillingData, getMockPortalWorkspaceData } from "../../../portal/lib/mock-portal-data";
import type { PortalBillingInvoice, PortalHistoryItem } from "../../../portal/lib/portal-types";
import { PortalWorkspaceView } from "../../../portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent";
import { PortalVideoShell } from "../portal-video/PortalVideoShell";
import { getPortalScene } from "../portal-video/timeline";
import { VideoCursor } from "../portal-video/VideoCursor";

export const PortalComponentProof: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = getPortalScene(frame);
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

  return (
    <AbsoluteFill className="bg-slate-100 font-sans text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff)]" />
      <PortalVideoShell scene={scene}>
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
      </PortalVideoShell>
      <VideoCursor />
    </AbsoluteFill>
  );
};
