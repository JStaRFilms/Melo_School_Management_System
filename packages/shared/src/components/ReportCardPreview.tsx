"use client";

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

export function ReportCardPreview({
  reportCard,
  backHref,
  hideToolbar = false,
  previewScale = DEFAULT_PREVIEW_SCALE,
}: ReportCardPreviewProps) {
  const previewWidth = A4_WIDTH_PX * previewScale;
  const previewHeight = A4_HEIGHT_PX * previewScale;

  return (
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
          transform: `scale(${previewScale})`,
          transformOrigin: "top left",
        }}
      >
        <ReportCardSheet
          reportCard={reportCard}
          backHref={backHref}
          hideToolbar={hideToolbar}
        />
      </div>
    </div>
  );
}