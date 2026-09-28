import { chromium } from '@playwright/test';
import { PDFDocument } from '../packages/convex/node_modules/pdf-lib/dist/pdf-lib.esm.js';
import { readFileSync } from 'node:fs';

const source = readFileSync('apps/portal/app/(portal)/components/portal-workspace/NarrativeReport.tsx', 'utf8');
const css = source.match(/<style>{`([\s\S]*?)`}<\/style>/)?.[1];
if (!css) throw new Error('Narrative print CSS not found');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>${css}</style><div class="narrative-paper" style="--school-primary:#fafafa">
    <header><p style="color:var(--school-primary)">Progress report</p><h1>School</h1></header>
    <section><h2>Art</h2><p>${'Long comment line.<br>'.repeat(160)}</p></section></div>`);
  await page.emulateMedia({ media: 'print' });
  const ink = await page.locator('header p').evaluate(node => getComputedStyle(node).color);
  if (ink !== 'rgb(17, 24, 39)') throw new Error(`Unreadable print heading: ${ink}`);
  const pdf = await PDFDocument.load(await page.pdf({ format: 'A4', printBackground: true }));
  if (pdf.getPageCount() < 2) throw new Error('Long comment did not continue onto another page');
  const batchSource = readFileSync('apps/admin/app/assessments/report-cards/components/NarrativeClassPrint.tsx', 'utf8');
  const batchCss = batchSource.match(/<style>{`([\s\S]*?)`}<\/style>/)?.[1];
  if (!batchCss) throw new Error('Batch print CSS not found');
  await page.setContent(`<style>${batchCss}</style><main class="narrative-batch">
    <div class="batch-controls">Controls should not print</div>
    <article class="batch-sheet"><header><h1>First student</h1></header><section><h2>Art</h2><p>${'Long note.<br>'.repeat(160)}</p></section></article>
    <article class="batch-sheet"><header><h1>Second student</h1></header><section><h2>Art</h2><p>Short note</p></section></article>
  </main>`);
  const batchPdf = await PDFDocument.load(await page.pdf({ format: 'A4', printBackground: true }));
  if (batchPdf.getPageCount() < 3) throw new Error('Batch did not allow a long report to continue before next student');
  const hidden = await page.locator('.batch-controls').evaluate(node => getComputedStyle(node).display);
  if (hidden !== 'none') throw new Error('Batch controls leaked into print');
  console.log(`Narrative print smoke passed: ${pdf.getPageCount()} portal A4 pages, ${batchPdf.getPageCount()} batch pages, heading ${ink}`);
} finally {
  await browser.close();
}
