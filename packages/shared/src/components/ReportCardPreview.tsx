"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReportCardSheet, type ReportCardSheetData } from "./ReportCardSheet";

interface ReportCardPreviewProps {
  reportCard: ReportCardSheetData;
  backHref: string;
  hideToolbar?: boolean;
  previewScale?: number;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = A4_WIDTH_MM * PX_PER_MM;
const A4_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM;
const DEFAULT_PREVIEW_SCALE = 0.65;
const useMeasureLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ReportCardPreview({
  reportCard,
  backHref,
  hideToolbar = false,
  previewScale,
}: ReportCardPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  useMeasureLayoutEffect(() => {
    if (previewScale !== undefined || !container.current) return;
    const element = container.current;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setAvailableWidth(width);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [previewScale]);

  // Default portal previews fit their container. Explicit staff zoom remains
  // authoritative, and the sheet's own print lifecycle still owns A4 fitting.
  const scale = previewScale ?? Math.min(DEFAULT_PREVIEW_SCALE, (availableWidth ?? A4_WIDTH_PX) / A4_WIDTH_PX);
  const previewWidth = A4_WIDTH_PX * scale;
  const previewHeight = A4_HEIGHT_PX * scale;

  return (
    <div ref={container} className="rc-preview-container w-full">
      <div
        className="rc-print-root mx-auto"
        style={{
          width: previewWidth,
          height: previewHeight,
          overflow: "hidden",
          borderRadius: 8,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            width: A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ReportCardSheet reportCard={reportCard} backHref={backHref} hideToolbar={hideToolbar} />
        </div>
      </div>
    </div>
  );
}
