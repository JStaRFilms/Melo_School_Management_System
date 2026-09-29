import { chromium } from '@playwright/test';
import { PDFDocument } from '../packages/convex/node_modules/pdf-lib/dist/pdf-lib.esm.js';
import { getDocument } from '../packages/convex/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';

function printCss(path) {
  const source = readFileSync(path, 'utf8');
  const css = source.match(/<style>{`([\s\S]*?)`}<\/style>/)?.[1];
  if (!css) throw new Error(`Print CSS not found: ${path}`);
  return css;
}

// These inline constraints model the fixed-height WorkspaceNavbar and its
// fullBleed scroll pane. The narrative print styles must override them.
function staffShell(css, report) {
  return `<style>${css}</style>
    <div class="workspace-print-root" style="display:flex;height:100dvh;overflow:hidden">
      <aside style="height:100%;width:270px">Sidebar</aside>
      <div class="workspace-print-pane" style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden">
        <header class="rc-no-print" style="height:64px">Admin navbar</header>
        <main class="workspace-print-scroll" style="flex:1;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden">
          <div class="workspace-print-content" style="height:100%;min-height:100%;overflow:hidden">
            ${report}
          </div>
        </main>
      </div>
    </div>`;
}

async function pdfPageText(bytes, pageNumber) {
  const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map(item => 'str' in item ? item.str : '').join(' ');
  } finally {
    await document.destroy();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const portalCss = printCss('apps/portal/app/(portal)/components/portal-workspace/NarrativeReport.tsx');
  await page.setContent(`<style>${portalCss}</style><nav class="rc-no-print">Portal navbar</nav><div class="narrative-paper" style="--school-primary:#fafafa">
    <header><p style="color:var(--school-primary)">Progress report</p><h1>School</h1></header>
    <section><h2>Art</h2><p>${'Long comment line.<br>'.repeat(160)}</p></section></div>`);
  await page.emulateMedia({ media: 'print' });
  if (await page.locator('nav.rc-no-print').evaluate(node => getComputedStyle(node).display) !== 'none')
    throw new Error('Portal navbar leaked into print');
  if (await page.locator('.narrative-paper section').evaluate(node => getComputedStyle(node).visibility) !== 'visible')
    throw new Error('Portal report body disappeared in print');
  const ink = await page.locator('header p').evaluate(node => getComputedStyle(node).color);
  if (ink !== 'rgb(17, 24, 39)') throw new Error(`Unreadable print heading: ${ink}`);
  const portalPdf = await PDFDocument.load(await page.pdf({ format: 'A4', printBackground: true }));
  if (portalPdf.getPageCount() < 2) throw new Error('Long portal comment did not continue onto another page');

  const batchCss = printCss('apps/admin/app/assessments/report-cards/components/NarrativeClassPrint.tsx');
  await page.setContent(staffShell(batchCss, `<main class="narrative-batch">
    <div class="batch-controls">Controls should not print</div>
    <article class="batch-sheet"><header><h1>First student</h1></header><section><h2>Art</h2><p>${'Long note.<br>'.repeat(160)}</p></section></article>
    <article class="batch-sheet"><header><h1>Second student</h1></header><section><h2>Art</h2><p>SECOND STUDENT END</p></section></article>
  </main>`));
  if (await page.locator('.rc-no-print').evaluate(node => getComputedStyle(node).display) !== 'none' ||
      await page.locator('.workspace-print-root > aside').evaluate(node => getComputedStyle(node).display) !== 'none')
    throw new Error('Admin batch navbar or sidebar leaked into print');
  for (const selector of ['.workspace-print-root', '.workspace-print-pane', '.workspace-print-scroll', '.workspace-print-content']) {
    const layout = await page.locator(selector).evaluate(node => ({ height: getComputedStyle(node).height, overflow: getComputedStyle(node).overflow }));
    if (layout.overflow !== 'visible') throw new Error(`${selector} still clips print: ${layout.overflow}`);
  }
  if (await page.locator('.batch-sheet section').first().evaluate(node => getComputedStyle(node).display) === 'none')
    throw new Error('Admin batch report body disappeared in print');
  const batchBytes = await page.pdf({ format: 'A4', printBackground: true });
  const batchPdf = await PDFDocument.load(batchBytes);
  if (batchPdf.getPageCount() < 3 || !(await pdfPageText(batchBytes, batchPdf.getPageCount())).includes('SECOND STUDENT END'))
    throw new Error('Batch clipped the last student or did not continue across pages');
  if (await page.locator('.batch-controls').evaluate(node => getComputedStyle(node).display) !== 'none')
    throw new Error('Batch controls leaked into print');

  const reviewCss = printCss('apps/admin/app/assessments/report-cards/components/NarrativeReview.tsx');
  await page.setContent(staffShell(reviewCss, `<main class="narrative-review">
    <div class="narrative-review-paper"><header><h1>School</h1></header>
    <section><h2>Art</h2><p>${'Long review line.<br>'.repeat(160)}END OF REVIEW</p></section></div>
  </main>`));
  if (await page.locator('.rc-no-print').evaluate(node => getComputedStyle(node).display) !== 'none' ||
      await page.locator('.workspace-print-root > aside').evaluate(node => getComputedStyle(node).display) !== 'none')
    throw new Error('Admin review navbar or sidebar leaked into print');
  if (await page.locator('.workspace-print-scroll').evaluate(node => getComputedStyle(node).overflow) !== 'visible')
    throw new Error('Admin review scroll pane still clips print');
  const reviewBytes = await page.pdf({ format: 'A4', printBackground: true });
  const reviewPdf = await PDFDocument.load(reviewBytes);
  if (reviewPdf.getPageCount() < 2 || !(await pdfPageText(reviewBytes, reviewPdf.getPageCount())).includes('END OF REVIEW'))
    throw new Error('Admin review clipped the end of a long comment');
  console.log(`Narrative print smoke passed: ${portalPdf.getPageCount()} portal, ${batchPdf.getPageCount()} batch, ${reviewPdf.getPageCount()} review A4 pages; shell hidden, last-page text present, heading ${ink}`);
} finally {
  await browser.close();
}
