import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { VideoSafeWorkspaceNavbar } from "../components/VideoSafeWorkspaceNavbar";
import { VideoAdminDashboard } from "../components/VideoAdminDashboard";

export const AdminCommandScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 28,
  });
  const opacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(reveal, [0, 1], [0.985, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, 95], [28, -36], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <VideoSafeWorkspaceNavbar
        workspace="admin"
        currentPath="/academic/teachers"
        userName="Tolani Ajayi"
        userRole="Lead Admin"
      >
        <div
          style={{
            transform: `translateX(${translateX}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <VideoAdminDashboard />
        </div>
      </VideoSafeWorkspaceNavbar>
    </AbsoluteFill>
  );
};
