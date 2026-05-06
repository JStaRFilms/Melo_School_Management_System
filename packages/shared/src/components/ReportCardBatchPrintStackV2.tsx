"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";

import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "./ReportCardSheet";

const BATCH_PRINT_STYLE_ID = "report-card-batch-print-v2-styles";

/**
 * Walk from `element` up to `document.body`:
 *  - Add `.rc-batch-print-hide` to every SIBLING at each level (hides
 *    sidebar, header, etc. in print).
 *  - Add `.rc-batch-print-ancestor` to every ANCESTOR (forces them to
 *    `display: block` in print so that page-break rules work — they are
 *    silently ignored inside flex/grid containers).
 *
 * Returns a cleanup function that removes all added classes.
 */
function isolateForPrint(element: HTMLElement): () => void {
  const hiddenSiblings: HTMLElement[] = [];
  const markedAncestors: HTMLElement[] = [];

  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      // Mark every sibling as hidden-for-print
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== current && sibling instanceof HTMLElement) {
          sibling.classList.add("rc-batch-print-hide");
          hiddenSiblings.push(sibling);
        }
      }
      // Mark the parent as a batch-print ancestor so we can force
      // display:block / overflow:visible in the print stylesheet
      parent.classList.add("rc-batch-print-ancestor");
      markedAncestors.push(parent);
    }
    current = parent;
  }

  return () => {
    for (const el of hiddenSiblings) {
      el.classList.remove("rc-batch-print-hide");
    }
    for (const el of markedAncestors) {
      el.classList.remove("rc-batch-print-ancestor");
    }
  };
}

function injectBatchPrintStyles() {
  if (typeof document === "undefined") return;
  document.getElementById(BATCH_PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = BATCH_PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 0; }

      /* ── Force every ancestor to block layout so page-breaks work ── */
      .rc-batch-print-ancestor {
        display: block !important;
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        width: auto !important;
        max-width: none !important;
        position: static !important;
        padding: 0 !important;
        margin: 0 !important;
        flex: none !important;
        background: transparent !important;
        border: none !important;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: auto !important;
        overflow: visible !important;
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ── Hide siblings (sidebar, header, etc.) ── */
      .rc-batch-print-hide,
      .rc-no-print {
        display: none !important;
      }

      /* ── Batch root ── */
      .rc-batch-print-v2-root {
        display: block !important;
        position: static !important;
        width: 210mm !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        overflow: visible !important;
      }

      /* ── Each page wrapper: exactly one A4 page ── */
      .rc-batch-print-v2-page {
        display: block !important;
        position: relative !important;
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        break-after: page !important;
        page-break-after: always !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .rc-batch-print-v2-page:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
      }

      /* ── Override ReportCardSheet's position:fixed ── */
      .rc-batch-print-v2-page .rc-print-root {
        position: static !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        width: 210mm !important;
        min-width: 210mm !important;
        max-width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        margin: 0 !important;
        padding: 8mm !important;
        transform: none !important;
        background: white !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        display: block !important;
      }

      .rc-batch-print-v2-page .rc-print-root > div {
        transform: none !important;
        width: 100% !important;
        height: 100% !important;
      }

      .rc-batch-print-v2-page .rc-sheet-wrapper {
        width: 100% !important;
        min-height: 0 !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .rc-batch-print-v2-page .rc-sheet {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
        background: white !important;
      }

      .rc-batch-print-v2-page .rc-sheet * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
  document.head.appendChild(style);
}

function cleanupBatchPrintStyles() {
  if (typeof document === "undefined") return;
  document.getElementById(BATCH_PRINT_STYLE_ID)?.remove();
}

export function ReportCardBatchPrintStackV2({
  reportCards,
  backHref,
  onReady,
}: {
  reportCards: ReportCardSheetData[];
  backHref: string;
  /** Called when all pages are rendered and images are loaded. */
  onReady?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const restoreRef = useRef<(() => void) | null>(null);

  // Inject batch print CSS
  useLayoutEffect(() => {
    injectBatchPrintStyles();
    return () => cleanupBatchPrintStyles();
  }, []);

  // DOM walk: hide siblings + mark ancestors for print isolation
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    restoreRef.current = isolateForPrint(root);
    return () => {
      restoreRef.current?.();
      restoreRef.current = null;
    };
  }, []);

  // Wait for images
  useEffect(() => {
    const root = rootRef.current;
    if (!root) { setImagesLoaded(true); return; }

    const images = Array.from(root.querySelectorAll("img"));
    if (images.length === 0) { setImagesLoaded(true); return; }

    let settled = 0;
    const total = images.length;
    function check() { if (++settled >= total) setImagesLoaded(true); }

    for (const img of images) {
      if (img.complete) { settled++; } else {
        img.addEventListener("load", check, { once: true });
        img.addEventListener("error", check, { once: true });
      }
    }
    if (settled >= total) setImagesLoaded(true);
  }, [reportCards]);

  // Fire onReady after images + double RAF
  useEffect(() => {
    if (!imagesLoaded || reportCards.length === 0) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => { onReady?.(); });
    });
    return () => cancelAnimationFrame(raf);
  }, [imagesLoaded, reportCards.length, onReady]);

  return (
    <div
      ref={rootRef}
      className="rc-batch-print-v2-root"
      aria-label="Batch report card print stack"
    >
      {reportCards.map((reportCard) => (
        <section
          key={`${reportCard.student._id}-${reportCard.sessionName}-${reportCard.termName}`}
          className="rc-batch-print-v2-page"
          aria-label={`Report card for ${reportCard.student.name}`}
        >
          <ReportCardSheet
            reportCard={reportCard}
            backHref={backHref}
            hideToolbar
          />
        </section>
      ))}
    </div>
  );
}
