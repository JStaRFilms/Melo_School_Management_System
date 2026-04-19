import React from "react";
import { AbsoluteFill } from "remotion";
import { VideoPortalDashboard } from "../components/VideoPortalDashboard";
import { VideoSafeWorkspaceNavbar } from "../components/VideoSafeWorkspaceNavbar";

export const UnifiedOperationsStill: React.FC = () => {
  return (
    <AbsoluteFill className="bg-[#f3f4f6]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.04),transparent_55%)]" />

      <div className="absolute inset-[26px] overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.18)]">
        <VideoSafeWorkspaceNavbar
          workspace="portal"
          currentPath="/results"
          userName="John Sunday"
          userRole="Parent"
          fullBleed
        >
          <div className="relative bg-slate-50" style={{ height: 836 }}>
            <div className="absolute inset-x-8 top-8 bottom-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
              <div className="absolute inset-x-0 top-0 origin-top scale-[1.03]">
                <VideoPortalDashboard />
              </div>
            </div>
          </div>
        </VideoSafeWorkspaceNavbar>
      </div>
    </AbsoluteFill>
  );
};
