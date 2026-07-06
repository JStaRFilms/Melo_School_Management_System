import React, { useLayoutEffect, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type VideoTargetId =
  | "portal-full-report"
  | "portal-child-david"
  | "portal-nav-billing"
  | "portal-pay-now"
  | "portal-see-results"
  | "portal-history-third-term"
  | "portal-open-report-card"
  | "portal-export-print";

export type VideoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MeasureOptions = {
  compositionWidth: number;
  compositionHeight: number;
  rootSelector?: string;
};

const defaultRootSelector = "[data-video-coordinate-root]";

export function getVideoTargetSelector(id: VideoTargetId) {
  return `[data-video-target="${id}"]`;
}

export function measureVideoTarget(
  id: VideoTargetId,
  {
    compositionWidth,
    compositionHeight,
    rootSelector = defaultRootSelector,
  }: MeasureOptions
): VideoRect | null {
  if (typeof document === "undefined") {
    return null;
  }

  const element = document.querySelector(getVideoTargetSelector(id));
  const root = document.querySelector(rootSelector);
  if (!element || !root) {
    return null;
  }

  const targetRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  if (
    targetRect.width === 0 ||
    targetRect.height === 0 ||
    rootRect.width === 0 ||
    rootRect.height === 0
  ) {
    return null;
  }

  // Remotion Studio scales the whole composition to fit the viewport.
  // getBoundingClientRect() returns those scaled viewport pixels, but cursor
  // transforms are authored in composition pixels. Normalize all measurements
  // back into the composition coordinate space.
  const scaleX = rootRect.width / compositionWidth;
  const scaleY = rootRect.height / compositionHeight;

  return {
    x: (targetRect.left - rootRect.left) / scaleX,
    y: (targetRect.top - rootRect.top) / scaleY,
    width: targetRect.width / scaleX,
    height: targetRect.height / scaleY,
  };
}

export function getVideoTargetCenter(id: VideoTargetId, options: MeasureOptions) {
  const rect = measureVideoTarget(id, options);
  if (!rect) {
    return null;
  }

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function useMeasuredVideoTargets(ids: VideoTargetId[], depsKey = "") {
  const { width, height } = useVideoConfig();
  const [rects, setRects] = useState<Partial<Record<VideoTargetId, VideoRect>>>({});

  useLayoutEffect(() => {
    let rafId = 0;

    const measure = () => {
      const nextRects: Partial<Record<VideoTargetId, VideoRect>> = {};

      for (const id of ids) {
        const rect = measureVideoTarget(id, {
          compositionWidth: width,
          compositionHeight: height,
        });
        if (rect) {
          nextRects[id] = rect;
        }
      }

      setRects(nextRects);
    };

    measure();
    rafId = requestAnimationFrame(measure);

    return () => cancelAnimationFrame(rafId);
  }, [ids.join("|"), depsKey, width, height]);

  return rects;
}

export function VideoTargetDebugOverlay({
  ids,
  showGrid,
}: {
  ids: VideoTargetId[];
  showGrid?: boolean;
}) {
  const frame = useCurrentFrame();
  const rects = useMeasuredVideoTargets(ids, String(frame));

  return (
    <div className="pointer-events-none absolute inset-0 z-[95]">
      {showGrid ? (
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(37,99,235,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.28) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      ) : null}
      {ids.map((id) => {
        const rect = rects[id];
        if (!rect) {
          return null;
        }

        return (
          <div
            key={id}
            className="absolute rounded-lg border-2 border-emerald-500 bg-emerald-400/10"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            <div className="absolute -top-6 left-0 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {id}
            </div>
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600" />
          </div>
        );
      })}
    </div>
  );
}
