import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { VideoSafeWorkspaceNavbar } from "../components/VideoSafeWorkspaceNavbar";
import { VideoPortalDashboard } from "../components/VideoPortalDashboard";

export const PortalTrustScene: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 84], [0.985, 1.02], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, 84], [0, -20], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <VideoSafeWorkspaceNavbar
        workspace="portal"
        currentPath="/"
        userName="John Sunday"
        userRole="Parent"
      >
        <div
          style={{
            transform: `translateX(${translateX}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <VideoPortalDashboard />
        </div>
      </VideoSafeWorkspaceNavbar>
    </AbsoluteFill>
  );
};
