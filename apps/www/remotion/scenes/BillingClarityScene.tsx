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
import { VideoBillingDashboard } from "../components/VideoBillingDashboard";

export const BillingClarityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 26,
  });
  const scale = interpolate(reveal, [0, 1], [0.99, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, 90], [14, -28], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <VideoSafeWorkspaceNavbar
        workspace="admin"
        currentPath="/billing"
        userName="Bursar"
        userRole="Finance Admin"
      >
        <div
          style={{
            transform: `translateX(${translateX}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <VideoBillingDashboard />
        </div>
      </VideoSafeWorkspaceNavbar>
    </AbsoluteFill>
  );
};
