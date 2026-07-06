import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoClick } from "./timeline";
import { useMeasuredVideoTargets, type VideoTargetId } from "./targets";

type TouchPosition = { x: number; y: number };

type TimelineTouchIndicatorProps = {
  targetIds: VideoTargetId[];
  getPosition: (
    frame: number,
    measuredCenters: Partial<Record<VideoTargetId, TouchPosition>>
  ) => TouchPosition;
  getActiveClickForFrame: (frame: number) => VideoClick | null;
  getLastReleasedClickForFrame: (frame: number) => VideoClick | null;
};

export function TimelineTouchIndicator({
  targetIds,
  getPosition,
  getActiveClickForFrame,
  getLastReleasedClickForFrame,
}: TimelineTouchIndicatorProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const targetRects = useMeasuredVideoTargets(targetIds, String(frame));
  const measuredCenters = useMemo(
    () => Object.fromEntries(
      Object.entries(targetRects).map(([id, rect]) => [
        id,
        {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        },
      ])
    ) as Partial<Record<VideoTargetId, TouchPosition>>,
    [targetRects]
  );
  const position = getPosition(frame, measuredCenters);
  const activeClick = getActiveClickForFrame(frame);
  const lastReleasedClick = getLastReleasedClickForFrame(frame);
  const pulse = lastReleasedClick
    ? spring({
        frame: frame - lastReleasedClick.upFrame,
        fps,
        config: { damping: 15, stiffness: 210 },
      })
    : 0;
  const activeProgress = activeClick
    ? interpolate(
        frame,
        [activeClick.downFrame, activeClick.upFrame],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;
  const idleOpacity = activeClick || lastReleasedClick ? 1 : 0.78;

  return (
    <div
      className="pointer-events-none absolute z-[100]"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 rounded-full border-2 border-blue-500 bg-blue-500/10"
        style={{
          width: 42 + activeProgress * 8,
          height: 42 + activeProgress * 8,
          opacity: activeClick ? 0.95 : idleOpacity,
          transform: "translate(-50%, -50%)",
          boxShadow: activeClick
            ? "0 0 0 10px rgba(59,130,246,0.10)"
            : "0 10px 25px rgba(15,23,42,0.18)",
        }}
      />
      {lastReleasedClick ? (
        <div
          className="absolute left-1/2 top-1/2 rounded-full border-2 border-blue-400"
          style={{
            width: 34 + pulse * 42,
            height: 34 + pulse * 42,
            opacity: Math.max(0, 0.7 - pulse * 0.7),
            transform: "translate(-50%, -50%)",
          }}
        />
      ) : null}
      <div
        className="absolute left-1/2 top-1/2 h-3.5 w-3.5 rounded-full bg-blue-500"
        style={{
          opacity: activeClick ? 0.95 : 0.62,
          transform: `translate(-50%, -50%) scale(${activeClick ? 0.82 : 1})`,
        }}
      />
    </div>
  );
}
