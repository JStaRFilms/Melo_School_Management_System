const MAX_BROWSER_OCR_PAGES = 8;

type RenderedOcrImage = {
  pageNumber: number;
  blob: Blob;
};

function assertBrowserOcrSupport() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Browser OCR preparation is only available in the browser.");
  }
  if (typeof HTMLCanvasElement === "undefined" || typeof Blob === "undefined") {
    throw new Error("This browser cannot prepare PDF pages for OCR. Try Chrome, Edge, Firefox, or Safari.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: "image/jpeg" | "image/png" | "image/webp", quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not prepare this PDF page for OCR."));
      else resolve(blob);
    }, type, quality);
  });
}

export async function renderPdfPagesToOcrImages(args: {
  file: File;
  pageNumbers?: number[] | null;
  onProgress?: (progress: { completed: number; total: number }) => void;
}): Promise<RenderedOcrImage[]> {
  assertBrowserOcrSupport();
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

  const arrayBuffer = await args.file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const requestedPages = args.pageNumbers?.length
    ? Array.from(new Set(args.pageNumbers)).sort((a, b) => a - b)
    : Array.from({ length: Math.min(pdf.numPages, MAX_BROWSER_OCR_PAGES) }, (_, index) => index + 1);
  const pageNumbers = requestedPages.filter((pageNumber) => pageNumber >= 1 && pageNumber <= pdf.numPages).slice(0, MAX_BROWSER_OCR_PAGES);
  if (pageNumbers.length === 0) {
    throw new Error("No valid PDF pages were available for OCR.");
  }

  const images: RenderedOcrImage[] = [];
  for (const pageNumber of pageNumbers) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not create an OCR canvas.");
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    let blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
    if (blob.size > 1_800_000) {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.62);
    }
    images.push({ pageNumber, blob });
    args.onProgress?.({ completed: images.length, total: pageNumbers.length });
  }
  return images;
}
