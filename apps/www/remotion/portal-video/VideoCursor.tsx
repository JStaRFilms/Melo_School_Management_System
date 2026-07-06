import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  getActiveClick,
  getCursorPosition,
  getLastReleasedClick,
  portalVideoTargetIds,
  type VideoClick,
} from "./timeline";
import { useMeasuredVideoTargets, type VideoTargetId } from "./targets";

type CursorPosition = { x: number; y: number };

type TimelineCursorProps = {
  targetIds: VideoTargetId[];
  getPosition: (
    frame: number,
    measuredCenters: Partial<Record<VideoTargetId, CursorPosition>>
  ) => CursorPosition;
  getActiveClickForFrame: (frame: number) => VideoClick | null;
  getLastReleasedClickForFrame: (frame: number) => VideoClick | null;
};

export function TimelineCursor({
  targetIds,
  getPosition,
  getActiveClickForFrame,
  getLastReleasedClickForFrame,
}: TimelineCursorProps) {
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
    ) as Partial<Record<VideoTargetId, CursorPosition>>,
    [targetRects]
  );
  const position = getPosition(frame, measuredCenters);
  const activeClick = getActiveClickForFrame(frame);
  const lastReleasedClick = getLastReleasedClickForFrame(frame);
  const pulse = lastReleasedClick
    ? spring({
        frame: frame - lastReleasedClick.upFrame,
        fps,
        config: { damping: 16, stiffness: 180 },
      })
    : 0;
  const pressScale = activeClick ? 0.88 : 1;

  return (
    <div
      className="pointer-events-none absolute z-[100]"
      style={{
        transform: `translate(${position.x}px, ${position.y}px) scale(${pressScale})`,
        transformOrigin: "6px 6px",
      }}
    >
      <div
        className="absolute -left-5 -top-5 h-10 w-10 rounded-full border-2 border-blue-500"
        style={{
          opacity: Math.max(0, 0.55 - pulse * 0.55),
          transform: `scale(${0.35 + pulse * 1.7})`,
        }}
      />
      {activeClick ? (
        <div className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-blue-500/20 ring-2 ring-blue-500/40" />
      ) : null}
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        className="drop-shadow-[0_8px_14px_rgba(15,23,42,0.28)]"
      >
        <path
          d="M5 3L23 16.5L14.5 18.2L10.5 26L5 3Z"
          fill="#0f172a"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function VideoCursor() {
  return (
    <TimelineCursor
      targetIds={portalVideoTargetIds}
      getPosition={getCursorPosition}
      getActiveClickForFrame={getActiveClick}
      getLastReleasedClickForFrame={getLastReleasedClick}
    />
  );
}
