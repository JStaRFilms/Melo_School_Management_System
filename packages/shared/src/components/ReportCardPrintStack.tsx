"use client";

import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "./ReportCardSheet";

export function ReportCardPrintStack({
  reportCards,
  backHref,
}: {
  reportCards: ReportCardSheetData[];
  backHref: string;
}) {
  return (
    <div>
      {reportCards.map((reportCard) => (
        <div
          key={`${reportCard.student._id}-${reportCard.termName}`}
          className="rc-stack-item"
        >
          <ReportCardSheet
            reportCard={reportCard}
            backHref={backHref}
            hideToolbar
          />
        </div>
      ))}
    </div>
  );
}
