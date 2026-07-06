import React, { type ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { WorkspaceNavbar } from "@school/shared";
import { mockPortalSchoolBranding, mockPortalSession } from "../../../portal/lib/mock-portal-data";
import type { PortalVideoScene } from "./timeline";
import { getSceneTransitionOpacity } from "./timeline";

export function PortalVideoShell({
  scene,
  children,
}: {
  scene: PortalVideoScene;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const transitionOpacity = getSceneTransitionOpacity(frame);
  const cameraX = interpolate(frame, [0, 98, 180, 270], [0, -16, 0, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cameraScale = interpolate(frame, [0, 70, 98, 180, 260], [0.985, 1, 1.018, 0.992, 1.01], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute inset-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/15"
      style={{
        opacity: entrance,
        transform: `translateX(${cameraX}px) scale(${cameraScale})`,
      }}
    >
      <WorkspaceNavbar
        workspace="portal"
        currentPath={scene.path}
        fullBleed
        userName={mockPortalSession.user.name}
        userRole={mockPortalSession.user.role}
        schoolBranding={mockPortalSchoolBranding}
        onSignOut={() => undefined}
        renderLink={(props) => (
          <a key={props.href} href={props.href} className={props.className}>
            {props.children}
          </a>
        )}
      >
        <div className="relative h-full w-full">
          {children}
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            style={{ opacity: transitionOpacity }}
          />
        </div>
      </WorkspaceNavbar>
    </div>
  );
}
