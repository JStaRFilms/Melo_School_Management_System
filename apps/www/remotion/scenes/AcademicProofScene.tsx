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
import { VideoReportCard } from "../components/VideoReportCard";

export const AcademicProofScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 36,
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(reveal, [0, 1], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const overviewZoom = interpolate(frame, [0, 34], [0.94, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reportFocusZoom = interpolate(frame, [44, 108], [1, 1.36], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoom = overviewZoom * reportFocusZoom;
  const focusX = interpolate(frame, [44, 108], [0, -212], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focusY = interpolate(frame, [44, 108], [0, -72], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <VideoSafeWorkspaceNavbar
        workspace="teacher"
        currentPath="/assessments/report-card-extras"
        userName="Academic Registrar"
        userRole="Teacher"
      >
        <div
          style={{
            transform: `translate(${focusX}px, ${translateY + focusY}px) scale(${zoom})`,
            transformOrigin: "center top",
          }}
        >
          <VideoReportCard />
        </div>
      </VideoSafeWorkspaceNavbar>
    </AbsoluteFill>
  );
};
