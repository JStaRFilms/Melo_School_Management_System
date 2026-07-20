"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";

import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "./ReportCardSheet";

const BATCH_PRINT_STYLE_ID = "report-card-batch-print-v2-styles";
const A4_HEIGHT_MM = 297;
const BATCH_PAGE_PADDING_MM = 8;
const PX_PER_MM = 96 / 25.4;
const BATCH_FIT_SAFETY_MM = 4;
const BATCH_PRINTABLE_HEIGHT_PX =
  (A4_HEIGHT_MM -
    BATCH_PAGE_PADDING_MM * 2 -
    BATCH_FIT_SAFETY_MM) *
  PX_PER_MM;

export function calculateBatchPrintScale(contentHeightPx: number) {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return 1;
  return Math.min(
    1,
    BATCH_PRINTABLE_HEIGHT_PX / contentHeightPx
  );
}

function fitBatchPagesForPrint(root: HTMLElement) {
  const pages = Array.from(
    root.querySelectorAll<HTMLElement>(".rc-batch-print-v2-page")
  );

  for (const page of pages) {
    page.style.setProperty("--rc-batch-scale", "1");
  }
  void root.offsetHeight;

  for (const page of pages) {
    const sheet = page.querySelector<HTMLElement>(".rc-sheet");
    if (!sheet) continue;

    const contentHeight = Math.max(
      sheet.scrollHeight,
      sheet.getBoundingClientRect().height
    );
    const scale = calculateBatchPrintScale(contentHeight);
    page.style.setProperty("--rc-batch-scale", scale.toFixed(5));
    page.dataset.printScale = scale.toFixed(5);
  }
  void root.offsetHeight;
}

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
        transform: scale(var(--rc-batch-scale, 1)) !important;
        transform-origin: top center !important;
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
  /** Called when all pages are rendered, fitted, and assets are loaded. */
  onReady?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const restoreRef = useRef<(() => void) | null>(null);
  const batchKey = reportCards
    .map((reportCard) => `${reportCard.student._id}:${reportCard.sessionName}:${reportCard.termName}`)
    .join("|");

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
    setImagesLoaded(false);
    let isActive = true;
    const root = rootRef.current;
    if (!root) {
      setImagesLoaded(true);
      return () => { isActive = false; };
    }

    const images = Array.from(root.querySelectorAll("img"));
    if (images.length === 0) {
      setImagesLoaded(true);
      return () => { isActive = false; };
    }

    let settled = 0;
    const total = images.length;
    const check = () => {
      settled++;
      if (isActive && settled >= total) setImagesLoaded(true);
    };

    for (const img of images) {
      if (img.complete) {
        settled++;
      } else {
        img.addEventListener("load", check, { once: true });
        img.addEventListener("error", check, { once: true });
      }
    }
    if (settled >= total) setImagesLoaded(true);

    return () => {
      isActive = false;
      for (const img of images) {
        img.removeEventListener("load", check);
        img.removeEventListener("error", check);
      }
    };
  }, [batchKey]);

  // Wait for web fonts so measurements cannot change after printing starts.
  useEffect(() => {
    let isActive = true;
    setFontsLoaded(false);

    if (!document.fonts?.ready) {
      setFontsLoaded(true);
      return () => {
        isActive = false;
      };
    }

    void document.fonts.ready.then(() => {
      if (isActive) setFontsLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [batchKey]);

  // Re-fit inside the browser's print lifecycle so print-media layout wins.
  useEffect(() => {
    if (!imagesLoaded || !fontsLoaded || reportCards.length === 0) return;
    const root = rootRef.current;
    if (!root) return;

    const handleBeforePrint = () => {
      fitBatchPagesForPrint(root);
    };
    const printMedia = window.matchMedia("print");
    const handlePrintMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) handleBeforePrint();
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    printMedia.addEventListener("change", handlePrintMediaChange);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      printMedia.removeEventListener("change", handlePrintMediaChange);
    };
  }, [batchKey, fontsLoaded, imagesLoaded, reportCards.length]);

  // Fit every student independently, then print after two paint frames.
  useEffect(() => {
    if (!imagesLoaded || !fontsLoaded || reportCards.length === 0) return;
    const root = rootRef.current;
    if (!root) return;

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      fitBatchPagesForPrint(root);
      raf2 = requestAnimationFrame(() => {
        onReady?.();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [batchKey, fontsLoaded, imagesLoaded, reportCards.length, onReady]);

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
